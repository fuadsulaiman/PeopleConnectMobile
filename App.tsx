/**
 * PeopleConnect Mobile Application
 * Real-time communication platform
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { StatusBar, useColorScheme, LogBox, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator from './src/navigation/RootNavigator';
import { signalRService } from './src/services/signalr';
import { useAuthStore } from './src/stores/authStore';
import { useChatStore } from './src/stores/chatStore';
import { useCallStore } from './src/stores/callStore';
import { usePresenceStore } from './src/stores/presenceStore';
import { useThemeStore } from './src/stores/themeStore';

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
  const unsubscribeCallAnsweredRef = useRef<(() => void) | null>(null);
  const unsubscribeCallEndedRef = useRef<(() => void) | null>(null);
  const unsubscribeCallRejectedRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const backgroundTimestampRef = useRef<number | null>(null);

  // Initialize theme on app mount
  useEffect(() => {
    // Sync system dark mode preference
    setDarkMode(isDarkMode);
  }, [isDarkMode, setDarkMode]);

  // Fetch admin color profile on app mount
  useEffect(() => {
    console.log('[App] Fetching admin color profile...');
    fetchAdminColorProfile().catch(err => {
      console.log('[App] Failed to fetch admin color profile:', err);
    });
  }, [fetchAdminColorProfile]);

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
    if (platformChannelPollRef.current) {
      clearInterval(platformChannelPollRef.current);
      platformChannelPollRef.current = null;
    }
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
          signalRService.forceReconnect();
        } else if (!signalRService.isConnected()) {
          console.log('App came to foreground, reconnecting SignalR...');
          signalRService.connect();
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
        signalRService.disconnect();
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
      signalRService.connect();
      isConnectedRef.current = true;

      // Start background polling for Platform Channel updates
      const pollPlatformChannel = async () => {
        try {
          // Check if user is still authenticated
          const { isAuthenticated: stillAuthed } = useAuthStore.getState();
          if (!stillAuthed) return;

          const chatStore = useChatStore.getState();
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

      platformChannelPollRef.current = setInterval(pollPlatformChannel, PLATFORM_CHANNEL_BACKGROUND_POLL_INTERVAL);

      // Register handler for incoming messages
      unsubscribeMessageRef.current = signalRService.onMessage((message: any) => {
        console.log('Received message via SignalR:', JSON.stringify(message, null, 2));

        const chatStore = useChatStore.getState();
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
          idsArray.slice(0, 500).forEach(id => processedMessageIds.delete(id));
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
            const rt = message.replyTo || message.ReplyTo || message.replyToMessage || message.ReplyToMessage;
            if (!rt) return undefined;
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
          replyToId: message.replyToId || message.ReplyToId || message.replyToMessageId || message.ReplyToMessageId,
        } as any);

        // Acknowledge delivery to the sender (this triggers MessageDelivered on their end)
        // Don't acknowledge system messages
        if (!isSystemMessage) {
          signalRService.acknowledgeDelivery(message.conversationId, messageId).catch(err => {
            console.log('Failed to acknowledge delivery:', err);
          });
        }

        // Only update unread count if not viewing this conversation
        // Don't count system messages as unread
        if (!isViewingConversation && !isSystemMessage) {
          const freshState = useChatStore.getState();
          const currentConversation = freshState.conversations.find(c => c.id === message.conversationId);
          const currentUnread = currentConversation?.unreadCount || 0;
          freshState.updateConversation({
            id: message.conversationId,
            unreadCount: currentUnread + 1,
          });
        }
      });

      // Register handler for message status changes (delivered, read, etc.)
      unsubscribeStatusRef.current = signalRService.onStatusChange((messageId: string, status: string, conversationId?: string) => {
        console.log(`Message status update: ${messageId} -> ${status} (conversation: ${conversationId})`);
        const chatStore = useChatStore.getState();

        // Normalize IDs for case-insensitive GUID comparison
        const normalizedMessageId = messageId?.toLowerCase();
        const normalizedConversationId = conversationId?.toLowerCase();

        // If we have the conversationId, try to update directly
        if (conversationId) {
          // Try exact match first, then normalized
          const convMessages = chatStore.messages[conversationId] || (normalizedConversationId ? chatStore.messages[normalizedConversationId] : undefined);
          if (convMessages) {
            const message = convMessages.find((m: any) => m.id?.toLowerCase() === normalizedMessageId);
            if (message) {
              chatStore.updateMessageStatus(conversationId, messageId, status as any);
              return;
            }
          }
        }

        // Fallback: Find the conversation containing this message
        for (const [convId, msgs] of Object.entries(chatStore.messages)) {
          const message = msgs.find((m: any) => m.id?.toLowerCase() === normalizedMessageId);
          if (message) {
            chatStore.updateMessageStatus(convId, messageId, status as any);
            break;
          }
        }
      });

      // Register handler for presence changes (online/offline)
      unsubscribePresenceRef.current = signalRService.onPresence((userId: string, isOnline: boolean) => {
        console.log(`Presence update received: ${userId} -> ${isOnline ? 'online' : 'offline'}`);
        const presenceStore = usePresenceStore.getState();
        if (isOnline) {
          presenceStore.setUserOnline(userId);
        } else {
          presenceStore.setUserOffline(userId);
        }
      });

      // Register handler for conversation updates (pin, archive, etc.)
      unsubscribeConversationUpdateRef.current = signalRService.onConversationUpdate((conversationId: string, updates: any) => {
        console.log(`Conversation update received: ${conversationId}`, updates);
        const chatStore = useChatStore.getState();
        chatStore.updateConversation({ id: conversationId, ...updates });
      });

      // Register handler for initial online users list
      unsubscribeOnlineUsersRef.current = signalRService.onOnlineUsers((users: any[]) => {
        console.log(`Online users list received: ${users?.length || 0} users`);
        const presenceStore = usePresenceStore.getState();
        // Extract user IDs from the users array (handle different formats)
        const userIds = users.map(u => u.userId || u.id || u).filter(Boolean);
        presenceStore.setMultipleUsersOnline(userIds);
      });

      // Register handler for typing indicators
      signalRService.onTyping((data: any) => {
        const chatStore = useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        const conversationId = data?.conversationId || data?.ConversationId;
        const userId = data?.userId || data?.UserId;
        const userName = data?.userName || data?.UserName || data?.user?.name || 'Someone';
        const stoppedTyping = data?.stoppedTyping === true;

        // Don't track our own typing
        if (!conversationId || !userId || userId === currentUser?.id) return;

        if (stoppedTyping) {
          chatStore.removeTypingUser(conversationId, userId);
        } else {
          chatStore.addTypingUser(conversationId, userId, userName);
        }
      });

      // Register handler for recording indicators
      signalRService.onRecording((data: any) => {
        const chatStore = useChatStore.getState();
        const currentUser = useAuthStore.getState().user;

        const conversationId = data?.conversationId || data?.ConversationId;
        const userId = data?.userId || data?.UserId;
        const userName = data?.userName || data?.UserName || data?.user?.name || 'Someone';
        const stoppedRecording = data?.stoppedRecording === true;

        // Don't track our own recording
        if (!conversationId || !userId || userId === currentUser?.id) return;

        if (stoppedRecording) {
          chatStore.removeRecordingUser(conversationId, userId);
        } else {
          chatStore.addRecordingUser(conversationId, userId, userName);
        }
      });

      // Register handler for incoming calls (camelCase - SignalR converts from PascalCase)
      unsubscribeIncomingCallRef.current = signalRService.onCallEvent('incomingCall', (data: any) => {
        console.log('Incoming call received:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        const currentUser = useAuthStore.getState().user;

        // Don't handle our own calls
        if (data?.callerId === currentUser?.id) return;

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
      });

      // Register handler for call accepted
      unsubscribeCallAnsweredRef.current = signalRService.onCallEvent('callAccepted', (data: any) => {
        console.log('Call accepted:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        const currentCall = callStore.currentCall;

        if (currentCall && data?.callId === currentCall.id) {
          // Update call state to connected
          callStore.setCallConnected();
        }
      });

      // Register handler for call ended
      unsubscribeCallEndedRef.current = signalRService.onCallEvent('callEnded', (data: any) => {
        console.log('Call ended:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        callStore.clearCall();
      });

      // Register handler for call rejected
      unsubscribeCallRejectedRef.current = signalRService.onCallEvent('callRejected', (data: any) => {
        console.log('Call rejected:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        // Add to history as missed call if it was an incoming call we didn't answer
        if (callStore.currentCall && callStore.callState === 'incoming') {
          callStore.addMissedCall({
            ...data,
            ...callStore.currentCall,
            status: 'missed',
          });
        }
        callStore.clearCall();
      });

      // Register handler for call missed (timeout, no answer)
      signalRService.onCallEvent('callMissed', (data: any) => {
        console.log('Call missed:', JSON.stringify(data, null, 2));
        const callStore = useCallStore.getState();
        callStore.addMissedCall(data);
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
