/**
 * usePushNotifications Hook
 * Manages push notification initialization, permissions, and token registration
 *
 * Usage:
 * ```tsx
 * const { isEnabled, permissionStatus, requestPermission } = usePushNotifications();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  pushNotificationService,
  PermissionStatus,
  NotificationData,
  NotificationMessage,
} from '../services/pushNotificationService';
import { useAuthStore } from '../stores/authStore';

interface UsePushNotificationsOptions {
  /**
   * Called when a notification is received while app is in foreground
   */
  onForegroundNotification?: (message: NotificationMessage) => void;

  /**
   * Called when user taps a notification (app opened from background/quit)
   */
  onNotificationOpened?: (data: NotificationData) => void;

  /**
   * Auto-request permission on mount (default: false)
   */
  autoRequestPermission?: boolean;

  /**
   * Auto-register token with backend when authenticated (default: true)
   */
  autoRegisterToken?: boolean;
}

interface UsePushNotificationsReturn {
  /**
   * Whether push notifications are enabled (Firebase available + permission granted)
   */
  isEnabled: boolean;

  /**
   * Whether Firebase is available in the app
   */
  isFirebaseAvailable: boolean;

  /**
   * Current permission status
   */
  permissionStatus: PermissionStatus;

  /**
   * Whether initialization is in progress
   */
  isInitializing: boolean;

  /**
   * Whether the service has been initialized
   */
  isInitialized: boolean;

  /**
   * Error message if initialization failed
   */
  error: string | null;

  /**
   * Current FCM token (if available)
   */
  token: string | null;

  /**
   * Request notification permissions
   */
  requestPermission: () => Promise<PermissionStatus>;

  /**
   * Register token with backend
   */
  registerToken: () => Promise<boolean>;

  /**
   * Unregister token from backend (call on logout)
   */
  unregisterToken: () => Promise<boolean>;

  /**
   * Re-initialize the service (e.g., after app comes to foreground)
   */
  reinitialize: () => Promise<void>;

  /**
   * Show prompt to enable notifications in settings
   */
  showEnablePrompt: () => void;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const {
    onForegroundNotification,
    onNotificationOpened,
    autoRequestPermission = false,
    autoRegisterToken = true,
  } = options;

  // State
  const [isEnabled, setIsEnabled] = useState(false);
  const [isFirebaseAvailable, setIsFirebaseAvailable] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Auth state
  const { isAuthenticated } = useAuthStore();

  // Refs for cleanup
  const foregroundUnsubscribeRef = useRef<(() => void) | null>(null);
  const notificationOpenedUnsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Initialize the push notification service
   */
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Check if Firebase is available
      const firebaseAvailable = pushNotificationService.isFirebaseAvailable();
      setIsFirebaseAvailable(firebaseAvailable);

      if (!firebaseAvailable) {
        console.log('[usePushNotifications] Firebase not available');
        setIsInitializing(false);
        setIsInitialized(true);
        return;
      }

      // Initialize the service
      const initialized = await pushNotificationService.initialize();
      if (!initialized) {
        setError('Failed to initialize push notifications');
        setIsInitializing(false);
        return;
      }

      // Check current permission status
      const status = await pushNotificationService.checkPermission();
      setPermissionStatus(status);

      // Update enabled state
      const enabled = firebaseAvailable && status === 'granted';
      setIsEnabled(enabled);

      // Get token if permission granted
      if (status === 'granted') {
        const fcmToken = await pushNotificationService.getToken();
        setToken(fcmToken);
      }

