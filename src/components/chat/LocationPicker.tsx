import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TextInput,
  Image,
  Dimensions,

  ScrollView,

} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { locationService, LocationCoordinates, LocationData } from '../../services/locationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const MAP_HEIGHT = screenHeight * 0.5;

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  visible,
  onClose,
  onLocationSelect,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [address, setAddress] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const styles = createStyles(colors);

  // Get current location when modal opens
  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    } else {
      // Reset state when modal closes
      setLocation(null);
      setAddress('');
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setShowSearch(false);
    }
  }, [visible]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Request permission first
      const permission = await locationService.requestPermission();

      if (permission === 'blocked') {
        locationService.showPermissionBlockedAlert();
        setLoading(false);
        return;
      }

      if (permission !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      // Get location
      const coords = await locationService.getCurrentLocation();
      setLocation(coords);

      // Get address
      setFetchingAddress(true);
      const geocodeResult = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      if (geocodeResult) {
        setAddress(geocodeResult.formattedAddress);
      } else {
        setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
      }
      setFetchingAddress(false);
    } catch (err: any) {
      console.error('Error getting location:', err);
      setError(err.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search for location by query
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PeopleConnect Mobile App',
            'Accept-Language': 'en',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResult[] = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounce
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(text);
    }, 500);
  }, [searchLocation]);

  // Select search result
  const selectSearchResult = useCallback(async (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setLocation({
      latitude: lat,
      longitude: lon,
    });
    setAddress(result.display_name);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  }, []);

  // Handle send location
  const handleSendLocation = useCallback(() => {
    if (!location) return;

    const locationData: LocationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: address,
      name: address.split(',')[0] || 'Shared Location',
    };

    onLocationSelect(locationData);
    onClose();
  }, [location, address, onLocationSelect, onClose]);

  // Get static map URL
  const getMapUrl = useCallback(() => {
    if (!location) return null;
    return locationService.getStaticMapUrl(location.latitude, location.longitude, {
      width: Math.round(screenWidth),
      height: Math.round(MAP_HEIGHT),
      zoom: 16,
    });
  }, [location]);

  const mapUrl = getMapUrl();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Location</Text>
          <TouchableOpacity
            onPress={() => setShowSearch(!showSearch)}
            style={styles.headerButton}
          >
            <Icon name={showSearch ? 'map' : 'search'} size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar (when visible) */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Icon name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            {(searchResults.length > 0 || searching) && (
              <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
                {searching ? (
                  <View style={styles.searchingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.searchingText}>Searching...</Text>
                  </View>
                ) : (
                  searchResults.map((result, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.searchResultItem}
                      onPress={() => selectSearchResult(result)}
                    >
                      <Icon name="location" size={20} color={colors.primary} />
                      <Text style={styles.searchResultText} numberOfLines={2}>
                        {result.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        )}

        {/* Map Preview */}
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="location-outline" size={48} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={getCurrentLocation}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : mapUrl ? (
            <View style={styles.mapWrapper}>
              <Image
                source={{ uri: mapUrl }}
                style={styles.mapImage}
                resizeMode="cover"
              />
              {/* Pin overlay */}
              <View style={styles.pinOverlay}>
                <Icon name="location" size={40} color={colors.error} />
              </View>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Icon name="location-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.loadingText}>No location selected</Text>
            </View>
          )}
        </View>

        {/* Location Info */}
        {location && (
          <View style={styles.locationInfo}>
            <View style={styles.locationInfoContent}>
              <Icon name="location" size={24} color={colors.primary} />
              <View style={styles.locationTextContainer}>
                {fetchingAddress ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.locationName} numberOfLines={1}>
                      {address.split(',')[0] || 'Selected Location'}
                    </Text>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {address}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Current Location Button */}
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={getCurrentLocation}
            >
              <Icon name="locate" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.sendButton, !location && styles.sendButtonDisabled]}
            onPress={handleSendLocation}
            disabled={!location}
          >
            <Icon name="send" size={20} color={colors.white} />
            <Text style={styles.sendButtonText}>Send Location</Text>
          </TouchableOpacity>
        </View>

        {/* Coordinates Display */}
        {location && (
          <Text style={styles.coordinatesText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    searchContainer: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 10,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      fontSize: 16,
      color: colors.text,
    },
    searchResults: {
      maxHeight: 200,
      marginTop: 8,
    },
    searchingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 8,
    },
    searchingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    searchResultText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    mapContainer: {
      height: MAP_HEIGHT,
      backgroundColor: colors.cardBackground,
    },
    mapWrapper: {
      flex: 1,
      position: 'relative',
    },
    mapImage: {
      width: '100%',
      height: '100%',
    },
    pinOverlay: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -20 }, { translateY: -40 }],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      gap: 12,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginTop: 8,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
    locationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    locationInfoContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    locationTextContainer: {
      flex: 1,
    },
    locationName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    locationAddress: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    currentLocationButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtons: {
      padding: 16,
    },
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
    },
    sendButtonDisabled: {
      backgroundColor: colors.textSecondary,
      opacity: 0.5,
    },
    sendButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
    coordinatesText: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingBottom: 8,
    },
  });

export default LocationPicker;
