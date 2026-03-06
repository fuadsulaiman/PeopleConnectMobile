import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Message } from '../../types';
import {
  getAttachmentUrl,
  getAttachmentFileName,
  getMessageThumbnailUrl,
  getReplyMediaInfo,
  isImageUrl,
  isVideoUrl,
  isAudioUrl,
  formatTime,
  parseLocationData,
} from './utils';
import { LinkPreview, extractFirstUrl } from './LinkPreview';
import { LocationMessage } from './LocationMessage';
import { ThemeColors } from './types';

const { width: screenWidth } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = screenWidth * 0.65;
const MAX_MESSAGE_LENGTH = 300;

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  colors: ThemeColors;
  linkPreviewEnabled: boolean;
  expandedMessages: Set<string>;
  viewOnceRevealedMessages: Set<string>;
  viewOnceTimers: Record<string, number>;
  revealingViewOnce: string | null;
  conversationMessages: Message[];
  onOpenMedia: (url: string, type: 'image' | 'video' | 'audio' | 'file', fileName?: string) => void;
  onLongPress: (message: Message) => void;
  onToggleExpansion: (messageId: string) => void;
  onViewOnceReveal: (messageId: string) => void;
  onReactionPress: (message: Message, emoji: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  colors,
  linkPreviewEnabled,
  expandedMessages,
  viewOnceRevealedMessages,
  viewOnceTimers,
  revealingViewOnce,
  conversationMessages,
  onOpenMedia,
  onLongPress,
  onToggleExpansion,
  onViewOnceReveal,
  onReactionPress,
}) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const attachmentUrl = getAttachmentUrl(message);
  const isImageMedia = attachmentUrl && isImageUrl(attachmentUrl);
  const messageType = ((message as any).type || 'text').toLowerCase();

  const getFileIcon = useCallback((fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      pdf: 'document-text',
      doc: 'document-text',
      docx: 'document-text',
      xls: 'grid',
      xlsx: 'grid',
      ppt: 'easel',
      pptx: 'easel',
      txt: 'document',
      zip: 'archive',
      rar: 'archive',
      mp3: 'musical-note',
      wav: 'musical-note',
      m4a: 'musical-note',
      default: 'document-attach',
    };
    return iconMap[ext] || iconMap.default;
  }, []);

  const renderTextContent = useCallback(() => {
    if (!message.content || !message.content.trim()) {
      return null;
    }
    const isLong = message.content.length > MAX_MESSAGE_LENGTH;
    const isExpanded = expandedMessages.has(message.id);
    const displayText =
      isLong && !isExpanded
        ? message.content.slice(0, MAX_MESSAGE_LENGTH) + '...'
        : message.content;
    const firstUrl = linkPreviewEnabled ? extractFirstUrl(message.content) : null;
    return (
      <View>
        <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>{displayText}</Text>
        {isLong && (
          <TouchableOpacity onPress={() => onToggleExpansion(message.id)}>
            <Text
              style={[
                styles.readMoreText,
                { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.primary },
              ]}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}
        {linkPreviewEnabled && firstUrl && <LinkPreview url={firstUrl} isOwn={isOwn} />}
      </View>
    );
  }, [
    message.content,
    message.id,
    expandedMessages,
    isOwn,
    linkPreviewEnabled,
    colors,
    onToggleExpansion,
    styles,
  ]);

  const renderMessageContent = useCallback(() => {
    const hasText = message.content && message.content.trim().length > 0;
    const getMediaType = (url: string | null): 'image' | 'video' | 'audio' | 'file' | null => {
      if (!url) {
        return null;
      }
      if (isImageUrl(url)) {
        return 'image';
      }
      if (isVideoUrl(url)) {
        return 'video';
      }
      if (isAudioUrl(url)) {
        return 'audio';
      }
      return 'file';
    };
    const actualMediaType = getMediaType(attachmentUrl);
    if (attachmentUrl && actualMediaType === 'image') {
      return (
        <View>
          <TouchableOpacity onPress={() => attachmentUrl && onOpenMedia(attachmentUrl, 'image')}>
            <Image source={{ uri: attachmentUrl }} style={styles.messageImage} resizeMode="cover" />
          </TouchableOpacity>
          {hasText && renderTextContent()}
        </View>
      );
    }
    if (attachmentUrl && actualMediaType === 'video') {
      const thumbnailUrl = getMessageThumbnailUrl(message);
      return (
        <View>
          <TouchableOpacity
            style={styles.videoContainer}
            onPress={() => attachmentUrl && onOpenMedia(attachmentUrl, 'video')}
          >
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.videoThumbnail}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.videoThumbnail,
                  {
                    backgroundColor: colors.gray[800],
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Icon name="videocam" size={40} color={colors.white} />
              </View>
            )}
            <View style={styles.playButtonOverlay}>
              <View style={styles.playButton}>
                <Icon name="play" size={24} color={colors.white} />
              </View>
            </View>
          </TouchableOpacity>
          {hasText && renderTextContent()}
        </View>
      );
    }
    if (attachmentUrl && actualMediaType === 'audio') {
      const duration = message.attachments?.[0]?.duration || (message as any).duration || 0;
      const mins = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60);
      return (
        <View>
          <TouchableOpacity
            style={styles.audioContainer}
            onPress={() => attachmentUrl && onOpenMedia(attachmentUrl, 'audio')}
          >
            <View
              style={[
                styles.audioIcon,
                { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.primary + '20' },
              ]}
            >
              <Icon name="mic" size={20} color={isOwn ? colors.white : colors.primary} />
            </View>
            <View style={styles.audioInfo}>
              <View style={styles.audioWaveform}>
                {[0.4, 0.6, 0.8, 1, 0.7, 0.9, 0.5, 0.8, 0.6, 0.4].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: 20 * h,
                        backgroundColor: isOwn ? 'rgba(255,255,255,0.6)' : colors.primary + '80',
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                style={[
                  styles.audioDuration,
                  { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
                ]}
              >
                {mins}:{secs.toString().padStart(2, '0')}
              </Text>
            </View>
          </TouchableOpacity>
          {hasText && renderTextContent()}
        </View>
      );
    }
    if (attachmentUrl && actualMediaType === 'file') {
      const fileName = getAttachmentFileName(message);
      const fileIcon = getFileIcon(fileName);
      return (
        <View>
          <TouchableOpacity
            style={styles.fileContainer}
            onPress={() => attachmentUrl && onOpenMedia(attachmentUrl, 'file', fileName)}
          >
            <View
              style={[
                styles.fileIcon,
                { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.primary + '20' },
              ]}
            >
              <Icon name={fileIcon} size={24} color={isOwn ? colors.white : colors.primary} />
            </View>
            <View style={styles.fileInfo}>
              <Text
                style={[styles.fileName, { color: isOwn ? colors.white : colors.text }]}
                numberOfLines={2}
              >
                {fileName}
              </Text>
              <Text
                style={[
                  styles.fileAction,
                  { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.primary },
                ]}
              >
                Tap to open
              </Text>
            </View>
          </TouchableOpacity>
          {hasText && renderTextContent()}
        </View>
      );
    }
    if (messageType === 'location') {
      const locationData = parseLocationData(message.content);
      if (locationData) {
        return <LocationMessage location={locationData} isOwn={isOwn} />;
      }
    }
    return renderTextContent();
  }, [
    message,
    attachmentUrl,
    isOwn,
    colors,
    messageType,
    onOpenMedia,
    getFileIcon,
    renderTextContent,
    styles,
  ]);

  const renderReplyPreviewContent = useCallback(
    (replyMsg: any) => {
      const mediaInfo = getReplyMediaInfo(replyMsg);
      const textColor = isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
      if (mediaInfo.type === 'text') {
        return (
          <Text
            style={[styles.replyPreviewText, isOwn && styles.replyPreviewTextOwn]}
            numberOfLines={1}
          >
            {replyMsg?.content || '[Message]'}
          </Text>
        );
      }
      const getIconName = () => {
        switch (mediaInfo.type) {
          case 'image':
            return 'image';
          case 'video':
            return 'videocam';
          case 'audio':
            return 'mic';
          case 'file':
            return 'document';
          default:
            return 'attach';
        }
      };
      const getMediaTypeLabel = () => {
        switch (mediaInfo.type) {
          case 'image':
            return 'Photo';
          case 'video':
            return 'Video';
          case 'audio':
            return 'Voice message';
          case 'file':
            return 'File';
          default:
            return 'Media';
        }
      };
      return (
        <View style={styles.replyMediaContainer}>
          <Icon
            name={getIconName() + '-outline'}
            size={14}
            color={textColor}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[styles.replyPreviewText, isOwn && styles.replyPreviewTextOwn]}
            numberOfLines={1}
          >
            {replyMsg?.content?.trim() || getMediaTypeLabel()}
          </Text>
        </View>
      );
    },
    [isOwn, colors, styles]
  );

  const isViewOnceMsg =
    (message as any).isViewOnce || (message as any).IsViewOnce || (message as any).viewOnce;
  const viewOnceViewedAt = (message as any).viewOnceViewedAt || (message as any).ViewOnceViewedAt;
  const isViewOnceHidden =
    isViewOnceMsg && !viewOnceViewedAt && !viewOnceRevealedMessages.has(message.id);
  const isViewOnceViewed = isViewOnceMsg && !!viewOnceViewedAt;
  const viewOnceTimer = viewOnceTimers[message.id];
  const isViewOnceTimerActive =
    viewOnceRevealedMessages.has(message.id) && viewOnceTimer !== undefined && viewOnceTimer > 0;
  const isViewOnceExpired = viewOnceRevealedMessages.has(message.id) && viewOnceTimer === undefined;

  const renderViewOnceContent = useCallback(() => {
    const hasMedia = !!attachmentUrl;
    const isPhoto = hasMedia && isImageUrl(attachmentUrl);
    const isVid = hasMedia && isVideoUrl(attachmentUrl);
    let contentLabel = 'message',
      contentIcon = 'chatbubble-outline';
    if (isPhoto) {
      contentLabel = 'photo';
      contentIcon = 'image-outline';
    } else if (isVid) {
      contentLabel = 'video';
      contentIcon = 'videocam-outline';
    } else if (hasMedia) {
      contentLabel = 'media';
      contentIcon = 'attach-outline';
    }
    if (isViewOnceHidden) {
      if (isOwn) {
        return (
          <View style={styles.viewOnceContainer}>
            <Icon name={contentIcon} size={32} color={colors.white} />
            <Text style={[styles.viewOnceText, { color: colors.white }]}>
              View once {contentLabel}
            </Text>
            <Text style={[styles.viewOnceSubtext, { color: 'rgba(255,255,255,0.7)' }]}>
              Waiting for recipient to view
            </Text>
          </View>
        );
      } else {
        return (
          <TouchableOpacity
            style={styles.viewOnceContainer}
            onPress={() => onViewOnceReveal(message.id)}
            disabled={revealingViewOnce === message.id}
          >
            <Icon name={contentIcon} size={32} color={colors.primary} />
            <Text style={styles.viewOnceText}>
              {revealingViewOnce === message.id ? 'Opening...' : 'Tap to view ' + contentLabel}
            </Text>
            <Text style={styles.viewOnceSubtext}>Can only be viewed once</Text>
          </TouchableOpacity>
        );
      }
    }
    if (isViewOnceViewed || isViewOnceExpired) {
      const viewedLabel = isPhoto ? 'Photo' : isVid ? 'Video' : hasMedia ? 'Media' : 'Message';
      return (
        <View style={styles.viewOnceViewedContainer}>
          <Icon name="eye-off-outline" size={24} color={colors.textSecondary} />
          <Text style={styles.viewOnceViewedText}>{viewedLabel} viewed</Text>
        </View>
      );
    }
    return (
      <View>
        {isViewOnceTimerActive && (
          <View style={styles.viewOnceTimerContainer}>
            <Icon name="eye-off-outline" size={12} color={colors.warning} />
            <Text style={styles.viewOnceTimerText}>Viewing... {viewOnceTimer}s</Text>
          </View>
        )}
        {renderMessageContent()}
      </View>
    );
  }, [
    attachmentUrl,
    isOwn,
    isViewOnceHidden,
    isViewOnceViewed,
    isViewOnceExpired,
    isViewOnceTimerActive,
    viewOnceTimer,
    revealingViewOnce,
    message.id,
    colors,
    onViewOnceReveal,
    renderMessageContent,
    styles,
  ]);

  const replyTo =
    message.replyTo ||
    (message as any).ReplyTo ||
    (message as any).replyToMessage ||
    (message as any).ReplyToMessage;
  const replyToIdVal =
    message.replyToId ||
    (message as any).ReplyToId ||
    (message as any).replyToMessageId ||
    (message as any).ReplyToMessageId;
  const repliedToMsg =
    replyTo || (replyToIdVal ? conversationMessages.find((m) => m.id === replyToIdVal) : null);
  const reactions = message.reactions || [];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => onLongPress(message)}
      delayLongPress={300}
    >
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && (
          <View style={styles.messageAvatar}>
            <Icon name="person" size={16} color={colors.white} />
          </View>
        )}
        <View>
          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
              isImageMedia &&
                !isViewOnceHidden &&
                !isViewOnceViewed &&
                !isViewOnceExpired
                ? styles.mediaBubble
                : undefined,
            ]}
          >
            {repliedToMsg && (
              <View style={[styles.replyPreviewInBubble, isOwn && styles.replyPreviewInBubbleOwn]}>
                <View
                  style={[
                    styles.replyBar,
                    { backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : colors.primary },
                  ]}
                />
                <View style={styles.replyPreviewContent}>
                  <Text
                    style={[styles.replyPreviewName, isOwn && styles.replyPreviewNameOwn]}
                    numberOfLines={1}
                  >
                    {repliedToMsg.senderName || repliedToMsg.sender?.name || 'Unknown'}
                  </Text>
                  {renderReplyPreviewContent(repliedToMsg)}
                </View>
              </View>
            )}
            {isViewOnceMsg ? renderViewOnceContent() : renderMessageContent()}
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
                {formatTime(message.createdAt)}
              </Text>
              {message.isEdited && (
                <Text style={[styles.editedLabel, isOwn && styles.editedLabelOwn]}>edited</Text>
              )}
              {isOwn && (
                <Icon
                  name={
                    message.status === 'read' || message.status === 'Read'
                      ? 'checkmark-done'
                      : 'checkmark'
                  }
                  size={16}
                  color={
                    message.status === 'read' || message.status === 'Read'
                      ? '#4FC3F7'
                      : isOwn
                        ? 'rgba(255,255,255,0.6)'
                        : colors.textSecondary
                  }
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
          {reactions.length > 0 && (
            <View style={[styles.reactionsContainer, isOwn && styles.reactionsContainerOwn]}>
              {reactions.slice(0, 5).map((reaction, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.reactionBubble,
                    reaction.hasReacted && styles.reactionBubbleOwn,
                    {
                      backgroundColor: reaction.hasReacted ? colors.primary + '30' : colors.surface,
                    },
                  ]}
                  onPress={() => onReactionPress(message, reaction.emoji)}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  {reaction.count > 1 && (
                    <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                      {reaction.count}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    audioContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      minWidth: 180,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    audioDuration: { fontSize: 12, marginTop: 4 },
    audioIcon: {
      alignItems: 'center',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginRight: 10,
      width: 40,
    },
    audioInfo: { flex: 1 },
    audioWaveform: { alignItems: 'center', flexDirection: 'row', height: 24 },
    editedLabel: { color: colors.textSecondary, fontSize: 11, fontStyle: 'italic', marginLeft: 4 },
    editedLabelOwn: { color: 'rgba(255,255,255,0.6)' },
    fileAction: { fontSize: 12, marginTop: 2 },
    fileContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      minWidth: 200,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    fileIcon: {
      alignItems: 'center',
      borderRadius: 8,
      height: 44,
      justifyContent: 'center',
      marginRight: 10,
      width: 44,
    },
    fileInfo: { flex: 1 },
    fileName: { fontSize: 14, fontWeight: '500' },
    mediaBubble: { overflow: 'hidden', padding: 4 },
    messageAvatar: {
      alignItems: 'center',
      backgroundColor: colors.gray[400],
      borderRadius: 14,
      height: 28,
      justifyContent: 'center',
      marginRight: 8,
      width: 28,
    },
    messageBubble: { borderRadius: 16, maxWidth: MAX_IMAGE_WIDTH, padding: 12 },
    messageBubbleOther: { backgroundColor: colors.messageBubbleOther, borderBottomLeftRadius: 4 },
    messageBubbleOwn: { backgroundColor: colors.messageBubbleOwn, borderBottomRightRadius: 4 },
    messageFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    messageImage: { borderRadius: 12, height: MAX_IMAGE_WIDTH - 8, width: MAX_IMAGE_WIDTH - 8 },
    messageRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      marginHorizontal: 12,
      marginVertical: 4,
    },
    messageRowOwn: { flexDirection: 'row-reverse' },
    messageText: { color: colors.messageTextOther, fontSize: 15, lineHeight: 20 },
    messageTextOwn: { color: colors.messageTextOwn },
    messageTime: { color: colors.textSecondary, fontSize: 11 },
    messageTimeOwn: { color: 'rgba(255,255,255,0.6)' },
    playButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 25,
      height: 50,
      justifyContent: 'center',
      width: 50,
    },
    playButtonOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    reactionBubble: {
      alignItems: 'center',
      borderRadius: 12,
      flexDirection: 'row',
      marginBottom: 4,
      marginRight: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    reactionBubbleOwn: { borderColor: colors.primary, borderWidth: 1 },
    reactionCount: { fontSize: 12, marginLeft: 4 },
    reactionEmoji: { fontSize: 14 },
    reactionsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: 36, marginTop: 4 },
    reactionsContainerOwn: { justifyContent: 'flex-end', marginLeft: 0, marginRight: 0 },
    readMoreText: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    replyBar: { borderRadius: 1.5, marginRight: 10, width: 3 },
    replyMediaContainer: { alignItems: 'center', flexDirection: 'row' },
    replyPreviewContent: { flex: 1, minWidth: 0 },
    replyPreviewInBubble: {
      backgroundColor: 'rgba(0,0,0,0.08)',
      borderRadius: 8,
      flexDirection: 'row',
      marginBottom: 8,
      minWidth: 150,
      padding: 10,
    },
    replyPreviewInBubbleOwn: { backgroundColor: 'rgba(255,255,255,0.15)' },
    replyPreviewName: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
    replyPreviewNameOwn: { color: 'rgba(255,255,255,0.9)' },
    replyPreviewText: { color: colors.textSecondary, fontSize: 12 },
    replyPreviewTextOwn: { color: 'rgba(255,255,255,0.7)' },
    videoContainer: {
      borderRadius: 12,
      height: (MAX_IMAGE_WIDTH - 8) * 0.75,
      overflow: 'hidden',
      position: 'relative',
      width: MAX_IMAGE_WIDTH - 8,
    },
    videoThumbnail: { height: '100%', width: '100%' },
    viewOnceContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 180,
      paddingHorizontal: 16,
      paddingVertical: 24,
    },
    viewOnceSubtext: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    viewOnceText: { color: colors.text, fontSize: 14, fontWeight: '500', marginTop: 8 },
    viewOnceTimerContainer: { alignItems: 'center', flexDirection: 'row', marginBottom: 8 },
    viewOnceTimerText: { color: colors.warning, fontSize: 12, fontWeight: '500', marginLeft: 4 },
    viewOnceViewedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 150,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    viewOnceViewedText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontStyle: 'italic',
      marginTop: 4,
    },
    waveBar: { borderRadius: 1.5, marginHorizontal: 1, width: 3 },
  });

export default MessageBubble;
