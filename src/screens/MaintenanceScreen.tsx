import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../hooks';
import { useSettingsStore } from '../stores/settingsStore';
import { useAppTranslation } from '../i18n/useTranslation';

const POLL_INTERVAL = 30000; // 30 seconds

const MaintenanceScreen: React.FC = () => {
  const { colors } = useTheme();
  const { publicSettings, fetchPublicSettingsForce } = useSettingsStore();
  const { t } = useAppTranslation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const maintenanceMessage =
    publicSettings?.general?.maintenanceMessage ||
    t('maintenance.defaultMessage');

  useEffect(() => {
    // Poll every 30 seconds to check if maintenance mode ended
    intervalRef.current = setInterval(() => {
      fetchPublicSettingsForce();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchPublicSettingsForce]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="construct-outline" size={80} color={colors.warning} />
        </View>

        <Text style={styles.title}>{t('maintenance.title')}</Text>

        <Text style={styles.message}>{maintenanceMessage}</Text>

        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.statusText}>
            {t('maintenance.checkingStatus')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 40,
      paddingHorizontal: 16,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
    },
    statusText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 10,
    },
  });

export default MaintenanceScreen;
