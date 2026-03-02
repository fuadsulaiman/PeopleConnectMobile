import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Image } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useContactsStore } from "../../stores";
import { conversations, search as searchService } from "../../services/sdk";
import { colors } from "../../constants/colors";
import { config } from "../../constants";
import { NewChatScreenProps } from "../../navigation/types";
import { Contact } from "../../types";

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeoutState] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Debounced server search
  const handleSearch = useCallback((query: string) => {
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
        const contactUserIds = new Set(contacts.map(c => c.user?.id || c.userId));
        const mappedUsers = (users || []).map((u: any) => ({
          id: u.id,
          name: u.name || '',
          username: u.username || '',
          avatarUrl: toAbsoluteUrl(u.avatarUrl),
          isContact: u.isContact || contactUserIds.has(u.id),
        }));

        setSearchResults(mappedUsers);
      } catch (error) {
        console.error("Failed to search users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    setSearchTimeoutState(timeout);
  }, [contacts, searchTimeout]);

  // Filter contacts locally when no search query
  const filteredContacts = searchQuery.trim().length < 2
    ? contacts
    : contacts.filter(c =>
        c.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleSelectContact = async (contact: Contact) => {
    setCreating(true);
    try {
      const userId = contact.user?.id || contact.userId || "";
      const conversation = await conversations.createDM({ userId });
      navigation.replace("Chat", { conversationId: conversation.id, conversation: conversation as any });
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectUser = async (user: SearchUser) => {
    setCreating(true);
    try {
      const conversation = await conversations.createDM({ userId: user.id });
      navigation.replace("Chat", { conversationId: conversation.id, conversation: conversation as any });
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setCreating(false);
    }
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.contactItem} onPress={() => handleSelectContact(item)} disabled={creating}>
      {item.user?.avatarUrl ? <Image source={{ uri: toAbsoluteUrl(item.user.avatarUrl) }} style={styles.avatar} /> :
        <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.user?.name || 'Unknown'}</Text>
        <Text style={styles.contactUsername}>@{item.user?.username || ''}</Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: item.user?.status?.toLowerCase() === "online" ? colors.online : colors.offline }]} />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity style={styles.contactItem} onPress={() => handleSelectUser(item)} disabled={creating}>
      {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} /> :
        <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
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
        {searchQuery.trim().length >= 2 ? "No users found" : "No contacts yet"}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery.trim().length >= 2 ? "Try a different search term" : "Search for users to start chatting"}
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
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Icon name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.createGroupButton} onPress={() => {}}>
        <View style={styles.createGroupIcon}><Icon name="people" size={24} color={colors.primary} /></View>
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
          keyExtractor={item => item.id}
          contentContainerStyle={displayData.length === 0 ? styles.emptyListContent : styles.listContent}
          ListEmptyComponent={renderEmpty}
        />
      )}
      {creating && <View style={styles.overlay}><ActivityIndicator size="large" color={colors.white} /></View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, margin: 16, paddingHorizontal: 12, borderRadius: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16, color: colors.text },
  createGroupButton: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  createGroupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", marginRight: 12 },
  createGroupText: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
  sectionHeader: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, textTransform: "uppercase" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 20 },
  emptyListContent: { flex: 1 },
  contactItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 16, fontWeight: "600", color: colors.text },
  contactUsername: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  contactBadge: { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  contactBadgeText: { fontSize: 12, color: colors.textSecondary },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text, marginTop: 16, textAlign: "center" },
  emptySubtext: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
});

export default NewChatScreen;
