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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { ChatStackParamList } from '../../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
// Import chatStore module - we'll access useChatStore from it
import * as chatStoreModule from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { useTheme } from '../../hooks';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getConversations = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.conversations;
};
const conversationsApi = { pin: (id: string) => getConversations().pin(id), unpin: (id: string) => getConversations().unpin(id), archive: (id: string) => getConversations().archive(id), unarchive: (id: string) => getConversations().unarchive(id), delete: (id: string) => getConversations().delete(id), leave: (id: string) => getConversations().leave(id), mute: (id: string) => getConversations().mute(id), unmute: (id: string) => getConversations().unmute(id) };
import { Conversation } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversations'>;

export const ConversationsScreen: React.FC<Props> = ({ navigation }) => {
  const {
    conversations,
    isLoading,
    fetchConversations,
    fetchMoreConversations,
    hasMoreConversations,
    isLoadingMoreConversations,
    updateConversation,
    typingUsers,
    recordingUsers,
  } = chatStoreModule.useChatStore();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const { user } = useAuthStore();
  const { onlineUsers, version: presenceVersion } = usePresenceStore();
  const { colors } = useTheme();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Helper to get other participant's status for DMs
  const getOtherParticipantStatus = (
    conversation: Conversation
  ): 'online' | 'offline' | undefined => {
    if (conversation.type !== 'DirectMessage') {
      return undefined;
    }

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

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      navigation.navigate('Chat', { conversationId: conversation.id, conversation });
    },
    [navigation]
  );

  const handleNewChat = useCallback(() => {
    navigation.navigate('NewChat');
  }, [navigation]);

  const closeSwipeable = useCallback((id: string) => {
    const ref = swipeableRefs.current.get(id);
    ref?.close();
  }, []);

  const handlePin = useCallback(
    async (item: Conversation) => {
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
    },
    [closeSwipeable, updateConversation]
  );

  const handleArchive = useCallback(
    async (item: Conversation) => {
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
    },
    [closeSwipeable, updateConversation]
  );

  const handleDelete = useCallback(
    (item: Conversation) => {
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
              if (isDM) {
                await conversationsApi.delete(item.id);
              } else {
                await conversationsApi.leave(item.id);
              }
              // Remove from local state using store's method
              chatStoreModule.useChatStore.getState().removeConversation(item.id);
            } catch (error) {
              console.error(isDM ? 'Failed to delete conversation:' : 'Failed to leave group:', error);
              Alert.alert('Error', isDM ? 'Failed to delete conversation' : 'Failed to leave group');
            }
          },
        },
      ]);
    },
    [closeSwipeable]
  );

  const handleMute = useCallback(
    async (item: Conversation) => {
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
    },
    [closeSwipeable, updateConversation]
  );

  const renderLeftActions = useCallback(
    (item: Conversation, progress: Animated.AnimatedInterpolation<number>) => {
      const isPlatform = (item as any).isPlatformChannel === true;
      if (isPlatform) {
        return null;
      } // No actions for platform channel

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
      if (isPlatform) {
        return null;
      } // No actions for platform channel

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
            style={[styles.swipeAction, item.type === 'DirectMessage' ? styles.deleteAction : styles.leaveAction]}
            onPress={() => handleDelete(item)}
          >
            <Icon name={item.type === 'DirectMessage' ? 'trash-outline' : 'exit-outline'} size={22} color="#fff" />
            <Text style={styles.swipeActionText}>{item.type === 'DirectMessage' ? 'Delete' : 'Leave'}</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [handlePin, handleArchive, handleDelete, styles]
  );

  const formatLastMessageTime = (date: string | undefined) => {
    if (!date) {
      return '';
    }
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
    if (!preview) {
      return 'No messages yet';
    }

    // Already formatted with emoji
    if (
      preview.startsWith('📷') ||
      preview.startsWith('🎬') ||
      preview.startsWith('🎵') ||
      preview.startsWith('📎') ||
      preview.startsWith('📍')
    ) {
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
    let userStatus: 'online' | 'offline' | undefined;
    if (isDM) {
      // First check the item directly for otherUserStatus (some APIs include this)
      const directStatus =
        (item as any).otherUserStatus || (item as any).userStatus || (item as any).status;
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
        <Avatar uri={avatarUrl} name={displayName} size={56} status={userStatus} />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.nameContainer}>
              {item.isPinned && !isPlatform && (
                <Icon name="pin" size={14} color={colors.textSecondary} style={styles.pinnedIcon} />
              )}
              <Text
                style={[
                  styles.conversationName,
                  isBroadcast && styles.broadcastName,
                  isPlatform && styles.platformName,
                ]}
                numberOfLines={1}
              >
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
                <Icon
                  name="notifications-off"
                  size={14}
                  color={colors.textTertiary}
                  style={styles.mutedIcon}
                />
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
                (u) =>
                  u.conversationId === item.id &&
                  u.userId?.toLowerCase() !== user?.id?.toLowerCase()
              );
              if (conversationRecordingUsers.length > 0) {
                const names = conversationRecordingUsers.map((u) => u.name).slice(0, 2);
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
                (u) =>
                  u.conversationId === item.id &&
                  u.userId?.toLowerCase() !== user?.id?.toLowerCase()
              );
              if (conversationTypingUsers.length > 0) {
                const names = conversationTypingUsers.map((u) => u.name).slice(0, 2);
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
          if (ref) {
            swipeableRefs.current.set(item.id, ref);
          }
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
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => rootNavigation.navigate('Notifications')}
          >
            <Icon name="notifications-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
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
        onEndReached={() => {
          if (hasMoreConversations && !isLoadingMoreConversations) {
            fetchMoreConversations();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMoreConversations ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
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
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    archiveAction: {
      backgroundColor: colors.secondary,
    },
    archiveButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    broadcastAvatar: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    broadcastItem: {
      backgroundColor: colors.surface,
    },
    broadcastName: {
      color: colors.primary,
    },
    channelIcon: {
      marginRight: 4,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    conversationContent: {
      flex: 1,
      marginLeft: 12,
    },
    conversationFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    conversationHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    conversationItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    conversationName: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      marginRight: 8,
    },
    conversationTime: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    deleteAction: {
      backgroundColor: colors.error,
    },
    leaveAction: {
      backgroundColor: colors.warning,
    },
    emptyContainer: {
      flex: 1,
    },
    loadMoreContainer: {
      alignItems: 'center',
      paddingVertical: 16,
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
    headerButtons: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: 'bold',
    },
    lastMessage: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 14,
      marginRight: 8,
    },
    muteAction: {
      backgroundColor: colors.info || '#5BC0DE',
    },
    mutedIcon: {
      marginRight: 4,
    },
    nameContainer: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      marginRight: 8,
    },
    newChatButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    newChatIcon: {
      color: colors.white,
      fontSize: 24,
      fontWeight: '600',
    },
    notificationButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    officialBadge: {
      backgroundColor: colors.surface,
      borderRadius: 4,
      marginLeft: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    officialBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '600',
    },
    pinAction: {
      backgroundColor: colors.warning,
    },
    pinnedIcon: {
      marginRight: 4,
    },
    pinnedItem: {
      backgroundColor: colors.surface,
    },
    platformAvatar: {
      backgroundColor: colors.secondary,
    },
    platformItem: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
    },
    platformName: {
      color: colors.secondary,
    },
    swipeAction: {
      alignItems: 'center',
      height: '100%',
      justifyContent: 'center',
      width: 70,
    },
    swipeActionText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '500',
      marginTop: 4,
    },
    swipeActions: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    swipeActionsLeft: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    timeContainer: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    typingIndicator: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      marginRight: 8,
    },
    typingText: {
      flex: 1,
      fontSize: 14,
      fontStyle: 'italic',
    },
    unreadBadge: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 24,
      justifyContent: 'center',
      minWidth: 24,
      paddingHorizontal: 8,
    },
    unreadCount: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '600',
    },
  });

export default ConversationsScreen;
