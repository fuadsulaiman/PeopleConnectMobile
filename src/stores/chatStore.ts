import { create } from 'zustand';
import { config } from '../constants';

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern instead - SDK is loaded only when needed
type SDKConversations = {
  list: (params?: { page?: number; pageSize?: number }) => Promise<any>;
  createDM: (params: { userId: string }) => Promise<any>;
  createChatroom: (params: { name: string; participantIds: string[] }) => Promise<any>;
  markAsRead: (conversationId: string, messageId: string) => Promise<void>;
};

type SDKMessages = {
  list: (conversationId: string, options: { limit: number; before?: string }) => Promise<any>;
  send: (conversationId: string, body: any) => Promise<any>;
  delete: (conversationId: string, messageId: string, forEveryone: boolean) => Promise<void>;
  edit: (conversationId: string, messageId: string, body: { content: string }) => Promise<void>;
};

type SDKBroadcasts = {
  getChannels: () => Promise<any>;
  getMessages: (channelId: string, limit: number) => Promise<any>;
};

// Lazy SDK loaders - these functions only load the SDK when called
const getConversationsService = (): SDKConversations => {
  const sdk = require('../services/sdk');
  return sdk.conversations;
};

const getMessagesService = (): SDKMessages => {
  const sdk = require('../services/sdk');
  return sdk.messages;
};

const getBroadcastsService = (): SDKBroadcasts => {
  const sdk = require('../services/sdk');
  return sdk.broadcasts;
};

const getAccessTokenFn = (): string | null => {
  const sdk = require('../services/sdk');
  return sdk.getAccessToken();
};

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }
  if (url.startsWith('http')) {
    return url;
  }
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  return `${baseUrl}${url}`;
};

// Shared utility to generate message preview text from a message object
// Used by fetchConversations, fetchMoreConversations, addMessage, deleteMessage, etc.
export const getMessagePreviewText = (msg: any): string => {
  if (!msg) return '';

  const content = msg.content || msg.Content || '';
  const msgType = (msg.type || msg.Type || 'text').toLowerCase();
  const attachments = msg.attachments || msg.Attachments || [];
  const hasAttachments = attachments.length > 0;
  const isViewOnce = msg.isViewOnce || msg.IsViewOnce || msg.viewOnce || false;
  const viewOnceViewedAt = msg.viewOnceViewedAt || msg.ViewOnceViewedAt;
  const messageStatus = (msg.status || msg.Status || '').toLowerCase();
  const isViewOnceViewed = viewOnceViewedAt || messageStatus === 'viewed';

  // Helper to check attachment file extensions
  const hasAttachmentMatching = (pattern: RegExp) =>
    hasAttachments && attachments.some((a: any) => pattern.test(a.url || a.Url || a.fileName || a.FileName || ''));

  const isImage = msgType === 'image' || hasAttachmentMatching(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i);
  const isVideo = msgType === 'video' || hasAttachmentMatching(/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i);
  const isAudio = msgType === 'audio' || msgType === 'voice' || hasAttachmentMatching(/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i);
  const isFile = msgType === 'file' || msgType === 'document';
  const isLocation = msgType === 'location' || (content && content.includes('"latitude"'));
  const isSystem = msgType === 'system';
  const isVoiceCall = msgType === 'voicecall';
  const isVideoCall = msgType === 'videocall';

  if (isViewOnce) {
    if (isViewOnceViewed) {
      if (isImage) return '📷 Photo opened';
      if (isVideo) return '🎬 Video opened';
      return '💬 Message opened';
    }
    if (isImage) return '🔒 View once photo';
    if (isVideo) return '🔒 View once video';
    return '🔒 View once message';
  }

  if (isImage) return content || '📷 Photo';
  if (isVideo) return content || '🎬 Video';
  if (isAudio) return content || '🎵 Voice message';
  if (isFile) return content || '📎 File';
  if (isLocation) return '📍 Location';
  if (isVoiceCall) return '📞 Voice call';
  if (isVideoCall) return '📹 Video call';
  if (isSystem) return 'ℹ️ ' + (content || 'System message');
  if (!content && hasAttachments) return '📎 Attachment';

  return content;
};

export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'viewed'
  | 'played'
  | 'failed';

