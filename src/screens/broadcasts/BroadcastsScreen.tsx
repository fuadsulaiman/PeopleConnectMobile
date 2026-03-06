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
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getBroadcasts = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.broadcasts;
};
const broadcasts = { getChannels: () => getBroadcasts().getChannels(), getFeed: () => getBroadcasts().getFeed(), subscribe: (id: string) => getBroadcasts().subscribe(id), unsubscribe: (id: string) => getBroadcasts().unsubscribe(id), getMessages: (id: string) => getBroadcasts().getMessages(id) };
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
  if (!url) {
    return undefined;
  }
  if (url.startsWith('http')) {
    return url;
  }
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
        broadcasts.getFeed(), // Fixed: was getMessageFeed
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
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? {
                ...c,
                isSubscribed: !isSubscribed,
                subscriberCount: c.subscriberCount + (isSubscribed ? -1 : 1),
              }
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
        const msgsResponse = await broadcasts.getMessages(channelId); // Fixed: was getChannelMessages
        const msgs = (msgsResponse as any)?.items || [];
        setChannelMessages((prev) => ({
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

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return diffMins + 'm ago';
    }
    if (diffHours < 24) {
      return diffHours + 'h ago';
    }
    if (diffDays < 7) {
      return diffDays + 'd ago';
    }
    return date.toLocaleDateString();
  };

  const renderFeedItem = ({ item }: { item: BroadcastMessage }) => (
    <View style={styles.feedItem}>
      <View style={styles.feedHeader}>
        <Text style={styles.feedChannel}>{item.channelName || 'Channel'}</Text>
        <Text style={styles.feedTime}>{formatDate(item.createdAt)}</Text>
      </View>
      {item.title && <Text style={styles.feedTitle}>{item.title}</Text>}
      <Text style={styles.feedContent} numberOfLines={4}>
        {item.content}
      </Text>
      {item.imageUrl && (
        <Image source={{ uri: toAbsoluteUrl(item.imageUrl) }} style={styles.feedImage} />
      )}
    </View>
  );

  const renderChannelItem = ({ item }: { item: BroadcastChannel }) => (
    <View style={styles.channelItem}>
      <TouchableOpacity style={styles.channelHeader} onPress={() => handleExpandChannel(item.id)}>
        <Avatar uri={toAbsoluteUrl(item.imageUrl)} name={item.name} size={48} />
        <View style={styles.channelInfo}>
          <View style={styles.channelNameRow}>
            <Text style={styles.channelName}>{item.name}</Text>
            {item.isPlatformChannel && (
              <Icon
                name="checkmark-circle"
                size={16}
                color={colors.primary}
                style={styles.verifiedIcon}
              />
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
        <Text style={styles.channelDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      {expandedChannel === item.id && (
        <View style={styles.channelMessages}>
          {channelMessages[item.id]?.length > 0 ? (
            channelMessages[item.id].slice(0, 3).map((msg) => (
              <View key={msg.id} style={styles.channelMessage}>
                <Text style={styles.channelMessageContent} numberOfLines={2}>
                  {msg.content}
                </Text>
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
          <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>
            Channels
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'feed' ? (
        <FlatList
          data={messages}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
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
    activeTab: {
      borderBottomColor: colors.primary,
      borderBottomWidth: 2,
    },
    activeTabText: { color: colors.primary, fontWeight: '600' },
    channelDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
    channelHeader: { alignItems: 'center', flexDirection: 'row' },
    channelInfo: { flex: 1, marginLeft: 12 },
    channelItem: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
    },
    channelMessage: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingVertical: 8,
    },
    channelMessageContent: { color: colors.text, fontSize: 14 },
    channelMessageTime: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    channelMessages: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: 12,
      paddingTop: 12,
    },
    channelName: { color: colors.text, fontSize: 16, fontWeight: '600' },
    channelNameRow: { alignItems: 'center', flexDirection: 'row' },
    channelSubscribers: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    container: { backgroundColor: colors.background, flex: 1 },
    feedChannel: { color: colors.primary, fontSize: 14, fontWeight: '600' },
    feedContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
    feedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    feedImage: { borderRadius: 8, height: 180, marginTop: 12, width: '100%' },
    feedItem: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
    },
    feedTime: { color: colors.textSecondary, fontSize: 12 },
    feedTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { color: colors.text, fontSize: 28, fontWeight: 'bold' },
    listContent: { paddingVertical: 8 },
    loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    noMessages: {
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: 'italic',
      paddingVertical: 16,
      textAlign: 'center',
    },
    subscribeButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    subscribeText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    subscribedButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    subscribedText: { color: colors.text },
    tab: {
      alignItems: 'center',
      flex: 1,
      paddingVertical: 12,
    },
    tabText: { color: colors.textSecondary, fontSize: 16 },
    tabs: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
    },
    verifiedIcon: { marginLeft: 4 },
  });

export default BroadcastsScreen;
