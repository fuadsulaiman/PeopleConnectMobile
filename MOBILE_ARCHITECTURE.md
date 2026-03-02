# PeopleConnect Mobile Architecture

**Version:** 1.0
**Last Updated:** March 2, 2026
**Document Owner:** Architecture Engineering Team

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [SDK Integration Strategy](#3-sdk-integration-strategy)
4. [State Management Architecture](#4-state-management-architecture)
5. [Real-Time Communication](#5-real-time-communication)
6. [Offline-First Architecture](#6-offline-first-architecture)
7. [Navigation Architecture](#7-navigation-architecture)
8. [Performance Considerations](#8-performance-considerations)
9. [Security Architecture](#9-security-architecture)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Architecture Overview

### 1.1 Architecture Principles

PeopleConnect Mobile follows **Clean Architecture** principles with a **feature-based modular structure**:

1. **Separation of Concerns**: UI, business logic, and data access are clearly separated
2. **Dependency Inversion**: High-level modules do not depend on low-level modules
3. **Single Responsibility**: Each module has one reason to change
4. **Feature Cohesion**: Related code is grouped together by feature
5. **SDK-First**: All API calls go through the PeopleConnect SDK

### 1.2 Architecture Layers

```
+---------------------------------------------------------------------+
|                    PRESENTATION LAYER                                |
|  +------------+  +------------+  +------------+  +------------+      |
|  |  Screens   |  | Components |  |   Hooks    |  | Navigation |      |
|  +-----+------+  +-----+------+  +-----+------+  +-----+------+      |
|        |              |              |              |                |
|        +------+-------+------+-------+              |                |
|               |              |                      |                |
+---------------|--------------|-----------------------+----------------+
|               |    DOMAIN LAYER                                      |
|  +------------+  +------------+  +------------+                      |
|  |   Stores   |  |   Types    |  |  Services  |                      |
|  |  (Zustand) |  | (TypeScript|  |  Adapters  |                      |
|  +-----+------+  +------------+  +-----+------+                      |
|        |                              |                              |
+--------|--------------+---------------|------------------------------+
|        |    DATA LAYER                |                              |
|  +-----+------+  +------------+  +----+-------+  +------------+      |
|  |    SDK     |  |  SignalR   |  |   WebRTC   |  |  LiveKit   |      |
|  |  Service   |  |  Service   |  |   Service  |  |  Service   |      |
|  +-----+------+  +-----+------+  +-----+------+  +-----+------+      |
|        |              |              |              |                |
|        +------+-------+------+-------+------+-------+                |
|               |                                                      |
+---------------|--------------+---------------------------------------+
|               |   INFRASTRUCTURE                                     |
|  +------------+  +------------+  +------------+  +------------+      |
|  |  Keychain  |  |    MMKV    |  | Permissions|  |   Native   |      |
|  |  (Tokens)  |  |   (Cache)  |  |   Module   |  |   Modules  |      |
|  +------------+  +------------+  +------------+  +------------+      |
+----------------------------------------------------------------------+
```

### 1.3 Dependency Flow

```
Screens --> Components --> Hooks --> Stores --> SDK/Services
   |                          |          |
   |                          v          v
   |                       Types      SignalR
   |                                  WebRTC
   +--------------------------------> LiveKit

Flow: UI -> State -> SDK -> Backend API
Data: Backend -> SDK -> Store -> UI (via Zustand reactivity)
```

---

## 2. Project Structure

### 2.1 Current Structure (Implemented)

```
PeopleConnectMobile/
├── src/
│   ├── components/                 # Shared UI components
│   │   ├── common/                # Base components (Button, Input, Avatar, etc.)
│   │   │   ├── Avatar.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingScreen.tsx
│   │   ├── ConversationInfoSheet.tsx    # Conversation details bottom sheet
│   │   ├── MediaViewer.tsx              # Image/video viewer modal
│   │   ├── MediaPreviewModal.tsx        # Media preview before send
│   │   └── VideoRecorder.tsx            # Video recording component
│   │
│   ├── constants/                  # App constants
│   │   ├── colors.ts              # Theme colors
│   │   ├── colorProfiles.ts       # Dynamic color profiles
│   │   ├── config.ts              # API URLs, timeouts
│   │   └── index.ts               # Exports
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useTheme.ts            # Theme management hook
│   │   └── index.ts
│   │
│   ├── navigation/                 # React Navigation configuration
│   │   ├── RootNavigator.tsx      # Main navigation container
│   │   ├── types.ts               # Navigation type definitions
│   │   └── index.ts
│   │
│   ├── screens/                    # Feature screens (organized by domain)
│   │   ├── auth/                  # Authentication screens
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   ├── TwoFactorScreen.tsx
│   │   │   ├── ForgotPasswordScreen.tsx
│   │   │   └── index.ts
│   │   ├── chat/                  # Messaging screens
│   │   │   ├── ConversationsScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── NewChatScreen.tsx
│   │   │   ├── ArchivedConversationsScreen.tsx
│   │   │   ├── UserProfileScreen.tsx
│   │   │   └── index.ts
│   │   ├── contacts/              # Contacts screens
│   │   │   ├── ContactsScreen.tsx
│   │   │   ├── AddContactScreen.tsx
│   │   │   └── index.ts
│   │   ├── calls/                 # Call screens
│   │   │   ├── CallHistoryScreen.tsx
│   │   │   ├── CallScreen.tsx
│   │   │   └── index.ts
│   │   ├── profile/               # Profile screens
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── EditProfileScreen.tsx
│   │   │   └── index.ts
│   │   └── settings/              # Settings screens
│   │       ├── SettingsScreen.tsx
│   │       └── index.ts
│   │
│   ├── services/                   # Service layer
│   │   ├── sdk.ts                 # SDK wrapper with token management
│   │   ├── signalr.ts             # SignalR real-time service
│   │   └── index.ts
│   │
│   ├── stores/                     # Zustand state stores
│   │   ├── authStore.ts           # Authentication state
│   │   ├── chatStore.ts           # Conversations and messages
│   │   ├── callStore.ts           # Call state
│   │   ├── contactsStore.ts       # Contacts state
│   │   ├── presenceStore.ts       # Online presence state
│   │   ├── settingsStore.ts       # App settings state
│   │   ├── themeStore.ts          # Theme state
│   │   └── index.ts
│   │
│   ├── types/                      # TypeScript type definitions
│   │   └── index.ts               # All types
│   │
│   └── utils/                      # Utility functions
│       └── debounce.ts
│
├── android/                        # Android native code
├── ios/                           # iOS native code
├── package.json
├── tsconfig.json
└── babel.config.js
```

### 2.2 Recommended Enhanced Structure

For better scalability, the structure should be enhanced to:

```
PeopleConnectMobile/
├── src/
│   ├── app/                        # App initialization
│   │   ├── App.tsx                # Root component
│   │   └── providers.tsx          # Context providers
│   │
│   ├── features/                   # Feature-based modules
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── chat/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   └── ConversationItem.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useChat.ts
│   │   │   └── index.ts
│   │   ├── calls/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   │   ├── CallControls.tsx
│   │   │   │   └── ParticipantGrid.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useWebRTC.ts
│   │   │   │   └── useLiveKit.ts
│   │   │   └── index.ts
│   │   ├── contacts/
│   │   ├── profile/
│   │   ├── broadcasts/
│   │   └── notifications/
│   │
│   ├── shared/                     # Shared across features
│   │   ├── components/
│   │   │   ├── ui/                # Base UI components
│   │   │   └── layout/            # Layout components
│   │   ├── hooks/
│   │   └── utils/
│   │
│   ├── core/                       # Core services
│   │   ├── sdk/                   # SDK wrapper
│   │   ├── signalr/               # SignalR service
│   │   ├── webrtc/                # WebRTC service
│   │   ├── livekit/               # LiveKit service
│   │   ├── storage/               # Secure storage
│   │   └── permissions/           # Permission handling
│   │
│   ├── store/                      # Global state management
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── chatSlice.ts
│   │   │   └── ...
│   │   ├── middleware/
│   │   └── index.ts
│   │
│   ├── navigation/                 # Navigation configuration
│   │   ├── stacks/
│   │   ├── tabs/
│   │   └── linking.ts             # Deep linking config
│   │
│   └── config/                     # Configuration
│       ├── constants.ts
│       ├── env.ts
│       └── theme.ts
```

---

## 3. SDK Integration Strategy

### 3.1 SDK Service Wrapper

The mobile app uses the PeopleConnect TypeScript SDK via a wrapper that handles:

```typescript
// src/services/sdk.ts

import { PeopleConnectSDK } from '@peopleconnect/sdk';
import * as Keychain from 'react-native-keychain';
import { config } from '../constants';

const TOKEN_STORAGE_KEY = 'peopleconnect_tokens';
let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

export const sdk = new PeopleConnectSDK({
  baseUrl: config.API_BASE_URL,

  // Auto token refresh handling
  onTokenRefresh: async (tokens) => {
    await Keychain.setGenericPassword(
      TOKEN_STORAGE_KEY,
      JSON.stringify(tokens)
    );
  },

  // Session expiry handling
  onUnauthorized: () => {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  },
});

// Token management
export async function initializeSDK(): Promise<boolean> { ... }
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> { ... }
export async function clearTokens(): Promise<void> { ... }

// Export SDK services
export const {
  auth,
  users,
  conversations,
  messages,
  contacts,
  calls,
  media,
  notifications,
  broadcasts,
  announcements,
  search,
  devices,
  twoFactor,
  reports,
} = sdk;
```

### 3.2 Available SDK Services

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `auth` | Authentication | `login`, `register`, `logout`, `getCurrentUser`, `verify2FA` |
| `users` | User profiles | `getProfile`, `updateProfile`, `uploadAvatar`, `deleteAvatar` |
| `conversations` | Conversations | `list`, `get`, `createDM`, `createChatroom`, `update`, `delete` |
| `messages` | Messages | `list`, `send`, `edit`, `delete`, `react`, `forward` |
| `contacts` | Contacts | `list`, `add`, `remove`, `accept`, `reject`, `block`, `unblock` |
| `calls` | Calls | `initiateCall`, `getHistory`, `getIceServers`, `getLiveKitToken` |
| `media` | Media uploads | `upload`, `uploadVoice`, `getConversationMedia` |
| `notifications` | Notifications | `list`, `markRead`, `markAllRead`, `getUnreadCount` |
| `broadcasts` | Broadcasts | `listChannels`, `subscribe`, `unsubscribe`, `getMessages` |
| `search` | Search | `global`, `inConversation` |
| `devices` | Devices | `register`, `list`, `revoke` |
| `twoFactor` | 2FA | `setup`, `enable`, `disable`, `verify` |
| `reports` | Reports | `submit` |

### 3.3 Token Management Flow

```
+---------------+     +---------------+     +---------------+
|    Login      |---->| Store Tokens  |---->|  Set in SDK   |
|               |     |  (Keychain)   |     |               |
+---------------+     +---------------+     +---------------+
                             |
                             v
+---------------+     +---------------+     +---------------+
| Token Expiry  |---->|  SDK Auto     |---->|Update Keychain|
|               |     |   Refresh     |     |               |
+---------------+     +---------------+     +---------------+
                             |
                             v
+---------------+     +---------------+     +---------------+
|Refresh Fails  |---->|onUnauthorized |---->| Force Logout  |
|               |     |   Callback    |     |               |
+---------------+     +---------------+     +---------------+
```

### 3.4 Error Handling Pattern

```typescript
// Store-level error handling
const fetchData = async () => {
  try {
    set({ isLoading: true, error: null });
    const data = await sdk.conversations.list();
    set({ conversations: data, isLoading: false });
  } catch (error: any) {
    // Extract meaningful error message
    const message = error?.response?.data?.message
      || error?.message
      || 'An error occurred';
    set({ error: message, isLoading: false });

    // Handle specific error codes
    if (error?.response?.status === 403) {
      // Permission denied
    }
  }
};
```

---

## 4. State Management Architecture

### 4.1 Zustand Store Structure

```
+-------------------------------------------------------------+
|                     ZUSTAND STORES                           |
+-------------------------------------------------------------+
|                                                              |
|  +--------------+  +--------------+  +--------------+        |
|  |  authStore   |  |  chatStore   |  |  callStore   |        |
|  |              |  |              |  |              |        |
|  | - user       |  | - conversations| - currentCall |        |
|  | - isAuth     |  | - messages   |  | - callState  |        |
|  | - isLoading  |  | - typingUsers|  | - callHistory|        |
|  | - error      |  | - isLoading  |  | - isMuted    |        |
|  +--------------+  +--------------+  +--------------+        |
|                                                              |
|  +--------------+  +--------------+  +--------------+        |
|  |contactsStore |  |presenceStore |  |settingsStore |        |
|  |              |  |              |  |              |        |
|  | - contacts   |  | - onlineUsers|  | - settings   |        |
|  | - requests   |  | - lastSeen   |  | - isLoaded   |        |
|  | - blocked    |  |              |  |              |        |
|  +--------------+  +--------------+  +--------------+        |
|                                                              |
|  +--------------+                                            |
|  |  themeStore  |                                            |
|  |              |                                            |
|  | - colorProfile|                                           |
|  | - isDark     |                                            |
|  +--------------+                                            |
+-------------------------------------------------------------+
```

### 4.2 Store Implementations

#### Auth Store

```typescript
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  requiresTwoFactor: boolean;
  tempToken: string | null;
  sessionExpired: boolean;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<boolean>;
  register: (...) => Promise<boolean>;
  verify2FA: (tempToken: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  handleSessionExpired: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User) => void;
  clearError: () => void;
}
```

#### Chat Store

```typescript
interface ChatState {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  messages: Record<string, Message[]>;  // Keyed by conversationId
  typingUsers: TypingUser[];
  recordingUsers: RecordingUser[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreMessages: Record<string, boolean>;
}

interface ChatActions {
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  fetchMoreMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, ...) => Promise<void>;
  editMessage: (...) => Promise<void>;
  deleteMessage: (...) => Promise<void>;
  addReaction: (...) => Promise<void>;
  setActiveConversation: (id: string) => void;
  handleIncomingMessage: (message: Message) => void;
  handleTypingIndicator: (data: TypingUser) => void;
  // ... more actions
}
```

### 4.3 State Persistence with MMKV

```typescript
import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

const storage = new MMKV();

const mmkvStorage: StateStorage = {
  getItem: (name) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.delete(name);
  },
};

// Use with Zustand persist middleware
export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ... state
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
```

### 4.4 Real-Time State Updates via SignalR

```typescript
// SignalR service notifies stores of real-time events
signalRService.onMessage('ReceiveMessage', (message) => {
  useChatStore.getState().handleIncomingMessage(message);
});

signalRService.onMessage('TypingIndicator', (data) => {
  useChatStore.getState().handleTypingIndicator(data);
});

signalRService.onMessage('UserStatusChanged', (userId, isOnline) => {
  usePresenceStore.getState().updateUserStatus(userId, isOnline);
});

signalRService.onMessage('CallReceived', (call) => {
  useCallStore.getState().setIncomingCall(call);
});
```

---

## 5. Real-Time Communication

### 5.1 SignalR Integration

The mobile app connects to three SignalR hubs:

```
+-------------------------------------------------------------+
|                    SignalR Connections                       |
+-------------------------------------------------------------+
|                                                              |
|  +--------------+                                            |
|  |   ChatHub    | --> Messages, Typing, Reactions, Read      |
|  |  /hubs/chat  |     Receipts, Conversation Updates         |
|  +--------------+                                            |
|                                                              |
|  +--------------+                                            |
|  | PresenceHub  | --> Online Status, Last Seen Updates       |
|  |/hubs/presence|                                            |
|  +--------------+                                            |
|                                                              |
|  +--------------+                                            |
|  |   CallHub    | --> Call Signaling, SDP/ICE Exchange       |
|  |  /hubs/call  |                                            |
|  +--------------+                                            |
|                                                              |
+-------------------------------------------------------------+
```

#### SignalR Service Architecture

```typescript
class SignalRService {
  private chatConnection: signalR.HubConnection | null = null;
  private presenceConnection: signalR.HubConnection | null = null;
  private callConnection: signalR.HubConnection | null = null;

  // Event handlers
  private messageHandlers: ((message: any) => void)[] = [];
  private typingHandlers: ((data: any) => void)[] = [];
  private presenceHandlers: ((userId: string, isOnline: boolean) => void)[] = [];
  private callHandlers: Map<string, ((data: any) => void)[]> = new Map();

  async connect(): Promise<void> {
    const token = sdk.getAccessToken();
    if (!token) return;

    // Build connections with automatic reconnect
    this.chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${config.SIGNALR_URL}/hubs/chat`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([1000, 3000, 5000])
      .build();

    // Register event handlers
    this.setupChatHandlers();

    // Start connections
    await this.chatConnection.start();
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.chatConnection?.stop(),
      this.presenceConnection?.stop(),
      this.callConnection?.stop(),
    ]);
  }

  // Outgoing methods
  async sendMessage(conversationId: string, content: string, ...): Promise<void> {
    await this.chatConnection?.invoke('SendMessage', conversationId, content, ...);
  }

  async sendTyping(conversationId: string, isTyping: boolean): Promise<void> {
    await this.chatConnection?.invoke('SendTyping', conversationId, isTyping);
  }
}
```

### 5.2 WebRTC for 1:1 Calls

```
+----------------+                        +----------------+
|   Caller App   |                        |   Callee App   |
|                |                        |                |
| +------------+ |    SignalR CallHub     | +------------+ |
| |  WebRTC    |<|------------------------|>|  WebRTC    | |
| |  Service   | |  SDP Offer/Answer      | |  Service   | |
| +------------+ |  ICE Candidates        | +------------+ |
|       |        |                        |       |        |
|       v        |                        |       v        |
| +------------+ |                        | +------------+ |
| |   Camera   | |   Direct P2P Media     | |   Camera   | |
| | Microphone |<|========================|>| Microphone | |
| |  Speaker   | |   (Audio/Video/Data)   | |  Speaker   | |
| +------------+ |                        | +------------+ |
+----------------+                        +----------------+
```

#### WebRTC Service (To Be Implemented)

```typescript
class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  async startCall(type: 'voice' | 'video'): Promise<void> {
    // Get ICE servers from backend
    const iceServers = await calls.getIceServers();

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers.servers,
    });

    // Get local media
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });

    // Add tracks to peer connection
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // Create and send offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await signalRService.sendSdpOffer(callId, offer.sdp);
  }

  async handleOffer(sdp: string): Promise<void> { ... }
  async handleAnswer(sdp: string): Promise<void> { ... }
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> { ... }

  toggleMute(): void { ... }
  toggleVideo(): void { ... }
  switchCamera(): void { ... }

  async endCall(): Promise<void> { ... }
}
```

### 5.3 LiveKit for Group Video Calls

```
+-------------------------------------------------------------+
|                     LiveKit SFU Server                       |
|  +---------------------------------------------------------+ |
|  |                                                          | |
|  |    Receives media from publishers                        | |
|  |    Forwards to subscribers                               | |
|  |    Handles simulcast/SVC                                 | |
|  |                                                          | |
|  +---------------------------------------------------------+ |
+-------------------------------------------------------------+
           ^              ^              ^
           |              |              |
    +------+------++------+------++------+------+
    | Participant || Participant || Participant |
    |     A       ||     B       ||     C       |
    | (Publisher) ||(Subscriber) ||   (Both)    |
    +-------------++-------------++-------------+
