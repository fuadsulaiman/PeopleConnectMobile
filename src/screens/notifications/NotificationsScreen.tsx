import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
import { notifications as notificationsApi } from '../../services/sdk';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface Notification {
  id: string;
  type: 'message' | 'call' | 'contact_request' | 'group_invite' | 'mention' | 'reaction' | 'system';
  title: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  isRead: boolean;
  data?: Record<string, string>;
}

type FilterType = 'all' | 'unread' | 'messages' | 'calls' | 'contacts';

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const mapNotificationType = useCallback((type: string): Notification['type'] => {
    const typeMap: Record<string, Notification['type']> = {
      NewMessage: 'message',
      MessageReaction: 'reaction',
      ContactRequest: 'contact_request',
      ContactAccepted: 'contact_request',
      AddedToConversation: 'group_invite',
      RemovedFromConversation: 'system',
      MentionedInMessage: 'mention',
      MissedCall: 'call',
      SystemAnnouncement: 'system',
      Message: 'message',
      Call: 'call',
      GroupInvite: 'group_invite',
      Mention: 'mention',
      Reaction: 'reaction',
    };
    return typeMap[type] || 'system';
  }, []);

  const fetchNotifications = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await notificationsApi.list({ page: pageNum, pageSize: 20 });
        const items = response.items || [];

        const mappedNotifications: Notification[] = items.map((n: any) => ({
          id: n.id,
          type: mapNotificationType(n.type),
          title: n.title,
          body: n.body || '',
          createdAt: n.createdAt,
          isRead: n.isRead,
          data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : undefined,
        }));

        if (append) {
          setNotifications((prev) => [...prev, ...mappedNotifications]);
        } else {
          setNotifications(mappedNotifications);
        }

        setHasMore(items.length === 20);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setRefreshing(false);
      }
    },
    [mapNotificationType]
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchNotifications(1);
  }, [fetchNotifications]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  }, [isLoadingMore, hasMore, page, fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read.');
    }
  }, []);

  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      Alert.alert('Error', 'Failed to delete notification.');
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(notifications.map((n) => notificationsApi.delete(n.id)));
              setNotifications([]);
            } catch (error) {
              console.error('Failed to clear notifications:', error);
              Alert.alert('Error', 'Failed to clear all notifications.');
            }
          },
        },
      ]
    );
  }, [notifications]);

  const getIcon = (type: Notification['type']): string => {
    switch (type) {
      case 'message':
        return 'chatbubble';
      case 'call':
        return 'call';
      case 'contact_request':
        return 'person-add';
      case 'group_invite':
        return 'people';
      case 'mention':
        return 'at';
      case 'reaction':
        return 'heart';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: Notification['type']): { bg: string; icon: string } => {
    switch (type) {
      case 'message':
        return { bg: '#E3F2FD', icon: '#2196F3' };
      case 'call':
        return { bg: '#E8F5E9', icon: '#4CAF50' };
      case 'contact_request':
        return { bg: '#F3E5F5', icon: '#9C27B0' };
      case 'group_invite':
        return { bg: '#FFF3E0', icon: '#FF9800' };
      case 'mention':
        return { bg: '#E0F7FA', icon: '#00BCD4' };
      case 'reaction':
        return { bg: '#FCE4EC', icon: '#E91E63' };
      default:
        return { bg: colors.surface, icon: colors.textSecondary };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      switch (filter) {
        case 'unread':
          return !n.isRead;
        case 'messages':
          return n.type === 'message' || n.type === 'mention';
        case 'calls':
          return n.type === 'call';
        case 'contacts':
          return n.type === 'contact_request' || n.type === 'group_invite';
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'messages', label: 'Messages' },
    { key: 'calls', label: 'Calls' },
    { key: 'contacts', label: 'Contacts' },
  ];

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconColors = getIconColor(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handleMarkAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColors.bg }]}>
          <Icon name={getIcon(item.type)} size={22} color={iconColors.icon} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteNotification(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="trash-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Icon name="filter-outline" size={18} color={colors.textSecondary} />
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="notifications-outline" size={64} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>No notifications</Text>
      <Text style={styles.emptyText}>
        {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore || filteredNotifications.length === 0) return null;

    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore} disabled={isLoadingMore}>
        {isLoadingMore ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.loadMoreText}>Load more</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCountText}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.headerButton} onPress={handleMarkAllAsRead}>
              <Icon name="checkmark-done" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.headerButton} onPress={handleClearAll}>
              <Icon name="trash-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filteredNotifications.length === 0 ? styles.emptyListContent : undefined}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerCenter: {
      flex: 1,
      marginLeft: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    unreadCountText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerButton: {
      padding: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterTabText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    filterTabTextActive: {
      color: colors.white,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    unreadItem: {
      backgroundColor: colors.surface,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
      marginLeft: 12,
      marginRight: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    body: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 20,
    },
    time: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
    deleteButton: {
      padding: 4,
    },
    emptyListContent: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    loadMoreButton: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    loadMoreText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
    },
  });

export default NotificationsScreen;
