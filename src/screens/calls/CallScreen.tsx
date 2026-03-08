import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
  StatusBar,
  Vibration,
  Platform,
  Animated,
} from 'react-native';
import { RTCView, MediaStream } from '@livekit/react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { webRTCService, CallState } from '../../services/webrtcService';
import { signalRService } from '../../services/signalr';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, CallsStackParamList } from '../../navigation/types';

const { width: _screenWidth, height: _screenHeight } = Dimensions.get('window');

// Support both ActiveCall (root level) and Call (within calls stack)
type ActiveCallScreenProps = NativeStackScreenProps<RootStackParamList, 'ActiveCall'>;
type CallStackScreenProps = NativeStackScreenProps<CallsStackParamList, 'Call'>;
type CallScreenProps = ActiveCallScreenProps | CallStackScreenProps;

const CallScreen: React.FC<CallScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  // Get current user to determine if we're the caller or callee
  const currentUser = useAuthStore((state) => state.user);
  const params = route.params || {};
  const { call, user, type, isIncoming: isIncomingParam } = params as {
    call?: any;
    user?: any;
    type?: 'voice' | 'video';
    isIncoming?: boolean;
  };

  // Settings store for recording enabled check
  const fetchPublicSettings = useSettingsStore((state) => state.fetchPublicSettings);
  const isRecordingEnabledSetting = useSettingsStore((state) => state.isRecordingEnabled);

  // State
  const [callState, setCallState] = useState<CallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [remoteIsRecording, setRemoteIsRecording] = useState(false);
  const [remoteRecorderName, setRemoteRecorderName] = useState<string | null>(null);

  // Recording animation
  const recordingPulse = useRef(new Animated.Value(1)).current;

  // CRITICAL: Track whether incoming call has been accepted by the user
  // This prevents auto-initialization of WebRTC before user accepts
  const [hasAcceptedCall, setHasAcceptedCall] = useState(false);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // ROBUST incoming call detection - check multiple indicators
  // 1. Route param isIncoming (most reliable when passed from RootNavigator)
  // 2. call.status === 'Incoming' (set in App.tsx handler)
  // 3. call.callerId exists and is NOT our user ID (we're the callee)
  const callerId = call?.callerId || call?.caller?.id;
  const isCalleeByUserId = callerId && currentUser?.id && callerId !== currentUser.id;

  const isIncoming =
    isIncomingParam === true ||
    call?.direction === 'incoming' ||
    call?.status === 'Incoming' ||
    call?.status === 'incoming' ||  // Check lowercase too
    isCalleeByUserId === true;

  // Debug logging for incoming call detection
  console.log('[CallScreen] Incoming call detection:', {
    isIncomingParam,
    callDirection: call?.direction,
    callStatus: call?.status,
    callerId,
    currentUserId: currentUser?.id,
    isCalleeByUserId,
    FINAL_isIncoming: isIncoming,
    hasAcceptedCall: false, // logged before state is available
  });
  const isVideo = type === 'video' || callState?.type === 'video';
  const isConnected = callState?.status === 'connected';

  // Get display user info
  const displayName =
    user?.name ||
    user?.displayName ||
    user?.username ||
    call?.caller?.displayName ||
    call?.caller?.username ||
    call?.participants?.[0]?.user?.name ||
    callState?.remoteUserName ||
    'Unknown';
  const displayAvatar =
    user?.avatarUrl ||
    call?.caller?.avatarUrl ||
    call?.participants?.[0]?.user?.avatarUrl ||
    callState?.remoteUserAvatar;

  // Fetch settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      await fetchPublicSettings();
      const isEnabled = isRecordingEnabledSetting();
      console.log('[CallScreen] Recording enabled from settings:', isEnabled);
      setRecordingEnabled(isEnabled);
    };
    loadSettings();
  }, [fetchPublicSettings, isRecordingEnabledSetting]);

  // Recording pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingPulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      recordingPulse.setValue(1);
    }
  }, [isRecording, recordingPulse]);

  // Subscribe to recording status changes
  useEffect(() => {
    const unsubscribe = signalRService.onCallEvent('RecordingStatusChanged', (data: any) => {
      console.log('[CallScreen] RecordingStatusChanged event:', data);
      const {
        callId: eventCallId,
        userId,
        userName,
        isRecording: eventIsRecording,
      } = data;

      // Check if this event is for our call
      const ourCallId = call?.id;
      if (eventCallId !== ourCallId) {
        console.log('[CallScreen] Recording event for different call, ignoring');
        return;
      }

      // Check if this is our own recording status or remote
      if (userId === currentUser?.id) {
        // This is our own recording status confirmation
        console.log('[CallScreen] Own recording status confirmed:', eventIsRecording);
      } else {
        // Remote user's recording status
        setRemoteIsRecording(eventIsRecording);
        setRemoteRecorderName(eventIsRecording ? userName : null);
        console.log('[CallScreen] Remote user recording:', userName, eventIsRecording);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [call?.id, currentUser?.id]);

  // Vibration for incoming calls
  useEffect(() => {
    // Only vibrate for incoming calls that haven't been accepted yet
    if (isIncoming && !hasAcceptedCall) {
      const vibrationPattern =
        Platform.OS === 'android' ? [0, 1000, 1000, 1000, 1000, 1000] : [0, 1000];
      Vibration.vibrate(vibrationPattern, true);

      return () => {
        Vibration.cancel();
      };
    }
    return undefined;
  }, [isIncoming, hasAcceptedCall]);

  // Setup WebRTC callbacks
  useEffect(() => {
    webRTCService.setCallbacks({
      onLocalStream: (stream) => {
        console.log('[CallScreen] Got local stream');
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        console.log('[CallScreen] Got remote stream');
        setRemoteStream(stream);
      },
      onCallStateChange: (state) => {
        console.log('[CallScreen] Call state changed:', state.status);
        setCallState(state);
        setIsConnecting(state.status === 'connecting' || state.status === 'ringing');

        if (state.status === 'connected') {
          // Start duration timer
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(webRTCService.getCallDuration());
            }, 1000);
          }
        }
      },
      onError: (err) => {
        console.error('[CallScreen] WebRTC error:', err.message);
        setError(err.message);
        Alert.alert('Call Error', err.message);
      },
      onCallEnded: (reason) => {
        console.log('[CallScreen] Call ended:', reason);
        handleCallEnded(reason);
      },
    });

    return () => {
      // Cleanup
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Initialize call - ONLY for outgoing calls or after incoming call is accepted
  useEffect(() => {
    // Prevent double initialization
    if (hasInitializedRef.current) {
      return;
    }

    // CRITICAL FIX: For incoming calls, do NOT initialize WebRTC until user accepts
    // The user must tap "Accept" first, which sets hasAcceptedCall to true
    if (isIncoming && !hasAcceptedCall) {
      console.log('[CallScreen] Incoming call - waiting for user to accept before initializing WebRTC');
      return;
    }

    const initCall = async () => {
      // Mark as initialized to prevent double initialization
      hasInitializedRef.current = true;

      try {
        const callId = call?.id || `call-${Date.now()}`;
        // For incoming calls, use callerId; for outgoing, use user.id
        const remoteUserId = isIncoming
          ? (call?.callerId || call?.caller?.id || '')
          : (user?.id || call?.participants?.[0]?.userId || '');

        // isInitiator should be true only when this user is starting the call (caller)
        // For incoming calls (callee), isInitiator should be false
        const isInitiator = !isIncoming;

        console.log('[CallScreen] Initializing call:', {
          callId,
          type,
          isInitiator,
          isIncoming,
          isIncomingParam,
          hasAcceptedCall,
          remoteUserId,
        });

        await webRTCService.initializeCall(
          callId,
          type || 'voice',
          isInitiator,
          remoteUserId,
          displayName,
          displayAvatar
        );

        // CRITICAL: Only call initiateCall if this user is the CALLER (starting the call)
        // The callee (receiving the call) should NOT call initiateCall - they should wait
        // for the WebRTC offer/answer exchange to happen
        if (isInitiator && remoteUserId) {
          console.log('[CallScreen] Caller: Initiating call via SignalR to:', remoteUserId);
          await signalRService.initiateCall(remoteUserId, type || 'voice');
        } else {
          console.log('[CallScreen] Callee: Waiting for WebRTC offer/answer (NOT calling initiateCall)');
        }
      } catch (err: any) {
        console.error('[CallScreen] Failed to initialize call:', err);
        setError(err?.message || 'Failed to start call');
        hasInitializedRef.current = false; // Allow retry
      }
    };

    initCall();

    return () => {
      // Cleanup on unmount
      webRTCService.endCall();
    };
  }, [isIncoming, hasAcceptedCall]); // Re-run when hasAcceptedCall changes
  // Safe navigation helper - handles case when CallScreen is presented as modal
  // with no screen to go back to
  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // No screen to go back to, reset to Main screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      });
    }
  }, [navigation]);

  const handleCallEnded = useCallback(
    (_reason?: string) => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Navigate back after a short delay
      setTimeout(() => {
        safeGoBack();
      }, 500);
    },
    [safeGoBack]
  );

  const handleEndCall = useCallback(() => {
    // Stop recording if active before ending call
    if (isRecording) {
      setIsRecording(false);
    }
    webRTCService.endCall();
  }, [isRecording]);

  const handleAcceptCall = useCallback(async () => {
    if (!call?.id) {
      console.error('[CallScreen] Cannot accept call: no call ID');
      return;
    }

    // Stop vibration
    Vibration.cancel();

    try {
      console.log('[CallScreen] User accepted call:', call.id);

      // First, tell the server we're accepting the call
      // This must happen BEFORE we initialize WebRTC
      await signalRService.answerCall(call.id);
      console.log('[CallScreen] Sent answerCall to server');

      // Now mark call as accepted - this will trigger WebRTC initialization
      setHasAcceptedCall(true);

    } catch (err) {
      console.error('[CallScreen] Failed to accept call:', err);
      setError('Failed to accept call');
    }
  }, [call?.id]);

  const handleRejectCall = useCallback(async () => {
    // Stop vibration
    Vibration.cancel();

    if (!call?.id) {
      safeGoBack();
      return;
    }

    try {
      console.log('[CallScreen] Rejecting call:', call.id);
      await signalRService.rejectCall(call.id);
      safeGoBack();
    } catch (err) {
      console.error('[CallScreen] Failed to reject call:', err);
      safeGoBack();
    }
  }, [call?.id, safeGoBack]);

  const handleToggleMute = useCallback(() => {
    const newMuted = webRTCService.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const handleToggleVideo = useCallback(() => {
    const newDisabled = webRTCService.toggleVideo();
    setIsVideoEnabled(!newDisabled);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    const newSpeaker = webRTCService.toggleSpeaker();
    setIsSpeakerOn(newSpeaker);
  }, []);

  const handleSwitchCamera = useCallback(async () => {
    await webRTCService.switchCamera();
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (!call?.id) {
      console.error('[CallScreen] Cannot toggle recording: no call ID');
      return;
    }

    const newRecordingState = !isRecording;

    try {
      console.log('[CallScreen] Toggling recording:', newRecordingState);
      await signalRService.notifyRecordingStatus(call.id, newRecordingState);
      setIsRecording(newRecordingState);
    } catch (err: any) {
      console.error('[CallScreen] Failed to toggle recording:', err);
      Alert.alert(
        'Recording Error',
        err?.message || 'Failed to toggle recording. Please try again.'
      );
    }
  }, [call?.id, isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (error) {
      return error;
    }
    if (isConnected) {
      return formatDuration(callDuration);
    }
    // For incoming calls that haven't been accepted yet
    if (isIncoming && !hasAcceptedCall) {
      return 'Incoming call...';
    }
    if (callState?.status === 'ringing') {
      return isIncoming ? 'Connecting...' : 'Ringing...';
    }
    if (isConnecting) {
      return isIncoming ? 'Connecting...' : 'Connecting...';
    }
    return 'Call ended';
  };

  // Show incoming call UI if this is an incoming call and not yet accepted
  // CRITICAL: Use hasAcceptedCall instead of isConnected to determine UI
  const showIncomingControls = isIncoming && !hasAcceptedCall;
  const isActive = isConnected || (!showIncomingControls && (isConnecting || callState?.status === 'ringing'));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gray[900]} />

      {/* Local Recording Indicator */}
      {isRecording && isActive && (
        <Animated.View
          style={[
            styles.recordingIndicator,
            { transform: [{ scale: recordingPulse }] },
          ]}
        >
          <Icon name="radio-button-on" size={12} color={colors.white} />
          <Text style={styles.recordingText}>Recording</Text>
        </Animated.View>
      )}

      {/* Remote Recording Indicator */}
      {remoteIsRecording && isActive && (
        <View style={styles.remoteRecordingIndicator}>
          <Icon name="radio-button-on" size={12} color={colors.white} />
          <Text style={styles.remoteRecordingText}>
            {remoteRecorderName || displayName} is recording this call
          </Text>
        </View>
      )}

      {/* Video Views - only show after call is accepted or for outgoing calls */}
      {isVideo && (hasAcceptedCall || !isIncoming) && (
        <View style={styles.videoContainer}>
          {/* Remote Video (Full Screen) */}
          {remoteStream ? (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={false}
            />
          ) : (
            <View style={styles.remoteVideoPlaceholder}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.placeholderAvatar} />
              ) : (
                <View style={[styles.placeholderAvatar, styles.avatarPlaceholder]}>
                  <Icon name="person" size={64} color={colors.white} />
                </View>
              )}
              <Text style={styles.waitingText}>
                {isConnecting ? 'Waiting for video...' : displayName}
              </Text>
            </View>
          )}

          {/* Local Video (Small PIP) */}
          {localStream && isVideoEnabled && (
            <View style={styles.localVideoContainer}>
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                mirror={true}
                zOrder={1}
              />
            </View>
          )}
        </View>
      )}

      {/* Audio-Only View OR Incoming Call View (before acceptance) */}
      {(!isVideo || (isIncoming && !hasAcceptedCall)) && (
        <View style={styles.audioContainer}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="person" size={64} color={colors.white} />
            </View>
          )}
          <Text style={styles.callerName}>{displayName}</Text>
          <Text style={styles.callStatus}>{getStatusText()}</Text>
          {isIncoming && !hasAcceptedCall && (
            <Text style={styles.callTypeText}>
              {isVideo ? 'Video Call' : 'Voice Call'}
            </Text>
          )}
        </View>
      )}

      {/* Status Overlay for Video (only when connected) */}
      {isVideo && hasAcceptedCall && (
        <View style={styles.statusOverlay}>
          <Text style={styles.overlayName}>{displayName}</Text>
          <Text style={styles.overlayStatus}>{getStatusText()}</Text>
        </View>
      )}

      {/* Controls */}
      {showIncomingControls ? (
        // Incoming Call Controls - Accept/Decline buttons
        <View style={styles.incomingControls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.rejectButton]}
            onPress={handleRejectCall}
          >
            <Icon name="close" size={32} color={colors.white} />
            <Text style={styles.controlLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.acceptButton]}
            onPress={handleAcceptCall}
          >
            <Icon name={isVideo ? 'videocam' : 'call'} size={32} color={colors.white} />
            <Text style={styles.controlLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Active Call Controls
        <View style={styles.controls}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color={colors.white} />
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Video Toggle (only for video calls) */}
          {isVideo && (
            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
              onPress={handleToggleVideo}
            >
              <Icon
                name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                size={28}
                color={colors.white}
              />
              <Text style={styles.controlLabel}>{isVideoEnabled ? 'Stop' : 'Start'}</Text>
            </TouchableOpacity>
          )}

          {/* Recording Button - only show if enabled in settings */}
          {recordingEnabled && (
            <TouchableOpacity
              style={[styles.controlButton, isRecording && styles.recordingButtonActive]}
              onPress={handleToggleRecording}
            >
              <Animated.View style={{ transform: [{ scale: isRecording ? recordingPulse : 1 }] }}>
                <Icon
                  name={isRecording ? 'radio-button-on' : 'radio-button-off'}
                  size={28}
                  color={isRecording ? colors.white : colors.error}
                />
              </Animated.View>
              <Text style={styles.controlLabel}>{isRecording ? 'Stop' : 'Record'}</Text>
            </TouchableOpacity>
          )}

          {/* End Call Button */}
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Icon name="call" size={32} color={colors.white} style={styles.endCallIcon} />
          </TouchableOpacity>

          {/* Speaker Button */}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
            onPress={handleToggleSpeaker}
          >
            <Icon
              name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
              size={28}
              color={colors.white}
            />
            <Text style={styles.controlLabel}>Speaker</Text>
          </TouchableOpacity>

          {/* Switch Camera (only for video calls) */}
          {isVideo && (
            <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera}>
              <Icon name="camera-reverse" size={28} color={colors.white} />
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  acceptButton: {
    backgroundColor: colors.success,
    borderRadius: 35,
    height: 70,
    width: 70,
  },
  audioContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    borderRadius: 70,
    height: 140,
    width: 140,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  callStatus: {
    color: colors.gray[400],
    fontSize: 16,
    marginTop: 8,
  },
  callTypeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
  },
  callerName: {
    color: colors.white,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
  },
  container: {
    backgroundColor: colors.gray[900],
    flex: 1,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: colors.gray[700],
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    marginHorizontal: 8,
    width: 60,
  },
  controlButtonActive: {
    backgroundColor: colors.primary,
  },
  controlLabel: {
    bottom: -20,
    color: colors.white,
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
  },
  controls: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  endCallButton: {
    backgroundColor: colors.error,
    borderRadius: 35,
    height: 70,
    width: 70,
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
  incomingControls: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 48,
    paddingVertical: 32,
  },
  localVideo: {
    backgroundColor: colors.gray[700],
    flex: 1,
  },
  localVideoContainer: {
    borderColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    height: 160,
    overflow: 'hidden',
    position: 'absolute',
    right: 20,
    top: 60,
    width: 120,
  },
  overlayName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  overlayStatus: {
    color: colors.gray[300],
    fontSize: 14,
  },
  placeholderAvatar: {
    borderRadius: 60,
    height: 120,
    marginBottom: 16,
    width: 120,
  },
  recordingButtonActive: {
    backgroundColor: colors.error,
  },
  recordingIndicator: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 8,
    flexDirection: 'row',
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    top: 60,
    zIndex: 10,
  },
  recordingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  rejectButton: {
    backgroundColor: colors.error,
    borderRadius: 35,
    height: 70,
    width: 70,
  },
  remoteRecordingIndicator: {
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 8,
    flexDirection: 'row',
    left: '50%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    top: 100,
    transform: [{ translateX: -100 }],
    zIndex: 10,
  },
  remoteRecordingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  remoteVideo: {
    backgroundColor: colors.gray[800],
    flex: 1,
  },
  remoteVideoPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.gray[800],
    flex: 1,
    justifyContent: 'center',
  },
  statusOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    top: 60,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  waitingText: {
    color: colors.white,
    fontSize: 18,
  },
});

export default CallScreen;
