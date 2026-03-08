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
} from 'react-native';
import { RTCView, MediaStream } from '@livekit/react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
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
  const params = route.params || {};
  const { call, user, type, isIncoming: isIncomingParam } = params as {
    call?: any;
    user?: any;
    type?: 'voice' | 'video';
    isIncoming?: boolean;
  };

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

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use route param isIncoming, fallback to checking call object properties
  const isIncoming = isIncomingParam === true || call?.direction === 'incoming' || call?.status === 'Incoming';
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

  // Initialize call
  useEffect(() => {
    const initCall = async () => {
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
      }
    };

    initCall();

    return () => {
      // Cleanup on unmount
      webRTCService.endCall();
    };
  }, []);

  const handleCallEnded = useCallback(
    (_reason?: string) => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Navigate back after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    },
    [navigation]
  );

  const handleEndCall = useCallback(() => {
    webRTCService.endCall();
  }, []);

  const handleAcceptCall = useCallback(async () => {
    if (!call?.id) {
      console.error('[CallScreen] Cannot accept call: no call ID');
      return;
    }

    try {
      console.log('[CallScreen] Accepting call:', call.id);
      await signalRService.answerCall(call.id);
    } catch (err) {
      console.error('[CallScreen] Failed to accept call:', err);
      setError('Failed to accept call');
    }
  }, [call?.id]);

  const handleRejectCall = useCallback(async () => {
    if (!call?.id) {
      navigation.goBack();
      return;
    }

    try {
      console.log('[CallScreen] Rejecting call:', call.id);
      await signalRService.rejectCall(call.id);
      navigation.goBack();
    } catch (err) {
      console.error('[CallScreen] Failed to reject call:', err);
      navigation.goBack();
    }
  }, [call?.id, navigation]);

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
    if (callState?.status === 'ringing') {
      return isIncoming ? 'Incoming call...' : 'Ringing...';
    }
    if (isConnecting) {
      return isIncoming ? 'Incoming call...' : 'Connecting...';
    }
    return 'Call ended';
  };

  // Show incoming call UI if this is an incoming call and not yet connected
  const showIncomingControls = isIncoming && !isConnected;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gray[900]} />

      {/* Video Views */}
      {isVideo && (
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

      {/* Audio-Only View */}
      {!isVideo && (
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
        </View>
      )}

      {/* Status Overlay for Video */}
      {isVideo && (
        <View style={styles.statusOverlay}>
          <Text style={styles.overlayName}>{displayName}</Text>
          <Text style={styles.overlayStatus}>{getStatusText()}</Text>
        </View>
      )}

      {/* Controls */}
      {showIncomingControls ? (
        // Incoming Call Controls
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
  rejectButton: {
    backgroundColor: colors.error,
    borderRadius: 35,
    height: 70,
    width: 70,
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
