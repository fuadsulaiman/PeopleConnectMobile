import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

interface SettingItem {
  icon: string;
  title: string;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuthStore();

  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);

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
      title: 'Notifications',
      items: [
        {
          icon: '🔔',
          title: 'Push Notifications',
          type: 'toggle',
          value: notifications,
          onToggle: setNotifications,
        },
        {
          icon: '🔊',
          title: 'Sound',
          type: 'toggle',
          value: soundEnabled,
          onToggle: setSoundEnabled,
        },
        {
          icon: '📳',
          title: 'Vibration',
          type: 'toggle',
          value: vibrationEnabled,
          onToggle: setVibrationEnabled,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: '🌙',
          title: 'Dark Mode',
          type: 'toggle',
          value: darkMode,
          onToggle: setDarkMode,
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          icon: '✓',
          title: 'Read Receipts',
          type: 'toggle',
          value: readReceipts,
          onToggle: setReadReceipts,
        },
        {
          icon: '🟢',
          title: 'Show Online Status',
          type: 'toggle',
          value: onlineStatus,
          onToggle: setOnlineStatus,
        },
        {
          icon: '🚫',
          title: 'Blocked Users',
          type: 'navigation',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          icon: '🔐',
          title: 'Two-Factor Authentication',
          type: 'navigation',
          onPress: () => {},
        },
        {
          icon: '🔑',
          title: 'Change Password',
          type: 'navigation',
          onPress: () => {},
        },
        {
          icon: '📱',
          title: 'Active Sessions',
          type: 'navigation',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Data & Storage',
      items: [
        {
          icon: '💾',
          title: 'Storage Usage',
          type: 'navigation',
          onPress: () => {},
        },
        {
          icon: '📥',
          title: 'Auto-Download Media',
          type: 'navigation',
          onPress: () => {},
        },
        {
          icon: '🗑️',
          title: 'Clear Cache',
          type: 'action',
          onPress: () => {
            Alert.alert('Cache Cleared', 'Application cache has been cleared.');
          },
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: '📤',
          title: 'Export Data',
          type: 'action',
          onPress: () => {},
        },
        {
          icon: '❌',
          title: 'Delete Account',
          type: 'action',
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
      >
        <Text style={styles.settingIcon}>{item.icon}</Text>
        <Text style={styles.settingTitle}>{item.title}</Text>
        {item.type === 'toggle' && (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
            thumbColor="#fff"
          />
        )}
        {item.type === 'navigation' && (
          <Text style={styles.settingArrow}>{'>'}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map(renderSettingItem)}
            </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  settingArrow: {
    fontSize: 18,
    color: '#ccc',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: '#ccc',
  },
});

export default SettingsScreen;
