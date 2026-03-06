import React, { memo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { locationService, LocationData } from '../../services/locationService';

interface LocationMessageProps {
  location: LocationData;
  isOwn?: boolean;
  timestamp?: string; // Reserved for future use
}

export const LocationMessage: React.FC<LocationMessageProps> = memo(
  ({
    location,
    isOwn = false,
    /* timestamp */
  }) => {
    const { colors } = useTheme();
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const styles = createStyles(colors, isOwn);

    // Get static map URL
    const mapUrl = locationService.getStaticMapUrl(location.latitude, location.longitude, {
      width: 280,
      height: 150,
      zoom: 15,
    });

    // Handle press to open in maps app
    const handlePress = useCallback(() => {
      locationService.openInMaps(
        location.latitude,
        location.longitude,
        location.name || location.address
      );
    }, [location]);

    const handleImageLoad = useCallback(() => {
      setImageLoading(false);
    }, []);

    const handleImageError = useCallback(() => {
      setImageLoading(false);
      setImageError(true);
    }, []);

    // Get display name (first part of address or coordinates)
    const displayName =
      location.name?.split(',')[0] || location.address?.split(',')[0] || 'Shared Location';

    // Get subtitle (city, country or full address)
    const subtitle =
      location.city && location.country
        ? `${location.city}, ${location.country}`
        : location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;

    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          {!imageError ? (
            <>
              <Image
                source={{ uri: mapUrl }}
                style={styles.mapImage}
                resizeMode="cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              {imageLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={isOwn ? colors.white : colors.primary} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.fallbackContainer}>
              <Icon
                name="map"
                size={40}
                color={isOwn ? 'rgba(255,255,255,0.5)' : colors.textSecondary}
              />
            </View>
          )}

          {/* Pin marker overlay */}
          <View style={styles.pinContainer}>
            <Icon name="location" size={32} color={colors.error} />
          </View>
        </View>

        {/* Location Info */}
        <View style={styles.infoContainer}>
          <View style={styles.iconContainer}>
            <Icon name="location" size={20} color={isOwn ? colors.white : colors.primary} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.locationName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.locationSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Icon
            name="open-outline"
            size={16}
            color={isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
          />
        </View>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to open in Maps</Text>
        </View>
      </TouchableOpacity>
    );
  }
);

LocationMessage.displayName = 'LocationMessage';

const createStyles = (colors: any, isOwn: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : colors.cardBackground,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: isOwn ? 0 : 1,
      overflow: 'hidden',
      width: 280,
    },
    fallbackContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : `${colors.primary}15`,
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    infoContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      padding: 12,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      backgroundColor: isOwn ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
      justifyContent: 'center',
    },
    locationName: {
      color: isOwn ? colors.white : colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    locationSubtitle: {
      color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary,
      fontSize: 12,
    },
    mapContainer: {
      backgroundColor: isOwn ? 'rgba(0,0,0,0.2)' : colors.border,
      height: 150,
      position: 'relative',
    },
    mapImage: {
      height: '100%',
      width: '100%',
    },
    pinContainer: {
      left: '50%',
      position: 'absolute',
      top: '50%',
      transform: [{ translateX: -16 }, { translateY: -32 }],
    },
    tapHint: {
      paddingBottom: 10,
      paddingHorizontal: 12,
    },
    tapHintText: {
      color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textSecondary,
      fontSize: 11,
    },
    textContainer: {
      flex: 1,
    },
  });

export default LocationMessage;
