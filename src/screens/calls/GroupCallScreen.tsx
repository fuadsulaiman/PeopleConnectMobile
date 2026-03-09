import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { callRecordingService } from '../../services/callRecordingService';

// Simple base64 decode for JWT parsing (debugging)
const base64Decode = (str: string): string => {
  try {
    // Handle URL-safe base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    // Use global atob if available (some RN environments have it)
    if (typeof atob !== 'undefined') {
      return atob(paddedBase64);
    }
    // Fallback: try Buffer
    return Buffer.from(paddedBase64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
};
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getCalls = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.calls;
};
const getMessages = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.messages;
};
const calls = {
  getLiveKitToken: (id: string) => getCalls().getLiveKitToken(id),
  getIceServers: () => getCalls().getIceServers(),
};
const getSignalR = () => {
  const signalrModule = require('../../services/signalr');
  return signalrModule.signalRService;
};

// ICE server interface
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Default STUN servers as fallback
const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Sanitize ICE servers to avoid Android native WebRTC errors
// Android throws IllegalArgumentException when username is null for ICE servers
const sanitizeIceServers = (servers: IceServer[]): IceServer[] => {
  const validServers: IceServer[] = [];

  for (const server of servers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const isTurnServer = urls.some((url) => url.toLowerCase().startsWith('turn:'));
    const isStunServer = urls.some((url) => url.toLowerCase().startsWith('stun:'));

    if (isTurnServer) {
      // TURN servers require both username and credential to be non-null/non-empty
      // Also skip if credential appears to be encrypted (starts with ENC:)
      if (!server.username || !server.credential) {
        console.warn('[GroupCall] Skipping TURN server with missing credentials:', urls.join(', '));
        continue;
      }
      if (typeof server.credential === 'string' && server.credential.startsWith('ENC:')) {
        console.warn('[GroupCall] Skipping TURN server with encrypted credential:', urls.join(', '));
        continue;
      }
      validServers.push({
        urls: server.urls,
        username: server.username,
        credential: server.credential,
      });
    } else if (isStunServer) {
      // STUN servers don't need credentials - only include urls to avoid null value issues
      validServers.push({ urls: server.urls });
    } else {
      // Keep other servers but strip null credentials
      const cleanServer: IceServer = { urls: server.urls };
      if (server.username) cleanServer.username = server.username;
      if (server.credential) cleanServer.credential = server.credential;
      validServers.push(cleanServer);
    }
  }

  // Ensure we have at least one ICE server
  if (validServers.length === 0) {
    console.warn('[GroupCall] No valid ICE servers, using Google STUN as fallback');
    return DEFAULT_ICE_SERVERS;
  }

  return validServers;
};
import { GroupCallScreenProps } from '../../navigation/types';

// LiveKit imports - will fail gracefully if not available
let LiveKitRoom: any = null;
let VideoTrack: any = null;
let useParticipants: any = null;
let useTracks: any = null;
let useConnectionState: any = null;
let useLocalParticipant: any = null;
let Track: any = null;
let ConnectionState: any = null;
let isTrackReference: any = null;

try {
  const livekit = require('@livekit/react-native');
  // Track and ConnectionState are exported from livekit-client, not react-native
  const livekitClient = require('livekit-client');
  LiveKitRoom = livekit.LiveKitRoom;
  // Use VideoTrack (not deprecated VideoView) - VideoTrack correctly accepts trackRef prop
  VideoTrack = livekit.VideoTrack;
  useParticipants = livekit.useParticipants;
  useTracks = livekit.useTracks;
  useConnectionState = livekit.useConnectionState;
  useLocalParticipant = livekit.useLocalParticipant;
  isTrackReference = livekit.isTrackReference;
  Track = livekitClient.Track;
  ConnectionState = livekitClient.ConnectionState;
} catch (e) {
  console.log('LiveKit not available:', e);
}

