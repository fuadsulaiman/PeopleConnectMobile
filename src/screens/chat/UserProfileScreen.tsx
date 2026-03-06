import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { UserProfileScreenProps } from '../../navigation/types';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getSDK = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.sdk;
};
const sdk = { get contacts() { return getSDK().contacts; }, get conversations() { return getSDK().conversations; } };
import { usePresenceStore } from '../../stores/presenceStore';

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
        console.error('Failed to fetch blocked status:', blockError);
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
      console.error('Failed to fetch user profile:', error);
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
      navigation.replace('Chat', {
        conversationId: conversation.id,
        conversation: conversation as any,
      });
    } catch (error) {
      console.error('Failed to start chat:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleVoiceCall = () => {
    if (user) {
      navigation.getParent()?.navigate('ActiveCall', {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        type: 'voice',
      });
    }
  };

  const handleVideoCall = () => {
    if (user) {
      navigation.getParent()?.navigate('ActiveCall', {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        type: 'video',
      });
    }
  };

  const handleBlock = () => {
    Alert.alert(
      user?.isBlocked ? 'Unblock User' : 'Block User',
      user?.isBlocked
        ? `Are you sure you want to unblock ${user?.name || user?.username}?`
        : `Are you sure you want to block ${user?.name || user?.username}? They won't be able to contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user?.isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlocking(true);
            try {
              if (user?.isBlocked) {
                await sdk.contacts.unblock(userId);
                setUser((prev) => (prev ? { ...prev, isBlocked: false } : null));
              } else {
                await sdk.contacts.block(userId);
                setUser((prev) => (prev ? { ...prev, isBlocked: true } : null));
              }
            } catch (error) {
              console.error('Failed to block/unblock user:', error);
              Alert.alert('Error', 'Failed to update block status');
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
      setUser((prev) => (prev ? { ...prev, isContact: true } : null));
      Alert.alert('Success', 'Contact request sent');
    } catch (error) {
      console.error('Failed to send contact request:', error);
      Alert.alert('Error', 'Failed to send contact request');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
          {user.statusMessage && <Text style={styles.statusMessage}>{user.statusMessage}</Text>}
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
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
            <View style={[styles.actionIcon, { backgroundColor: colors.info || '#5BC0DE' }]}>
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

          <TouchableOpacity style={styles.menuItem} onPress={handleBlock} disabled={isBlocking}>
            <View style={[styles.menuIconContainer, { backgroundColor: colors.error + '20' }]}>
              {isBlocking ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Icon
                  name={user.isBlocked ? 'lock-open-outline' : 'ban-outline'}
                  size={22}
                  color={colors.error}
                />
              )}
            </View>
            <Text style={[styles.menuLabel, { color: colors.error }]}>
              {user.isBlocked ? 'Unblock User' : 'Block User'}
            </Text>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    actionButton: {
      alignItems: 'center',
    },
    actionIcon: {
      alignItems: 'center',
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      marginBottom: 8,
      width: 56,
    },
    actionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    actionsContainer: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 32,
      justifyContent: 'center',
      paddingVertical: 24,
    },
    avatar: {
      borderRadius: 50,
      height: 100,
      width: 100,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      justifyContent: 'center',
    },
    backButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerRight: {
      width: 40,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    menuContainer: {
      marginTop: 16,
    },
    menuIconContainer: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginRight: 12,
      width: 40,
    },
    menuItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      padding: 16,
    },
    menuLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
    },
    name: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 16,
    },
    offline: {
      backgroundColor: colors.textTertiary,
    },
    online: {
      backgroundColor: colors.success,
    },
    onlineIndicator: {
      backgroundColor: colors.success,
      borderColor: colors.background,
      borderRadius: 10,
      borderWidth: 3,
      bottom: 4,
      height: 20,
      position: 'absolute',
      right: 4,
      width: 20,
    },
    profileHeader: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingVertical: 32,
    },
    statusBadge: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    statusDot: {
      borderRadius: 4,
      height: 8,
      marginRight: 6,
      width: 8,
    },
    statusMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: 'italic',
      marginTop: 8,
      paddingHorizontal: 32,
      textAlign: 'center',
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    username: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 4,
    },
  });

export default UserProfileScreen;
