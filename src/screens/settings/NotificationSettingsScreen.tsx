import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getSDK = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.sdk || sdkModule.default;
};
const sdk = { get notifications() { return getSDK().notifications; }, getAccessToken: () => getSDK().getAccessToken() };

type Props = NativeStackScreenProps<ProfileStackParamList, 'NotificationSettings'>;

interface NotificationPreferences {
  // Backend synced settings
  messageNotifications: boolean;
  callNotifications: boolean;
  contactNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showPreview: boolean;
  // Local-only settings
  systemNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  messageNotifications: true,
  callNotifications: true,
  contactNotifications: true,
  soundEnabled: true,
  vibrationEnabled: true,
  showPreview: true,
  systemNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

const STORAGE_KEY = 'notification_preferences_local';

const NotificationSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    loadNotificationPreferences();
  }, []);

  const makeApiCall = async (method: string, endpoint: string, body?: any) => {
    const token = sdk.getAccessToken();
    const baseUrl = 'https://3.121.226.182/api';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  };

  const loadNotificationPreferences = async () => {
    try {
      setIsLoading(true);

      // Load backend preferences
      let backendPrefs = DEFAULT_PREFS;
      try {
        const data = await makeApiCall('GET', '/users/me/notification-settings');
        backendPrefs = {
          ...DEFAULT_PREFS,
          messageNotifications: data.messageNotifications ?? true,
          callNotifications: data.callNotifications ?? true,
          contactNotifications: data.contactNotifications ?? true,
          soundEnabled: data.soundEnabled ?? true,
          vibrationEnabled: data.vibrationEnabled ?? true,
          showPreview: data.showPreview ?? true,
        };
      } catch (error) {
        console.error('Failed to load backend notification settings:', error);
      }

      // Load local preferences
      try {
        const localData = await AsyncStorage.getItem(STORAGE_KEY);
        if (localData) {
          const localPrefs = JSON.parse(localData);
          setPreferences({
            ...backendPrefs,
            systemNotifications: localPrefs.systemNotifications ?? true,
            quietHoursEnabled: localPrefs.quietHoursEnabled ?? false,
            quietHoursStart: localPrefs.quietHoursStart ?? '22:00',
            quietHoursEnd: localPrefs.quietHoursEnd ?? '07:00',
          });
        } else {
          setPreferences(backendPrefs);
        }
      } catch (error) {
        console.error('Failed to load local notification settings:', error);
        setPreferences(backendPrefs);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateBackendSetting = async (key: keyof NotificationPreferences, value: boolean) => {
    const previousPrefs = { ...preferences };

    // Optimistically update UI
    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      setIsSaving(true);
      const backendSettings = {
        messageNotifications:
          key === 'messageNotifications' ? value : preferences.messageNotifications,
        callNotifications: key === 'callNotifications' ? value : preferences.callNotifications,
        contactNotifications:
          key === 'contactNotifications' ? value : preferences.contactNotifications,
        soundEnabled: key === 'soundEnabled' ? value : preferences.soundEnabled,
        vibrationEnabled: key === 'vibrationEnabled' ? value : preferences.vibrationEnabled,
        showPreview: key === 'showPreview' ? value : preferences.showPreview,
      };

      await makeApiCall('PUT', '/users/me/notification-settings', backendSettings);
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      setPreferences(previousPrefs);
      Alert.alert('Error', 'Failed to update notification setting. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateLocalSetting = async (
    key: keyof NotificationPreferences,
    value: boolean | string
  ) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);

    try {
      const localSettings = {
        systemNotifications: newPrefs.systemNotifications,
        quietHoursEnabled: newPrefs.quietHoursEnabled,
        quietHoursStart: newPrefs.quietHoursStart,
        quietHoursEnd: newPrefs.quietHoursEnd,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localSettings));
    } catch (error) {
      console.error('Failed to save local settings:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.placeholder} />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Push Notifications Section */}
        <Text style={styles.sectionTitle}>Push Notifications</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="chatbubble-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Message Notifications</Text>
              <Text style={styles.settingDescription}>Receive notifications for new messages</Text>
            </View>
          </View>
          <Switch
            value={preferences.messageNotifications}
            onValueChange={(value) => updateBackendSetting('messageNotifications', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.success}15` }]}>
              <Icon name="call-outline" size={20} color={colors.success} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Call Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications for incoming calls
              </Text>
            </View>
          </View>
          <Switch
            value={preferences.callNotifications}
            onValueChange={(value) => updateBackendSetting('callNotifications', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.warning}15` }]}>
              <Icon name="person-add-outline" size={20} color={colors.warning} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Contact Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications for contact requests
              </Text>
            </View>
          </View>
          <Switch
            value={preferences.contactNotifications}
            onValueChange={(value) => updateBackendSetting('contactNotifications', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Alerts Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Alerts</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="volume-high-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Sound</Text>
              <Text style={styles.settingDescription}>Play a sound for notifications</Text>
            </View>
          </View>
          <Switch
            value={preferences.soundEnabled}
            onValueChange={(value) => updateBackendSetting('soundEnabled', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="phone-portrait-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Vibration</Text>
              <Text style={styles.settingDescription}>Vibrate for notifications</Text>
            </View>
          </View>
          <Switch
            value={preferences.vibrationEnabled}
            onValueChange={(value) => updateBackendSetting('vibrationEnabled', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Preview Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Content</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="eye-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Show Preview</Text>
              <Text style={styles.settingDescription}>Show message content in notifications</Text>
            </View>
          </View>
          <Switch
            value={preferences.showPreview}
            onValueChange={(value) => updateBackendSetting('showPreview', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Local Settings Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Device Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View
              style={[
                styles.settingIconContainer,
                { backgroundColor: `${colors.textSecondary}15` },
              ]}
            >
              <Icon name="notifications-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>System Notifications</Text>
              <Text style={styles.settingDescription}>
                Show system and app update notifications
              </Text>
            </View>
          </View>
          <Switch
            value={preferences.systemNotifications}
            onValueChange={(value) => updateLocalSetting('systemNotifications', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View
              style={[
                styles.settingIconContainer,
                { backgroundColor: `${colors.textSecondary}15` },
              ]}
            >
              <Icon name="moon-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Quiet Hours</Text>
              <Text style={styles.settingDescription}>
                {preferences.quietHoursEnabled
                  ? `${preferences.quietHoursStart} - ${preferences.quietHoursEnd}`
                  : 'Mute notifications during specific hours'}
              </Text>
            </View>
          </View>
          <Switch
            value={preferences.quietHoursEnabled}
            onValueChange={(value) => updateLocalSetting('quietHoursEnabled', value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Notification settings sync across all your devices. Device-specific settings like quiet
            hours are stored locally.
          </Text>
        </View>

        {/* System Notification Settings */}
        <TouchableOpacity
          style={styles.systemSettingsButton}
          onPress={() => {
            if (Platform.OS === 'ios') {
              Alert.alert(
                'System Settings',
                'To manage system notification permissions, go to Settings > Notifications > PeopleConnect'
              );
            } else {
              Alert.alert(
                'System Settings',
                'To manage system notification permissions, go to Settings > Apps > PeopleConnect > Notifications'
              );
            }
          }}
        >
          <Icon name="settings-outline" size={20} color={colors.primary} />
          <Text style={styles.systemSettingsText}>Open System Notification Settings</Text>
          <Icon name="open-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
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
      padding: 16,
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
    infoBox: {
      alignItems: 'flex-start',
      backgroundColor: `${colors.primary}10`,
      borderRadius: 12,
      flexDirection: 'row',
      marginTop: 16,
      padding: 16,
    },
    infoText: {
      color: colors.primary,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      marginLeft: 12,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    placeholder: {
      width: 40,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    settingDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    settingIconContainer: {
      alignItems: 'center',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      marginRight: 12,
      width: 40,
    },
    settingInfo: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      marginRight: 16,
    },
    settingItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
      padding: 16,
    },
    settingTextContainer: {
      flex: 1,
    },
    settingTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
    },
    systemSettingsButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 32,
      marginTop: 16,
      padding: 16,
    },
    systemSettingsText: {
      color: colors.primary,
      flex: 1,
      fontSize: 16,
      marginLeft: 12,
    },
  });

export default NotificationSettingsScreen;
