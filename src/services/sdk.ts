/**
 * PeopleConnect SDK Configuration for React Native
 * Uses react-native-keychain for secure token storage
 */

import { PeopleConnectSDK } from '@peopleconnect/sdk';
import * as Keychain from 'react-native-keychain';
import { config } from '../constants';

// Token storage key
const TOKEN_STORAGE_KEY = 'peopleconnect_tokens';

// Flag to prevent multiple initializations during hot reload
let isInitialized = false;

// Callback for handling unauthorized (set by auth store after initialization)
let onUnauthorizedCallback: (() => void) | null = null;

/**
 * Set the callback to handle unauthorized/session expired events
 * Call this from the auth store after it's initialized
 */
export function setOnUnauthorizedCallback(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

// Create SDK instance
export const sdk = new PeopleConnectSDK({
  baseUrl: config.API_BASE_URL,

  // Handle token refresh
  onTokenRefresh: async (tokens) => {
    try {
      console.log('Token refreshed successfully');
      await Keychain.setGenericPassword(
        TOKEN_STORAGE_KEY,
        JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        })
      );
    } catch (error) {
      console.error('Failed to store refreshed tokens:', error);
    }
  },

  // Handle unauthorized (token expired and refresh failed)
  onUnauthorized: () => {
    console.log('Unauthorized - session expired, logging out...');
    // Call the registered callback (logout function from auth store)
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  },
});

/**
 * Initialize the SDK with stored tokens
 * Call this on app startup
 */
export async function initializeSDK(): Promise<boolean> {
  // Prevent multiple initializations during hot reload
  if (isInitialized) {
    const token = sdk.getAccessToken();
    if (token) {
      return true;
    }
  }

  try {
    const credentials = await Keychain.getGenericPassword();
    if (credentials && credentials.password) {
      const tokens = JSON.parse(credentials.password);
      sdk.setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      isInitialized = true;
      return true;
    }
    return false;
  } catch (error: any) {
    // Handle DataStore conflict during hot reload
    const errorMessage = error?.message || '';
    if (errorMessage.includes('DataStore') || errorMessage.includes('multiple')) {
      console.log('Hot reload detected - checking existing auth state');
      isInitialized = true;
      // Check if we already have a token set
      const token = sdk.getAccessToken();
      return !!token;
    }
    console.error('Failed to initialize SDK:', error);
    return false;
  }
}

/**
 * Store tokens after login
 */
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  sdk.setTokens({ accessToken, refreshToken });
  await Keychain.setGenericPassword(
    TOKEN_STORAGE_KEY,
    JSON.stringify({ accessToken, refreshToken })
  );
}

/**
 * Clear tokens on logout
 */
export async function clearTokens(): Promise<void> {
  sdk.clearTokens();
  await Keychain.resetGenericPassword();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!sdk.getAccessToken();
}

/**
 * Get current access token (for SignalR connections)
 */
export function getAccessToken(): string | null {
  return sdk.getAccessToken();
}

// Export SDK services for direct access
export const {
  auth,
  users,
  conversations,
  messages,
  contacts,
  calls,
  media,
  notifications,
  broadcasts,
  announcements,
  search,
  devices,
  twoFactor,
  reports,
} = sdk;

export default sdk;