```

#### LiveKit Integration

```typescript
import { useRoom, VideoTrack, AudioTrack } from '@livekit/react-native';

function GroupCallScreen() {
  const [token, setToken] = useState<string>();

  useEffect(() => {
    async function getToken() {
      const response = await calls.getLiveKitToken(roomName);
      setToken(response.token);
    }
    getToken();
  }, []);

  const { room, participants, connect, disconnect } = useRoom();

  useEffect(() => {
    if (token) {
      connect(config.LIVEKIT_URL, token);
    }
    return () => disconnect();
  }, [token]);

  return (
    <View>
      {participants.map(participant => (
        <ParticipantView key={participant.sid} participant={participant} />
      ))}
    </View>
  );
}
```

---

## 6. Offline-First Architecture

### 6.1 Message Queueing Strategy

```
+-------------------------------------------------------------+
|                   OFFLINE MESSAGE FLOW                       |
+-------------------------------------------------------------+
|                                                              |
|  +-------------+                                             |
|  | User Sends  |                                             |
|  |   Message   |                                             |
|  +------+------+                                             |
|         |                                                    |
|         v                                                    |
|  +-------------+     +-------------+                         |
|  | Check Network|--->|   Online?   |                         |
|  |   Status    |     +------+------+                         |
|  +-------------+            |                                |
|                    +--------+--------+                       |
|                    v                 v                       |
|             +----------+      +----------+                   |
|             |   YES    |      |    NO    |                   |
|             +----+-----+      +----+-----+                   |
|                  |                 |                         |
|                  v                 v                         |
|          +--------------+  +--------------+                  |
|          |Send via API/ |  |Queue in MMKV |                  |
|          |   SignalR    |  | (Optimistic) |                  |
|          +--------------+  +--------------+                  |
|                                    |                         |
|                                    v                         |
|                            +--------------+                  |
|                            | Show as      |                  |
|                            | "Sending..." |                  |
|                            +--------------+                  |
|                                    |                         |
|                           When Online Again                  |
|                                    |                         |
|                                    v                         |
|                            +--------------+                  |
|                            | Process Queue|                  |
|                            | Send Messages|                  |
|                            +--------------+                  |
+-------------------------------------------------------------+
```

### 6.2 Optimistic Updates

```typescript
// Optimistic message sending
const sendMessage = async (conversationId: string, content: string) => {
  // 1. Create optimistic message with temp ID
  const tempId = `temp_${Date.now()}`;
  const optimisticMessage: Message = {
    id: tempId,
    conversationId,
    content,
    senderId: user.id,
    status: 'sending',
    createdAt: new Date().toISOString(),
    // ...
  };

  // 2. Add to UI immediately
  set(state => ({
    messages: {
      ...state.messages,
      [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage],
    },
  }));

  try {
    // 3. Send to server
    const realMessage = await signalRService.sendMessage(conversationId, content);

    // 4. Replace temp message with real one
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId].map(m =>
          m.id === tempId ? { ...realMessage, status: 'sent' } : m
        ),
      },
    }));
  } catch (error) {
    // 5. Mark as failed
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId].map(m =>
          m.id === tempId ? { ...m, status: 'failed' } : m
        ),
      },
    }));

    // 6. Queue for retry if offline
    if (!isOnline) {
      queueMessage(conversationId, content, tempId);
    }
  }
};
```

### 6.3 Sync Mechanism

```typescript
// Sync service for handling reconnection
class SyncService {
  private pendingMessages: Map<string, QueuedMessage> = new Map();

