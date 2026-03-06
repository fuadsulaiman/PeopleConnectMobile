import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStackParamList } from '../../navigation/types';
import { useTheme } from '../../hooks';
// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
const getDevices = () => {
  const sdkModule = require('../../services/sdk');
  return sdkModule.devices;
};
const devicesApi = { list: () => getDevices().list(), remove: (id: string) => getDevices().remove(id), removeAllOthers: () => getDevices().removeAllOthers() };

type Props = NativeStackScreenProps<ProfileStackParamList, 'Devices'>;

interface Device {
  id: string;
  name: string;
  platform: 'web' | 'ios' | 'android' | string;
  lastActive: string;
  ipAddress?: string;
  isCurrent: boolean;
  browser?: string;
}

const DevicesScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemovingAll, setIsRemovingAll] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchDevices = useCallback(async () => {
    try {
      const devicesList = await devicesApi.list();
      const sessions = Array.isArray(devicesList) ? devicesList : [];

      const mappedDevices: Device[] = sessions.map((device: any) => ({
        id: device.id,
        name: device.name || device.deviceName || device.browser || 'Unknown Device',
        platform: (device.platform as 'web' | 'ios' | 'android') || 'web',
        lastActive: device.lastActive || device.createdAt,
        ipAddress: device.ipAddress || undefined,
        isCurrent: device.isCurrent,
        browser: device.browser || undefined,
      }));

      setDevices(mappedDevices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      // Fallback to current device if API fails
      setDevices([
        {
          id: 'current',
          name:
            Platform.OS === 'ios'
              ? 'iPhone'
              : Platform.OS === 'android'
                ? 'Android Device'
                : 'Mobile Device',
          platform: Platform.OS,
          lastActive: new Date().toISOString(),
          isCurrent: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDevices();
  }, [fetchDevices]);

  const handleRemoveDevice = useCallback(async (device: Device) => {
    if (device.isCurrent) {
      Alert.alert(
        'Cannot Remove',
        'You cannot remove the current device. Use logout to end this session.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Remove Device', `Are you sure you want to sign out from "${device.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(device.id);
          try {
            await devicesApi.remove(device.id);
            setDevices((prev) => prev.filter((d) => d.id !== device.id));
            Alert.alert('Success', 'Device has been signed out.');
          } catch (error) {
            console.error('Failed to remove device:', error);
            Alert.alert('Error', 'Failed to remove device. Please try again.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  }, []);

  const handleRemoveAllOtherDevices = useCallback(() => {
    const otherDevices = devices.filter((d) => !d.isCurrent);
    if (otherDevices.length === 0) {
      Alert.alert('No Other Devices', 'There are no other devices to sign out from.');
      return;
    }

    Alert.alert(
      'Sign Out All Other Devices',
      `Are you sure you want to sign out from all ${otherDevices.length} other device(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            setIsRemovingAll(true);
            try {
              await devicesApi.removeAllOthers();
              setDevices((prev) => prev.filter((d) => d.isCurrent));
              Alert.alert('Success', 'All other devices have been signed out.');
            } catch (error) {
              console.error('Failed to remove all devices:', error);
              Alert.alert('Error', 'Failed to sign out from other devices. Please try again.');
            } finally {
              setIsRemovingAll(false);
            }
          },
        },
      ]
    );
  }, [devices]);

  const getPlatformIcon = (platform: string): string => {
    switch (platform?.toLowerCase()) {
      case 'ios':
        return 'phone-portrait';
      case 'android':
        return 'phone-portrait-outline';
      case 'web':
        return 'globe-outline';
      default:
        return 'hardware-chip-outline';
    }
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Active now';
    }
    if (diffMins < 60) {
      return `Active ${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `Active ${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return 'Active yesterday';
    }
    if (diffDays < 7) {
      return `Active ${diffDays} days ago`;
    }
    return `Active on ${date.toLocaleDateString()}`;
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const isRemoving = removingId === item.id;

    return (
      <View style={styles.deviceItem}>
        <View style={[styles.deviceIcon, item.isCurrent && styles.currentDeviceIcon]}>
          <Icon
            name={getPlatformIcon(item.platform)}
            size={24}
            color={item.isCurrent ? colors.white : colors.primary}
          />
        </View>
        <View style={styles.deviceInfo}>
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isCurrent && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>This device</Text>
              </View>
            )}
          </View>
          <Text style={styles.deviceDetails}>
            {item.platform?.charAt(0).toUpperCase() + item.platform?.slice(1) || 'Unknown'}
            {item.ipAddress ? ` - ${item.ipAddress}` : ''}
          </Text>
          <Text style={styles.lastActive}>{formatLastActive(item.lastActive)}</Text>
        </View>
        {!item.isCurrent && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveDevice(item)}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Icon name="close-circle" size={24} color={colors.error} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const otherDevicesCount = devices.filter((d) => !d.isCurrent).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Sessions</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              <View style={styles.infoBox}>
                <Icon name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.infoText}>
                  These are the devices currently signed in to your account. You can sign out from
                  any device you don't recognize.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="phone-portrait-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No active sessions found</Text>
              </View>
            }
          />

          {otherDevicesCount > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.signOutAllButton}
                onPress={handleRemoveAllOtherDevices}
                disabled={isRemovingAll}
              >
                {isRemovingAll ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Icon name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.signOutAllText}>
                      Sign out from {otherDevicesCount} other device
                      {otherDevicesCount > 1 ? 's' : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
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
    currentBadge: {
      backgroundColor: colors.success,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    currentBadgeText: {
      color: colors.white,
      fontSize: 10,
      fontWeight: '600',
    },
    currentDeviceIcon: {
      backgroundColor: colors.primary,
    },
    deviceDetails: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    deviceHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    deviceIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    deviceInfo: {
      flex: 1,
      marginLeft: 12,
    },
    deviceItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    deviceName: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 16,
    },
    footer: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      bottom: 0,
      left: 0,
      padding: 16,
      position: 'absolute',
      right: 0,
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
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    infoBox: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      margin: 16,
      padding: 12,
    },
    infoText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    lastActive: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 2,
    },
    listContent: {
      paddingBottom: 100,
    },
    loadingContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 12,
    },
    placeholder: {
      width: 40,
    },
    removeButton: {
      padding: 8,
    },
    signOutAllButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      padding: 14,
    },
    signOutAllText: {
      color: colors.error,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default DevicesScreen;
