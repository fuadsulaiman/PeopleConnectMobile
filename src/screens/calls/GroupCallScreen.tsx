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
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getCalls = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.calls;
};
const calls = { getLiveKitToken: (id: string) => getCalls().getLiveKitToken(id) };
import { GroupCallScreenProps } from '../../navigation/types';

// LiveKit imports - will fail gracefully if not available
let LiveKitRoom: any = null;
let VideoView: any = null;
let useParticipants: any = null;
let useTracks: any = null;
let Track: any = null;
let isTrackReference: any = null;

try {
  const livekit = require('@livekit/react-native');
  LiveKitRoom = livekit.LiveKitRoom;
  VideoView = livekit.VideoView;
  useParticipants = livekit.useParticipants;

  useTracks = livekit.useTracks;
  Track = livekit.Track;
  isTrackReference = livekit.isTrackReference;
} catch (e) {
  console.log('LiveKit not available');
}

const { width, height } = Dimensions.get('window');

const GroupCallScreen: React.FC<GroupCallScreenProps> = ({ route, navigation }) => {
  const { conversationId, conversationName } = route.params;
  const { colors } = useTheme();
  const [isConnecting, setIsConnecting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchToken = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const response = await calls.getLiveKitToken(conversationId);
      if (response && response.token && response.url) {
        setToken(response.token);
        setServerUrl(response.url);
        setRoomName(response.roomName || conversationId);
      } else {
        throw new Error('Invalid token response');
      }
    } catch (err: any) {
      console.error('Failed to get LiveKit token:', err);
      setError(err.message || 'Failed to join call');
      Alert.alert('Error', 'Failed to join call. Please try again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId, navigation]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

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

  if (error || !token || !serverUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorMessage}>{error || 'Unable to connect to the call'}</Text>
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

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      audio={!isMuted}
      video={isVideoEnabled}
    >
      <RoomContent
        roomName={roomName || conversationName || ''}
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isSpeakerOn={isSpeakerOn}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleSpeaker={handleToggleSpeaker}
        onEndCall={handleEndCall}
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
  colors: any;
  styles: any;
}

const RoomContent: React.FC<RoomContentProps> = ({
  roomName,
  isMuted,
  isVideoEnabled,
  isSpeakerOn,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
  colors,
  styles,
}) => {
  const participants = useParticipants ? useParticipants() : [];
  const tracks = useTracks ? useTracks([Track?.Source?.Camera, Track?.Source?.ScreenShare]) : [];

  const gridSize = Math.ceil(Math.sqrt(Math.max(participants.length, 1)));
  const tileWidth = width / gridSize - 8;
  const tileHeight = (height - 200) / gridSize - 8;

  return (
    <SafeAreaView style={styles.container}>
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