  async syncOnReconnect(): Promise<void> {
    // 1. Process queued messages
    for (const [id, message] of this.pendingMessages) {
      try {
        await signalRService.sendMessage(
          message.conversationId,
          message.content
        );
        this.pendingMessages.delete(id);
      } catch (error) {
        // Keep in queue if still failing
      }
    }

    // 2. Fetch missed messages since last sync
    const lastSyncTime = await storage.getItem('lastSyncTime');
    await this.fetchMissedMessages(lastSyncTime);

    // 3. Refresh presence data
    await this.refreshPresenceData();
  }
}
```

---

## 7. Navigation Architecture

### 7.1 Navigation Stack Structure

```
+-------------------------------------------------------------+
|                      RootNavigator                           |
|  +-------------------------------------------------------+   |
|  |                                                        |   |
|  |  isAuthenticated = false         isAuthenticated = true|   |
|  |         |                                |              |   |
|  |         v                                v              |   |
|  |  +--------------+              +--------------+         |   |
|  |  |  AuthStack   |              |  MainStack   |         |   |
|  |  |              |              |              |         |   |
|  |  | - Login      |              | +----------+ |         |   |
|  |  | - Register   |              | | MainTabs | |         |   |
|  |  | - TwoFactor  |              | |          | |         |   |
|  |  | - ForgotPass |              | | Chat     | |         |   |
|  |  +--------------+              | | Contacts | |         |   |
|  |                                | | Calls    | |         |   |
|  |                                | | Bcast    | |         |   |
|  |                                | | Profile  | |         |   |
|  |                                | +----------+ |         |   |
|  |                                |              |         |   |
|  |                                | Modal Screens|         |   |
|  |                                | - ActiveCall |         |   |
|  |                                | - GroupCall  |         |   |
|  |                                +--------------+         |   |
|  +-------------------------------------------------------+   |
+-------------------------------------------------------------+
```

### 7.2 Tab Configuration

```typescript
// Main tab navigator
const MainTab = createBottomTabNavigator<MainTabParamList>();

