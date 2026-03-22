import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useContactsStore } from '../../stores/contactsStore';
import { useTheme } from '../../hooks';
import { ContactsScreenProps } from '../../navigation/types';
import { Contact, ContactRequest } from '../../types';
import { useAppTranslation } from '../../i18n/useTranslation';

const ContactsScreen: React.FC<ContactsScreenProps> = ({ navigation }) => {
  const {
    contacts,
    requests,
    fetchContacts,
    fetchRequests,
    acceptRequest,
    rejectRequest,
    isLoading,
  } = useContactsStore();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'all' | 'requests'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useAppTranslation();

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    fetchContacts();
    fetchRequests();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchContacts(), fetchRequests()]);
    setRefreshing(false);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity style={styles.contactItem}>
      {item.user.avatarUrl ? (
        <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color={colors.white} />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.user.name}</Text>
        <Text style={styles.contactUsername}>@{item.user.username}</Text>
      </View>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: item.user.status === 'online' ? colors.online : colors.offline },
        ]}
      />
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: ContactRequest }) => (
    <View style={styles.requestItem}>
      {item.fromUser.avatarUrl ? (
        <Image source={{ uri: item.fromUser.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="person" size={24} color={colors.white} />
        </View>
      )}
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.fromUser.name}</Text>
        <Text style={styles.contactUsername}>@{item.fromUser.username}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptRequest(item.id)}>
          <Icon name="checkmark" size={20} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} onPress={() => rejectRequest(item.id)}>
          <Icon name="close" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name={activeTab === 'all' ? 'people-outline' : 'mail-outline'}
        size={64}
        color={colors.textSecondary}
      />
      <Text style={styles.emptyText}>
        {activeTab === 'all' ? t('contacts.noContacts') : t('contacts.noPendingRequests')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('contacts.searchContacts')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            {t('contacts.all', { count: contacts.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            {t('contacts.requests', { count: requests.length })}
          </Text>
        </TouchableOpacity>
      </View>
      {isLoading && contacts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'all' ? (
        <FlatList
          data={filteredContacts as any}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      ) : (
        <FlatList
          data={requests as any}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddContact')}>
        <Icon name="person-add" size={24} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    acceptButton: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      marginRight: 8,
      width: 36,
    },
    avatar: { borderRadius: 24, height: 48, width: 48 },
    avatarPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      justifyContent: 'center',
    },
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
    emptyContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
    emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
    fab: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 28,
      bottom: 24,
      elevation: 4,
      height: 56,
      justifyContent: 'center',
      position: 'absolute',
      right: 24,
      width: 56,
    },
    listContent: { paddingBottom: 80 },
    loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    rejectButton: {
      alignItems: 'center',
      backgroundColor: colors.error,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    requestActions: { flexDirection: 'row' },
    requestItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      padding: 16,
    },
    searchContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      flexDirection: 'row',
      margin: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { color: colors.text, flex: 1, fontSize: 16, height: 44 },
    statusDot: { borderRadius: 5, height: 10, width: 10 },
    tab: {
      alignItems: 'center',
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
      flex: 1,
      paddingVertical: 12,
    },
    tabActive: { borderBottomColor: colors.primary },
    tabContainer: { flexDirection: 'row', marginBottom: 8, marginHorizontal: 16 },
    tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: colors.primary },
  });

export default ContactsScreen;
