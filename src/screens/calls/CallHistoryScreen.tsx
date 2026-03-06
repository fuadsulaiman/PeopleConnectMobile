import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCallStore } from '../../stores/callStore';
import { colors } from '../../constants/colors';
import { CallHistoryScreenProps } from '../../navigation/types';
import { Call } from '../../types';

const CallHistoryScreen: React.FC<CallHistoryScreenProps> = ({ navigation }) => {
  const { callHistory, fetchCallHistory, isLoading } = useCallStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCallHistory();
    setRefreshing(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) {
      return '';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? mins + ':' + secs.toString().padStart(2, '0') + ' min' : secs + ' sec';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getCallStatusIcon = (call: Call) => {
    if (call.status === 'missed') {
      return { name: 'call', color: colors.error };
    }
    if (call.direction === 'incoming') {
      return { name: 'call', color: colors.success };
    }
    return { name: 'call', color: colors.primary };
  };

  const renderCall = ({ item }: { item: Call }) => {
    const user = item.participants?.find((p) => p.userId !== item.id)?.user;
    const statusIcon = getCallStatusIcon(item);
    return (
      <TouchableOpacity
        style={styles.callItem}
        onPress={() => navigation.getParent()?.navigate('ActiveCall', { call: item })}
      >
        <View style={styles.avatarContainer}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="person" size={24} color={colors.white} />
            </View>
          )}
        </View>
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{item.conversationName || user?.name || 'Unknown'}</Text>
          <View style={styles.callMeta}>
            <Icon
              name={item.direction === 'incoming' ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={statusIcon.color}
            />
            <Icon
              name={item.type === 'video' ? 'videocam' : 'call'}
              size={14}
              color={colors.textSecondary}
              style={styles.callTypeIcon}
            />
            <Text style={styles.callStatus}>
              {item.status === 'missed' ? 'Missed' : formatDuration(item.duration)}
            </Text>
          </View>
        </View>
        <View style={styles.callRight}>
          <Text style={styles.callTime}>{formatTime(item.startedAt)}</Text>
          <TouchableOpacity
            style={styles.callbackButton}
            onPress={() =>
              navigation.getParent()?.navigate('ActiveCall', { user, type: item.type })
            }
          >
            <Icon
              name={item.type === 'video' ? 'videocam' : 'call'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="call-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyText}>No call history</Text>
      <Text style={styles.emptySubtext}>Your recent calls will appear here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && callHistory.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={callHistory as any}
          renderItem={renderCall}
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
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarContainer: { position: 'relative' },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  callInfo: { flex: 1, marginLeft: 12 },
  callItem: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  callMeta: { alignItems: 'center', flexDirection: 'row', marginTop: 4 },
  callName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  callRight: { alignItems: 'flex-end' },
  callStatus: { color: colors.textSecondary, fontSize: 13, marginLeft: 4 },
  callTime: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  callTypeIcon: { marginLeft: 4 },
  callbackButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  emptyContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  emptySubtext: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  listContent: { flexGrow: 1 },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});

export default CallHistoryScreen;
