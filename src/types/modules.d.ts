/**
 * Type declarations for third-party modules
 */

declare module "react-native-video" {
  import { Component } from "react";
  import { ViewStyle } from "react-native";

  export interface OnLoadData {
    duration: number;
    currentTime: number;
    naturalSize: { width: number; height: number; orientation: string };
  }

  export interface OnProgressData {
    currentTime: number;
    playableDuration: number;
    seekableDuration: number;
  }

  export interface VideoProperties {
    source: { uri: string } | number;
    style?: ViewStyle;
    paused?: boolean;
    repeat?: boolean;
    muted?: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: "contain" | "cover" | "stretch" | "none";
    poster?: string;
    posterResizeMode?: "contain" | "cover" | "stretch" | "repeat" | "center";
    onLoad?: (data: OnLoadData) => void;
    onLoadStart?: () => void;
    onProgress?: (data: OnProgressData) => void;
    onEnd?: () => void;
    onError?: (error: any) => void;
    onBuffer?: (data: any) => void;
    controls?: boolean;
    fullscreen?: boolean;
    fullscreenAutorotate?: boolean;
    fullscreenOrientation?: "all" | "landscape" | "portrait";
    useTextureView?: boolean;
    audioOnly?: boolean;
  }

  export default class Video extends Component<VideoProperties> {
    seek(time: number): void;
    presentFullscreenPlayer(): void;
    dismissFullscreenPlayer(): void;
  }
}

declare module "react-native-vision-camera" {
  import { Component } from "react";
  import { ViewStyle, ViewProps } from "react-native";

  export type CameraDevice = {
    id: string;
    position: "front" | "back" | "external";
    name: string;
    hasFlash: boolean;
    hasTorch: boolean;
    isMultiCam: boolean;
    minZoom: number;
    maxZoom: number;
    neutralZoom: number;
    formats: CameraDeviceFormat[];
    supportsLowLightBoost: boolean;
    supportsFocus: boolean;
    hardwareLevel?: "legacy" | "limited" | "full";
  };

  export type CameraDeviceFormat = {
    photoHeight: number;
    photoWidth: number;
    videoHeight: number;
    videoWidth: number;
    maxISO: number;
    minISO: number;
    fieldOfView: number;
    maxZoom: number;
    supportsVideoHDR: boolean;
    supportsPhotoHDR: boolean;
    autoFocusSystem: "none" | "contrast-detection" | "phase-detection";
    videoStabilizationModes: VideoStabilizationMode[];
    pixelFormat: PixelFormat;
  };

  export type VideoStabilizationMode = "off" | "standard" | "cinematic" | "cinematic-extended" | "auto";
  export type PixelFormat = "yuv" | "rgb" | "native" | "unknown";

  export interface CameraProps extends ViewProps {
    device: CameraDevice;
    isActive: boolean;
    photo?: boolean;
    video?: boolean;
    audio?: boolean;
    torch?: "off" | "on";
    zoom?: number;
    enableZoomGesture?: boolean;
    fps?: number;
    hdr?: boolean;
    lowLightBoost?: boolean;
    format?: CameraDeviceFormat;
    videoStabilizationMode?: VideoStabilizationMode;
    onError?: (error: CameraRuntimeError) => void;
    onInitialized?: () => void;
    style?: ViewStyle;
  }

  export interface CameraRuntimeError {
    code: string;
    message: string;
    cause?: unknown;
  }

  export interface PhotoFile {
    width: number;
    height: number;
    path: string;
    isRawPhoto: boolean;
    orientation: "portrait" | "landscape-left" | "portrait-upside-down" | "landscape-right";
    isMirrored: boolean;
  }

  export interface VideoFile {
    path: string;
    duration: number;
  }

  export type TakePhotoOptions = {
    flash?: "off" | "on" | "auto";
    enableAutoRedEyeReduction?: boolean;
    enableAutoStabilization?: boolean;
    skipMetadata?: boolean;
  };

  export type RecordVideoOptions = {
    flash?: "off" | "on";
    fileType?: "mp4" | "mov";
    onRecordingError?: (error: CameraRuntimeError) => void;
    onRecordingFinished?: (video: VideoFile) => void;
  };

  export interface CameraRef {
    takePhoto(options?: TakePhotoOptions): Promise<PhotoFile>;
    startRecording(options: RecordVideoOptions): void;
    stopRecording(): Promise<void>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    cancelRecording(): Promise<void>;
    focus(point: { x: number; y: number }): Promise<void>;
  }

  export class Camera extends Component<CameraProps> {
    takePhoto(options?: TakePhotoOptions): Promise<PhotoFile>;
    startRecording(options: RecordVideoOptions): void;
    stopRecording(): Promise<void>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    cancelRecording(): Promise<void>;
    focus(point: { x: number; y: number }): Promise<void>;
  }

  export function useCameraDevice(position: "front" | "back" | "external"): CameraDevice | undefined;
  export function useCameraDevices(): { back: CameraDevice | undefined; front: CameraDevice | undefined; external: CameraDevice | undefined; };
  export function useCameraFormat(device: CameraDevice | undefined, filters?: any): CameraDeviceFormat | undefined;
  export function useCameraPermission(): { hasPermission: boolean; requestPermission: () => Promise<boolean>; };
  export function useMicrophonePermission(): { hasPermission: boolean; requestPermission: () => Promise<boolean>; };
}

declare module "react-native-webrtc" {
  export interface RTCSessionDescription {
    type: "offer" | "answer" | "pranswer" | "rollback";
    sdp: string;
  }

  export type RTCSessionDescriptionType = RTCSessionDescription;

  export interface RTCIceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  }

  export type RTCIceCandidateType = RTCIceCandidate;

  export interface MediaStream {
    id: string;
    active: boolean;
    getTracks(): MediaStreamTrack[];
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    addTrack(track: MediaStreamTrack): void;
    removeTrack(track: MediaStreamTrack): void;
    clone(): MediaStream;
    toURL(): string;
  }

  export interface MediaStreamTrack {
    id: string;
    kind: "audio" | "video";
    label: string;
    enabled: boolean;
    muted: boolean;
    readyState: "live" | "ended";
    stop(): void;
  }

  export interface RTCPeerConnection {
    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
    connectionState: string;
    iceConnectionState: string;
    iceGatheringState: string;
    signalingState: string;
    onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
    onicegatheringstatechange: (() => void) | null;
    onconnectionstatechange: (() => void) | null;
    oniceconnectionstatechange: (() => void) | null;
    onsignalingstatechange: (() => void) | null;
    ontrack: ((event: { track: MediaStreamTrack; streams: MediaStream[] }) => void) | null;
    createOffer(options?: any): Promise<RTCSessionDescription>;
    createAnswer(options?: any): Promise<RTCSessionDescription>;
    setLocalDescription(description: RTCSessionDescription): Promise<void>;
    setRemoteDescription(description: RTCSessionDescription): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    addTrack(track: MediaStreamTrack, stream: MediaStream): void;
    removeTrack(sender: any): void;
    getSenders(): any[];
    getReceivers(): any[];
    close(): void;
  }


  export class RTCPeerConnection {
    constructor(configuration?: any);
  }

  export class RTCSessionDescription {
    constructor(init?: { type: string; sdp: string });
  }

  export class RTCIceCandidate {
    constructor(init?: { candidate: string; sdpMid: string; sdpMLineIndex: number });
  }

  export const RTCView: any;
  export const mediaDevices: {
    getUserMedia(constraints: { audio?: boolean | object; video?: boolean | object }): Promise<MediaStream>;
    enumerateDevices(): Promise<any[]>;
  };
}
