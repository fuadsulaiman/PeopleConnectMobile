import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../hooks";
import { UserProfileScreenProps } from "../../navigation/types";
import { sdk } from "../../services/sdk";
import { usePresenceStore } from "../../stores";

interface UserProfile {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string;
  statusMessage?: string;
  email?: string;
  phone?: string;
  isBlocked?: boolean;
  isContact?: boolean;
}

const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ navigation, route }) => {
  const { userId, userName, userAvatar, username } = route.params;
  const { colors } = useTheme();
  const { onlineUsers } = usePresenceStore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOnline = onlineUsers[userId] || false;

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    setIsLoading(true);
    try {
      // Check if this user is blocked
      let isBlocked = false;
      try {
        const blockedContacts = await sdk.contacts.getBlocked();
        isBlocked = blockedContacts.some((bc) => bc.userId === userId);
      } catch (blockError) {
        console.error("Failed to fetch blocked status:", blockError);
      }

      // First, use data passed from navigation if available
      if (userName || username) {
        setUser({
          id: userId,
          username: username || userName?.toLowerCase().replace(/\s+/g, '') || 'unknown',
          name: userName,
          avatarUrl: userAvatar,
          isBlocked,
        });
        setIsLoading(false);
        return;
      }

      // Fall back to search API to find the user
      const results = await sdk.contacts.searchUsers(userId);
      if (results && results.length > 0) {
        const foundUser = results[0];
        setUser({
          id: foundUser.id,
          username: foundUser.username,
          name: foundUser.name,
          avatarUrl: foundUser.avatarUrl,
          isBlocked,
        });
      } else {
        // If search doesn't work, create minimal profile
        setUser({
          id: userId,
          username: 'unknown',
          name: 'Unknown User',
          isBlocked,
        });
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      // Create minimal profile on error
      setUser({
        id: userId,
        username: username || 'unknown',
        name: userName || 'Unknown User',
        avatarUrl: userAvatar,
        isBlocked: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = async () => {
    try {
      // Try to create or get existing DM conversation
      const conversation = await sdk.conversations.createDM({ userId });
      navigation.replace("Chat", {
        conversationId: conversation.id,
        conversation: conversation as any,
      });
    } catch (error) {
      console.error("Failed to start chat:", error);
      Alert.alert("Error", "Failed to start conversation");
    }
  };

  const handleVoiceCall = () => {
    if (user) {
      navigation.getParent()?.navigate("ActiveCall", {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        type: "voice",
      });
    }
  };

  const handleVideoCall = () => {
    if (user) {
      navigation.getParent()?.navigate("ActiveCall", {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        type: "video",
      });
    }
  };

  const handleBlock = () => {
    Alert.alert(
      user?.isBlocked ? "Unblock User" : "Block User",
      user?.isBlocked
        ? `Are you sure you want to unblock ${user?.name || user?.username}?`
        : `Are you sure you want to block ${user?.name || user?.username}? They won't be able to contact you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: user?.isBlocked ? "Unblock" : "Block",
          style: "destructive",
          onPress: async () => {
            setIsBlocking(true);
            try {
              if (user?.isBlocked) {
                await sdk.contacts.unblock(userId);
                setUser((prev) => prev ? { ...prev, isBlocked: false } : null);
              } else {
                await sdk.contacts.block(userId);
                setUser((prev) => prev ? { ...prev, isBlocked: true } : null);
              }
            } catch (error) {
              console.error("Failed to block/unblock user:", error);
              Alert.alert("Error", "Failed to update block status");
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ]
    );
  };

  const handleAddContact = async () => {
    try {
      await sdk.contacts.sendRequest(userId);
      setUser((prev) => prev ? { ...prev, isContact: true } : null);
      Alert.alert("Success", "Contact request sent");
    } catch (error) {
      console.error("Failed to send contact request:", error);
      Alert.alert("Error", "Failed to send contact request");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={48} color={colors.white} />
              </View>
            )}
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <Text style={styles.name}>{user.name || user.username}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.statusMessage && (
            <Text style={styles.statusMessage}>{user.statusMessage}</Text>
          )}
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
            <Text style={styles.statusText}>{isOnline ? "Online" : "Offline"}</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleStartChat}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
              <Icon name="chatbubble" size={22} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleVoiceCall}>
            <View style={[styles.actionIcon, { backgroundColor: colors.success }]}>
              <Icon name="call" size={22} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Voice</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleVideoCall}>
            <View style={[styles.actionIcon, { backgroundColor: colors.info || "#5BC0DE" }]}>
              <Icon name="videocam" size={22} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          {!user.isContact && (
            <TouchableOpacity style={styles.menuItem} onPress={handleAddContact}>
              <View style={styles.menuIconContainer}>
                <Icon name="person-add-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>Add to Contacts</Text>
              <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleBlock}
            disabled={isBlocking}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: colors.error + "20" }]}>
              {isBlocking ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Icon
                  name={user.isBlocked ? "lock-open-outline" : "ban-outline"}
                  size={22}
                  color={colors.error}
                />
              )}
            </View>
            <Text style={[styles.menuLabel, { color: colors.error }]}>
              {user.isBlocked ? "Unblock User" : "Block User"}
            </Text>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import("../../hooks").useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    headerRight: {
      width: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    profileHeader: {
      alignItems: "center",
      paddingVertical: 32,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatarContainer: {
      position: "relative",
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      borderWidth: 3,
      borderColor: colors.background,
    },
    name: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.text,
      marginTop: 16,
    },
    username: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statusMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: "italic",
      textAlign: "center",
      paddingHorizontal: 32,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    online: {
      backgroundColor: colors.success,
    },
    offline: {
      backgroundColor: colors.textTertiary,
    },
    statusText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    actionsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      paddingVertical: 24,
      gap: 32,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actionButton: {
      alignItems: "center",
    },
    actionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    menuContainer: {
      marginTop: 16,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    menuLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
  });

export default UserProfileScreen;
