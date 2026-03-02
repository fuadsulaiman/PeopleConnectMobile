import { create } from 'zustand';
import { conversations, messages, broadcasts } from '../services/sdk';
import { signalRService as _signalRService } from '../services/signalr';
import { config } from '../constants';

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  return `${baseUrl}${url}`;
};

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'viewed' | 'played' | 'failed';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderAvatarUrl?: string;
  content: string;
  type: string;
  createdAt: string;
  isRead?: boolean;
  isEdited?: boolean;
  attachments?: any[];
  reactions?: any[];
  status?: MessageStatus;
  isViewOnce?: boolean;
  viewOnceViewedAt?: string;
  replyToId?: string;
  replyTo?: Message;
}

interface User {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  status?: string;
}

interface Participant {
  userId: string;
  user: User;
  role: string;
  joinedAt: string;
  isOnline?: boolean;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

interface Conversation {
  id: string;
  name?: string;
  type: 'DirectMessage' | 'Chatroom' | 'BroadcastChannel';
  avatarUrl?: string;
  participants?: Participant[];
  lastMessage?: Message;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isBroadcast?: boolean;
  isPlatformChannel?: boolean;
  subscriberCount?: number;
}

interface TypingUser {
  conversationId: string;
  userId: string;
  name: string;
}

interface RecordingUser {
  conversationId: string;
  userId: string;
  name: string;
}

interface ChatState {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreMessages: Record<string, boolean>;
  error: string | null;
  // Track last seen message count for Platform Channel to calculate unread
  platformChannelSeenCount: number;
  // Track typing and recording users across all conversations
  typingUsers: TypingUser[];
  recordingUsers: RecordingUser[];