<MainTab.Navigator>
  <MainTab.Screen
    name="ChatTab"
    component={ChatStackNavigator}
    options={{
      tabBarLabel: 'Chats',
      tabBarIcon: ({ focused }) => (
        <Icon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} />
      ),
    }}
  />
  <MainTab.Screen name="ContactsTab" component={ContactsStackNavigator} />
  <MainTab.Screen name="CallsTab" component={CallsStackNavigator} />
  <MainTab.Screen name="BroadcastsTab" component={BroadcastsScreen} />
  <MainTab.Screen name="ProfileTab" component={ProfileStackNavigator} />
</MainTab.Navigator>
```

### 7.3 Deep Linking Configuration

```typescript
// linking.ts
const linking = {
  prefixes: ['peopleconnect://', 'https://app.peopleconnect.com'],

  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          ResetPassword: 'reset-password/:token',
        },
      },
      Main: {
        screens: {
          ChatTab: {
            screens: {
              Conversations: 'conversations',
              Chat: 'chat/:conversationId',
            },
          },
          ContactsTab: {
            screens: {
              ContactsList: 'contacts',
              AddContact: 'contacts/add',
            },
          },
          CallsTab: {
            screens: {
              CallHistory: 'calls',
            },
          },
          ProfileTab: {
            screens: {
              Profile: 'profile',
              EditProfile: 'profile/edit',
              Settings: 'settings',
            },
          },
        },
      },
      ActiveCall: 'call/:callId',
      GroupCall: 'group-call/:roomName',
    },
  },
};
```

### 7.4 Navigation Type Definitions

```typescript
// navigation/types.ts
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ActiveCall: { call: Call; user: User; type: 'voice' | 'video' };
  GroupCall: { roomName: string; conversationId: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  TwoFactor: { tempToken: string };
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  ChatTab: undefined;
  ContactsTab: undefined;
  CallsTab: undefined;
  BroadcastsTab: undefined;
  ProfileTab: undefined;
};

