import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  CameraPermissionStatus,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors } from '../constants/colors';

interface VideoRecorderProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (videoUri: string, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number;
}

// Timeout for camera initialization (10 seconds)
const CAMERA_INIT_TIMEOUT = 10000;

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
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<{ path: string; duration: number } | null>(
    null
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalDurationRef = useRef(0);

  const device = useCameraDevice(cameraPosition);
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } =
    useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } =
    useMicrophonePermission();

  useEffect(() => {
    if (visible) {
      initializeCamera();
      setRecordedVideo(null);
      setRecordingDuration(0);
      setIsRecording(false);
      setCameraReady(false);
      setError(null);
    } else {
      // Clean up when closing
      cleanup();
    }

    return () => {
      // Cleanup timeout on unmount
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [visible]);

  // Monitor device availability after permissions are granted
  useEffect(() => {
    if (permissionsGranted && visible && !device) {
      // Set a timeout to detect if camera device never becomes available
      initTimeoutRef.current = setTimeout(() => {
        if (!device) {
          console.error('Camera device not available after timeout');
          setError('Camera not available. Please ensure your device has a working camera.');
          setIsInitializing(false);
        }
      }, CAMERA_INIT_TIMEOUT);
    }

    // Clear timeout if device becomes available
    if (device && initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [permissionsGranted, device, visible]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    setRecordedVideo(null);
    setPermissionsGranted(false);
    setCameraReady(false);
    setError(null);
    finalDurationRef.current = 0;
  };

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const pickVideoFromGallery = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'video',
        videoQuality: 'medium',
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        console.error('Image picker error:', result.errorMessage);
        Alert.alert('Error', result.errorMessage || 'Failed to pick video from gallery');
        return;
      }

      if (result.assets && result.assets[0]) {
        const video = result.assets[0];
        if (video.uri) {
          // Duration is in seconds from image-picker
          const durationInSeconds = video.duration ? Math.round(video.duration) : 0;
          onVideoRecorded(video.uri, durationInSeconds);
          cleanup();
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Gallery picker error:', err);
      Alert.alert('Error', err.message || 'Failed to pick video from gallery');
    }
  }, [onVideoRecorded, onClose]);

  const initializeCamera = async () => {
    setIsInitializing(true);
    setError(null);
    setPermissionsGranted(false);

    try {
      // Request camera permission
      let cameraStatus: CameraPermissionStatus;
      if (!hasCameraPermission) {
        cameraStatus = await requestCameraPermission();
        console.log('Camera permission status:', cameraStatus);

        if (cameraStatus === 'denied') {
          setError('Camera permission was denied. Please grant camera access to record videos.');
          setIsInitializing(false);
          return;
        }

        if (cameraStatus !== 'granted') {
          // Permission might be 'restricted' or 'not-determined' on iOS
          Alert.alert(
            'Permission Required',
            'Camera permission is required to record video. Please enable it in Settings.',
            [
              { text: 'Cancel', onPress: onClose, style: 'cancel' },
              { text: 'Open Settings', onPress: openSettings },
            ]
          );
          setIsInitializing(false);
          return;
        }
      }

      // Request microphone permission (optional but recommended)
      if (!hasMicPermission) {
        const micStatus = await requestMicPermission();
        console.log('Microphone permission status:', micStatus);
        // Don't block if mic permission is denied, just continue without audio
        if (micStatus !== 'granted') {
          console.warn('Microphone permission not granted. Video will be recorded without audio.');
        }
      }

      // Permissions granted, mark as ready to show camera
      setPermissionsGranted(true);

      // Check if device is immediately available
      if (device) {
        setIsInitializing(false);
      }
      // If device is not available yet, the useEffect above will handle the timeout

    } catch (err: any) {
      console.error('Camera initialization error:', err);
      setError(`Failed to initialize camera: ${err.message || 'Unknown error'}`);
      setIsInitializing(false);
    }
  };

  const handleCameraInitialized = useCallback(() => {
    console.log('Camera initialized successfully');
    setCameraReady(true);
    setIsInitializing(false);
  }, []);

  const handleCameraError = useCallback((err: any) => {
    console.error('Camera error:', err);
    setError(`Camera error: ${err.message || err.code || 'Unknown error'}`);
    setIsInitializing(false);
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) {
      return;
    }

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
        onRecordingFinished: (video: { path: string; duration: number }) => {
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
        onRecordingError: (error: { code: string; message: string }) => {
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
    if (!cameraRef.current || !isRecording) {
      return;
    }

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

  // Render error state
  const renderError = () => (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Icon name="alert-circle" size={64} color={colors.error || '#FF4444'} />
          <Text style={styles.errorTitle}>Camera Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>
            You can pick a video from your gallery instead.
          </Text>

          {/* Primary action - Gallery picker */}
          <TouchableOpacity style={styles.galleryButton} onPress={pickVideoFromGallery}>
            <Icon name="images" size={24} color={colors.white} />
            <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          {/* Secondary actions */}
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={() => initializeCamera()}>
              <Icon name="refresh" size={20} color={colors.white} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
              <Icon name="settings" size={20} color={colors.white} />
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelLoadingButton} onPress={handleCancel}>
            <Text style={styles.cancelLoadingText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Render loading state (permissions granted but waiting for device)
  const renderLoading = () => (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {!permissionsGranted ? 'Requesting permissions...' : 'Initializing camera...'}
          </Text>
          <TouchableOpacity style={styles.cancelLoadingButton} onPress={handleCancel}>
            <Text style={styles.cancelLoadingText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Show error screen if there's an error
  if (error) {
    return renderError();
  }

  // Show loading screen if initializing or device not ready
  if (isInitializing || !device || !permissionsGranted) {
    return renderLoading();
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
              <TouchableOpacity style={styles.previewRetakeButton} onPress={handleRetake}>
                <Icon name="refresh" size={24} color={colors.white} />
                <Text style={styles.previewRetakeButtonText}>Retake</Text>
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
              style={{ flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              device={device}
              isActive={visible && !recordedVideo}
              video={true}
              audio={hasMicPermission}
              onInitialized={handleCameraInitialized}
              onError={handleCameraError}
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
                  <Icon
                    name="camera-reverse"
                    size={28}
                    color={isRecording ? '#666' : colors.white}
                  />
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              {!isRecording ? (
                // Not recording - show start button and gallery option
                <>
                  <View style={styles.recordControlsRow}>
                    {/* Gallery button */}
                    <TouchableOpacity
                      style={styles.galleryIconButton}
                      onPress={pickVideoFromGallery}
                    >
                      <Icon name="images" size={28} color={colors.white} />
                    </TouchableOpacity>

                    {/* Record button */}
                    <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                      <View style={styles.recordButtonInner}>
                        <View style={styles.recordIcon} />
                      </View>
                    </TouchableOpacity>

                    {/* Placeholder for symmetry */}
                    <View style={styles.galleryIconButton} />
                  </View>
                  <Text style={styles.hintText}>Tap to record or choose from gallery</Text>
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
    backgroundColor: '#000',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#000',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.white,
    fontSize: 16,
    marginTop: 16,
  },
  cancelLoadingButton: {
    marginTop: 24,
    padding: 12,
  },
  cancelLoadingText: {
    color: colors.primary,
    fontSize: 16,
  },
  errorTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  galleryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  galleryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingsButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  topControlsContainer: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  topControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  topButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  disabledButton: {
    opacity: 0.5,
  },
  placeholder: {
    height: 44,
    width: 44,
  },
  recordingIndicator: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordingDot: {
    backgroundColor: '#FF0000',
    borderRadius: 6,
    height: 12,
    marginRight: 8,
    width: 12,
  },
  durationText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  bottomControls: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    paddingBottom: Platform.OS === 'android' ? 40 : 50,
    paddingTop: 20,
    position: 'absolute',
    right: 0,
  },
  recordControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  galleryIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  recordButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.white,
    borderRadius: 40,
    borderWidth: 4,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  recordButtonInner: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  recordIcon: {
    backgroundColor: '#FF0000',
    borderRadius: 30,
    height: 60,
    width: 60,
  },
  stopIcon: {
    backgroundColor: '#FF0000',
    borderRadius: 6,
    height: 32,
    width: 32,
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
    alignItems: 'center',
    backgroundColor: '#000',
    flex: 1,
    justifyContent: 'center',
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
  previewRetakeButton: {
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  previewRetakeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
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
