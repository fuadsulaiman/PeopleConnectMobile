// Import stores explicitly to ensure proper module loading order
import { useAuthStore } from './authStore';
import { useChatStore } from './chatStore';
import { useCallStore } from './callStore';
import { useContactsStore } from './contactsStore';
import { usePresenceStore } from './presenceStore';
import { useSettingsStore } from './settingsStore';
import { useThemeStore } from './themeStore';

// Re-export all stores
export {
  useAuthStore,
  useChatStore,
  useCallStore,
  useContactsStore,
  usePresenceStore,
  useSettingsStore,
  useThemeStore,
};
