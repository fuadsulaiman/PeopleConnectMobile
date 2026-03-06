// User types
export interface User {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  status?: 'online' | 'away' | 'busy' | 'offline' | 'Online' | 'Away' | 'Busy' | 'Offline';
  statusMessage?: string;
  lastSeen?: string;
  createdAt?: string;
}

// Auth types
export interface LoginRequest {
  username?: string;
  password: string;
}

export interface RegisterRequest {
  name?: string;
  username?: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

// Conversation types
export type ConversationType = 'DirectMessage' | 'Chatroom' | 'BroadcastChannel';

export interface ConversationUser {
  id: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  status?: 'Online' | 'Away' | 'Busy' | 'Offline';
}

export interface Participant {
  userId: string;
  user: ConversationUser;
  role: 'Owner' | 'Admin' | 'Member';
  joinedAt: string;
  isDeleted?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  participantCount?: number;
  lastMessage?: Message;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  isMuted?: boolean;
  mutedUntil?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  createdAt?: string;
  participants?: Participant[];
  // For DirectMessage: the other participant's user ID
  otherUserId?: string;
  // Broadcast channel specific
  isBroadcast?: boolean;
  isPlatformChannel?: boolean;
  subscriberCount?: number;
  disappearingMessagesDuration?: string;
}

// Message types
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'system'
  | 'Text'
  | 'Image'
  | 'Video'
  | 'Audio'
  | 'File'
  | 'System'
  | 'Location'
  | 'VoiceCall'
  | 'VideoCall';
export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'Sent'
  | 'Delivered'
  | 'Read'
  | 'Deleted'
  | 'Flagged';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  content: string;
  type: MessageType;
  status: MessageStatus;
  attachments: Attachment[];
  reactions: Reaction[];
  replyTo?: Message;
  replyToId?: string;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: { userId: string; user?: User }[];
  hasReacted: boolean;
}

// Contact types
export interface Contact {
  id: string;
  userId?: string;
  user: User;
  contactUser?: User;
  nickname?: string;
  createdAt?: string;
  status?: 'Pending' | 'Accepted' | 'Rejected' | 'Blocked';
}

export interface ContactRequest {
  id: string;
  fromUser: User;
  toUser: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// Call types
export type CallType = 'voice' | 'video';
export type CallStatus =
  | 'ringing'
  | 'connected'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'failed'
  | 'completed';

export interface Call {
  id: string;
  conversationId?: string;
  conversationName?: string;
  callerId?: string;
  calleeId?: string;
  caller?: User;
  callee?: User;
  type: CallType;
  status: CallStatus;
  direction?: 'incoming' | 'outgoing';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  participants?: CallParticipant[];
}

export interface CallParticipant {
  userId: string;
  user?: User;
  joinedAt: string;
  leftAt?: string;
}

// Notification types
export type NotificationType = 'message' | 'call' | 'contact' | 'system' | 'announcement';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

// Search User type
export interface SearchUser {
  id: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  status?: string;
}
