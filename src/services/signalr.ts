import * as signalR from '@microsoft/signalr';
import { config } from '../constants';

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern instead - SDK is loaded only when needed
const getSDK = () => {
  const sdkModule = require('./sdk');
  return sdkModule.sdk;
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff

class SignalRService {
  private chatConnection: signalR.HubConnection | null = null;
  private presenceConnection: signalR.HubConnection | null = null;
  private callConnection: signalR.HubConnection | null = null;
  private isConnecting: boolean = false;
  private shouldConnect: boolean = false;
  private retryCount: number = 0;
  private connectionId: number = 0; // Track connection attempts to handle race conditions

  private messageHandlers: ((message: any) => void)[] = [];
  private typingHandlers: ((data: any) => void)[] = [];
  private recordingHandlers: ((data: any) => void)[] = [];
  private presenceHandlers: ((userId: string, isOnline: boolean) => void)[] = [];
  private onlineUsersHandlers: ((users: any[]) => void)[] = [];
  private callHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private statusHandlers: ((messageId: string, status: string, conversationId?: string) => void)[] =
    [];
  private conversationUpdateHandlers: ((conversationId: string, updates: any) => void)[] = [];
  private reactionHandlers: ((data: any) => void)[] = [];
  private participantHandlers: ((data: any) => void)[] = [];
  private newConversationHandlers: ((conversation: any) => void)[] = [];
  private profileUpdateHandlers: ((data: any) => void)[] = [];
  private sessionRevokedHandlers: ((data: any) => void)[] = [];
  private viewOnceViewedHandlers: ((data: any) => void)[] = [];
  private conversationMutedHandlers: ((data: any) => void)[] = [];
  private conversationDeletedHandlers: ((data: any) => void)[] = [];
  private participantRoleChangedHandlers: ((data: any) => void)[] = [];
  private disappearingMessagesChangedHandlers: ((data: any) => void)[] = [];

  async connect(): Promise<void> {
    // Already connected
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('SignalR already connected');
      return;
    }

    // Already connecting
    if (this.isConnecting) {
      console.log('SignalR connection already in progress');
      return;
    }

    const sdk = getSDK();
    const token = sdk.getAccessToken();
    if (!token) {
      console.log('SignalR: No token available, skipping connection');
      return;
    }

    this.isConnecting = true;
    this.shouldConnect = true;
    this.connectionId++;
    const currentConnectionId = this.connectionId;

    // Token factory that always gets fresh token
    // This is called by SignalR during connection and reconnection
    const getToken = () => {
      try {
        const sdkInstance = getSDK();
        const token = sdkInstance.getAccessToken();
        if (!token) {
          console.warn('[SignalR] Token factory called but no token available');
          return '';
        }
        // Log token info for debugging (only first 30 chars for security)
        console.log('[SignalR] Token factory returning token:', token.substring(0, 30) + '...');
        return token;
      } catch (error: any) {
        console.error('[SignalR] Token factory error:', error?.message);
        return '';
      }
    };

    try {
      // Clean up any existing connections first
      await this.cleanupConnections();

      // Check if we should still connect (disconnect might have been called)
      if (!this.shouldConnect || currentConnectionId !== this.connectionId) {
        console.log('SignalR: Connection cancelled');
        return;
      }

      // Chat Hub
      this.chatConnection = new signalR.HubConnectionBuilder()
        .withUrl(config.SIGNALR_URL + '/hubs/chat', {
          accessTokenFactory: getToken,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.setupChatHandlers();
      this.setupConnectionLifecycleHandlers(this.chatConnection, 'Chat');

      if (!this.shouldConnect || currentConnectionId !== this.connectionId) {
        return;
      }
      await this.chatConnection.start();
      console.log('SignalR Chat Hub connected');

      // Presence Hub
      this.presenceConnection = new signalR.HubConnectionBuilder()
        .withUrl(config.SIGNALR_URL + '/hubs/presence', {
          accessTokenFactory: getToken,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.setupPresenceHandlers();
      this.setupConnectionLifecycleHandlers(this.presenceConnection, 'Presence');

      if (!this.shouldConnect || currentConnectionId !== this.connectionId) {
        return;
      }
      await this.presenceConnection.start();
      console.log('SignalR Presence Hub connected');

      // Call Hub
      this.callConnection = new signalR.HubConnectionBuilder()
        .withUrl(config.SIGNALR_URL + '/hubs/call', {
          accessTokenFactory: getToken,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.setupCallHandlers();
      this.setupConnectionLifecycleHandlers(this.callConnection, 'Call');

      if (!this.shouldConnect || currentConnectionId !== this.connectionId) {
        return;
      }
      await this.callConnection.start();
      console.log('SignalR Call Hub connected, connectionId:', this.callConnection.connectionId);

      console.log('SignalR: All hubs connected successfully');
      console.log('SignalR: Connection IDs - Chat:', this.chatConnection?.connectionId, 'Call:', this.callConnection?.connectionId);
      this.retryCount = 0; // Reset retry count on success
    } catch (error: any) {
      console.error('SignalR connection error:', error?.message || error);

      // Handle retry logic
      if (this.shouldConnect && this.retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[this.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        this.retryCount++;
        console.log(
          `SignalR: Retrying connection in ${delay}ms (attempt ${this.retryCount}/${MAX_RETRY_ATTEMPTS})`
        );

        this.isConnecting = false;
        setTimeout(() => {
          if (this.shouldConnect) {
            this.connect();
          }
        }, delay);
        return;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private setupConnectionLifecycleHandlers(
    connection: signalR.HubConnection,
    hubName: string
  ): void {
    connection.onclose((error) => {
      const errorMessage = error?.message || '';
      console.log(`SignalR ${hubName} Hub closed`, errorMessage);

      // If we got a 404 error (stale connection), force cleanup and reconnect
      if (errorMessage.includes('404') || errorMessage.includes('No Connection with that ID')) {
        console.log(`SignalR ${hubName}: Stale connection detected, forcing cleanup...`);
        this.handleStaleConnection();
      }
    });

    connection.onreconnecting((error) => {
      console.log(`SignalR ${hubName} Hub reconnecting...`, error?.message || '');
    });

    connection.onreconnected((connectionId) => {
      console.log(`SignalR ${hubName} Hub reconnected with ID: ${connectionId}`);
    });
  }

  // Handle stale connection (e.g., after app was in background too long)
  private handleStaleConnection(): void {
    // Only attempt reconnect once
    if (this.isConnecting) {
      console.log('SignalR: Already reconnecting, skipping stale connection handler');
      return;
    }

    // Force cleanup all connections
    this.chatConnection = null;
    this.presenceConnection = null;
    this.callConnection = null;

    // Attempt to reconnect if we should be connected
    if (this.shouldConnect) {
      console.log('SignalR: Scheduling reconnect after stale connection...');
      setTimeout(() => {
        if (this.shouldConnect && !this.isConnecting) {
          this.connect();
        }
      }, 1000);
    }
  }

  private async cleanupConnections(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    if (
      this.chatConnection &&
      this.chatConnection.state !== signalR.HubConnectionState.Disconnected
    ) {
      stopPromises.push(this.chatConnection.stop().catch(() => {}));
    }
    if (
      this.presenceConnection &&
      this.presenceConnection.state !== signalR.HubConnectionState.Disconnected
    ) {
      stopPromises.push(this.presenceConnection.stop().catch(() => {}));
    }
    if (
      this.callConnection &&
      this.callConnection.state !== signalR.HubConnectionState.Disconnected
    ) {
      stopPromises.push(this.callConnection.stop().catch(() => {}));
    }

    await Promise.all(stopPromises);

    this.chatConnection = null;
    this.presenceConnection = null;
    this.callConnection = null;
  }

  async disconnect(): Promise<void> {
    console.log('SignalR: Disconnecting...');
    this.shouldConnect = false;
    this.connectionId++; // Invalidate any in-progress connection attempts
    this.retryCount = 0;

    try {
      await this.cleanupConnections();
      console.log('SignalR: Disconnected successfully');
    } catch (error: any) {
      console.error('SignalR disconnect error:', error?.message || error);
    } finally {
      this.isConnecting = false;
    }
  }

  // Force a fresh reconnection (useful when returning from background)
  async forceReconnect(): Promise<void> {
    console.log('SignalR: Force reconnecting...');

    // Clean up existing connections without setting shouldConnect to false
    this.connectionId++;
    this.retryCount = 0;
    this.isConnecting = false;

    try {
      await this.cleanupConnections();
    } catch (error: any) {
      console.error('SignalR cleanup error during force reconnect:', error?.message || error);
    }

    // Now establish fresh connection
    await this.connect();
  }

  // Check if connected (checks all hubs)
  isConnected(): boolean {
    return this.chatConnection?.state === signalR.HubConnectionState.Connected;
  }

  // Check if call hub specifically is connected
  isCallConnected(): boolean {
    return this.callConnection?.state === signalR.HubConnectionState.Connected;
  }

  // Get connection state
  getConnectionState(): string {
    if (!this.chatConnection) {
      return 'Disconnected';
    }
    switch (this.chatConnection.state) {
      case signalR.HubConnectionState.Connected:
        return 'Connected';
      case signalR.HubConnectionState.Connecting:
        return 'Connecting';
      case signalR.HubConnectionState.Reconnecting:
        return 'Reconnecting';
      case signalR.HubConnectionState.Disconnected:
        return 'Disconnected';
      case signalR.HubConnectionState.Disconnecting:
        return 'Disconnecting';
      default:
        return 'Unknown';
    }
  }

  private setupChatHandlers(): void {
    if (!this.chatConnection) {
      return;
    }

    this.chatConnection.on('ReceiveMessage', (message: any) => {
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.chatConnection.on('UserTyping', (data: any) => {
      console.log('UserTyping event received:', data);
      this.typingHandlers.forEach((handler) => handler(data));
    });

    // Also handle lowercase version (server may send either)
    this.chatConnection.on('usertyping', (data: any) => {
      console.log('usertyping event received:', data);
      this.typingHandlers.forEach((handler) => handler(data));
    });

    // Handle user stopped typing event
    this.chatConnection.on('UserStoppedTyping', (data: any) => {
      console.log('UserStoppedTyping event received:', data);
      // Mark as stoppedTyping so handler can differentiate
      this.typingHandlers.forEach((handler) => handler({ ...data, stoppedTyping: true }));
    });

    this.chatConnection.on('userstoppedtyping', (data: any) => {
      console.log('userstoppedtyping event received:', data);
      this.typingHandlers.forEach((handler) => handler({ ...data, stoppedTyping: true }));
    });

    this.chatConnection.on('MessageDeleted', (data: any) => {
      this.messageHandlers.forEach((handler) => handler({ ...data, deleted: true }));
    });

    this.chatConnection.on('MessageEdited', (data: any) => {
      this.messageHandlers.forEach((handler) => handler({ ...data, edited: true }));
    });

    // Handle message delivery confirmation
    this.chatConnection.on('MessageDelivered', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message delivered:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'delivered', conversationId));
    });

    // Also handle lowercase version (server may send either)
    this.chatConnection.on('messagedelivered', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message delivered:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'delivered', conversationId));
    });

    // Handle message read confirmation (various event name formats from server)
    this.chatConnection.on('MessageRead', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message read:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'read', conversationId));
    });

    this.chatConnection.on('messageread', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message read:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'read', conversationId));
    });

    this.chatConnection.on('messagesread', (data: any) => {
      console.log('Messages read:', data);
      const conversationId = data?.conversationId || data?.ConversationId;
      // Handle batch read - data contains { conversationId, messageIds: [], readAt, readByUserId }
      const messageIds = data?.messageIds || data?.MessageIds;
      if (messageIds && Array.isArray(messageIds)) {
        messageIds.forEach((msgId: string) => {
          this.statusHandlers.forEach((handler) => handler(msgId, 'read', conversationId));
        });
      } else if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const msgId = item?.messageId || item?.MessageId || item;
          this.statusHandlers.forEach((handler) => handler(msgId, 'read', conversationId));
        });
      } else if (data?.messageId || data?.MessageId) {
        this.statusHandlers.forEach((handler) =>
          handler(data?.messageId || data?.MessageId, 'read', conversationId)
        );
      }
    });

    this.chatConnection.on('MessagesRead', (data: any) => {
      console.log('Messages read:', data);
      const conversationId = data?.conversationId || data?.ConversationId;
      const messageIds = data?.messageIds || data?.MessageIds;
      if (messageIds && Array.isArray(messageIds)) {
        messageIds.forEach((msgId: string) => {
          this.statusHandlers.forEach((handler) => handler(msgId, 'read', conversationId));
        });
      } else if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const msgId = item?.messageId || item?.MessageId || item;
          this.statusHandlers.forEach((handler) => handler(msgId, 'read', conversationId));
        });
      } else if (data?.messageId || data?.MessageId) {
        this.statusHandlers.forEach((handler) =>
          handler(data?.messageId || data?.MessageId, 'read', conversationId)
        );
      }
    });

    // Handle message viewed (for media)
    this.chatConnection.on('MessageViewed', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message viewed:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'viewed', conversationId));
    });

    // Handle message played (for audio/video)
    this.chatConnection.on('MessagePlayed', (data: any) => {
      const messageId = data?.messageId || data?.MessageId || data;
      const conversationId = data?.conversationId || data?.ConversationId;
      console.log('Message played:', messageId, 'conversation:', conversationId);
      this.statusHandlers.forEach((handler) => handler(messageId, 'played', conversationId));
    });

    // Handle conversation pinned - backend sends ConversationPinnedNotification { ConversationId, IsPinned }
    this.chatConnection.on('ConversationPinned', (data: any) => {
      console.log('Conversation pinned:', data);
      const conversationId = data?.ConversationId || data?.conversationId;
      const isPinned = data?.IsPinned ?? data?.isPinned ?? true;
      if (conversationId) {
        this.conversationUpdateHandlers.forEach((handler) => handler(conversationId, { isPinned }));
      }
    });

    // Handle conversation archived - backend sends ConversationArchivedNotification { ConversationId, IsArchived }
    this.chatConnection.on('ConversationArchived', (data: any) => {
      console.log('Conversation archived:', data);
      const conversationId = data?.ConversationId || data?.conversationId;
      const isArchived = data?.IsArchived ?? data?.isArchived ?? true;
      if (conversationId) {
        this.conversationUpdateHandlers.forEach((handler) =>
          handler(conversationId, { isArchived })
        );
      }
    });

    // Handle user recording events (voice/video recording)
    this.chatConnection.on('UserRecording', (data: any) => {
      console.log('UserRecording event received:', data);
      this.recordingHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('userrecording', (data: any) => {
      console.log('userrecording event received:', data);
      this.recordingHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('UserStoppedRecording', (data: any) => {
      console.log('UserStoppedRecording event received:', data);
      this.recordingHandlers.forEach((handler) => handler({ ...data, stoppedRecording: true }));
    });

    this.chatConnection.on('userstoppedrecording', (data: any) => {
      console.log('userstoppedrecording event received:', data);
      this.recordingHandlers.forEach((handler) => handler({ ...data, stoppedRecording: true }));
    });

    // Handle reaction events
    this.chatConnection.on('ReactionAdded', (data: any) => {
      console.log('ReactionAdded event received:', data);
      this.reactionHandlers.forEach((handler) => handler({ ...data, added: true }));
    });

    this.chatConnection.on('reactionadded', (data: any) => {
      console.log('reactionadded event received:', data);
      this.reactionHandlers.forEach((handler) => handler({ ...data, added: true }));
    });

    this.chatConnection.on('ReactionRemoved', (data: any) => {
      console.log('ReactionRemoved event received:', data);
      this.reactionHandlers.forEach((handler) => handler({ ...data, removed: true }));
    });

    this.chatConnection.on('reactionremoved', (data: any) => {
      console.log('reactionremoved event received:', data);
      this.reactionHandlers.forEach((handler) => handler({ ...data, removed: true }));
    });

    // Handle conversation updated (name, description, avatar changes)
    this.chatConnection.on('ConversationUpdated', (data: any) => {
      console.log('ConversationUpdated event received:', data);
      const conversationId = data?.ConversationId || data?.conversationId || data?.id;
      if (conversationId) {
        this.conversationUpdateHandlers.forEach((handler) => handler(conversationId, data));
      }
    });

    this.chatConnection.on('conversationupdated', (data: any) => {
      console.log('conversationupdated event received:', data);
      const conversationId = data?.ConversationId || data?.conversationId || data?.id;
      if (conversationId) {
        this.conversationUpdateHandlers.forEach((handler) => handler(conversationId, data));
      }
    });

    // Handle participant events
    this.chatConnection.on('ParticipantAdded', (data: any) => {
      console.log('ParticipantAdded event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'added' }));
    });

    this.chatConnection.on('participantadded', (data: any) => {
      console.log('participantadded event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'added' }));
    });

    this.chatConnection.on('ParticipantRemoved', (data: any) => {
      console.log('ParticipantRemoved event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'removed' }));
    });

    this.chatConnection.on('participantremoved', (data: any) => {
      console.log('participantremoved event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'removed' }));
    });

    this.chatConnection.on('ParticipantLeft', (data: any) => {
      console.log('ParticipantLeft event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'left' }));
    });

    this.chatConnection.on('participantleft', (data: any) => {
      console.log('participantleft event received:', data);
      this.participantHandlers.forEach((handler) => handler({ ...data, action: 'left' }));
    });

    // Handle new conversation created
    this.chatConnection.on('NewConversation', (data: any) => {
      console.log('NewConversation event received:', data);
      this.newConversationHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('newconversation', (data: any) => {
      console.log('newconversation event received:', data);
      this.newConversationHandlers.forEach((handler) => handler(data));
    });

    // Handle user profile updated
    this.chatConnection.on('UserProfileUpdated', (data: any) => {
      console.log('UserProfileUpdated event received:', data);
      this.profileUpdateHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('userprofileupdated', (data: any) => {
      console.log('userprofileupdated event received:', data);
      this.profileUpdateHandlers.forEach((handler) => handler(data));
    });

    // Handle presence events that may come through chat connection
    this.chatConnection.on('useronline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.chatConnection.on('useroffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    this.chatConnection.on('UserOnline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.chatConnection.on('UserOffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    // Handle batch online users list (sent on connect) - ChatHub sends this
    this.chatConnection.on('onlineUsers', (users: any[]) => {
      console.log('onlineUsers event received (chat):', users?.length, 'users');
      this.onlineUsersHandlers.forEach((handler) => handler(users || []));
    });

    this.chatConnection.on('OnlineUsers', (users: any[]) => {
      console.log('OnlineUsers event received (chat):', users?.length, 'users');
      this.onlineUsersHandlers.forEach((handler) => handler(users || []));
    });

    // Handle session revoked (force logout by admin)
    this.chatConnection.on('SessionRevoked', (data: any) => {
      console.log('SessionRevoked event received:', data);
      this.sessionRevokedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('sessionrevoked', (data: any) => {
      console.log('sessionrevoked event received:', data);
      this.sessionRevokedHandlers.forEach((handler) => handler(data));
    });

    // Handle view-once message viewed
    this.chatConnection.on('ViewOnceViewed', (data: any) => {
      console.log('ViewOnceViewed event received:', data);
      this.viewOnceViewedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('viewonceviewed', (data: any) => {
      console.log('viewonceviewed event received:', data);
      this.viewOnceViewedHandlers.forEach((handler) => handler(data));
    });

    // Handle conversation muted status
    this.chatConnection.on('ConversationMuted', (data: any) => {
      console.log('ConversationMuted event received:', data);
      this.conversationMutedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('conversationmuted', (data: any) => {
      console.log('conversationmuted event received:', data);
      this.conversationMutedHandlers.forEach((handler) => handler(data));
    });

    // Handle conversation deleted
    this.chatConnection.on('ConversationDeleted', (data: any) => {
      console.log('ConversationDeleted event received:', data);
      this.conversationDeletedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('conversationdeleted', (data: any) => {
      console.log('conversationdeleted event received:', data);
      this.conversationDeletedHandlers.forEach((handler) => handler(data));
    });

    // Handle participant role changed
    this.chatConnection.on('ParticipantRoleChanged', (data: any) => {
      console.log('ParticipantRoleChanged event received:', data);
      this.participantRoleChangedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('participantrolechanged', (data: any) => {
      console.log('participantrolechanged event received:', data);
      this.participantRoleChangedHandlers.forEach((handler) => handler(data));
    });

    // Handle disappearing messages setting changed
    this.chatConnection.on('DisappearingMessagesChanged', (data: any) => {
      console.log('DisappearingMessagesChanged event received:', data);
      this.disappearingMessagesChangedHandlers.forEach((handler) => handler(data));
    });

    this.chatConnection.on('disappearingmessageschanged', (data: any) => {
      console.log('disappearingmessageschanged event received:', data);
      this.disappearingMessagesChangedHandlers.forEach((handler) => handler(data));
    });
  }

  // Helper to extract userId from presence events (handles both string and object formats)
  private extractUserId(data: any): string | null {
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object') {
      const userId = data.userId || data.id || data.UserId || data.Id || data.user?.id;
      if (userId) {
        console.log(`[SignalR] Extracted userId ${userId} from object:`, JSON.stringify(data));
        return userId;
      }
    }
    console.log('[SignalR] Could not extract userId from:', data);
    return null;
  }

  private setupPresenceHandlers(): void {
    if (!this.presenceConnection) {
      return;
    }

    this.presenceConnection.on('UserOnline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.presenceConnection.on('UserOffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    // Lowercase versions (server may send either)
    this.presenceConnection.on('useronline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.presenceConnection.on('useroffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    // Handle batch online users list (sent on connect and periodically)
    this.presenceConnection.on('OnlineUsers', (users: any[]) => {
      console.log('OnlineUsers event received (presence):', users?.length, 'users');
      this.onlineUsersHandlers.forEach((handler) => handler(users || []));
    });

    this.presenceConnection.on('onlineUsers', (users: any[]) => {
      console.log('onlineUsers event received (presence):', users?.length, 'users');
      this.onlineUsersHandlers.forEach((handler) => handler(users || []));
    });

    this.presenceConnection.on('onlineusers', (users: any[]) => {
      console.log('onlineusers event received (presence):', users?.length, 'users');
      this.onlineUsersHandlers.forEach((handler) => handler(users || []));
    });
  }

  private setupCallHandlers(): void {
    if (!this.callConnection) {
      return;
    }

    // Register both PascalCase and camelCase event names
    // SignalR .NET sends PascalCase, but JS client may receive as camelCase
    const events = [
      'IncomingCall',
      'IncomingGroupCall',
      'CallAnswered',
      'CallAccepted',
      'CallParticipantJoined',
      'CallEnded',
      'CallRejected',
      'IceCandidate',
      'SdpOffer',
      'SdpAnswer',
      'RecordingStatusChanged',
    ];

    events.forEach((event) => {
      // Handler that dispatches to registered callbacks
      const dispatchHandler = (data: any) => {
        // Check both PascalCase and camelCase handler registrations
        const pascalHandlers = this.callHandlers.get(event) || [];
        const camelEvent = event.charAt(0).toLowerCase() + event.slice(1);
        const camelHandlers = this.callHandlers.get(camelEvent) || [];

        // Dispatch to all registered handlers
        pascalHandlers.forEach((handler) => handler(data));
        camelHandlers.forEach((handler) => handler(data));
      };

      // Register for PascalCase event name (server sends this)
      this.callConnection!.on(event, dispatchHandler);

      // Also register for camelCase event name (SignalR may convert)
      const camelCaseEvent = event.charAt(0).toLowerCase() + event.slice(1);
      this.callConnection!.on(camelCaseEvent, dispatchHandler);
    });

    // Handle presence events that may come through call connection
    this.callConnection.on('useronline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.callConnection.on('useroffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    this.callConnection.on('UserOnline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, true));
      }
    });

    this.callConnection.on('UserOffline', (data: any) => {
      const userId = this.extractUserId(data);
      if (userId) {
        this.presenceHandlers.forEach((handler) => handler(userId, false));
      }
    });

    this.callConnection.on('UserOnline', (userId: string) => {
      this.presenceHandlers.forEach((handler) => handler(userId, true));
    });

    this.callConnection.on('UserOffline', (userId: string) => {
      this.presenceHandlers.forEach((handler) => handler(userId, false));
    });
  }

  // Message handlers
  onMessage(handler: (message: any) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  onTyping(handler: (data: any) => void): () => void {
    this.typingHandlers.push(handler);
    return () => {
      const index = this.typingHandlers.indexOf(handler);
      if (index > -1) {
        this.typingHandlers.splice(index, 1);
      }
    };
  }

  onPresence(handler: (userId: string, isOnline: boolean) => void): () => void {
    this.presenceHandlers.push(handler);
    return () => {
      const index = this.presenceHandlers.indexOf(handler);
      if (index > -1) {
        this.presenceHandlers.splice(index, 1);
      }
    };
  }

  onOnlineUsers(handler: (users: any[]) => void): () => void {
    this.onlineUsersHandlers.push(handler);
    return () => {
      const index = this.onlineUsersHandlers.indexOf(handler);
      if (index > -1) {
        this.onlineUsersHandlers.splice(index, 1);
      }
    };
  }

  onStatusChange(
    handler: (messageId: string, status: string, conversationId?: string) => void
  ): () => void {
    this.statusHandlers.push(handler);
    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index > -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }

  onConversationUpdate(handler: (conversationId: string, updates: any) => void): () => void {
    this.conversationUpdateHandlers.push(handler);
    return () => {
      const index = this.conversationUpdateHandlers.indexOf(handler);
      if (index > -1) {
        this.conversationUpdateHandlers.splice(index, 1);
      }
    };
  }

  onRecording(handler: (data: any) => void): () => void {
    this.recordingHandlers.push(handler);
    return () => {
      const index = this.recordingHandlers.indexOf(handler);
      if (index > -1) {
        this.recordingHandlers.splice(index, 1);
      }
    };
  }

  onReaction(handler: (data: any) => void): () => void {
    this.reactionHandlers.push(handler);
    return () => {
      const index = this.reactionHandlers.indexOf(handler);
      if (index > -1) {
        this.reactionHandlers.splice(index, 1);
      }
    };
  }

  onParticipantChange(handler: (data: any) => void): () => void {
    this.participantHandlers.push(handler);
    return () => {
      const index = this.participantHandlers.indexOf(handler);
      if (index > -1) {
        this.participantHandlers.splice(index, 1);
      }
    };
  }

  onNewConversation(handler: (conversation: any) => void): () => void {
    this.newConversationHandlers.push(handler);
    return () => {
      const index = this.newConversationHandlers.indexOf(handler);
      if (index > -1) {
        this.newConversationHandlers.splice(index, 1);
      }
    };
  }

  onProfileUpdate(handler: (data: any) => void): () => void {
    this.profileUpdateHandlers.push(handler);
    return () => {
      const index = this.profileUpdateHandlers.indexOf(handler);
      if (index > -1) {
        this.profileUpdateHandlers.splice(index, 1);
      }
    };
  }

  onSessionRevoked(handler: (data: any) => void): () => void {
    this.sessionRevokedHandlers.push(handler);
    return () => {
      const index = this.sessionRevokedHandlers.indexOf(handler);
      if (index > -1) {
        this.sessionRevokedHandlers.splice(index, 1);
      }
    };
  }

  onViewOnceViewed(handler: (data: any) => void): () => void {
    this.viewOnceViewedHandlers.push(handler);
    return () => {
      const index = this.viewOnceViewedHandlers.indexOf(handler);
      if (index > -1) {
        this.viewOnceViewedHandlers.splice(index, 1);
      }
    };
  }

  onConversationMuted(handler: (data: any) => void): () => void {
    this.conversationMutedHandlers.push(handler);
    return () => {
      const index = this.conversationMutedHandlers.indexOf(handler);
      if (index > -1) {
        this.conversationMutedHandlers.splice(index, 1);
      }
    };
  }

  onConversationDeleted(handler: (data: any) => void): () => void {
    this.conversationDeletedHandlers.push(handler);
    return () => {
      const index = this.conversationDeletedHandlers.indexOf(handler);
      if (index > -1) {
        this.conversationDeletedHandlers.splice(index, 1);
      }
    };
  }

  onParticipantRoleChanged(handler: (data: any) => void): () => void {
    this.participantRoleChangedHandlers.push(handler);
    return () => {
      const index = this.participantRoleChangedHandlers.indexOf(handler);
      if (index > -1) {
        this.participantRoleChangedHandlers.splice(index, 1);
      }
    };
  }

  onDisappearingMessagesChanged(handler: (data: any) => void): () => void {
    this.disappearingMessagesChangedHandlers.push(handler);
    return () => {
      const index = this.disappearingMessagesChangedHandlers.indexOf(handler);
      if (index > -1) {
        this.disappearingMessagesChangedHandlers.splice(index, 1);
      }
    };
  }

  onCallEvent(event: string, handler: (data: any) => void): () => void {
    if (!this.callHandlers.has(event)) {
      this.callHandlers.set(event, []);
    }
    this.callHandlers.get(event)!.push(handler);
    return () => {
      const handlers = this.callHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // Chat methods
  async sendMessage(conversationId: string, content: string, attachments?: any[]): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      // Ensure attachments are in the correct format for the backend
      const formattedAttachments = (attachments || []).map((att) => ({
        url: att.url,
        type: att.type,
        fileName: att.fileName,
        contentType: att.contentType,
        fileSize: att.fileSize,
      }));

      console.log('SignalR SendMessage:', {
        conversationId,
        content: content ? content.substring(0, 50) : '[empty]',
        attachmentsCount: formattedAttachments.length,
        attachments: formattedAttachments,
      });

      await this.chatConnection.invoke(
        'SendMessage',
        conversationId,
        content,
        formattedAttachments
      );
    } else {
      console.log('SignalR not connected, cannot send message');
      throw new Error('SignalR not connected');
    }
  }

  async sendTyping(conversationId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('Sending typing indicator for conversation:', conversationId);
      await this.chatConnection.invoke('SendTypingIndicator', conversationId);
    } else {
      console.log(
        'Cannot send typing indicator - not connected. State:',
        this.chatConnection?.state
      );
    }
  }

  async sendStoppedTyping(conversationId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('Sending stopped typing indicator for conversation:', conversationId);
      await this.chatConnection.invoke('SendStoppedTypingIndicator', conversationId);
    }
  }

  async sendRecording(
    conversationId: string,
    recordingType: 'voice' | 'video' = 'video'
  ): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log(
        'Sending recording indicator for conversation:',
        conversationId,
        'type:',
        recordingType
      );
      await this.chatConnection.invoke('SendRecordingIndicator', conversationId, recordingType);
    } else {
      console.log(
        'Cannot send recording indicator - not connected. State:',
        this.chatConnection?.state
      );
    }
  }

  async sendStoppedRecording(conversationId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('Sending stopped recording indicator for conversation:', conversationId);
      await this.chatConnection.invoke('SendStoppedRecordingIndicator', conversationId);
    }
  }

  // Note: The backend ChatHub does not have a MarkAsRead method.
  // Use the REST API (conversations.markAsRead) instead to mark messages as read.
  // This method is kept for compatibility but will log a warning.
  async markAsRead(_conversationId: string, _messageId: string): Promise<void> {
    console.warn('SignalR markAsRead is not supported by the backend. Use REST API instead.');
    // The method would invoke 'MarkAsRead' but this doesn't exist on the server
    // if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
    //   await this.chatConnection.invoke('MarkAsRead', conversationId, messageId);
    // }
  }

  async acknowledgeDelivery(conversationId: string, messageId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      console.log(
        'Acknowledging delivery for message:',
        messageId,
        'in conversation:',
        conversationId
      );
      await this.chatConnection.invoke('AcknowledgeMessageDelivery', conversationId, messageId);
    }
  }

  async joinConversation(conversationId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      await this.chatConnection.invoke('JoinConversation', conversationId);
    }
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      await this.chatConnection.invoke('LeaveConversation', conversationId);
    }
  }

  // Call methods
  async initiateCall(targetUserId: string, type: 'voice' | 'video'): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('InitiateCall', targetUserId, type);
    }
  }

  // Initiate a group call (notifies all participants in the conversation)
  // Backend CallHub uses InitiateCall(conversationId, callType) for group calls
  async initiateGroupCall(conversationId: string, type: 'voice' | 'video'): Promise<void> {
    // Ensure call connection is specifically connected
    if (this.callConnection?.state !== signalR.HubConnectionState.Connected) {
      console.warn('[SignalR] Call hub not connected, current state:', this.callConnection?.state);
      console.log('[SignalR] Attempting to reconnect call hub...');

      // Try to establish connection if not connected
      if (!this.callConnection || this.callConnection.state === signalR.HubConnectionState.Disconnected) {
        // Force full reconnection
        await this.connect();

        // Verify call connection is now connected
        if (this.callConnection?.state !== signalR.HubConnectionState.Connected) {
          throw new Error('Failed to establish SignalR call connection');
        }
      } else {
        throw new Error(`SignalR call connection not connected. State: ${this.callConnection?.state}`);
      }
    }

    // Log token availability for debugging
    const sdk = getSDK();
    const token = sdk.getAccessToken();
    console.log('[SignalR] Initiating group call:', {
      conversationId,
      type,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'NO TOKEN',
      callConnectionState: this.callConnection.state,
    });

    try {
      // Note: Backend uses 'InitiateCall' (not 'InitiateGroupCall') for conversation-based calls
      await this.callConnection.invoke('InitiateCall', conversationId, type);
      console.log('[SignalR] Group call initiated successfully');
    } catch (error: any) {
      // Log full error details for debugging
      console.error('[SignalR] InitiateCall failed:', {
        message: error?.message,
        conversationId,
        type,
      });
      throw error;
    }
  }

  async answerCall(callId: string): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('AcceptCall', callId);
    }
  }

  async rejectCall(callId: string): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('RejectCall', callId);
    }
  }

  async endCall(callId: string): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('EndCall', callId);
    }
  }

  async sendIceCandidate(callId: string, candidate: any): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('SendIceCandidate', callId, candidate);
    }
  }

  async sendSdpOffer(callId: string, sdp: any): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('SendSdpOffer', callId, sdp);
    }
  }

  async sendSdpAnswer(callId: string, sdp: any): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      await this.callConnection.invoke('SendSdpAnswer', callId, sdp);
    }
  }

  // Notify call recording status change
  async notifyRecordingStatus(callId: string, isRecording: boolean): Promise<void> {
    if (this.callConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('[SignalR] Notifying recording status:', { callId, isRecording });
      await this.callConnection.invoke('NotifyRecordingStatus', callId, isRecording);
    } else {
      console.warn('[SignalR] Cannot notify recording status - call hub not connected');
      throw new Error('Call connection not available');
    }
  }
}

export const signalRService = new SignalRService();
export default signalRService;
