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
import * as chatStoreModule from '../../stores/chatStore';
import { colors } from '../../constants/colors';
import { config } from '../../constants';
import { CreateGroupScreenProps } from '../../navigation/types';
import { Contact } from '../../types';

// CRITICAL: Do NOT import SDK at top level
const getSearch = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.search;
};
const searchService = { searchUsers: (query: string) => getSearch().searchUsers(query) };

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

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation }) => {
  const { contacts, fetchContacts, isLoading } = useContactsStore();
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeoutState] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Update header based on step
  useEffect(() => {
    navigation.setOptions({
      title: step === 'select' ? 'Select Members' : 'Group Details',
    });
  }, [step, navigation]);

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
          const users = await searchService.searchUsers(query);
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

  const handleNext = () => {
    if (selectedUsers.length < 1) {
      Alert.alert('Select Members', 'Please select at least one member for the group.');
      return;
    }
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('select');
    } else {
      navigation.goBack();
    }
  };

  const handleCreate = async () => {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      Alert.alert('Group Name Required', 'Please enter a name for the group.');
      return;
    }
    if (trimmedName.length > 100) {
      Alert.alert('Name Too Long', 'Group name cannot exceed 100 characters.');
      return;
    }

    setCreating(true);
    try {
      const userIds = selectedUsers.map((u) => u.id);
      const chatStore = chatStoreModule.useChatStore.getState();
      const conversation = await chatStore.createGroupConversation(trimmedName, userIds);

      if (conversation) {
        navigation.replace('Chat', {
          conversationId: conversation.id,
          conversation: conversation as any,
        });
      } else {
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', error?.message || 'Failed to create group.');
    } finally {
      setCreating(false);
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
  const displayLoading = showSearchResults ? isSearching : isLoading;

  const renderContactItem = ({ item }: { item: Contact }) => {
    const userId = item.user?.id || item.userId || '';
    const name = item.user?.name || 'Unknown';
    const username = item.user?.username || '';
    const avatarUrl = toAbsoluteUrl(item.user?.avatarUrl);
    const selected = isSelected(userId);

    return (
      <TouchableOpacity
        style={[styles.contactItem, selected && styles.contactItemSelected]}
        onPress={() => toggleUser({ id: userId, name, username, avatarUrl })}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Icon name="person" size={24} color={colors.white} />
          </View>
        )}
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{name}</Text>
          <Text style={styles.contactUsername}>@{username}</Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Icon name="checkmark" size={16} color={colors.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchItem = ({ item }: { item: SearchUser }) => {
    const selected = isSelected(item.id);

    return (
      <TouchableOpacity
        style={[styles.contactItem, selected && styles.contactItemSelected]}
        onPress={() =>
          toggleUser({
            id: item.id,
            name: item.name,
            username: item.username,
            avatarUrl: item.avatarUrl,
          })
        }
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
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Icon name="checkmark" size={16} color={colors.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  // Step 1: Select members
  if (step === 'select') {
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
                  <Text style={styles.pillName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Icon name="close" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Contact/search list */}
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
            renderItem={(showSearchResults ? renderSearchItem : renderContactItem) as any}
            keyExtractor={(item) => item.id}
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

        {/* Next button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              selectedUsers.length < 1 && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={selectedUsers.length < 1}
          >
            <Text style={styles.nextButtonText}>
              Next ({selectedUsers.length} selected)
            </Text>
            <Icon name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Step 2: Group details
  return (
    <View style={styles.container}>
      <View style={styles.detailsContainer}>
        {/* Group icon */}
        <View style={styles.groupIconContainer}>
          <View style={styles.groupIconCircle}>
            <Icon name="people" size={40} color={colors.primary} />
          </View>
        </View>

        {/* Group name input */}
        <View style={styles.nameInputContainer}>
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Enter group name..."
            placeholderTextColor={colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={100}
            autoFocus
          />
          <Text style={styles.charCount}>{groupName.length}/100</Text>
        </View>

        {/* Members summary */}
        <View style={styles.membersSummary}>
          <Text style={styles.inputLabel}>
            Members ({selectedUsers.length + 1})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.membersScroll}
            contentContainerStyle={styles.membersScrollContent}
          >
            {/* Current user (creator) */}
            <View style={styles.memberChip}>
              <View style={[styles.memberChipAvatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={14} color={colors.white} />
              </View>
              <Text style={styles.memberChipName} numberOfLines={1}>You</Text>
            </View>
            {selectedUsers.map((user) => (
              <View key={user.id} style={styles.memberChip}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.memberChipAvatar} />
                ) : (
                  <View style={[styles.memberChipAvatar, styles.avatarPlaceholder]}>
                    <Icon name="person" size={14} color={colors.white} />
                  </View>
                )}
                <Text style={styles.memberChipName} numberOfLines={1}>{user.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Back to edit members */}
        <TouchableOpacity style={styles.editMembersButton} onPress={() => setStep('select')}>
          <Icon name="pencil" size={16} color={colors.primary} />
          <Text style={styles.editMembersText}>Edit Members</Text>
        </TouchableOpacity>
      </View>

      {/* Create button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (!groupName.trim() || creating) && styles.nextButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={!groupName.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Icon name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.nextButtonText}>Create Group</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  bottomBar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
  },
  charCount: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
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
  contactItemSelected: {
    backgroundColor: colors.surface,
  },
  contactName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  contactUsername: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  container: { backgroundColor: colors.background, flex: 1 },
  createButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
  },
  detailsContainer: {
    flex: 1,
    padding: 16,
  },
  editMembersButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 20,
    padding: 12,
  },
  editMembersText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptyListContent: { flex: 1 },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  groupIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 50,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  groupIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  listContent: { paddingBottom: 80 },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  memberChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberChipAvatar: {
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  memberChipName: {
    color: colors.text,
    fontSize: 13,
    maxWidth: 80,
  },
  membersScroll: {
    maxHeight: 50,
  },
  membersScrollContent: {
    paddingVertical: 4,
  },
  membersSummary: {
    marginTop: 24,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.text,
    fontSize: 16,
    height: 50,
    paddingHorizontal: 16,
  },
  nameInputContainer: {
    marginBottom: 8,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
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

export default CreateGroupScreen;
