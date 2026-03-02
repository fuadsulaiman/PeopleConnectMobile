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
import { RTCView, MediaStream } from 'react-native-webrtc';
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
  const { call, user, type } = params as { call?: any; user?: any; type?: 'voice' | 'video' };

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

  const isIncoming = call?.direction === 'incoming' && call?.status === 'ringing';
  const isVideo = type === 'video' || callState?.type === 'video';
  const isConnected = callState?.status === 'connected';

  // Get display user info
  const displayName = user?.name || user?.displayName || call?.participants?.[0]?.user?.name || callState?.remoteUserName || 'Unknown';
  const displayAvatar = user?.avatarUrl || call?.participants?.[0]?.user?.avatarUrl || callState?.remoteUserAvatar;

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
        const remoteUserId = user?.id || call?.participants?.[0]?.userId || '';
        const isInitiator = !isIncoming;

        console.log('[CallScreen] Initializing call:', {
          callId,
          type,
          isInitiator,
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

        // If initiating call, signal via SignalR
        if (isInitiator && remoteUserId) {
          await signalRService.initiateCall(remoteUserId, type || 'voice');
        }
      } catch (err) {
        console.error('[CallScreen] Failed to initialize call:', err);
        setError('Failed to start call');
      }
    };

    initCall();

    return () => {
      // Cleanup on unmount
      webRTCService.endCall();
    };
  }, []);

  const handleCallEnded = useCallback((_reason?: string) => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    // Navigate back after a short delay
    setTimeout(() => {
      navigation.goBack();
    }, 500);
  }, [navigation]);

  const handleEndCall = useCallback(() => {
    webRTCService.endCall();
  }, []);

  const handleAcceptCall = useCallback(async () => {
    if (!call?.id) return;

    try {
      await signalRService.answerCall(call.id);
    } catch (err) {
      console.error('[CallScreen] Failed to accept call:', err);
      setError('Failed to accept call');
    }
  }, [call?.id]);

  const handleRejectCall = useCallback(async () => {
    if (!call?.id) return;

    try {
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
    if (error) return error;
    if (isConnected) return formatDuration(callDuration);
    if (callState?.status === 'ringing') return isIncoming ? 'Incoming call...' : 'Ringing...';
    if (isConnecting) return 'Connecting...';
    return 'Call ended';
  };

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
      {isIncoming && callState?.status !== 'connected' ? (
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
              <Icon name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color={colors.white} />
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
            <Icon name={isSpeakerOn ? 'volume-high' : 'volume-medium'} size={28} color={colors.white} />
            <Text style={styles.controlLabel}>Speaker</Text>
          </TouchableOpacity>

          {/* Switch Camera (only for video calls) */}
          {isVideo && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSwitchCamera}
            >
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
  container: {
    flex: 1,
    backgroundColor: colors.gray[900],
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: colors.gray[800],
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: colors.gray[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  waitingText: {
    color: colors.white,
    fontSize: 18,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.white,
  },
  localVideo: {
    flex: 1,
    backgroundColor: colors.gray[700],
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 24,
  },
  callStatus: {
    fontSize: 16,
    color: colors.gray[400],
    marginTop: 8,
  },
  statusOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 32,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gray[700],
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  controlButtonActive: {
    backgroundColor: colors.primary,
  },
  controlLabel: {
    color: colors.white,
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  endCallButton: {
    backgroundColor: colors.error,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
  acceptButton: {
    backgroundColor: colors.success,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  rejectButton: {
    backgroundColor: colors.error,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
});

export default CallScreen;
