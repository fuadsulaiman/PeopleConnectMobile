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
// Import chatStore module - we'll access useChatStore from it
import * as chatStoreModule from '../../stores/chatStore';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getConversations = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.conversations;
};
const conversationsApi = { unarchive: (id: string) => getConversations().unarchive(id), delete: (id: string) => getConversations().delete(id) };
import { Conversation } from '../../types';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';

type Props = NativeStackScreenProps<ChatStackParamList, 'ArchivedConversations'>;

export const ArchivedConversationsScreen: React.FC<Props> = ({ navigation }) => {
  const { archivedConversations, isLoading, fetchArchivedConversations, updateConversation } =
    chatStoreModule.useChatStore();

  useEffect(() => {
    fetchArchivedConversations();
  }, [fetchArchivedConversations]);

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      navigation.navigate('Chat', { conversationId: conversation.id, conversation });
    },
    [navigation]
  );

  const handleUnarchive = useCallback(
    async (item: Conversation) => {
      try {
        await conversationsApi.unarchive(item.id);
        updateConversation({ id: item.id, isArchived: false });
      } catch (error) {
        console.error('Failed to unarchive conversation:', error);
        Alert.alert('Error', 'Failed to unarchive conversation');
      }
    },
    [updateConversation]
  );

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
            // Update archived conversations in store
            chatStoreModule.useChatStore.setState((state) => ({
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
          <Avatar uri={avatarUrl} name={displayName} size={56} />
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
        data={archivedConversations as any}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          archivedConversations.length === 0 ? styles.emptyContainer : undefined
        }
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
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  conversationName: {
    color: '#1a1a1a',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  conversationRow: {
    alignItems: 'center',
    borderBottomColor: '#f5f5f5',
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  conversationTime: {
    color: '#999',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  emptyContainer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
  lastMessage: {
    color: '#666',
    fontSize: 14,
  },
  placeholder: {
    width: 40,
  },
  unarchiveButton: {
    backgroundColor: '#eef2ff',
  },
});

export default ArchivedConversationsScreen;
