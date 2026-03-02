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
import { calls } from '../../services/sdk';
import { GroupCallScreenProps } from '../../navigation/types';

// LiveKit imports - will fail gracefully if not available
let LiveKitRoom: any = null;
let VideoView: any = null;
let useParticipants: any = null;
let useLocalParticipant: any = null;
let useTracks: any = null;
let Track: any = null;
let isTrackReference: any = null;

try {
  const livekit = require('@livekit/react-native');
  LiveKitRoom = livekit.LiveKitRoom;
  VideoView = livekit.VideoView;
  useParticipants = livekit.useParticipants;
  useLocalParticipant = livekit.useLocalParticipant;
  useTracks = livekit.useTracks;
  Track = livekit.Track;
  isTrackReference = livekit.isTrackReference;
} catch (e) {
  console.log('LiveKit not available');
}

const { width, height } = Dimensions.get('window');

interface Participant {
  identity: string;
  name?: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
}

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
    setIsMuted(prev => !prev);
  }, []);

  const handleToggleVideo = useCallback(() => {
    setIsVideoEnabled(prev => !prev);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => !prev);
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
        roomName={roomName || conversationName}
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
  const localParticipant = useLocalParticipant ? useLocalParticipant() : null;
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
            if (!isTrackReference || !isTrackReference(track)) return null;
            return (
              <View
                key={track.participant.identity + '-' + index}
                style={[styles.videoTile, { width: tileWidth, height: tileHeight }]}
              >
                <VideoView
                  style={styles.videoView}
                  trackRef={track}
                  objectFit="cover"
                />
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
          <Icon name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color={colors.white} />
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
    container: { flex: 1, backgroundColor: colors.gray?.[900] || '#1a1a1a' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.white, fontSize: 16, marginTop: 16 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginTop: 16 },
    errorMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    retryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
    backButton: {
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
    },
    roomName: { fontSize: 18, fontWeight: '600', color: colors.white },
    participantCount: { fontSize: 14, color: colors.gray?.[400] || '#888', marginTop: 4 },
    videoGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 4,
    },
    videoTile: {
      margin: 4,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.gray?.[800] || '#2a2a2a',
    },
    videoView: { flex: 1 },
    participantInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    participantName: { flex: 1, color: colors.white, fontSize: 12 },
    noVideoContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noVideoText: { color: colors.textSecondary, fontSize: 16, marginTop: 12 },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    controlButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.gray?.[700] || '#444',
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
    },
    controlButtonActive: { backgroundColor: colors.primary },
    endCallButton: {
      backgroundColor: colors.error,
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    endCallIcon: { transform: [{ rotate: '135deg' }] },
  });

export default GroupCallScreen;
