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
    if (!bytes) {
      return '';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) {
      return 'document-outline';
    }
    if (mimeType.includes('pdf')) {
      return 'document-text-outline';
    }
    if (mimeType.includes('word') || mimeType.includes('doc')) {
      return 'document-outline';
    }
    if (mimeType.includes('excel') || mimeType.includes('sheet')) {
      return 'grid-outline';
    }
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return 'easel-outline';
    }
    if (mimeType.includes('zip') || mimeType.includes('rar')) {
      return 'file-tray-outline';
    }
    return 'document-outline';
  };

  const renderMediaPreview = () => {
    if (!media) {
      return null;
    }

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

  if (!visible || !media) {
    return null;
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={sending}>
              <Icon name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {media.type === 'image'
                ? 'Send Photo'
                : media.type === 'video'
                  ? 'Send Video'
                  : 'Send Document'}
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
                  <View
                    style={[
                      styles.viewOnceIconContainer,
                      isViewOnce && styles.viewOnceIconContainerActive,
                    ]}
                  >
                    <Icon
                      name={isViewOnce ? 'eye-off' : 'eye-outline'}
                      size={22}
                      color={isViewOnce ? colors.white : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.viewOnceTextContainer}>
                    <Text style={styles.viewOnceLabel}>View Once</Text>
                    <Text style={styles.viewOnceDescription}>
                      {isViewOnce ? 'Recipient can only view once' : 'Tap to enable view once'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.viewOnceToggle, isViewOnce && styles.viewOnceToggleActive]}>
                  <View
                    style={[
                      styles.viewOnceToggleCircle,
                      isViewOnce && styles.viewOnceToggleCircleActive,
                    ]}
                  />
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
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
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
  bottomControls: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  captionContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  captionInput: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButton: {
    padding: 4,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  documentContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 32,
    width: '100%',
  },
  documentIconContainer: {
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    borderRadius: 20,
    height: 100,
    justifyContent: 'center',
    marginBottom: 16,
    width: 100,
  },
  documentName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  documentSize: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  imagePreview: {
    height: '100%',
    width: '100%',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  mediaContainer: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    maxHeight: screenHeight * 0.5,
    overflow: 'hidden',
    width: '100%',
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    backgroundColor: colors.primary + '80',
  },
  videoErrorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  videoErrorText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
  videoFileName: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  videoPreview: {
    height: '100%',
    width: '100%',
  },
  viewOnceDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  viewOnceIconContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },
  viewOnceIconContainerActive: {
    backgroundColor: colors.primary,
  },
  viewOnceLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  viewOnceLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  viewOnceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  viewOnceTextContainer: {
    flex: 1,
  },
  viewOnceToggle: {
    backgroundColor: colors.border,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    padding: 2,
    width: 50,
  },
  viewOnceToggleActive: {
    backgroundColor: colors.primary,
  },
  viewOnceToggleCircle: {
    backgroundColor: colors.white,
    borderRadius: 13,
    height: 26,
    width: 26,
  },
  viewOnceToggleCircleActive: {
    alignSelf: 'flex-end',
  },
});

export default MediaPreviewModal;
