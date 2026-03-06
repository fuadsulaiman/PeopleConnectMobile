import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useContactsStore } from '../../stores/contactsStore';
import { colors } from '../../constants/colors';
import { AddContactScreenProps } from '../../navigation/types';
import { User } from '../../types';
import { debounce } from '../../utils/debounce';

const AddContactScreen: React.FC<AddContactScreenProps> = ({ navigation }) => {
  const { searchResults, searchUsers, sendRequest, isLoading, clearSearch } = useContactsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim().length >= 2) {
        searchUsers(query);
      } else {
        clearSearch();
      }
    }, 300),
    [searchUsers, clearSearch]
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    try {
      await sendRequest(userId);
      Alert.alert('Success', 'Contact request sent', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to send request');
    }
    setSendingTo(null);
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color={colors.white} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleSendRequest(item.id)}
        disabled={sendingTo === item.id}
      >
        {sendingTo === item.id ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Icon name="person-add" size={20} color={colors.white} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="search" size={48} color={colors.textTertiary} />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No users found' : 'Search for users to add'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              clearSearch();
            }}
          >
            <Icon name="close-circle" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={searchResults as any[]}
          renderItem={renderUser as any}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            searchResults.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  container: { backgroundColor: colors.background, flex: 1 },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyListContent: { flex: 1 },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginTop: 16, textAlign: 'center' },
  listContent: { padding: 16 },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  searchContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    flexDirection: 'row',
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, paddingVertical: 12 },
  userInfo: { flex: 1, marginLeft: 12 },
  userItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 12,
  },
  userName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  userUsername: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
});

export default AddContactScreen;
