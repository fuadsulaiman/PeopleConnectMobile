import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { broadcasts } from '../../services/sdk';
import { useTheme } from '../../hooks';
import { Avatar } from '../../components/common/Avatar';
import { EmptyState } from '../../components/common/EmptyState';
import { config } from '../../constants';

interface BroadcastChannel {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  subscriberCount: number;
  isSubscribed: boolean;
  isPlatformChannel?: boolean;
  lastMessageAt?: string;
}

interface BroadcastMessage {
  id: string;
  channelId: string;
  channelName?: string;
  title?: string;
  content: string;
  createdAt: string;
  imageUrl?: string;
}

const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  return baseUrl + (url.startsWith('/') ? '' : '/') + url;
};

const BroadcastsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'channels'>('feed');
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [channelMessages, setChannelMessages] = useState<Record<string, BroadcastMessage[]>>({});

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchData = useCallback(async () => {
    try {
      const [channelsData, feedData] = await Promise.all([
        broadcasts.getChannels(),
        broadcasts.getFeed(),  // Fixed: was getMessageFeed
      ]);
      setChannels(Array.isArray(channelsData) ? channelsData : (channelsData as any).items || []);
      const feedItems = (feedData as any)?.items || [];
      setMessages(Array.isArray(feedItems) ? feedItems : []);
    } catch (error) {
      console.error('Failed to fetch broadcasts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleSubscribe = async (channelId: string, isSubscribed: boolean) => {
    try {
      if (isSubscribed) {
        await broadcasts.unsubscribe(channelId);
      } else {
        await broadcasts.subscribe(channelId);
      }
      setChannels(prev =>
        prev.map(c =>
          c.id === channelId
            ? { ...c, isSubscribed: !isSubscribed, subscriberCount: c.subscriberCount + (isSubscribed ? -1 : 1) }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to update subscription:', error);
    }
  };

  const handleExpandChannel = async (channelId: string) => {
    if (expandedChannel === channelId) {
      setExpandedChannel(null);
      return;
    }
    setExpandedChannel(channelId);
    if (!channelMessages[channelId]) {
      try {
        const msgsResponse = await broadcasts.getMessages(channelId);  // Fixed: was getChannelMessages
        const msgs = (msgsResponse as any)?.items || [];
        setChannelMessages(prev => ({
          ...prev,
          [channelId]: Array.isArray(msgs) ? msgs : [],
        }));
      } catch (error) {
        console.error('Failed to fetch channel messages:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return date.toLocaleDateString();
  };

  const renderFeedItem = ({ item }: { item: BroadcastMessage }) => (
    <View style={styles.feedItem}>
      <View style={styles.feedHeader}>
        <Text style={styles.feedChannel}>{item.channelName || 'Channel'}</Text>
        <Text style={styles.feedTime}>{formatDate(item.createdAt)}</Text>
      </View>
      {item.title && <Text style={styles.feedTitle}>{item.title}</Text>}
      <Text style={styles.feedContent} numberOfLines={4}>{item.content}</Text>
      {item.imageUrl && (
        <Image source={{ uri: toAbsoluteUrl(item.imageUrl) }} style={styles.feedImage} />
      )}
    </View>
  );

  const renderChannelItem = ({ item }: { item: BroadcastChannel }) => (
    <View style={styles.channelItem}>
      <TouchableOpacity style={styles.channelHeader} onPress={() => handleExpandChannel(item.id)}>
        <Avatar
          uri={toAbsoluteUrl(item.imageUrl)}
          name={item.name}
          size={48}
        />
        <View style={styles.channelInfo}>
          <View style={styles.channelNameRow}>
            <Text style={styles.channelName}>{item.name}</Text>
            {item.isPlatformChannel && (
              <Icon name="checkmark-circle" size={16} color={colors.primary} style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.channelSubscribers}>
            {item.subscriberCount.toLocaleString()} subscribers
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.subscribeButton, item.isSubscribed && styles.subscribedButton]}
          onPress={() => handleSubscribe(item.id, item.isSubscribed)}
        >
          <Text style={[styles.subscribeText, item.isSubscribed && styles.subscribedText]}>
            {item.isSubscribed ? 'Subscribed' : 'Subscribe'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
      {item.description && (
        <Text style={styles.channelDescription} numberOfLines={2}>{item.description}</Text>
      )}
      {expandedChannel === item.id && (
        <View style={styles.channelMessages}>
          {channelMessages[item.id]?.length > 0 ? (
            channelMessages[item.id].slice(0, 3).map(msg => (
              <View key={msg.id} style={styles.channelMessage}>
                <Text style={styles.channelMessageContent} numberOfLines={2}>{msg.content}</Text>
                <Text style={styles.channelMessageTime}>{formatDate(msg.createdAt)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noMessages}>No messages yet</Text>
          )}
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Broadcasts</Text>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'channels' && styles.activeTab]}
          onPress={() => setActiveTab('channels')}
        >
          <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>Channels</Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'feed' ? (
        <FlatList
          data={messages}
          renderItem={renderFeedItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No broadcasts yet"
              message="Subscribe to channels to see their broadcasts here"
            />
          }
        />
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannelItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No channels available"
              message="There are no broadcast channels to subscribe to"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: { fontSize: 16, color: colors.textSecondary },
    activeTabText: { color: colors.primary, fontWeight: '600' },
    listContent: { paddingVertical: 8 },
    feedItem: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      borderRadius: 12,
    },
    feedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    feedChannel: { fontSize: 14, fontWeight: '600', color: colors.primary },
    feedTime: { fontSize: 12, color: colors.textSecondary },
    feedTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    feedContent: { fontSize: 14, color: colors.text, lineHeight: 20 },
    feedImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 12 },
    channelItem: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      borderRadius: 12,
    },
    channelHeader: { flexDirection: 'row', alignItems: 'center' },
    channelInfo: { flex: 1, marginLeft: 12 },
    channelNameRow: { flexDirection: 'row', alignItems: 'center' },
    channelName: { fontSize: 16, fontWeight: '600', color: colors.text },
    verifiedIcon: { marginLeft: 4 },
    channelSubscribers: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    channelDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
    subscribeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    subscribedButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    subscribeText: { fontSize: 14, fontWeight: '600', color: colors.white },
    subscribedText: { color: colors.text },
    channelMessages: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    channelMessage: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    channelMessageContent: { fontSize: 14, color: colors.text },
    channelMessageTime: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    noMessages: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  });

export default BroadcastsScreen;
