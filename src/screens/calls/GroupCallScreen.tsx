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
let VideoView: any = null;
let useParticipants: any = null;
let useTracks: any = null;
let useConnectionState: any = null;
let Track: any = null;
let ConnectionState: any = null;
let isTrackReference: any = null;

try {
  const livekit = require('@livekit/react-native');
  // Track and ConnectionState are exported from livekit-client, not react-native
  const livekitClient = require('livekit-client');
  LiveKitRoom = livekit.LiveKitRoom;
  VideoView = livekit.VideoView;
  useParticipants = livekit.useParticipants;
  useTracks = livekit.useTracks;
  useConnectionState = livekit.useConnectionState;
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
  const { conversationId, conversationName, type } = route.params;
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
      if (!notificationSent) {
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
  }, [conversationId, navigation, type, notificationSent, username, user, isAuthenticated]);

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

  const handleEndCall = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => !prev);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

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
  const handleLiveKitConnected = useCallback(() => {
    console.log('[GroupCall] LiveKit connected successfully');
    console.log('[GroupCall] Connection established with token:', token?.substring(0, 30) || 'NO TOKEN');
    console.log('[GroupCall] User identity used:', username);
    setIsConnecting(false);
  }, [token, username]);

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
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleSpeaker={handleToggleSpeaker}
        onEndCall={handleEndCall}
        onReconnecting={handleLiveKitReconnecting}
        onReconnected={handleLiveKitReconnected}
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
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
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

  return <RoomContent {...props} isReconnecting={isReconnecting} />;
};

interface RoomContentInnerProps extends Omit<RoomContentProps, 'onReconnecting' | 'onReconnected'> {
  isReconnecting?: boolean;
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
  isReconnecting,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
  colors,
  styles,
}) => {
  const participants = useParticipants ? useParticipants() : [];
  const tracks = useTracks ? useTracks([Track?.Source?.Camera, Track?.Source?.ScreenShare]) : [];

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

      // Set timer to end call
      autoEndTimerRef.current = setTimeout(() => {
        console.log('[GroupCall] Auto-ending call - all other participants have left');
        onEndCall();
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
  }, [participants.length, onEndCall]);

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

      <View style={styles.header}>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.participantCount}>{participants.length} participants</Text>
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
                <VideoView style={styles.videoView} trackRef={track} objectFit="cover" />
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

        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={onEndCall}>
          <Icon name="call" size={32} color={colors.white} style={styles.endCallIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={onToggleSpeaker}
        >
          <Icon name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={28} color={colors.white} />
        </TouchableOpacity>

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