// Custom reconnect policy with exponential backoff for ping timeout handling
// This implements more aggressive reconnection for mobile networks
const createReconnectPolicy = () => ({
  nextRetryDelayInMs: (context: { retryCount: number; elapsedMs: number; retryReason?: Error }) => {
    const { retryCount, elapsedMs, retryReason } = context;

    // Log reconnection attempts for debugging
    console.log('[GroupCall] Reconnect attempt:', {
      retryCount,
      elapsedMs,
      reason: retryReason?.message,
    });

    // Give up after 2 minutes of trying
    if (elapsedMs > 120000) {
      console.log('[GroupCall] Giving up reconnection after 2 minutes');
      return null;
    }

    // Give up after 10 retries
    if (retryCount >= 10) {
      console.log('[GroupCall] Giving up reconnection after 10 attempts');
      return null;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 30s
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

    console.log('[GroupCall] Will retry in', delay, 'ms');
    return delay;
  },
});

const { width, height } = Dimensions.get('window');

const GroupCallScreen: React.FC<GroupCallScreenProps> = ({ route, navigation }) => {
  const { conversationId, conversationName, type, isJoining } = route.params;
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [notificationSent, setNotificationSent] = useState(false);
  const [iceServers, setIceServers] = useState<IceServer[]>(DEFAULT_ICE_SERVERS);

  // Recording state for LiveKit group calls
  const fetchPublicSettings = useSettingsStore((state) => state.fetchPublicSettings);
  const isRecordingEnabledSetting = useSettingsStore((state) => state.isRecordingEnabled);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [remoteRecording, setRemoteRecording] = useState<{ userName: string; isRecording: boolean } | null>(null);

  // Recording refs for tracking recording metadata
  const recordingStartTimeRef = React.useRef<number | null>(null);

  // Fetch settings on mount to ensure recordingEnabled is properly set
  useEffect(() => {
    const loadSettings = async () => {
      await fetchPublicSettings();
      const isEnabled = isRecordingEnabledSetting();
      console.log('[GroupCall] Recording enabled from settings:', isEnabled);
      setRecordingEnabled(isEnabled);
    };
    loadSettings();
  }, [fetchPublicSettings, isRecordingEnabledSetting]);

  // Call tracking for sending call message when call ends
  const connectedTimeRef = React.useRef<number | null>(null);
  const callMessageSentRef = React.useRef<boolean>(false);
  const participantsRef = React.useRef<string[]>([]);

  // Create reconnect policy once
  const reconnectPolicy = useMemo(() => createReconnectPolicy(), []);

  // Debug: Log user state to understand the issue
  console.log('[GroupCall] Auth state:', {
    isAuthenticated,
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    displayName: user?.displayName,
    name: user?.name,
    fullUser: user ? JSON.stringify(user) : 'null',
  });

  // Get username for LiveKit identity - required for connection
  // Priority: username > displayName > name > id (as last resort)
  const username = user?.username || user?.displayName || user?.name || user?.id;

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchToken = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Debug: Log current state when fetchToken is called
      console.log('[GroupCall] fetchToken called - Current state:', {
        username,
        userId: user?.id,
        isAuthenticated,
        conversationId,
      });

      // Validate username is available - required for LiveKit identity
      if (!username) {
        console.error('[GroupCall] Username is null - Full user object:', JSON.stringify(user));
        console.error('[GroupCall] isAuthenticated:', isAuthenticated);
        throw new Error('User identity not available. Please log in again.');
      }

      console.log('[GroupCall] Initializing call with username:', username);

      // Step 0: Fetch ICE servers from backend and sanitize them
      // This prevents "username == null" error on Android where server-provided
      // ICE servers may have null username/credential values
      try {
        console.log('[GroupCall] Fetching ICE servers from backend...');
        const fetchedIceServers = await calls.getIceServers();
        if (fetchedIceServers && Array.isArray(fetchedIceServers) && fetchedIceServers.length > 0) {
          const sanitized = sanitizeIceServers(fetchedIceServers);
          console.log('[GroupCall] Sanitized ICE servers:', sanitized.length, 'servers');
          setIceServers(sanitized);
        } else {
          console.log('[GroupCall] No ICE servers from backend, using defaults');
        }
      } catch (iceErr: any) {
        console.warn('[GroupCall] Failed to fetch ICE servers, using defaults:', iceErr.message);
      }

      // Step 1: Notify all participants in the chatroom about the group call
      // This sends a SignalR notification to all online participants
      // IMPORTANT: Skip this step if isJoining is true (user is joining an existing call, not initiating)
      if (!notificationSent && !isJoining) {
        try {
          const signalR = getSignalR();
          const callType = type || 'video';

          // Debug: Log SignalR connection state and conversation ID format
          const connectionState = signalR.getConnectionState();
          const isCallHubConnected = signalR.isCallConnected ? signalR.isCallConnected() : false;
          console.log('[GroupCall] SignalR state before InitiateCall:', {
            connectionState,
            isConnected: signalR.isConnected(),
            isCallConnected: isCallHubConnected,
            conversationId,
            conversationIdType: typeof conversationId,
            conversationIdLength: conversationId?.length,
            callType,
          });

          // Ensure SignalR is connected before attempting to initiate call
          // Check both chat hub (for general connectivity) and call hub (for call functionality)
          if (!signalR.isConnected() || !isCallHubConnected) {
            console.log('[GroupCall] SignalR not fully connected, attempting to connect...');
            console.log('[GroupCall] Chat connected:', signalR.isConnected(), 'Call connected:', isCallHubConnected);
            await signalR.connect();
            console.log('[GroupCall] SignalR connected, state:', signalR.getConnectionState());
          }

          console.log('[GroupCall] Notifying participants about group call:', conversationId, callType);
          await signalR.initiateGroupCall(conversationId, callType);
          setNotificationSent(true);
          console.log('[GroupCall] Group call notification sent successfully');
        } catch (notifyErr: any) {
          // Log full error details for debugging
          const errorMessage = notifyErr?.message || '';
          console.error('[GroupCall] Failed to notify participants:', {
            message: errorMessage,
            stack: notifyErr?.stack,
            fullError: JSON.stringify(notifyErr, Object.getOwnPropertyNames(notifyErr)),
          });

          // Check if this is a participant validation error from the backend
          if (errorMessage.includes('not a participant')) {
            console.error('[GroupCall] PARTICIPANT VALIDATION FAILED');
            console.error('[GroupCall] User ID from auth store:', user?.id);
            console.error('[GroupCall] Conversation ID being used:', conversationId);
            console.error('[GroupCall] This error means the backend does not recognize this user as a participant.');
            console.error('[GroupCall] Possible causes:');
            console.error('[GroupCall] 1. User was removed from the conversation');
            console.error('[GroupCall] 2. JWT token contains a different user ID than expected');
            console.error('[GroupCall] 3. Conversation ID is incorrect or malformed');

            // Re-throw this error to stop the call flow
            throw new Error('You are not a participant of this conversation. Please rejoin the group and try again.');
          }

          // For other errors, continue without SignalR notification
          // The call initiator can still join, others might miss the notification
          console.warn('[GroupCall] Continuing without SignalR notification...');
        }
      } else if (isJoining) {
        console.log('[GroupCall] Joining existing call - skipping InitiateCall notification');
        setNotificationSent(true); // Mark as sent to prevent future attempts
      }

      // Step 2: Get the LiveKit token to join the call
      console.log('[GroupCall] Fetching LiveKit token for conversation:', conversationId);
      const response = await calls.getLiveKitToken(conversationId);
      console.log('[GroupCall] LiveKit token response:', {
        hasToken: !!response?.token,
        tokenLength: response?.token?.length,
        tokenPreview: response?.token?.substring(0, 80),
        url: response?.url,
        roomName: response?.roomName,
        fullResponse: JSON.stringify(response),
      });

      // Decode and log JWT payload to verify identity
      if (response?.token) {
        try {
          const parts = response.token.split('.');
          if (parts.length === 3) {
            const payloadStr = base64Decode(parts[1]);
            console.log('[GroupCall] Token payload raw:', payloadStr);
            const payload = JSON.parse(payloadStr);
            console.log('[GroupCall] Token payload:', JSON.stringify(payload));
            console.log('[GroupCall] Token identity (sub):', payload.sub);
            console.log('[GroupCall] Token video grants:', payload.video);
          }
        } catch (decodeErr) {
          console.warn('[GroupCall] Could not decode token:', decodeErr);
        }
      }
      if (response && response.token && response.url) {
        setToken(response.token);
        setServerUrl(response.url);
        setRoomName(response.roomName || conversationId);
        console.log('[GroupCall] Connecting to LiveKit server:', response.url);
      } else {
        throw new Error('Invalid token response');
      }
    } catch (err: any) {
      console.error('[CallScreen] Failed to initialize call:', err);
      setError(err.message || 'Failed to join call');
      Alert.alert('Error', err.message || 'Failed to join call. Please try again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId, navigation, type, notificationSent, username, user, isAuthenticated, isJoining]);

  // Wait for user to be available before fetching token
  useEffect(() => {
    // Don't attempt to fetch token if user is not available yet
    if (!user || !isAuthenticated) {
      console.log('[GroupCall] Waiting for user authentication...', {
        hasUser: !!user,
        isAuthenticated,
      });

      // Set a timeout to show error if user is not available after 5 seconds
      const timeoutId = setTimeout(() => {
        if (!user || !isAuthenticated) {
          console.error('[GroupCall] Timeout waiting for user authentication');
          setError('Unable to authenticate. Please log in again.');
          setIsConnecting(false);
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    }

    console.log('[GroupCall] User available, fetching token...');
    fetchToken();
  }, [fetchToken, user, isAuthenticated]);

  // Send call message to conversation when call ends
  const sendCallMessage = useCallback(async () => {
    console.log('[GroupCall] sendCallMessage called with:', {
      conversationId,
      type,
      isJoining,
      callMessageSentRef: callMessageSentRef.current,
    });

    // Only initiator sends call message to avoid duplicates
    if (isJoining || callMessageSentRef.current) {
      console.log('[GroupCall] Skipping call message - isJoining:', isJoining, 'alreadySent:', callMessageSentRef.current);
      return;
    }

    // Validate conversationId before proceeding
    if (!conversationId) {
      console.error('[GroupCall] Cannot send call message - conversationId is empty or undefined');
      return;
    }

    callMessageSentRef.current = true;

    try {
      console.log('[GroupCall] Getting messages service...');
      const messagesService = getMessages();
      console.log('[GroupCall] Messages service obtained:', typeof messagesService, 'has send:', typeof messagesService?.send);

      const wasConnected = connectedTimeRef.current !== null;
      const duration = wasConnected
        ? Math.floor((Date.now() - connectedTimeRef.current!) / 1000)
        : 0;

      const messageType = type === 'video' ? 'VideoCall' : 'VoiceCall';
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = wasConnected ? `${minutes}:${seconds.toString().padStart(2, '0')}` : 'Missed';

      // Build message content with duration and participants
      const participants = participantsRef.current.filter((p) => p); // Filter empty strings
      const participantNames = participants.length > 0 ? participants.join(', ') : '';
      const messageContent =
        wasConnected && participantNames ? `${durationText}|${participantNames}` : durationText;

      console.log('[GroupCall] Sending call message:', {
        conversationId,
        messageType,
        content: messageContent,
        duration,
        wasConnected,
        participants: participantNames,
      });

      const result = await messagesService.send(conversationId, {
        content: messageContent,
        type: messageType,
      });

      console.log('[GroupCall] Call message sent successfully, result:', result?.id || result);
    } catch (error: any) {
      console.error('[GroupCall] Failed to send call message:', {
        message: error?.message || String(error),
        stack: error?.stack,
        name: error?.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
      });
    }
  }, [conversationId, type, isJoining]);

  const handleEndCall = useCallback(async () => {
    console.log('[GroupCall] handleEndCall called - about to send call message');
    // Send call message before navigating away
    await sendCallMessage();
    console.log('[GroupCall] handleEndCall - call message sent, navigating back');
    navigation.goBack();
  }, [navigation, sendCallMessage]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => !prev);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

  // Handle recording toggle for LiveKit group calls
  // Note: LiveKit group calls use server-side Egress recording when enabled.
  // This tracks the recording state and notifies other participants.
  const handleToggleRecording = useCallback(async () => {
    if (!recordingEnabled) {
      console.warn('[GroupCall] Recording is disabled by settings');
      return;
    }

    const newIsRecording = !isRecording;

    try {
      const signalR = getSignalR();
      const callGroupId = 'group-' + conversationId;

      if (newIsRecording) {
        // Start recording
        console.log('[GroupCall] Starting recording...');
        recordingStartTimeRef.current = Date.now();
        
        // Initialize recording service metadata
        const callType = type === 'video' ? 'video' : 'voice';
        callRecordingService.startRecording(callGroupId, conversationId, callType);
      } else {
        // Stop recording
        console.log('[GroupCall] Stopping recording...');
        const recordingResult = callRecordingService.stopRecording();
        
        if (recordingResult) {
          console.log('[GroupCall] Recording stopped, duration:', recordingResult.duration, 'seconds');
          // Note: For LiveKit group calls, actual recording is handled server-side via Egress
          // Client-side recording would require additional native module integration
        }
        
        recordingStartTimeRef.current = null;
      }

      // Notify other participants about recording status
      await signalR.notifyRecordingStatus(callGroupId, newIsRecording);
      setIsRecording(newIsRecording);
      console.log('[GroupCall] Recording status notified:', { callGroupId, isRecording: newIsRecording });
    } catch (err: any) {
      console.error('[GroupCall] Failed to toggle recording:', err.message);
      // Clean up if we were trying to start
      if (newIsRecording) {
        callRecordingService.clearCurrentRecording();
        recordingStartTimeRef.current = null;
      }
      Alert.alert('Recording Error', 'Failed to update recording status. Please try again.');
    }
  }, [isRecording, recordingEnabled, conversationId, type]);


  // Handle LiveKit connection errors
  // IMPORTANT: This hook MUST be defined before any early returns to comply with Rules of Hooks
  const handleLiveKitError = useCallback((error: Error) => {
    console.error('[GroupCall] LiveKit error:', error.message);
    console.error('[GroupCall] LiveKit error stack:', error.stack);
    console.error('[GroupCall] LiveKit error full:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Check if this is the username null error
    const errorMessage = error.message || '';
    if (errorMessage.includes('username == null') || errorMessage.includes('IllegalArgumentException')) {
      console.error('[GroupCall] Username null error detected - this is a LiveKit token/identity issue');
      console.error('[GroupCall] Token (first 50 chars):', token?.substring(0, 50) || 'NO TOKEN');
      console.error('[GroupCall] ServerUrl:', serverUrl);
      console.error('[GroupCall] Current user:', JSON.stringify(user));
    }

    setError(error.message || 'LiveKit connection error');
    Alert.alert('Connection Error', error.message || 'Failed to connect to call', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [navigation, token, serverUrl, user]);

  // Handle successful LiveKit connection
  // IMPORTANT: This hook MUST be defined before any early returns to comply with Rules of Hooks
  const handleLiveKitConnected = useCallback(async () => {
    console.log('[GroupCall] LiveKit connected successfully');
    console.log('[GroupCall] Connection established with token:', token?.substring(0, 30) || 'NO TOKEN');
    console.log('[GroupCall] User identity used:', username);
    setIsConnecting(false);
    // Track connection time for call duration calculation
    connectedTimeRef.current = Date.now();
    // Add current user to participants list
    if (username && !participantsRef.current.includes(username)) {
      participantsRef.current.push(username);
    }
    // Join SignalR call notification group to receive recording status updates
    try {
      const signalR = getSignalR();
      const callGroupId = `group-${conversationId}`;
      await signalR.joinCallNotificationGroup(callGroupId);
      console.log('[GroupCall] Joined call notification group:', callGroupId);
    } catch (err: any) {
      console.warn('[GroupCall] Failed to join call notification group:', err.message);
    }
  }, [token, username, conversationId]);

  // Handle LiveKit disconnection
  // IMPORTANT: This hook MUST be defined before any early returns to comply with Rules of Hooks
  const handleLiveKitDisconnected = useCallback(() => {
    console.log('[GroupCall] LiveKit disconnected');
    setIsReconnecting(false);
  }, []);

  // Handle LiveKit reconnecting (ping timeout triggers this)
  // IMPORTANT: This hook MUST be defined before any early returns to comply with Rules of Hooks
  const handleLiveKitReconnecting = useCallback(() => {
    console.log('[GroupCall] LiveKit reconnecting - ping timeout or network issue detected');
    setIsReconnecting(true);
  }, []);

  // Handle LiveKit successfully reconnected
  // IMPORTANT: This hook MUST be defined before any early returns to comply with Rules of Hooks
  const handleLiveKitReconnected = useCallback(() => {
    console.log('[GroupCall] LiveKit reconnected successfully');
    setIsReconnecting(false);
  }, []);

  // Handle participants changed - update ref for call message
  const handleParticipantsChanged = useCallback((participantNames: string[]) => {
    participantsRef.current = participantNames;
    console.log('[GroupCall] Participants updated:', participantNames);
  }, []);

  // Listen for remote recording status changes
  useEffect(() => {
    const signalR = getSignalR();
    const callGroupId = `group-${conversationId}`;

    const unsubscribe = signalR.onCallEvent('RecordingStatusChanged', (data: {
      callId: string;
      userId: string;
      userName: string;
      isRecording: boolean;
    }) => {
      // Check if this is for our call
      if (data.callId.includes(conversationId) && data.userId !== user?.id) {
        console.log('[GroupCall] Remote recording status changed:', data);
        if (data.isRecording) {
          setRemoteRecording({ userName: data.userName, isRecording: true });
        } else {
          setRemoteRecording(null);
        }
      }
    });

    return () => {
      unsubscribe();
      // Leave call notification group on cleanup
      signalR.leaveCallNotificationGroup(callGroupId).catch(() => {});
    };
  }, [conversationId, user?.id]);

  if (!LiveKitRoom) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorTitle}>LiveKit Not Available</Text>
          <Text style={styles.errorMessage}>
            Group video calls require the LiveKit SDK which is not installed.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isConnecting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Joining call...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !token || !serverUrl || !username) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorMessage}>
            {error || (!username ? 'User identity not available. Please log in again.' : 'Unable to connect to the call')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchToken}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Debug: Log state right before rendering LiveKitRoom
  console.log('[GroupCall] Rendering LiveKitRoom with:', {
    serverUrl,
    hasToken: !!token,
    tokenLength: token?.length,
    tokenPreview: token?.substring(0, 50),
    username,
    userId: user?.id,
    isMuted,
    isVideoEnabled,
    iceServersCount: iceServers.length,
  });

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      options={{
        adaptiveStream: true,
        dynacast: true,
        // Custom reconnect policy for better handling of ping timeouts
        // Uses exponential backoff: 1s, 2s, 4s, 8s... up to 30s, max 10 retries or 2 minutes
        reconnectPolicy: reconnectPolicy,
      }}
      connectOptions={{
        // Increase WebSocket timeout for unreliable networks and self-signed certificates
        websocketTimeout: 30000, // 30 seconds (default is 15s)
        // Increase peer connection timeout
        peerConnectionTimeout: 30000, // 30 seconds (default is 15s)
        // Allow more retries for initial connection
        maxRetries: 5,
        autoSubscribe: true,
        // Provide our own sanitized rtcConfig to prevent using server-provided ICE servers
        // This fixes "username == null" error on Android where server sends ICE servers
        // with null username/credential values that crash the native WebRTC module
        rtcConfig: {
          iceServers: iceServers,
        },
      }}
      audio={!isMuted}
      video={isVideoEnabled}
      onConnected={handleLiveKitConnected}
      onDisconnected={handleLiveKitDisconnected}
      onError={handleLiveKitError}
    >
      <RoomContentWithConnectionState
        roomName={roomName || conversationName || ''}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isSpeakerOn={isSpeakerOn}
        isRecording={isRecording}
        isRecordingEnabled={recordingEnabled}
        remoteRecording={remoteRecording}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleSpeaker={handleToggleSpeaker}
        onToggleRecording={handleToggleRecording}
        onEndCall={handleEndCall}
        onReconnecting={handleLiveKitReconnecting}
        onReconnected={handleLiveKitReconnected}
        onParticipantsChanged={handleParticipantsChanged}
        colors={colors}
        styles={styles}
      />
    </LiveKitRoom>
  );
};

interface RoomContentProps {
  roomName: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  isRecording: boolean;
  isRecordingEnabled: boolean;
  remoteRecording: { userName: string; isRecording: boolean } | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onToggleRecording: () => void;
  onEndCall: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onParticipantsChanged?: (participants: string[]) => void;
  colors: any;
  styles: any;
}

// Wrapper component that handles connection state monitoring
// This tracks reconnecting/reconnected states for ping timeout recovery
const RoomContentWithConnectionState: React.FC<RoomContentProps> = (props) => {
  const { onReconnecting, onReconnected } = props;

  // Use connection state hook to monitor for reconnecting states
  const connectionState = useConnectionState ? useConnectionState() : null;
  const prevConnectionState = React.useRef(connectionState);

  // Handle connection state changes
  React.useEffect(() => {
    if (!connectionState || !ConnectionState) return;

    const prevState = prevConnectionState.current;
    prevConnectionState.current = connectionState;

    console.log('[GroupCall] Connection state changed:', prevState, '->', connectionState);

    // Detect transition to reconnecting state (ping timeout triggers this)
    if (
      connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting
    ) {
      onReconnecting();
    }

    // Detect successful reconnection
    if (
      prevState &&
      (prevState === ConnectionState.Reconnecting || prevState === ConnectionState.SignalReconnecting) &&
      connectionState === ConnectionState.Connected
    ) {
      onReconnected();
    }
  }, [connectionState, onReconnecting, onReconnected]);

  // Determine if we're in a reconnecting state
  const isReconnecting = connectionState && ConnectionState && (
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting
  );

  // Check if room is fully connected
  const isRoomConnected = connectionState === ConnectionState?.Connected;

  return <RoomContent {...props} isReconnecting={isReconnecting} isRoomConnected={isRoomConnected} />;
};

interface RoomContentInnerProps extends Omit<RoomContentProps, 'onReconnecting' | 'onReconnected'> {
  isReconnecting?: boolean;
  isRoomConnected?: boolean;
}

// Minimum number of participants to stay in the call (just yourself = alone)
const MIN_PARTICIPANTS_TO_STAY = 1;
// Delay before auto-ending call when alone (in milliseconds)
const AUTO_END_DELAY_MS = 5000;

const RoomContent: React.FC<RoomContentInnerProps> = ({
  roomName,
  isMuted,
  isVideoEnabled,
  isSpeakerOn,
  isRecording,
  isRecordingEnabled,
  remoteRecording,
  isReconnecting,
  isRoomConnected,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onToggleRecording,
  onEndCall,
  onParticipantsChanged,
  colors,
  styles,
}) => {
  const participants = useParticipants ? useParticipants() : [];
  const tracks = useTracks ? useTracks([Track?.Source?.Camera, Track?.Source?.ScreenShare]) : [];

  // Notify parent of participants changes for call message
  React.useEffect(() => {
    if (onParticipantsChanged && participants.length > 0) {
      const participantNames = participants.map(
        (p: any) => p.name || p.identity || 'Unknown'
      );
      onParticipantsChanged(participantNames);
    }
  }, [participants, onParticipantsChanged]);

  // Get local participant for controlling camera/microphone
  const localParticipantState = useLocalParticipant ? useLocalParticipant() : null;
  const localParticipant = localParticipantState?.localParticipant;

  // Track if cleanup is in progress to prevent multiple cleanup attempts
  const isCleaningUpRef = React.useRef(false);

  // Enhanced end call handler that properly cleans up tracks before disconnecting
  // This prevents the "NegotiationError: PC manager is closed" warning
  const handleEndCallWithCleanup = React.useCallback(async () => {
    if (isCleaningUpRef.current) {
      console.log('[GroupCall] Cleanup already in progress, skipping');
      return;
    }
    isCleaningUpRef.current = true;

    console.log('[GroupCall] Starting graceful cleanup before ending call...');

    try {
      if (localParticipant) {
        // Disable camera and microphone before disconnecting
        // This stops track negotiation and prevents the NegotiationError
        console.log('[GroupCall] Disabling local tracks...');

        // Wrap in try-catch to handle any errors during track disable
        try {
          await localParticipant.setCameraEnabled(false);
          console.log('[GroupCall] Camera disabled');
        } catch (e) {
          console.log('[GroupCall] Camera disable skipped (may already be off)');
        }

        try {
          await localParticipant.setMicrophoneEnabled(false);
          console.log('[GroupCall] Microphone disabled');
        } catch (e) {
          console.log('[GroupCall] Microphone disable skipped (may already be off)');
        }

        // Small delay to allow track negotiation to settle
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      // Log but don't block the call end - user wants to leave
      console.log('[GroupCall] Cleanup error (non-blocking):', error);
    }

    console.log('[GroupCall] Cleanup complete, ending call');
    onEndCall();
  }, [localParticipant, onEndCall]);

  // Track if initial camera/mic setup has been done
  const initialSetupDoneRef = React.useRef(false);

  // Simple camera enable - let LiveKit handle device selection
  // This avoids OverconstrainedError by not specifying constraints
  const enableCameraSimple = React.useCallback(async (participant: any): Promise<boolean> => {
    try {
      console.log('[GroupCall] Enabling camera (simple mode, no constraints)');
      // Use simple setCameraEnabled(true) without any constraints
      // LiveKit will automatically select an available camera
      await participant.setCameraEnabled(true);
      console.log('[GroupCall] Camera enabled successfully');
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || '';
      console.warn('[GroupCall] Camera enable failed:', errorMessage);

      // Don't throw - camera failure shouldn't crash the call
      // User can still participate with audio
      return false;
    }
  }, []);

  // Initial setup: Enable camera/microphone when room is fully connected
  // IMPORTANT: Wait for isRoomConnected to be true before enabling tracks
  // This prevents "publishing rejected as engine not connected" errors
  React.useEffect(() => {
    // Don't proceed if:
    // - No local participant yet
    // - Already did initial setup
    // - Room is not connected yet (this is the key check!)
    if (!localParticipant || initialSetupDoneRef.current || !isRoomConnected) {
      if (!isRoomConnected && localParticipant && !initialSetupDoneRef.current) {
        console.log('[GroupCall] Waiting for room to be connected before enabling tracks...');
      }
      return;
    }

    const doInitialSetup = async () => {
      console.log('[GroupCall] Room connected - enabling camera and microphone');
      try {
        // Enable microphone first (unless muted) - audio is more important
        if (!isMuted) {
          console.log('[GroupCall] Initial setup - enabling microphone');
          try {
            await localParticipant.setMicrophoneEnabled(true);
            console.log('[GroupCall] Initial microphone enabled successfully');
          } catch (micErr: any) {
            console.warn('[GroupCall] Microphone enable failed:', micErr.message);
          }
        }

        // Enable camera for video calls
        if (isVideoEnabled) {
          console.log('[GroupCall] Initial setup - enabling camera');
          const cameraEnabled = await enableCameraSimple(localParticipant);
          if (cameraEnabled) {
            console.log('[GroupCall] Initial camera enabled successfully');
          } else {
            console.warn('[GroupCall] Camera could not be enabled, continuing without video');
          }
        }

        initialSetupDoneRef.current = true;
      } catch (err: any) {
        console.error('[GroupCall] Initial setup failed:', err.message);
        // Still mark as done to prevent retry loops
        initialSetupDoneRef.current = true;
      }
    };

    // Small delay to ensure everything is stable after connection
    const timeoutId = setTimeout(doInitialSetup, 300);
    return () => clearTimeout(timeoutId);
  }, [localParticipant, isVideoEnabled, isMuted, enableCameraSimple, isRoomConnected]);

  // Sync local participant camera state with UI toggles (after initial setup)
  React.useEffect(() => {
    // Don't sync if not ready or room not connected
    if (!localParticipant || !initialSetupDoneRef.current || !isRoomConnected) {
      console.log('[GroupCall] Skipping camera sync - not ready');
      return;
    }

    const syncCamera = async () => {
      try {
        const currentCameraEnabled = localParticipantState?.isCameraEnabled ?? false;
        if (currentCameraEnabled !== isVideoEnabled) {
          console.log('[GroupCall] Syncing camera state:', { isVideoEnabled, currentCameraEnabled });
          if (isVideoEnabled) {
            // Use simple enable when toggling camera on
            await enableCameraSimple(localParticipant);
          } else {
            // Disabling camera is straightforward
            await localParticipant.setCameraEnabled(false);
          }
          console.log('[GroupCall] Camera state synced successfully');
        }
      } catch (err: any) {
        console.warn('[GroupCall] Failed to toggle camera:', err.message);
      }
    };

    syncCamera();
  }, [isVideoEnabled, localParticipant, localParticipantState?.isCameraEnabled, enableCameraSimple, isRoomConnected]);

  // Sync local participant microphone state with UI toggles (after initial setup)
  React.useEffect(() => {
    // Don't sync if not ready or room not connected
    if (!localParticipant || !initialSetupDoneRef.current || !isRoomConnected) {
      console.log('[GroupCall] Skipping microphone sync - not ready');
      return;
    }

    const syncMicrophone = async () => {
      try {
        const currentMicEnabled = localParticipantState?.isMicrophoneEnabled ?? true;
        const shouldMicBeEnabled = !isMuted;
        if (currentMicEnabled !== shouldMicBeEnabled) {
          console.log('[GroupCall] Syncing microphone state:', { isMuted, currentMicEnabled, shouldMicBeEnabled });
          await localParticipant.setMicrophoneEnabled(shouldMicBeEnabled);
          console.log('[GroupCall] Microphone state synced successfully');
        }
      } catch (err: any) {
        console.warn('[GroupCall] Failed to toggle microphone:', err.message);
      }
    };

    syncMicrophone();
  }, [isMuted, localParticipant, localParticipantState?.isMicrophoneEnabled, isRoomConnected]);

  // Log camera errors if any
  React.useEffect(() => {
    if (localParticipantState?.lastCameraError) {
      console.error('[GroupCall] Camera error:', localParticipantState.lastCameraError);
    }
  }, [localParticipantState?.lastCameraError]);

  // Log microphone errors if any
  React.useEffect(() => {
    if (localParticipantState?.lastMicrophoneError) {
      console.error('[GroupCall] Microphone error:', localParticipantState.lastMicrophoneError);
    }
  }, [localParticipantState?.lastMicrophoneError]);

  // State for auto-end call when alone
  const [isAlone, setIsAlone] = useState(false);
  const [autoEndCountdown, setAutoEndCountdown] = useState<number | null>(null);
  const autoEndTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const hasHadOtherParticipantsRef = React.useRef(false);

  // Track when we've had other participants (to avoid auto-ending immediately on join)
  React.useEffect(() => {
    if (participants.length > MIN_PARTICIPANTS_TO_STAY) {
      hasHadOtherParticipantsRef.current = true;
    }
  }, [participants.length]);

  // Detect when user is alone in the call and auto-end after delay
  React.useEffect(() => {
    const isCurrentlyAlone = participants.length <= MIN_PARTICIPANTS_TO_STAY;

    // Only consider auto-ending if we previously had other participants
    // This prevents auto-ending when joining an empty room or being the first to join
    if (isCurrentlyAlone && hasHadOtherParticipantsRef.current) {
      console.log('[GroupCall] User is alone in the call, starting auto-end timer...');
      setIsAlone(true);
      setAutoEndCountdown(AUTO_END_DELAY_MS / 1000);

      // Start countdown display
      countdownIntervalRef.current = setInterval(() => {
        setAutoEndCountdown((prev) => {
          if (prev !== null && prev > 1) {
            return prev - 1;
          }
          return prev;
        });
      }, 1000);

      // Set timer to end call with proper cleanup
      autoEndTimerRef.current = setTimeout(() => {
        console.log('[GroupCall] Auto-ending call - all other participants have left');
        handleEndCallWithCleanup();
      }, AUTO_END_DELAY_MS);
    } else {
      // Clear timer if someone else joins or we haven't had participants yet
      if (autoEndTimerRef.current) {
        console.log('[GroupCall] Other participant joined, canceling auto-end timer');
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setIsAlone(false);
      setAutoEndCountdown(null);
    }

    return () => {
      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [participants.length, handleEndCallWithCleanup]);

  const gridSize = Math.ceil(Math.sqrt(Math.max(participants.length, 1)));
  const tileWidth = width / gridSize - 8;
  const tileHeight = (height - 200) / gridSize - 8;

  return (
    <SafeAreaView style={styles.container}>
      {/* Reconnecting banner - shows when ping timeout triggers reconnection */}
      {isReconnecting && (
        <View style={styles.reconnectingBanner}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.reconnectingText}>Reconnecting...</Text>
        </View>
      )}

      {/* Alone in call banner - shows when all other participants have left */}
      {isAlone && autoEndCountdown !== null && (
        <View style={styles.aloneBanner}>
          <Icon name="person-outline" size={20} color={colors.white} />
          <Text style={styles.aloneText}>
            Everyone has left. Call ending in {autoEndCountdown}s...
          </Text>
        </View>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording</Text>
        </View>
      )}

      {/* Remote recording indicator */}
      {remoteRecording && remoteRecording.isRecording && !isRecording && (
        <View style={styles.remoteRecordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>{remoteRecording.userName} is recording</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.participantCount}>
          {participants.length === 1
            ? '1 participant'
            : `${participants.length} participants`}
          {participants.length > 0 && participants.length <= 5 && (
            `: ${participants
              .map((p: any) => p.name || p.identity || 'Unknown')
              .join(', ')}`
          )}
        </Text>
      </View>

      <View style={styles.videoGrid}>
        {tracks.length > 0 ? (
          tracks.map((track: any, index: number) => {
            if (!isTrackReference || !isTrackReference(track)) {
              return null;
            }
            return (
              <View
                key={track.participant.identity + '-' + index}
                style={[styles.videoTile, { width: tileWidth, height: tileHeight }]}
              >
                <VideoTrack style={styles.videoView} trackRef={track} objectFit="cover" />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {track.participant.name || track.participant.identity}
                  </Text>
                  {track.participant.isSpeaking && (
                    <Icon name="volume-high" size={14} color={colors.success} />
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.noVideoContainer}>
            <Icon name="videocam-off" size={48} color={colors.textSecondary} />
            <Text style={styles.noVideoText}>No video streams</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={onToggleMute}
        >
          <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
          onPress={onToggleVideo}
        >
          <Icon
            name={isVideoEnabled ? 'videocam' : 'videocam-off'}
            size={28}
            color={colors.white}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCallWithCleanup}>
          <Icon name="call" size={32} color={colors.white} style={styles.endCallIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={onToggleSpeaker}
        >
          <Icon name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={28} color={colors.white} />
        </TouchableOpacity>

        {isRecordingEnabled && (
          <TouchableOpacity
            style={[styles.controlButton, isRecording && styles.recordingButtonActive]}
            onPress={onToggleRecording}
          >
            <Icon name={isRecording ? 'stop-circle' : 'radio-button-on'} size={28} color={isRecording ? colors.white : colors.error} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.controlButton}>
          <Icon name="camera-reverse" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    backButton: {
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    container: { backgroundColor: colors.gray?.[900] || '#1a1a1a', flex: 1 },
    controlButton: {
      alignItems: 'center',
      backgroundColor: colors.gray?.[700] || '#444',
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginHorizontal: 8,
      width: 56,
    },
    controlButtonActive: { backgroundColor: colors.primary },
    controls: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 24,
    },
    endCallButton: {
      backgroundColor: colors.error,
      borderRadius: 32,
      height: 64,
      width: 64,
    },
    endCallIcon: { transform: [{ rotate: '135deg' }] },
    errorContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
    errorMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 24,
      marginTop: 8,
      textAlign: 'center',
    },
    errorTitle: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 16 },
    header: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    loadingText: { color: colors.white, fontSize: 16, marginTop: 16 },
    noVideoContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    noVideoText: { color: colors.textSecondary, fontSize: 16, marginTop: 12 },
    participantCount: { color: colors.gray?.[400] || '#888', fontSize: 14, marginTop: 4 },
    participantInfo: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      bottom: 0,
      flexDirection: 'row',
      left: 0,
      padding: 8,
      position: 'absolute',
      right: 0,
    },
    participantName: { color: colors.white, flex: 1, fontSize: 12 },
    reconnectingBanner: {
      alignItems: 'center',
      backgroundColor: colors.warning || '#f59e0b',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    reconnectingText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    aloneBanner: {
      alignItems: 'center',
      backgroundColor: colors.error || '#ef4444',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    aloneText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
    recordingBanner: {
      alignItems: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    remoteRecordingBanner: {
      alignItems: 'center',
      backgroundColor: 'rgba(249, 115, 22, 0.9)',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    recordingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.white,
      marginRight: 8,
    },
    recordingText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    recordingButtonActive: {
      backgroundColor: colors.error || '#ef4444',
    },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginBottom: 12,
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    retryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
    roomName: { color: colors.white, fontSize: 18, fontWeight: '600' },
    videoGrid: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      padding: 4,
    },
    videoTile: {
      backgroundColor: colors.gray?.[800] || '#2a2a2a',
      borderRadius: 12,
      margin: 4,
      overflow: 'hidden',
    },
    videoView: { flex: 1 },
  });

export default GroupCallScreen;
