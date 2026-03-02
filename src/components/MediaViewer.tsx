import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  SafeAreaView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import Video, { OnLoadData, OnProgressData } from 'react-native-video';
import { colors } from '../constants/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  fileName?: string;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  visible,
  mediaUrl,
  mediaType,
  fileName,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<any>(null);

  const getFileName = (url: string): string => {
    if (fileName) return fileName;
    const pathPart = url.split('?')[0];
    return pathPart.split('/').pop() || 'file';
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (!mediaUrl) return;

    try {
      setDownloading(true);
      setDownloadProgress(0);

      const name = getFileName(mediaUrl);
      const downloadPath = Platform.OS === 'ios'
        ? `${RNFS.DocumentDirectoryPath}/${name}`
        : `${RNFS.DownloadDirectoryPath}/${name}`;

      const downloadResult = RNFS.downloadFile({
        fromUrl: mediaUrl,
        toFile: downloadPath,
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength;
          setDownloadProgress(progress);
        },
      });

      const result = await downloadResult.promise;

      if (result.statusCode === 200) {
        setDownloading(false);

        if (Platform.OS === 'ios') {
          await Share.share({
            url: `file://${downloadPath}`,
          });
        } else {
          Alert.alert(
            'Downloaded',
            `File saved to Downloads folder as "${name}"`,
            [{ text: 'OK' }]
          );
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!mediaUrl) return;

    try {
      await Share.share({
        url: mediaUrl,
        message: mediaUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const onVideoLoad = (data: OnLoadData) => {
    setLoading(false);
    setVideoDuration(data.duration);
    setVideoError(false);
  };

  const onVideoProgress = (data: OnProgressData) => {
    setVideoProgress(data.currentTime);
  };

  const onVideoError = (error: any) => {
    console.error('Video error:', error);
    setLoading(false);
    setVideoError(true);
  };

  const togglePlayPause = () => {
    setPaused(!paused);
  };


  // Reset state when modal closes
  const handleClose = () => {
    setPaused(true);
    setVideoProgress(0);
    setVideoDuration(0);
    setLoading(true);
    setVideoError(false);
    onClose();
  };

  if (!visible || !mediaUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Icon name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <Icon name="share-outline" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownload} style={styles.headerButton}>
              <Icon name="download-outline" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {mediaType === 'image' ? (
            <>
              {loading && (
                <ActivityIndicator size="large" color={colors.white} style={styles.loader} />
              )}
              <Image
                source={{ uri: mediaUrl }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
              />
            </>
          ) : mediaType === 'video' ? (
            <View style={styles.videoContainer}>
              {loading && (
                <ActivityIndicator size="large" color={colors.white} style={styles.loader} />
              )}
              {videoError ? (
                <View style={styles.videoErrorContainer}>
                  <Icon name="alert-circle-outline" size={64} color={colors.white} />
                  <Text style={styles.videoErrorText}>Unable to play video</Text>
                  <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                    <Icon name="download-outline" size={24} color={colors.white} />
                    <Text style={styles.downloadButtonText}>Download to play</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Video
                    ref={videoRef}
                    source={{ uri: mediaUrl }}
                    style={styles.video}
                    resizeMode="contain"
                    paused={paused}
                    onLoad={onVideoLoad}
                    onProgress={onVideoProgress}
                    onError={onVideoError}
                    repeat={false}
                    controls={false}
                  />
                  {/* Video Controls Overlay */}
                  <TouchableOpacity
                    style={styles.videoControlsOverlay}
                    activeOpacity={1}
                    onPress={togglePlayPause}
                  >
                    {!loading && (
                      <View style={styles.playPauseButton}>
                        <Icon
                          name={paused ? 'play' : 'pause'}
                          size={50}
                          color={colors.white}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                  {/* Progress Bar */}
                  {!loading && videoDuration > 0 && (
                    <View style={styles.videoProgressContainer}>
                      <Text style={styles.videoTime}>{formatTime(videoProgress)}</Text>
                      <View style={styles.videoProgressBar}>
                        <View
                          style={[
                            styles.videoProgressFill,
                            { width: `${(videoProgress / videoDuration) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.videoTime}>{formatTime(videoDuration)}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          ) : mediaType === 'audio' ? (
            <View style={styles.audioContainer}>
              <Icon name="musical-notes" size={80} color={colors.white} />
              <Text style={styles.fileName}>{getFileName(mediaUrl)}</Text>
              {/* Simple audio player using Video component */}
              <Video
                ref={videoRef}
                source={{ uri: mediaUrl }}
                paused={paused}
                onLoad={onVideoLoad}
                onProgress={onVideoProgress}
                onError={onVideoError}
                audioOnly={true}
                style={{ height: 0, width: 0 }}
              />
              {loading ? (
                <ActivityIndicator size="large" color={colors.white} style={{ marginTop: 24 }} />
              ) : videoError ? (
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                  <Text style={styles.videoErrorText}>Unable to play audio</Text>
                  <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                    <Icon name="download-outline" size={24} color={colors.white} />
                    <Text style={styles.downloadButtonText}>Download to play</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.audioPlayButton} onPress={togglePlayPause}>
                    <Icon name={paused ? 'play' : 'pause'} size={32} color={colors.white} />
                  </TouchableOpacity>
                  {videoDuration > 0 && (
                    <View style={[styles.videoProgressContainer, { marginTop: 16 }]}>
                      <Text style={styles.videoTime}>{formatTime(videoProgress)}</Text>
                      <View style={styles.videoProgressBar}>
                        <View
                          style={[
                            styles.videoProgressFill,
                            { width: `${(videoProgress / videoDuration) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.videoTime}>{formatTime(videoDuration)}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          ) : (
            <View style={styles.filePreview}>
              <Icon name="document-text" size={80} color={colors.white} />
              <Text style={styles.fileName}>{getFileName(mediaUrl)}</Text>
              <Text style={styles.fileHint}>Tap download to save and open</Text>

              {downloading ? (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
                  <Text style={styles.progressText}>
                    {Math.round(downloadProgress * 100)}%
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                  <Icon name="download-outline" size={24} color={colors.white} />
                  <Text style={styles.downloadButtonText}>Download</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  // Video styles
  videoContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: screenWidth,
    height: screenHeight * 0.6,
  },
  videoControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  videoProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  videoTime: {
    color: colors.white,
    fontSize: 12,
  },
  videoErrorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  videoErrorText: {
    color: colors.white,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  // Audio styles
  audioContainer: {
    alignItems: 'center',
    padding: 32,
  },
  audioPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  // File styles
  filePreview: {
    alignItems: 'center',
    padding: 32,
  },
  fileName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  fileHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    width: 200,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    color: colors.white,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  downloadButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MediaViewer;
