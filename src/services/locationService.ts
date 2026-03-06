/**
 * Location Service for PeopleConnect Mobile
 * Handles location permissions, geocoding, and location sharing
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// Location coordinates interface
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

// Location data interface for messages
export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  city?: string;
  country?: string;
}

// Geocoding result interface
export interface GeocodingResult {
  address: string;
  city?: string;
  country?: string;
  formattedAddress: string;
}

// Permission status
export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

class LocationService {
  private lastKnownLocation: LocationCoordinates | null = null;
  private geocodeCache: Map<string, GeocodingResult> = new Map();

  /**
   * Check if location services are available on the device
   */
  async isLocationAvailable(): Promise<boolean> {
    try {
      // Check if Geolocation API is available
      if (!('geolocation' in navigator) && !this.hasNativeGeolocation()) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if native geolocation module is available
   */
  private hasNativeGeolocation(): boolean {
    try {
      const Geolocation = require('@react-native-community/geolocation');
      return !!Geolocation;
    } catch {
      return false;
    }
  }

  /**
   * Request location permission from the user
   */
  async requestPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'PeopleConnect needs access to your location to share it with others.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return 'granted';
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return 'blocked';
        }
        return 'denied';
      }

      // iOS permission is requested when getting location
      return 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return 'unavailable';
    }
  }

  /**
   * Check current permission status
   */
  async checkPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted ? 'granted' : 'denied';
      }
      // iOS - cannot check permission status directly
      return 'granted';
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<LocationCoordinates> {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
      ...options,
    };

    return new Promise((resolve, reject) => {
      try {
        // Try using native geolocation module first
        const Geolocation = require('@react-native-community/geolocation').default;

        Geolocation.getCurrentPosition(
          (position: any) => {
            const coords: LocationCoordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            };
            this.lastKnownLocation = coords;
            resolve(coords);
          },
          (error: any) => {
            console.error('Geolocation error:', error);
            reject(new Error(this.getLocationErrorMessage(error.code)));
          },
          defaultOptions
        );
      } catch (moduleError) {
        // Fallback to web Geolocation API
        if ('geolocation' in navigator) {
          (navigator.geolocation as any).getCurrentPosition(
            (position: any) => {
              const coords: LocationCoordinates = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              };
              this.lastKnownLocation = coords;
              resolve(coords);
            },
            (error: any) => {
              console.error('Geolocation error:', error);
              reject(new Error(this.getLocationErrorMessage(error.code)));
            },
            defaultOptions
          );
        } else {
          reject(new Error('Location services are not available on this device'));
        }
      }
    });
  }

  /**
   * Get last known location (cached)
   */
  getLastKnownLocation(): LocationCoordinates | null {
    return this.lastKnownLocation;
  }

  /**
   * Reverse geocode coordinates to get address
   * Uses Nominatim (OpenStreetMap) - free, no API key needed
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult | null> {
    // Check cache first
    const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PeopleConnect Mobile App',
            'Accept-Language': 'en',
          },
        }
      );

      if (!response.ok) {
        console.log('Geocoding request failed:', response.status);
        return null;
      }

      const data = await response.json();

      if (data && data.address) {
        const result: GeocodingResult = {
          address: this.formatAddress(data.address),
          city:
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.municipality,
          country: data.address.country,
          formattedAddress: data.display_name || this.formatAddress(data.address),
        };

        // Cache the result
        this.geocodeCache.set(cacheKey, result);

        return result;
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Format address from geocoding response
   */
  private formatAddress(address: any): string {
    const parts: string[] = [];

    if (address.house_number) {
      parts.push(address.house_number);
    }
    if (address.road || address.street) {
      parts.push(address.road || address.street);
    }
    if (address.suburb || address.neighbourhood) {
      parts.push(address.suburb || address.neighbourhood);
    }
    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village);
    }

    return parts.join(', ') || 'Unknown location';
  }

  /**
   * Create location data for sending in a message
   */
  async createLocationData(coordinates: LocationCoordinates): Promise<LocationData> {
    const geocodeResult = await this.reverseGeocode(coordinates.latitude, coordinates.longitude);

    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      address: geocodeResult?.address,
      name:
        geocodeResult?.formattedAddress ||
        `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
      city: geocodeResult?.city,
      country: geocodeResult?.country,
    };
  }

  /**
   * Parse location data from message content (JSON string)
   */
  parseLocationData(content: string): LocationData | null {
    try {
      if (content.startsWith('{')) {
        const data = JSON.parse(content);
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.address,
            name: data.name,
            city: data.city,
            country: data.country,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Serialize location data for message content
   */
  serializeLocationData(location: LocationData): string {
    return JSON.stringify(location);
  }

  /**
   * Open location in native maps app
   */
  openInMaps(latitude: number, longitude: number, label?: string): void {
    const encodedLabel = label ? encodeURIComponent(label) : '';
    const latLng = `${latitude},${longitude}`;

    const url = Platform.select({
      ios: `maps:${latLng}?q=${encodedLabel || latLng}`,
      android: `geo:${latLng}?q=${latLng}(${encodedLabel})`,
    });

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            // Fallback to Google Maps web
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
          }
        })
        .catch(() => {
          // Fallback to Google Maps web
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
        });
    }
  }

  /**
   * Generate static map image URL
   * Uses OpenStreetMap static map service
   */
  getStaticMapUrl(
    latitude: number,
    longitude: number,
    options?: {
      width?: number;
      height?: number;
      zoom?: number;
    }
  ): string {
    const { width = 300, height = 200, zoom = 15 } = options || {};

    // Use OpenStreetMap static map tile
    // This creates a simple marker at the location
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&markers=${latitude},${longitude},red-pushpin`;
  }

  /**
   * Calculate distance between two points in kilometers
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get human-readable error message for geolocation errors
   */
  private getLocationErrorMessage(code: number): string {
    switch (code) {
      case 1: // PERMISSION_DENIED
        return 'Location permission denied. Please enable location access in settings.';
      case 2: // POSITION_UNAVAILABLE
        return 'Location unavailable. Please ensure GPS is enabled.';
      case 3: // TIMEOUT
        return 'Location request timed out. Please try again.';
      default:
        return 'Failed to get location. Please try again.';
    }
  }

  /**
   * Show alert to open app settings (when permission is blocked)
   */
  showPermissionBlockedAlert(): void {
    Alert.alert(
      'Location Permission Required',
      'Location permission has been denied. Please enable it in your device settings to share your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }

  /**
   * Clear geocode cache
   */
  clearCache(): void {
    this.geocodeCache.clear();
    this.lastKnownLocation = null;
  }
}

// Export singleton instance
export const locationService = new LocationService();

export default locationService;
