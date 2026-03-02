import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { ChatStackParamList } from '../../navigation/types';
import { useChatStore } from '../../stores/chatStore';
import { conversations as conversationsApi } from '../../services/sdk';
import { Conversation } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';

type Props = NativeStackScreenProps<ChatStackParamList, 'ArchivedConversations'>;

export const ArchivedConversationsScreen: React.FC<Props> = ({ navigation }) => {
  const { archivedConversations, isLoading, fetchArchivedConversations, updateConversation } = useChatStore();

  useEffect(() => {
    fetchArchivedConversations();
  }, [fetchArchivedConversations]);

  const handleConversationPress = useCallback((conversation: Conversation) => {
    navigation.navigate('Chat', { conversationId: conversation.id, conversation });
  }, [navigation]);

  const handleUnarchive = useCallback(async (item: Conversation) => {
    try {
      await conversationsApi.unarchive(item.id);
      updateConversation({ id: item.id, isArchived: false });
    } catch (error) {
      console.error('Failed to unarchive conversation:', error);
      Alert.alert('Error', 'Failed to unarchive conversation');
    }
  }, [updateConversation]);

  const handleDelete = useCallback((item: Conversation) => {
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
            useChatStore.setState((state) => ({
              archivedConversations: state.archivedConversations.filter((c) => c.id !== item.id),
            }));
          } catch (error) {
            console.error('Failed to delete conversation:', error);
            Alert.alert('Error', 'Failed to delete conversation');
          }
        },
      },
    ]);
  }, []);

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

  const renderConversation = ({ item }: { item: Conversation }) => {
    const isDM = item.type === 'DirectMessage';
    const displayName = item.name || (isDM ? 'Unknown' : 'Group Chat');
    const avatarUrl = item.avatarUrl;

    return (
      <View style={styles.conversationRow}>
        <TouchableOpacity
          style={styles.conversationItem}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={avatarUrl}
            name={displayName}
            size={56}
          />
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.conversationTime}>
                {formatLastMessageTime(item.lastMessageAt)}
              </Text>
            </View>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessagePreview || 'No messages'}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.unarchiveButton]}
            onPress={() => handleUnarchive(item)}
          >
            <Icon name="arrow-undo-outline" size={20} color="#6366f1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Icon name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archived</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={archivedConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={archivedConversations.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchArchivedConversations}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon={<Icon name="archive-outline" size={64} color="#ccc" />}
              title="No Archived Conversations"
              message="Archived conversations will appear here"
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 40,
  },
  emptyContainer: {
    flex: 1,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  conversationItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    color: '#1a1a1a',
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingRight: 12,
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unarchiveButton: {
    backgroundColor: '#eef2ff',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
});

export default ArchivedConversationsScreen;
