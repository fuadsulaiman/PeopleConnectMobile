import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { colors } from '../constants/colors';

interface VideoRecorderProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (videoUri: string, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  visible,
  onClose,
  onVideoRecorded,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 60,
}) => {
  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [isInitializing, setIsInitializing] = useState(true);
  const [recordedVideo, setRecordedVideo] = useState<{ path: string; duration: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finalDurationRef = useRef(0);

  const device = useCameraDevice(cameraPosition);
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  useEffect(() => {
    if (visible) {
      initializeCamera();
      setRecordedVideo(null);
      setRecordingDuration(0);
      setIsRecording(false);
    } else {
      // Clean up when closing
      cleanup();
    }
  }, [visible]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    setRecordedVideo(null);
    finalDurationRef.current = 0;
  };

  const initializeCamera = async () => {
    setIsInitializing(true);
    try {
      if (!hasCameraPermission) {
        const cameraGranted = await requestCameraPermission();
        if (!cameraGranted) {
          Alert.alert('Permission Required', 'Camera permission is required to record video.');
          onClose();
          return;
        }
      }
      if (!hasMicPermission) {
        await requestMicPermission();
      }
    } catch (error) {
      console.error('Camera initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      setIsRecording(true);
      setRecordingDuration(0);
      finalDurationRef.current = 0;

      // Notify that recording started
      onRecordingStart?.();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          finalDurationRef.current = newDuration;
          if (newDuration >= maxDuration) {
            stopRecording();
            return prev;
          }
          return newDuration;
        });
      }, 1000);

      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          console.log('Recording finished:', video);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsRecording(false);
          // Notify that recording stopped
          onRecordingStop?.();
          // Store the video for review
          setRecordedVideo({
            path: video.path,
            duration: finalDurationRef.current,
          });
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          Alert.alert('Recording Error', error.message || 'Failed to record video');
          setIsRecording(false);
          onRecordingStop?.();
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        },
      });
    } catch (error: any) {
      console.error('Start recording error:', error);
      Alert.alert('Error', error.message || 'Failed to start recording');
      setIsRecording(false);
      onRecordingStop?.();
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await cameraRef.current.stopRecording();
      // Don't set isRecording to false here - let onRecordingFinished handle it
    } catch (error: any) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
    }
  };

  const handleSendVideo = () => {
    if (recordedVideo) {
      onVideoRecorded(recordedVideo.path, recordedVideo.duration);
      cleanup();
      onClose();
    }
  };

  const handleRetake = () => {
    setRecordedVideo(null);
    setRecordingDuration(0);
    finalDurationRef.current = 0;
  };

  const toggleCamera = () => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = () => {
    if (isRecording) {
      // Cancel recording
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cameraRef.current?.cancelRecording();
      setIsRecording(false);
      onRecordingStop?.();
    }
    cleanup();
    onClose();
  };

  if (!device) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading camera...</Text>
            <TouchableOpacity style={styles.cancelLoadingButton} onPress={handleCancel}>
              <Text style={styles.cancelLoadingText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {isInitializing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={styles.loadingText}>Initializing camera...</Text>
          </View>
        ) : recordedVideo ? (
          // Video recorded - show preview options
          <View style={styles.previewContainer}>
            <View style={styles.previewContent}>
              <Icon name="checkmark-circle" size={80} color={colors.success} />
              <Text style={styles.previewTitle}>Video Recorded!</Text>
              <Text style={styles.previewDuration}>
                Duration: {formatDuration(recordedVideo.duration)}
              </Text>
            </View>
            <View style={styles.previewButtons}>
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                <Icon name="refresh" size={24} color={colors.white} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendButton} onPress={handleSendVideo}>
                <Icon name="send" size={24} color={colors.white} />
                <Text style={styles.sendButtonText}>Send Video</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelPreviewButton} onPress={handleCancel}>
              <Text style={styles.cancelPreviewText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Camera view
          <>
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={visible && !recordedVideo}
              video={true}
              audio={hasMicPermission}
            />

            {/* Top controls */}
            <SafeAreaView style={styles.topControlsContainer}>
              <View style={styles.topControls}>
                <TouchableOpacity style={styles.topButton} onPress={handleCancel}>
                  <Icon name="close" size={28} color={colors.white} />
                </TouchableOpacity>

                {isRecording ? (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                  </View>
                ) : (
                  <View style={styles.placeholder} />
                )}

                <TouchableOpacity
                  style={[styles.topButton, isRecording && styles.disabledButton]}
                  onPress={toggleCamera}
                  disabled={isRecording}
                >
                  <Icon name="camera-reverse" size={28} color={isRecording ? '#666' : colors.white} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              {!isRecording ? (
                // Not recording - show start button
                <>
                  <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                    <View style={styles.recordButtonInner}>
                      <View style={styles.recordIcon} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.hintText}>Tap to start recording</Text>
                </>
              ) : (
                // Recording - show stop button
                <>
                  <TouchableOpacity style={styles.recordButton} onPress={stopRecording}>
                    <View style={styles.recordButtonInner}>
                      <View style={styles.stopIcon} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.hintText}>Tap to stop and save</Text>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: colors.white,
    marginTop: 16,
    fontSize: 16,
  },
  cancelLoadingButton: {
    marginTop: 24,
    padding: 12,
  },
  cancelLoadingText: {
    color: colors.primary,
    fontSize: 16,
  },
  topControlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF0000',
    marginRight: 8,
  },
  durationText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 40 : 50,
    paddingTop: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recordButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0000',
  },
  stopIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF0000',
  },
  hintText: {
    color: colors.white,
    fontSize: 14,
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Preview screen styles
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  previewContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  previewTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  previewDuration: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 8,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retakeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelPreviewButton: {
    marginTop: 24,
    padding: 12,
  },
  cancelPreviewText: {
    color: '#888',
    fontSize: 16,
  },
});

export default VideoRecorder;
