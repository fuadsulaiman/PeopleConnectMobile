// CRITICAL: Do NOT re-export SDK at top level - it causes module initialization failures on Windows
// Import SDK services directly from './sdk' where needed, using lazy loading pattern

// Export SignalR service for real-time features
// Note: signalRService is a singleton that uses lazy loading internally for SDK
export { signalRService } from './signalr';

// Export WebRTC service for 1:1 calls
export { webRTCService } from './webrtcService';
export type { CallState, WebRTCEventCallback, IceServer } from './webrtcService';

// Export biometric authentication service
export { biometricService } from './biometricService';

// Export push notification service and types
export { pushNotificationService } from './pushNotificationService';
export type { NotificationData, NotificationMessage, NotificationType, PermissionStatus } from './pushNotificationService';

// REMOVED: Default export of SDK - causes module initialization failures on Windows
// Import SDK directly from './sdk' where needed using lazy loading