export type ChatStackParamList = {
  Conversations: undefined;
  Chat: { conversationId: string; conversation?: Conversation };
  NewChat: undefined;
  ArchivedConversations: undefined;
  UserProfile: { userId: string };
};
```

---

## 8. Performance Considerations

### 8.1 List Virtualization

```typescript
// FlatList optimization for message lists
<FlatList
  data={messages}
  renderItem={renderMessage}
  keyExtractor={(item) => item.id}
  // Performance optimizations
  initialNumToRender={20}
  maxToRenderPerBatch={10}
  windowSize={10}
  removeClippedSubviews={true}
  // Inverted for chat (newest at bottom)
  inverted={true}
  // Maintain scroll position during updates
  maintainVisibleContentPosition={{
    minIndexForVisible: 0,
    autoscrollToTopThreshold: 100,
  }}
  // Prevent unnecessary re-renders
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 8.2 Image Caching

```typescript
import FastImage from 'react-native-fast-image';

// Preload images for conversation list
const preloadImages = (conversations: Conversation[]) => {
  const urls = conversations
    .filter(c => c.avatarUrl)
    .map(c => ({ uri: c.avatarUrl }));

  FastImage.preload(urls);
};

// Usage in components
<FastImage
  source={{ uri: avatarUrl, priority: FastImage.priority.normal }}
  style={styles.avatar}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### 8.3 Memoization Strategies

```typescript
// Memoize expensive computations
const reversedMessages = useMemo(() => {
  return [...messages].reverse();
}, [messages]);

