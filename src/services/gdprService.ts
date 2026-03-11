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

const getCurrentUserId = (): string | null => {
  const authStore = require('../stores/authStore');
  return authStore.useAuthStore.getState().user?.id || null;
};

export interface DataExportResult {
  success: boolean;
  data: any;
  fileName: string;
}

/**
 * Export user data for GDPR compliance
 * Backend endpoint: GET /api/users/{id}/gdpr/export
 * Returns JSON data directly (synchronous - not an async job)
 */
export async function exportUserData(): Promise<DataExportResult> {
  const accessToken = getAccessTokenFn();
  if (!accessToken) {
    throw new Error('No access token found');
  }

  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('No user ID found');
  }

  const response = await fetch(`${config.API_BASE_URL}/users/${userId}/gdpr/export`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      const errorBody = await response.text().catch(() => '');
      if (errorBody) {
        try {
          const errorJson = JSON.parse(errorBody);
          throw new Error(errorJson.message || 'Data export is currently disabled by the administrator');
        } catch (e) {
          if (e instanceof SyntaxError) {
            // Non-JSON body, treat as permission denied
            throw new Error('You don\'t have permission to export data. Please contact your administrator.');
          }
          throw e;
        }
      }
      // Empty body means ASP.NET Core authorization denied the request
      throw new Error('You don\'t have permission to export data. Please contact your administrator.');
    }
    if (response.status === 404) {
      throw new Error('User not found');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Export failed (HTTP ${response.status})`);
  }

  // The backend returns a JSON file directly
  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const fileName = fileNameMatch
    ? fileNameMatch[1].replace(/['"]/g, '')
    : `gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;

  const data = await response.json();

  return {
    success: true,
    data,
    fileName,
  };
}

export const gdprService = {
  exportUserData,
};

export default gdprService;
