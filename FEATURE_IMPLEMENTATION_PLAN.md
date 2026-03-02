# PeopleConnect Mobile - Feature Implementation Plan

**Version:** 1.0
**Last Updated:** March 2, 2026
**Document Owner:** Architecture Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Implementation Status](#2-current-implementation-status)
3. [Phase 1: Must Have Features](#3-phase-1-must-have-features)
4. [Phase 2: Should Have Features](#4-phase-2-should-have-features)
5. [Phase 3: Could Have Features](#5-phase-3-could-have-features)
6. [Feature Dependency Matrix](#6-feature-dependency-matrix)
7. [Implementation Timeline](#7-implementation-timeline)

---

## 1. Executive Summary

### 1.1 Overview

This document provides a comprehensive implementation plan for all 75+ features required for the PeopleConnect Mobile application. Features are categorized by priority and grouped into three implementation phases.

### 1.2 Feature Count Summary

| Phase | Priority | Features | Implemented | Remaining |
|-------|----------|----------|-------------|-----------|
| Phase 1 | Must Have | 35 | 28 | 7 |
| Phase 2 | Should Have | 25 | 8 | 17 |
| Phase 3 | Could Have | 17 | 2 | 15 |
| **Total** | | **77** | **38** | **39** |

### 1.3 Current Codebase Statistics

| Metric | Count |
|--------|-------|
| Total TSX Files | ~25 |
| Total Lines of Code | ~11,346 |
| Screens Implemented | 15 |
| Stores Implemented | 7 |
| Services Implemented | 2 (SDK, SignalR) |

---

## 2. Current Implementation Status

### 2.1 Implemented Screens

| Screen | File | Status | Notes |
|--------|------|--------|-------|
| LoginScreen | auth/LoginScreen.tsx | Complete | 2FA support |
| RegisterScreen | auth/RegisterScreen.tsx | Complete | |
| TwoFactorScreen | auth/TwoFactorScreen.tsx | Complete | |
| ForgotPasswordScreen | auth/ForgotPasswordScreen.tsx | Complete | |
| ConversationsScreen | chat/ConversationsScreen.tsx | Complete | ~21KB |
| ChatScreen | chat/ChatScreen.tsx | Complete | ~134KB (needs refactoring) |
| NewChatScreen | chat/NewChatScreen.tsx | Complete | |
| ArchivedConversationsScreen | chat/ArchivedConversationsScreen.tsx | Complete | |
| UserProfileScreen | chat/UserProfileScreen.tsx | Complete | Block/unblock support |
| ContactsScreen | contacts/ContactsScreen.tsx | Complete | |
| AddContactScreen | contacts/AddContactScreen.tsx | Complete | |
| CallHistoryScreen | calls/CallHistoryScreen.tsx | Partial | UI only |
| CallScreen | calls/CallScreen.tsx | Partial | Basic UI |
| ProfileScreen | profile/ProfileScreen.tsx | Complete | |
| EditProfileScreen | profile/EditProfileScreen.tsx | Complete | |
| SettingsScreen | settings/SettingsScreen.tsx | Partial | Basic settings |

### 2.2 Implemented Stores

| Store | Status | Key Features |
|-------|--------|--------------|
| authStore | Complete | Login, register, 2FA, logout, session handling |
| chatStore | Complete | Conversations, messages, typing, reactions |
| callStore | Partial | Basic call state, needs WebRTC integration |
| contactsStore | Complete | Contacts, requests, blocking |
| presenceStore | Complete | Online status, last seen |
| settingsStore | Complete | Public settings from backend |
| themeStore | Complete | Dynamic color profiles |

### 2.3 Implemented Services

| Service | Status | Key Features |
|---------|--------|--------------|
| sdk.ts | Complete | SDK wrapper, token management |
| signalr.ts | Complete | Chat, presence, call hubs |

### 2.4 Missing Components (To Be Implemented)

| Component | Priority | Purpose |
|-----------|----------|---------|
| WebRTCService | High | 1:1 voice/video calls |
| GroupCallScreen | High | LiveKit group calls |
| BroadcastsScreen | Medium | Broadcast channels |
| NotificationsScreen | Medium | In-app notifications |
| SearchScreen | Medium | Global search |
| VoiceRecorder | Low | Voice message recording |
| LocationPicker | Low | Location sharing |

---

## 3. Phase 1: Must Have Features

### 3.1 Authentication Features (8 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| AUTH-001 | User Login | `auth.login()` | LoginScreen | DONE | S |
| AUTH-002 | Two-Factor Auth | `auth.verify2FA()` | TwoFactorScreen | DONE | M |
| AUTH-003 | Registration | `auth.register()` | RegisterScreen | DONE | S |
| AUTH-004 | Invitation Mode | `auth.register()` | RegisterScreen | DONE | S |
| AUTH-005 | Forgot Password | `auth.forgotPassword()` | ForgotPasswordScreen | DONE | S |
| AUTH-006 | Session Management | `auth.logout()` | authStore | DONE | M |
| AUTH-007 | Token Refresh | SDK auto-refresh | sdk.ts | DONE | M |
| AUTH-008 | Warning Display | Login response | LoginScreen | TODO | S |

**AUTH-008 Implementation:**
```typescript
// Components: LoginScreen.tsx
// SDK: Already returned in LoginResponse.activeWarnings
// State: Add warningsModalVisible state
// UI: Modal showing warning messages before proceeding
```

### 3.2 Messaging Features (16 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| MSG-001 | Text Messages | SignalR `SendMessage` | ChatScreen | DONE | M |
| MSG-002 | Media Messages | `media.upload()` | ChatScreen, MediaViewer | DONE | L |
| MSG-003 | Voice Messages | `media.uploadVoice()` | VoiceRecorder | PARTIAL | M |
| MSG-004 | File Attachments | `media.upload()` | ChatScreen | DONE | M |
| MSG-005 | Message Reactions | `messages.react()` | ReactionPicker | DONE | M |
| MSG-006 | Reply to Message | SignalR (replyToMessageId) | ChatScreen | DONE | M |
| MSG-007 | Forward Messages | `messages.forward()` | ForwardModal | DONE | M |
| MSG-008 | Edit Messages | `messages.edit()` | EditModal | DONE | M |
| MSG-009 | Delete Messages | `messages.delete()` | ChatScreen | DONE | M |
| MSG-010 | View-Once Messages | `messages.markViewOnce()` | ChatScreen | DONE | L |
| MSG-011 | Disappearing Messages | `conversations.setDisappearing()` | ChatroomSettings | DONE | M |
| MSG-012 | Link Previews | Settings check | ChatScreen | TODO | M |
| MSG-013 | Location Sharing | `media.upload()` | LocationPicker | TODO | L |
| MSG-014 | Contact Sharing | Custom format | ContactPicker | TODO | M |
| MSG-015 | Message Search | `search.inConversation()` | SearchInChat | TODO | M |
| MSG-016 | Edit History | `messages.getEditHistory()` | EditHistoryModal | TODO | S |

**MSG-012 Implementation:**
```typescript
// Components: LinkPreview.tsx (new)
// SDK: None (client-side URL detection)
// Libraries: react-native-link-preview
// Logic: Detect URLs in message content, fetch metadata
```

**MSG-013 Implementation:**
```typescript
// Components: LocationPicker.tsx (new)
// SDK: media.upload() for location image
// Libraries: react-native-maps, react-native-geolocation-service
// Format: { type: 'Location', content: JSON.stringify({ lat, lng, address }) }
```

**MSG-015 Implementation:**
```typescript
// Components: SearchInChat.tsx (new)
// SDK: search.inConversation(conversationId, query)
// UI: Search bar in chat header, highlight matching messages
```

### 3.3 Conversation Features (10 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| CONV-001 | Direct Messages | `conversations.createDM()` | NewChatScreen | DONE | M |
| CONV-002 | Chatrooms | `conversations.createChatroom()` | NewChatScreen | DONE | M |
| CONV-003 | Create Chatroom | `conversations.createChatroom()` | NewChatScreen | DONE | M |
| CONV-004 | Chatroom Settings | `conversations.update()` | ChatroomSettings | DONE | L |
| CONV-005 | Add Participants | `conversations.addParticipants()` | ChatroomSettings | DONE | M |
| CONV-006 | Remove Participants | `conversations.removeParticipant()` | ChatroomSettings | DONE | M |
| CONV-007 | Role Management | `conversations.updateParticipantRole()` | ChatroomSettings | DONE | M |
| CONV-008 | Pin Conversations | `conversations.pin()` | ConversationsScreen | DONE | S |
| CONV-009 | Mute Conversations | `conversations.mute()` | ConversationsScreen | DONE | S |
| CONV-010 | Archive Conversations | `conversations.archive()` | ConversationsScreen | DONE | S |

### 3.4 Contact Features (5 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| CONT-001 | View Contacts | `contacts.list()` | ContactsScreen | DONE | M |
| CONT-002 | Add Contact | `contacts.add()` | AddContactScreen | DONE | M |
| CONT-003 | Accept/Reject | `contacts.accept()`, `reject()` | ContactsScreen | DONE | S |
| CONT-004 | Remove Contact | `contacts.remove()` | ContactsScreen | DONE | S |
| CONT-005 | Block User | `contacts.block()` | UserProfileScreen | DONE | S |

---

## 4. Phase 2: Should Have Features

### 4.1 Call Features (10 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| CALL-001 | Voice Calls (1:1) | SignalR CallHub, WebRTC | CallScreen, WebRTCService | TODO | XL |
| CALL-002 | Video Calls (1:1) | SignalR CallHub, WebRTC | CallScreen, WebRTCService | TODO | XL |
| CALL-003 | Group Video Calls | `calls.getLiveKitToken()` | GroupCallScreen | TODO | XL |
| CALL-004 | Screen Sharing | LiveKit API | GroupCallScreen | TODO | L |
| CALL-005 | Call Recording | `calls.uploadRecording()` | CallScreen | TODO | L |
| CALL-006 | Mute/Unmute | WebRTC track control | CallControls | PARTIAL | S |
| CALL-007 | Camera Toggle | WebRTC track control | CallControls | PARTIAL | S |
| CALL-008 | Call History | `calls.getHistory()` | CallHistoryScreen | DONE | M |
| CALL-009 | Incoming Call UI | SignalR `CallReceived` | IncomingCallModal | PARTIAL | M |
| CALL-010 | Recording Indicator | SignalR `RecordingStatus` | CallScreen | TODO | S |

**CALL-001/002 Implementation:**
```typescript
// Components: CallScreen.tsx, WebRTCService.ts (new)
// SDK: calls.getIceServers(), SignalR for signaling
// Libraries: react-native-webrtc
// Flow:
// 1. Get ICE servers from backend
// 2. Create RTCPeerConnection
// 3. Get local media stream
// 4. Exchange SDP offer/answer via SignalR
// 5. Exchange ICE candidates
// 6. Handle remote stream
```

**CALL-003 Implementation:**
```typescript
// Components: GroupCallScreen.tsx (new)
// SDK: calls.getLiveKitToken(roomName)
// Libraries: @livekit/react-native
// Flow:
// 1. Get LiveKit token from backend
// 2. Connect to LiveKit room
// 3. Handle participants joining/leaving
// 4. Render participant grid
```

### 4.2 Profile Features (8 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| PROF-001 | View Profile | `users.getProfile()` | ProfileScreen | DONE | S |
| PROF-002 | Update Profile | `users.updateProfile()` | EditProfileScreen | DONE | M |
| PROF-003 | Upload Avatar | `users.uploadAvatar()` | EditProfileScreen | DONE | M |
| PROF-004 | Crop Avatar | react-native-image-crop-picker | ImageCropper | TODO | M |
| PROF-005 | Delete Avatar | `users.deleteAvatar()` | EditProfileScreen | DONE | S |
| PROF-006 | Change Password | `auth.changePassword()` | ChangePasswordScreen | TODO | M |
| PROF-007 | Enable 2FA | `twoFactor.setup()`, `enable()` | Setup2FAScreen | TODO | L |
| PROF-008 | Disable 2FA | `twoFactor.disable()` | ProfileScreen | TODO | S |

**PROF-006 Implementation:**
```typescript
// Components: ChangePasswordScreen.tsx (new)
// SDK: auth.changePassword({ currentPassword, newPassword })
// State: currentPassword, newPassword, confirmPassword
// Validation: Zod schema for password requirements
```

**PROF-007 Implementation:**
```typescript
// Components: Setup2FAScreen.tsx (new)
// SDK: twoFactor.setup(), twoFactor.enable(code)
// Libraries: react-native-svg (for QR code)
// Flow:
// 1. Call setup() to get QR code + secret
// 2. Display QR code for scanning
// 3. User enters code from authenticator
// 4. Call enable(code) to activate
// 5. Display backup codes
```

### 4.3 Privacy Features (5 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| PRIV-001 | Privacy Settings | `users.getPrivacySettings()` | PrivacySettingsScreen | TODO | M |
| PRIV-002 | Hide Online Status | `users.updatePrivacySettings()` | PrivacySettingsScreen | TODO | S |
| PRIV-003 | Disable Read Receipts | `users.updatePrivacySettings()` | PrivacySettingsScreen | TODO | S |
| PRIV-004 | Disable Typing Indicator | `users.updatePrivacySettings()` | PrivacySettingsScreen | TODO | S |
| PRIV-005 | Block List | `contacts.getBlocked()` | BlockedUsersScreen | TODO | M |

**PRIV-001 Implementation:**
```typescript
// Components: PrivacySettingsScreen.tsx (new)
// SDK: users.getPrivacySettings(), users.updatePrivacySettings()
// UI: Toggle switches for each privacy option
// Options: showOnlineStatus, showReadReceipts, showTypingIndicator, showLastSeen
```

### 4.4 Notification Features (2 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| NOTIF-001 | In-App Notifications | `notifications.list()` | NotificationsScreen | TODO | M |
| NOTIF-002 | Push Notifications | FCM/APNs | PushNotificationService | TODO | L |

**NOTIF-002 Implementation:**
```typescript
// Components: PushNotificationService.ts (new)
// SDK: devices.register(token, platform)
// Libraries: @react-native-firebase/messaging (Android), react-native-push-notification
// Flow:
// 1. Request push permission
// 2. Get FCM/APNs token
// 3. Register device with backend
// 4. Handle incoming notifications
// 5. Navigate on notification tap
```

---

## 5. Phase 3: Could Have Features

### 5.1 Search Features (4 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| SRCH-001 | Global Search | `search.global()` | GlobalSearchScreen | TODO | L |
| SRCH-002 | In-Conversation Search | `search.inConversation()` | SearchInChat | TODO | M |
| SRCH-003 | User Search | `contacts.search()` | AddContactScreen | DONE | S |
| SRCH-004 | Search Shortcuts | Keyboard shortcuts | N/A (mobile) | N/A | - |

**SRCH-001 Implementation:**
```typescript
// Components: GlobalSearchScreen.tsx (new)
// SDK: search.global(query)
// UI: Search input with tabs for Users/Conversations/Messages
// Features:
// - Real-time search as user types (debounced)
// - Filter by category
// - Navigate to result on tap
```

### 5.2 Broadcast Features (5 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| BCAST-001 | View Channels | `broadcasts.listChannels()` | BroadcastsScreen | TODO | M |
| BCAST-002 | Subscribe | `broadcasts.subscribe()` | BroadcastsScreen | TODO | S |
| BCAST-003 | Unsubscribe | `broadcasts.unsubscribe()` | BroadcastsScreen | TODO | S |
| BCAST-004 | View Messages | `broadcasts.getMessages()` | BroadcastChannelScreen | TODO | M |
| BCAST-005 | Message Feed | `broadcasts.getFeed()` | BroadcastFeedScreen | TODO | M |

**BCAST-001 Implementation:**
```typescript
// Components: BroadcastsScreen.tsx (new)
// SDK: broadcasts.listChannels(), broadcasts.getSubscribed()
// UI: Two tabs - All Channels, My Subscriptions
// Features:
// - Channel list with subscribe/unsubscribe buttons
// - Channel details on tap
// - Unread message count badges
```

### 5.3 Additional Features (8 features)

| ID | Feature | SDK Method | Components | Status | Complexity |
|----|---------|-----------|------------|--------|------------|
| ADD-001 | Announcements | `announcements.getActive()` | AnnouncementBanner | PARTIAL | S |
| ADD-002 | Platform Channel | Special broadcast | ConversationsScreen | DONE | S |
| ADD-003 | Language Switch | i18n | SettingsScreen | TODO | M |
| ADD-004 | RTL Support | StyleSheet | Global | TODO | M |
| ADD-005 | Dark Mode | themeStore | Global | DONE | M |
| ADD-006 | Report User | `reports.submit()` | ReportModal | TODO | M |
| ADD-007 | Report Message | `reports.submit()` | ReportModal | TODO | M |
| ADD-008 | Report History | `reports.getHistory()` | ReportHistoryScreen | TODO | S |

**ADD-003 Implementation:**
```typescript
// Components: LanguageSelector in SettingsScreen
// Libraries: i18next, react-i18next
// Files:
// - src/i18n/locales/en.json
// - src/i18n/locales/ar.json
// - src/i18n/index.ts (configuration)
// Features:
// - Language picker (English, Arabic)
// - Persist selection in MMKV
// - Reload app or update context
```

**ADD-006/007 Implementation:**
```typescript
// Components: ReportModal.tsx (new)
// SDK: reports.submit({ type, targetId, reason, details })
// UI: Modal with:
// - Report type (spam, harassment, inappropriate, etc.)
// - Details text input
// - Submit button
```

---

## 6. Feature Dependency Matrix

### 6.1 Critical Dependencies

```
AUTH-001 (Login)
    |
    +---> All authenticated features
    |
    +---> SignalR Connection
             |
             +---> Real-time messaging (MSG-001 to MSG-016)
             +---> Typing indicators
             +---> Presence updates
             +---> Call signaling (CALL-001 to CALL-003)
```

### 6.2 Feature Dependencies

| Feature | Depends On | Required By |
|---------|-----------|-------------|
| AUTH-001 Login | - | All features |
| AUTH-002 2FA | AUTH-001 | - |
| MSG-001 Text Messages | AUTH-001, SignalR | MSG-005 to MSG-016 |
| MSG-002 Media Messages | MSG-001, media.upload() | MSG-010 View-Once |
| CALL-001 Voice Calls | AUTH-001, SignalR, WebRTC | CALL-005 to CALL-010 |
| CALL-003 Group Calls | AUTH-001, LiveKit | CALL-004 Screen Share |
| CONV-002 Chatrooms | AUTH-001 | CONV-003 to CONV-007, MSG-011 |
| CONT-001 View Contacts | AUTH-001 | CONT-002 to CONT-005 |
| PROF-007 Enable 2FA | AUTH-001 | - |
| BCAST-001 View Channels | AUTH-001 | BCAST-002 to BCAST-005 |

### 6.3 Technical Dependencies

| Feature | Required Libraries |
|---------|-------------------|
| CALL-001/002 WebRTC Calls | react-native-webrtc |
| CALL-003 Group Calls | @livekit/react-native |
| MSG-013 Location Sharing | react-native-maps, react-native-geolocation |
| PROF-004 Image Crop | react-native-image-crop-picker |
| NOTIF-002 Push Notifications | @react-native-firebase/messaging |
| ADD-003 i18n | i18next, react-i18next |

---

## 7. Implementation Timeline

### 7.1 Phase 1 Timeline (Weeks 1-4)

**Week 1: Complete Remaining Must-Have Messaging**
- MSG-012: Link Previews
- MSG-015: Message Search in Conversation
- MSG-016: Edit History Modal

**Week 2: Location and Contact Sharing**
- MSG-013: Location Sharing (LocationPicker component)
- MSG-014: Contact Sharing (ContactPicker component)

**Week 3: Auth Completion**
- AUTH-008: Warning Display on Login

**Week 4: Testing and Bug Fixes**
- Integration testing for all Phase 1 features
- Performance optimization for ChatScreen

### 7.2 Phase 2 Timeline (Weeks 5-12)

**Weeks 5-6: WebRTC Integration**
- CALL-001: Voice Calls (WebRTCService)
- CALL-002: Video Calls
- CALL-006: Mute/Unmute
- CALL-007: Camera Toggle
- CALL-009: Incoming Call UI improvements

**Weeks 7-8: LiveKit Group Calls**
- CALL-003: Group Video Calls (GroupCallScreen)
- CALL-004: Screen Sharing
- CALL-010: Recording Indicator

**Week 9: Call Recording**
- CALL-005: Call Recording feature

**Week 10: Profile Features**
- PROF-004: Image Crop
- PROF-006: Change Password
- PROF-007: Enable 2FA
- PROF-008: Disable 2FA

**Week 11: Privacy Features**
- PRIV-001: Privacy Settings Screen
- PRIV-002 to PRIV-004: Privacy toggles
- PRIV-005: Block List

**Week 12: Notifications**
- NOTIF-001: In-App Notifications
- NOTIF-002: Push Notifications

### 7.3 Phase 3 Timeline (Weeks 13-16)

**Week 13: Search Features**
- SRCH-001: Global Search
- SRCH-002: In-Conversation Search

**Week 14: Broadcast Features**
- BCAST-001: View Channels
- BCAST-002/003: Subscribe/Unsubscribe
- BCAST-004: View Messages
- BCAST-005: Message Feed

**Week 15: Additional Features**
- ADD-001: Announcements Banner
- ADD-003: Language Switch (i18n)
- ADD-004: RTL Support

**Week 16: Reporting and Polish**
- ADD-006: Report User
- ADD-007: Report Message
- ADD-008: Report History
- Final testing and bug fixes

### 7.4 Complexity Estimation Guide

| Size | Hours | Description |
|------|-------|-------------|
| S (Small) | 2-4 | Simple UI, single SDK call, minimal state |
| M (Medium) | 4-8 | Multiple components, moderate state management |
| L (Large) | 8-16 | Complex UI, multiple API calls, significant state |
| XL (Extra Large) | 16-32 | New services, native modules, complex integration |

### 7.5 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WebRTC complexity | Use react-native-webrtc examples, test early |
| LiveKit integration | Follow LiveKit React Native docs carefully |
| Push notification setup | Plan for both iOS and Android separately |
| Large ChatScreen file | Refactor into smaller components early |
| Performance issues | Profile early, use FlatList optimization |

---

## Appendix A: SDK Method Reference

### Authentication
```typescript
auth.login({ username, password })
auth.register({ name, username, password, email?, invitationCode? })
auth.logout()
auth.forgotPassword(email)
auth.resetPassword({ token, newPassword })
auth.changePassword({ currentPassword, newPassword })
auth.verify2FA({ tempToken, code })
auth.getCurrentUser()
```

### Users
```typescript
users.getProfile(userId)
users.updateProfile({ name?, bio?, statusMessage? })
users.uploadAvatar(file)
users.deleteAvatar()
users.getPrivacySettings()
users.updatePrivacySettings({ showOnlineStatus?, showReadReceipts?, ... })
```

### Conversations
```typescript
conversations.list()
conversations.get(conversationId)
conversations.createDM(userId)
conversations.createChatroom({ name, participantIds })
conversations.update(conversationId, { name?, description? })
conversations.delete(conversationId)
conversations.leave(conversationId)
conversations.addParticipants(conversationId, userIds)
conversations.removeParticipant(conversationId, userId)
conversations.updateParticipantRole(conversationId, userId, role)
conversations.pin(conversationId)
conversations.unpin(conversationId)
conversations.mute(conversationId, duration?)
conversations.unmute(conversationId)
conversations.archive(conversationId)
conversations.unarchive(conversationId)
conversations.setDisappearingMessages(conversationId, duration)
```

### Messages
```typescript
messages.list(conversationId, { page?, pageSize? })
messages.send(conversationId, { content, type?, replyToMessageId?, attachmentIds? })
messages.edit(conversationId, messageId, { content })
messages.delete(conversationId, messageId, forEveryone?)
messages.react(conversationId, messageId, emoji)
messages.forward(conversationId, messageId, targetConversationIds)
messages.getEditHistory(conversationId, messageId)
messages.markViewOnce(conversationId, messageId)
```

### Contacts
```typescript
contacts.list()
contacts.add(userId)
contacts.remove(contactId)
contacts.getRequests()
contacts.accept(contactId)
contacts.reject(contactId)
contacts.block(userId)
contacts.unblock(userId)
contacts.getBlocked()
contacts.search(query)
```

### Calls
```typescript
calls.initiateCall({ conversationId?, targetUserId?, type })
calls.getHistory()
calls.getIceServers()
calls.getLiveKitToken(roomName)
calls.uploadRecording(callId, file)
```

### Media
```typescript
media.upload(file, { onProgress? })
media.uploadVoice(file, { duration, waveform? })
media.getConversationMedia(conversationId)
```

### Search
```typescript
search.global(query)
search.inConversation(conversationId, query)
```

### Notifications
```typescript
notifications.list({ page?, pageSize? })
notifications.markRead(notificationId)
notifications.markAllRead()
notifications.getUnreadCount()
```

### Broadcasts
```typescript
broadcasts.listChannels()
broadcasts.getSubscribed()
broadcasts.subscribe(channelId)
broadcasts.unsubscribe(channelId)
broadcasts.getMessages(channelId, { page?, pageSize? })
broadcasts.getFeed({ page?, pageSize? })
```

### Reports
```typescript
reports.submit({ type, targetId, reason, details? })
reports.getHistory()
```

### Two-Factor
```typescript
twoFactor.setup()
twoFactor.enable(code)
twoFactor.disable(code)
twoFactor.getBackupCodes()
twoFactor.regenerateBackupCodes()
```

### Devices
```typescript
devices.register({ token, platform })
devices.list()
devices.revoke(deviceId)
```

---

## Appendix B: Component Templates

### New Screen Template
```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks';

interface Props {
  // Navigation props
}

const NewScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Fetch data using SDK
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Screen Title</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
});

export default NewScreen;
```

### New Service Template
```typescript
// src/services/newService.ts
import { sdk } from './sdk';

class NewService {
  private static instance: NewService;

  private constructor() {}

  static getInstance(): NewService {
    if (!NewService.instance) {
      NewService.instance = new NewService();
    }
    return NewService.instance;
  }

  async initialize(): Promise<void> {
    // Initialization logic
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }
}

export const newService = NewService.getInstance();
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-02 | Architecture Team | Initial implementation plan |

---

*This document should be updated as features are implemented and priorities change.*
