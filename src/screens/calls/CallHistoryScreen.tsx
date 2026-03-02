import React, { useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, RefreshControl } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useCallStore } from "../../stores";
import { colors } from "../../constants/colors";
import { CallHistoryScreenProps } from "../../navigation/types";
import { Call } from "../../types";

const CallHistoryScreen: React.FC<CallHistoryScreenProps> = ({ navigation }) => {
  const { callHistory, fetchCallHistory, isLoading } = useCallStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { fetchCallHistory(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCallHistory();
    setRefreshing(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? mins + ":" + secs.toString().padStart(2, "0") + " min" : secs + " sec";
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getCallStatusIcon = (call: Call) => {
    if (call.status === "missed") return { name: "call", color: colors.error };
    if (call.direction === "incoming") return { name: "call", color: colors.success };
    return { name: "call", color: colors.primary };
  };

  const renderCall = ({ item }: { item: Call }) => {
    const user = item.participants?.find(p => p.userId !== item.id)?.user;
    const statusIcon = getCallStatusIcon(item);
    return (
      <TouchableOpacity style={styles.callItem} onPress={() => navigation.getParent()?.navigate("ActiveCall", { call: item })}>
        <View style={styles.avatarContainer}>
          {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> :
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={24} color={colors.white} /></View>}
        </View>
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{item.conversationName || user?.name || "Unknown"}</Text>
          <View style={styles.callMeta}>
            <Icon name={item.direction === "incoming" ? "arrow-down" : "arrow-up"} size={14} color={statusIcon.color} />
            <Icon name={item.type === "video" ? "videocam" : "call"} size={14} color={colors.textSecondary} style={styles.callTypeIcon} />
            <Text style={styles.callStatus}>{item.status === "missed" ? "Missed" : formatDuration(item.duration)}</Text>
          </View>
        </View>
        <View style={styles.callRight}>
          <Text style={styles.callTime}>{formatTime(item.startedAt)}</Text>
          <TouchableOpacity style={styles.callbackButton} onPress={() => navigation.getParent()?.navigate("ActiveCall", { user, type: item.type })}>
            <Icon name={item.type === "video" ? "videocam" : "call"} size={20} color={colors.primary} />
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
      {isLoading && callHistory.length === 0 ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> :
        <FlatList data={callHistory as any} renderItem={renderCall} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmpty} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { flexGrow: 1 },
  callItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarContainer: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  callInfo: { flex: 1, marginLeft: 12 },
  callName: { fontSize: 16, fontWeight: "600", color: colors.text },
  callMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  callTypeIcon: { marginLeft: 4 },
  callStatus: { fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
  callRight: { alignItems: "flex-end" },
  callTime: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  callbackButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
});

export default CallHistoryScreen;
