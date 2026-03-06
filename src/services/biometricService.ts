/**
 * Biometric Authentication Service
 * Provides biometric authentication support (Face ID, Touch ID, Fingerprint)
 */

import * as Keychain from 'react-native-keychain';
import { Alert } from 'react-native';

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

export interface BiometricCredentials {
  username: string;
  password: string;
}

export type BiometricType = 'TouchID' | 'FaceID' | 'Fingerprint' | 'Iris' | null;

class BiometricService {
  /**
   * Check if biometric authentication is available on the device
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get the type of biometric authentication available
   */
  async getBiometricType(): Promise<BiometricType> {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      if (!biometryType) {
        return null;
      }

      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
          return 'TouchID';
        case Keychain.BIOMETRY_TYPE.FACE_ID:
          return 'FaceID';
        case Keychain.BIOMETRY_TYPE.FINGERPRINT:
          return 'Fingerprint';
        case Keychain.BIOMETRY_TYPE.IRIS:
          return 'Iris';
        default:
          return null;
      }
    } catch (error) {
      console.error('Error getting biometric type:', error);
      return null;
    }
  }

  /**
   * Get a friendly name for the biometric type
   */
  async getBiometricTypeName(): Promise<string> {
    const type = await this.getBiometricType();
    switch (type) {
      case 'TouchID':
        return 'Touch ID';
      case 'FaceID':
        return 'Face ID';
      case 'Fingerprint':
        return 'Fingerprint';
      case 'Iris':
        return 'Iris';
      default:
        return 'Biometric';
    }
  }

  /**
   * Check if biometric login is enabled for the user
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: BIOMETRIC_ENABLED_KEY,
      });
      return credentials !== false && credentials.password === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Enable biometric login with stored credentials
   */
  async enableBiometric(username: string, password: string): Promise<boolean> {
    try {
      // Check if biometric is available
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) {
        throw new Error('Biometric authentication is not available on this device');
      }

      // Store credentials with biometric protection
      await Keychain.setGenericPassword(username, password, {
        service: BIOMETRIC_CREDENTIALS_KEY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });

      // Mark biometric as enabled
      await Keychain.setGenericPassword('biometric', 'true', {
        service: BIOMETRIC_ENABLED_KEY,
      });

      return true;
    } catch (error: any) {
      console.error('Error enabling biometric:', error);
      // Clean up on failure
      await this.disableBiometric();
      throw error;
    }
  }

  /**
   * Disable biometric login and remove stored credentials
   */
  async disableBiometric(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: BIOMETRIC_CREDENTIALS_KEY,
      });
      await Keychain.resetGenericPassword({
        service: BIOMETRIC_ENABLED_KEY,
      });
    } catch (error) {
      console.error('Error disabling biometric:', error);
    }
  }

  /**
   * Authenticate with biometric and retrieve stored credentials
   */
  async authenticateWithBiometric(): Promise<BiometricCredentials | null> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      if (!isEnabled) {
        return null;
      }

      const biometricName = await this.getBiometricTypeName();

      const credentials = await Keychain.getGenericPassword({
        service: BIOMETRIC_CREDENTIALS_KEY,
        authenticationPrompt: {
          title: 'Authenticate',
          subtitle: `Use ${biometricName} to sign in`,
          description: 'Place your finger on the sensor or look at the camera',
          cancel: 'Cancel',
        },
      });

      if (credentials === false) {
        return null;
      }

      return {
        username: credentials.username,
        password: credentials.password,
      };
    } catch (error: any) {
      console.error('Biometric authentication failed:', error);

      // Handle specific errors
      if (error.message?.includes('User canceled')) {
        return null;
      }

      if (error.message?.includes('Too many attempts')) {
        Alert.alert(
          'Too Many Attempts',
          'Biometric authentication has been locked. Please try again later or use your password.'
        );
        return null;
      }

      throw error;
    }
  }

  /**
   * Prompt user to enable biometric authentication after successful login
   */
  async promptEnableBiometric(username: string, password: string): Promise<boolean> {
    const isAvailable = await this.isBiometricAvailable();
    if (!isAvailable) {
      return false;
    }

    const isAlreadyEnabled = await this.isBiometricEnabled();
    if (isAlreadyEnabled) {
      return false;
    }

    const biometricName = await this.getBiometricTypeName();

    return new Promise((resolve) => {
      Alert.alert(
        `Enable ${biometricName}`,
        `Would you like to use ${biometricName} for faster sign-in next time?`,
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable',
            onPress: async () => {
              try {
                await this.enableBiometric(username, password);
                resolve(true);
              } catch (error) {
                console.error('Failed to enable biometric:', error);
                Alert.alert('Error', 'Failed to enable biometric authentication');
                resolve(false);
              }
            },
          },
        ]
      );
    });
  }

  /**
   * Update stored credentials (call after password change)
   */
  async updateCredentials(username: string, newPassword: string): Promise<boolean> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      if (!isEnabled) {
        return false;
      }

      // Re-enable with new password
      return await this.enableBiometric(username, newPassword);
    } catch (error) {
      console.error('Error updating biometric credentials:', error);
      // Disable biometric on failure
      await this.disableBiometric();
      return false;
    }
  }
}

export const biometricService = new BiometricService();
export default biometricService;
