/**
 * VoicePlayer Component
 *
 * A voice message playback component with:
 * - Play/pause button
 * - Progress bar/slider
 * - Duration display (current / total)
 * - Playback speed control (optional)
 *
 * Note: Requires react-native-audio-recorder-player package for audio playback.
 * Falls back to placeholder UI if not installed.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';

// Optional import pattern for react-native-audio-recorder-player
let AudioRecorderPlayer: any = null;

try {
  const audioModule = require('react-native-audio-recorder-player');
  AudioRecorderPlayer = audioModule.default;
} catch (e) {
  // Package not installed - will show fallback UI
  console.log('[VoicePlayer] react-native-audio-recorder-player not installed');
}

export interface VoicePlayerProps {
  /**
   * URI of the audio file to play
   */
  uri: string;
  /**
   * Duration of the audio in seconds (optional, will be detected if not provided)
   */
  duration?: number;
  /**
   * Whether this is the sender's own message (for styling)
   */
  isOwn?: boolean;
  /**
   * Callback when playback starts
   */
  onPlayStart?: () => void;
  /**
   * Callback when playback ends
   */
  onPlayEnd?: () => void;
  /**
   * Callback when playback is paused
   */
  onPause?: () => void;
  /**
   * Show playback speed control
   */
  showSpeedControl?: boolean;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

/**
 * VoicePlayer - An audio playback component for voice messages
 *
 * @example
 * <VoicePlayer
 *   uri="https://example.com/voice.m4a"
 *   duration={45}
 *   isOwn={true}
 *   onPlayStart={() => console.log('Started')}
 *   onPlayEnd={() => console.log('Ended')}
 * />
 */
