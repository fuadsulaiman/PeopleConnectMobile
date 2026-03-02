// Chat utility functions
import { config } from '../../constants';
import { MediaInfo } from './types';

// Helper to convert relative URLs to absolute URLs
export const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  const path = url.startsWith('/') ? url : '/' + url;
  return baseUrl + path;
};

// Helper to check if URL is an image
export const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|tiff|heic|heif)(\?|$)/i.test(url);
export const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|ogv|ts|mts)(\?|$)/i.test(url);
export const isAudioUrl = (url: string) => /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|3gpp)(\?|$)/i.test(url);

// Get attachment URL from message
export const getAttachmentUrl = (item: any): string | null => {
  let url: string | null = null;

  if (item.attachments && item.attachments.length > 0) {
    const attachment = item.attachments[0];
    if (typeof attachment === 'string') {
      url = attachment;
    } else if (attachment?.url && typeof attachment.url === 'string') {
      url = attachment.url;
    }
  }
  if (!url && item.imageUrl && typeof item.imageUrl === 'string') {
    url = item.imageUrl;
  }
  if (!url && item.mediaUrl && typeof item.mediaUrl === 'string') {
    url = item.mediaUrl;
  }

  return url ? (toAbsoluteUrl(url) || null) : null;
};

// Get attachment file name from message
export const getAttachmentFileName = (item: any): string => {
  if (item.attachments && item.attachments.length > 0) {
    const attachment = item.attachments[0];
    if (attachment.fileName) return attachment.fileName;
    if (attachment.name) return attachment.name;
    if (attachment.originalName) return attachment.originalName;
  }
  if (item.fileName) return item.fileName;
  if (item.originalFileName) return item.originalFileName;
  if (item.title) return item.title;

  const url = getAttachmentUrl(item);
  if (url && typeof url === 'string') {
    const pathPart = url.split('?')[0];
    const urlFileName = pathPart.split('/').pop() || '';

    const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\./i;
    if (uuidPattern.test(urlFileName)) {
      const ext = urlFileName.split('.').pop()?.toLowerCase() || '';
      const friendlyNames: Record<string, string> = {
        jpg: 'Image.jpg', jpeg: 'Image.jpeg', png: 'Image.png', gif: 'Image.gif', webp: 'Image.webp',
        mp4: 'Video.mp4', webm: 'Video.webm', mov: 'Video.mov', avi: 'Video.avi',
        mp3: 'Audio.mp3', wav: 'Audio.wav', ogg: 'Audio.ogg', m4a: 'Audio.m4a',
        pdf: 'Document.pdf', doc: 'Document.doc', docx: 'Document.docx',
        xls: 'Spreadsheet.xls', xlsx: 'Spreadsheet.xlsx',
        ppt: 'Presentation.ppt', pptx: 'Presentation.pptx',
        txt: 'Text File.txt', csv: 'Data File.csv',
        zip: 'Archive.zip', rar: 'Archive.rar',
      };
      return friendlyNames[ext] || 'File.' + ext;
    }

    if (urlFileName) return urlFileName;
  }
  return 'File';
};

// Get thumbnail URL for a message
export const getMessageThumbnailUrl = (item: any): string | null => {
  if (!item) return null;
  if (item.attachments && item.attachments.length > 0) {
    const attachment = item.attachments[0];
    if (attachment.thumbnailUrl) {
      return toAbsoluteUrl(attachment.thumbnailUrl) || null;
    }
  }
  const url = getAttachmentUrl(item);
  if (url && isImageUrl(url)) {
    return url;
  }
  return null;
};

// Get media type and info for reply preview
export const getReplyMediaInfo = (message: any): MediaInfo => {
  if (!message) return { type: 'text', thumbnailUrl: null, fileName: null, duration: null };

  const attachmentUrl = getAttachmentUrl(message);
  if (!attachmentUrl) {
    return { type: 'text', thumbnailUrl: null, fileName: null, duration: null };
  }

  const thumbnailUrl = getMessageThumbnailUrl(message);
  const fileName = getAttachmentFileName(message);
  const duration = message.attachments?.[0]?.duration || message.duration || null;

  if (isImageUrl(attachmentUrl)) {
    return { type: 'image', thumbnailUrl, fileName, duration: null };
  }
  if (isVideoUrl(attachmentUrl)) {
    return { type: 'video', thumbnailUrl, fileName, duration };
  }
  if (isAudioUrl(attachmentUrl)) {
    return { type: 'audio', thumbnailUrl: null, fileName, duration };
  }
  return { type: 'file', thumbnailUrl: null, fileName, duration: null };
};

// Parse location data from message content
export const parseLocationData = (content: string): { latitude: number; longitude: number; address?: string; name?: string } | null => {
  try {
    if (content.startsWith('{')) {
      const data = JSON.parse(content);
      if (data.latitude && data.longitude) {
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          address: data.address,
          name: data.name,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Format time
export const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Format recording duration
export const formatRecordingDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ':' + secs.toString().padStart(2, '0');
};

// Check if message is within time limit
export const isWithinTimeLimit = (createdAt: string, timeLimitMinutes: number): boolean => {
  if (timeLimitMinutes === -1) return true;
  const messageTime = new Date(createdAt).getTime();
  const now = Date.now();
  const limitMs = timeLimitMinutes * 60 * 1000;
  return (now - messageTime) <= limitMs;
};
