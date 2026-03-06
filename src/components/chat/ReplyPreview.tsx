import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { Message } from '../../types';
import { getReplyMediaInfo } from './utils';

interface ReplyPreviewProps {
  message: Message | null;
  onClear: () => void;
  isInBubble?: boolean;
  isOwn?: boolean;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  message,
  onClear,
  isInBubble = false,
  isOwn = false,
}) => {
  const { colors } = useTheme();

  if (!message) {
    return null;
  }

  const mediaInfo = getReplyMediaInfo(message);
  const textColor = isInBubble
    ? isOwn
      ? 'rgba(255,255,255,0.7)'
      : colors.textSecondary
    : colors.textSecondary;

  // @ts-ignore

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

  if (!isInBubble) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.replyBar, { backgroundColor: colors.primary }]} />
        <View style={styles.content}>
          <Text style={[styles.replyName, { color: colors.primary }]} numberOfLines={1}>
            Replying to {(message as any).senderName || (message as any).sender?.name || 'message'}
          </Text>
          <Text style={[styles.replyText, { color: textColor }]} numberOfLines={1}>
            {message?.content || '[Message]'}
          </Text>
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={onClear}>
          <Icon name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubbleContainer,
        isOwn ? styles.bubbleContainerOwn : { backgroundColor: 'rgba(0,0,0,0.08)' },
      ]}
    >
      <View
        style={[
          styles.replyBar,
          { backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : colors.primary },
        ]}
      />
      <View style={styles.bubbleContent}>
        <Text
          style={[
            styles.replyPreviewName,
            { color: isOwn ? 'rgba(255,255,255,0.9)' : colors.primary },
          ]}
          numberOfLines={1}
        >
          {(message as any).senderName || (message as any).sender?.name || 'Unknown'}
        </Text>
        <Text style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
          {message?.content || '[Message]'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleContainer: {
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 8,
    minWidth: 150,
    padding: 10,
  },
  bubbleContainerOwn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  bubbleContent: { flex: 1, minWidth: 0 },
  cancelButton: { marginLeft: 8, padding: 8 },
  container: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  content: { flex: 1, justifyContent: 'center' },
  replyBar: { borderRadius: 1.5, marginRight: 10, minHeight: 36, width: 3 },
  replyName: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  replyPreviewName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  replyPreviewText: { fontSize: 12 },
  replyText: { fontSize: 13 },
});

export default ReplyPreview;
