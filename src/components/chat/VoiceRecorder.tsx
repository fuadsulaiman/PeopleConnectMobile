/**
 * VoiceRecorder Component
 *
 * A voice recording component with:
 * - Press and hold to record
 * - Swipe left to cancel
 * - Visual waveform/level indicator
 * - Recording duration display
 * - SignalR recording indicator support
 *
 * Note: Requires react-native-audio-recorder-player package for audio recording.
 * Falls back to placeholder UI if not installed.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleSheet,
  Platform,
  Alert,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';

// Optional import pattern for react-native-audio-recorder-player
let AudioRecorderPlayer: any = null;
let AudioEncoderAndroidType: any = null;
let AudioSourceAndroidType: any = null;
let AVEncoderAudioQualityIOSType: any = null;
let AVEncodingOption: any = null;

try {
  const audioModule = require('react-native-audio-recorder-player');
  AudioRecorderPlayer = audioModule.default;
  AudioEncoderAndroidType = audioModule.AudioEncoderAndroidType;
  AudioSourceAndroidType = audioModule.AudioSourceAndroidType;
  AVEncoderAudioQualityIOSType = audioModule.AVEncoderAudioQualityIOSType;
  AVEncodingOption = audioModule.AVEncodingOption;
} catch (e) {
  // Package not installed - will show fallback UI
  console.log('[VoiceRecorder] react-native-audio-recorder-player not installed');
}

export interface VoiceRecorderProps {
  /**
   * Callback when recording is completed successfully
   * @param uri - The URI of the recorded audio file
   * @param duration - Duration of the recording in milliseconds
   */
  onRecordComplete: (uri: string, duration: number) => void;
  /**
   * Callback when recording starts
   */
  onRecordStart?: () => void;
  /**
   * Callback when recording is cancelled
   */
  onRecordCancel?: () => void;
  /**
   * Maximum recording duration in seconds (default: 120)
   */
  maxDuration?: number;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
}

const CANCEL_THRESHOLD = -100; // Swipe left threshold to cancel
const HAPTIC_FEEDBACK_INTERVAL = 1000; // Haptic feedback every second

