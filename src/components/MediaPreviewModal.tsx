import React, { useState, useEffect } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { colors } from '../constants/colors';

const { height: screenHeight } = Dimensions.get('window');

export interface MediaPreviewItem {
  uri: string;
  type: 'image' | 'video' | 'document';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

interface MediaPreviewModalProps {
  visible: boolean;
  media: MediaPreviewItem | null;
  onClose: () => void;
  onSend: (caption: string, isViewOnce: boolean) => void;
  sending?: boolean;
  viewOnceEnabled?: boolean; // From backend settings
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  media,
  onClose,
  onSend,
  sending = false,
  viewOnceEnabled = true,
}) => {
  const [caption, setCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCaption('');
      setIsViewOnce(false);
      setImageLoading(true);
      setVideoError(false);
    }
  }, [visible]);

  const handleSend = () => {
    if (!sending) {
      onSend(caption.trim(), isViewOnce);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) return 'document-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('word') || mimeType.includes('doc')) return 'document-outline';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'grid-outline';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'easel-outline';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'file-tray-outline';
    return 'document-outline';
  };

  const renderMediaPreview = () => {
    if (!media) return null;

    if (media.type === 'image') {
      return (
        <View style={styles.mediaContainer}>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <Image
            source={{ uri: media.uri }}
            style={styles.imagePreview}
            resizeMode="contain"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
          />
        </View>
      );
    }

    if (media.type === 'video') {
      return (
        <View style={styles.mediaContainer}>
          {videoError ? (
            <View style={styles.videoErrorContainer}>
              <Icon name="videocam-off-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.videoErrorText}>Cannot preview video</Text>
              <Text style={styles.videoFileName}>{media.fileName || 'Video'}</Text>
            </View>
          ) : (
            <Video
              source={{ uri: media.uri }}
              style={styles.videoPreview}
              resizeMode="contain"
              controls={true}
              paused={false}
              repeat={true}
              muted={false}
              onError={() => setVideoError(true)}
            />
          )}
        </View>
      );
    }

    // Document preview
    return (
      <View style={styles.documentContainer}>
        <View style={styles.documentIconContainer}>
          <Icon name={getFileIcon(media.mimeType)} size={64} color={colors.primary} />
        </View>
        <Text style={styles.documentName} numberOfLines={2}>
          {media.fileName || 'Document'}
        </Text>
        {media.fileSize && (
          <Text style={styles.documentSize}>{formatFileSize(media.fileSize)}</Text>
        )}
      </View>
    );
  };

  if (!visible || !media) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={sending}
            >
              <Icon name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {media.type === 'image' ? 'Send Photo' :
               media.type === 'video' ? 'Send Video' : 'Send Document'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Media Preview */}
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewScrollContent}
          >
            {renderMediaPreview()}
          </ScrollView>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {/* View Once Toggle - Only show if feature is enabled */}
            {viewOnceEnabled && (
              <TouchableOpacity
                style={styles.viewOnceRow}
                onPress={() => setIsViewOnce(!isViewOnce)}
                activeOpacity={0.7}
              >
                <View style={styles.viewOnceLeft}>
                  <View style={[
                    styles.viewOnceIconContainer,
                    isViewOnce && styles.viewOnceIconContainerActive
                  ]}>
                    <Icon
                      name={isViewOnce ? "eye-off" : "eye-outline"}
                      size={22}
                      color={isViewOnce ? colors.white : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.viewOnceTextContainer}>
                    <Text style={styles.viewOnceLabel}>View Once</Text>
                    <Text style={styles.viewOnceDescription}>
                      {isViewOnce
                        ? 'Recipient can only view once'
                        : 'Tap to enable view once'}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.viewOnceToggle,
                  isViewOnce && styles.viewOnceToggleActive
                ]}>
                  <View style={[
                    styles.viewOnceToggleCircle,
                    isViewOnce && styles.viewOnceToggleCircleActive
                  ]} />
                </View>
              </TouchableOpacity>
            )}

            {/* Caption Input */}
            <View style={styles.captionContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor={colors.textSecondary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={1000}
                editable={!sending}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  sending && styles.sendButtonDisabled
                ]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Icon name="send" size={22} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: screenHeight * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoErrorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  videoErrorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  videoFileName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  documentContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: '100%',
  },
  documentIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  documentSize: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bottomControls: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  viewOnceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewOnceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  viewOnceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  viewOnceIconContainerActive: {
    backgroundColor: colors.primary,
  },
  viewOnceTextContainer: {
    flex: 1,
  },
  viewOnceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  viewOnceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewOnceToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  viewOnceToggleActive: {
    backgroundColor: colors.primary,
  },
  viewOnceToggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  viewOnceToggleCircleActive: {
    alignSelf: 'flex-end',
  },
  captionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
  },
  captionInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.primary + '80',
  },
});

export default MediaPreviewModal;
