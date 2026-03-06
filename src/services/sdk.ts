/**
 * PeopleConnect SDK Configuration for React Native
 * Uses react-native-keychain for secure token storage
 */

import * as Keychain from 'react-native-keychain';
import { config } from '../constants';

// Token storage key
const TOKEN_STORAGE_KEY = 'peopleconnect_tokens';

// Flag to prevent multiple initializations during hot reload
let isInitialized = false;

// Callback for handling unauthorized (set by auth store after initialization)
let onUnauthorizedCallback: (() => void) | null = null;

// SDK instance - lazy loaded to handle import errors gracefully
let _sdk: import('@peopleconnect/sdk').PeopleConnectSDK | null = null;

/**
 * Get SDK instance - creates it on first access
 * This lazy loading prevents module initialization failures from breaking the entire app
 */
function getSDK(): import('@peopleconnect/sdk').PeopleConnectSDK {
  if (_sdk) {
    return _sdk;
  }

  try {
    // Dynamically import the SDK to handle potential import failures
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PeopleConnectSDK } = require('@peopleconnect/sdk');

    const instance = new PeopleConnectSDK({
      baseUrl: config.API_BASE_URL,

      // Handle token refresh
      onTokenRefresh: async (tokens: { accessToken: string; refreshToken: string }) => {
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

    _sdk = instance;
    console.log('[SDK] PeopleConnectSDK initialized successfully');
    return instance;
  } catch (error) {
    console.error('[SDK] Failed to initialize PeopleConnectSDK:', error);
    throw new Error(
      `SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Export SDK instance as a getter to enable lazy loading
export const sdk = {
  get auth() {
    return getSDK().auth;
  },
  get users() {
    return getSDK().users;
  },
  get conversations() {
    return getSDK().conversations;
  },
  get messages() {
    return getSDK().messages;
  },
  get contacts() {
    return getSDK().contacts;
  },
  get calls() {
    return getSDK().calls;
  },
  get media() {
    return getSDK().media;
  },
  get notifications() {
    return getSDK().notifications;
  },
  get broadcasts() {
    return getSDK().broadcasts;
  },
  get announcements() {
    return getSDK().announcements;
  },
  get search() {
    return getSDK().search;
  },
  get devices() {
    return getSDK().devices;
  },
  get twoFactor() {
    return getSDK().twoFactor;
  },
  get reports() {
    return getSDK().reports;
  },
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => getSDK().setTokens(tokens),
  clearTokens: () => getSDK().clearTokens(),
  getAccessToken: () => getSDK().getAccessToken(),
};

/**
 * Set the callback to handle unauthorized/session expired events
 * Call this from the auth store after it's initialized
 */
export function setOnUnauthorizedCallback(callback: () => void): void {
  onUnauthorizedCallback = callback;
}

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

// Export SDK services as lazy-loaded proxies
// These will not initialize the SDK until a method is actually called
const createServiceProxy = <T extends keyof ReturnType<typeof getSDK>>(service: T) => {
  return new Proxy({} as ReturnType<typeof getSDK>[T], {
    get(_target, prop) {
      const sdkInstance = getSDK();
      const serviceInstance = sdkInstance[service] as unknown as Record<string, unknown>;
      const value = serviceInstance[prop as string];
      if (typeof value === 'function') {
        return value.bind(serviceInstance);
      }
      return value;
    },
  });
};

export const auth = createServiceProxy('auth');
export const users = createServiceProxy('users');
export const conversations = createServiceProxy('conversations');
export const messages = createServiceProxy('messages');
export const contacts = createServiceProxy('contacts');
export const calls = createServiceProxy('calls');
export const media = createServiceProxy('media');
export const notifications = createServiceProxy('notifications');
export const broadcasts = createServiceProxy('broadcasts');
export const announcements = createServiceProxy('announcements');
export const search = createServiceProxy('search');
export const devices = createServiceProxy('devices');
export const twoFactor = createServiceProxy('twoFactor');
export const reports = createServiceProxy('reports');

export default sdk;
