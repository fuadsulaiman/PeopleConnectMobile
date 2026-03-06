/**
 * Presence Store - Tracks online/offline status of users via SignalR
 * Uses a plain object instead of Set for proper React reactivity
 */

import { create } from 'zustand';

interface PresenceState {
  // Map of userId -> online status (using object for proper reactivity)
  onlineUsers: Record<string, boolean>;

  // Version counter to force re-renders when presence changes
  version: number;

  // Actions
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setMultipleUsersOnline: (userIds: string[]) => void;
  isUserOnline: (userId: string) => boolean;
  clearPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: {},
  version: 0,

  setUserOnline: (userId: string) => {
    set((state) => {
      // Skip if already online
      if (state.onlineUsers[userId]) {
        return state;
      }

      console.log(`[PresenceStore] User ${userId} is now ONLINE`);
      return {
        onlineUsers: { ...state.onlineUsers, [userId]: true },
        version: state.version + 1,
      };
    });
  },

  setUserOffline: (userId: string) => {
    set((state) => {
      // Skip if not in the list
      if (!state.onlineUsers[userId]) {
        return state;
      }

      console.log(`[PresenceStore] User ${userId} is now OFFLINE`);
      const { [userId]: _, ...rest } = state.onlineUsers;
      return {
        onlineUsers: rest,
        version: state.version + 1,
      };
    });
  },

  setMultipleUsersOnline: (userIds: string[]) => {
    set((state) => {
      const newOnlineUsers: Record<string, boolean> = {};
      userIds.forEach((userId) => {
        if (userId) {
          newOnlineUsers[userId] = true;
        }
      });
      console.log(`[PresenceStore] Set ${userIds.length} users as ONLINE`);
      return {
        onlineUsers: newOnlineUsers,
        version: state.version + 1,
      };
    });
  },

  isUserOnline: (userId: string) => {
    return !!get().onlineUsers[userId];
  },

  clearPresence: () => {
    set({ onlineUsers: {}, version: 0 });
  },
}));

export default usePresenceStore;
