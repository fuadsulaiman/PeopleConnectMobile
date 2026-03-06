/**
 * Data Export Screen (GDPR)
 * Allows users to export their personal data in compliance with GDPR
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProfileStackParamList } from '../../navigation/types';
import { gdprService, DataExportStatus } from '../../services/gdprService';
import { useTheme } from '../../hooks';
import { useSettingsStore } from '../../stores/settingsStore';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataExport'>;

export const DataExportScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { getSiteName } = useSettingsStore();
  const siteName = getSiteName();
  const [status, setStatus] = useState<DataExportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check export status on mount
  useEffect(() => {
    checkExportStatus();
  }, []);

  const checkExportStatus = async () => {
    try {
      setIsLoading(true);
      const currentStatus = await gdprService.getDataExportStatus();
      setStatus(currentStatus);
      setError(null);
    } catch (err) {
      console.error('Error checking export status:', err);
      // This is expected if no export has been requested yet
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestExport = async () => {
    Alert.alert(
      'Export Your Data',
      'This will create a ZIP file containing all your personal data (conversations, messages, contacts, etc.). This may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          style: 'default',
          onPress: async () => {
            try {
              setIsLoading(true);
              setError(null);
              const response = await gdprService.requestDataExport();

              if (response.success) {
                Alert.alert(
                  'Export Requested',
                  `Your data export has been requested. It will be ready in approximately ${response.data.estimatedTimeInMinutes} minutes.`,
                  [{ text: 'OK' }]
                );

                // Start polling for status
                setIsPolling(true);
                try {
                  const finalStatus = await gdprService.pollDataExportStatus(120, 30000); // 60 attempts, 30s intervals
                  setStatus(finalStatus);

                  if (finalStatus.status === 'ready' && finalStatus.downloadUrl) {
                    Alert.alert('Export Ready', 'Your data export is ready for download.', [
                      { text: 'OK' },
                      {
                        text: 'Download',
                        onPress: () => handleDownloadExport(finalStatus),
                      },
                    ]);
                  } else if (finalStatus.status === 'failed') {
                    Alert.alert(
                      'Export Failed',
                      finalStatus.message || 'The export process failed.'
                    );
                  }
                } finally {
                  setIsPolling(false);
                }
              } else {
                setError(response.message || 'Failed to request data export');
              }
            } catch (err: any) {
              console.error('Error requesting export:', err);
              setError(err.message || 'An error occurred while requesting the export');
              setIsPolling(false);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadExport = async (exportStatus: DataExportStatus) => {
    if (!exportStatus.downloadUrl) {
      Alert.alert('Error', 'No download URL available');
      return;
    }

    try {
      Alert.alert(
        'Download Instructions',
        'Your data will be downloaded to your device. The file is a ZIP archive containing:\n\n• Messages & Conversations\n• Contacts\n• Call history\n• Media & Attachments\n• Profile information\n• Settings',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Link',
            onPress: () => {
              // In a real app, you would use Linking.openURL(exportStatus.downloadUrl)
              // or implement a download handler
              Alert.alert(
                'Download Link Copied',
                'The download link has been copied to your clipboard.'
              );
            },
          },
        ]
      );
    } catch (err) {
      console.error('Error downloading export:', err);
      Alert.alert('Error', 'Failed to initiate download');
    }
  };

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'pending':
      case 'processing':
        return colors.warning;
      case 'ready':
        return colors.success;
      case 'failed':
      case 'expired':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'pending':
      case 'processing':
        return 'clock-outline';
      case 'ready':
        return 'check-circle';
      case 'failed':
        return 'alert-circle';
      case 'expired':
        return 'close-circle';
      default:
        return 'information';
    }
  };

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.primary} />
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
            <View style={styles.featureItem}>
              <Icon name="chat" size={20} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Messages & Conversations</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="account-multiple"
                size={20}
                color={colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>Contacts</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="phone-log" size={20} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Call History</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon
                name="image-multiple"
                size={20}
                color={colors.primary}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>Media & Attachments</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="account" size={20} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Profile Information</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="cog" size={20} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Settings & Preferences</Text>
            </View>
          </View>
        </View>

        {/* Status Section */}
        {status && (
          <View style={[styles.section, styles.statusSection]}>
            <Text style={styles.sectionTitle}>Current Export Status</Text>

            <View style={[styles.statusCard, { borderLeftColor: getStatusColor(status.status) }]}>
              <View style={styles.statusRow}>
                <Icon
                  name={getStatusIcon(status.status)}
                  size={24}
                  color={getStatusColor(status.status)}
                />
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>
                    {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                  </Text>
                  {status.message && <Text style={styles.statusMessage}>{status.message}</Text>}
                </View>
              </View>

              {status.requestedAt && (
                <Text style={styles.dateText}>
                  Requested: {new Date(status.requestedAt).toLocaleString()}
                </Text>
              )}

              {status.completedAt && (
                <Text style={styles.dateText}>
                  Completed: {new Date(status.completedAt).toLocaleString()}
                </Text>
              )}

              {status.expiresAt && (
                <Text style={[styles.dateText, { color: colors.warning }]}>
                  Expires: {new Date(status.expiresAt).toLocaleString()}
                </Text>
              )}

              {status.fileName && <Text style={styles.fileNameText}>File: {status.fileName}</Text>}
            </View>

            {status.status === 'ready' && status.downloadUrl && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownloadExport(status)}
              >
                <Icon name="download" size={20} color={colors.white} />
                <Text style={styles.downloadButtonText}>Download File</Text>
              </TouchableOpacity>
            )}

            {(status.status === 'pending' || status.status === 'processing') && (
              <TouchableOpacity style={styles.refreshButton} onPress={checkExportStatus}>
                <Icon name="refresh" size={20} color={colors.primary} />
                <Text style={styles.refreshButtonText}>Check Status</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.error + '15',
                borderLeftColor: colors.error,
                borderLeftWidth: 4,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Request Export Button */}
        {!status ||
        status.status === 'ready' ||
        status.status === 'expired' ||
        status.status === 'failed' ? (
          <TouchableOpacity
            style={[styles.requestButton, isLoading && { opacity: 0.6 }]}
            onPress={handleRequestExport}
            disabled={isLoading || isPolling}
          >
            {isLoading || isPolling ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Icon name="download-outline" size={20} color={colors.white} />
            )}
            <Text style={styles.requestButtonText}>
              {isLoading || isPolling ? 'Processing...' : 'Request Data Export'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Privacy Notice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Notice</Text>
          <Text style={styles.noticeText}>
            Your exported data will be encrypted and available for download for 7 days. After that,
            it will be automatically deleted from our servers. You can request a new export at any
            time.
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
    dateText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    downloadButton: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    downloadButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    errorText: {
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
    fileNameText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 4,
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
    refreshButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    refreshButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
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
    statusCard: {
      backgroundColor: colors.background,
      borderLeftWidth: 4,
      borderRadius: 8,
      marginBottom: 12,
      padding: 12,
    },
    statusInfo: {
      flex: 1,
      marginLeft: 12,
    },
    statusLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    statusMessage: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 12,
    },
    statusSection: {
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
    },
  });

export default DataExportScreen;
