import { useAuthStore } from '../../../src/stores/authStore';

// Mock the SDK services
jest.mock('../../../src/services/sdk', () => ({
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    verify2FA: jest.fn(),
  },
  initializeSDK: jest.fn(),
  storeTokens: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
  getStoredTokens: jest.fn(() => Promise.resolve(null)),
  setOnUnauthorizedCallback: jest.fn(),
}));

jest.mock('../../../src/services/signalr', () => ({
  signalRService: {
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
  },
}));

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      requiresTwoFactor: false,
      tempToken: null,
      sessionExpired: false,
    });
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with null user', () => {
      const { user, isAuthenticated } = useAuthStore.getState();
      expect(user).toBeNull();
      expect(isAuthenticated).toBe(false);
    });

    it('should initialize with isLoading as false', () => {
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should initialize with no error', () => {
      const { error } = useAuthStore.getState();
      expect(error).toBeNull();
    });

    it('should initialize with requiresTwoFactor as false', () => {
      const { requiresTwoFactor } = useAuthStore.getState();
      expect(requiresTwoFactor).toBe(false);
    });

    it('should initialize with sessionExpired as false', () => {
      const { sessionExpired } = useAuthStore.getState();
      expect(sessionExpired).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user correctly', () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@test.com',
        displayName: 'Test User',
      };

      useAuthStore.getState().setUser(mockUser);

      const { user } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
    });

    it('should handle user with optional fields', () => {
      const mockUser = {
        id: '2',
        username: 'testuser2',
        email: 'test2@test.com',
        displayName: 'Test User 2',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        statusMessage: 'Available',
        isOnline: true,
      };

      useAuthStore.getState().setUser(mockUser);

      const { user } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
      expect(user?.avatarUrl).toBe('https://example.com/avatar.png');
      expect(user?.bio).toBe('Test bio');
      expect(user?.isOnline).toBe(true);
    });
  });

  describe('updateUser', () => {
    it('should update user fields partially', () => {
      const initialUser = {
        id: '1',
        username: 'testuser',
        email: 'test@test.com',
        displayName: 'Test User',
      };

      useAuthStore.getState().setUser(initialUser);
      useAuthStore.getState().updateUser({ displayName: 'Updated Name' });

      const { user } = useAuthStore.getState();
      expect(user?.displayName).toBe('Updated Name');
      expect(user?.username).toBe('testuser'); // Should remain unchanged
    });

    it('should not update if user is null', () => {
      useAuthStore.getState().updateUser({ displayName: 'New Name' });

      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should update multiple fields at once', () => {
      const initialUser = {
        id: '1',
        username: 'testuser',
        email: 'test@test.com',
      };

      useAuthStore.getState().setUser(initialUser);
      useAuthStore.getState().updateUser({
        displayName: 'New Display Name',
        bio: 'New bio',
        avatarUrl: 'https://new-avatar.com/img.png',
      });

      const { user } = useAuthStore.getState();
      expect(user?.displayName).toBe('New Display Name');
      expect(user?.bio).toBe('New bio');
      expect(user?.avatarUrl).toBe('https://new-avatar.com/img.png');
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error message' });
      expect(useAuthStore.getState().error).toBe('Some error message');

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('clearSessionExpired', () => {
    it('should clear sessionExpired state', () => {
      useAuthStore.setState({ sessionExpired: true });
      expect(useAuthStore.getState().sessionExpired).toBe(true);

      useAuthStore.getState().clearSessionExpired();
      expect(useAuthStore.getState().sessionExpired).toBe(false);
    });
  });

  describe('login', () => {
    const { auth, storeTokens } = require('../../../src/services/sdk');
    const { signalRService } = require('../../../src/services/signalr');

    it('should set isLoading to true during login', async () => {
      auth.login.mockImplementation(() => new Promise(() => {})); // Never resolves

      const loginPromise = useAuthStore.getState().login('user', 'pass');

      // Check loading state immediately
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Clean up
      auth.login.mockReset();
    });

    it('should handle successful login', async () => {
      const mockResponse = {
        user: {
          id: '123',
          username: 'testuser',
          email: 'test@test.com',
          name: 'Test User',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      auth.login.mockResolvedValue(mockResponse);
      storeTokens.mockResolvedValue(undefined);
      signalRService.connect.mockResolvedValue(undefined);

      const result = await useAuthStore.getState().login('testuser', 'password123');

      expect(result).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.username).toBe('testuser');
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(storeTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
      expect(signalRService.connect).toHaveBeenCalled();
    });

    it('should handle 2FA required response', async () => {
      const mockResponse = {
        requiresTwoFactor: true,
        userId: 'temp-user-id',
      };

      auth.login.mockResolvedValue(mockResponse);

      const result = await useAuthStore.getState().login('testuser', 'password123');

      expect(result).toBe(false);
      expect(useAuthStore.getState().requiresTwoFactor).toBe(true);
      expect(useAuthStore.getState().tempToken).toBe('temp-user-id');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should handle login failure', async () => {
      auth.login.mockRejectedValue(new Error('Invalid credentials'));

      const result = await useAuthStore.getState().login('testuser', 'wrongpassword');

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBeTruthy();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    const { clearTokens } = require('../../../src/services/sdk');
    const { signalRService } = require('../../../src/services/signalr');

    beforeEach(() => {
      // Set up authenticated state
      useAuthStore.setState({
        user: { id: '1', username: 'test', email: 'test@test.com' },
        isAuthenticated: true,
      });
    });

    it('should clear user state on logout', async () => {
      clearTokens.mockResolvedValue(undefined);
      signalRService.disconnect.mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should disconnect SignalR on logout', async () => {
      clearTokens.mockResolvedValue(undefined);
      signalRService.disconnect.mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(signalRService.disconnect).toHaveBeenCalled();
    });

    it('should clear tokens on logout', async () => {
      clearTokens.mockResolvedValue(undefined);
      signalRService.disconnect.mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      expect(clearTokens).toHaveBeenCalled();
    });
  });
});