      setIsInitialized(true);
      console.log('[usePushNotifications] Initialized, permission:', status);
    } catch (err: any) {
      console.error('[usePushNotifications] Initialization error:', err);
      setError(err.message || 'Failed to initialize push notifications');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  /**
   * Request notification permissions
   */
  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    try {
      const status = await pushNotificationService.requestPermission();
      setPermissionStatus(status);

      const enabled = isFirebaseAvailable && status === 'granted';
      setIsEnabled(enabled);

      // Get token if permission granted
      if (status === 'granted') {
        const fcmToken = await pushNotificationService.getToken();
        setToken(fcmToken);

        // Auto-register with backend if authenticated
        if (autoRegisterToken && isAuthenticated) {
          await pushNotificationService.registerTokenWithBackend();
        }
      }

      return status;
    } catch (err: any) {
      console.error('[usePushNotifications] Permission request error:', err);
      setError(err.message || 'Failed to request permission');
      return 'denied';
    }
  }, [isFirebaseAvailable, autoRegisterToken, isAuthenticated]);

  /**
   * Register token with backend
   */
  const registerToken = useCallback(async (): Promise<boolean> => {
    if (!isEnabled || !isAuthenticated) {
      return false;
    }

    try {
      const result = await pushNotificationService.registerTokenWithBackend();
      return result;
    } catch (err: any) {
      console.error('[usePushNotifications] Token registration error:', err);
      return false;
    }
  }, [isEnabled, isAuthenticated]);

  /**
   * Unregister token from backend
   */
  const unregisterToken = useCallback(async (): Promise<boolean> => {
    try {
      const result = await pushNotificationService.unregisterToken();
      setToken(null);
      return result;
    } catch (err: any) {
      console.error('[usePushNotifications] Token unregistration error:', err);
      return false;
    }
  }, []);

  /**
   * Re-initialize the service
   */
  const reinitialize = useCallback(async () => {
    await initialize();
  }, [initialize]);

  /**
   * Show prompt to enable notifications
   */
  const showEnablePrompt = useCallback(() => {
    pushNotificationService.showEnableNotificationsPrompt();
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auto-request permission if enabled
  useEffect(() => {
    if (autoRequestPermission && isInitialized && permissionStatus === 'undetermined') {
      requestPermission();
    }
  }, [autoRequestPermission, isInitialized, permissionStatus, requestPermission]);

  // Register token when authenticated
  useEffect(() => {
    if (autoRegisterToken && isEnabled && isAuthenticated && token) {
      pushNotificationService.registerTokenWithBackend();
    }
  }, [autoRegisterToken, isEnabled, isAuthenticated, token]);

  // Set up foreground notification handler
  useEffect(() => {
    if (onForegroundNotification && isInitialized) {
      foregroundUnsubscribeRef.current =
        pushNotificationService.onForegroundNotification(onForegroundNotification);
    }

    return () => {
      if (foregroundUnsubscribeRef.current) {
        foregroundUnsubscribeRef.current();
        foregroundUnsubscribeRef.current = null;
      }
    };
  }, [onForegroundNotification, isInitialized]);

  // Set up notification opened handler
  useEffect(() => {
    if (onNotificationOpened && isInitialized) {
      notificationOpenedUnsubscribeRef.current =
        pushNotificationService.onNotificationOpened(onNotificationOpened);
    }

    return () => {
      if (notificationOpenedUnsubscribeRef.current) {
        notificationOpenedUnsubscribeRef.current();
        notificationOpenedUnsubscribeRef.current = null;
      }
    };
  }, [onNotificationOpened, isInitialized]);

  // Re-check permission when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isInitialized) {
        // Re-check permission in case user changed it in settings
        const status = await pushNotificationService.checkPermission();
        if (status !== permissionStatus) {
          setPermissionStatus(status);
          setIsEnabled(isFirebaseAvailable && status === 'granted');

          // Get token if permission was just granted
          if (status === 'granted' && !token) {
            const fcmToken = await pushNotificationService.getToken();
            setToken(fcmToken);

            // Register with backend
            if (autoRegisterToken && isAuthenticated) {
              await pushNotificationService.registerTokenWithBackend();
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [
    isInitialized,
    permissionStatus,
    isFirebaseAvailable,
    token,
    autoRegisterToken,
    isAuthenticated,
  ]);

  return {
    isEnabled,
    isFirebaseAvailable,
    permissionStatus,
    isInitializing,
    isInitialized,
    error,
    token,
    requestPermission,
    registerToken,
    unregisterToken,
    reinitialize,
    showEnablePrompt,
  };
}

export default usePushNotifications;
