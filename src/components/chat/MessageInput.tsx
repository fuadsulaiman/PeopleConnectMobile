import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { Message } from '../../types';
import ReplyPreview from './ReplyPreview';
import { formatRecordingDuration } from './utils';

interface MessageInputProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttachPress: () => void;
  onEmojiPress: () => void;
  onMicPress: () => void;
  isViewOnce: boolean;
  onToggleViewOnce: () => void;
  replyToMessage: Message | null;
  onClearReply: () => void;
  sending: boolean;
  uploadingMedia: boolean;
  isRecording: boolean;
  recordingDuration: number;
  onCancelRecording: () => void;
  onStopRecording: () => void;
  isBroadcast: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  inputText,
  onChangeText,
  onSend,
  onAttachPress,
  onEmojiPress,
  onMicPress,
  isViewOnce,
  onToggleViewOnce,
  replyToMessage,
  onClearReply,
  sending,
  uploadingMedia,
  isRecording,
  recordingDuration,
  onCancelRecording,
  onStopRecording,
  isBroadcast,
}) => {
  const { colors } = useTheme();
  const recordingAnimValue = React.useRef(new Animated.Value(1)).current;

  if (isBroadcast) return null;

  if (isRecording) {
    return (
      <View style={[styles.recordingContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.cancelRecordButton} onPress={onCancelRecording}>
          <Icon name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
        <View style={styles.recordingInfo}>
          <Animated.View style={[styles.recordingDot, { backgroundColor: colors.error, opacity: recordingAnimValue }]} />
          <Text style={[styles.recordingDuration, { color: colors.text }]}>{formatRecordingDuration(recordingDuration)}</Text>
          <Text style={[styles.recordingText, { color: colors.textSecondary }]}>Recording...</Text>
        </View>
        <TouchableOpacity style={[styles.sendRecordButton, { backgroundColor: colors.primary }]} onPress={onStopRecording}>
          <Icon name="send" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {replyToMessage && <ReplyPreview message={replyToMessage} onClear={onClearReply} />}
      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.attachButton} onPress={onAttachPress} disabled={uploadingMedia || sending}>
          {uploadingMedia ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="add-circle-outline" size={28} color={colors.primary} />
          )}
        </TouchableOpacity>
        <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={onChangeText}
            multiline
          />
          <TouchableOpacity style={styles.emojiButton} onPress={onEmojiPress}>
            <Icon name="happy-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {inputText.trim() ? (
          <View style={styles.sendContainer}>
            <TouchableOpacity
              style={[styles.viewOnceToggle, isViewOnce ? { backgroundColor: colors.primary } : { backgroundColor: 'transparent' }]}
              onPress={onToggleViewOnce}
            >
              <Icon name={isViewOnce ? "eye-off" : "eye-outline"} size={20} color={isViewOnce ? colors.white : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }, (sending || uploadingMedia) && styles.sendButtonDisabled]}
              onPress={onSend}
              disabled={sending || uploadingMedia}
            >
              {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="send" size={20} color={colors.white} />}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.micButton} onPress={onMicPress} disabled={uploadingMedia || sending}>
            <Icon name="mic" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, paddingBottom: 24, borderTopWidth: 1 },
  attachButton: { padding: 8 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 12, marginHorizontal: 8, minHeight: 44, maxHeight: 120 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  emojiButton: { padding: 4 },
  micButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendContainer: { flexDirection: 'row', alignItems: 'center' },
  viewOnceToggle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  recordingContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 28, borderTopWidth: 1 },
  cancelRecordButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  recordingDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  recordingDuration: { fontSize: 18, fontWeight: '600', marginRight: 8 },
  recordingText: { fontSize: 14 },
  sendRecordButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});

export default MessageInput;
