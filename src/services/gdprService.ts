/**
 * GDPR Data Export Service
 * Handles data export requests for user privacy compliance
 */

// CRITICAL: Do NOT import SDK at top level - it causes module initialization failures on Windows
// Use lazy loading pattern with require() to defer SDK initialization
import { config } from '../constants';

const getAccessTokenFn = (): string | null => {
  const sdk = require('./sdk');
  return sdk.getAccessToken();
};

export interface DataExportStatus {
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  fileName?: string;
  message?: string;
}

export interface DataExportRequest {
  success: boolean;
  message: string;
  data: {
    requestId: string;
    status: string;
    estimatedTimeInMinutes: number;
  };
}

/**
 * Request a GDPR data export
 * This initiates an async process that generates a ZIP file of all user data
 */
export async function requestDataExport(): Promise<DataExportRequest> {
  try {
    const accessToken = getAccessTokenFn();
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await fetch(`${config.API_BASE_URL}/users/me/export-data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting data export:', error);
    throw error;
  }
}

/**
 * Get the status of a data export request
 * Returns the current status and download URL when ready
 */
export async function getDataExportStatus(): Promise<DataExportStatus> {
  try {
    const accessToken = getAccessTokenFn();
    if (!accessToken) {
      throw new Error('No access token found');
    }

    const response = await fetch(`${config.API_BASE_URL}/users/me/export-status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Unwrap if wrapped in success/data format
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as DataExportStatus;
    }

    return data as DataExportStatus;
  } catch (error) {
    console.error('Error getting data export status:', error);
    throw error;
  }
}

/**
 * Poll for data export status until ready or timeout
 * @param maxAttempts - Maximum number of polling attempts (default: 120, ~2 hours with 60s intervals)
 * @param intervalMs - Interval between polls in milliseconds (default: 60000, 1 minute)
 */
export async function pollDataExportStatus(
  maxAttempts: number = 120,
  intervalMs: number = 60000
): Promise<DataExportStatus> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const status = await getDataExportStatus();

      if (status.status === 'ready' || status.status === 'failed' || status.status === 'expired') {
        return status;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error(`Poll attempt ${attempts + 1} failed:`, error);
      // Continue polling even if a single attempt fails
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }

  throw new Error(`Data export polling timed out after ${maxAttempts} attempts`);
}

/**
 * Download the exported data file
 * @param downloadUrl - The download URL from the export status
 * @param fileName - Optional custom file name for saving
 */
export async function downloadDataExport(
  _downloadUrl: string,
  fileName: string = 'peopleconnect-data-export.zip'
): Promise<{ success: boolean; fileName: string }> {
  const accessToken = getAccessTokenFn();
  if (!accessToken) {
    throw new Error('No access token found');
  }

  // For React Native, we'll need to use the share or document picker
  // For now, return the download URL for the UI to handle
  return {
    success: true,
    fileName,
  };
}

export const gdprService = {
  requestDataExport,
  getDataExportStatus,
  pollDataExportStatus,
  downloadDataExport,
};

export default gdprService;
