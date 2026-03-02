import { create } from "zustand";
import { contacts } from "../services/sdk";

interface ContactUser {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  status?: string;
}

interface Contact {
  id: string;
  userId: string;
  user: ContactUser;
  nickname?: string;
  createdAt?: string;
}

interface ContactRequest {
  id: string;
  senderId: string;
  receiverId: string;
  sender?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  status: string;
  createdAt: string;
}

interface ContactsState {
  contacts: Contact[];
  pendingRequests: ContactRequest[];
  requests: ContactRequest[];
  searchResults: Contact[];
  blockedUsers: Contact[];
  isLoading: boolean;
  error: string | null;

  fetchContacts: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeContact: (contactId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<Contact[]>;
  clearSearch: () => void;
  updateContactPresence: (userId: string, isOnline: boolean) => void;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  pendingRequests: [],
  requests: [],
  searchResults: [],
  blockedUsers: [],
  isLoading: false,
  error: null,

  fetchContacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await contacts.list();
      const contactList = Array.isArray(result) ? result : (result as any).items || [];
      const mappedContacts = contactList.map((c: any) => ({
        id: c.id,
        userId: c.userId || c.contactUser?.id,
        user: {
          id: c.contactUser?.id || c.userId,
          name: c.contactUser?.name || c.displayName || c.name || "",
          username: c.contactUser?.username || c.username || "",
          avatarUrl: c.contactUser?.avatarUrl || c.avatarUrl,
          status: c.contactUser?.status || c.status,
        },
        nickname: c.nickname,
        createdAt: c.createdAt,
      }));
      set({ contacts: mappedContacts as Contact[], isLoading: false });
    } catch (error: any) {
      set({ error: error.message || "Failed to fetch contacts", isLoading: false });
    }
  },

  fetchPendingRequests: async () => {
    try {
      const result = await contacts.getRequests();
      const received = (result as any)?.received || [];
      set({ pendingRequests: received as ContactRequest[], requests: received as ContactRequest[] });
    } catch (error: any) {
      console.error("Failed to fetch pending requests:", error);
    }
  },

  fetchRequests: async () => {
    return get().fetchPendingRequests();
  },

  fetchBlockedUsers: async () => {
    try {
      const result = await contacts.getBlocked();
      const blocked = Array.isArray(result) ? result : (result as any).items || [];
      set({ blockedUsers: blocked as Contact[] });
    } catch (error: any) {
      console.error("Failed to fetch blocked users:", error);
    }
  },

  sendRequest: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      await contacts.sendRequest(userId);
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message || "Failed to send request", isLoading: false });
      throw error;
    }
  },

  acceptRequest: async (requestId) => {
    try {
      const newContact = await contacts.acceptRequest(requestId);
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
        requests: state.requests.filter((r) => r.id !== requestId),
        contacts: [...state.contacts, newContact as unknown as Contact],
      }));
    } catch (error: any) {
      set({ error: error.message || "Failed to accept request" });
      throw error;
    }
  },

  rejectRequest: async (requestId) => {
    try {
      await contacts.rejectRequest(requestId);
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
        requests: state.requests.filter((r) => r.id !== requestId),
      }));
    } catch (error: any) {
      set({ error: error.message || "Failed to reject request" });
      throw error;
    }
  },

  removeContact: async (contactId) => {
    try {
      await contacts.remove(contactId);
      set((state) => ({ contacts: state.contacts.filter((c) => c.id !== contactId) }));
    } catch (error: any) {
      set({ error: error.message || "Failed to remove contact" });
      throw error;
    }
  },

  blockUser: async (userId) => {
    try {
      await contacts.block(userId);
      const blockedUser = get().contacts.find((c) => c.user.id?.toLowerCase() === userId?.toLowerCase() || c.userId?.toLowerCase() === userId?.toLowerCase());
      set((state) => ({
        contacts: state.contacts.filter((c) => c.user.id !== userId && c.userId !== userId),
        blockedUsers: blockedUser ? [...state.blockedUsers, blockedUser] : state.blockedUsers,
      }));
    } catch (error: any) {
      set({ error: error.message || "Failed to block user" });
      throw error;
    }
  },

  unblockUser: async (userId) => {
    try {
      await contacts.unblock(userId);
      set((state) => ({
        blockedUsers: state.blockedUsers.filter((u) => u.user.id !== userId && u.userId !== userId),
      }));
    } catch (error: any) {
      set({ error: error.message || "Failed to unblock user" });
      throw error;
    }
  },

  searchUsers: async (query) => {
    try {
      const result = await contacts.searchUsers(query);
      const users = Array.isArray(result) ? result : [];
      const mappedResults = users.map((u: any) => ({
        id: u.id,
        userId: u.id,
        user: { id: u.id, name: u.name || "", username: u.username || "", avatarUrl: u.avatarUrl, status: u.status },
      })) as Contact[];
      set({ searchResults: mappedResults });
      return mappedResults;
    } catch (error: any) {
      console.error("Failed to search users:", error);
      return [];
    }
  },

  clearSearch: () => { set({ searchResults: [] }); },

  updateContactPresence: (userId, isOnline) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.user.id?.toLowerCase() === userId?.toLowerCase() || c.userId?.toLowerCase() === userId?.toLowerCase()
          ? { ...c, user: { ...c.user, status: isOnline ? "Online" : "Offline" } }
          : c
      ),
    }));
  },
}));

export default useContactsStore;
