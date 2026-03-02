import React, { useEffect, useState, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Image, RefreshControl } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useContactsStore } from "../../stores";
import { useTheme } from "../../hooks";
import { ContactsScreenProps } from "../../navigation/types";
import { Contact, ContactRequest } from "../../types";

const ContactsScreen: React.FC<ContactsScreenProps> = ({ navigation }) => {
  const { contacts, requests, fetchContacts, fetchRequests, acceptRequest, rejectRequest, isLoading } = useContactsStore();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<"all" | "requests">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => { fetchContacts(); fetchRequests(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchContacts(), fetchRequests()]);
    setRefreshing(false);
  };

  const filteredContacts = contacts.filter(c =>
    c.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.contactItem}>
      {item.user.avatarUrl ? <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} /> :
        <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.user.name}</Text>
        <Text style={styles.contactUsername}>@{item.user.username}</Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: item.user.status === "online" ? colors.online : colors.offline }]} />
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: ContactRequest }) => (
    <View style={styles.requestItem}>
      {item.fromUser.avatarUrl ? <Image source={{ uri: item.fromUser.avatarUrl }} style={styles.avatar} /> :
        <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.fromUser.name}</Text>
        <Text style={styles.contactUsername}>@{item.fromUser.username}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRequest(item.id)}><Icon name="checkmark" size={20} color={colors.white} /></TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} onPress={() => rejectRequest(item.id)}><Icon name="close" size={20} color={colors.white} /></TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name={activeTab === "all" ? "people-outline" : "mail-outline"} size={64} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{activeTab === "all" ? "No contacts yet" : "No pending requests"}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search contacts..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === "all" && styles.tabActive]} onPress={() => setActiveTab("all")}>
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>All ({contacts.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "requests" && styles.tabActive]} onPress={() => setActiveTab("requests")}>
          <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>Requests ({requests.received.length})</Text>
        </TouchableOpacity>
      </View>
      {isLoading && contacts.length === 0 ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> :
        activeTab === "all" ?
          <FlatList data={filteredContacts} renderItem={renderContact} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmpty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />} /> :
          <FlatList data={requests.received} renderItem={renderRequest} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmpty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />} />}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("AddContact")}><Icon name="person-add" size={24} color={colors.white} /></TouchableOpacity>
    </View>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, margin: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 16, color: colors.text },
  tabContainer: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingBottom: 80 },
  contactItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  requestItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactName: { fontSize: 16, fontWeight: "600", color: colors.text },
  contactUsername: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  requestActions: { flexDirection: "row" },
  acceptButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success, justifyContent: "center", alignItems: "center", marginRight: 8 },
  rejectButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text, marginTop: 16 },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 4 },
});

export default ContactsScreen;
