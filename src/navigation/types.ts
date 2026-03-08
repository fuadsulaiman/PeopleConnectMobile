import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { User, Conversation, Call, CallType } from '../types';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  TwoFactor: { tempToken: string };
  ResetPassword: { token?: string };
  VerifyEmail: { token?: string; email?: string };
};

// Chat Stack
export type ChatStackParamList = {
  Conversations: undefined;
  Chat: { conversationId: string; conversation?: Conversation };
  NewChat: undefined;
  ArchivedConversations: undefined;
  UserProfile: {
    userId: string;
    userName?: string;
    userAvatar?: string;
    username?: string;
  };
};

// Contacts Stack
export type ContactsStackParamList = {
  ContactsList: undefined;
  AddContact: undefined;
};

// Calls Stack
export type CallsStackParamList = {
  CallHistory: undefined;
  Call: { call?: Call; user?: User; type?: CallType; isIncoming?: boolean };
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  TwoFactorSettings: undefined;
  PrivacySettings: undefined;
  NotificationSettings: undefined;
  Devices: undefined;
  DataExport: undefined;
  Notifications: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  ContactsTab: NavigatorScreenParams<ContactsStackParamList>;
  CallsTab: NavigatorScreenParams<CallsStackParamList>;
  BroadcastsTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  ActiveCall: { call?: Call; user?: User; type?: CallType; isIncoming?: boolean };
  GroupCall: { conversationId: string; conversationName?: string; type: CallType; isJoining?: boolean };
  Notifications: undefined;
};

// Screen Props Types
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ForgotPassword'
>;
export type TwoFactorScreenProps = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;
export type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;
export type VerifyEmailScreenProps = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export type ConversationsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ChatStackParamList, 'Conversations'>,
  BottomTabScreenProps<MainTabParamList>
>;

export type ChatScreenProps = NativeStackScreenProps<ChatStackParamList, 'Chat'>;
export type NewChatScreenProps = NativeStackScreenProps<ChatStackParamList, 'NewChat'>;
export type UserProfileScreenProps = NativeStackScreenProps<ChatStackParamList, 'UserProfile'>;

export type ContactsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>,
  BottomTabScreenProps<MainTabParamList>
>;
export type AddContactScreenProps = NativeStackScreenProps<ContactsStackParamList, 'AddContact'>;

export type CallHistoryScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CallsStackParamList, 'CallHistory'>,
  BottomTabScreenProps<MainTabParamList>
>;
export type CallScreenProps = NativeStackScreenProps<CallsStackParamList, 'Call'>;

export type ProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Profile'>,
  BottomTabScreenProps<MainTabParamList>
>;
export type EditProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;
export type SettingsScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;
export type ChangePasswordScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  'ChangePassword'
>;
export type TwoFactorSettingsScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  'TwoFactorSettings'
>;
export type PrivacySettingsScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  'PrivacySettings'
>;
export type NotificationSettingsScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  'NotificationSettings'
>;

export type GroupCallScreenProps = NativeStackScreenProps<RootStackParamList, 'GroupCall'>;
export type NotificationsScreenProps = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

// Global Search Screen (from Root or Main)
export type GlobalSearchScreenProps = CompositeScreenProps<
  NativeStackScreenProps<RootStackParamList, 'Notifications'>,
  BottomTabScreenProps<MainTabParamList>
>;
