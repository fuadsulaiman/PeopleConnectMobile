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

  if (!message) return null;

  const mediaInfo = getReplyMediaInfo(message);
  const textColor = isInBubble
    ? (isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary)
    : colors.textSecondary;

  // @ts-ignore

  const getMediaTypeLabel = () => {
    switch (mediaInfo.type) {
      case 'image': return 'Photo';
      case 'video': return 'Video';
      case 'audio': return 'Voice message';
      case 'file': return 'File';
      default: return 'Media';
    }
  };



  if (!isInBubble) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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
    <View style={[styles.bubbleContainer, isOwn ? styles.bubbleContainerOwn : { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
      <View style={[styles.replyBar, { backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : colors.primary }]} />
      <View style={styles.bubbleContent}>
        <Text style={[styles.replyPreviewName, { color: isOwn ? 'rgba(255,255,255,0.9)' : colors.primary }]} numberOfLines={1}>
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
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  replyBar: { width: 3, minHeight: 36, borderRadius: 1.5, marginRight: 10 },
  content: { flex: 1, justifyContent: 'center' },
  replyName: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  replyText: { fontSize: 13 },
  replyPreviewText: { fontSize: 12 },
  replyPreviewName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  cancelButton: { padding: 8, marginLeft: 8 },
  bubbleContainer: { flexDirection: 'row', borderRadius: 8, padding: 10, marginBottom: 8, minWidth: 150 },
  bubbleContainerOwn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  bubbleContent: { flex: 1, minWidth: 0 },
});

export default ReplyPreview;
