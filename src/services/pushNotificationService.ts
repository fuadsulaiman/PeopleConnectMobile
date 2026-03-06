/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging (FCM) for push notifications
 *
 * Note: Firebase credentials (google-services.json for Android, GoogleService-Info.plist for iOS)
 * must be added before this service will function. The service uses optional imports
 * to gracefully handle the case when Firebase is not configured.
 */

import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern instead
const getDevicesService = () => {
  const sdk = require('./sdk');
  return sdk.devices;
};

// Storage keys
const FCM_TOKEN_KEY = 'fcm_token';
const FCM_TOKEN_REGISTERED_KEY = 'fcm_token_registered';
const NOTIFICATION_PERMISSION_KEY = 'notification_permission';

// Optional Firebase imports - will be null if Firebase is not configured
let messaging: any = null;
let notifee: any = null;

// Try to import Firebase Messaging
try {
  const firebaseMessaging = require('@react-native-firebase/messaging').default;
  // Verify it's actually callable (Firebase is properly configured)
  if (typeof firebaseMessaging === 'function') {
    messaging = firebaseMessaging;
  } else {
    console.log(
      '[PushNotification] Firebase messaging imported but not callable - credentials may be missing'
    );
  }
} catch (e) {
  console.log('[PushNotification] Firebase messaging not configured - push notifications disabled');
}

// Try to import Notifee for local notifications (optional but recommended)
try {
  notifee = require('@notifee/react-native').default;
} catch (e) {
  console.log('[PushNotification] Notifee not installed - local notifications disabled');
}

// Notification types for navigation
export type NotificationType =
  | 'message'
  | 'call'
  | 'contact_request'
  | 'mention'
  | 'broadcast'
  | 'announcement'
  | 'system';

export interface NotificationData {
  type: NotificationType;
  conversationId?: string;
  messageId?: string;
  callId?: string;
  userId?: string;
  title?: string;
  body?: string;
  [key: string]: any;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'blocked';

export interface NotificationMessage {
  notification?: {
    title?: string;
    body?: string;
    android?: any;
    ios?: any;
  };
  data?: NotificationData;
  from?: string;
  messageId?: string;
  sentTime?: number;
}

// Callback types for notification handlers
type NotificationHandler = (message: NotificationMessage) => void;
type NotificationOpenedHandler = (data: NotificationData) => void;

class PushNotificationService {
  private isInitialized = false;
  private foregroundHandler: NotificationHandler | null = null;
  private notificationOpenedHandler: NotificationOpenedHandler | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private foregroundUnsubscribe: (() => void) | null = null;

  /**
   * Check if Firebase is available
   */
  isFirebaseAvailable(): boolean {
    return messaging !== null;
  }

