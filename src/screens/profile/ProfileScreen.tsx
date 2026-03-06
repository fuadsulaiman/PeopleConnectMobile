import React, { useMemo, useState } from 'react';
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
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks';
import {
  ProfileScreenProps,
  RootStackParamList,
  ProfileStackParamList,
} from '../../navigation/types';

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const rootNavigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();
  const { colors } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  const menuItems = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      onPress: () => navigation.navigate('EditProfile'),
    },
    { icon: 'settings-outline', label: 'Settings', onPress: () => navigation.navigate('Settings') },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      onPress: () => rootNavigation.navigate('Notifications'),
    },
    { icon: 'shield-outline', label: 'Privacy', onPress: () => {} },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => {} },
    { icon: 'information-circle-outline', label: 'About', onPress: () => {} },
  ];

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to log out. Please try again.');
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="person" size={48} color={colors.white} />
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Icon name="camera" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.username}>@{user?.username || 'username'}</Text>
        {user?.statusMessage && <Text style={styles.statusMessage}>{user.statusMessage}</Text>}
      </View>
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <View style={styles.menuIconContainer}>
              <Icon name={item.icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <Icon name="log-out-outline" size={22} color={colors.error} />
        )}
        <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Log Out'}</Text>
      </TouchableOpacity>
      <Text style={styles.version}>PeopleConnect v1.0.0</Text>
    </ScrollView>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    avatar: { borderRadius: 50, height: 100, width: 100 },
    avatarContainer: { position: 'relative' },
    avatarPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      justifyContent: 'center',
    },
    container: { backgroundColor: colors.background, flex: 1 },
    editAvatarButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.background,
      borderRadius: 16,
      borderWidth: 2,
      bottom: 0,
      height: 32,
      justifyContent: 'center',
      position: 'absolute',
      right: 0,
      width: 32,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingVertical: 32,
    },
    logoutButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginTop: 24,
      padding: 16,
    },
    logoutText: { color: colors.error, fontSize: 16, fontWeight: '600', marginLeft: 8 },
    menuContainer: { marginTop: 24 },
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
    menuLabel: { color: colors.text, flex: 1, fontSize: 16 },
    name: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginTop: 16 },
    statusMessage: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic', marginTop: 8 },
    username: { color: colors.textSecondary, fontSize: 16, marginTop: 4 },
    version: { color: colors.textSecondary, fontSize: 12, marginVertical: 24, textAlign: 'center' },
  });

export default ProfileScreen;
