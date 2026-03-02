// @ts-nocheck
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCSessionDescriptionType,
  RTCIceCandidateType,
} from 'react-native-webrtc';
import { signalRService } from './signalr';
import { calls } from './sdk';
import InCallManager from 'react-native-incall-manager';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallState {
  callId: string;
  type: 'voice' | 'video';
  status: 'connecting' | 'ringing' | 'connected' | 'ended';
  isInitiator: boolean;
  remoteUserId: string;
  remoteUserName?: string;
  remoteUserAvatar?: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  startTime?: Date;
  conversationId?: string;
}

export type WebRTCEventCallback = {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallStateChange?: (state: CallState) => void;
  onError?: (error: Error) => void;
  onCallEnded?: (reason?: string) => void;
};

// Default STUN servers as fallback
const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callState: CallState | null = null;
  private callbacks: WebRTCEventCallback = {};
  private iceServers: IceServer[] = DEFAULT_ICE_SERVERS;
  private pendingIceCandidates: RTCIceCandidateType[] = [];
  private callEventUnsubscribers: (() => void)[] = [];
  private isMuted: boolean = false;
  private isVideoEnabled: boolean = true;
  private isSpeakerOn: boolean = false;
  private isFrontCamera: boolean = true;

  setCallbacks(callbacks: WebRTCEventCallback): void {
    this.callbacks = callbacks;
  }

  setIceServers(servers: IceServer[]): void {
    this.iceServers = servers.length > 0 ? servers : DEFAULT_ICE_SERVERS;
  }

  // Fetch ICE servers from backend
  async fetchIceServers(): Promise<void> {
    try {
      const response = await calls.getIceServers();
      if (response && Array.isArray(response)) {
        this.iceServers = response.length > 0 ? response : DEFAULT_ICE_SERVERS;
        console.log('[WebRTC] Fetched ICE servers:', this.iceServers.length);
      }
    } catch (error) {
      console.warn('[WebRTC] Failed to fetch ICE servers, using defaults:', error);
    }
  }

  // Clean up any existing resources before starting a new call
  private cleanup(): void {
    console.log('[WebRTC] Cleaning up...');

    // Stop InCallManager
    InCallManager.stop();

    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
        console.log('[WebRTC] Stopped local track:', track.kind);
      });
      this.localStream = null;
    }

    // Stop all remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
        console.log('[WebRTC] Stopped remote track:', track.kind);
      });
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('[WebRTC] Closed peer connection');
    }

    this.pendingIceCandidates = [];

    // Clean up SignalR handlers
    this.callEventUnsubscribers.forEach(unsub => unsub());
    this.callEventUnsubscribers = [];

    // Reset state
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.isSpeakerOn = false;
    this.isFrontCamera = true;
  }

  async initializeCall(
    callId: string,
    type: 'voice' | 'video',
    isInitiator: boolean,
    remoteUserId: string,
    remoteUserName?: string,
    remoteUserAvatar?: string,
    conversationId?: string
  ): Promise<void> {
    // Clean up any existing call first
    this.cleanup();

    this.callState = {
      callId,
      type,
      status: 'connecting',
      isInitiator,
      remoteUserId,
      remoteUserName,
      remoteUserAvatar,
      conversationId,
    };

    this.isVideoEnabled = type === 'video';
    this.updateCallState({ status: 'connecting' });

    // Start InCallManager
    InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
    InCallManager.setKeepScreenOn(true);

    // Setup SignalR handlers BEFORE getting media, so we do not miss events
    this.setupSignalRHandlers();

    // Fetch ICE servers from backend
    await this.fetchIceServers();

    // Get local media stream
    try {
      console.log('[WebRTC] Requesting media devices...');
      this.localStream = await this.getMediaStream(type);
      console.log('[WebRTC] Got local stream with tracks:',
        this.localStream.getTracks().map((t: MediaStreamTrack) => t.kind).join(', '));

      this.callState.localStream = this.localStream;
      this.callbacks.onLocalStream?.(this.localStream);
    } catch (error) {
      console.error('[WebRTC] Failed to get media:', error);
      this.cleanup();

      let errorMessage = 'Failed to access media devices';
      if (error instanceof Error) {
        if (error.name === 'NotReadableError') {
          errorMessage = 'Microphone/camera is being used by another application.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Permission denied. Please allow access to microphone/camera.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone or camera found.';
        }
      }

      this.callbacks.onError?.(new Error(errorMessage));
      throw error;
    }

    // Create peer connection
    this.createPeerConnection();

    // Add local tracks to peer connection
    this.localStream.getTracks().forEach((track: MediaStreamTrack) => {
      console.log('[WebRTC] Adding local track to peer connection:', track.kind);
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // If initiator, wait for call to be accepted before sending offer
    if (isInitiator) {
      this.updateCallState({ status: 'ringing' });
      console.log('[WebRTC] Waiting for call to be accepted before sending offer...');
    }
  }

  private async getMediaStream(type: 'voice' | 'video'): Promise<MediaStream> {
    const constraints = {
      audio: true,
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: this.isFrontCamera ? 'user' : 'environment',
        frameRate: { ideal: 30 },
      } : false,
    };

    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      return stream as MediaStream;
    } catch (error) {
      // If video fails, try audio only for video calls
      if (type === 'video' && error instanceof Error && error.name !== 'NotAllowedError') {
        console.warn('[WebRTC] Video failed, trying audio only:', error);
        const audioOnlyStream = await mediaDevices.getUserMedia({ audio: true, video: false });
        return audioOnlyStream as MediaStream;
      }
      throw error;
    }
  }

  private createPeerConnection(): void {
    const config = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    };

    console.log('[WebRTC] Creating peer connection with', this.iceServers.length, 'ICE servers');
    this.peerConnection = new RTCPeerConnection(config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event: any) => {
      try {
        if (event.candidate) {
          const candidateStr = event.candidate.candidate || '(empty)';
          console.log('[WebRTC] Local ICE candidate generated:', candidateStr.substring(0, 50));

          if (this.callState) {
            const candidateJson = {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            };
            console.log('[WebRTC] Sending ICE candidate via SignalR...');
            signalRService.sendIceCandidate(this.callState.callId, candidateJson)
              .then(() => console.log('[WebRTC] ICE candidate sent'))
              .catch((err) => console.error('[WebRTC] Failed to send ICE candidate:', err));
          }
        } else {
          console.log('[WebRTC] ICE gathering complete');
        }
      } catch (err) {
        console.error('[WebRTC] Error in onicecandidate handler:', err);
      }
    };

    // Handle ICE gathering state changes
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', (this.peerConnection as any)?.iceGatheringState);
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', (this.peerConnection as any)?.connectionState);
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = (this.peerConnection as any)?.iceConnectionState;
      console.log('[WebRTC] ICE connection state:', state);

      if (state === 'connected' || state === 'completed') {
        console.log('[WebRTC] Connection successful!');
        this.updateCallState({ status: 'connected', startTime: new Date() });
      } else if (state === 'failed') {
        console.error('[WebRTC] ICE connection failed');
        this.callbacks.onError?.(new Error('Connection failed - check your network'));
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] ICE connection disconnected');
      }
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', (this.peerConnection as any)?.signalingState);
    };

    // Handle remote tracks
    this.peerConnection.ontrack = (event: any) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      console.log('[WebRTC] Track state - enabled:', event.track.enabled, 'readyState:', event.track.readyState);

      // Track unmute event
      const track = event.track;
      track.onunmute = () => {
        console.log('[WebRTC] Track UNMUTED:', track.kind);
        if (this.remoteStream && this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      };

      // Use the stream from the event if available
      if (event.streams && event.streams.length > 0 && event.streams[0]) {
        this.remoteStream = event.streams[0] as MediaStream;
        console.log('[WebRTC] Using stream from event');
      } else {
        // Fallback: create a new stream and add the track
        console.log('[WebRTC] No stream in event, creating new MediaStream');
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        const existingTrack = this.remoteStream.getTracks().find((t: MediaStreamTrack) => t.id === event.track.id);
        if (!existingTrack) {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (this.callState) {
        this.callState.remoteStream = this.remoteStream;
      }

      this.callbacks.onRemoteStream?.(this.remoteStream);

      if (this.callState && this.callState.status === 'connecting') {
        console.log('[WebRTC] Remote track received while connecting - transitioning to connected');
        this.updateCallState({ status: 'connected', startTime: new Date() });
      }
    };

    console.log('[WebRTC] Peer connection created successfully');
  }

  private setupSignalRHandlers(): void {
    // Clean up any existing handlers
    this.callEventUnsubscribers.forEach(unsub => unsub());
    this.callEventUnsubscribers = [];

    // Handle call accepted - initiator should send offer now
    const callAcceptedUnsub = signalRService.onCallEvent('CallAnswered', async (data: any) => {
      console.log('[WebRTC] CallAnswered event received:', data);
      if (data.callId === this.callState?.callId && this.callState?.isInitiator) {
        console.log('[WebRTC] Call accepted, creating and sending SDP offer...');
        try {
          await this.createAndSendOffer();
        } catch (error) {
          console.error('[WebRTC] Failed to create/send offer:', error);
        }
      }
    });
    this.callEventUnsubscribers.push(callAcceptedUnsub);

    // Handle ICE candidates
    const iceCandidateUnsub = signalRService.onCallEvent('IceCandidate', async (data: any) => {
      console.log('[WebRTC] Received remote ICE candidate');
      if (data.callId === this.callState?.callId) {
        await this.handleRemoteIceCandidate(data.candidate);
      }
    });
    this.callEventUnsubscribers.push(iceCandidateUnsub);

    // Handle SDP offers (for callee)
    const sdpOfferUnsub = signalRService.onCallEvent('SdpOffer', async (data: any) => {
      if (data.callId === this.callState?.callId && !this.callState?.isInitiator) {
        console.log('[WebRTC] Received SDP offer (as callee)');
        await this.handleRemoteOffer(data.sdp);
      }
    });
    this.callEventUnsubscribers.push(sdpOfferUnsub);

    // Handle SDP answers (for initiator)
    const sdpAnswerUnsub = signalRService.onCallEvent('SdpAnswer', async (data: any) => {
      if (data.callId === this.callState?.callId && this.callState?.isInitiator) {
        console.log('[WebRTC] Received SDP answer (as initiator)');
        await this.handleRemoteAnswer(data.sdp);
      }
    });
    this.callEventUnsubscribers.push(sdpAnswerUnsub);

    // Handle call ended
    const callEndedUnsub = signalRService.onCallEvent('CallEnded', (data: any) => {
      if (data.callId === this.callState?.callId) {
        console.log('[WebRTC] Call ended event received:', data.reason);
        this.endCall(data.reason);
      }
    });
    this.callEventUnsubscribers.push(callEndedUnsub);

    // Handle call rejected
    const callRejectedUnsub = signalRService.onCallEvent('CallRejected', (data: any) => {
      console.log('[WebRTC] Call rejected event:', data);
      if (data.callId === this.callState?.callId) {
        this.endCall(data.reason || 'Call rejected');
      }
    });
    this.callEventUnsubscribers.push(callRejectedUnsub);
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.callState) return;

    try {
      console.log('[WebRTC] Creating SDP offer...');
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callState.type === 'video',
      };

      const offer = await this.peerConnection.createOffer(offerOptions);
      console.log('[WebRTC] SDP offer created, setting local description...');

      await this.peerConnection.setLocalDescription(offer as RTCSessionDescription);
      console.log('[WebRTC] Local description set');

      console.log('[WebRTC] Sending SDP offer via SignalR...');
      await signalRService.sendSdpOffer(this.callState.callId, {
        type: offer.type,
        sdp: offer.sdp,
      });
      console.log('[WebRTC] SDP offer sent to remote peer');

      this.updateCallState({ status: 'connecting' });
    } catch (error) {
      console.error('[WebRTC] Failed to create/send offer:', error);
      this.callbacks.onError?.(new Error('Failed to create offer'));
      throw error;
    }
  }

  private async handleRemoteOffer(sdp: RTCSessionDescriptionType): Promise<void> {
    if (!this.peerConnection) return;

    const signalingState = (this.peerConnection as any)?.signalingState;
    console.log('[WebRTC] Handling remote offer, current signaling state:', signalingState);

    if (signalingState !== 'stable') {
      console.warn('[WebRTC] Ignoring SDP offer - not in stable state');
      return;
    }

    try {
      console.log('[WebRTC] Setting remote description (offer)...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[WebRTC] Remote description set');

      // Process any pending ICE candidates
      console.log('[WebRTC] Processing', this.pendingIceCandidates.length, 'pending ICE candidates');
      for (const candidate of this.pendingIceCandidates) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] Added pending ICE candidate');
      }
      this.pendingIceCandidates = [];

      // Create and send answer
      console.log('[WebRTC] Creating SDP answer...');
      const answer = await this.peerConnection.createAnswer();

      console.log('[WebRTC] Setting local description (answer)...');
      await this.peerConnection.setLocalDescription(answer as RTCSessionDescription);
      console.log('[WebRTC] Local description set');

      if (this.callState) {
        console.log('[WebRTC] Sending SDP answer via SignalR...');
        await signalRService.sendSdpAnswer(this.callState.callId, {
          type: answer.type,
          sdp: answer.sdp,
        });
        console.log('[WebRTC] SDP answer sent to remote peer');
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle remote offer:', error);
      this.callbacks.onError?.(new Error('Failed to handle remote offer'));
      throw error;
    }
  }

  private async handleRemoteAnswer(sdp: RTCSessionDescriptionType): Promise<void> {
    if (!this.peerConnection) return;

    const signalingState = (this.peerConnection as any)?.signalingState;
    console.log('[WebRTC] Handling remote answer, current signaling state:', signalingState);

    if (signalingState !== 'have-local-offer') {
      console.warn('[WebRTC] Ignoring SDP answer - not in have-local-offer state');
      return;
    }

    try {
      console.log('[WebRTC] Setting remote description (answer)...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[WebRTC] Remote description set');

      // Process any pending ICE candidates
      console.log('[WebRTC] Processing', this.pendingIceCandidates.length, 'pending ICE candidates');
      for (const candidate of this.pendingIceCandidates) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] Added pending ICE candidate');
      }
      this.pendingIceCandidates = [];
    } catch (error) {
      console.error('[WebRTC] Failed to handle remote answer:', error);
      this.callbacks.onError?.(new Error('Failed to handle remote answer'));
      throw error;
    }
  }

  private async handleRemoteIceCandidate(candidate: RTCIceCandidateType): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const remoteDesc = (this.peerConnection as any)?.remoteDescription;
      if (remoteDesc) {
        console.log('[WebRTC] Adding remote ICE candidate immediately');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] Remote ICE candidate added successfully');
      } else {
        console.log('[WebRTC] Queuing ICE candidate (no remote description yet)');
        this.pendingIceCandidates.push(candidate);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  private updateCallState(updates: Partial<CallState>): void {
    if (this.callState) {
      this.callState = { ...this.callState, ...updates };
      this.callbacks.onCallStateChange?.(this.callState);
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return this.isMuted;

    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.isMuted = !this.isMuted;
      audioTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = !this.isMuted;
      });
      console.log('[WebRTC] Mute toggled:', this.isMuted);
    }
    return this.isMuted;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return !this.isVideoEnabled;

    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      this.isVideoEnabled = !this.isVideoEnabled;
      videoTracks.forEach((track: MediaStreamTrack) => {
        track.enabled = this.isVideoEnabled;
      });
      console.log('[WebRTC] Video toggled:', this.isVideoEnabled);
    }
    return !this.isVideoEnabled;
  }

  toggleSpeaker(): boolean {
    this.isSpeakerOn = !this.isSpeakerOn;
    InCallManager.setSpeakerphoneOn(this.isSpeakerOn);
    console.log('[WebRTC] Speaker toggled:', this.isSpeakerOn);
    return this.isSpeakerOn;
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    try {
      this.isFrontCamera = !this.isFrontCamera;

      // Stop current video track
      videoTracks.forEach((track: MediaStreamTrack) => track.stop());

      // Get new video track with new facing mode
      const newStream = await mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: this.isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }) as MediaStream;

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Replace track in local stream
        this.localStream.removeTrack(videoTracks[0]);
        this.localStream.addTrack(newVideoTrack);

        // Replace track in peer connection
        const sender = this.peerConnection?.getSenders().find(
          (s: any) => s.track?.kind === 'video'
        );
        if (sender) {
          await (sender as any).replaceTrack(newVideoTrack);
        }

        // Notify callback
        this.callbacks.onLocalStream?.(this.localStream);
        console.log('[WebRTC] Camera switched to:', this.isFrontCamera ? 'front' : 'back');
      }
    } catch (error) {
      console.error('[WebRTC] Failed to switch camera:', error);
      this.isFrontCamera = !this.isFrontCamera; // Revert
    }
  }

  endCall(reason?: string): void {
    console.log('[WebRTC] Ending call:', reason);

    if (this.callState && !reason) {
      // Notify other party via SignalR
      signalRService.endCall(this.callState.callId).catch(err =>
        console.error('[WebRTC] Failed to send end call signal:', err)
      );
    }

    this.updateCallState({ status: 'ended' });
    this.callbacks.onCallEnded?.(reason);

    this.cleanup();
    this.callState = null;
  }

  getCallState(): CallState | null {
    return this.callState;
  }

  getCallDuration(): number {
    if (!this.callState?.startTime) return 0;
    return Math.floor((Date.now() - this.callState.startTime.getTime()) / 1000);
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  getIsVideoEnabled(): boolean {
    return this.isVideoEnabled;
  }

  getIsSpeakerOn(): boolean {
    return this.isSpeakerOn;
  }

  getIsFrontCamera(): boolean {
    return this.isFrontCamera;
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