// Memoize callbacks
const handleSend = useCallback(async () => {
  if (!inputText.trim()) return;
  await sendMessage(conversationId, inputText);
  setInputText('');
}, [inputText, conversationId, sendMessage]);

// Memoize components
const MessageItem = React.memo(({ message, onPress }) => {
  // Component implementation
});
```

### 8.4 Bundle Optimization

```javascript
// metro.config.js
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,  // Inline requires for faster startup
      },
    }),
  },
};

// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',  // Must be last
  ],
};
```

### 8.5 Memory Management

```typescript
// Cleanup old messages from memory
const cleanupOldMessages = (conversationId: string, keepCount: number = 100) => {
  set(state => {
    const messages = state.messages[conversationId];
    if (!messages || messages.length <= keepCount) return state;

    return {
      messages: {
        ...state.messages,
        [conversationId]: messages.slice(-keepCount),
      },
    };
  });
};

// Cleanup on conversation switch
useEffect(() => {
  return () => {
    cleanupOldMessages(previousConversationId);
  };
}, [conversationId]);
```

---

## 9. Security Architecture

### 9.1 Token Storage

```typescript
// Secure token storage using react-native-keychain
import * as Keychain from 'react-native-keychain';

// Store tokens
await Keychain.setGenericPassword(
  'peopleconnect_tokens',
  JSON.stringify({ accessToken, refreshToken }),
  {
    service: 'com.peopleconnect.app',
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }
);

