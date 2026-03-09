/**
 * Call Recording Service
 *
 * Handles audio/video recording during calls.
 * Uses react-native-audio-recorder-player for actual audio capture.
 * Uses react-native-fs for file storage and uploads recordings to backend.
 *
 * For 1:1 WebRTC calls: Records audio from device microphone
 * For Group LiveKit calls: Records audio from device microphone (server-side Egress handles full recording)
 */

import RNFS from "react-native-fs";
import { Platform, PermissionsAndroid } from "react-native";
import AudioRecorderPlayer from "react-native-audio-recorder-player";
import { config } from "../constants";

// Lazy load SDK to avoid initialization issues
const getAccessToken = () => {
  const sdk = require("./sdk");
  return sdk.getAccessToken();
};

export interface RecordingMetadata {
  callId: string;
  conversationId: string;
  callType: "voice" | "video";
  startTime: number;
  duration?: number;
  filePath?: string;
  fileSize?: number;
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
  error?: string;
}

export interface UploadRecordingResult {
  id: string;
  fileName: string;
  url?: string;
}

class CallRecordingService {
  // Using the singleton from react-native-audio-recorder-player
  private currentRecording: RecordingMetadata | null = null;
  private recordingsDir: string;
  private isRecording: boolean = false;

  constructor() {
    // AudioRecorderPlayer is a singleton, no need to instantiate
    // Use cache directory for recordings (auto-cleaned by OS)
    this.recordingsDir = Platform.OS === "android"
      ? RNFS.CachesDirectoryPath + "/call_recordings"
      : RNFS.CachesDirectoryPath + "/call_recordings";
  }

