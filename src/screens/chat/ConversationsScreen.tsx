import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { ChatStackParamList } from '../../navigation/types';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { useTheme } from '../../hooks';
import { conversations as conversationsApi } from '../../services/sdk';
import { Conversation } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversations'>;

export const ConversationsScreen: React.FC<Props> = ({ navigation }) => {
  const { conversations, isLoading, fetchConversations, updateConversation, typingUsers, recordingUsers } = useChatStore();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const { user } = useAuthStore();
  const { onlineUsers, version: presenceVersion } = usePresenceStore();
  const { colors } = useTheme();

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Helper to get other participant's status for DMs
  const getOtherParticipantStatus = (conversation: Conversation): 'online' | 'offline' | undefined => {
    if (conversation.type !== 'DirectMessage') return undefined;

    // API returns otherUserId directly for DMs
    const otherUserId = conversation.otherUserId;

    // Check presence store for real-time status
    if (otherUserId && onlineUsers[otherUserId]) {
      return 'online';
    }

    return 'offline';
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleConversationPress = useCallback((conversation: Conversation) => {
    navigation.navigate('Chat', { conversationId: conversation.id, conversation });
  }, [navigation]);

  const handleNewChat = useCallback(() => {
    navigation.navigate('NewChat');
  }, [navigation]);

  const closeSwipeable = useCallback((id: string) => {
    const ref = swipeableRefs.current.get(id);
    ref?.close();
  }, []);

  const handlePin = useCallback(async (item: Conversation) => {
    closeSwipeable(item.id);
    try {
      if (item.isPinned) {
        await conversationsApi.unpin(item.id);
        updateConversation({ id: item.id, isPinned: false });
      } else {
        await conversationsApi.pin(item.id);
        updateConversation({ id: item.id, isPinned: true });
      }
    } catch (error) {
      console.error('Failed to pin/unpin conversation:', error);
      Alert.alert('Error', 'Failed to update pin status');
    }
  }, [closeSwipeable, updateConversation]);

  const handleArchive = useCallback(async (item: Conversation) => {
    closeSwipeable(item.id);
    try {
      if (item.isArchived) {
        await conversationsApi.unarchive(item.id);
        updateConversation({ id: item.id, isArchived: false });
      } else {
        await conversationsApi.archive(item.id);
        updateConversation({ id: item.id, isArchived: true });
        // Optionally remove from list or show archived section
      }
    } catch (error) {
      console.error('Failed to archive/unarchive conversation:', error);
      Alert.alert('Error', 'Failed to update archive status');
    }
  }, [closeSwipeable, updateConversation]);

  const handleDelete = useCallback((item: Conversation) => {
    closeSwipeable(item.id);
    const isDM = item.type === 'DirectMessage';
    const title = isDM ? 'Delete Conversation' : 'Leave Group';
    const message = isDM
      ? 'Are you sure you want to delete this conversation? This action cannot be undone.'
      : 'Are you sure you want to leave this group?';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isDM ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await conversationsApi.delete(item.id);
            // Remove from local state
            useChatStore.setState((state) => ({
              conversations: state.conversations.filter((c) => c.id !== item.id),
            }));
          } catch (error) {
            console.error('Failed to delete conversation:', error);
            Alert.alert('Error', 'Failed to delete conversation');
          }
        },
      },
    ]);
  }, [closeSwipeable]);

  const handleMute = useCallback(async (item: Conversation) => {
    closeSwipeable(item.id);
    try {
      if (item.isMuted) {
        await conversationsApi.unmute(item.id);
        updateConversation({ id: item.id, isMuted: false });
      } else {
        await conversationsApi.mute(item.id);
        updateConversation({ id: item.id, isMuted: true });
      }
    } catch (error) {
      console.error('Failed to mute/unmute conversation:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  }, [closeSwipeable, updateConversation]);

  const renderLeftActions = useCallback(
    (item: Conversation, progress: Animated.AnimatedInterpolation<number>) => {
      const isPlatform = (item as any).isPlatformChannel === true;
      if (isPlatform) return null; // No actions for platform channel

      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-80, 0],
      });

      return (
        <Animated.View style={[styles.swipeActionsLeft, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={[styles.swipeAction, styles.muteAction]}
            onPress={() => handleMute(item)}
          >
            <Icon
              name={item.isMuted ? 'notifications' : 'notifications-off'}
              size={22}
              color="#fff"
            />
            <Text style={styles.swipeActionText}>{item.isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [handleMute, styles]
  );

  const renderRightActions = useCallback(
    (item: Conversation, progress: Animated.AnimatedInterpolation<number>) => {
      const isPlatform = (item as any).isPlatformChannel === true;
      if (isPlatform) return null; // No actions for platform channel

      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [180, 0],
      });

      return (
        <Animated.View style={[styles.swipeActions, { transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={[styles.swipeAction, styles.pinAction]}
            onPress={() => handlePin(item)}
          >
            <Icon name={item.isPinned ? 'pin-outline' : 'pin'} size={22} color="#fff" />
            <Text style={styles.swipeActionText}>{item.isPinned ? 'Unpin' : 'Pin'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeAction, styles.archiveAction]}
            onPress={() => handleArchive(item)}
          >
            <Icon name={item.isArchived ? 'archive-outline' : 'archive'} size={22} color="#fff" />
            <Text style={styles.swipeActionText}>{item.isArchived ? 'Unarchive' : 'Archive'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeAction, styles.deleteAction]}
            onPress={() => handleDelete(item)}
          >
            <Icon name="trash-outline" size={22} color="#fff" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [handlePin, handleArchive, handleDelete, styles]
  );

  const formatLastMessageTime = (date: string | undefined) => {
    if (!date) return '';
    const messageDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatMessagePreview = (preview: string | undefined, _conversation: Conversation) => {
    if (!preview) return 'No messages yet';

    // Already formatted with emoji
    if (preview.startsWith('📷') || preview.startsWith('🎬') || preview.startsWith('🎵') ||
        preview.startsWith('📎') || preview.startsWith('📍')) {
      return preview;
    }

    // Check for location JSON
    if (preview.includes('"latitude"') && preview.includes('"longitude"')) {
      return '📍 Location';
    }

    // Check for media URLs in preview
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(preview)) {
      return '📷 Photo';
    }
    if (/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(preview)) {
      return '🎬 Video';
    }
    if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(preview)) {
      return '🎵 Voice message';
    }
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)(\?|$)/i.test(preview)) {
      return '📎 File';
    }

    // Check for [Media] placeholder
    if (preview === '[Media]' || preview === '[media]') {
      return '📎 Attachment';
    }

    return preview;
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    // API returns 'name' directly for both DMs (other user's name) and chatrooms (room name)
    const isBroadcast = item.type === 'BroadcastChannel';
    const isDM = item.type === 'DirectMessage';
    const isPlatform = (item as any).isPlatformChannel === true;
    const displayName = item.name || (isDM ? 'Unknown' : isBroadcast ? 'Channel' : 'Group Chat');
    const avatarUrl = item.avatarUrl;

    // For DMs, try to get status from multiple sources
    let userStatus: 'online' | 'offline' | undefined = undefined;
    if (isDM) {
      // First check the item directly for otherUserStatus (some APIs include this)
      const directStatus = (item as any).otherUserStatus || (item as any).userStatus || (item as any).status;
      if (directStatus) {
        userStatus = directStatus.toLowerCase() === 'online' ? 'online' : 'offline';
      } else {
        userStatus = getOtherParticipantStatus(item);
      }
    }

    const conversationContent = (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isBroadcast && styles.broadcastItem,
          isPlatform && styles.platformItem,
          item.isPinned && styles.pinnedItem,
        ]}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <Avatar
          uri={avatarUrl}
          name={displayName}
          size={56}
          status={userStatus}
        />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.nameContainer}>
              {item.isPinned && !isPlatform && (
                <Icon name="pin" size={14} color={colors.textSecondary} style={styles.pinnedIcon} />
              )}
              <Text style={[styles.conversationName, isBroadcast && styles.broadcastName, isPlatform && styles.platformName]} numberOfLines={1}>
                {displayName}
              </Text>
              {isPlatform && (
                <View style={styles.officialBadge}>
                  <Text style={styles.officialBadgeText}>Official</Text>
                </View>
              )}
            </View>
            <View style={styles.timeContainer}>
              {item.isMuted && (
                <Icon name="notifications-off" size={14} color={colors.textTertiary} style={styles.mutedIcon} />
              )}
              <Text style={styles.conversationTime}>
                {formatLastMessageTime(item.lastMessageAt)}
              </Text>
            </View>
          </View>
          <View style={styles.conversationFooter}>
            {(() => {
              // Check for recording users in this conversation
              const conversationRecordingUsers = recordingUsers.filter(
                u => u.conversationId === item.id && u.userId?.toLowerCase() !== user?.id?.toLowerCase()
              );
              if (conversationRecordingUsers.length > 0) {
                const names = conversationRecordingUsers.map(u => u.name).slice(0, 2);
                return (
                  <View style={styles.typingIndicator}>
                    <Icon name="mic" size={12} color={colors.error} style={{ marginRight: 4 }} />
                    <Text style={[styles.typingText, { color: colors.error }]} numberOfLines={1}>
                      {names.length === 1
                        ? `${names[0]} is recording...`
                        : `${names.join(', ')} are recording...`}
                    </Text>
                  </View>
                );
              }

              // Check for typing users in this conversation
              const conversationTypingUsers = typingUsers.filter(
                u => u.conversationId === item.id && u.userId?.toLowerCase() !== user?.id?.toLowerCase()
              );
              if (conversationTypingUsers.length > 0) {
                const names = conversationTypingUsers.map(u => u.name).slice(0, 2);
                return (
                  <View style={styles.typingIndicator}>
                    <Text style={[styles.typingText, { color: colors.primary }]} numberOfLines={1}>
                      {names.length === 1
                        ? `${names[0]} is typing...`
                        : `${names.join(', ')} are typing...`}
                    </Text>
                  </View>
                );
              }

              // Default: show last message preview
              return (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {formatMessagePreview(item.lastMessagePreview, item)}
                </Text>
              );
            })()}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    // Platform channels don't have swipe actions
    if (isPlatform) {
      return conversationContent;
    }

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderLeftActions={(progress) => renderLeftActions(item, progress)}
        renderRightActions={(progress) => renderRightActions(item, progress)}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
      >
        {conversationContent}
      </Swipeable>
    );
  };

  const handleArchived = useCallback(() => {
    navigation.navigate('ArchivedConversations' as any);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.archiveButton} onPress={handleArchived}>
            <Icon name="archive-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
            <Text style={styles.newChatIcon}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={conversations as any}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        extraData={presenceVersion}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchConversations}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon={<Icon name="chatbubbles-outline" size={64} color={colors.textTertiary} />}
              title="No Conversations"
              message="Start a new conversation to begin chatting"
              actionLabel="Start Chat"
              onAction={handleNewChat}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archiveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatIcon: {
    fontSize: 24,
    color: colors.white,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutedIcon: {
    marginRight: 4,
  },
  conversationTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  broadcastItem: {
    backgroundColor: colors.surface,
  },
  broadcastAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  channelIcon: {
    marginRight: 4,
  },
  broadcastName: {
    color: colors.primary,
  },
  platformItem: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
  },
  platformAvatar: {
    backgroundColor: colors.secondary,
  },
  platformName: {
    color: colors.secondary,
  },
  officialBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  pinnedItem: {
    backgroundColor: colors.surface,
  },
  pinnedIcon: {
    marginRight: 4,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    width: 70,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  pinAction: {
    backgroundColor: colors.warning,
  },
  archiveAction: {
    backgroundColor: colors.secondary,
  },
  deleteAction: {
    backgroundColor: colors.error,
  },
  muteAction: {
    backgroundColor: colors.info || '#5BC0DE',
  },
  typingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingText: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ConversationsScreen;
