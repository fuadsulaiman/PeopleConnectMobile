import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import { TypingUser, RecordingUser } from './types';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  recordingUsers: RecordingUser[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
  recordingUsers,
}) => {
  const { colors } = useTheme();

  if (typingUsers.length === 0 && recordingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return (typingUsers[0].userName || 'Someone') + ' is typing...';
    } else if (typingUsers.length === 2) {
      return (typingUsers[0].userName || 'Someone') + ' and ' + (typingUsers[1].userName || 'someone') + ' are typing...';
    }
    return typingUsers.length + ' people are typing...';
  };

  const getRecordingText = () => {
    if (recordingUsers.length === 1) {
      return (recordingUsers[0].userName || 'Someone') + ' is recording...';
    } else if (recordingUsers.length === 2) {
      return (recordingUsers[0].userName || 'Someone') + ' and ' + (recordingUsers[1].userName || 'someone') + ' are recording...';
    }
    return recordingUsers.length + ' people are recording...';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {recordingUsers.length > 0 ? (
        <>
          <Icon name="mic" size={16} color={colors.error} style={styles.icon} />
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {getRecordingText()}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: 0.4 }]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: 0.6 }]} />
            <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: 0.8 }]} />
          </View>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {getTypingText()}
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