export interface Message {
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
  attachments?: unknown[];
  reactions?: unknown[];
  status?: MessageStatus;
  isViewOnce?: boolean;
  viewOnceViewedAt?: string;
  replyTo?: unknown;
  replyToId?: string;
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

export interface Conversation {
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
  mutedUntil?: string;
  isArchived?: boolean;
  isBroadcast?: boolean;
  isPlatformChannel?: boolean;
  subscriberCount?: number;
  disappearingMessagesDuration?: string | null;
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
  platformChannelSeenCount: number;
  typingUsers: TypingUser[];
  recordingUsers: RecordingUser[];
  conversationsPage: number;
  hasMoreConversations: boolean;
  isLoadingMoreConversations: boolean;

  fetchConversations: () => Promise<void>;
  fetchMoreConversations: () => Promise<void>;
  fetchArchivedConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, refresh?: boolean) => Promise<void>;
  fetchMoreMessages: (conversationId: string) => Promise<void>;
  fetchBroadcastMessages: (channelId: string, refresh?: boolean) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    attachments?: any[],
    isViewOnce?: boolean,
    replyToId?: string
  ) => Promise<boolean>;
  createConversation: (userId: string) => Promise<Conversation | null>;
  createGroupConversation: (name: string, userIds: string[]) => Promise<Conversation | null>;
  markAsRead: (conversationId: string, messageId: string) => Promise<void>;
  markViewOnceViewed: (conversationId: string, messageId: string) => Promise<void>;
  deleteMessage: (
    conversationId: string,
    messageId: string,
    forEveryone?: boolean
  ) => Promise<void>;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: MessageStatus) => void;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  setActiveConversation: (conversationId: string | null) => void;
  addTypingUser: (conversationId: string, userId: string, name: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
  addRecordingUser: (conversationId: string, userId: string, name: string) => void;
  removeRecordingUser: (conversationId: string, userId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;
  updateMessageViewOnce: (messageId: string, viewedAt: string) => void;
  updateConversationMuteStatus: (
    conversationId: string,
    isMuted: boolean,
    mutedUntil?: string
  ) => void;
  removeConversation: (conversationId: string) => void;
  updateParticipantRole: (conversationId: string, userId: string, newRole: string) => void;
  updateDisappearingMessages: (conversationId: string, duration: string | null) => void;
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
  conversationsPage: 1,
  hasMoreConversations: true,
  isLoadingMoreConversations: false,

  fetchConversations: async () => {
    set({ isLoading: true, error: null, conversationsPage: 1, hasMoreConversations: true });
    try {
      const conversations = getConversationsService();
      const result = await conversations.list({ page: 1, pageSize: 20 });
      const rawList = Array.isArray(result) ? result : (result as any).items || [];
      const totalCount = (result as any).totalCount || rawList.length;
      const hasMore = rawList.length >= 20 && rawList.length < totalCount;

      const formatPreview = getMessagePreviewText;

      const currentState = get();
      const currentConversations = currentState.conversations;
      const currentMessages = currentState.messages;

      const conversationList = rawList.map((conv: any) => {
        const localMessages = currentMessages[conv.id] || [];
        const localLastMessage =
          localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

        let finalPreview = '';
        let finalLastMessageAt = conv.lastMessage?.createdAt || conv.lastMessageAt;

        if (localLastMessage) {
          finalPreview = formatPreview(localLastMessage);
          finalLastMessageAt = localLastMessage.createdAt || finalLastMessageAt;
        } else {
          const newPreview = formatPreview(conv.lastMessage);
          const existingConv = currentConversations.find((c) => c.id === conv.id);
          finalPreview =
            newPreview || existingConv?.lastMessagePreview || conv.lastMessagePreview || '';
        }

        return {
          ...conv,
          avatarUrl: toAbsoluteUrl(conv.avatarUrl),
          lastMessagePreview: finalPreview,
          lastMessageAt: finalLastMessageAt,
        };
      });

      let platformChannelItem: Conversation | null = null;
      try {
        const broadcasts = getBroadcastsService();
        const broadcastChannels = await broadcasts.getChannels();
        const channelList = Array.isArray(broadcastChannels) ? broadcastChannels : [];

        const platformChannel = channelList.find(
          (c: any) => c.type === 'platform' || /platform/i.test(c.name)
        );

        if (platformChannel) {
          let latestMessage = null;
          try {
            const messagesResult = await broadcasts.getMessages(platformChannel.id, 1);
            const msgs = (messagesResult as any)?.items || [];
            if (msgs.length > 0) {
              latestMessage = msgs[0];
            }
          } catch (e) {
            // Ignore
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

      const isArchived = (c: any) => c.isArchived === true || c.IsArchived === true;
      const activeConversations = conversationList.filter((c: any) => !isArchived(c));
      const archivedList = conversationList.filter((c: any) => isArchived(c));

      const sortedConversations = activeConversations.sort((a: Conversation, b: Conversation) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      const allConversations = platformChannelItem
        ? [platformChannelItem, ...sortedConversations]
        : sortedConversations;

      const activeId = currentState.activeConversationId;
      const finalConversations = (allConversations as Conversation[]).map((conv) => {
        if (conv.id === activeId) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      });

      set({
        conversations: finalConversations,
        archivedConversations: archivedList,
        isLoading: false,
        conversationsPage: 1,
        hasMoreConversations: hasMore,
      });
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      set({ error: error.message || 'Failed to fetch conversations', isLoading: false });
    }
  },

  fetchMoreConversations: async () => {
    const state = get();
    if (state.isLoadingMoreConversations || !state.hasMoreConversations || state.isLoading) {
      return;
    }

    const nextPage = state.conversationsPage + 1;
    set({ isLoadingMoreConversations: true });

    try {
      const conversations = getConversationsService();
      const result = await conversations.list({ page: nextPage, pageSize: 20 });
      const rawList = Array.isArray(result) ? result : (result as any).items || [];
      const totalCount = (result as any).totalCount || 0;

      if (rawList.length === 0) {
        set({ isLoadingMoreConversations: false, hasMoreConversations: false });
        return;
      }

      const currentState = get();
      const currentMessages = currentState.messages;
      const existingIds = new Set(currentState.conversations.map((c) => c.id));

      const newConversations = rawList
        .filter((conv: any) => !existingIds.has(conv.id))
        .filter((conv: any) => !(conv.isArchived === true || conv.IsArchived === true))
        .map((conv: any) => {
          const localMessages = currentMessages[conv.id] || [];
          const localLastMessage =
            localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

          let lastMessagePreview = '';
          if (localLastMessage) {
            lastMessagePreview = getMessagePreviewText(localLastMessage);
          } else if (conv.lastMessage) {
            lastMessagePreview = getMessagePreviewText(conv.lastMessage);
          }

          return {
            ...conv,
            avatarUrl: toAbsoluteUrl(conv.avatarUrl),
            lastMessagePreview,
            lastMessageAt: localLastMessage?.createdAt || conv.lastMessage?.createdAt || conv.lastMessageAt,
          };
        });

      const allLoaded = (currentState.conversations.length + newConversations.length) >= totalCount;

      set({
        conversations: [...currentState.conversations, ...newConversations],
        conversationsPage: nextPage,
        hasMoreConversations: newConversations.length > 0 && !allLoaded,
        isLoadingMoreConversations: false,
      });
    } catch (error: any) {
      console.error('Failed to fetch more conversations:', error);
      set({ isLoadingMoreConversations: false });
    }
  },

  fetchArchivedConversations: async () => {
    try {
      const conversations = getConversationsService();
      const result = await conversations.list();
      const rawList = Array.isArray(result) ? result : (result as any).items || [];

      const archivedList = rawList
        .filter((conv: any) => conv.isArchived === true || conv.IsArchived === true)
        .map((conv: any) => ({
          ...conv,
          avatarUrl: toAbsoluteUrl(conv.avatarUrl),
          lastMessagePreview: getMessagePreviewText(conv.lastMessage),
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
      const messagesService = getMessagesService();
      const result = await messagesService.list(conversationId, { limit: 50 });
      const rawMessageList = Array.isArray(result) ? result : (result as any).items || [];
      const hasMore = (result as any).hasMore ?? rawMessageList.length >= 50;

      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;

      const messageList = rawMessageList.map((msg: any) => {
        let status: MessageStatus | undefined;
        if (currentUser && msg.senderId === currentUser.id) {
          const backendStatus = msg.status || msg.Status;
          if (backendStatus) {
            const statusLower = backendStatus.toLowerCase();
            if (statusLower === 'read' || statusLower === 'seen') {
              status = 'read';
            } else if (statusLower === 'delivered') {
              status = 'delivered';
            } else if (statusLower === 'sent') {
              status = 'sent';
            } else if (statusLower === 'viewed') {
              status = 'viewed';
            } else if (statusLower === 'played') {
              status = 'played';
            } else {
              status = 'sent';
            }
          } else {
            status = msg.isRead || msg.IsRead ? 'read' : 'delivered';
          }
        }

        return {
          ...msg,
          status,
          attachments: msg.attachments || [],
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

      const lastMsg = messageList.length > 0 ? messageList[messageList.length - 1] : null;
      const lastMsgPreview = lastMsg ? getMessagePreviewText(lastMsg) : '';

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
        conversations: state.conversations.map((c) => {
          if (c.id !== conversationId) return c;
          const updates: Partial<typeof c> = {};
          if (isActive) updates.unreadCount = 0;
          if (refresh && lastMsg) {
            updates.lastMessagePreview = lastMsgPreview;
            updates.lastMessageAt = lastMsg.createdAt;
          } else if (refresh && !lastMsg) {
            updates.lastMessagePreview = '';
          }
          return { ...c, ...updates };
        }),
        isLoading: false,
      }));

      if (isActive && messageList.length > 0) {
        const lastMessage = messageList[messageList.length - 1];
        const conversations = getConversationsService();
        conversations.markAsRead(conversationId, lastMessage.id).catch((err: any) => {
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

    if (state.isLoadingMore) return;
    if (state.hasMoreMessages[conversationId] === false) return;

    const existingMessages = state.messages[conversationId] || [];
    if (existingMessages.length === 0) return;

    const oldestMessage = existingMessages[0];
    set({ isLoadingMore: true });

    try {
      const messagesService = getMessagesService();
      const result = await messagesService.list(conversationId, {
        limit: 30,
        before: oldestMessage.id,
      });
      const rawMessageList = Array.isArray(result) ? result : (result as any).items || [];
      const hasMore = (result as any).hasMore ?? rawMessageList.length >= 50;

      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;

      const messageList = rawMessageList.map((msg: any) => {
        let status: MessageStatus | undefined;
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
        const existingIds = new Set(existingMessages.map((m) => m.id));
        const newMessages = messageList.filter((m: Message) => !existingIds.has(m.id));

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
    const currentMessages = get().messages[channelId];
    const isInitialFetch = !currentMessages || currentMessages.length === 0;
    if (isInitialFetch) {
      set({ isLoading: true, error: null });
    }

    try {
      const broadcasts = getBroadcastsService();
      const result = await broadcasts.getMessages(channelId, 50);
      const messageList = Array.isArray(result) ? result : (result as any)?.items || [];

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
        imageUrl: msg.imageUrl || null,
        attachments: msg.imageUrl ? [{ url: msg.imageUrl, type: 'image' }] : [],
        reactions: [],
      }));

      const latestMessage =
        normalizedMessages.length > 0
          ? normalizedMessages.reduce((latest: any, msg: any) =>
              new Date(msg.createdAt) > new Date(latest.createdAt) ? msg : latest
            )
          : null;

      const currentMessageCount = normalizedMessages.length;

      set((state) => {
        const isViewingChannel = state.activeConversationId === channelId;
        let unreadCount = 0;
        let newSeenCount = state.platformChannelSeenCount;

        if (isViewingChannel) {
          unreadCount = 0;
          newSeenCount = currentMessageCount;
        } else {
          unreadCount = Math.max(0, currentMessageCount - state.platformChannelSeenCount);
        }

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
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const { useAuthStore } = require('./authStore');
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) {
      console.error('Cannot send message: No user logged in');
      return false;
    }

    let messageType = 'Text';
    let previewText = content;
    if (attachments && attachments.length > 0) {
      const attachType = attachments[0].type?.toLowerCase() || '';
      if (attachType === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachments[0].url || '')) {
        messageType = 'Image';
        previewText = isViewOnce ? '🔒 View once photo' : content || '📷 Photo';
      } else if (attachType === 'video' || /\.(mp4|mov|webm)$/i.test(attachments[0].url || '')) {
        messageType = 'Video';
        previewText = isViewOnce ? '🔒 View once video' : content || '🎬 Video';
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

    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage],
      },
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessageAt: now, lastMessagePreview: previewText }
          : c
      ),
    }));

    try {
      const hasAttachments = attachments && attachments.length > 0;
      const hasAttachmentIds = hasAttachments && attachments.some((att: any) => att.id);

      const requestBody: any = {
        content: content || '',
        type: messageType,
      };

      if (isViewOnce) {
        requestBody.IsViewOnce = true;
      }

      if (replyToId) {
        requestBody.replyToMessageId = replyToId;
      }

      if (hasAttachmentIds) {
        requestBody.attachmentIds = attachments
          .filter((att: any) => att.id)
          .map((att: any) => att.id);
      }

      const messagesService = getMessagesService();
      const response = await messagesService.send(conversationId, requestBody);

      const realMessageId =
        (response as any)?.id || (response as any)?.messageId || (response as any)?.MessageId;

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
      const conversations = getConversationsService();
      const conversation = await conversations.createDM({ userId });
      set((state) => ({
        conversations: [conversation as Conversation, ...state.conversations],
      }));
      return conversation as Conversation;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to create conversation';
      set({ error: errMsg });
      return null;
    }
  },

  createGroupConversation: async (name, userIds) => {
    try {
      const conversations = getConversationsService();
      const conversation = await conversations.createChatroom({ name, participantIds: userIds });
      set((state) => ({
        conversations: [conversation as Conversation, ...state.conversations],
      }));
      return conversation as Conversation;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to create group';
      set({ error: errMsg });
      return null;
    }
  },

  markAsRead: async (conversationId, messageId) => {
    try {
      const conversations = getConversationsService();
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
      const token = getAccessTokenFn();

      const response = await fetch(
        `${config.API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/view-once`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.log('[ChatStore] View-once API returned:', response.status);
      }
    } catch (error) {
      console.error('Failed to mark view-once as viewed:', error);
    }
  },

  deleteMessage: async (conversationId, messageId, forEveryone = false) => {
    try {
      const messagesService = getMessagesService();
      await messagesService.delete(conversationId, messageId, forEveryone);

      set((state) => {
        const remainingMessages = (state.messages[conversationId] || []).filter(
          (m) => m.id !== messageId
        );

        const newLastMessage =
          remainingMessages.length > 0 ? remainingMessages[remainingMessages.length - 1] : null;

        const newPreview = newLastMessage ? getMessagePreviewText(newLastMessage) : '';
        const newLastMessageAt: string | undefined = newLastMessage?.createdAt;

        return {
          messages: {
            ...state.messages,
            [conversationId]: remainingMessages,
          },
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

      await get().fetchMessages(conversationId, true);
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete message' });
    }
  },

  editMessage: async (conversationId, messageId, content) => {
    try {
      const messagesService = getMessagesService();
      await messagesService.edit(conversationId, messageId, { content });
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
      if (conversationMessages.some((m) => m.id === message.id)) {
        return state;
      }

      const previewText = getMessagePreviewText(message);

      const { useAuthStore } = require('./authStore');
      const currentUser = useAuthStore.getState().user;
      const isFromOther = message.senderId !== currentUser?.id;
      const isSystemMsg = (message.type?.toLowerCase() || 'text') === 'system';

      const shouldIncrementUnread =
        isFromOther && state.activeConversationId !== message.conversationId && !isSystemMsg;

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
      const convMessages =
        state.messages[conversationId] || state.messages[normalizedConversationId] || [];
      const actualConvId = state.messages[conversationId]
        ? conversationId
        : normalizedConversationId;

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
    const normalizedMessageId = messageId?.toLowerCase();
    const normalizedConversationId = conversationId?.toLowerCase();

    set((state) => {
      const convMessages =
        state.messages[conversationId] || state.messages[normalizedConversationId] || [];
      const actualConvId = state.messages[conversationId]
        ? conversationId
        : normalizedConversationId;

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
      if (conversation.isArchived === true) {
        const convToArchive = state.conversations.find((c) => c.id === conversation.id);
        if (convToArchive) {
          return {
            conversations: state.conversations.filter((c) => c.id !== conversation.id),
            archivedConversations: [
              { ...convToArchive, ...conversation },
              ...state.archivedConversations,
            ],
          };
        }
      } else if (conversation.isArchived === false) {
        const convToUnarchive = state.archivedConversations.find((c) => c.id === conversation.id);
        if (convToUnarchive) {
          const updatedConv = { ...convToUnarchive, ...conversation };
          const platformChannel = state.conversations.find((c) => (c as any).isPlatformChannel);
          const otherConvs = state.conversations.filter((c) => !(c as any).isPlatformChannel);

          const newConvs = [...otherConvs, updatedConv].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          });

          return {
            conversations: platformChannel ? [platformChannel, ...newConvs] : newConvs,
            archivedConversations: state.archivedConversations.filter(
              (c) => c.id !== conversation.id
            ),
          };
        }
      }

      if (conversation.isPinned !== undefined) {
        const updatedConvs = state.conversations.map((c) =>
          c.id === conversation.id ? { ...c, ...conversation } : c
        );

        const platformChannel = updatedConvs.find((c) => (c as any).isPlatformChannel);
        const otherConvs = updatedConvs.filter((c) => !(c as any).isPlatformChannel);

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
      set({ activeConversationId: null });
      return;
    }

    const conversation = state.conversations.find((c) => c.id === conversationId);
    const isPlatformChannel =
      conversation &&
      ((conversation as any).isPlatformChannel === true ||
        (conversation as any).type === 'BroadcastChannel');

    if (isPlatformChannel) {
      const currentMessages = state.messages[conversationId] || [];
      set({
        activeConversationId: conversationId,
        platformChannelSeenCount: currentMessages.length,
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      });
    } else {
      const currentMessages = state.messages[conversationId] || [];
      const lastMessage =
        currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;

      set({
        activeConversationId: conversationId,
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      });

      if (lastMessage) {
        const conversations = getConversationsService();
        conversations.markAsRead(conversationId, lastMessage.id).catch((err: any) => {
          console.log('Failed to mark as read:', err);
        });
      }
    }
  },

  addTypingUser: (conversationId, userId, name) => {
    set((state) => {
      const exists = state.typingUsers.some(
        (u) => u.conversationId === conversationId && u.userId === userId
      );
      if (exists) return state;

      return {
        typingUsers: [...state.typingUsers, { conversationId, userId, name }],
      };
    });

    setTimeout(() => {
      get().removeTypingUser(conversationId, userId);
    }, 3000);
  },

  removeTypingUser: (conversationId, userId) => {
    set((state) => ({
      typingUsers: state.typingUsers.filter(
        (u) => !(u.conversationId === conversationId && u.userId === userId)
      ),
    }));
  },

  addRecordingUser: (conversationId, userId, name) => {
    set((state) => {
      const exists = state.recordingUsers.some(
        (u) => u.conversationId === conversationId && u.userId === userId
      );
      if (exists) return state;

      return {
        recordingUsers: [...state.recordingUsers, { conversationId, userId, name }],
      };
    });

    setTimeout(() => {
      get().removeRecordingUser(conversationId, userId);
    }, 30000);
  },

  removeRecordingUser: (conversationId, userId) => {
    set((state) => ({
      recordingUsers: state.recordingUsers.filter(
        (u) => !(u.conversationId === conversationId && u.userId === userId)
      ),
    }));
  },

  incrementUnreadCount: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c
      ),
    }));
  },

  updateMessageViewOnce: (messageId, viewedAt) => {
    const normalizedMessageId = messageId?.toLowerCase();

    set((state) => {
      const updatedMessages: Record<string, Message[]> = {};

      for (const [convId, msgs] of Object.entries(state.messages)) {
        const updated = msgs.map((m) =>
          m.id?.toLowerCase() === normalizedMessageId ? { ...m, viewOnceViewedAt: viewedAt } : m
        );
        updatedMessages[convId] = updated;
      }

      return { messages: updatedMessages };
    });
  },

  updateConversationMuteStatus: (conversationId, isMuted, mutedUntil) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, isMuted, mutedUntil } : c
      ),
    }));
  },

  removeConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([id]) => id !== conversationId)
      ),
    }));
  },

  updateParticipantRole: (conversationId, userId, newRole) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        const updatedParticipants = c.participants?.map((p) =>
          p.userId === userId ? { ...p, role: newRole } : p
        );

        return { ...c, participants: updatedParticipants };
      }),
    }));
  },

  updateDisappearingMessages: (conversationId, duration) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, disappearingMessagesDuration: duration } : c
      ),
    }));
  },
}));

// Default export for compatibility
export default useChatStore;
