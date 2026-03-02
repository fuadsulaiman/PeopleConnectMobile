import { create } from 'zustand';
import { calls } from '../services/sdk';
import { signalRService } from '../services/signalr';

type CallState = 'idle' | 'incoming' | 'connecting' | 'ringing' | 'connected' | 'ended';
type CallType = 'voice' | 'video';

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  caller?: User;
  callee?: User;
  type: CallType;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
}

interface CallStoreState {
  currentCall: Call | null;
  callState: CallState;
  callHistory: Call[];
  isLoading: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
  error: string | null;

  fetchCallHistory: () => Promise<void>;
  initiateCall: (user: User, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  setIncomingCall: (call: Call) => void;
  clearCall: () => void;
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  currentCall: null,
  callState: 'idle',
  callHistory: [],
  isLoading: false,
  isMuted: false,
  isSpeakerOn: false,
  isVideoEnabled: true,
  error: null,

  fetchCallHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await calls.getHistory();
      const history = Array.isArray(result) ? result : (result as any).items || [];
      set({ callHistory: history as Call[], isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch call history', isLoading: false });
    }
  },

  initiateCall: async (user, type) => {
    set({ isLoading: true, error: null });
    try {
      // Get WebRTC token/config
      const callConfig = await calls.initiateCall({
        calleeId: user.id,
        type,
      });

      set({
        currentCall: {
          id: (callConfig as any).callId || '',
          callerId: '',
          calleeId: user.id,
          callee: user,
          type,
          status: 'Initiating',
          startedAt: new Date().toISOString(),
        },
        callState: 'ringing',
        isLoading: false,
        isVideoEnabled: type === 'video',
      });

      // Signal via SignalR
      await signalRService.initiateCall(user.id, type);
    } catch (error: any) {
      set({ error: error.message || 'Failed to initiate call', isLoading: false });
    }
  },

  answerCall: async () => {
    const { currentCall } = get();
    if (!currentCall) return;

    set({ callState: 'connecting' });
    try {
      await signalRService.answerCall(currentCall.id);
      set({ callState: 'connected' });
    } catch (error: any) {
      set({ error: error.message || 'Failed to answer call', callState: 'idle' });
    }
  },

  rejectCall: async () => {
    const { currentCall } = get();
    if (!currentCall) return;

    try {
      await signalRService.rejectCall(currentCall.id);
    } catch (error) {
      console.error('Failed to reject call:', error);
    } finally {
      set({ currentCall: null, callState: 'idle' });
    }
  },

  endCall: async () => {
    const { currentCall } = get();
    if (!currentCall) return;

    try {
      await signalRService.endCall(currentCall.id);
    } catch (error) {
      console.error('Failed to end call:', error);
    } finally {
      set({ currentCall: null, callState: 'ended' });
      // Reset to idle after a short delay
      setTimeout(() => set({ callState: 'idle' }), 1000);
    }
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  toggleVideo: () => {
    set((state) => ({ isVideoEnabled: !state.isVideoEnabled }));
  },

  setIncomingCall: (call) => {
    set({
      currentCall: call,
      callState: 'incoming',
      isVideoEnabled: call.type === 'video',
    });
  },

  clearCall: () => {
    set({
      currentCall: null,
      callState: 'idle',
      isMuted: false,
      isSpeakerOn: false,
      isVideoEnabled: true,
    });
  },
}));

export default useCallStore;
