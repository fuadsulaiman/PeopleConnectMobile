import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_COLOR_PROFILE,
  getColorProfile,
  type ColorProfile,
} from '../constants/colorProfiles';
import { config } from '../constants';

interface ThemeColors {
  primary: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentLight: string;
  gradientStart: string;
  gradientEnd: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  divider: string;
  white: string;
  black: string;
  online: string;
  away: string;
  busy: string;
  offline: string;
  info: string;
  // Message bubble colors
  messageBubbleOwn: string;
  messageBubbleOther: string;
  messageTextOwn: string;
  messageTextOther: string;
  // Gray scale for compatibility with existing code
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

interface ThemeState {
  colorProfileId: string;
  colorProfile: ColorProfile;
  colors: ThemeColors;
  isDarkMode: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setColorProfile: (profileId: string) => void;
  setDarkMode: (isDark: boolean) => void;
  fetchAdminColorProfile: () => Promise<void>;
  getColors: () => ThemeColors;
}

// Helper to darken a color
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Helper to lighten a color
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Generate theme colors from a color profile
function generateThemeColors(profile: ColorProfile, isDarkMode: boolean): ThemeColors {
  // Gray scale - same for both light and dark mode
  const gray = {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  };

  if (isDarkMode) {
    return {
      primary: profile.primaryColor,
      primaryDark: darkenColor(profile.primaryColor, 20),
      secondary: profile.secondaryColor,
      secondaryLight: lightenColor(profile.secondaryColor, 20),
      accent: profile.secondaryColor,
      accentLight: lightenColor(profile.secondaryColor, 30),
      gradientStart: profile.gradientStart,
      gradientEnd: profile.gradientEnd,
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#000000',
      surface: '#1C1C1E',
      card: '#2C2C2E',
      text: '#FFFFFF',
      textSecondary: '#8E8E93',
      textTertiary: '#636366',
      border: '#38383A',
      divider: '#48484A',
      white: '#FFFFFF',
      black: '#000000',
      online: '#34C759',
      away: '#FF9500',
      busy: '#FF3B30',
      offline: '#8E8E93',
      info: '#007AFF',
      // Message bubbles - in dark mode
      messageBubbleOwn: profile.primaryColor,
      messageBubbleOther: darkenColor(profile.secondaryColor, 30),
      messageTextOwn: '#FFFFFF',
      messageTextOther: '#FFFFFF',
      gray,
    };
  }

  return {
    primary: profile.primaryColor,
    primaryDark: darkenColor(profile.primaryColor, 15),
    secondary: profile.secondaryColor,
    secondaryLight: lightenColor(profile.secondaryColor, 40),
    accent: profile.secondaryColor,
    accentLight: lightenColor(profile.secondaryColor, 50),
    gradientStart: profile.gradientStart,
    gradientEnd: profile.gradientEnd,
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    textTertiary: '#C7C7CC',
    border: '#E5E5EA',
    divider: '#C6C6C8',
    white: '#FFFFFF',
    black: '#000000',
    online: '#34C759',
    away: '#FF9500',
    busy: '#FF3B30',
    offline: '#8E8E93',
    info: '#007AFF',
    // Message bubbles - in light mode, other's bubble uses a light accent color
    messageBubbleOwn: profile.primaryColor,
    messageBubbleOther: lightenColor(profile.secondaryColor, 45),
    messageTextOwn: '#FFFFFF',
    messageTextOther: darkenColor(profile.secondaryColor, 40),
    gray,
  };
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colorProfileId: DEFAULT_COLOR_PROFILE,
      colorProfile: getColorProfile(DEFAULT_COLOR_PROFILE),
      colors: generateThemeColors(getColorProfile(DEFAULT_COLOR_PROFILE), false),
      isDarkMode: false,
      isLoading: false,
      error: null,

      setColorProfile: (profileId: string) => {
        const profile = getColorProfile(profileId);
        const { isDarkMode } = get();
        set({
          colorProfileId: profileId,
          colorProfile: profile,
          colors: generateThemeColors(profile, isDarkMode),
        });
      },

      setDarkMode: (isDark: boolean) => {
        const { colorProfile } = get();
        set({
          isDarkMode: isDark,
          colors: generateThemeColors(colorProfile, isDark),
        });
      },

      fetchAdminColorProfile: async () => {
        set({ isLoading: true, error: null });
        try {
          // Fetch public settings from the API
          const response = await fetch(`${config.API_BASE_URL}/settings/public`);
          if (!response.ok) {
            throw new Error('Failed to fetch settings');
          }
          const data = await response.json();

          // Extract color profile from settings
          const profileId =
            data?.data?.design?.colorProfile || data?.design?.colorProfile || DEFAULT_COLOR_PROFILE;

          const profile = getColorProfile(profileId);
          const { isDarkMode } = get();

          set({
            colorProfileId: profileId,
            colorProfile: profile,
            colors: generateThemeColors(profile, isDarkMode),
            isLoading: false,
          });

          console.log(`[ThemeStore] Loaded admin color profile: ${profileId}`);
        } catch (error) {
          console.error('[ThemeStore] Failed to fetch admin color profile:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },

      getColors: () => get().colors,
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        colorProfileId: state.colorProfileId,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
);

export default useThemeStore;
