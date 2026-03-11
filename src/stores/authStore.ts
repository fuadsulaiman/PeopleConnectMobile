import { create } from 'zustand';
import { Alert } from 'react-native';

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern instead - SDK is loaded only when needed
type AuthService = {
  login: (params: { username: string; password: string }) => Promise<any>;
  register: (params: any) => Promise<any>;
  verifyTwoFactor: (params: { userId: string; code: string }) => Promise<any>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
};

// Lazy loaders for SDK functions
const getAuthService = (): AuthService => {
  const sdk = require('../services/sdk');
  return sdk.auth;
};

const getInitializeSDK = (): (() => Promise<boolean>) => {
  const sdk = require('../services/sdk');
  return sdk.initializeSDK;
};

const getStoreTokens = (): ((accessToken: string, refreshToken: string) => Promise<void>) => {
  const sdk = require('../services/sdk');
  return sdk.storeTokens;
};

const getClearTokens = (): (() => Promise<void>) => {
  const sdk = require('../services/sdk');
  return sdk.clearTokens;
};

const getSetOnUnauthorizedCallback = (): ((callback: () => void) => void) => {
  const sdk = require('../services/sdk');
  return sdk.setOnUnauthorizedCallback;
};

const getSignalRService = () => {
  const signalr = require('../services/signalr');
  return signalr.signalRService;
};

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  statusMessage?: string;
  isOnline?: boolean;
  twoFactorEnabled?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  requiresTwoFactor: boolean;
  tempToken: string | null;
  sessionExpired: boolean;

  login: (username: string, password: string) => Promise<boolean>;
  register: (
    displayName: string,
    username: string,
    email: string,
    password: string,
    invitationCode?: string
  ) => Promise<boolean>;
  verify2FA: (tempToken: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  handleSessionExpired: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
  clearSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  requiresTwoFactor: false,
  tempToken: null,
  sessionExpired: false,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const auth = getAuthService();
      const storeTokens = getStoreTokens();
      const signalRService = getSignalRService();
      const response = await auth.login({ username, password });

      // Check if 2FA is required
      if (response.requiresTwoFactor) {
        // The user ID for 2FA verification comes from response.user.id
        const userId = response.user?.id || (response as any).userId || username;
        set({
          requiresTwoFactor: true,
          tempToken: userId,
          isLoading: false,
        });
        return false;
      }

      if (response.user && response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);

        // Normalize user object
        const user: User = {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email || '',
          displayName: response.user.name,
          name: response.user.name,
          avatarUrl: response.user.avatarUrl,
          bio: response.user.description,
          statusMessage: response.user.statusMessage,
          isOnline: true,
        };

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          requiresTwoFactor: false,
          tempToken: null,
        });
        await signalRService.connect();
        return true;
      }

      set({ isLoading: false });
      return false;
    } catch (error: any) {
      set({ error: error.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (displayName, username, email, password, invitationCode) => {
    set({ isLoading: true, error: null });
    try {
      const auth = getAuthService();
      const storeTokens = getStoreTokens();
      const signalRService = getSignalRService();
      const registerData: any = {
        name: displayName,
        username,
        email,
        password,
      };

      // Add invitation code if provided
      if (invitationCode) {
        registerData.invitationCode = invitationCode;
      }

      const response = await auth.register(registerData);

      if (response.user && response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);

        // Normalize user object
        const user: User = {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email || email,
          displayName: response.user.name || displayName,
          name: response.user.name || displayName,
          avatarUrl: response.user.avatarUrl,
          bio: response.user.description,
          isOnline: true,
        };

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        await signalRService.connect();
        return true;
      }

      set({ isLoading: false });
      return false;
    } catch (error: any) {
      set({ error: error.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  verify2FA: async (userId: string, code: string) => {
    set({ isLoading: true, error: null });
    try {
      const storeTokens = getStoreTokens();
      const signalRService = getSignalRService();
      const auth = getAuthService();

      // Bypass SDK - call backend directly because SDK uses wrong endpoint
      // Backend endpoint: POST /api/auth/2fa/verify
      const { config } = require('../constants');
      const verifyResponse = await fetch(config.API_BASE_URL + '/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code, isBackupCode: false }),
      });

      const verifyJson = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyJson.success) {
        throw new Error(verifyJson.message || 'Invalid verification code');
      }

      const data = verifyJson.data || verifyJson;
      const accessToken = data.accessToken;
      const refreshToken = data.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error('No tokens received from 2FA verification');
      }

      await storeTokens(accessToken, refreshToken);

      // Fetch current user profile with the new token
      const userResponse = await fetch(config.API_BASE_URL + '/auth/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
      });

      const userJson = await userResponse.json();
      const userData = userJson.data || userJson;

      const user: User = {
        id: userData.id,
        username: userData.username,
        email: userData.email || '',
        displayName: userData.name,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
        bio: userData.description,
        statusMessage: userData.statusMessage,
        isOnline: true,
      };

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        requiresTwoFactor: false,
        tempToken: null,
      });
      await signalRService.connect();
      return true;
    } catch (error: any) {
      set({ error: error.message || '2FA verification failed', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    const auth = getAuthService();
    const clearTokens = getClearTokens();
    const signalRService = getSignalRService();
    try {
      await auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearTokens();
      await signalRService.disconnect();
      set({
        user: null,
        isAuthenticated: false,
        requiresTwoFactor: false,
        tempToken: null,
        sessionExpired: false,
      });
    }
  },

  handleSessionExpired: async () => {
    const clearTokens = getClearTokens();
    const signalRService = getSignalRService();
    console.log('Session expired - clearing auth state');
    await clearTokens();
    await signalRService.disconnect();
    set({
      user: null,
      isAuthenticated: false,
      requiresTwoFactor: false,
      tempToken: null,
      sessionExpired: true,
    });
    // Show alert to user
    Alert.alert('Session Expired', 'Your session has expired. Please log in again.', [
      { text: 'OK' },
    ]);
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const initializeSDK = getInitializeSDK();
      const auth = getAuthService();
      const signalRService = getSignalRService();
      const hasTokens = await initializeSDK();
      if (!hasTokens) {
        set({ isLoading: false, isAuthenticated: false });
        return false;
      }

      // Get current user profile to validate token
      const userData = await auth.getCurrentUser();
      if (userData) {
        // Normalize user object
        const user: User = {
          id: userData.id,
          username: userData.username,
          email: userData.email || '',
          displayName: userData.name,
          name: userData.name,
          avatarUrl: userData.avatarUrl,
          bio: userData.description,
          statusMessage: userData.statusMessage,
          isOnline: true,
        };

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        await signalRService.connect();
        return true;
      }

      set({ isLoading: false, isAuthenticated: false });
      return false;
    } catch (error: any) {
      const errorMessage = error?.message || '';
      // Don't clear tokens on DataStore error (hot reload issue)
      if (errorMessage.includes('DataStore') || errorMessage.includes('multiple')) {
        console.log('Hot reload detected in checkAuth - preserving auth state');
        set({ isLoading: false });
        return get().isAuthenticated;
      }
      console.error('Auth check failed:', error);
      const clearTokens = getClearTokens();
      await clearTokens();
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
  },

  setUser: (user) => {
    set({ user });
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      set({
        user: {
          ...currentUser,
          ...updates,
        },
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearSessionExpired: () => {
    set({ sessionExpired: false });
  },
}));

// Register the session expired callback after store is created
// Use setTimeout to ensure this runs after all modules are loaded
setTimeout(() => {
  const setOnUnauthorizedCallback = getSetOnUnauthorizedCallback();
  setOnUnauthorizedCallback(() => {
    useAuthStore.getState().handleSessionExpired();
  });
}, 0);

export default useAuthStore;