// Retrieve tokens
const credentials = await Keychain.getGenericPassword({
  service: 'com.peopleconnect.app',
});

// Clear tokens on logout
await Keychain.resetGenericPassword({ service: 'com.peopleconnect.app' });
```

### 9.2 Certificate Pinning

```xml
<!-- iOS: Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSPinnedDomains</key>
  <dict>
    <key>api.peopleconnect.com</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSPinnedLeafIdentities</key>
      <array>
        <dict>
          <key>SPKI-SHA256-BASE64</key>
          <string>CERTIFICATE_HASH_HERE</string>
        </dict>
      </array>
    </dict>
  </dict>
</dict>

<!-- Android: network_security_config.xml -->
<network-security-config>
  <domain-config>
    <domain includeSubdomains="true">api.peopleconnect.com</domain>
    <pin-set>
      <pin digest="SHA-256">CERTIFICATE_HASH_HERE</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

### 9.3 Secure Data Handling

```typescript
// Use encrypted storage for sensitive data
import { MMKV } from 'react-native-mmkv';

const secureStorage = new MMKV({
  id: 'secure-storage',
  encryptionKey: 'your-encryption-key',  // Generate securely
});

// Never log sensitive data
const sanitizeLog = (data: any) => {
  const sensitiveKeys = ['password', 'token', 'secret', 'key'];
  return JSON.stringify(data, (key, value) =>
    sensitiveKeys.includes(key.toLowerCase()) ? '[REDACTED]' : value
  );
};
```