/**
 * VoiceRecorder - A press-and-hold voice recording component
 *
 * @example
 * <VoiceRecorder
 *   onRecordComplete={(uri, duration) => {
 *     console.log('Recording completed:', uri, duration);
 *   }}
 *   onRecordStart={() => console.log('Recording started')}
 *   onRecordCancel={() => console.log('Recording cancelled')}
 * />
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordComplete,
  onRecordStart,
  onRecordCancel,
  maxDuration = 120,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_audioLevel, setAudioLevel] = useState(0);

  // Refs for audio recorder and animations
  const audioRecorderRef = useRef<any>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hapticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slideX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnimValues = useRef(
    Array(5)
      .fill(0)
      .map(() => new Animated.Value(0.3))
  ).current;

  // Initialize audio recorder if package is available
  useEffect(() => {
    if (AudioRecorderPlayer && !audioRecorderRef.current) {
      audioRecorderRef.current = new AudioRecorderPlayer();
    }

    return () => {
      // Cleanup on unmount
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stopRecorder?.();
        audioRecorderRef.current.removeRecordBackListener?.();
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (hapticTimerRef.current) {
        clearInterval(hapticTimerRef.current);
      }
    };
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animation for audio level visualization
      waveAnimValues.forEach((anim, index) => {
        const delay = index * 100;
        const animateWave = () => {
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.7,
              duration: 200 + Math.random() * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 200 + Math.random() * 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (isRecording) {
              animateWave();
            }
          });
        };
        setTimeout(animateWave, delay);
      });
    } else {
      pulseAnim.setValue(1);
      waveAnimValues.forEach((anim) => anim.setValue(0.3));
    }
  }, [isRecording, pulseAnim, waveAnimValues]);

  // Format duration as MM:SS
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = useCallback(async () => {
    if (!AudioRecorderPlayer) {
      Alert.alert(
        'Voice Recording',
        'Voice recording requires the react-native-audio-recorder-player package.\n\nInstall it with:\nnpm install react-native-audio-recorder-player\n\nThen rebuild the app.',
        [{ text: 'OK' }]
      );
      return false;
    }

    try {
      // Vibrate to indicate recording start
      Vibration.vibrate(50);

      setIsRecording(true);
      setDuration(0);
      setIsCancelling(false);
      slideX.setValue(0);

      onRecordStart?.();

      // Configure audio recording options
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType?.AAC,
        AudioSourceAndroid: AudioSourceAndroidType?.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType?.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption?.aac,
      };

      const path = Platform.select({
        ios: `voice_${Date.now()}.m4a`,
        android: `${Platform.OS === 'android' ? '/sdcard/' : ''}voice_${Date.now()}.mp4`,
      });

      // Start recording
      const uri = await audioRecorderRef.current.startRecorder(path, audioSet);
      console.log('[VoiceRecorder] Recording started:', uri);

      // Set up metering callback for audio level visualization
      audioRecorderRef.current.addRecordBackListener((e: any) => {
        // e.currentMetering is in dB (-160 to 0)
        const level = e.currentMetering
          ? Math.min(1, Math.max(0, (e.currentMetering + 60) / 60))
          : 0;
        setAudioLevel(level);
      });

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 100;
          if (newDuration >= maxDuration * 1000) {
            // Auto-stop at max duration
            stopRecording();
          }
          return newDuration;
        });
      }, 100);

      // Haptic feedback timer
      hapticTimerRef.current = setInterval(() => {
        Vibration.vibrate(10);
      }, HAPTIC_FEEDBACK_INTERVAL);

      return true;
    } catch (error) {
      console.error('[VoiceRecorder] Error starting recording:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
      return false;
    }
  }, [maxDuration, onRecordStart, slideX]);

  // Stop recording and send
  const stopRecording = useCallback(async () => {
    if (!audioRecorderRef.current || !isRecording) {
      return;
    }

    try {
      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (hapticTimerRef.current) {
        clearInterval(hapticTimerRef.current);
        hapticTimerRef.current = null;
      }

      // Stop recording
      const result = await audioRecorderRef.current.stopRecorder();
      audioRecorderRef.current.removeRecordBackListener();

      console.log('[VoiceRecorder] Recording stopped:', result);

      // Vibrate to indicate recording stop
      Vibration.vibrate([0, 50, 50, 50]);

      setIsRecording(false);

      if (result && duration > 500) {
        // Only send if duration > 0.5s
        onRecordComplete(result, duration);
      } else {
        console.log('[VoiceRecorder] Recording too short, discarding');
      }
    } catch (error) {
      console.error('[VoiceRecorder] Error stopping recording:', error);
      setIsRecording(false);
    }
  }, [isRecording, duration, onRecordComplete]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    if (!audioRecorderRef.current || !isRecording) {
      return;
    }

    try {
      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (hapticTimerRef.current) {
        clearInterval(hapticTimerRef.current);
        hapticTimerRef.current = null;
      }

      // Stop recording
      await audioRecorderRef.current.stopRecorder();
      audioRecorderRef.current.removeRecordBackListener();

      // Vibrate to indicate cancellation
      Vibration.vibrate([0, 100, 50, 100]);

      setIsRecording(false);
      setIsCancelling(false);
      slideX.setValue(0);

      onRecordCancel?.();

      console.log('[VoiceRecorder] Recording cancelled');
    } catch (error) {
      console.error('[VoiceRecorder] Error cancelling recording:', error);
      setIsRecording(false);
      setIsCancelling(false);
    }
  }, [isRecording, onRecordCancel, slideX]);

  // Pan responder for swipe-to-cancel
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Start recording on press
        startRecording();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isRecording && gestureState.dx < 0) {
          // Only allow sliding left
          slideX.setValue(Math.max(CANCEL_THRESHOLD - 20, gestureState.dx));
          setIsCancelling(gestureState.dx < CANCEL_THRESHOLD);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < CANCEL_THRESHOLD) {
          // Cancel if swiped far enough
          cancelRecording();
        } else {
          // Stop and send recording
          stopRecording();
        }
        // Reset slide position
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        // Cancel on termination
        cancelRecording();
        slideX.setValue(0);
      },
    })
  ).current;

  // Show fallback UI if package not installed
  if (!AudioRecorderPlayer) {
    return (
      <TouchableOpacity
        style={[styles.micButton, disabled && styles.disabled]}
        onPress={() => {
          Alert.alert(
            'Voice Recording',
            'Voice recording requires the react-native-audio-recorder-player package.\n\nInstall it with:\nnpm install react-native-audio-recorder-player\n\nThen rebuild the app.',
            [{ text: 'OK' }]
          );
        }}
        disabled={disabled}
      >
        <Icon name="mic" size={24} color={disabled ? colors.textTertiary : colors.primary} />
      </TouchableOpacity>
    );
  }

  // Recording UI
  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        {/* Slide to cancel hint */}
        <Animated.View
          style={[
            styles.cancelHint,
            {
              opacity: slideX.interpolate({
                inputRange: [CANCEL_THRESHOLD, 0],
                outputRange: [1, 0.5],
              }),
            },
          ]}
        >
          <Icon
            name={isCancelling ? 'trash' : 'chevron-back'}
            size={isCancelling ? 24 : 16}
            color={isCancelling ? colors.error : colors.textSecondary}
          />
          <Text style={[styles.cancelHintText, isCancelling && { color: colors.error }]}>
            {isCancelling ? 'Release to cancel' : '< Slide to cancel'}
          </Text>
        </Animated.View>

        {/* Recording info */}
        <View style={styles.recordingInfo}>
          {/* Wave visualization */}
          <View style={styles.waveContainer}>
            {waveAnimValues.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    backgroundColor: isCancelling ? colors.error : colors.primary,
                    transform: [{ scaleY: anim }],
                  },
                ]}
              />
            ))}
          </View>

          {/* Duration */}
          <Text style={styles.duration}>{formatDuration(duration)}</Text>

          {/* Recording indicator */}
          <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
        </View>

        {/* Recording button (draggable) */}
        <Animated.View
          style={[
            styles.recordingButton,
            {
              transform: [{ translateX: slideX }],
              backgroundColor: isCancelling ? colors.error : colors.primary,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Icon name={isCancelling ? 'close' : 'mic'} size={28} color={colors.white} />
        </Animated.View>
      </View>
    );
  }

  // Default mic button
  return (
    <TouchableOpacity
      style={[styles.micButton, disabled && styles.disabled]}
      onPressIn={() => startRecording()}
      disabled={disabled}
    >
      <Icon name="mic" size={24} color={disabled ? colors.textTertiary : colors.primary} />
    </TouchableOpacity>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    cancelHint: {
      alignItems: 'center',
      flexDirection: 'row',
      marginRight: 12,
    },
    cancelHintText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginLeft: 4,
    },
    disabled: {
      opacity: 0.5,
    },
    duration: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      minWidth: 50,
      textAlign: 'center',
    },
    micButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    recordingButton: {
      alignItems: 'center',
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginLeft: 8,
      width: 56,
    },
    recordingContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 28,
      flexDirection: 'row',
      flex: 1,
      height: 56,
      paddingLeft: 16,
    },
    recordingDot: {
      backgroundColor: colors.error,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    recordingInfo: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
    },
    waveBar: {
      borderRadius: 2,
      height: 24,
      width: 4,
    },
    waveContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
      height: 24,
    },
  });

export { VoiceRecorder };
export default VoiceRecorder;