  fetchConversations: () => Promise<void>;
  fetchArchivedConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, refresh?: boolean) => Promise<void>;
  fetchMoreMessages: (conversationId: string) => Promise<void>;
  fetchBroadcastMessages: (channelId: string, refresh?: boolean) => Promise<void>;
  sendMessage: (conversationId: string, content: string, attachments?: any[], isViewOnce?: boolean, replyToId?: string) => Promise<boolean>;
  createConversation: (userId: string) => Promise<Conversation | null>;
  createGroupConversation: (name: string, userIds: string[]) => Promise<Conversation | null>;
  markAsRead: (conversationId: string, messageId: string) => Promise<void>;
  markViewOnceViewed: (conversationId: string, messageId: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string, forEveryone?: boolean) => Promise<void>;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: MessageStatus) => void;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  setActiveConversation: (conversationId: string | null) => void;
  // Typing and recording actions
  addTypingUser: (conversationId: string, userId: string, name: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
  addRecordingUser: (conversationId: string, userId: string, name: string) => void;
  removeRecordingUser: (conversationId: string, userId: string) => void;
  // Increment unread count
  incrementUnreadCount: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  archivedConversations: [],
  messages: {},
  activeConversationId: null,
  isLoading: false,
  isLoadingMore: false,
  hasMoreMessages: {},
  error: null,
  platformChannelSeenCount: 0,
  typingUsers: [],
  recordingUsers: [],

  fetchConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch regular conversations
      const result = await conversations.list();
      const rawList = Array.isArray(result) ? result : (result as any).items || [];

      // Helper to format message preview based on type
      const formatPreview = (lastMessage: any): string => {
        if (!lastMessage) return '';

        const content = lastMessage.content || '';
        const msgType = lastMessage.type?.toLowerCase() || 'text';
        const hasAttachments = lastMessage.attachments && lastMessage.attachments.length > 0;
        const isViewOnce = lastMessage.isViewOnce || lastMessage.IsViewOnce || lastMessage.viewOnce;
        const viewOnceViewedAt = lastMessage.viewOnceViewedAt || lastMessage.ViewOnceViewedAt;
        const messageStatus = (lastMessage.status || lastMessage.Status || '').toLowerCase();
        const isViewOnceViewed = viewOnceViewedAt || messageStatus === 'viewed';

        // Handle view-once messages
        if (isViewOnce) {
          // Show "Opened" if already viewed
          if (isViewOnceViewed) {
            if (msgType === 'image' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
              /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
              return '📷 Photo opened';
            } else if (msgType === 'video' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
              /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
              return '🎬 Video opened';
            } else {
              return '💬 Message opened';
            }
          }
          // Show locked icon for unopened view-once messages
          if (msgType === 'image' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
            return '🔒 View once photo';
          } else if (msgType === 'video' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
            /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
            return '🔒 View once video';
          } else {
            return '🔒 View once message';
          }
        }

        // Check message type or attachments to determine preview
        if (msgType === 'image' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
          return content || '📷 Photo';
        } else if (msgType === 'video' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
          /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
          return content || '🎬 Video';
        } else if (msgType === 'audio' || msgType === 'voice' || (hasAttachments && lastMessage.attachments?.some((a: any) =>
          /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(a.url || a)))) {
          return content || '🎵 Voice message';
        } else if (msgType === 'file' || msgType === 'document' || (hasAttachments && !content)) {
          return content || '📎 File';
        } else if (msgType === 'location' || (content && content.includes('"latitude"'))) {
          return '📍 Location';
        } else if (msgType === 'system') {
          // System messages - show with info icon indicator
          return `ℹ️ ${content || 'System message'}`;
        } else if (!content && hasAttachments) {
          return '📎 Attachment';
        }

        return content;
      };

      // Get current state to preserve optimistic updates and use local messages
      const currentState = get();
      const currentConversations = currentState.conversations;
      const currentMessages = currentState.messages;

      // Map lastMessage to lastMessagePreview for display
      // Convert relative avatar URLs to absolute URLs
      // IMPORTANT: Prefer local messages over server's lastMessage (server doesn't filter "deleted for me")
      const conversationList = rawList.map((conv: any) => {
        // Check if we have local messages for this conversation
        const localMessages = currentMessages[conv.id] || [];
        const localLastMessage = localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

        let finalPreview = '';
        let finalLastMessageAt = conv.lastMessage?.createdAt || conv.lastMessageAt;

        if (localLastMessage) {
          // Use local message for preview (correctly filtered, excludes "deleted for me")
          finalPreview = formatPreview(localLastMessage);
          finalLastMessageAt = localLastMessage.createdAt || finalLastMessageAt;
        } else {
          // No local messages - use server's lastMessage or existing preview
          const newPreview = formatPreview(conv.lastMessage);
          const existingConv = currentConversations.find((c) => c.id === conv.id);
          finalPreview = newPreview || existingConv?.lastMessagePreview || conv.lastMessagePreview || '';
        }

        return {
          ...conv,
          avatarUrl: toAbsoluteUrl(conv.avatarUrl),
          lastMessagePreview: finalPreview,
          lastMessageAt: finalLastMessageAt,
        };
      });

      // Fetch broadcast channels to find Platform Channel (type: "platform")
      let platformChannelItem: Conversation | null = null;
      try {
        const broadcastChannels = await broadcasts.getChannels();
        const channelList = Array.isArray(broadcastChannels) ? broadcastChannels : [];

        // Find Platform Channel by type="platform" or name containing "platform"
        const platformChannel = channelList.find((c: any) =>
          c.type === 'platform' || /platform/i.test(c.name)
        );

        if (platformChannel) {
          // Fetch latest messages for Platform Channel
          let latestMessage = null;
          try {
            const messagesResult = await broadcasts.getMessages(platformChannel.id, 1);
            const msgs = (messagesResult as any)?.items || [];
            if (msgs.length > 0) {
              latestMessage = msgs[0];
            }
          } catch (e) {
            // Ignore message fetch errors
          }

          platformChannelItem = {
            id: platformChannel.id,
            name: platformChannel.name,
            type: 'BroadcastChannel' as const,
            avatarUrl: toAbsoluteUrl(platformChannel.imageUrl),
            unreadCount: 0,
            lastMessagePreview: latestMessage?.content || platformChannel.description || '',
            lastMessageAt: latestMessage?.createdAt || platformChannel.createdAt,
            isPinned: true,
            isMuted: false,
            isArchived: false,
            isBroadcast: true,
            isPlatformChannel: true,
            subscriberCount: platformChannel.subscriberCount,
          };
        }
      } catch (broadcastError) {
        console.log('Failed to fetch broadcasts:', broadcastError);
      }

      // Separate archived conversations from active ones
      // Separate archived from active (handle both camelCase and PascalCase from API)
      const isArchived = (c: any) => c.isArchived === true || c.IsArchived === true;
      const activeConversations = conversationList.filter((c: any) => !isArchived(c));
      const archivedList = conversationList.filter((c: any) => isArchived(c));

      // Sort conversations: Platform Channel first, then pinned, then by lastMessageAt
      const sortedConversations = activeConversations.sort((a: Conversation, b: Conversation) => {
        // Pinned conversations come first (but after platform channel which is prepended)
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then sort by last message time (most recent first)
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      // Combine: Platform Channel first, then sorted conversations
      const allConversations = platformChannelItem
        ? [platformChannelItem, ...sortedConversations]
        : sortedConversations;

      // Preserve zero unread count for active conversation
      const activeId = currentState.activeConversationId;

      const finalConversations = (allConversations as Conversation[]).map(conv => {
        if (conv.id === activeId) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      });

      set({
        conversations: finalConversations,
        archivedConversations: archivedList,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      set({ error: error.message || 'Failed to fetch conversations', isLoading: false });
    }
  },

  fetchArchivedConversations: async () => {
    try {
      // Fetch all conversations and filter for archived ones
      const result = await conversations.list();
      const rawList = Array.isArray(result) ? result : (result as any).items || [];

      // Filter only archived conversations (handle both camelCase and PascalCase)
      const archivedList = rawList
        .filter((conv: any) => conv.isArchived === true || conv.IsArchived === true)
        .map((conv: any) => ({
          ...conv,
          avatarUrl: toAbsoluteUrl(conv.avatarUrl),
          lastMessagePreview: conv.lastMessage?.content || '',
          lastMessageAt: conv.lastMessage?.createdAt || conv.lastMessageAt,
        }));

      set({ archivedConversations: archivedList });
    } catch (error: any) {
      console.error('Failed to fetch archived conversations:', error);
    }
  },

  fetchMessages: async (conversationId, refresh = false) => {
    set({ isLoading: true, error: null });
    try {
      const result = await messages.list(conversationId, { limit: 50 });
      console.log("[RAW API]", JSON.stringify(result).substring(0, 1500));
      const rawMessageList = Array.isArray(result) ? result : (result as any).items || [];
      const hasMore = (result as any).hasMore ?? rawMessageList.length >= 50;

      // Get current user to determine which messages are ours
      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;

      // Normalize message data including status
      const messageList = rawMessageList.map((msg: any) => {
        // Determine status for our own messages
        let status: MessageStatus | undefined = undefined;
        if (currentUser && msg.senderId === currentUser.id) {
          // Map backend status to our status type
          const backendStatus = msg.status || msg.Status;
          if (backendStatus) {
            const statusLower = backendStatus.toLowerCase();
            if (statusLower === 'read' || statusLower === 'seen') status = 'read';
            else if (statusLower === 'delivered') status = 'delivered';
            else if (statusLower === 'sent') status = 'sent';
            else if (statusLower === 'viewed') status = 'viewed';
            else if (statusLower === 'played') status = 'played';
            else status = 'sent'; // Default for our own messages
          } else {
            // No status from backend - check if message was read
            status = msg.isRead || msg.IsRead ? 'read' : 'delivered';
          }
        }

        return {
          ...msg,
          status,
          attachments: msg.attachments || [],
          // Normalize view-once properties (handle both camelCase and PascalCase)
          isViewOnce: msg.isViewOnce || msg.IsViewOnce || false,
          viewOnceViewedAt: msg.viewOnceViewedAt || msg.ViewOnceViewedAt || undefined,
          replyTo: (() => {
            const rt = msg.replyTo || msg.ReplyTo || msg.replyToMessage || msg.ReplyToMessage;
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
          replyToId: msg.replyToId || msg.ReplyToId || msg.replyToMessageId || msg.ReplyToMessageId,
        };
      });

      const state = get();
      const isActive = state.activeConversationId === conversationId;

      // Generate preview for the last message (for conversation list)
      const lastMsg = messageList.length > 0 ? messageList[messageList.length - 1] : null;
      let lastMsgPreview = '';
      if (lastMsg) {
        const msgType = (lastMsg.type || 'text').toLowerCase();
        const hasAttachments = lastMsg.attachments && lastMsg.attachments.length > 0;

        if (msgType === 'image' || (hasAttachments && lastMsg.attachments?.some((a: any) =>
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
          lastMsgPreview = lastMsg.content || '📷 Photo';
        } else if (msgType === 'video' || (hasAttachments && lastMsg.attachments?.some((a: any) =>
          /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
          lastMsgPreview = lastMsg.content || '🎬 Video';
        } else if (msgType === 'audio' || msgType === 'voice' || (hasAttachments && lastMsg.attachments?.some((a: any) =>
          /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(a.url || a)))) {
          lastMsgPreview = lastMsg.content || '🎵 Voice message';
        } else if (msgType === 'file' || msgType === 'document' || (hasAttachments && !lastMsg.content)) {
          lastMsgPreview = '📎 File';
        } else {
          lastMsgPreview = lastMsg.content || '';
        }
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: refresh
            ? messageList
            : [...(state.messages[conversationId] || []), ...messageList],
        },
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [conversationId]: hasMore,
        },
        // Update conversation: reset unread count if active, update preview if refreshing
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;
          const updates: Partial<typeof c> = {};
          if (isActive) updates.unreadCount = 0;
          // Update preview when refreshing (e.g., after delete)
          if (refresh && lastMsg) {
            updates.lastMessagePreview = lastMsgPreview;
            updates.lastMessageAt = lastMsg.createdAt;
          } else if (refresh && !lastMsg) {
            // No messages left
            updates.lastMessagePreview = '';
          }
          return { ...c, ...updates };
        }),
        isLoading: false,
      }));

      // Mark messages as read on server if this is the active conversation
      if (isActive && messageList.length > 0) {
        const lastMessage = messageList[messageList.length - 1];
        // Use REST API instead of SignalR (SignalR method doesn't exist on server)
        conversations.markAsRead(conversationId, lastMessage.id).catch(err => {
          console.log('Failed to mark as read:', err);
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      set({ error: error.message || 'Failed to fetch messages', isLoading: false });
    }
  },

  fetchMoreMessages: async (conversationId) => {
    const state = get();

    // Don't fetch if already loading or no more messages
    if (state.isLoadingMore) {
      console.log('[ChatStore] Already loading more messages, skipping...');
      return;
    }

    if (state.hasMoreMessages[conversationId] === false) {
      console.log('[ChatStore] No more messages to load');
      return;
    }

    const existingMessages = state.messages[conversationId] || [];
    if (existingMessages.length === 0) {
      console.log('[ChatStore] No existing messages, skipping fetchMore');
      return;
    }

    // Messages are stored in chronological order (oldest first)
    // So the first message is the oldest one
    const oldestMessage = existingMessages[0];
    console.log('[ChatStore] Fetching messages before:', oldestMessage.id, 'content:', oldestMessage.content?.substring(0, 30));

    set({ isLoadingMore: true });
    try {
      const result = await messages.list(conversationId, {
        limit: 30,
        before: oldestMessage.id
      });
      console.log('[ChatStore] Received result:', JSON.stringify(result).substring(0, 200));
      console.log("[RAW API]", JSON.stringify(result).substring(0, 1500));
      const rawMessageList = Array.isArray(result) ? result : (result as any).items || [];
      const hasMore = (result as any).hasMore ?? rawMessageList.length >= 50;

      // Get current user to determine which messages are ours
      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;

      // Normalize message data including status
      const messageList = rawMessageList.map((msg: any) => {
        let status: MessageStatus | undefined = undefined;
        if (currentUser && msg.senderId === currentUser.id) {
          const backendStatus = msg.status || msg.Status;
          if (backendStatus) {
            const statusLower = backendStatus.toLowerCase();
            if (statusLower === 'read' || statusLower === 'seen') status = 'read';
            else if (statusLower === 'delivered') status = 'delivered';
            else if (statusLower === 'sent') status = 'sent';
            else if (statusLower === 'viewed') status = 'viewed';
            else if (statusLower === 'played') status = 'played';
            else status = 'sent';
          } else {
            status = msg.isRead || msg.IsRead ? 'read' : 'delivered';
          }
        }

        return {
          ...msg,
          status,
          attachments: msg.attachments || [],
          // Normalize view-once properties (handle both camelCase and PascalCase)
          isViewOnce: msg.isViewOnce || msg.IsViewOnce || false,
          viewOnceViewedAt: msg.viewOnceViewedAt || msg.ViewOnceViewedAt || undefined,
          replyTo: (() => {
            const rt = msg.replyTo || msg.ReplyTo || msg.replyToMessage || msg.ReplyToMessage;
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
          replyToId: msg.replyToId || msg.ReplyToId || msg.replyToMessageId || msg.ReplyToMessageId,
        };
      });

      set((state) => {
        const existingMessages = state.messages[conversationId] || [];
        const existingIds = new Set(existingMessages.map(m => m.id));
        // Filter out duplicates
        const newMessages = messageList.filter((m: Message) => !existingIds.has(m.id));

        console.log('[ChatStore] Adding', newMessages.length, 'new messages (filtered from', messageList.length, ')');

        // Prepend older messages to the beginning of the array
        return {
          messages: {
            ...state.messages,
            [conversationId]: [...newMessages, ...existingMessages],
          },
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [conversationId]: hasMore,
          },
          isLoadingMore: false,
        };
      });
    } catch (error: any) {
      console.error('Failed to fetch more messages:', error);
      set({ isLoadingMore: false });
    }
  },

  fetchBroadcastMessages: async (channelId, refresh = false) => {
    // Only show loading on initial fetch, not on polling
    const currentMessages = get().messages[channelId];
    const isInitialFetch = !currentMessages || currentMessages.length === 0;
    if (isInitialFetch) {
      set({ isLoading: true, error: null });
    }

    try {
      const result = await broadcasts.getMessages(channelId, 50);
      // Handle both wrapped ({ items: [...] }) and direct array responses
      const messageList = Array.isArray(result) ? result : ((result as any)?.items || []);

      // Normalize broadcast message format to match regular messages
      // API returns: { sender: { id, name, avatarUrl }, content, createdAt, imageUrl, ... }
      const normalizedMessages = messageList.map((msg: any) => ({
        id: msg.id,
        conversationId: channelId,
        senderId: msg.sender?.id || msg.publisherId || msg.senderId,
        senderName: msg.sender?.name || msg.publisherName || msg.senderName,
        content: msg.content || '',
        type: msg.imageUrl ? 'Image' : 'Text',
        createdAt: msg.createdAt || msg.sentAt,
        isRead: true,
        isEdited: false,
        // Keep imageUrl for easy access in rendering
        imageUrl: msg.imageUrl || null,
        attachments: msg.imageUrl ? [{ url: msg.imageUrl, type: 'image' }] : [],
        reactions: [],
      }));

      // Get the latest message to update conversation preview
      const latestMessage = normalizedMessages.length > 0
        ? normalizedMessages.reduce((latest: any, msg: any) =>
            new Date(msg.createdAt) > new Date(latest.createdAt) ? msg : latest
          )
        : null;

      const currentMessageCount = normalizedMessages.length;

      set((state) => {
        const isViewingChannel = state.activeConversationId === channelId;

        // Simple unread calculation: total messages - seen messages
        // If viewing, update seen count to current count (mark all as read)
        // If not viewing, calculate unread as difference
        let unreadCount = 0;
        let newSeenCount = state.platformChannelSeenCount;

        if (isViewingChannel) {
          // Currently viewing - mark all as read
          unreadCount = 0;
          newSeenCount = currentMessageCount;
        } else {
          // Not viewing - unread = new messages since last view
          unreadCount = Math.max(0, currentMessageCount - state.platformChannelSeenCount);
        }

        // Update conversation with latest message preview and unread count
        const updatedConversations = state.conversations.map((c) =>
          c.id === channelId
            ? {
                ...c,
                lastMessagePreview: latestMessage?.content || '[Media]',
                lastMessageAt: latestMessage?.createdAt || c.lastMessageAt,
                unreadCount: unreadCount,
              }
            : c
        );

        return {
          messages: {
            ...state.messages,
            [channelId]: refresh
              ? normalizedMessages
              : [...(state.messages[channelId] || []), ...normalizedMessages],
          },
          conversations: updatedConversations,
          platformChannelSeenCount: newSeenCount,
          isLoading: false,
        };
      });
    } catch (error: any) {
      console.error('Failed to fetch broadcast messages:', error);
      set({ error: error.message || 'Failed to fetch broadcast messages', isLoading: false });
    }
  },

  sendMessage: async (conversationId, content, attachments, isViewOnce, replyToId) => {
    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Get current user from auth store (import dynamically to avoid circular deps)
    const { useAuthStore } = require('./authStore');
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) {
      console.error('Cannot send message: No user logged in');
      return false;
    }

    // Determine message type from attachments
    let messageType = 'Text';
    let previewText = content;
    if (attachments && attachments.length > 0) {
      const attachType = attachments[0].type?.toLowerCase() || '';
      if (attachType === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachments[0].url || '')) {
        messageType = 'Image';
        previewText = isViewOnce ? '🔒 View once photo' : (content || '📷 Photo');
      } else if (attachType === 'video' || /\.(mp4|mov|webm)$/i.test(attachments[0].url || '')) {
        messageType = 'Video';
        previewText = isViewOnce ? '🔒 View once video' : (content || '🎬 Video');
      } else if (attachType === 'audio' || /\.(mp3|wav|m4a)$/i.test(attachments[0].url || '')) {
        messageType = 'Audio';
        previewText = content || '🎵 Voice message';
      } else if (attachType === 'location') {
        messageType = 'Location';
        previewText = '📍 Location';
      } else {
        messageType = 'File';
        previewText = content || '📎 File';
      }
    } else if (isViewOnce) {
      previewText = '🔒 View once message';
    }

    // Optimistically add message to local state immediately
    const optimisticMessage: Message = {
      id: tempId,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name || currentUser.username,
      senderAvatarUrl: currentUser.avatarUrl,
      content,
      type: messageType,
      createdAt: now,
      isRead: true,
      isEdited: false,
      attachments: attachments || [],
      reactions: [],
      status: 'sending',
      isViewOnce: isViewOnce || false,
      replyToId: replyToId,
    };

    // Add to state immediately (optimistic update)
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage],
      },
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessageAt: now,
              lastMessagePreview: previewText,
            }
          : c
      ),
    }));

    try {
      // Check if we have attachments with IDs (from upload)
      const hasAttachments = attachments && attachments.length > 0;
      const hasAttachmentIds = hasAttachments && attachments.some((att: any) => att.id);

      // Log what we're sending for debugging
      console.log('Sending message:', { conversationId, content, attachments, messageType, hasAttachmentIds });

      // For REST API, build request with attachmentIds (backend expects GUIDs from upload)
      const requestBody: any = {
        content: content || '',
        type: messageType,
      };

      // Add view-once flag if enabled (use PascalCase for .NET backend)
      if (isViewOnce) {
        requestBody.IsViewOnce = true;
      }

      // Add reply to message ID if replying
      if (replyToId) {
        requestBody.replyToMessageId = replyToId;
      }

      // Add attachment IDs if we have them (from upload response)
      if (hasAttachmentIds) {
        requestBody.attachmentIds = attachments
          .filter((att: any) => att.id)
          .map((att: any) => att.id);
        console.log('Using attachmentIds:', requestBody.attachmentIds);
      }

      console.log('REST API request body:', requestBody);

      // Use REST API directly for reliability (SignalR may not support attachments properly)
      const response = await messages.send(conversationId, requestBody);
      console.log('Message send response:', response);

      // Get the real message ID from response (API returns the created message)
      const realMessageId = (response as any)?.id || (response as any)?.messageId || (response as any)?.MessageId;

      // Update status to 'sent' and replace temp ID with real ID
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === tempId
              ? { ...m, id: realMessageId || tempId, status: 'sent' as MessageStatus }
              : m
          ),
        },
      }));
      return true;
    } catch (error: any) {
      console.error('Failed to send message:', error?.message || error);
      // Mark message as failed
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === tempId ? { ...m, status: 'failed' as MessageStatus } : m
          ),
        },
      }));
      return false;
    }
  },

  createConversation: async (userId) => {
    try {
      const conversation = await conversations.createDM({ userId });
      set((state) => ({
        conversations: [conversation as Conversation, ...state.conversations],
      }));
      return conversation as Conversation;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create conversation' });
      return null;
    }
  },

  createGroupConversation: async (name, userIds) => {
    try {
      const conversation = await conversations.createChatroom({ name, participantIds: userIds });
      set((state) => ({
        conversations: [conversation as Conversation, ...state.conversations],
      }));
      return conversation as Conversation;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create group' });
      return null;
    }
  },

  markAsRead: async (conversationId, messageId) => {
    try {
      // Use REST API instead of SignalR
      await conversations.markAsRead(conversationId, messageId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  markViewOnceViewed: async (conversationId, messageId) => {
    try {
      // Call the view-once API endpoint using fetch
      const { getAccessToken } = require('../services/sdk');
      const token = getAccessToken();

      const response = await fetch(
        `${config.API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/view-once`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.log('[ChatStore] View-once API returned:', response.status);
      }

      console.log('[ChatStore] Marked view-once message as viewed:', messageId);
    } catch (error) {
      console.error('Failed to mark view-once as viewed:', error);
      // Don't throw - allow viewing even if API fails
    }
  },

  deleteMessage: async (conversationId, messageId, forEveryone = false) => {
    try {
      await messages.delete(conversationId, messageId, forEveryone);

      // Remove message from local state and update conversation preview
      set((state) => {
        // Filter out the deleted message
        const remainingMessages = (state.messages[conversationId] || []).filter(
          (m) => m.id !== messageId
        );

        // Get the new last message (if any)
        const newLastMessage = remainingMessages.length > 0
          ? remainingMessages[remainingMessages.length - 1]
          : null;

        // Generate preview for the new last message
        let newPreview = '';
        let newLastMessageAt: string | undefined;
        if (newLastMessage) {
          newLastMessageAt = newLastMessage.createdAt;
          const msgType = (newLastMessage.type || 'text').toLowerCase();
          const hasAttachments = newLastMessage.attachments && newLastMessage.attachments.length > 0;

          if (msgType === 'image' || (hasAttachments && newLastMessage.attachments?.some((a: any) =>
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
            newPreview = newLastMessage.content || '📷 Photo';
          } else if (msgType === 'video' || (hasAttachments && newLastMessage.attachments?.some((a: any) =>
            /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
            newPreview = newLastMessage.content || '🎬 Video';
          } else if (msgType === 'audio' || msgType === 'voice' || (hasAttachments && newLastMessage.attachments?.some((a: any) =>
            /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(a.url || a)))) {
            newPreview = newLastMessage.content || '🎵 Voice message';
          } else if (msgType === 'file' || msgType === 'document' || (hasAttachments && !newLastMessage.content)) {
            newPreview = '📎 File';
          } else {
            newPreview = newLastMessage.content || '';
          }
        }

        return {
          messages: {
            ...state.messages,
            [conversationId]: remainingMessages,
          },
          // Update the conversation's last message preview from local data
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessagePreview: newPreview,
                  lastMessageAt: newLastMessageAt || c.lastMessageAt,
                }
              : c
          ),
        };
      });

      // Also refresh messages from server to ensure we have correct data
      // This will get the server's view of messages (excluding deleted ones)
      await get().fetchMessages(conversationId, true);
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete message' });
    }
  },

  editMessage: async (conversationId, messageId, content) => {
    try {
      await messages.edit(conversationId, messageId, { content });
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, content, isEdited: true } : m
          ),
        },
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to edit message' });
    }
  },

  addMessage: (message) => {
    set((state) => {
      const conversationMessages = state.messages[message.conversationId] || [];
      // Avoid duplicates
      if (conversationMessages.some((m) => m.id === message.id)) {
        return state;
      }

      // Generate appropriate preview text based on message type
      let previewText = message.content;
      const msgType = message.type?.toLowerCase() || 'text';
      const hasAttachments = message.attachments && message.attachments.length > 0;
      const isViewOnce = (message as any).isViewOnce || (message as any).IsViewOnce || (message as any).viewOnce;
      const viewOnceViewedAt = (message as any).viewOnceViewedAt || (message as any).ViewOnceViewedAt;
      const messageStatus = ((message as any).status || '').toLowerCase();
      const isViewOnceViewed = viewOnceViewedAt || messageStatus === 'viewed';

      // Handle view-once messages
      if (isViewOnce) {
        // Show "Opened" if already viewed
        if (isViewOnceViewed) {
          if (msgType === 'image' || (hasAttachments && message.attachments?.some((a: any) =>
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
            previewText = '📷 Photo opened';
          } else if (msgType === 'video' || (hasAttachments && message.attachments?.some((a: any) =>
            /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
            previewText = '🎬 Video opened';
          } else {
            previewText = '💬 Message opened';
          }
        } else if (msgType === 'image' || (hasAttachments && message.attachments?.some((a: any) =>
          /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
          previewText = '🔒 View once photo';
        } else if (msgType === 'video' || (hasAttachments && message.attachments?.some((a: any) =>
          /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
          previewText = '🔒 View once video';
        } else {
          previewText = '🔒 View once message';
        }
      }
      // Check for media types
      else if (msgType === 'image' || (hasAttachments && message.attachments?.some((a: any) =>
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || a)))) {
        previewText = '📷 Photo';
      } else if (msgType === 'video' || (hasAttachments && message.attachments?.some((a: any) =>
        /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(a.url || a)))) {
        previewText = '🎬 Video';
      } else if (msgType === 'audio' || msgType === 'voice' || (hasAttachments && message.attachments?.some((a: any) =>
        /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(a.url || a)))) {
        previewText = '🎵 Voice message';
      } else if (msgType === 'file' || msgType === 'document' || (hasAttachments && !previewText)) {
        previewText = '📎 File';
      } else if (msgType === 'location' || (message.content && message.content.includes('"latitude"'))) {
        previewText = '📍 Location';
      } else if (msgType === 'system') {
        // System messages - show with info icon indicator
        previewText = `ℹ️ ${message.content || 'System message'}`;
      } else if (!previewText && hasAttachments) {
        previewText = '📎 Attachment';
      }

      // Get current user to check if message is from someone else
      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;
      const isFromOther = message.senderId !== currentUser?.id;
      const isSystemMsg = msgType === 'system';

      // Increment unread count if message is from someone else, conversation is not active,
      // and it's not a system message (system messages don't count as unread)
      const shouldIncrementUnread = isFromOther && state.activeConversationId !== message.conversationId && !isSystemMsg;

      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...conversationMessages, message],
        },
        conversations: state.conversations.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessageAt: message.createdAt,
                lastMessagePreview: previewText || '[Media]',
                unreadCount: shouldIncrementUnread ? (c.unreadCount || 0) + 1 : c.unreadCount,
              }
            : c
        ),
      };
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    const normalizedMessageId = messageId?.toLowerCase();
    const normalizedConversationId = conversationId?.toLowerCase();

    set((state) => {
      const convMessages = state.messages[conversationId] || state.messages[normalizedConversationId] || [];
      const actualConvId = state.messages[conversationId] ? conversationId : normalizedConversationId;

      return {
        messages: {
          ...state.messages,
          [actualConvId]: convMessages.map((m) =>
            m.id?.toLowerCase() === normalizedMessageId ? { ...m, ...updates } : m
          ),
        },
      };
    });
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    // Normalize IDs to lowercase for case-insensitive GUID comparison
    const normalizedMessageId = messageId?.toLowerCase();
    const normalizedConversationId = conversationId?.toLowerCase();

    set((state) => {
      // Try exact conversation ID first, then lowercase
      const convMessages = state.messages[conversationId] || state.messages[normalizedConversationId] || [];
      const actualConvId = state.messages[conversationId] ? conversationId : normalizedConversationId;

      return {
        messages: {
          ...state.messages,
          [actualConvId]: convMessages.map((m) =>
            m.id?.toLowerCase() === normalizedMessageId ? { ...m, status } : m
          ),
        },
      };
    });
  },

  updateConversation: (conversation) => {
    set((state) => {
      // Check if archiving/unarchiving
      if (conversation.isArchived === true) {
        // Move from active to archived
        const convToArchive = state.conversations.find(c => c.id === conversation.id);
        if (convToArchive) {
          return {
            conversations: state.conversations.filter(c => c.id !== conversation.id),
            archivedConversations: [{ ...convToArchive, ...conversation }, ...state.archivedConversations],
          };
        }
      } else if (conversation.isArchived === false) {
        // Move from archived to active
        const convToUnarchive = state.archivedConversations.find(c => c.id === conversation.id);
        if (convToUnarchive) {
          const updatedConv = { ...convToUnarchive, ...conversation };
          // Insert after platform channel, respecting pin status
          const platformChannel = state.conversations.find(c => (c as any).isPlatformChannel);
          const otherConvs = state.conversations.filter(c => !(c as any).isPlatformChannel);

          // Sort: pinned first, then by time
          const newConvs = [...otherConvs, updatedConv].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          });

          return {
            conversations: platformChannel ? [platformChannel, ...newConvs] : newConvs,
            archivedConversations: state.archivedConversations.filter(c => c.id !== conversation.id),
          };
        }
      }

      // Handle pin status change - re-sort conversations
      if (conversation.isPinned !== undefined) {
        const updatedConvs = state.conversations.map(c =>
          c.id === conversation.id ? { ...c, ...conversation } : c
        );

        const platformChannel = updatedConvs.find(c => (c as any).isPlatformChannel);
        const otherConvs = updatedConvs.filter(c => !(c as any).isPlatformChannel);

        // Sort: pinned first, then by time
        const sortedConvs = otherConvs.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });

        return {
          conversations: platformChannel ? [platformChannel, ...sortedConvs] : sortedConvs,
        };
      }

      // Regular update
      return {
        conversations: state.conversations.map((c) =>
          c.id === conversation.id ? { ...c, ...conversation } : c
        ),
      };
    });
  },

  setActiveConversation: (conversationId) => {
    const state = get();

    if (!conversationId) {
      // Leaving conversation
      set({ activeConversationId: null });
      return;
    }

    // Check if entering Platform Channel
    const conversation = state.conversations.find(c => c.id === conversationId);
    const isPlatformChannel = conversation &&
      ((conversation as any).isPlatformChannel === true || (conversation as any).type === 'BroadcastChannel');

    if (isPlatformChannel) {
      // Get current message count to mark all as seen
      const currentMessages = state.messages[conversationId] || [];
      set({
        activeConversationId: conversationId,
        platformChannelSeenCount: currentMessages.length,
        conversations: state.conversations.map(c =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      });
    } else {
      // Regular DM or Chatroom - reset unread count locally
      const currentMessages = state.messages[conversationId] || [];
      const lastMessage = currentMessages.length > 0
        ? currentMessages[currentMessages.length - 1]
        : null;

      set({
        activeConversationId: conversationId,
        conversations: state.conversations.map(c =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      });

      // Notify server that messages are read (if there are messages)
      if (lastMessage) {
        // Use REST API instead of SignalR (SignalR method doesn't exist on server)
        conversations.markAsRead(conversationId, lastMessage.id).catch(err => {
          console.log('Failed to mark as read:', err);
        });
      }
    }
  },

  addTypingUser: (conversationId, userId, name) => {
    set((state) => {
      // Check if already exists
      const exists = state.typingUsers.some(
        u => u.conversationId === conversationId && u.userId === userId
      );
      if (exists) return state;

      return {
        typingUsers: [...state.typingUsers, { conversationId, userId, name }],
      };
    });

    // Auto-remove after 3 seconds (fallback if stop event not received)
    setTimeout(() => {
      get().removeTypingUser(conversationId, userId);
    }, 3000);
  },

  removeTypingUser: (conversationId, userId) => {
    set((state) => ({
      typingUsers: state.typingUsers.filter(
        u => !(u.conversationId === conversationId && u.userId === userId)
      ),
    }));
  },

  addRecordingUser: (conversationId, userId, name) => {
    set((state) => {
      // Check if already exists
      const exists = state.recordingUsers.some(
        u => u.conversationId === conversationId && u.userId === userId
      );
      if (exists) return state;

      return {
        recordingUsers: [...state.recordingUsers, { conversationId, userId, name }],
      };
    });

    // Auto-remove after 30 seconds (recordings are longer)
    setTimeout(() => {
      get().removeRecordingUser(conversationId, userId);
    }, 30000);
  },

  removeRecordingUser: (conversationId, userId) => {
    set((state) => ({
      recordingUsers: state.recordingUsers.filter(
        u => !(u.conversationId === conversationId && u.userId === userId)
      ),
    }));
  },

  incrementUnreadCount: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
          : c
      ),
    }));
  },
}));

export default useChatStore;
