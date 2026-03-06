import { create } from 'zustand';

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern instead - SDK is loaded only when needed
type CallsService = {
  getHistory: () => Promise<any>;
  initiate: (params: { targetUserId: string; type: string }) => Promise<any>;
};

const getCallsService = (): CallsService => {
  const sdk = require('../services/sdk');
  return sdk.calls;
};

const getSignalRService = () => {
  const signalr = require('../services/signalr');
  return signalr.signalRService;
};

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
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  setIncomingCall: (call: Call) => void;
  setCallConnected: () => void;
  addMissedCall: (call: Partial<Call>) => void;
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
      const calls = getCallsService();
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
      const calls = getCallsService();
      const signalRService = getSignalRService();
      const callConfig = await calls.initiate({ targetUserId: user.id, type });
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
      await signalRService.initiateCall(user.id, type);
    } catch (error: any) {
      set({ error: error.message || 'Failed to initiate call', isLoading: false });
    }
  },

  answerCall: async () => {
    const { currentCall } = get();
    if (!currentCall) {
      return;
    }
    set({ callState: 'connecting' });
    try {
      const signalRService = getSignalRService();
      await signalRService.answerCall(currentCall.id);
      set({ callState: 'connected' });
    } catch (error: any) {
      set({ error: error.message || 'Failed to answer call', callState: 'idle' });
    }
  },

  acceptCall: async () => {
    return get().answerCall();
  },

  rejectCall: async () => {
    const { currentCall } = get();
    if (!currentCall) {
      return;
    }
    try {
      const signalRService = getSignalRService();
      await signalRService.rejectCall(currentCall.id);
    } catch (e) {
      console.error('Failed to reject call:', e);
    } finally {
      set({ currentCall: null, callState: 'idle' });
    }
  },

  endCall: async () => {
    const { currentCall } = get();
    if (!currentCall) {
      return;
    }
    try {
      const signalRService = getSignalRService();
      await signalRService.endCall(currentCall.id);
    } catch (e) {
      console.error('Failed to end call:', e);
    } finally {
      set({ currentCall: null, callState: 'ended' });
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
    set({ currentCall: call, callState: 'incoming', isVideoEnabled: call.type === 'video' });
  },
  setCallConnected: () => {
    set({ callState: 'connected' });
  },

  addMissedCall: (call) => {
    const missedCall: Call = {
      id: call.id || '',
      callerId: call.callerId || '',
      calleeId: call.calleeId || '',
      caller: call.caller,
      callee: call.callee,
      type: call.type || 'voice',
      status: 'missed',
      startedAt: call.startedAt || new Date().toISOString(),
      endedAt: call.endedAt,
      duration: call.duration,
    };
    set((state) => ({ callHistory: [missedCall, ...state.callHistory] }));
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
