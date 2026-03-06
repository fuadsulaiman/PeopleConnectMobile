/**
 * IncomingCallOverlay Component
 * Full-screen overlay for incoming call notifications
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { CallType, User } from '../../types';

const { height } = Dimensions.get('window');

interface IncomingCallOverlayProps {
  visible: boolean;
  caller: User | null;
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
  onAcceptVideo?: () => void;
}

const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  visible,
  caller,
  callType,
  onAccept,
  onReject,
  onAcceptVideo,
}) => {
  const { colors } = useTheme();
  const { getSiteName } = useSettingsStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Vibration pattern for incoming call
  useEffect(() => {
    if (visible) {
      // Start vibration pattern (vibrate for 1s, pause for 1s, repeat)
      const vibrationPattern =
        Platform.OS === 'android' ? [0, 1000, 1000, 1000, 1000, 1000] : [0, 1000];

      Vibration.vibrate(vibrationPattern, true);

      // Start pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Slide in animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        Vibration.cancel();
        pulseAnimation.stop();
      };
    } else {
      // Slide out animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    return undefined;
  }, [visible, pulseAnim, slideAnim, fadeAnim]);

  const handleAccept = () => {
    Vibration.cancel();
    onAccept();
  };

  const handleAcceptVideo = () => {
    Vibration.cancel();
    onAcceptVideo?.();
  };

  const handleReject = () => {
    Vibration.cancel();
    onReject();
  };

  if (!visible) {
    return null;
  }

  const isVideoCall = callType === 'video';
  const callerName = caller?.name || caller?.username || 'Unknown Caller';
  const callerAvatar = caller?.avatarUrl;

  const styles = StyleSheet.create({
    acceptButton: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: 35,
      elevation: 8,
      height: 70,
      justifyContent: 'center',
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      width: 70,
    },
    acceptVideoButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 30,
      elevation: 8,
      height: 60,
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      width: 60,
    },
    appName: {
      color: colors.textSecondary,
      fontSize: 16,
      marginBottom: 8,
    },
    avatar: {
      borderColor: colors.primary,
      borderRadius: 70,
      borderWidth: 4,
      height: 140,
      width: 140,
    },
    avatarContainer: {
      marginBottom: 32,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
      borderRadius: 70,
      borderWidth: 4,
      height: 140,
      justifyContent: 'center',
      width: 140,
    },
    avatarPulse: {
      backgroundColor: colors.primary,
      borderRadius: 80,
      height: 160,
      left: -10,
      opacity: 0.3,
      position: 'absolute',
      top: -10,
      width: 160,
    },
    buttonLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 12,
    },
    buttonWrapper: {
      alignItems: 'center',
    },
    buttonsContainer: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingBottom: Platform.OS === 'ios' ? 50 : 30,
      paddingHorizontal: 24,
      width: '100%',
    },
    callType: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '500',
      marginBottom: 40,
    },
    callerName: {
      color: colors.white,
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    callerUsername: {
      color: colors.textSecondary,
      fontSize: 16,
      marginBottom: 60,
    },
    container: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 9999,
    },
    content: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      width: '100%',
    },
    declineIcon: {
      transform: [{ rotate: '135deg' }],
    },
    rejectButton: {
      alignItems: 'center',
      backgroundColor: colors.error,
      borderRadius: 35,
      elevation: 8,
      height: 70,
      justifyContent: 'center',
      shadowColor: colors.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      width: 70,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.appName}>{getSiteName()}</Text>
        <Text style={styles.callType}>Incoming {isVideoCall ? 'Video' : 'Voice'} Call</Text>

        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]} />
          {callerAvatar ? (
            <Image source={{ uri: callerAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="person" size={64} color={colors.white} />
            </View>
          )}
        </View>

        <Text style={styles.callerName}>{callerName}</Text>
        {caller?.username && <Text style={styles.callerUsername}>@{caller.username}</Text>}
      </View>

      <View style={styles.buttonsContainer}>
        <View style={styles.buttonWrapper}>
          <TouchableOpacity style={styles.rejectButton} onPress={handleReject} activeOpacity={0.8}>
            <Icon name="call" size={32} color={colors.white} style={styles.declineIcon} />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>Decline</Text>
        </View>

        {isVideoCall && onAcceptVideo && (
          <View style={styles.buttonWrapper}>
            <TouchableOpacity
              style={styles.acceptVideoButton}
              onPress={handleAcceptVideo}
              activeOpacity={0.8}
            >
              <Icon name="videocam" size={28} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.buttonLabel}>Video</Text>
          </View>
        )}

        <View style={styles.buttonWrapper}>
          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.8}>
            <Icon
              name={isVideoCall && !onAcceptVideo ? 'videocam' : 'call'}
              size={32}
              color={colors.white}
            />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>
            {isVideoCall && onAcceptVideo ? 'Audio' : 'Accept'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

export default IncomingCallOverlay;