---

## 10. Testing Strategy

### 10.1 Unit Testing

```typescript
// stores/__tests__/authStore.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login('testuser', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).not.toBeNull();
  });
});
```

### 10.2 Component Testing

```typescript
// components/__tests__/MessageBubble.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble', () => {
  const mockMessage = {
    id: '1',
    content: 'Hello world',
    senderId: 'user1',
    createdAt: new Date().toISOString(),
  };

  it('renders message content', () => {
    const { getByText } = render(<MessageBubble message={mockMessage} />);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('calls onLongPress handler', () => {
    const onLongPress = jest.fn();
    const { getByTestId } = render(
      <MessageBubble message={mockMessage} onLongPress={onLongPress} />
    );

    fireEvent(getByTestId('message-bubble'), 'longPress');
    expect(onLongPress).toHaveBeenCalled();
  });
});
```

### 10.3 Integration Testing

```typescript
// __tests__/integration/chat.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ChatScreen from '../screens/chat/ChatScreen';

// Mock SDK
jest.mock('../services/sdk', () => ({
  messages: {
    list: jest.fn().mockResolvedValue([
      { id: '1', content: 'Test message' },
    ]),
  },
}));

describe('ChatScreen Integration', () => {
  it('loads and displays messages', async () => {
    const { getByText } = render(
      <NavigationContainer>
        <ChatScreen route={{ params: { conversationId: '1' } }} />
      </NavigationContainer>
    );

    await waitFor(() => {
      expect(getByText('Test message')).toBeTruthy();
    });
  });
});
```

### 10.4 E2E Testing with Detox

```typescript
// e2e/login.test.ts
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should login successfully', async () => {
    await element(by.id('username-input')).typeText('testuser');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('conversations-list')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## Appendix A: Dependency List

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3.1 | UI framework |
| react-native | 0.76.6 | Mobile framework |
| @peopleconnect/sdk | local | API SDK |
| zustand | 5.0.3 | State management |
| @react-navigation/native | 7.0.14 | Navigation |
| @microsoft/signalr | 8.0.7 | Real-time |

### Native Modules

| Package | Purpose |
|---------|---------|
| react-native-keychain | Secure token storage |
| react-native-mmkv | Fast key-value storage |
| react-native-webrtc | WebRTC for calls |
| @livekit/react-native | Group video calls |
| react-native-image-picker | Media capture |
| react-native-fs | File system access |
| react-native-permissions | Permission handling |

---

## Appendix B: Environment Configuration

```typescript
// src/constants/config.ts
export const config = {
  API_BASE_URL: process.env.API_URL || 'https://api.peopleconnect.com/api',
  SIGNALR_URL: process.env.SIGNALR_URL || 'https://api.peopleconnect.com',
  LIVEKIT_URL: process.env.LIVEKIT_URL || 'wss://livekit.peopleconnect.com',

  // Timeouts
  API_TIMEOUT: 30000,
  SIGNALR_RECONNECT_DELAYS: [1000, 3000, 5000],

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MESSAGES_PAGE_SIZE: 50,
};
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-02 | Architecture Team | Initial architecture document |

---

*This document should be updated as the architecture evolves.*
