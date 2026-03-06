import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onReject,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation for avatar
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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

      // Slide up animation
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      slideAnim.setValue(0);
      return () => {};
    }
  }, [visible, pulseAnim, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
          {/* Call Type Indicator */}
          <View style={styles.callTypeContainer}>
            <Icon
              name={callType === 'video' ? 'videocam' : 'call'}
              size={24}
              color={colors.white}
            />
            <Text style={styles.callTypeText}>
              Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
            </Text>
          </View>

          {/* Caller Info */}
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            {callerAvatar ? (
              <Image source={{ uri: callerAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={48} color={colors.white} />
              </View>
            )}
          </Animated.View>

          <Text style={styles.callerName}>{callerName}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={onReject}
              activeOpacity={0.8}
            >
              <Icon name="close" size={32} color={colors.white} />
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Icon
                name={callType === 'video' ? 'videocam' : 'call'}
                size={32}
                color={colors.white}
              />
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  acceptButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  avatar: {
    borderColor: colors.primary,
    borderRadius: 50,
    borderWidth: 3,
    height: 100,
    width: 100,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    padding: 16,
  },
  buttonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  callTypeContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 24,
  },
  callTypeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  callerName: {
    color: colors.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.gray[800],
    borderRadius: 24,
    padding: 32,
    width: width - 48,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    flex: 1,
    justifyContent: 'center',
  },
  rejectButton: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
});

export default IncomingCallModal;
