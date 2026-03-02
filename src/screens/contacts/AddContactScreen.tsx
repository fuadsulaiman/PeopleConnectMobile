import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Image, Alert } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useContactsStore } from "../../stores";
import { colors } from "../../constants/colors";
import { AddContactScreenProps } from "../../navigation/types";
import { User } from "../../types";
import { debounce } from "../../utils/debounce";

const AddContactScreen: React.FC<AddContactScreenProps> = ({ navigation }) => {
  const { searchResults, searchUsers, sendRequest, isLoading, clearSearch } = useContactsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const debouncedSearch = useCallback(debounce((query: string) => {
    if (query.trim().length >= 2) searchUsers(query);
    else clearSearch();
  }, 300), [searchUsers, clearSearch]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    const success = await sendRequest(userId);
    if (success) {
      Alert.alert("Success", "Contact request sent", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } else {
      Alert.alert("Error", "Failed to send request");
    }
    setSendingTo(null);
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} /> :
        <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userUsername}>@{item.username}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => handleSendRequest(item.id)} disabled={sendingTo === item.id}>
        {sendingTo === item.id ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="person-add" size={20} color={colors.white} />}
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {searchQuery.length >= 2 ? (
        <>
          <Icon name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </>
      ) : (
        <>
          <Icon name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Search for users</Text>
          <Text style={styles.emptySubtext}>Enter at least 2 characters to search</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search by name or username..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={handleSearch} autoFocus />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(""); clearSearch(); }}><Icon name="close-circle" size={20} color={colors.textSecondary} /></TouchableOpacity>
        )}
      </View>
      {isLoading && searchResults.length === 0 ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> :
        <FlatList data={searchResults} renderItem={renderUser} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmpty} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, margin: 16, paddingHorizontal: 12, borderRadius: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16, color: colors.text },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 20, flexGrow: 1 },
  userItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: "600", color: colors.text },
  userUsername: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: "center" },
});

export default AddContactScreen;
