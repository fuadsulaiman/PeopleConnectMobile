/**
 * PeopleConnect Mobile Application
 * Real-time communication platform
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { StatusBar, useColorScheme, LogBox, AppState, AppStateStatus, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator, { navigationRef } from './src/navigation/RootNavigator';
import { signalRService } from './src/services/signalr';
import { pushNotificationService, NotificationData, NotificationMessage } from './src/services';
import { useAuthStore } from './src/stores/authStore';
// Import chatStore module - we'll access useChatStore from it
import * as chatStoreModule from './src/stores/chatStore';
import type { Message, MessageStatus, Conversation } from './src/stores/chatStore';
import { useCallStore } from './src/stores/callStore';
import { usePresenceStore } from './src/stores/presenceStore';
import { useThemeStore } from './src/stores/themeStore';

// ReplyTo message interface
interface ReplyToMessage {
  id?: string;
  Id?: string;
  content?: string;
  Content?: string;
  type?: string;
  Type?: string;
  senderId?: string;
  SenderId?: string;
  sender?: { name?: string };
  Sender?: { name?: string };
  attachments?: unknown[];
  Attachments?: unknown[];
}

// SignalR message interface for type safety
interface SignalRMessage {
  id?: string;
  messageId?: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  sender?: { name?: string };
  content?: string;
  type?: string;
  sentAt?: string;
  createdAt?: string;
  isEdited?: boolean;
  attachments?: unknown[];
  reactions?: unknown[];
  isViewOnce?: boolean;
  IsViewOnce?: boolean;
  viewOnceViewedAt?: string;
  ViewOnceViewedAt?: string;
  replyTo?: ReplyToMessage;
  ReplyTo?: ReplyToMessage;
  replyToMessage?: ReplyToMessage;
  ReplyToMessage?: ReplyToMessage;
  replyToId?: string;
  ReplyToId?: string;
  replyToMessageId?: string;
  ReplyToMessageId?: string;
}

// Typing/Recording event data
interface TypingRecordingData {
  conversationId?: string;
  ConversationId?: string;
  userId?: string;
  UserId?: string;
  userName?: string;
  UserName?: string;
  user?: { name?: string };
  stoppedTyping?: boolean;
  stoppedRecording?: boolean;
}

// Online user data
interface OnlineUserData {
  userId?: string;
  id?: string;
}

// SignalR event data interfaces
interface ViewOnceViewedData {
  messageId?: string;
  MessageId?: string;
  viewedAt?: string;
  ViewedAt?: string;
}

interface ConversationMutedData {
  conversationId?: string;
  ConversationId?: string;
  isMuted?: boolean;
  IsMuted?: boolean;
  mutedUntil?: string;
  MutedUntil?: string;
}

interface ConversationDeletedData {
  conversationId?: string;
  ConversationId?: string;
}

interface ParticipantRoleChangedData {
  conversationId?: string;
  ConversationId?: string;
  userId?: string;
  UserId?: string;
  newRole?: string;
  NewRole?: string;
  role?: string;
  Role?: string;
}

interface ParticipantChangeData {
  conversationId?: string;
  ConversationId?: string;
  userId?: string;
  UserId?: string;
  userName?: string;
  UserName?: string;
  action?: 'added' | 'removed' | 'left';
}

interface DisappearingMessagesChangedData {
  conversationId?: string;
  ConversationId?: string;
  duration?: string | null;
  Duration?: string | null;
}

interface SessionRevokedData {
  reason?: string;
}

// Track processed message IDs to prevent duplicates
const processedMessageIds = new Set<string>();

// Platform Channel polling interval (10 seconds for background polling)
const PLATFORM_CHANNEL_BACKGROUND_POLL_INTERVAL = 10000;

// Debounce delay for connection attempts
const CONNECTION_DEBOUNCE_MS = 500;

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  // SignalR WebSocket errors are expected - it falls back to Long Polling
  'WebSocket failed to connect',
  'Failed to start the transport',
  '(WebSockets transport) There was an error',
  // Stale connection errors are handled by forceReconnect
  'No Connection with that ID',
  'Connection disconnected with error',
  // SignalR may warn about missing client methods for events we don't handle
  // These are informational - the events are optional and handled gracefully
  'No client method with the name',
  // LiveKit ping timeout warnings are expected on mobile networks
  // We handle reconnection via reconnectPolicy in GroupCallScreen
  'ping timeout triggered',
  'last pong received at',
  // LiveKit SDK internal warnings during track subscription/connection state changes
  // These are informational and handled internally by LiveKit
  'could not find local track subscription',
  'detected connection state mismatch',
  // LiveKit NegotiationError occurs during cleanup when PeerConnection closes
  // while track negotiation is still pending - this is expected during call end
  'NegotiationError',
  'PC manager is closed',
  // LiveKit camera/publishing errors - handled gracefully in GroupCallScreen
  // These occur during track publishing and are expected on some devices
  'Camera strategy',
  'engine not connected',
  'publishing rejected',
  'PublishTrackError',
  'OverconstrainedError',
  'could not find camera',
  // LiveKit track/participant race condition warnings
  // These occur when track events arrive before participant events (race condition)
  // or when a participant leaves but track events are still being processed
  // This is informational and handled internally by LiveKit
  'Tried to add a track for a participant',
  "that's not present",
  // LiveKit quality update race condition warnings
  // These occur when quality updates are received for tracks that haven't been fully registered yet
  // This is informational and handled internally by LiveKit
  'received subscribed quality update for unknown track',
  'unknown track',
  // LiveKit negotiation timeout/disconnect errors
  // These occur on mobile emulators or poor network conditions when
  // DTLS handshake times out - handled by reconnectPolicy in GroupCallScreen
  'negotiation timed out',
  'negotiation disconnected',
  'Microphone enable failed',
  'dtls timeout',
]);

function App(): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const { isAuthenticated, user } = useAuthStore();
  const { setDarkMode, fetchAdminColorProfile, colors } = useThemeStore();

  const platformChannelPollRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeMessageRef = useRef<(() => void) | null>(null);
  const unsubscribeStatusRef = useRef<(() => void) | null>(null);
  const unsubscribePresenceRef = useRef<(() => void) | null>(null);
  const unsubscribeConversationUpdateRef = useRef<(() => void) | null>(null);
  const unsubscribeOnlineUsersRef = useRef<(() => void) | null>(null);
  const unsubscribeIncomingCallRef = useRef<(() => void) | null>(null);
  const unsubscribeIncomingGroupCallRef = useRef<(() => void) | null>(null);
  const unsubscribeCallAnsweredRef = useRef<(() => void) | null>(null);
  const unsubscribeCallEndedRef = useRef<(() => void) | null>(null);
  const unsubscribeCallRejectedRef = useRef<(() => void) | null>(null);
  const unsubscribeSessionRevokedRef = useRef<(() => void) | null>(null);
  const unsubscribeViewOnceViewedRef = useRef<(() => void) | null>(null);
  const unsubscribeConversationMutedRef = useRef<(() => void) | null>(null);
  const unsubscribeConversationDeletedRef = useRef<(() => void) | null>(null);
  const unsubscribeParticipantRoleChangedRef = useRef<(() => void) | null>(null);
  const unsubscribeParticipantChangeRef = useRef<(() => void) | null>(null);
  const unsubscribeDisappearingMessagesChangedRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const backgroundTimestampRef = useRef<number | null>(null);
  const pushNotificationForegroundUnsubscribeRef = useRef<(() => void) | null>(null);
  const pushNotificationOpenedUnsubscribeRef = useRef<(() => void) | null>(null);
  const pendingNotificationRef = useRef<NotificationData | null>(null);

  // Initialize theme on app mount
  useEffect(() => {
    // Sync system dark mode preference
    setDarkMode(isDarkMode);
  }, [isDarkMode, setDarkMode]);

  // Fetch admin color profile on app mount
  useEffect(() => {
    console.log('[App] Fetching admin color profile...');
    fetchAdminColorProfile().catch((err) => {
      console.log('[App] Failed to fetch admin color profile:', err);
    });
  }, [fetchAdminColorProfile]);

  // Handle notification-based navigation
  const handleNotificationNavigation = useCallback(
    (data: NotificationData) => {
      console.log('[App] Handling notification navigation:', data);

      // If not authenticated, store for later
      if (!isAuthenticated) {
        console.log('[App] Not authenticated, storing notification for later');
        pendingNotificationRef.current = data;
        return;
      }

      // Navigate based on notification type
      switch (data.type) {
        case 'message':
          if (data.conversationId) {
            console.log('[App] Navigating to conversation:', data.conversationId);
            // The navigation will be handled by RootNavigator through its ref
            // We need to dispatch a navigation action
            // For now, we'll set the active conversation in chat store
            const chatStore = chatStoreModule.useChatStore.getState();
            chatStore.setActiveConversation(data.conversationId);
          }
          break;

        case 'call':
          if (data.callId) {
            console.log('[App] Handling call notification:', data.callId);
            // Call notifications are handled by the call store and SignalR
          }
          break;

        case 'contact_request':
          console.log('[App] Contact request notification - navigate to contacts');
          // Navigation to contacts will be handled by the navigator
          break;

        case 'broadcast':
        case 'announcement':
          console.log('[App] Broadcast/announcement notification');
          // Navigation to broadcasts/announcements
          break;

        default:
          console.log('[App] Unhandled notification type:', data.type);
      }
    },
    [isAuthenticated]
  );

  // Handle foreground notifications (show in-app notification)
  const handleForegroundNotification = useCallback((message: NotificationMessage) => {
    console.log('[App] Foreground notification received:', message);

    // Foreground notifications are typically handled by SignalR for real-time updates
    // We can optionally show a toast/banner here for notifications not handled by SignalR

    // For now, just log it - the SignalR handlers will update the UI
    // If you want to show a custom in-app notification banner, implement it here
  }, []);

  // Initialize push notifications on app mount
  useEffect(() => {
    const initializePushNotifications = async () => {
      console.log('[App] Initializing push notifications...');

      try {
        // Initialize the service
        const initialized = await pushNotificationService.initialize();
        if (!initialized) {
          console.log('[App] Push notifications not available or initialization failed');
          return;
        }

        // Set up foreground notification handler
        pushNotificationForegroundUnsubscribeRef.current =
          pushNotificationService.onForegroundNotification(handleForegroundNotification);

        // Set up notification opened handler (when user taps notification)
        pushNotificationOpenedUnsubscribeRef.current = pushNotificationService.onNotificationOpened(
          handleNotificationNavigation
        );

        // Request permission (this will prompt the user on first launch)
        const permission = await pushNotificationService.requestPermission();
        console.log('[App] Push notification permission:', permission);

        // Token registration is handled when user authenticates (see auth-dependent effect below)
      } catch (error) {
        console.error('[App] Failed to initialize push notifications:', error);
      }
    };

    void initializePushNotifications();

    return () => {
      if (pushNotificationForegroundUnsubscribeRef.current) {
        pushNotificationForegroundUnsubscribeRef.current();
        pushNotificationForegroundUnsubscribeRef.current = null;
      }
      if (pushNotificationOpenedUnsubscribeRef.current) {
        pushNotificationOpenedUnsubscribeRef.current();
        pushNotificationOpenedUnsubscribeRef.current = null;
      }
    };
  }, [handleForegroundNotification, handleNotificationNavigation]);

  // Track whether auth check has completed (to avoid false "logged out" state on startup)
  const authCheckCompleteRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  // Register/unregister push notification token based on auth state
  useEffect(() => {
    const handlePushNotificationAuth = async () => {
      if (isAuthenticated && user) {
        // User is authenticated - register token
        authCheckCompleteRef.current = true;
        wasAuthenticatedRef.current = true;
        console.log('[App] User authenticated, registering push notification token...');
        try {
          await pushNotificationService.registerTokenWithBackend();
          console.log('[App] Push notification token registered');

          // Handle any pending notification navigation
          if (pendingNotificationRef.current) {
            console.log('[App] Processing pending notification navigation');
            handleNotificationNavigation(pendingNotificationRef.current);
            pendingNotificationRef.current = null;
          }
        } catch (error) {
          console.error('[App] Failed to register push notification token:', error);
        }
      } else if (!isAuthenticated && wasAuthenticatedRef.current) {
        // User was previously authenticated and is now logged out - unregister token
        // This prevents running on initial app start when isAuthenticated is false
        // before checkAuth() has had a chance to run
        console.log('[App] User logged out, unregistering push notification token...');
        wasAuthenticatedRef.current = false;
        try {
          await pushNotificationService.unregisterToken();
          console.log('[App] Push notification token unregistered');
        } catch (error) {
          console.error('[App] Failed to unregister push notification token:', error);
        }
      }
    };

    void handlePushNotificationAuth();
  }, [isAuthenticated, user, handleNotificationNavigation]);

  // Cleanup function - only cleans up local refs, doesn't disconnect SignalR
  const cleanupLocalRefs = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (unsubscribeMessageRef.current) {
      unsubscribeMessageRef.current();
      unsubscribeMessageRef.current = null;
    }
    if (unsubscribeStatusRef.current) {
      unsubscribeStatusRef.current();
      unsubscribeStatusRef.current = null;
    }
    if (unsubscribePresenceRef.current) {
      unsubscribePresenceRef.current();
      unsubscribePresenceRef.current = null;
    }
    if (unsubscribeConversationUpdateRef.current) {
      unsubscribeConversationUpdateRef.current();
      unsubscribeConversationUpdateRef.current = null;
    }
    if (unsubscribeOnlineUsersRef.current) {
      unsubscribeOnlineUsersRef.current();
      unsubscribeOnlineUsersRef.current = null;
    }
    if (unsubscribeIncomingCallRef.current) {
      unsubscribeIncomingCallRef.current();
      unsubscribeIncomingCallRef.current = null;
    }
    if (unsubscribeIncomingGroupCallRef.current) {
      unsubscribeIncomingGroupCallRef.current();
      unsubscribeIncomingGroupCallRef.current = null;
    }
    if (unsubscribeCallAnsweredRef.current) {
      unsubscribeCallAnsweredRef.current();
      unsubscribeCallAnsweredRef.current = null;
    }
    if (unsubscribeCallEndedRef.current) {
      unsubscribeCallEndedRef.current();
      unsubscribeCallEndedRef.current = null;
    }
    if (unsubscribeCallRejectedRef.current) {
      unsubscribeCallRejectedRef.current();
      unsubscribeCallRejectedRef.current = null;
    }
    if (unsubscribeSessionRevokedRef.current) {
      unsubscribeSessionRevokedRef.current();
      unsubscribeSessionRevokedRef.current = null;
    }
    if (unsubscribeViewOnceViewedRef.current) {
      unsubscribeViewOnceViewedRef.current();
      unsubscribeViewOnceViewedRef.current = null;
    }
    if (unsubscribeConversationMutedRef.current) {
      unsubscribeConversationMutedRef.current();
      unsubscribeConversationMutedRef.current = null;
    }
    if (unsubscribeConversationDeletedRef.current) {
      unsubscribeConversationDeletedRef.current();
      unsubscribeConversationDeletedRef.current = null;
    }
    if (unsubscribeParticipantRoleChangedRef.current) {
      unsubscribeParticipantRoleChangedRef.current();
      unsubscribeParticipantRoleChangedRef.current = null;
    }
    if (unsubscribeParticipantChangeRef.current) {
      unsubscribeParticipantChangeRef.current();
      unsubscribeParticipantChangeRef.current = null;
    }
    if (unsubscribeDisappearingMessagesChangedRef.current) {
      unsubscribeDisappearingMessagesChangedRef.current();
      unsubscribeDisappearingMessagesChangedRef.current = null;
    }
    if (platformChannelPollRef.current) {
      clearInterval(platformChannelPollRef.current);
      platformChannelPollRef.current = null;
    }
    // Note: Push notification handlers are cleaned up in their own effect
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    // Time threshold for forcing reconnect (30 seconds in background)
    const FORCE_RECONNECT_THRESHOLD_MS = 30000;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const { isAuthenticated: authed, user: currentUser } = useAuthStore.getState();

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Track when app went to background
        backgroundTimestampRef.current = Date.now();
        console.log('App went to background at:', new Date().toISOString());
      } else if (nextAppState === 'active' && authed && currentUser) {
        const backgroundTime = backgroundTimestampRef.current
          ? Date.now() - backgroundTimestampRef.current
          : 0;
        backgroundTimestampRef.current = null;

        console.log(`App came to foreground after ${backgroundTime}ms in background`);

        // If app was in background for a while, force a fresh reconnection
        // This handles stale connections that the server may have dropped
        if (backgroundTime > FORCE_RECONNECT_THRESHOLD_MS) {
          console.log('App was in background too long, forcing fresh SignalR reconnection...');
          void signalRService.forceReconnect();
        } else if (!signalRService.isConnected()) {
          console.log('App came to foreground, reconnecting SignalR...');
          void signalRService.connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    // Clear any pending connection timeout from previous effect run
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // If not authenticated, ensure we're disconnected
    if (!isAuthenticated || !user) {
      if (isConnectedRef.current) {
        console.log('User logged out, disconnecting SignalR...');
        cleanupLocalRefs();
        void signalRService.disconnect();
        isConnectedRef.current = false;
      }
      return;
    }

    // Already connected - don't reconnect
    if (signalRService.isConnected()) {
      console.log('SignalR already connected, skipping...');
      return;
    }

    // Debounce connection to prevent rapid connect/disconnect cycles
    connectionTimeoutRef.current = setTimeout(() => {
      // Double-check auth state hasn't changed during debounce
      const { isAuthenticated: stillAuthed, user: currentUser } = useAuthStore.getState();
      if (!stillAuthed || !currentUser) {
        console.log('Auth state changed during debounce, skipping connection');
        return;
      }

      console.log('Initializing SignalR connection...');
      void signalRService.connect();
      isConnectedRef.current = true;

      // Start background polling for Platform Channel updates
      const pollPlatformChannel = async () => {
        try {
          // Check if user is still authenticated
          const { isAuthenticated: stillAuthed } = useAuthStore.getState();
          if (!stillAuthed) {
            return;
          }

          const chatStore = chatStoreModule.useChatStore.getState();
          const platformChannel = chatStore.conversations.find(
            (c) => (c as any).isPlatformChannel === true || (c as any).type === 'BroadcastChannel'
          );
          if (platformChannel && chatStore.activeConversationId !== platformChannel.id) {
            await chatStore.fetchBroadcastMessages(platformChannel.id, true);
          }
        } catch (error) {
          // Silently ignore polling errors (e.g., 401 when token expires)
          console.log('Background broadcast poll skipped:', error);
        }
      };

      platformChannelPollRef.current = setInterval(
        pollPlatformChannel,
        PLATFORM_CHANNEL_BACKGROUND_POLL_INTERVAL
      );

      // Register handler for incoming messages
      unsubscribeMessageRef.current = signalRService.onMessage((rawMessage: unknown) => {
        const message = rawMessage as SignalRMessage;
        console.log('Received message via SignalR:', JSON.stringify(message, null, 2));

        const chatStore = chatStoreModule.useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        // Check if this is a system message (always show system messages)
        const messageType = (message.type || '').toLowerCase();
        const isSystemMessage = messageType === 'system';

        // Don't add if it's our own message (already added optimistically)
        // Exception: System messages should always be shown
        if (currentUser && message.senderId === currentUser.id && !isSystemMessage) {
          return;
        }

        // Backend uses messageId and sentAt, normalize to id and createdAt
        const messageId = message.messageId || message.id;
        const createdAt = message.sentAt || message.createdAt || new Date().toISOString();

        if (!messageId || !message.conversationId) {
          console.log('Message has no ID or conversationId, skipping:', message);
          return;
        }

        // Check for duplicate message (SignalR may deliver same message multiple times)
        if (processedMessageIds.has(messageId)) {
          console.log('Duplicate message, skipping:', messageId);
          return;
        }
        processedMessageIds.add(messageId);

        // Prevent memory leak by clearing old message IDs (keep last 1000)
        if (processedMessageIds.size > 1000) {
          const idsArray = Array.from(processedMessageIds);
          idsArray.slice(0, 500).forEach((id) => processedMessageIds.delete(id));
        }

        // Check if viewing this conversation (don't increment unread if so)
        const isViewingConversation = chatStore.activeConversationId === message.conversationId;

        // Add message to chat store (this also updates lastMessage preview)
        chatStore.addMessage({
          id: messageId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: message.senderName || message.sender?.name,
          content: message.content,
          type: message.type || 'Text',
          createdAt: createdAt,
          isRead: isViewingConversation,
          isEdited: message.isEdited || false,
          attachments: message.attachments || [],
          reactions: message.reactions || [],
          isViewOnce: message.isViewOnce || message.IsViewOnce || false,
          viewOnceViewedAt: message.viewOnceViewedAt || message.ViewOnceViewedAt || undefined,
          replyTo: (() => {
            const rt =
              message.replyTo ||
              message.ReplyTo ||
              message.replyToMessage ||
              message.ReplyToMessage;
            if (!rt) {
              return undefined;
            }
            const rawAttachments = rt.attachments || rt.Attachments || [];
            const normalizedAttachments = rawAttachments.map((a: any) => ({
              id: a.id || a.Id,
              fileName: a.fileName || a.FileName,
              originalFileName: a.originalFileName || a.OriginalFileName,
              contentType: a.contentType || a.ContentType,
              fileSize: a.fileSize || a.FileSize,
              url: a.url || a.Url,
              thumbnailUrl: a.thumbnailUrl || a.ThumbnailUrl,
              width: a.width || a.Width,
              height: a.height || a.Height,
              duration: a.duration || a.Duration,
            }));
            return {
              ...rt,
              id: rt.id || rt.Id,
              content: rt.content || rt.Content,
              type: rt.type || rt.Type,
              senderId: rt.senderId || rt.SenderId,
              sender: rt.sender || rt.Sender,
              attachments: normalizedAttachments,
            };
          })(),
          replyToId:
            message.replyToId ||
            message.ReplyToId ||
            message.replyToMessageId ||
            message.ReplyToMessageId,
        } as Message);

        // Handle system messages about participants leaving/being removed
        // This refreshes the conversation list so other users see updated group state
        if (isSystemMessage && message.content) {
          const content = message.content.toLowerCase();
          if (
            content.includes('left the group') ||
            content.includes('removed') ||
            content.includes('is now the owner')
          ) {
            console.log('Participant change detected, refreshing conversations');
            // Refresh conversations list to update participant counts and group state
            setTimeout(() => {
              chatStoreModule.useChatStore.getState().fetchConversations();
            }, 500);
          }
        }

        // Acknowledge delivery to the sender (this triggers MessageDelivered on their end)
        // Don't acknowledge system messages
        if (!isSystemMessage) {
          signalRService.acknowledgeDelivery(message.conversationId, messageId).catch((err) => {
            console.log('Failed to acknowledge delivery:', err);
          });
        }

        // Only update unread count if not viewing this conversation
        // Don't count system messages as unread
        if (!isViewingConversation && !isSystemMessage) {
          const freshState = chatStoreModule.useChatStore.getState();
          const currentConversation = freshState.conversations.find(
            (c) => c.id === message.conversationId
          );
          const currentUnread = currentConversation?.unreadCount || 0;
          freshState.updateConversation({
            id: message.conversationId,
            unreadCount: currentUnread + 1,
          });
        }
      });

      // Register handler for message status changes (delivered, read, etc.)
      unsubscribeStatusRef.current = signalRService.onStatusChange(
        (messageId: string, status: string, conversationId?: string) => {
          console.log(
            `Message status update: ${messageId} -> ${status} (conversation: ${conversationId})`
          );
          const chatStore = chatStoreModule.useChatStore.getState();

          // Normalize IDs for case-insensitive GUID comparison
          const normalizedMessageId = messageId?.toLowerCase();
          const normalizedConversationId = conversationId?.toLowerCase();

          // If we have the conversationId, try to update directly
          if (conversationId && normalizedConversationId) {
            // Try exact match first, then normalized
            const convMessages =
              chatStore.messages[conversationId] || chatStore.messages[normalizedConversationId];
            if (convMessages) {
              const message = convMessages.find(
                (m: Message) => m.id?.toLowerCase() === normalizedMessageId
              );
              if (message) {
                chatStore.updateMessageStatus(conversationId, messageId, status as MessageStatus);
                return;
              }
            }
          }

          // Fallback: Find the conversation containing this message
          for (const [convId, msgs] of Object.entries(chatStore.messages)) {
            const message = msgs.find((m: Message) => m.id?.toLowerCase() === normalizedMessageId);
            if (message) {
              chatStore.updateMessageStatus(convId, messageId, status as MessageStatus);
              break;
            }
          }
        }
      );

      // Register handler for presence changes (online/offline)
      unsubscribePresenceRef.current = signalRService.onPresence(
        (userId: string, isOnline: boolean) => {
          console.log(`Presence update received: ${userId} -> ${isOnline ? 'online' : 'offline'}`);
          const presenceStore = usePresenceStore.getState();
          if (isOnline) {
            presenceStore.setUserOnline(userId);
          } else {
            presenceStore.setUserOffline(userId);
          }
        }
      );

      // Register handler for conversation updates (pin, archive, etc.)
      unsubscribeConversationUpdateRef.current = signalRService.onConversationUpdate(
        (conversationId: string, updates: Partial<Conversation>) => {
          console.log(`Conversation update received: ${conversationId}`, updates);
          const chatStore = chatStoreModule.useChatStore.getState();
          chatStore.updateConversation({ id: conversationId, ...updates });
        }
      );

      // Register handler for initial online users list
      unsubscribeOnlineUsersRef.current = signalRService.onOnlineUsers(
        (users: OnlineUserData[]) => {
          console.log(`Online users list received: ${users?.length || 0} users`);
          const presenceStore = usePresenceStore.getState();
          // Extract user IDs from the users array (handle different formats)
          const userIds = users
            .map((u) => u.userId || u.id || '')
            .filter((id): id is string => Boolean(id));
          presenceStore.setMultipleUsersOnline(userIds);
        }
      );

      // Register handler for typing indicators
      signalRService.onTyping((rawData: unknown) => {
        const data = rawData as TypingRecordingData;
        const chatStore = chatStoreModule.useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        const conversationId = data?.conversationId || data?.ConversationId;
        const userId = data?.userId || data?.UserId;
        const userName = data?.userName || data?.UserName || data?.user?.name || 'Someone';
        const stoppedTyping = data?.stoppedTyping === true;

        // Don't track our own typing
        if (!conversationId || !userId || userId === currentUser?.id) {
          return;
        }

        if (stoppedTyping) {
          chatStore.removeTypingUser(conversationId, userId);
        } else {
          chatStore.addTypingUser(conversationId, userId, userName);
        }
      });

      // Register handler for recording indicators
      signalRService.onRecording((rawData: unknown) => {
        const data = rawData as TypingRecordingData;
        const chatStore = chatStoreModule.useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        const conversationId = data?.conversationId || data?.ConversationId;
        const userId = data?.userId || data?.UserId;
        const userName = data?.userName || data?.UserName || data?.user?.name || 'Someone';
        const stoppedRecording = data?.stoppedRecording === true;

        // Don't track our own recording
        if (!conversationId || !userId || userId === currentUser?.id) {
          return;
        }

        if (stoppedRecording) {
          chatStore.removeRecordingUser(conversationId, userId);
        } else {
          chatStore.addRecordingUser(conversationId, userId, userName);
        }
      });

      // Register handler for incoming calls (camelCase - SignalR converts from PascalCase)
      unsubscribeIncomingCallRef.current = signalRService.onCallEvent(
        'incomingCall',
        (data: any) => {
          console.log('Incoming call received:', JSON.stringify(data, null, 2));
          const callStore = useCallStore.getState();
          const currentUser = useAuthStore.getState().user;

          // Don't handle our own calls
          if (data?.callerId === currentUser?.id) {
            return;
          }

          // Check if this is a GROUP call (isGroupCall flag from backend)
          // Group calls should be routed to GroupCallScreen (LiveKit), not CallScreen (WebRTC)
          const isGroupCall = data?.isGroupCall === true;
          if (isGroupCall) {
            console.log('[App] Detected GROUP call from IncomingCall notification');
            const conversationId = data?.conversationId || data?.ConversationId;
            const callerName = data?.callerName || 'Someone';
            const callType = (data?.type || 'voice').toLowerCase() as 'voice' | 'video';

            if (!conversationId) {
              console.error('[App] Group call notification missing conversationId');
              return;
            }

            // Show an alert to the user about the incoming group call
            Alert.alert(
              `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
              `${callerName} started a group call`,
              [
                {
                  text: 'Ignore',
                  style: 'cancel',
                  onPress: () => console.log('[App] User ignored group call'),
                },
                {
                  text: 'Join',
                  onPress: () => {
                    console.log('[App] User joining group call:', conversationId);
                    if (navigationRef?.current) {
                      navigationRef.current.navigate('GroupCall', {
                        conversationId,
                        conversationName: 'Group Call',
                        type: callType,
                        isJoining: true, // Flag to indicate joining existing call, not initiating
                      });
                    } else {
                      console.error('[App] Navigation ref not available');
                    }
                  },
                },
              ],
              { cancelable: true }
            );
            return; // Don't process as 1:1 call
          }

          // Handle 1:1 call normally
          const call = {
            id: data?.callId || data?.id || '',
            callerId: data?.callerId || '',
            calleeId: currentUser?.id || '',
            caller: {
              id: data?.callerId || '',
              username: data?.callerName || 'Unknown',
              displayName: data?.callerName || 'Unknown',
              avatarUrl: data?.callerAvatarUrl,
            },
            type: (data?.type || 'voice').toLowerCase() as 'voice' | 'video',
            status: 'Incoming',
            startedAt: data?.startedAt || new Date().toISOString(),
          };

          callStore.setIncomingCall(call);
        }
      );

      // Register handler for incoming GROUP calls (LiveKit-based chatroom calls)
      // Use camelCase - SignalR may convert PascalCase to camelCase
      unsubscribeIncomingGroupCallRef.current = signalRService.onCallEvent(
        'incomingGroupCall',
        (data: any) => {
          console.log('[App] Incoming GROUP call received:', JSON.stringify(data, null, 2));
          const currentUser = useAuthStore.getState().user;

          // Don't handle our own calls (if we initiated it)
          if (data?.callerId === currentUser?.id || data?.initiatorId === currentUser?.id) {
            console.log('[App] Ignoring own group call notification');
            return;
          }

          // Extract call information from the notification
          const conversationId = data?.conversationId || data?.ConversationId;
          const conversationName = data?.conversationName || data?.ConversationName || 'Group Call';
          const callType = (data?.type || data?.callType || 'voice').toLowerCase() as 'voice' | 'video';
          const callerName = data?.callerName || data?.initiatorName || 'Someone';

          if (!conversationId) {
            console.error('[App] Group call notification missing conversationId');
            return;
          }

          // Show an alert to the user about the incoming group call
          // They can choose to join or ignore
          Alert.alert(
            `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
            `${callerName} started a group call in ${conversationName}`,
            [
              {
                text: 'Ignore',
                style: 'cancel',
                onPress: () => console.log('[App] User ignored group call'),
              },
              {
                text: 'Join',
                onPress: () => {
                  console.log('[App] User joining group call:', conversationId);
                  // Navigate to GroupCall screen using the exported navigationRef
                  if (navigationRef?.current) {
                    navigationRef.current.navigate('GroupCall', {
                      conversationId,
                      conversationName,
                      type: callType,
                      isJoining: true, // Flag to indicate joining existing call, not initiating
                    });
                  } else {
                    console.error('[App] Navigation ref not available');
                  }
                },
              },
            ],
            { cancelable: true }
          );
        }
      );

      // Register handler for call accepted
      unsubscribeCallAnsweredRef.current = signalRService.onCallEvent(
        'callAccepted',
        (data: any) => {
          console.log('Call accepted:', JSON.stringify(data, null, 2));
          const callStore = useCallStore.getState();
          const currentCall = callStore.currentCall;

          if (currentCall && data?.callId === currentCall.id) {
            // Update call state to connected
            callStore.setCallConnected();
          }
        }
      );

      // Register handler for call ended
      unsubscribeCallEndedRef.current = signalRService.onCallEvent('callEnded', (data: any) => {
        console.log('Call ended:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        callStore.clearCall();
      });

      // Register handler for call rejected
      unsubscribeCallRejectedRef.current = signalRService.onCallEvent(
        'callRejected',
        (data: unknown) => {
          console.log('Call rejected:', JSON.stringify(data, null, 2));
          const callStore = useCallStore.getState();
          // Add to history as missed call if it was an incoming call we didn't answer
          if (callStore.currentCall && callStore.callState === 'incoming') {
            callStore.addMissedCall({
              ...(data as Record<string, unknown>),
              ...callStore.currentCall,
              status: 'missed',
            });
          }
          callStore.clearCall();
        }
      );

      // Register handler for call missed (timeout, no answer)
      signalRService.onCallEvent('callMissed', (data: unknown) => {
        console.log('Call missed:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        callStore.addMissedCall(data as Record<string, unknown>);
      });

      // Register handler for session revoked (force logout by admin)
      unsubscribeSessionRevokedRef.current = signalRService.onSessionRevoked((rawData: unknown) => {
        const data = rawData as SessionRevokedData;
        console.log('[App] Session revoked by admin:', data?.reason);
        const authStore = useAuthStore.getState();
        authStore.logout().catch((err) => console.error('Logout failed:', err));
      });

      // Register handler for view-once message viewed
      unsubscribeViewOnceViewedRef.current = signalRService.onViewOnceViewed((rawData: unknown) => {
        const data = rawData as ViewOnceViewedData;
        console.log('[App] View-once viewed:', data);
        const messageId = data?.messageId || data?.MessageId;
        const viewedAt = data?.viewedAt || data?.ViewedAt || new Date().toISOString();

        if (messageId) {
          const chatStore = chatStoreModule.useChatStore.getState();
          chatStore.updateMessageViewOnce(messageId, viewedAt);
        }
      });

      // Register handler for conversation muted status
      unsubscribeConversationMutedRef.current = signalRService.onConversationMuted(
        (rawData: unknown) => {
          const data = rawData as ConversationMutedData;
          console.log('[App] Conversation muted:', data);
          const conversationId = data?.conversationId || data?.ConversationId;
          const isMuted = data?.isMuted ?? data?.IsMuted ?? true;
          const mutedUntil = data?.mutedUntil || data?.MutedUntil;

          if (conversationId) {
            const chatStore = chatStoreModule.useChatStore.getState();
            chatStore.updateConversationMuteStatus(conversationId, isMuted, mutedUntil);
          }
        }
      );

      // Register handler for conversation deleted
      unsubscribeConversationDeletedRef.current = signalRService.onConversationDeleted(
        (rawData: unknown) => {
          const data = rawData as ConversationDeletedData;
          console.log('[App] Conversation deleted:', data);
          const conversationId = data?.conversationId || data?.ConversationId;

          if (conversationId) {
            const chatStore = chatStoreModule.useChatStore.getState();
            chatStore.removeConversation(conversationId);
          }
        }
      );

      // Register handler for participant role changed
      unsubscribeParticipantRoleChangedRef.current = signalRService.onParticipantRoleChanged(
        (rawData: unknown) => {
          const data = rawData as ParticipantRoleChangedData;
          console.log('[App] Participant role changed:', data);
          const conversationId = data?.conversationId || data?.ConversationId;
          const userId = data?.userId || data?.UserId;
          const newRole = data?.newRole || data?.NewRole || data?.role || data?.Role;

          if (conversationId && userId && newRole) {
            const chatStore = chatStoreModule.useChatStore.getState();
            chatStore.updateParticipantRole(conversationId, userId, newRole);
          }
        }
      );

      // Register handler for participant changes (added/removed/left)
      // Backend may send these via dedicated ParticipantLeft/ParticipantRemoved events
      unsubscribeParticipantChangeRef.current = signalRService.onParticipantChange(
        (rawData: unknown) => {
          const data = rawData as ParticipantChangeData;
          console.log('[App] Participant change:', data);
          const conversationId = data?.conversationId || data?.ConversationId;
          const userId = data?.userId || data?.UserId;
          const action = data?.action;
          const currentUser = useAuthStore.getState().user;

          if (conversationId) {
            const chatStore = chatStoreModule.useChatStore.getState();

            // If the current user was removed, remove the conversation from their list
            if ((action === 'removed' || action === 'left') && userId === currentUser?.id) {
              chatStore.removeConversation(conversationId);
              Alert.alert(
                'Removed from Group',
                'You have been removed from this group.',
                [{ text: 'OK' }]
              );
            } else {
              // Another participant changed - refresh conversations to update participant list
              chatStore.fetchConversations();
            }
          }
        }
      );

      // Register handler for disappearing messages setting changed
      unsubscribeDisappearingMessagesChangedRef.current =
        signalRService.onDisappearingMessagesChanged((rawData: unknown) => {
          const data = rawData as DisappearingMessagesChangedData;
          console.log('[App] Disappearing messages changed:', data);
          const conversationId = data?.conversationId || data?.ConversationId;
          const duration = data?.duration || data?.Duration;

          if (conversationId) {
            const chatStore = chatStoreModule.useChatStore.getState();
            chatStore.updateDisappearingMessages(conversationId, duration as string | null);
          }
        });
    }, CONNECTION_DEBOUNCE_MS);

    return () => {
      // Only clean up local refs - don't disconnect on every effect re-run
      // The effect will handle disconnect when isAuthenticated becomes false
      cleanupLocalRefs();
    };
  }, [isAuthenticated, user, cleanupLocalRefs]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
          translucent
        />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
