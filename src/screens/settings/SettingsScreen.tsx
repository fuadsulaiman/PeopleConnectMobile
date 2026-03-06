import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

interface SettingItem {
  icon: string;
  title: string;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  iconColor?: string;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { logout: _logout } = useAuthStore();

  const [darkMode, setDarkMode] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Info', 'Account deletion is not available in this version.');
          },
        },
      ]
    );
  };

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'key-outline',
          title: 'Change Password',
          type: 'navigation',
          iconColor: colors.primary,
          onPress: () => navigation.navigate('ChangePassword'),
        },
        {
          icon: 'shield-checkmark-outline',
          title: 'Two-Factor Authentication',
          type: 'navigation',
          iconColor: colors.success,
          onPress: () => navigation.navigate('TwoFactorSettings'),
        },
        {
          icon: 'phone-portrait-outline',
          title: 'Active Sessions',
          type: 'navigation',
          iconColor: colors.secondary,
          onPress: () => navigation.navigate('Devices'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications-outline',
          title: 'Notification Settings',
          type: 'navigation',
          iconColor: colors.warning,
          onPress: () => navigation.navigate('NotificationSettings'),
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          icon: 'eye-outline',
          title: 'Privacy Settings',
          type: 'navigation',
          iconColor: colors.primary,
          onPress: () => navigation.navigate('PrivacySettings'),
        },
        {
          icon: 'ban-outline',
          title: 'Blocked Users',
          type: 'navigation',
          iconColor: colors.error,
          onPress: () =>
            Alert.alert('Coming Soon', 'Blocked users management will be available soon.'),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: 'moon-outline',
          title: 'Dark Mode',
          type: 'toggle',
          value: darkMode,
          iconColor: colors.textSecondary,
          onToggle: setDarkMode,
        },
      ],
    },
    {
      title: 'Data & Storage',
      items: [
        {
          icon: 'folder-outline',
          title: 'Storage Usage',
          type: 'navigation',
          iconColor: colors.primary,
          onPress: () => Alert.alert('Coming Soon', 'Storage management will be available soon.'),
        },
        {
          icon: 'download-outline',
          title: 'Auto-Download Media',
          type: 'navigation',
          iconColor: colors.success,
          onPress: () =>
            Alert.alert('Coming Soon', 'Auto-download settings will be available soon.'),
        },
        {
          icon: 'trash-outline',
          title: 'Clear Cache',
          type: 'action',
          iconColor: colors.warning,
          onPress: () => {
            Alert.alert('Clear Cache', 'Are you sure you want to clear the app cache?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', onPress: () => Alert.alert('Success', 'Cache has been cleared.') },
            ]);
          },
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          title: 'Help & Support',
          type: 'navigation',
          iconColor: colors.primary,
          onPress: () => Alert.alert('Help', 'For support, please contact support@example.com'),
        },
        {
          icon: 'information-circle-outline',
          title: 'About',
          type: 'navigation',
          iconColor: colors.textSecondary,
          onPress: () => Alert.alert('About', 'PeopleConnect Mobile v1.0.0'),
        },
      ],
    },
    {
      title: 'Danger Zone',
      items: [
        {
          icon: 'cloud-download-outline',
          title: 'Export My Data',
          type: 'action',
          iconColor: colors.primary,
          onPress: () => Alert.alert('Coming Soon', 'Data export will be available soon.'),
        },
        {
          icon: 'close-circle-outline',
          title: 'Delete Account',
          type: 'action',
          iconColor: colors.error,
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => {
    return (
      <TouchableOpacity
        key={item.title}
        style={styles.settingItem}
        onPress={item.onPress}
        disabled={item.type === 'toggle'}
        activeOpacity={item.type === 'toggle' ? 1 : 0.7}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${item.iconColor || colors.primary}15` },
          ]}
        >
          <Icon name={item.icon} size={20} color={item.iconColor || colors.primary} />
        </View>
        <Text
          style={[styles.settingTitle, item.title === 'Delete Account' && { color: colors.error }]}
        >
          {item.title}
        </Text>
        {item.type === 'toggle' && (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        )}
        {item.type === 'navigation' && (
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>{section.items.map(renderSettingItem)}</View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>PeopleConnect</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) =>
  StyleSheet.create({
    backButton: {
      padding: 8,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      flex: 1,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 4,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    iconContainer: {
      alignItems: 'center',
      borderRadius: 8,
      height: 36,
      justifyContent: 'center',
      marginRight: 12,
      width: 36,
    },
    placeholder: {
      width: 40,
    },
    section: {
      marginTop: 24,
    },
    sectionContent: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 1,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 16,
      textTransform: 'uppercase',
    },
    settingItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    settingTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
    },
    versionText: {
      color: colors.textSecondary,
      fontSize: 12,
      opacity: 0.7,
    },
  });

export default SettingsScreen;