  /**
   * Initialize the push notification service
   * Should be called on app startup
   */
  async initialize(): Promise<boolean> {
    if (!this.isFirebaseAvailable()) {
      console.log('[PushNotification] Firebase not available - skipping initialization');
      return false;
    }

    if (this.isInitialized) {
      console.log('[PushNotification] Already initialized');
      return true;
    }

    try {
      console.log('[PushNotification] Initializing...');

      // Set up background message handler
      this.setupBackgroundHandler();

      // Set up notification opened handler (when app opens from notification)
      this.setupNotificationOpenedHandler();

      // Set up foreground notification handler
      this.setupForegroundHandler();

      // Set up token refresh handler
      this.setupTokenRefreshHandler();

      this.isInitialized = true;
      console.log('[PushNotification] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[PushNotification] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Request notification permissions from the user
   */
  async requestPermission(): Promise<PermissionStatus> {
    if (!this.isFirebaseAvailable()) {
      console.log('[PushNotification] Firebase not available');
      return 'denied';
    }

    try {
      const authStatus = await messaging().requestPermission();

      const status = this.mapAuthStatus(authStatus);
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, status);

      console.log('[PushNotification] Permission status:', status);
      return status;
    } catch (error) {
      console.error('[PushNotification] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * Check current notification permission status
   */
  async checkPermission(): Promise<PermissionStatus> {
    if (!this.isFirebaseAvailable()) {
      return 'denied';
    }

    try {
      const authStatus = await messaging().hasPermission();
      return this.mapAuthStatus(authStatus);
    } catch (error) {
      console.error('[PushNotification] Error checking permission:', error);
      return 'undetermined';
    }
  }

  /**
   * Map Firebase auth status to our permission status
   */
  private mapAuthStatus(authStatus: number): PermissionStatus {
    // Firebase messaging auth statuses
    // -1 = Not determined, 0 = Denied, 1 = Authorized, 2 = Provisional
    switch (authStatus) {
      case 1:
      case 2:
        return 'granted';
      case 0:
        return 'denied';
      case -1:
      default:
        return 'undetermined';
    }
  }

  /**
   * Get the FCM token for this device
   */
  async getToken(): Promise<string | null> {
    if (!this.isFirebaseAvailable()) {
      return null;
    }

    try {
      // Check permission first
      const permission = await this.checkPermission();
      if (permission !== 'granted') {
        console.log('[PushNotification] No permission to get token');
        return null;
      }

      const token = await messaging().getToken();
      if (token) {
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        console.log('[PushNotification] Got FCM token:', token.substring(0, 20) + '...');
      }
      return token;
    } catch (error) {
      console.error('[PushNotification] Error getting token:', error);
      return null;
    }
  }

  /**
   * Register the device token with the backend
   */
  async registerTokenWithBackend(forceRegister = false): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.log('[PushNotification] No token to register');
        return false;
      }

      // Check if already registered (unless forced)
      if (!forceRegister) {
        const registeredToken = await AsyncStorage.getItem(FCM_TOKEN_REGISTERED_KEY);
        if (registeredToken === token) {
          console.log('[PushNotification] Token already registered');
          return true;
        }
      }

      // Get device name
      const deviceName = await this.getDeviceName();

      // Register with backend using the SDK's devices service
      const devices = getDevicesService();
      await devices.register({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName,
      });

      // Mark as registered
      await AsyncStorage.setItem(FCM_TOKEN_REGISTERED_KEY, token);
      console.log('[PushNotification] Token registered with backend');
      return true;
    } catch (error) {
      console.error('[PushNotification] Error registering token:', error);
      return false;
    }
  }

  /**
   * Unregister the device token from the backend (e.g., on logout)
   */
  async unregisterToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(FCM_TOKEN_KEY);
      if (token) {
        // Note: SDK doesn't have a direct unregister method
        // The token will expire on its own or be overwritten on next login
        console.log('[PushNotification] Token cleared locally');
      }

      // Clear local storage
      await AsyncStorage.multiRemove([FCM_TOKEN_KEY, FCM_TOKEN_REGISTERED_KEY]);
      return true;
    } catch (error) {
      console.error('[PushNotification] Error unregistering token:', error);
      // Clear local storage even on error
      await AsyncStorage.multiRemove([FCM_TOKEN_KEY, FCM_TOKEN_REGISTERED_KEY]);
      return false;
    }
  }

  /**
   * Delete the FCM token (for testing or when disabling notifications)
   */
  async deleteToken(): Promise<boolean> {
    if (!this.isFirebaseAvailable()) {
      return false;
    }

    try {
      await messaging().deleteToken();
      await AsyncStorage.multiRemove([FCM_TOKEN_KEY, FCM_TOKEN_REGISTERED_KEY]);
      console.log('[PushNotification] Token deleted');
      return true;
    } catch (error) {
      console.error('[PushNotification] Error deleting token:', error);
      return false;
    }
  }

  /**
   * Set up background message handler
   * This is called when a message is received while the app is in the background or terminated
   */
  private setupBackgroundHandler(): void {
    if (!this.isFirebaseAvailable()) {
      return;
    }

    messaging().setBackgroundMessageHandler(async (remoteMessage: NotificationMessage) => {
      console.log('[PushNotification] Background message received:', remoteMessage);

      // Process the message data
      const data = this.normalizeNotificationData(remoteMessage.data);

      // You can perform background tasks here like:
      // - Updating badge count
      // - Storing message for later
      // - Triggering local notification

      // If notifee is available, display a local notification
      if (notifee && data) {
        await this.displayLocalNotification(
          remoteMessage.notification?.title || 'New notification',
          remoteMessage.notification?.body || '',
          data
        );
      }
    });
  }

  /**
   * Set up handler for when app is opened from a notification
   */
  private setupNotificationOpenedHandler(): void {
    if (!this.isFirebaseAvailable()) {
      return;
    }

    // Handle notification that opened the app from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage: NotificationMessage | null) => {
        if (remoteMessage) {
          console.log(
            '[PushNotification] App opened from quit state by notification:',
            remoteMessage
          );
          const data = this.normalizeNotificationData(remoteMessage.data);
          if (data && this.notificationOpenedHandler) {
            // Delay slightly to ensure navigation is ready
            setTimeout(() => {
              this.notificationOpenedHandler?.(data);
            }, 500);
          }
        }
      });

