import { create } from 'zustand';
import { sdk, auth, initializeSDK, storeTokens, clearTokens, setOnUnauthorizedCallback } from '../services/sdk';
import { signalRService } from '../services/signalr';
import { Alert } from 'react-native';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isOnline?: boolean;
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
  register: (displayName: string, username: string, email: string, password: string) => Promise<boolean>;
  verify2FA: (tempToken: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  handleSessionExpired: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User) => void;
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
      const response = await auth.login({ username, password });

      if (response.requiresTwoFactor) {
        set({
          requiresTwoFactor: true,
          tempToken: response.tempToken || null,
          isLoading: false,
        });
        return false;
      }

      if (response.user && response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);
        set({
          user: response.user as User,
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

  register: async (displayName, username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await auth.register({
        displayName,
        username,
        email,
        password,
      });

      if (response.user && response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);
        set({
          user: response.user as User,
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

  verify2FA: async (tempToken, code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await auth.verify2FA({ tempToken, code });

      if (response.user && response.accessToken && response.refreshToken) {
        await storeTokens(response.accessToken, response.refreshToken);
        set({
          user: response.user as User,
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
      set({ error: error.message || '2FA verification failed', isLoading: false });
      return false;
    }
  },

  logout: async () => {
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
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      [{ text: 'OK' }]
    );
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const hasTokens = await initializeSDK();
      if (!hasTokens) {
        set({ isLoading: false, isAuthenticated: false });
        return false;
      }

      // Get current user profile to validate token
      const user = await auth.getCurrentUser();
      if (user) {
        set({
          user: user as User,
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
      await clearTokens();
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
  },

  setUser: (user) => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },

  clearSessionExpired: () => {
    set({ sessionExpired: false });
  },
}));

// Register the session expired callback after store is created
setOnUnauthorizedCallback(() => {
  useAuthStore.getState().handleSessionExpired();
});

export default useAuthStore;
