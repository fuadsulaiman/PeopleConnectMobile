/**
 * Data Export Screen (GDPR)
 * Allows users to export their personal data in compliance with GDPR
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { ProfileStackParamList } from '../../navigation/types';
import { gdprService } from '../../services/gdprService';
import { useTheme } from '../../hooks';
import { useSettingsStore } from '../../stores/settingsStore';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataExport'>;

export const DataExportScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { getSiteName } = useSettingsStore();
  const siteName = getSiteName();
  const [isLoading, setIsLoading] = useState(false);
  const [exportData, setExportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportData = async () => {
    Alert.alert(
      'Export Your Data',
      'This will download all your personal data including messages, contacts, call history, and profile information.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          style: 'default',
          onPress: async () => {
            try {
              setIsLoading(true);
              setError(null);
              setExportData(null);

              const result = await gdprService.exportUserData();

              if (result.success && result.data) {
                setExportData(result.data);
                Alert.alert(
                  'Export Complete',
                  'Your data has been exported successfully. You can now share it.',
                  [
                    { text: 'OK' },
                    {
                      text: 'Share',
                      onPress: () => handleShareData(result.data),
                    },
                  ]
                );
              }
            } catch (err: any) {
              console.error('Error exporting data:', err);
              setError(err.message || 'An error occurred while exporting data');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareData = async (data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await Share.share({
        message: jsonString,
        title: `${siteName} Data Export`,
      });
    } catch (err) {
      console.error('Error sharing data:', err);
    }
  };

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export My Data</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Data Export</Text>
          <Text style={styles.infoText}>
            In compliance with GDPR and other privacy regulations, you can download all your
            personal data stored in {siteName}. The export includes:
          </Text>

          <View style={styles.featureList}>
            {[
              { icon: 'chatbubbles-outline', label: 'Messages & Conversations' },
              { icon: 'people-outline', label: 'Contacts' },
              { icon: 'call-outline', label: 'Call History' },
              { icon: 'images-outline', label: 'Media & Attachments' },
              { icon: 'person-outline', label: 'Profile Information' },
              { icon: 'settings-outline', label: 'Settings & Preferences' },
            ].map((item) => (
              <View key={item.label} style={styles.featureItem}>
                <Icon name={item.icon} size={20} color={colors.primary} style={styles.featureIcon} />
                <Text style={styles.featureText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.section, styles.errorSection]}>
            <Icon name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Export Success */}
        {exportData && (
          <View style={[styles.section, styles.successSection]}>
            <View style={styles.successHeader}>
              <Icon name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.successText}>Data exported successfully</Text>
            </View>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShareData(exportData)}
            >
              <Icon name="share-outline" size={20} color={colors.primary} />
              <Text style={styles.shareButtonText}>Share Export</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Request Export Button */}
        <TouchableOpacity
          style={[styles.requestButton, isLoading && { opacity: 0.6 }]}
          onPress={handleExportData}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Icon name="download-outline" size={20} color={colors.white} />
          )}
          <Text style={styles.requestButtonText}>
            {isLoading ? 'Exporting...' : 'Export My Data'}
          </Text>
        </TouchableOpacity>

        {/* Privacy Notice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Notice</Text>
          <Text style={styles.noticeText}>
            Your exported data contains personal information. Please handle it with care and store
            it securely. The export is generated in JSON format and contains all data associated
            with your account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
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
    contentContainer: {
      padding: 16,
      paddingTop: 24,
    },
    errorSection: {
      alignItems: 'center',
      backgroundColor: colors.error + '15',
      borderLeftColor: colors.error,
      borderLeftWidth: 4,
      flexDirection: 'row',
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
    },
    featureIcon: {
      marginRight: 12,
    },
    featureItem: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    featureList: {
      gap: 8,
    },
    featureText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
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
    infoText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    noticeText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    placeholder: {
      width: 40,
    },
    requestButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginBottom: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    requestButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    section: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 20,
      padding: 16,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    shareButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    shareButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    successHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    successSection: {
      borderLeftColor: colors.success,
      borderLeftWidth: 4,
    },
    successText: {
      color: colors.success,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default DataExportScreen;
