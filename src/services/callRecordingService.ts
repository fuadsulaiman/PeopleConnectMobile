/**
 * Call Recording Service
 * 
 * Handles audio/video recording during calls.
 * Uses react-native-fs for file storage and uploads recordings to backend.
 * 
 * For 1:1 WebRTC calls: Records audio from local and remote streams
 * For Group LiveKit calls: Coordinates with server-side Egress recording
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { config } from '../constants';

// Lazy load SDK to avoid initialization issues
const getAccessToken = () => {
  const sdk = require('./sdk');
  return sdk.getAccessToken();
};

export interface RecordingMetadata {
  callId: string;
  conversationId: string;
  callType: 'voice' | 'video';
  startTime: number;
  duration?: number;
  filePath?: string;
  fileSize?: number;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
}

export interface UploadRecordingResult {
  id: string;
  fileName: string;
  url?: string;
}

class CallRecordingService {
  private currentRecording: RecordingMetadata | null = null;
  private recordingsDir: string;

  constructor() {
    // Use cache directory for recordings (auto-cleaned by OS)
    this.recordingsDir = Platform.OS === 'android'
      ? RNFS.CachesDirectoryPath + '/call_recordings'
      : RNFS.CachesDirectoryPath + '/call_recordings';
  }

  /**
   * Initialize the recordings directory
   */
  async initialize(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.recordingsDir);
      if (!exists) {
        await RNFS.mkdir(this.recordingsDir);
        console.log('[CallRecording] Created recordings directory:', this.recordingsDir);
      }
    } catch (error) {
      console.error('[CallRecording] Failed to initialize recordings directory:', error);
    }
  }

  /**
   * Start recording a call
   * Note: Actual audio capture requires native module integration.
   * This method sets up the recording metadata and prepares for upload.
   */
  startRecording(callId: string, conversationId: string, callType: 'voice' | 'video'): RecordingMetadata {
    const startTime = Date.now();
    const fileName = 'recording_' + callId + '_' + startTime + '.webm';
    const filePath = this.recordingsDir + '/' + fileName;

    this.currentRecording = {
      callId,
      conversationId,
      callType,
      startTime,
      filePath,
      uploadStatus: 'pending',
    };

    console.log('[CallRecording] Recording started:', {
      callId,
      conversationId,
      callType,
      filePath,
    });

    return this.currentRecording;
  }

  /**
   * Stop recording and prepare for upload
   * Returns the duration in seconds
   */
  stopRecording(): { duration: number; metadata: RecordingMetadata } | null {
    if (!this.currentRecording) {
      console.warn('[CallRecording] No active recording to stop');
      return null;
    }

    const duration = Math.floor((Date.now() - this.currentRecording.startTime) / 1000);
    this.currentRecording.duration = duration;

    console.log('[CallRecording] Recording stopped:', {
      callId: this.currentRecording.callId,
      duration,
    });

    const result = {
      duration,
      metadata: { ...this.currentRecording },
    };

    return result;
  }

  /**
   * Upload a recording file to the backend
   */
  async uploadRecording(
    filePath: string,
    callId: string,
    conversationId: string,
    callType: 'voice' | 'video',
    duration: number
  ): Promise<UploadRecordingResult> {
    console.log('[CallRecording] Uploading recording:', { filePath, callId, duration });

    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Check if file exists
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      throw new Error('Recording file not found');
    }

    const fileStats = await RNFS.stat(filePath);
    console.log('[CallRecording] File size:', fileStats.size);

    // Build upload URL with query params
    const params = new URLSearchParams({
      callId,
      conversationId,
      callType,
      duration: duration.toString(),
    });
    const uploadUrl = config.API_BASE_URL + '/calls/recordings/upload?' + params.toString();

    // Upload file using fetch with FormData
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'android' ? 'file://' + filePath : filePath,
      type: 'audio/webm',
      name: 'call-recording-' + callId + '.webm',
    } as any);

    if (this.currentRecording) {
      this.currentRecording.uploadStatus = 'uploading';
    }

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Upload failed: ' + response.status + ' - ' + errorText);
      }

      const result = await response.json();
      console.log('[CallRecording] Upload successful:', result);

      if (this.currentRecording) {
        this.currentRecording.uploadStatus = 'uploaded';
      }

      // Clean up local file after successful upload
      await this.deleteLocalRecording(filePath);

      return result.data || result;
    } catch (error: any) {
      console.error('[CallRecording] Upload failed:', error);
      if (this.currentRecording) {
        this.currentRecording.uploadStatus = 'failed';
        this.currentRecording.error = error.message;
      }
      throw error;
    }
  }

  /**
   * Save audio data to file
   * This is used when native recording provides audio data
   */
  async saveAudioData(data: string, fileName: string): Promise<string> {
    await this.initialize();
    const filePath = this.recordingsDir + '/' + fileName;
    await RNFS.writeFile(filePath, data, 'base64');
    console.log('[CallRecording] Saved audio data to:', filePath);
    return filePath;
  }

  /**
   * Delete a local recording file
   */
  async deleteLocalRecording(filePath: string): Promise<void> {
    try {
      const exists = await RNFS.exists(filePath);
      if (exists) {
        await RNFS.unlink(filePath);
        console.log('[CallRecording] Deleted local recording:', filePath);
      }
    } catch (error) {
      console.warn('[CallRecording] Failed to delete local recording:', error);
    }
  }

  /**
   * Clean up old recordings
   */
  async cleanupOldRecordings(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.initialize();
      const files = await RNFS.readDir(this.recordingsDir);
      const now = Date.now();

      for (const file of files) {
        const mtime = new Date(file.mtime || file.ctime || now).getTime();
        if (now - mtime > maxAgeMs) {
          await RNFS.unlink(file.path);
          console.log('[CallRecording] Cleaned up old recording:', file.name);
        }
      }
    } catch (error) {
      console.warn('[CallRecording] Cleanup failed:', error);
    }
  }

  /**
   * Get current recording metadata
   */
  getCurrentRecording(): RecordingMetadata | null {
    return this.currentRecording;
  }

  /**
   * Clear current recording metadata
   */
  clearCurrentRecording(): void {
    this.currentRecording = null;
  }
}

export const callRecordingService = new CallRecordingService();
export default callRecordingService;