const VoicePlayer: React.FC<VoicePlayerProps> = ({
  uri,
  duration: initialDuration,
  isOwn = false,
  onPlayStart,
  onPlayEnd,
  onPause,
  showSpeedControl = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, isOwn), [colors, isOwn]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(initialDuration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_error, setError] = useState<string | null>(null);

  // Refs
  const audioRecorderRef = useRef<any>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Initialize audio player if package is available
  useEffect(() => {
    if (AudioRecorderPlayer && !audioRecorderRef.current) {
      audioRecorderRef.current = new AudioRecorderPlayer();
    }

    return () => {
      // Cleanup on unmount
      stopPlayback();
    };
  }, []);

  // Update progress animation
  useEffect(() => {
    if (totalDuration > 0) {
      const progress = currentPosition / (totalDuration * 1000);
      Animated.timing(progressAnim, {
        toValue: Math.min(1, Math.max(0, progress)),
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [currentPosition, totalDuration, progressAnim]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start or resume playback
  const startPlayback = useCallback(async () => {
    if (!AudioRecorderPlayer) {
      Alert.alert(
        'Audio Playback',
        'Audio playback requires the react-native-audio-recorder-player package.\n\nInstall it with:\nnpm install react-native-audio-recorder-player\n\nThen rebuild the app.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      // If paused, resume
      if (isPaused && audioRecorderRef.current) {
        await audioRecorderRef.current.resumePlayer();
        setIsPlaying(true);
        setIsPaused(false);
        setIsLoading(false);
        return;
      }

      // Start fresh playback
      console.log('[VoicePlayer] Starting playback:', uri);

      // Add playback listener
      audioRecorderRef.current.addPlayBackListener((e: any) => {
        setCurrentPosition(e.currentPosition);
        if (e.duration && !totalDuration) {
          setTotalDuration(e.duration / 1000);
        }

        // Check if playback finished
        if (e.currentPosition >= e.duration - 100) {
          stopPlayback();
          onPlayEnd?.();
        }
      });

      // Start playing
      const result = await audioRecorderRef.current.startPlayer(uri);
      console.log('[VoicePlayer] Playback started:', result);

      // Set playback speed if not 1x
      if (playbackSpeed !== 1 && audioRecorderRef.current.setPlaybackSpeed) {
        await audioRecorderRef.current.setPlaybackSpeed(playbackSpeed);
      }

      setIsPlaying(true);
      setIsPaused(false);
      setIsLoading(false);
      onPlayStart?.();
    } catch (err: any) {
      console.error('[VoicePlayer] Error starting playback:', err);
      setError('Failed to play audio');
      setIsLoading(false);
      setIsPlaying(false);
      Alert.alert('Error', 'Failed to play audio. The file may be unavailable.');
    }
  }, [uri, isPaused, playbackSpeed, totalDuration, onPlayStart, onPlayEnd]);

  // Pause playback
  const pausePlayback = useCallback(async () => {
    if (!audioRecorderRef.current || !isPlaying) {
      return;
    }

    try {
      await audioRecorderRef.current.pausePlayer();
      setIsPlaying(false);
      setIsPaused(true);
      onPause?.();
    } catch (err) {
      console.error('[VoicePlayer] Error pausing playback:', err);
    }
  }, [isPlaying, onPause]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    if (!audioRecorderRef.current) {
      return;
    }

    try {
      await audioRecorderRef.current.stopPlayer();
      audioRecorderRef.current.removePlayBackListener();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentPosition(0);
    } catch (err) {
      console.error('[VoicePlayer] Error stopping playback:', err);
    }
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, pausePlayback, startPlayback]);

  // Cycle through playback speeds
  const cycleSpeed = useCallback(async () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);

    // Apply speed if currently playing
    if (isPlaying && audioRecorderRef.current?.setPlaybackSpeed) {
      try {
        await audioRecorderRef.current.setPlaybackSpeed(newSpeed);
      } catch (err) {
        console.error('[VoicePlayer] Error setting playback speed:', err);
      }
    }
  }, [playbackSpeed, isPlaying]);

  // Calculate display duration
  const displayCurrentTime = formatTime(currentPosition / 1000);
  const displayTotalTime = formatTime(totalDuration);

  // Show fallback UI if package not installed
  if (!AudioRecorderPlayer) {
    return (
      <View style={styles.container}>
        <View style={styles.playButtonDisabled}>
          <Icon name="play" size={20} color={colors.textTertiary} />
        </View>
        <View style={styles.waveformPlaceholder}>
          {Array(20)
            .fill(0)
            .map((_, i) => (
              <View
                key={i}
                style={[styles.waveformBar, { height: 4 + Math.random() * 16, opacity: 0.3 }]}
              />
            ))}
        </View>
        <Text style={styles.durationDisabled}>
          {initialDuration ? formatTime(initialDuration) : '--:--'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={togglePlayback}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? colors.white : colors.primary} />
        ) : (
          <Icon
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={isOwn ? colors.white : colors.primary}
          />
        )}
      </TouchableOpacity>

      {/* Progress bar with waveform visualization */}
      <View style={styles.progressContainer}>
        {/* Waveform bars (static visualization) */}
        <View style={styles.waveformContainer}>
          {Array(20)
            .fill(0)
            .map((_, i) => {
              // Generate a pseudo-random height based on position
              const height = 4 + Math.sin(i * 0.8) * 8 + Math.cos(i * 1.2) * 6;
              return <View key={i} style={[styles.waveformBar, { height }]} />;
            })}

          {/* Progress overlay */}
          <Animated.View
            style={[
              styles.progressOverlay,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            {Array(20)
              .fill(0)
              .map((_, i) => {
                const height = 4 + Math.sin(i * 0.8) * 8 + Math.cos(i * 1.2) * 6;
                return (
                  <View
                    key={i}
                    style={[styles.waveformBar, styles.waveformBarActive, { height }]}
                  />
                );
              })}
          </Animated.View>
        </View>
      </View>

      {/* Duration display */}
      <View style={styles.durationContainer}>
        <Text style={styles.duration}>
          {isPlaying || isPaused ? displayCurrentTime : displayTotalTime}
        </Text>
      </View>

      {/* Speed control (optional) */}
      {showSpeedControl && (
        <TouchableOpacity style={styles.speedButton} onPress={cycleSpeed}>
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (
  colors: ReturnType<typeof import('../../hooks').useTheme>['colors'],
  isOwn: boolean
) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      maxWidth: 280,
      minWidth: 200,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    duration: {
      color: isOwn ? 'rgba(255, 255, 255, 0.8)' : colors.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    durationContainer: {
      alignItems: 'flex-end',
      minWidth: 40,
    },
    durationDisabled: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
    playButton: {
      alignItems: 'center',
      backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : colors.surface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    playButtonDisabled: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      opacity: 0.5,
      width: 36,
    },
    progressContainer: {
      flex: 1,
      height: 24,
      justifyContent: 'center',
      marginHorizontal: 10,
    },
    progressOverlay: {
      alignItems: 'center',
      bottom: 0,
      flexDirection: 'row',
      gap: 2,
      left: 0,
      overflow: 'hidden',
      position: 'absolute',
      top: 0,
    },
    speedButton: {
      backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : colors.surface,
      borderRadius: 4,
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    speedText: {
      color: isOwn ? colors.white : colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    waveformBar: {
      backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.4)' : colors.textTertiary,
      borderRadius: 1.5,
      width: 3,
    },
    waveformBarActive: {
      backgroundColor: isOwn ? colors.white : colors.primary,
    },
    waveformContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      height: 24,
    },
    waveformPlaceholder: {
      alignItems: 'center',
      flexDirection: 'row',
      flex: 1,
      gap: 2,
      height: 24,
      marginHorizontal: 10,
    },
  });

export { VoicePlayer };
export default VoicePlayer;
