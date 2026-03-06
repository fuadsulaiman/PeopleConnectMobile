import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { GlobalSearchScreenProps } from '../../navigation/types';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getSearch = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.search;
};
const search = { global: (query: string, options?: any) => getSearch().global(query, options), searchUsers: (query: string) => getSearch().searchUsers(query), searchConversations: (query: string) => getSearch().searchConversations(query), searchMessages: (query: string) => getSearch().searchMessages(query) };
import { debounce } from '../../utils/debounce';
import { Avatar } from '../../components/common/Avatar';

// Define result types
interface UserResult {
  id: string;
  username: string;
  displayName: string;
  name?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  status?: string;
}

interface MessageResult {
  id: string;
  conversationId: string;
  conversationName: string;
  content: string;
  senderName: string;
  sentAt: string;
  senderId?: string;
}

interface ConversationResult {
  id: string;
  name: string;
  isGroup: boolean;
  type?: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessagePreview?: string;
  participantCount?: number;
}

interface SearchResults {
  users: UserResult[];
  messages: MessageResult[];
  conversations: ConversationResult[];
}

type TabType = 'all' | 'users' | 'messages' | 'conversations';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'search' },
  { key: 'users', label: 'Users', icon: 'person' },
  { key: 'messages', label: 'Messages', icon: 'chatbubble' },
  { key: 'conversations', label: 'Chats', icon: 'chatbubbles' },
];

