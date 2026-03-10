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
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useContactsStore } from '../../stores/contactsStore';
import { colors } from '../../constants/colors';
import { config } from '../../constants';
import { AddMembersScreenProps } from '../../navigation/types';
import { Contact } from '../../types';

// CRITICAL: Do NOT import SDK at top level
const getSDK = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.sdk;
};
const getSearch = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.search;
};

const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

interface SelectedUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

interface SearchUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  isContact?: boolean;
}

const AddMembersScreen: React.FC<AddMembersScreenProps> = ({ navigation, route }) => {
  const { conversationId } = route.params;
  const { contacts, fetchContacts, isLoading: contactsLoading } = useContactsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [adding, setAdding] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeoutState] = useState<NodeJS.Timeout | null>(null);
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    fetchContacts();
    loadExistingMembers();
  }, []);

  const loadExistingMembers = async () => {
    try {
      const sdk = getSDK();
      const members = await sdk.conversations.getMembers(conversationId);
      const ids = new Set<string>(
        (members || []).map((m: any) => m.userId || m.user?.id || m.id)
      );
      setExistingMemberIds(ids);
    } catch (error) {
      console.error('Failed to load existing members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeout) clearTimeout(searchTimeout);

      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const timeout = setTimeout(async () => {
        setIsSearching(true);
        try {
          const search = getSearch();
          const users = await search.searchUsers(query);
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

  const toggleUser = (user: SelectedUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const isSelected = (userId: string) => selectedUsers.some((u) => u.id === userId);
  const isExistingMember = (userId: string) => existingMemberIds.has(userId);

  const handleAdd = async () => {
    if (selectedUsers.length === 0) return;

    setAdding(true);
    try {
      const sdk = getSDK();
      const userIds = selectedUsers.map((u) => u.id);
      await sdk.conversations.addParticipants(conversationId, userIds);
      Alert.alert(
        'Members Added',
        `${selectedUsers.length} member(s) added successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('Failed to add members:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to add members.';
      Alert.alert('Error', msg);
    } finally {
      setAdding(false);
    }
  };

  const filteredContacts =
    searchQuery.trim().length < 2
      ? contacts
      : contacts.filter(
          (c) =>
            c.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
        );

  const showSearchResults = searchQuery.trim().length >= 2;
  const displayData = showSearchResults ? searchResults : filteredContacts;
  const displayLoading = showSearchResults ? isSearching : contactsLoading;

  const renderItem = ({ item }: { item: any }) => {
    const userId = item.user?.id || item.userId || item.id || '';
    const name = item.user?.name || item.name || 'Unknown';
    const username = item.user?.username || item.username || '';
    const avatarUrl = toAbsoluteUrl(item.user?.avatarUrl || item.avatarUrl);
    const selected = isSelected(userId);
    const alreadyMember = isExistingMember(userId);

    return (
      <TouchableOpacity
        style={[styles.contactItem, selected && styles.contactItemSelected, alreadyMember && styles.contactItemDisabled]}
        onPress={() => {
          if (!alreadyMember) {
            toggleUser({ id: userId, name, username, avatarUrl });
          }
        }}
        disabled={alreadyMember}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Icon name="person" size={24} color={colors.white} />
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, alreadyMember && styles.disabledText]}>{name}</Text>
          <Text style={styles.contactUsername}>@{username}</Text>
        </View>
        {alreadyMember ? (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>Member</Text>
          </View>
        ) : (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Icon name="checkmark" size={16} color={colors.white} />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loadingMembers) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
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

      {/* Selected users pills */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.selectedLabel}>
            Selected ({selectedUsers.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedScroll}
            contentContainerStyle={styles.selectedScrollContent}
          >
            {selectedUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.selectedPill}
                onPress={() => toggleUser(user)}
              >
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.pillAvatar} />
                ) : (
                  <View style={[styles.pillAvatar, styles.pillAvatarPlaceholder]}>
                    <Icon name="person" size={12} color={colors.white} />
                  </View>
                )}
                <Text style={styles.pillName} numberOfLines={1}>{user.name}</Text>
                <Icon name="close" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Section header */}
      {!showSearchResults && contacts.length > 0 && (
        <Text style={styles.sectionHeader}>Your Contacts</Text>
      )}

      {/* Contact/search list */}
      {displayLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayData as any[]}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.user?.id || item.userId}
          contentContainerStyle={
            displayData.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery.trim().length >= 2 ? 'No users found' : 'No contacts yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.addButton,
            (selectedUsers.length === 0 || adding) && styles.addButtonDisabled,
          ]}
          onPress={handleAdd}
          disabled={selectedUsers.length === 0 || adding}
        >
          {adding ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Icon name="person-add" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>
                Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : 'Members'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  bottomBar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactItem: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  contactItemDisabled: {
    opacity: 0.5,
  },
  contactItemSelected: {
    backgroundColor: colors.surface,
  },
  contactName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  contactUsername: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  container: { backgroundColor: colors.background, flex: 1 },
  disabledText: { color: colors.textSecondary },
  emptyContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptyListContent: { flex: 1 },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  listContent: { paddingBottom: 80 },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  memberBadge: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memberBadgeText: { color: colors.textSecondary, fontSize: 12 },
  pillAvatar: {
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  pillAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  pillName: {
    color: colors.text,
    fontSize: 13,
    maxWidth: 80,
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
    paddingTop: 8,
    textTransform: 'uppercase',
  },
  selectedLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  selectedPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedScroll: {
    maxHeight: 44,
  },
  selectedScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  selectedSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
});

export default AddMembersScreen;