    // Handle notification that opened the app from background state
    messaging().onNotificationOpenedApp((remoteMessage: NotificationMessage) => {
      console.log('[PushNotification] App opened from background by notification:', remoteMessage);
      const data = this.normalizeNotificationData(remoteMessage.data);
      if (data && this.notificationOpenedHandler) {
        this.notificationOpenedHandler(data);
      }
    });
  }

  /**
   * Set up handler for foreground notifications
   */
  private setupForegroundHandler(): void {
    if (!this.isFirebaseAvailable()) {
      return;
    }

    this.foregroundUnsubscribe = messaging().onMessage(
      async (remoteMessage: NotificationMessage) => {
        console.log('[PushNotification] Foreground message received:', remoteMessage);

        // Call the registered foreground handler
        if (this.foregroundHandler) {
          this.foregroundHandler(remoteMessage);
        }

        // If notifee is available and we want to show notification in foreground
        // Uncomment if you want to show local notification while app is in foreground
        // if (notifee) {
        //   await this.displayLocalNotification(
        //     remoteMessage.notification?.title || 'New notification',
        //     remoteMessage.notification?.body || '',
        //     this.normalizeNotificationData(remoteMessage.data)
        //   );
        // }
      }
    );
  }

  /**
   * Set up handler for token refresh
   */
  private setupTokenRefreshHandler(): void {
    if (!this.isFirebaseAvailable()) {
      return;
    }

    this.tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
      console.log('[PushNotification] Token refreshed:', newToken.substring(0, 20) + '...');

      // Store the new token
      await AsyncStorage.setItem(FCM_TOKEN_KEY, newToken);

      // Re-register with backend
      await this.registerTokenWithBackend(true);
    });
  }

  /**
   * Register a handler for foreground notifications
   */
  onForegroundNotification(handler: NotificationHandler): () => void {
    this.foregroundHandler = handler;
    return () => {
      this.foregroundHandler = null;
    };
  }

  /**
   * Register a handler for when user taps a notification
   */
  onNotificationOpened(handler: NotificationOpenedHandler): () => void {
    this.notificationOpenedHandler = handler;
    return () => {
      this.notificationOpenedHandler = null;
    };
  }

  /**
   * Display a local notification using Notifee
   */
  async displayLocalNotification(
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<string | null> {
    if (!notifee) {
      console.log('[PushNotification] Notifee not available for local notifications');
      return null;
    }

    try {
      // Create a channel (required for Android)
      const channelId = await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: 4, // HIGH
        vibration: true,
        sound: 'default',
      });

      // Display the notification
      const notificationId = await notifee.displayNotification({
        title,
        body,
        data: data as any,
        android: {
          channelId,
          smallIcon: 'ic_notification',
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          sound: 'default',
        },
      });

      return notificationId;
    } catch (error) {
      console.error('[PushNotification] Error displaying local notification:', error);
      return null;
    }
  }

  /**
   * Cancel a local notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    if (!notifee) {
      return;
    }

    try {
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('[PushNotification] Error canceling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    if (!notifee) {
      return;
    }

    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('[PushNotification] Error canceling all notifications:', error);
    }
  }

  /**
   * Get badge count (iOS only)
   */
  async getBadgeCount(): Promise<number> {
    if (!notifee) {
      return 0;
    }

    try {
      return await notifee.getBadgeCount();
    } catch (error) {
      console.error('[PushNotification] Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count: number): Promise<void> {
    if (!notifee) {
      return;
    }

    try {
      await notifee.setBadgeCount(count);
    } catch (error) {
      console.error('[PushNotification] Error setting badge count:', error);
    }
  }

  /**
   * Normalize notification data from various sources
   */
  private normalizeNotificationData(data: any): NotificationData | null {
    if (!data) {
      return null;
    }

    return {
      type: (data.type || data.notificationType || 'system') as NotificationType,
      conversationId: data.conversationId || data.conversation_id,
      messageId: data.messageId || data.message_id,
      callId: data.callId || data.call_id,
      userId: data.userId || data.user_id,
      title: data.title,
      body: data.body,
      ...data,
    };
  }

  /**
   * Get device name for registration
   */
  private async getDeviceName(): Promise<string> {
    try {
      // Try to get device info from react-native-device-info if available
      let DeviceInfo: any = null;
      try {
        DeviceInfo = require('react-native-device-info');
      } catch (e) {
        // Device info not available
      }

      if (DeviceInfo) {
        const brand = await DeviceInfo.getBrand();
        const model = await DeviceInfo.getModel();
        return `${brand} ${model}`;
      }

      // Fallback to platform-based name
      return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
    } catch (error) {
      return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }
    if (this.foregroundUnsubscribe) {
      this.foregroundUnsubscribe();
      this.foregroundUnsubscribe = null;
    }
    this.foregroundHandler = null;
    this.notificationOpenedHandler = null;
    this.isInitialized = false;
  }

  /**
   * Show a prompt to enable notifications if denied
   */
  showEnableNotificationsPrompt(): void {
    Alert.alert(
      'Enable Notifications',
      'To receive messages and call notifications, please enable push notifications in your device settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            // Open app settings - this is platform specific
            // On iOS, this opens the app settings page
            // On Android, this might need additional handling
            try {
              const { Linking } = require('react-native');
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            } catch (error) {
              console.error('[PushNotification] Error opening settings:', error);
            }
          },
        },
      ]
    );
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
