import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useContactsStore } from '../../stores/contactsStore';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getConversations = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.conversations;
};
const getSearch = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.search;
};
const conversations = { createDM: (data: { userId: string }) => getConversations().createDM(data) };
const searchService = { searchUsers: (query: string) => getSearch().searchUsers(query) };
import { colors } from '../../constants/colors';
import { config } from '../../constants';
import { NewChatScreenProps } from '../../navigation/types';
import { Contact } from '../../types';

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }
  if (url.startsWith('http')) {
    return url;
  }
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  // Handle URLs with or without leading slash
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

interface SearchUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  isContact?: boolean;
}

const NewChatScreen: React.FC<NewChatScreenProps> = ({ navigation }) => {
  const { contacts, fetchContacts, isLoading } = useContactsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeoutState] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced server search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Debounce search by 300ms
      const timeout = setTimeout(async () => {
        setIsSearching(true);
        try {
          const users = await searchService.searchUsers(query);

          // Map results and mark which ones are already contacts
          const contactUserIds = new Set(contacts.map((c) => c.user?.id || c.userId));
          const mappedUsers = (users || []).map((u: any) => ({
            id: u.id,
            name: u.name || '',
            username: u.username || '',
            avatarUrl: toAbsoluteUrl(u.avatarUrl),
            isContact: u.isContact || contactUserIds.has(u.id),
          }));

          setSearchResults(mappedUsers);
        } catch (error) {
          console.error('Failed to search users:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);

      setSearchTimeoutState(timeout);
    },
    [contacts, searchTimeout]
  );

  // Filter contacts locally when no search query
  const filteredContacts =
    searchQuery.trim().length < 2
      ? contacts
      : contacts.filter(
          (c) =>
            c.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
        );

  const handleSelectContact = async (contact: Contact) => {
    setCreating(true);
    try {
      const userId = contact.user?.id || contact.userId || '';
      const conversation = await conversations.createDM({ userId });
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversation: conversation as any,
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectUser = async (user: SearchUser) => {
    setCreating(true);
    try {
      const conversation = await conversations.createDM({ userId: user.id });
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversation: conversation as any,
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setCreating(false);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleSelectContact(item)}
      disabled={creating}
    >
      {item.user?.avatarUrl ? (
        <Image source={{ uri: toAbsoluteUrl(item.user.avatarUrl) }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color={colors.white} />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.user?.name || 'Unknown'}</Text>
        <Text style={styles.contactUsername}>@{item.user?.username || ''}</Text>
      </View>
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor:
              item.user?.status?.toLowerCase() === 'online' ? colors.online : colors.offline,
          },
        ]}
      />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => handleSelectUser(item)}
      disabled={creating}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color={colors.white} />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactUsername}>@{item.username}</Text>
      </View>
      {item.isContact && (
        <View style={styles.contactBadge}>
          <Text style={styles.contactBadgeText}>Contact</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="people-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyText}>
        {searchQuery.trim().length >= 2 ? 'No users found' : 'No contacts yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery.trim().length >= 2
          ? 'Try a different search term'
          : 'Search for users to start chatting'}
      </Text>
    </View>
  );

  // Determine what to show: search results or contacts
  const showSearchResults = searchQuery.trim().length >= 2;
  const displayData = showSearchResults ? searchResults : filteredContacts;
  const displayLoading = showSearchResults ? isSearching : isLoading;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Icon name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.createGroupButton} onPress={() => navigation.navigate('CreateGroup')}>
        <View style={styles.createGroupIcon}>
          <Icon name="people" size={24} color={colors.primary} />
        </View>
        <Text style={styles.createGroupText}>Create Group Chat</Text>
        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {!showSearchResults && contacts.length > 0 && (
        <Text style={styles.sectionHeader}>Your Contacts</Text>
      )}

      {displayLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayData as any[]}
          renderItem={(showSearchResults ? renderSearchResult : renderContact) as any}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            displayData.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
      {creating && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  contactBadge: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  contactBadgeText: { color: colors.textSecondary, fontSize: 12 },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactItem: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  contactName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  contactUsername: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  container: { backgroundColor: colors.background, flex: 1 },
  createGroupButton: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  createGroupIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  createGroupText: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptyListContent: { flex: 1 },
  emptySubtext: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: { paddingBottom: 20 },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  searchContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    flexDirection: 'row',
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, height: 44 },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    textTransform: 'uppercase',
  },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
});

export default NewChatScreen;
