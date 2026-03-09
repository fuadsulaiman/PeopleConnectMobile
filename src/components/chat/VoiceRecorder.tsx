/**
 * VoiceRecorder Component
 *
 * A simplified voice recording component with:
 * - Cancel button (X) on the left
 * - Recording duration and indicator in the center
 * - Send button (checkmark) on the right
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
  StyleSheet,
  Platform,
  Alert,
  Vibration,
  Modal,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
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
   * Whether the voice recorder modal is visible
   */
  visible: boolean;
  /**
   * Callback when recording is completed successfully
   * @param uri - The URI of the recorded audio file
   * @param duration - Duration of the recording in milliseconds
   * @param viewOnce - Whether the message should be view-once (disappears after playing)
   */
  onRecordComplete: (uri: string, duration: number, viewOnce?: boolean) => void;
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * VoiceRecorder - A simple voice recording component with Cancel and Send buttons
 *
 * Layout:
 * ┌────────────────────────────────────────────┐
 * │   [X Cancel]    ● 0:05    [✓ Send]        │
 * └────────────────────────────────────────────┘
 *
 * @example
 * <VoiceRecorder
 *   visible={true}
 *   onRecordComplete={(uri, duration) => {
 *     console.log('Recording completed:', uri, duration);
 *   }}
 *   onRecordStart={() => console.log('Recording started')}
 *   onRecordCancel={() => console.log('Recording cancelled')}
 * />
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  visible,
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
  const [viewOnce, setViewOnce] = useState(false);

  // Refs for audio recorder and animations
  const audioRecorderRef = useRef<any>(null);
  const recordingUriRef = useRef<string | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
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

  // Normalize file path for upload (ensure proper file:// prefix)
  const normalizeFilePath = (path: string): string => {
    if (!path) return path;

    // On Android, ensure the path has file:// prefix for local files
    if (Platform.OS === 'android') {
      // If it's already a proper URI, return as-is
      if (path.startsWith('file://') || path.startsWith('content://')) {
        return path;
      }
      // Add file:// prefix for absolute paths
      if (path.startsWith('/')) {
        return `file://${path}`;
      }
    }

    // On iOS, the path might be returned without file:// prefix
    if (Platform.OS === 'ios') {
      if (!path.startsWith('file://') && path.startsWith('/')) {
        return `file://${path}`;
      }
    }

    return path;
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
      isRecordingRef.current = true;
      setDuration(0);
      recordingUriRef.current = null;

      onRecordStart?.();

      // Configure audio recording options
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType?.AAC,
        AudioSourceAndroid: AudioSourceAndroidType?.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType?.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption?.aac,
      };

      // Use app's cache directory for recording (avoids permission issues on newer Android)
      const fileName = `voice_${Date.now()}${Platform.OS === 'ios' ? '.m4a' : '.mp3'}`;
      const path = Platform.select({
        ios: fileName,
        android: `${RNFS.CachesDirectoryPath}/${fileName}`,
      });

      // Start recording
      const uri = await audioRecorderRef.current.startRecorder(path, audioSet);
      console.log('[VoiceRecorder] Recording started:', uri);
      recordingUriRef.current = uri;

      // Set up metering callback (optional - for audio level visualization)
      audioRecorderRef.current.addRecordBackListener((e: any) => {
        // We're not using audio level for now, but keeping the listener
        // to ensure proper recording callback functionality
      });

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 100;
          if (newDuration >= maxDuration * 1000) {
            // Auto-stop at max duration
            handleSendRecording();
          }
          return newDuration;
        });
      }, 100);

      return true;
    } catch (error) {
      console.error('[VoiceRecorder] Error starting recording:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
      return false;
    }
  }, [maxDuration, onRecordStart]);

  // Stop recording (internal - doesn't send, just stops)
  const stopRecordingInternal = useCallback(async (): Promise<string | null> => {
    if (!audioRecorderRef.current || !isRecordingRef.current) {
      return null;
    }

    try {
      // Stop timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      // Stop recording
      const result = await audioRecorderRef.current.stopRecorder();
      audioRecorderRef.current.removeRecordBackListener();

      console.log('[VoiceRecorder] Recording stopped');
      console.log('[VoiceRecorder] Raw result from stopRecorder:', result);
      console.log('[VoiceRecorder] Raw result type:', typeof result);

      setIsRecording(false);
      isRecordingRef.current = false;

      // Verify the file exists at the returned path
      let pathToCheck = result;
      if (pathToCheck.startsWith('file://')) {
        pathToCheck = pathToCheck.substring(7);
      }

      try {
        const fileExists = await RNFS.exists(pathToCheck);
        console.log('[VoiceRecorder] File exists at', pathToCheck, ':', fileExists);

        if (fileExists) {
          const fileInfo = await RNFS.stat(pathToCheck);
          console.log('[VoiceRecorder] File info:', {
            size: fileInfo.size,
            isFile: fileInfo.isFile(),
            path: fileInfo.path,
            ctime: fileInfo.ctime,
            mtime: fileInfo.mtime,
          });
        } else {
          console.error('[VoiceRecorder] WARNING: Recording file does not exist at:', pathToCheck);
          // Try the original path passed to startRecorder
          const originalPath = `${RNFS.CachesDirectoryPath}/voice_${Date.now()}.mp3`;
          console.log('[VoiceRecorder] Expected path was:', originalPath);
        }
      } catch (fsError) {
        console.error('[VoiceRecorder] File system check error:', fsError);
      }

      // Normalize the file path for upload
      const normalizedPath = normalizeFilePath(result);
      console.log('[VoiceRecorder] Normalized path:', normalizedPath);

      return normalizedPath;
    } catch (error) {
      console.error('[VoiceRecorder] Error stopping recording:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
      return null;
    }
  }, []);

  // Handle send button press - stop recording and send
  const handleSendRecording = useCallback(async () => {
    if (!isRecordingRef.current) {
      return;
    }

    const currentDuration = duration;
    const result = await stopRecordingInternal();

    // Vibrate to indicate recording sent
    Vibration.vibrate([0, 50, 50, 50]);

    if (result && currentDuration > 500) {
      // Only send if duration > 0.5s
      console.log('[VoiceRecorder] Sending recording:', result, 'duration:', currentDuration, 'viewOnce:', viewOnce);
      onRecordComplete(result, currentDuration, viewOnce);
    } else {
      console.log('[VoiceRecorder] Recording too short, discarding');
      onRecordCancel?.();
    }
  }, [duration, viewOnce, onRecordComplete, onRecordCancel, stopRecordingInternal]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    if (!audioRecorderRef.current || !isRecordingRef.current) {
      // If not recording, just call cancel callback
      onRecordCancel?.();
      return;
    }

    try {
      await stopRecordingInternal();

      // Vibrate to indicate cancellation
      Vibration.vibrate([0, 100, 50, 100]);

      onRecordCancel?.();

      console.log('[VoiceRecorder] Recording cancelled');
    } catch (error) {
      console.error('[VoiceRecorder] Error cancelling recording:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
      onRecordCancel?.();
    }
  }, [onRecordCancel, stopRecordingInternal]);

  // Auto-start recording when modal becomes visible
  useEffect(() => {
    if (visible && !isRecording && AudioRecorderPlayer) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  // Show fallback UI if package not installed
  if (!AudioRecorderPlayer) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onRecordCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.errorText}>
              Voice recording requires the react-native-audio-recorder-player package.
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onRecordCancel}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Simple Recording UI with Cancel and Send buttons
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancelRecording}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.recordingContainer}>
          {/* Cancel button (left side) */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelRecording}
            activeOpacity={0.8}
          >
            <Icon name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          {/* Recording info (center) */}
          <View style={styles.recordingInfo}>
            {/* Wave visualization */}
            <View style={styles.waveContainer}>
              {waveAnimValues.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveBar,
                    {
                      backgroundColor: colors.primary,
                      transform: [{ scaleY: anim }],
                    },
                  ]}
                />
              ))}
            </View>

            {/* Recording indicator dot */}
            <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />

            {/* Duration */}
            <Text style={styles.duration}>{formatDuration(duration)}</Text>
          </View>

          {/* Send button (right side) */}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendRecording}
            activeOpacity={0.8}
          >
            <Icon name="checkmark" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* View Once Toggle */}
        <TouchableOpacity
          style={styles.viewOnceToggle}
          onPress={() => setViewOnce(!viewOnce)}
          activeOpacity={0.7}
        >
          <Icon
            name={viewOnce ? 'eye-off' : 'eye'}
            size={20}
            color={viewOnce ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.viewOnceText, viewOnce && { color: colors.primary }]}>
            View Once
          </Text>
          <View style={[styles.toggleSwitch, viewOnce && styles.toggleSwitchActive]}>
            <View style={[styles.toggleKnob, viewOnce && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        {/* Instructions text */}
        <Text style={styles.instructionText}>
          Tap X to cancel, tap checkmark to send
        </Text>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    cancelButton: {
      alignItems: 'center',
      backgroundColor: '#ef4444', // Red color for cancel
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      marginRight: 8,
      width: 48,
      ...Platform.select({
        ios: {
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    closeButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    closeButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    duration: {
      color: colors.text,
      fontSize: 18,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontWeight: '600',
      minWidth: 55,
      textAlign: 'center',
    },
    errorText: {
      color: colors.text,
      fontSize: 14,
      textAlign: 'center',
    },
    instructionText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 12,
      textAlign: 'center',
    },
    modalContent: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 32,
      padding: 24,
    },
    modalOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 100,
    },
    recordingContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 32,
      flexDirection: 'row',
      height: 64,
      marginHorizontal: 16,
      paddingHorizontal: 8,
      width: SCREEN_WIDTH - 32,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    recordingDot: {
      backgroundColor: colors.error,
      borderRadius: 5,
      height: 10,
      marginRight: 4,
      width: 10,
    },
    recordingInfo: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
    },
    sendButton: {
      alignItems: 'center',
      backgroundColor: '#22c55e', // Green color for send
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      marginLeft: 8,
      width: 48,
      ...Platform.select({
        ios: {
          shadowColor: '#22c55e',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
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
    viewOnceToggle: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      flexDirection: 'row',
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    viewOnceText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    toggleSwitch: {
      backgroundColor: colors.border,
      borderRadius: 12,
      height: 24,
      justifyContent: 'center',
      marginLeft: 4,
      padding: 2,
      width: 44,
    },
    toggleSwitchActive: {
      backgroundColor: colors.primary,
    },
    toggleKnob: {
      backgroundColor: colors.white,
      borderRadius: 10,
      height: 20,
      width: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    toggleKnobActive: {
      transform: [{ translateX: 20 }],
    },
  });

export { VoiceRecorder };
export default VoiceRecorder;
