import { create } from 'zustand';
import { config } from '../constants';

interface PublicGeneralSettings {
  siteName: string;
  siteLogo?: string;
  timezone: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

interface PublicMessagingSettings {
  maxMessageLength: number;
  maxAttachmentSize: number;
  allowedFileTypes: string[];
  enableViewOnceMessage?: boolean;
}

interface PublicCallSettings {
  maxCallDuration: number;
  enableVoiceCalls: boolean;
  enableVideoCalls: boolean;
}

interface PublicSettings {
  general: PublicGeneralSettings;
  messaging?: PublicMessagingSettings;
  calls?: PublicCallSettings;
}

interface SettingsState {
  publicSettings: PublicSettings | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchPublicSettings: () => Promise<void>;
  getSiteName: () => string;
  getSiteLogo: () => string | undefined;
  isViewOnceEnabled: () => boolean;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  publicSettings: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchPublicSettings: async () => {
    const state = get();

    // Return cached data if still valid
    if (state.publicSettings && state.lastFetched) {
      const elapsed = Date.now() - state.lastFetched;
      if (elapsed < CACHE_DURATION) {
        return;
      }
    }

    // Prevent multiple simultaneous fetches
    if (state.isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${config.API_BASE_URL}/settings/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }

      const result = await response.json();

      // Handle wrapped response { success, data } or direct data
      const data = result.data || result;

      set({
        publicSettings: data,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error: any) {
      console.error('Failed to fetch public settings:', error);
      set({
        error: error.message || 'Failed to fetch settings',
        isLoading: false,
      });
    }
  },

  getSiteName: () => {
    const state = get();
    return state.publicSettings?.general?.siteName || 'PeopleConnect';
  },

  getSiteLogo: () => {
    const state = get();
    const logo = state.publicSettings?.general?.siteLogo;
    if (!logo) return undefined;
    // Convert relative URL to absolute if needed
    if (logo.startsWith('http')) return logo;
    const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
    return `${baseUrl}${logo.startsWith('/') ? '' : '/'}${logo}`;
  },
isViewOnceEnabled: () => {    const state = get();    return state.publicSettings?.messaging?.enableViewOnceMessage ?? true;  },
}));

export default useSettingsStore;
