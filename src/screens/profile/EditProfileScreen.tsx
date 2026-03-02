import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { users, getAccessToken } from '../../services/sdk';
import { config } from '../../constants';
import { Avatar } from '../../components/common/Avatar';
import * as ImagePicker from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState(user?.avatarUrl);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibrary({
        mediaType: 'photo',
        maxWidth: 800,
        maxHeight: 800,
        quality: 1,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.uri) return;

        setAvatarUri(asset.uri);
        setIsLoading(true);

        try {
          // Convert image to JPEG format using ImageResizer
          // This fixes the webp format issue that causes RetentionRuleViolation
          console.log('[AVATAR] Original:', asset.uri, asset.type);

          const resizedImage = await ImageResizer.createResizedImage(
            asset.uri,
            500, // maxWidth
            500, // maxHeight
            'JPEG', // compressFormat - forces JPEG output
            80, // quality
            0, // rotation
            undefined, // outputPath (use default)
            false, // keepMeta
          );

          console.log('[AVATAR] Resized to JPEG:', resizedImage.uri);

          let fileUri = resizedImage.uri;
          if (Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
            fileUri = 'file://' + fileUri;
          }

          const formData = new FormData();
          formData.append('file', {
            uri: fileUri,
            type: 'image/jpeg',
            name: 'avatar.jpg',
          } as any);

          const token = getAccessToken();
          const uploadUrl = config.API_BASE_URL + '/auth/avatar';

          console.log('[AVATAR] Uploading JPEG to:', uploadUrl);

          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
            },
            body: formData,
          });

          console.log('[AVATAR] Status:', response.status);
          const responseText = await response.text();
          console.log('[AVATAR] Response:', responseText);

          if (!response.ok) {
            throw new Error(responseText);
          }

          const json = JSON.parse(responseText);
          if (json.success && json.data && json.data.url) {
            const newUser = Object.assign({}, user, { avatarUrl: json.data.url });
            setUser(newUser);
            setAvatarUri(json.data.url);
            Alert.alert('Success', 'Avatar updated');
          } else {
            Alert.alert('Error', json.message || 'Upload failed');
          }
        } catch (err) {
          console.error('[AVATAR] Error:', err);
          Alert.alert('Error', 'Failed to upload avatar');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('[AVATAR] Picker error:', err);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser = await users.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
      });
      setUser(updatedUser as any);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage}>
            <Avatar
              uri={avatarUri}
              name={displayName || user?.username}
              size={100}
            />
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>Edit</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.changePhotoButton} onPress={handlePickImage}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor="#999"
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user?.username}
              editable={false}
            />
            <Text style={styles.hint}>Username cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user?.email}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.hint}>{bio.length}/200</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formSection: {
    paddingHorizontal: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default EditProfileScreen;
