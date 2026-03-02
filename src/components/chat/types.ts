// Chat component shared types

export interface ThemeColors {
  primary: string;
  text: string;
  textSecondary: string;
  background: string;
  surface: string;
  border: string;
  white: string;
  error: string;
  success: string;
  warning: string;
  online: string;
  messageBubbleOwn: string;
  messageBubbleOther: string;
  messageTextOwn: string;
  messageTextOther: string;
  gray: {
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

export interface EditingSettings {
  allowEditing: boolean;
  editTimeLimitMinutes: number;
  showEditHistory: boolean;
}

export interface DeletionSettings {
  timeLimitMinutes: number;
  deleteForMeAlwaysAllowed: boolean;
  showDeleteConfirmation: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: { userId: string }[];
  hasReacted: boolean;
}

export interface AttachmentData {
  id: string;
  url: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
}

export interface MediaInfo {
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  thumbnailUrl: string | null;
  fileName: string | null;
  duration: number | null;
}

export interface TypingUser {
  userId: string;
  userName?: string;
}

export interface RecordingUser {
  userId: string;
  userName?: string;
}

export interface ForwardTarget {
  id: string;
  type: 'conversation' | 'user';
  name: string;
  username?: string;
  avatarUrl?: string;
  conversationType?: string;
}
