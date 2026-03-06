import React, { useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { ThemeColors } from './types';

interface MessageListProps {
  messages: Message[];
  userId: string;
  colors: ThemeColors;
  isLoading: boolean;
  isLoadingMore: boolean;
  linkPreviewEnabled: boolean;
  replyAllowed: boolean;
  expandedMessages: Set<string>;
  viewOnceRevealedMessages: Set<string>;
  viewOnceTimers: Record<string, number>;
  revealingViewOnce: string | null;
  onLoadMore: () => void;
  onOpenMedia: (url: string, type: 'image' | 'video' | 'audio' | 'file', fileName?: string) => void;
  onMessageLongPress: (message: Message) => void;
  onToggleExpansion: (messageId: string) => void;
  onViewOnceReveal: (messageId: string) => void;
  onReactionPress: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  userId,
  colors,
  isLoading,
  isLoadingMore,
  linkPreviewEnabled,
  replyAllowed,
  expandedMessages,
  viewOnceRevealedMessages,
  viewOnceTimers,
  revealingViewOnce,
  onLoadMore,
  onOpenMedia,
  onMessageLongPress,
  onToggleExpansion,
  onViewOnceReveal,
  onReactionPress,
  onReply,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const scrollOffsetRef = useRef<number>(0);
  const contentHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    isNearBottomRef.current = offsetY < 100;
  }, []);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    const prevHeight = contentHeightRef.current;
    contentHeightRef.current = height;
    if (isNearBottomRef.current && height > prevHeight && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.swipeAction}>
        <Icon name="arrow-undo" size={24} color={colors.primary} />
      </View>
    ),
    [colors, styles]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isOwn = item.senderId === userId;
      const messageType = ((item as any).type || 'text').toLowerCase();

      // System messages
      if (messageType === 'system') {
        return (
          <View style={styles.systemMessageContainer}>
            <View style={styles.systemMessageBubble}>
              <Icon
                name="information-circle-outline"
                size={14}
                color={colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.systemMessageText}>{item.content}</Text>
            </View>
          </View>
        );
      }

      // Call messages
      if (messageType === 'voicecall' || messageType === 'videocall') {
        const isVideoCall = messageType === 'videocall';
        const callIcon = isVideoCall ? 'videocam' : 'call';
        const isMissed = (item.content || '').toLowerCase() === 'missed';
        const iconColor = isMissed ? colors.error : colors.success;
        let callText = item.content || '';
        if (isMissed) {
          callText = isVideoCall ? 'Missed Video Call' : 'Missed Voice Call';
        } else if (callText && callText !== 'Missed') {
          const callTypeText = isVideoCall ? 'Video Call' : 'Voice Call';
          callText = callText.includes(':') ? `${callTypeText} - ${callText}` : callText;
        }
        return (
          <View style={styles.systemMessageContainer}>
            <View
              style={[styles.systemMessageBubble, { paddingVertical: 10, paddingHorizontal: 16 }]}
            >
              <Icon name={callIcon} size={18} color={iconColor} style={{ marginRight: 8 }} />
              <Text style={[styles.systemMessageText, isMissed && { color: colors.error }]}>
                {callText}
              </Text>
            </View>
          </View>
        );
      }

      const messageContent = (
        <MessageBubble
          message={item}
          isOwn={isOwn}
          colors={colors}
          linkPreviewEnabled={linkPreviewEnabled}
          expandedMessages={expandedMessages}
          viewOnceRevealedMessages={viewOnceRevealedMessages}
          viewOnceTimers={viewOnceTimers}
          revealingViewOnce={revealingViewOnce}
          conversationMessages={messages}
          onOpenMedia={onOpenMedia}
          onLongPress={onMessageLongPress}
          onToggleExpansion={onToggleExpansion}
          onViewOnceReveal={onViewOnceReveal}
          onReactionPress={onReactionPress}
        />
      );

      if (!replyAllowed) {
        return messageContent;
      }

      return (
        <Swipeable
          ref={(ref) => {
            swipeableRefs.current[item.id] = ref;
          }}
          renderRightActions={renderRightActions}
          rightThreshold={40}
          overshootRight={false}
          friction={2}
          onSwipeableOpen={(direction) => {
            if (direction === 'right') {
              onReply(item);
            }
          }}
        >
          {messageContent}
        </Swipeable>
      );
    },
    [
      userId,
      colors,
      linkPreviewEnabled,
      replyAllowed,
      expandedMessages,
      viewOnceRevealedMessages,
      viewOnceTimers,
      revealingViewOnce,
      messages,
      onOpenMedia,
      onMessageLongPress,
      onToggleExpansion,
      onViewOnceReveal,
      onReactionPress,
      onReply,
      renderRightActions,
      styles,
    ]
  );

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={reversedMessages as any}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.messagesList}
      inverted
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={16}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingMoreText}>Loading older messages...</Text>
          </View>
        ) : null
      }
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={15}
      windowSize={10}
      initialNumToRender={20}
      updateCellsBatchingPeriod={50}
    />
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    loadingMoreContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: 16,
    },
    loadingMoreText: { color: colors.textSecondary, fontSize: 14, marginLeft: 8 },
    messagesList: { paddingVertical: 8 },
    swipeAction: { alignItems: 'center', justifyContent: 'center', marginVertical: 4, width: 60 },
    systemMessageBubble: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    systemMessageContainer: { alignItems: 'center', marginVertical: 8 },
    systemMessageText: { color: colors.textSecondary, fontSize: 12 },
  });

export default MessageList;