  /**
   * Initialize the recordings directory
   */
  async initialize(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.recordingsDir);
      if (!exists) {
        await RNFS.mkdir(this.recordingsDir);
        console.log("[CallRecording] Created recordings directory:", this.recordingsDir);
      }
    } catch (error) {
      console.error("[CallRecording] Failed to initialize recordings directory:", error);
    }
  }

  /**
   * Request microphone permission for recording
   * Returns true if permission is granted
   */
  async requestRecordingPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        const recordAudioGranted = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

        console.log("[CallRecording] Android permissions:", {
          recordAudio: recordAudioGranted,
          writeStorage: grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE],
          readStorage: grants[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE],
        });

        return recordAudioGranted;
      } catch (err) {
        console.error("[CallRecording] Failed to request Android permissions:", err);
        return false;
      }
    }
    // iOS handles permissions via Info.plist - assume granted if the app is running
    return true;
  }

  /**
   * Start recording a call with actual audio capture
   */
  async startRecording(callId: string, conversationId: string, callType: "voice" | "video"): Promise<RecordingMetadata> {
    // Initialize recordings directory
    await this.initialize();

    // Request permission first
    const hasPermission = await this.requestRecordingPermission();
    if (!hasPermission) {
      throw new Error("Microphone permission denied");
    }

    if (this.isRecording) {
      console.warn("[CallRecording] Already recording, stopping previous recording first");
      await this.stopRecording();
    }

    const startTime = Date.now();
    // Use m4a for iOS and mp3 for Android for better compatibility
    const extension = Platform.OS === "ios" ? "m4a" : "mp3";
    const fileName = "recording_" + callId + "_" + startTime + "." + extension;
    const filePath = this.recordingsDir + "/" + fileName;

    this.currentRecording = {
      callId,
      conversationId,
      callType,
      startTime,
      filePath,
      uploadStatus: "pending",
    };

    try {
      // Start the actual audio recording
      const audioPath = Platform.OS === "android"
        ? filePath
        : filePath.replace(/^file:\/\//, "");

      console.log("[CallRecording] Starting audio recording at:", audioPath);

      const result = await AudioRecorderPlayer.startRecorder(audioPath);
      this.isRecording = true;

      console.log("[CallRecording] Recording started successfully:", {
        callId,
        conversationId,
        callType,
        filePath: result,
      });

      // Add recording progress listener
      AudioRecorderPlayer.addRecordBackListener((e) => {
        // Log progress every 5 seconds
        if (Math.floor(e.currentPosition / 1000) % 5 === 0) {
          console.log("[CallRecording] Recording progress:", {
            position: Math.floor(e.currentPosition / 1000) + "s",
            currentMetering: e.currentMetering,
          });
        }
        return;
      });

      return this.currentRecording;
    } catch (error: any) {
      console.error("[CallRecording] Failed to start recording:", error);
      this.currentRecording = null;
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording and return the recording metadata with file path
   */
  async stopRecording(): Promise<{ duration: number; metadata: RecordingMetadata; filePath: string } | null> {
    if (!this.currentRecording || !this.isRecording) {
      console.warn("[CallRecording] No active recording to stop");
      return null;
    }

    try {
      // Stop the audio recorder
      const result = await AudioRecorderPlayer.stopRecorder();
      AudioRecorderPlayer.removeRecordBackListener();
      this.isRecording = false;

      console.log("[CallRecording] Stopped recording, file saved at:", result);

      const duration = Math.floor((Date.now() - this.currentRecording.startTime) / 1000);
      this.currentRecording.duration = duration;

      // Get file size
      try {
        const fileStats = await RNFS.stat(result);
        this.currentRecording.fileSize = parseInt(String(fileStats.size), 10);
        console.log("[CallRecording] Recording file size:", this.currentRecording.fileSize, "bytes");
      } catch (statError) {
        console.warn("[CallRecording] Could not get file stats:", statError);
      }

      // Update filePath to the actual result path from the recorder
      this.currentRecording.filePath = result;

      const recordingResult = {
        duration,
        metadata: { ...this.currentRecording },
        filePath: result,
      };

      console.log("[CallRecording] Recording stopped successfully:", {
        callId: this.currentRecording.callId,
        duration,
        filePath: result,
        fileSize: this.currentRecording.fileSize,
      });

      return recordingResult;
    } catch (error: any) {
      console.error("[CallRecording] Failed to stop recording:", error);
      this.isRecording = false;

      // Still return the metadata even if stop failed
      if (this.currentRecording) {
        const duration = Math.floor((Date.now() - this.currentRecording.startTime) / 1000);
        return {
          duration,
          metadata: { ...this.currentRecording, error: error.message },
          filePath: this.currentRecording.filePath || "",
        };
      }
      return null;
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Upload a recording file to the backend
   */
  async uploadRecording(
    filePath: string,
    callId: string,
    conversationId: string,
    callType: "voice" | "video",
    duration: number
  ): Promise<UploadRecordingResult> {
    console.log("[CallRecording] Uploading recording:", { filePath, callId, duration });

    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available");
    }

    // Check if file exists
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      throw new Error("Recording file not found at: " + filePath);
    }

    const fileStats = await RNFS.stat(filePath);
    console.log("[CallRecording] File size:", fileStats.size);

    if (parseInt(String(fileStats.size), 10) === 0) {
      throw new Error("Recording file is empty");
    }

    // Determine file extension and MIME type
    const extension = filePath.split(".").pop()?.toLowerCase() || "m4a";
    const mimeType = extension === "mp3" ? "audio/mpeg" : "audio/m4a";
    const fileName = "call-recording-" + callId + "." + extension;

    // Build upload URL with query params
    const params = new URLSearchParams({
      callId,
      conversationId,
      callType,
      duration: duration.toString(),
    });
    const uploadUrl = config.API_BASE_URL + "/calls/recordings/upload?" + params.toString();

    // Upload file using fetch with FormData
    const formData = new FormData();
    formData.append("file", {
      uri: Platform.OS === "android" ? "file://" + filePath : filePath,
      type: mimeType,
      name: fileName,
    } as any);

    if (this.currentRecording) {
      this.currentRecording.uploadStatus = "uploading";
    }

    try {
      console.log("[CallRecording] Uploading to:", uploadUrl);

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error("Upload failed: " + response.status + " - " + errorText);
      }

      const result = await response.json();
      console.log("[CallRecording] Upload successful:", result);

      if (this.currentRecording) {
        this.currentRecording.uploadStatus = "uploaded";
      }

      // Clean up local file after successful upload
      await this.deleteLocalRecording(filePath);

      return result.data || result;
    } catch (error: any) {
      console.error("[CallRecording] Upload failed:", error);
      if (this.currentRecording) {
        this.currentRecording.uploadStatus = "failed";
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
    const filePath = this.recordingsDir + "/" + fileName;
    await RNFS.writeFile(filePath, data, "base64");
    console.log("[CallRecording] Saved audio data to:", filePath);
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
        console.log("[CallRecording] Deleted local recording:", filePath);
      }
    } catch (error) {
      console.warn("[CallRecording] Failed to delete local recording:", error);
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
          console.log("[CallRecording] Cleaned up old recording:", file.name);
        }
      }
    } catch (error) {
      console.warn("[CallRecording] Cleanup failed:", error);
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
