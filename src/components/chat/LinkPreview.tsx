import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { MMKV } from 'react-native-mmkv';

// Storage for caching link previews
const linkPreviewStorage = new MMKV({ id: 'link-previews' });

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
  cachedAt?: number;
}

interface LinkPreviewProps {
  url: string;
  isOwn?: boolean;
  onError?: (error: Error) => void;
}

// URL detection regex - matches most common URL patterns
export const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Get cached preview data
const getCachedPreview = (url: string): LinkPreviewData | null => {
  try {
    const cached = linkPreviewStorage.getString(url);
    if (cached) {
      const data = JSON.parse(cached) as LinkPreviewData;
      // Check if cache is still valid
      if (data.cachedAt && Date.now() - data.cachedAt < CACHE_DURATION) {
        return data;
      }
      // Cache expired, remove it
      linkPreviewStorage.delete(url);
    }
  } catch (error) {
    console.log('Error reading link preview cache:', error);
  }
  return null;
};

// Cache preview data
const cachePreview = (url: string, data: LinkPreviewData): void => {
  try {
    const cacheData = { ...data, cachedAt: Date.now() };
    linkPreviewStorage.set(url, JSON.stringify(cacheData));
  } catch (error) {
    console.log('Error caching link preview:', error);
  }
};

// Decode HTML entities
const decodeHTMLEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// Resolve relative URLs to absolute
const resolveUrl = (imageUrl: string, baseUrl: string): string => {
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  try {
    const base = new URL(baseUrl);
    if (imageUrl.startsWith('//')) {
      return base.protocol + imageUrl;
    }
    if (imageUrl.startsWith('/')) {
      return base.protocol + '//' + base.host + imageUrl;
    }
    return base.protocol + '//' + base.host + '/' + imageUrl;
  } catch {
    return imageUrl;
  }
};

// Fetch Open Graph metadata from URL
const fetchLinkPreview = async (url: string): Promise<LinkPreviewData> => {
  const defaultData: LinkPreviewData = {
    url,
    domain: extractDomain(url),
  };

  try {
    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PeopleConnect/1.0)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return defaultData;
    }

    // Only parse HTML content
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return defaultData;
    }

    const html = await response.text();

    // Parse Open Graph tags
    const getMetaContent = (property: string): string | undefined => {
      // Pattern for property attribute
      const propPattern1 = new RegExp(
        '<meta[^>]+property=["\']' + property + '["\'][^>]+content=["\']([^"\']+)["\']',
        'i'
      );
      const propPattern2 = new RegExp(
        '<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']' + property + '["\']',
        'i'
      );
      // Pattern for name attribute
      const namePattern1 = new RegExp(
        '<meta[^>]+name=["\']' + property + '["\'][^>]+content=["\']([^"\']+)["\']',
        'i'
      );
      const namePattern2 = new RegExp(
        '<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']' + property + '["\']',
        'i'
      );

      const patterns = [propPattern1, propPattern2, namePattern1, namePattern2];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return decodeHTMLEntities(match[1]);
        }
      }
      return undefined;
    };

    // Get title
    let title = getMetaContent('og:title') || getMetaContent('twitter:title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? decodeHTMLEntities(titleMatch[1]) : undefined;
    }

    // Get description
    const description =
      getMetaContent('og:description') ||
      getMetaContent('twitter:description') ||
      getMetaContent('description');

    // Get image
    const image = getMetaContent('og:image') || getMetaContent('twitter:image');

    // Get site name
    const siteName = getMetaContent('og:site_name');

    const previewData: LinkPreviewData = {
      url,
      title: title ? title.trim() : undefined,
      description: description ? description.trim() : undefined,
      image: image ? resolveUrl(image, url) : undefined,
      siteName,
      domain: extractDomain(url),
    };

    // Cache the result
    cachePreview(url, previewData);

    return previewData;
  } catch (error) {
    console.log('Error fetching link preview:', error);
    return defaultData;
  }
};

// Extract first URL from text
export const extractFirstUrl = (text: string): string | null => {
  const matches = text.match(URL_REGEX);
  return matches ? matches[0] : null;
};

// Check if text contains a URL
export const containsUrl = (text: string): boolean => {
  return URL_REGEX.test(text);
};

// Main LinkPreview component
export const LinkPreview: React.FC<LinkPreviewProps> = memo(({ url, isOwn = false, onError }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const styles = createStyles(colors, isOwn);

  useEffect(() => {
    let mounted = true;

    const loadPreview = async () => {
      // Check cache first
      const cached = getCachedPreview(url);
      if (cached) {
        if (mounted) {
          setPreviewData(cached);
          setLoading(false);
        }
        return;
      }

      // Fetch fresh data
      try {
        const data = await fetchLinkPreview(url);
        if (mounted) {
          setPreviewData(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(true);
          setLoading(false);
          if (onError) {
            onError(err as Error);
          }
        }
      }
    };

    loadPreview();

    return () => {
      mounted = false;
    };
  }, [url, onError]);

  const handlePress = useCallback(() => {
    Linking.openURL(url).catch((err) => {
      console.log('Error opening URL:', err);
    });
  }, [url]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Do not render if error or no meaningful data
  if (error || (!loading && !previewData?.title && !previewData?.description)) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={isOwn ? colors.white : colors.primary} />
          <Text style={styles.loadingText}>Loading preview...</Text>
        </View>
      </View>
    );
  }

  const hasImage = previewData?.image && !imageError;

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      {/* Image section */}
      {hasImage && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: previewData.image }}
            style={styles.image}
            resizeMode="cover"
            onError={handleImageError}
          />
        </View>
      )}

      {/* Content section */}
      <View style={styles.contentContainer}>
        {/* Domain/site name */}
        <View style={styles.domainRow}>
          <Icon
            name="globe-outline"
            size={12}
            color={isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
          />
          <Text style={styles.domain} numberOfLines={1}>
            {previewData?.siteName || previewData?.domain}
          </Text>
        </View>

        {/* Title */}
        {previewData?.title && (
          <Text style={styles.title} numberOfLines={2}>
            {previewData.title}
          </Text>
        )}

        {/* Description */}
        {previewData?.description && (
          <Text style={styles.description} numberOfLines={2}>
            {previewData.description}
          </Text>
        )}
      </View>

      {/* External link indicator */}
      <View style={styles.externalIndicator}>
        <Icon
          name="open-outline"
          size={14}
          color={isOwn ? 'rgba(255,255,255,0.6)' : colors.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
});

LinkPreview.displayName = 'LinkPreview';

const createStyles = (colors: any, isOwn: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isOwn ? 'rgba(0,0,0,0.15)' : colors.cardBackground,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: isOwn ? 0 : 1,
      flexDirection: 'column',
      marginTop: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    contentContainer: {
      padding: 10,
    },
    description: {
      color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    domain: {
      color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
      flex: 1,
      fontSize: 11,
    },
    domainRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginBottom: 4,
    },
    externalIndicator: {
      backgroundColor: isOwn ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
      borderRadius: 12,
      padding: 4,
      position: 'absolute',
      right: 8,
      top: 8,
    },
    image: {
      height: '100%',
      width: '100%',
    },
    imageContainer: {
      backgroundColor: colors.border,
      height: 150,
      width: '100%',
    },
    loadingContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      padding: 12,
    },
    loadingText: {
      color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
      fontSize: 12,
    },
    title: {
      color: isOwn ? colors.white : colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
  });

export default LinkPreview;