const GlobalSearchScreen: React.FC<GlobalSearchScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    users: [],
    messages: [],
    conversations: [],
  });
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Perform search API call
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ users: [], messages: [], conversations: [] });
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      // Use SDK search service
      const response = await search.search({
        query: searchQuery,
        limit: 20,
      });

      // Normalize the response data
      const data = response as any;

      setResults({
        users: (data.users || []).map((u: any) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.name || u.username,
          name: u.name,
          avatarUrl: u.avatarUrl,
          isOnline: u.isOnline || u.status?.toLowerCase() === 'online',
          status: u.status,
        })),
        messages: (data.messages || []).map((m: any) => ({
          id: m.id,
          conversationId: m.conversationId,
          conversationName: m.conversationName || 'Unknown',
          content: m.content,
          senderName: m.senderName || m.sender?.name || 'Unknown',
          sentAt: m.sentAt || m.createdAt,
          senderId: m.senderId,
        })),
        conversations: (data.conversations || []).map((c: any) => ({
          id: c.id,
          name: c.name || 'Unknown',
          isGroup: c.type === 'Chatroom' || c.isGroup === true,
          type: c.type,
          avatarUrl: c.avatarUrl,
          lastMessage: c.lastMessagePreview || c.lastMessage,
          lastMessagePreview: c.lastMessagePreview,
          participantCount: c.participantCount,
        })),
      });
    } catch (error) {
      console.error('Search failed:', error);
      setResults({ users: [], messages: [], conversations: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((q: string) => performSearch(q), 300),
    [performSearch]
  );

  // Handle query change
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      debouncedSearch(text);
    },
    [debouncedSearch]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setResults({ users: [], messages: [], conversations: [] });
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  // Navigate back
  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  // Handle user tap - navigate to user profile
  const handleUserPress = useCallback(
    (user: UserResult) => {
      Keyboard.dismiss();
      navigation.navigate('ChatTab', {
        screen: 'UserProfile',
        params: {
          userId: user.id,
          userName: user.displayName || user.name,
          userAvatar: user.avatarUrl,
          username: user.username,
        },
      });
    },
    [navigation]
  );

  // Handle message tap - navigate to conversation at that message
  const handleMessagePress = useCallback(
    (message: MessageResult) => {
      Keyboard.dismiss();
      navigation.navigate('ChatTab', {
        screen: 'Chat',
        params: {
          conversationId: message.conversationId,
          // Could add messageId to scroll to specific message
        },
      });
    },
    [navigation]
  );

  // Handle conversation tap - open conversation
  const handleConversationPress = useCallback(
    (conversation: ConversationResult) => {
      Keyboard.dismiss();
      navigation.navigate('ChatTab', {
        screen: 'Chat',
        params: {
          conversationId: conversation.id,
        },
      });
    },
    [navigation]
  );

  // Get counts for each tab
  const counts = useMemo(
    () => ({
      all: results.users.length + results.messages.length + results.conversations.length,
      users: results.users.length,
      messages: results.messages.length,
      conversations: results.conversations.length,
    }),
    [results]
  );

  // Get filtered results based on active tab
  const filteredResults = useMemo(() => {
    switch (activeTab) {
      case 'users':
        return results.users.map((u) => ({ type: 'user' as const, data: u }));
      case 'messages':
        return results.messages.map((m) => ({ type: 'message' as const, data: m }));
      case 'conversations':
        return results.conversations.map((c) => ({ type: 'conversation' as const, data: c }));
      case 'all':
      default:
        return [
          ...results.users.map((u) => ({ type: 'user' as const, data: u })),
          ...results.conversations.map((c) => ({ type: 'conversation' as const, data: c })),
          ...results.messages.map((m) => ({ type: 'message' as const, data: m })),
        ];
    }
  }, [activeTab, results]);

  // Format date for messages
  const formatDate = useCallback((dateStr: string) => {
    if (!dateStr) {
      return '';
    }
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  // Render user result
  const renderUserResult = useCallback(
    (user: UserResult) => (
      <TouchableOpacity
        key={`user-${user.id}`}
        style={styles.resultItem}
        onPress={() => handleUserPress(user)}
        activeOpacity={0.7}
      >
        <Avatar
          uri={user.avatarUrl}
          name={user.displayName || user.username}
          size={48}
          status={user.isOnline ? 'online' : 'offline'}
        />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {user.displayName || user.name || user.username}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
        <View style={styles.resultBadge}>
          <Icon name="person" size={14} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    ),
    [styles, colors, handleUserPress]
  );

  // Render message result
  const renderMessageResult = useCallback(
    (message: MessageResult) => (
      <TouchableOpacity
        key={`message-${message.id}`}
        style={styles.resultItem}
        onPress={() => handleMessagePress(message)}
        activeOpacity={0.7}
      >
        <View style={styles.messageIcon}>
          <Icon name="chatbubble" size={24} color={colors.primary} />
        </View>
        <View style={styles.resultContent}>
          <View style={styles.messageHeader}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {message.conversationName}
            </Text>
            <Text style={styles.messageTime}>{formatDate(message.sentAt)}</Text>
          </View>
          <Text style={styles.messageSender} numberOfLines={1}>
            {message.senderName}
          </Text>
          <Text style={styles.messageContent} numberOfLines={2}>
            {message.content}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [styles, colors, formatDate, handleMessagePress]
  );

  // Render conversation result
  const renderConversationResult = useCallback(
    (conversation: ConversationResult) => (
      <TouchableOpacity
        key={`conversation-${conversation.id}`}
        style={styles.resultItem}
        onPress={() => handleConversationPress(conversation)}
        activeOpacity={0.7}
      >
        <Avatar uri={conversation.avatarUrl} name={conversation.name} size={48} />
        <View style={styles.resultContent}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {conversation.name}
          </Text>
          {conversation.lastMessage && (
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {conversation.lastMessage}
            </Text>
          )}
        </View>
        <View style={styles.resultBadge}>
          <Icon
            name={conversation.isGroup ? 'people' : 'chatbubbles'}
            size={14}
            color={colors.textTertiary}
          />
        </View>
      </TouchableOpacity>
    ),
    [styles, colors, handleConversationPress]
  );

  // Render result item
  const renderItem = useCallback(
    ({ item }: { item: { type: 'user' | 'message' | 'conversation'; data: any } }) => {
      switch (item.type) {
        case 'user':
          return renderUserResult(item.data);
        case 'message':
          return renderMessageResult(item.data);
        case 'conversation':
          return renderConversationResult(item.data);
        default:
          return null;
      }
    },
    [renderUserResult, renderMessageResult, renderConversationResult]
  );

  // Render empty state
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }

    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Search</Text>
          <Text style={styles.emptyText}>Search for users, messages, and conversations</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="search-outline" size={64} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Results</Text>
        <Text style={styles.emptyText}>No results found for "{query}"</Text>
      </View>
    );
  }, [isLoading, hasSearched, query, styles, colors]);

  // Render section header for "All" tab
  const renderSectionLabel = useCallback(
    (type: 'user' | 'message' | 'conversation', index: number) => {
      if (activeTab !== 'all') {
        return null;
      }

      const isFirstUser = type === 'user' && index === 0;
      const isFirstConversation =
        type === 'conversation' && results.users.length === 0 && index === 0;
      const isFirstConversationAfterUsers =
        type === 'conversation' && results.users.length > 0 && index === results.users.length;
      const isFirstMessage =
        type === 'message' &&
        results.users.length === 0 &&
        results.conversations.length === 0 &&
        index === 0;
      const isFirstMessageAfterOthers =
        type === 'message' &&
        (results.users.length > 0 || results.conversations.length > 0) &&
        index === results.users.length + results.conversations.length;

      let label = '';
      if (isFirstUser && results.users.length > 0) {
        label = 'Users';
      } else if (
        (isFirstConversation || isFirstConversationAfterUsers) &&
        results.conversations.length > 0
      ) {
        label = 'Conversations';
      } else if ((isFirstMessage || isFirstMessageAfterOthers) && results.messages.length > 0) {
        label = 'Messages';
      }

      if (!label) {
        return null;
      }

      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{label}</Text>
        </View>
      );
    },
    [activeTab, results, styles]
  );

  // Render list item with potential section header
  const renderListItem = useCallback(
    ({
      item,
      index,
    }: {
      item: { type: 'user' | 'message' | 'conversation'; data: any };
      index: number;
    }) => {
      return (
        <>
          {renderSectionLabel(item.type, index)}
          {renderItem({ item })}
        </>
      );
    },
    [renderItem, renderSectionLabel]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search users, messages, conversations..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Icon name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {counts[tab.key] > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text
                  style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}
                >
                  {counts[tab.key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Results List */}
      {!isLoading && (
        <FlatList
          data={filteredResults}
          renderItem={renderListItem}
          keyExtractor={(item, index) => `${item.type}-${item.data.id}-${index}`}
          contentContainerStyle={
            filteredResults.length === 0 ? styles.emptyListContainer : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    backButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    clearButton: {
      marginLeft: 8,
      padding: 4,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    emptyContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 32,
    },
    emptyListContainer: {
      flex: 1,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 16,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    listContent: {
      paddingBottom: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    messageContent: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 18,
      marginTop: 4,
    },
    messageHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    messageIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    messageSender: {
      color: colors.primary,
      fontSize: 13,
      marginTop: 2,
    },
    messageTime: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    resultBadge: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    resultContent: {
      flex: 1,
      marginLeft: 12,
    },
    resultItem: {
      alignItems: 'center',
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    resultSubtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    resultTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    searchContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      flex: 1,
      flexDirection: 'row',
      height: 44,
      paddingHorizontal: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      paddingVertical: 0,
    },
    sectionHeader: {
      backgroundColor: colors.background,
      paddingBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sectionHeaderText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    tab: {
      alignItems: 'center',
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabBadge: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      minWidth: 20,
      paddingHorizontal: 6,
    },
    tabBadgeActive: {
      backgroundColor: colors.primary,
    },
    tabBadgeText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    tabBadgeTextActive: {
      color: colors.white,
    },
    tabBar: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      height: 44,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.primary,
    },
  });

export default GlobalSearchScreen;
