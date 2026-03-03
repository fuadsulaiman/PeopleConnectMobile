import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../hooks';
import { Conversation } from '../../types';

const { width: screenWidth } = Dimensions.get('window');
const maxTitleWidth = screenWidth - 180;

interface ChatHeaderProps {
  conversation: Conversation | null;
  isDM: boolean;
  isBroadcast: boolean;
  userStatus: 'online' | 'offline' | 'away' | 'busy' | undefined;
  displayName: string;
  avatarUrl: string | undefined;
  onInfoPress: () => void;
  onVoiceCallPress: () => void;
  onVideoCallPress: () => void;
  navigation: any;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  isDM,
  isBroadcast,
  userStatus,
  displayName,
  avatarUrl,
  onInfoPress,
  onVoiceCallPress,
  onVideoCallPress,
  navigation,
}) => {
  const { colors } = useTheme();

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <TouchableOpacity
          style={[styles.headerContainer, { maxWidth: maxTitleWidth }]}
          onPress={onInfoPress}
          activeOpacity={0.7}
        >
          <Avatar
            uri={avatarUrl}
            name={displayName}
            size={36}
            status={userStatus}
            style={styles.avatar}
          />
          <View style={[styles.titleContainer, { maxWidth: maxTitleWidth - 50 }]}>
            <Text
              style={[styles.displayName, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>
            {isDM && userStatus && (
              <Text style={[
                styles.statusText,
                { color: userStatus === 'online' ? colors.online : colors.textSecondary }
              ]}>
                {userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
              </Text>
            )}
            {isBroadcast && (
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {(conversation as any)?.isPlatformChannel ? 'Official Channel' : 'Broadcast Channel'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        !isBroadcast ? (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              onPress={onVoiceCallPress}
              style={styles.callButton}
            >
              <Icon name="call-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onVideoCallPress}
              style={styles.videoCallButton}
            >
              <Icon name="videocam-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null
      ),
    });
  }, [navigation, conversation, isBroadcast, isDM, userStatus, displayName, avatarUrl, onInfoPress, onVoiceCallPress, onVideoCallPress, colors]);

  return null;
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
  },
  headerRightContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  callButton: {
    padding: 8,
    marginRight: 4,
  },
  videoCallButton: {
    padding: 8,
  },
});

export default ChatHeader;
