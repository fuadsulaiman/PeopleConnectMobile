/**
 * URL utility functions for extracting and validating URLs in text content
 */

/**
 * Regular expression pattern for matching HTTP/HTTPS URLs
 * Matches URLs that:
 * - Start with http:// or https://
 * - Contain valid domain characters
 * - May include paths, query strings, and fragments
 */
const URL_REGEX = /(https?:\/\/[^\s<>"\])\u200B-\u200D\uFEFF]+)/gi;

/**
 * Extracts all URLs from a given text string
 * @param text - The text content to search for URLs
 * @returns An array of URL strings found in the text
 * @example
 * extractUrls("Check out https://example.com and http://test.org")
 * // Returns: ["https://example.com", "http://test.org"]
 */
export function extractUrls(text: string): string[] {
  if (!text) {
    return [];
  }

  const matches = text.match(URL_REGEX);
  if (!matches) {
    return [];
  }

  // Remove duplicates and clean up trailing punctuation
  const uniqueUrls = [...new Set(matches)].map((url) => {
    // Remove trailing punctuation that may have been captured
    return url.replace(/[.,;:!?]+$/, '');
  });

  return uniqueUrls;
}

/**
 * Extracts the first URL from a given text string
 * @param text - The text content to search for URLs
 * @returns The first URL found, or null if no URLs are present
 */
export function extractFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Extracts the domain name from a URL
 * @param url - The URL to extract the domain from
 * @returns The domain name without www. prefix, or the original URL if parsing fails
 * @example
 * extractDomain("https://www.example.com/path")
 * // Returns: "example.com"
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/https?:\/\/(?:www\.)?([^\/\s]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * Validates if a string is a valid HTTP/HTTPS URL
 * @param url - The string to validate
 * @returns True if the string is a valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks if a message content contains any URLs
 * @param text - The text content to check
 * @returns True if the text contains at least one URL
 */
export function containsUrl(text: string): boolean {
  return extractUrls(text).length > 0;
}

/**
 * Interface for link preview data
 */
export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
}

export default {
  extractUrls,
  extractFirstUrl,
  extractDomain,
  isValidUrl,
  containsUrl,
};
