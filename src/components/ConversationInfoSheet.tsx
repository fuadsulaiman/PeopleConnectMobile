import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  FlatList,
  Dimensions,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../constants/colors';
import { config } from '../constants/config';
import { Conversation } from '../types';
import { Avatar } from './common/Avatar';
import { sdk, getAccessToken } from '../services/sdk';
import { useAuthStore, usePresenceStore, useChatStore } from '../stores';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

interface ConversationInfoSheetProps {
  visible: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onStartCall?: (type: 'voice' | 'video') => void;
  onLeaveGroup?: () => void;
  onDeleteConversation?: () => void;
  onViewProfile?: (userId: string, userName?: string, userAvatar?: string, username?: string) => void;
  onAddMembers?: () => void;
}

interface Participant {
  userId: string;
  name: string;
  username: string;
  avatarUrl?: string;
  role: 'Owner' | 'Admin' | 'Member';
  joinedAt: string;
}

interface SharedMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'file';
  fileName?: string;
}

interface SharedLink {
  id: string;
  url: string;
  title?: string;
  preview?: string;
  messageId: string;
  sentAt: string;
}

interface SharedDocument {
  id: string;
  url: string;
  fileName: string;
  fileSize?: number;
  fileType: string;
  sentAt: string;
}

export const ConversationInfoSheet: React.FC<ConversationInfoSheetProps> = ({
  visible,
  conversation,
  onClose,
  onStartCall,
  onLeaveGroup,
  onDeleteConversation,
  onViewProfile,
  onAddMembers,
}) => {
  const { user } = useAuthStore();
  const { onlineUsers } = usePresenceStore();
  const [activeTab, setActiveTab] = useState<'members' | 'media' | 'settings'>('members');
  const [mediaSubTab, setMediaSubTab] = useState<'media' | 'links' | 'docs'>('media');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [sharedDocs, setSharedDocs] = useState<SharedDocument[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [showMemberActions, setShowMemberActions] = useState<string | null>(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [disappearingDuration, setDisappearingDuration] = useState<string>('off');
  const [showDisappearingPicker, setShowDisappearingPicker] = useState(false);
  const [isOtherUserBlocked, setIsOtherUserBlocked] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);

  // Handle different type formats from API
  const conversationType = conversation?.type?.toLowerCase() || '';
  const participantCount = conversation?.participantCount || 0;

  let isDM = conversationType === 'directmessage' || conversationType === 'dm';
  let isChatroom = conversationType === 'chatroom' || conversationType === 'group';
  let isBroadcast = conversationType === 'broadcastchannel' || conversationType === 'broadcast';
  const isPlatformChannel = (conversation as any)?.isPlatformChannel === true || isBroadcast;

  if (!isDM && !isChatroom && !isBroadcast) {
    if (participantCount <= 2) {
      isDM = true;
    } else {
      isChatroom = true;
    }
  }

  useEffect(() => {
    if (visible && conversation?.id) {
      fetchConversationDetails();
      setIsMuted(conversation.isMuted || false);
      setIsPinned(conversation.isPinned || false);
      setEditGroupName(conversation.name || '');
      setEditGroupDescription(conversation.description || '');
      // Initialize disappearing messages duration
      const convDisappearing = (conversation as any).disappearingMessagesDuration ||
                               (conversation as any).DisappearingMessagesDuration ||
                               'off';
      setDisappearingDuration(convDisappearing);
      setShowDisappearingPicker(false);
      setSharedMedia([]);
      setSharedLinks([]);
      setSharedDocs([]);
      setShowMediaGallery(false);
      setMediaSubTab('media');
      // Set default tab to 'media' for platform channels (no members tab)
      const isBroadcastType = conversation.type?.toLowerCase() === 'broadcastchannel' ||
                              conversation.type?.toLowerCase() === 'broadcast';
      const isPlatform = (conversation as any)?.isPlatformChannel === true || isBroadcastType;
      setActiveTab(isPlatform ? 'media' : 'members');
      // Auto-fetch media for platform channels since media tab is default
      if (isPlatform) {
        setTimeout(() => fetchSharedMedia(), 100);
      }
      // Check if other user is blocked (for DMs)
      const convType = conversation.type?.toLowerCase() || '';
      const isDMType = convType === 'directmessage' || convType === 'dm';
      if (isDMType) {
        checkBlockedStatus();
      }
    }
  }, [visible, conversation?.id]);

  const checkBlockedStatus = async () => {
    try {
      const otherUserId = (conversation as any)?.otherUserId;
      if (!otherUserId) return;

      const blockedContacts = await sdk.contacts.getBlocked();
      const isBlocked = blockedContacts.some((bc) => bc.userId === otherUserId);
      setIsOtherUserBlocked(isBlocked);
    } catch (error) {
      console.error('Failed to check blocked status:', error);
    }
  };

  const fetchConversationDetails = async () => {
    if (!conversation?.id) return;

    // Skip fetching members for platform/broadcast channels
    const convType = conversation.type?.toLowerCase() || '';
    const isBroadcastType = convType === 'broadcastchannel' || convType === 'broadcast';
    const isPlatform = (conversation as any)?.isPlatformChannel === true || isBroadcastType;
    if (isPlatform) {
      return; // No need to fetch members for platform channels
    }

    // First, try to use participants from the conversation object
    if (conversation.participants && conversation.participants.length > 0) {
      const mapped = conversation.participants.map((p: any) => ({
        userId: p.userId || p.UserId || p.id || p.user?.id,
        name: p.name || p.Name || p.user?.name || 'Unknown',
        username: p.username || p.Username || p.user?.username || 'unknown',
        avatarUrl: p.avatarUrl || p.AvatarUrl || p.user?.avatarUrl,
        role: p.role || p.Role || 'Member',
        joinedAt: p.joinedAt || p.JoinedAt || new Date().toISOString(),
      }));
      setParticipants(mapped);
      return;
    }

    // For DMs, construct the other participant from conversation data
    const isDMType = convType === 'directmessage' || convType === 'dm';
    if (isDMType) {
      // Try to get the other user info from the conversation
      const otherUserId = (conversation as any).otherUserId;
      if (otherUserId) {
        // Create a participant entry for the other user
        const otherParticipant: Participant = {
          userId: otherUserId,
          name: conversation.name || 'Unknown',
          username: (conversation as any).otherUsername || '',
          avatarUrl: conversation.avatarUrl,
          role: 'Member',
          joinedAt: conversation.createdAt || new Date().toISOString(),
        };
        setParticipants([otherParticipant]);
      }
      return;
    }

    // If no participants in conversation object, try to fetch from API (chatrooms only)
    setIsLoadingMembers(true);
    try {
      // Try getMembers endpoint first (more reliable)
      const members = await sdk.conversations.getMembers(conversation.id);
      if (members && members.length > 0) {
        const mapped = members.map((p: any) => ({
          userId: p.userId || p.UserId || p.id || p.user?.id,
          name: p.name || p.Name || p.user?.name || 'Unknown',
          username: p.username || p.Username || p.user?.username || 'unknown',
          avatarUrl: p.avatarUrl || p.AvatarUrl || p.user?.avatarUrl,
          role: p.role || p.Role || 'Member',
          joinedAt: p.joinedAt || p.JoinedAt || new Date().toISOString(),
        }));
        setParticipants(mapped);
      }
    } catch (error: any) {
      // Silently fail for member fetching - it's not critical
      console.log('Could not fetch members:', error?.message);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Helper functions for media extraction
  const getDomainFromUrl = (url: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return url.substring(0, 30);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocColor = (fileType: string): string => {
    const type = fileType.toUpperCase();
    switch (type) {
      case 'PDF': return '#E74C3C';
      case 'DOC':
      case 'DOCX': return '#2980B9';
      case 'XLS':
      case 'XLSX':
      case 'CSV': return '#27AE60';
      case 'PPT':
      case 'PPTX': return '#E67E22';
      case 'TXT':
      case 'RTF': return '#95A5A6';
      default: return '#7F8C8D';
    }
  };

  const fetchSharedMedia = async () => {
    if (!conversation?.id || (sharedMedia.length > 0 && sharedLinks.length > 0 && sharedDocs.length > 0)) return;

    setIsLoadingMedia(true);
    try {
      // Use the new backend endpoint that handles both regular conversations and broadcast channels
      const response = await sdk.media.getConversationSharedContent(conversation.id, {
        type: 'all',
        pageSize: 100,
      });

      // Map backend response to local state
      const mediaItems: SharedMedia[] = (response.media || []).map((item: any) => ({
        id: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        type: item.type as 'image' | 'video' | 'file',
        fileName: item.fileName,
      }));

      const linkItems: SharedLink[] = (response.links || []).map((item: any) => ({
        id: item.messageId || `link-${item.url}`,
        url: item.url,
        title: item.title || item.domain || getDomainFromUrl(item.url),
        preview: item.description,
        messageId: item.messageId || '',
        sentAt: item.createdAt,
      }));

      const docItems: SharedDocument[] = (response.documents || []).map((item: any) => ({
        id: item.id || `doc-${item.url}`,
        url: item.url,
        fileName: item.friendlyName || item.fileName,
        fileSize: item.fileSize,
        fileType: item.extension?.replace('.', '').toUpperCase() || 'FILE',
        sentAt: item.createdAt,
      }));

      setSharedMedia(mediaItems);
      setSharedLinks(linkItems);
      setSharedDocs(docItems);
    } catch (error) {
      console.error('Failed to fetch shared media:', error);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const handleMuteToggle = async () => {
    if (!conversation?.id) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      if (newMuted) {
        await sdk.conversations.mute(conversation.id);
      } else {
        await sdk.conversations.unmute(conversation.id);
      }
      // Sync with chat store so conversation list reflects the change
      useChatStore.getState().updateConversation({
        id: conversation.id,
        isMuted: newMuted,
      });
    } catch (error) {
      setIsMuted(!newMuted);
      Alert.alert('Error', 'Failed to update mute setting');
    }
  };

  const handlePinToggle = async () => {
    if (!conversation?.id) return;
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    try {
      if (newPinned) {
        await sdk.conversations.pin(conversation.id);
      } else {
        await sdk.conversations.unpin(conversation.id);
      }
      // Sync with chat store so conversation list reflects the change
      useChatStore.getState().updateConversation({
        id: conversation.id,
        isPinned: newPinned,
      });
    } catch (error) {
      setIsPinned(!newPinned);
      Alert.alert('Error', 'Failed to update pin setting');
    }
  };

  const handleDisappearingChange = async (duration: string) => {
    if (!conversation?.id) return;
    const previousDuration = disappearingDuration;
    setDisappearingDuration(duration);
    setShowDisappearingPicker(false);
    try {
      const token = getAccessToken();
      const response = await fetch(
        `${config.API_BASE_URL}/conversations/${conversation.id}/disappearing-messages`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ duration }),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to update disappearing messages');
      }
      // Update the conversation in chat store so it persists when reopening
      useChatStore.getState().updateConversation({
        id: conversation.id,
        disappearingMessagesDuration: duration,
      });
    } catch (error) {
      setDisappearingDuration(previousDuration);
      Alert.alert('Error', 'Failed to update disappearing messages setting');
    }
  };

  const getDisappearingLabel = (duration: string): string => {
    switch (duration) {
      case '24h': return '24 Hours';
      case '7d': return '7 Days';
      case '30d': return '30 Days';
      case '90d': return '90 Days';
      default: return 'Off';
    }
  };

  const handleBlockUser = () => {
    const otherUser = getOtherParticipant();
    const otherUserId = otherUser?.userId || (conversation as any)?.otherUserId;
    const otherUserName = otherUser?.name || conversation?.name || 'this user';

    if (!otherUserId) return;

    Alert.alert(
      isOtherUserBlocked ? 'Unblock User' : 'Block User',
      isOtherUserBlocked
        ? `Are you sure you want to unblock ${otherUserName}?`
        : `Are you sure you want to block ${otherUserName}? You will no longer receive messages from them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOtherUserBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlockingUser(true);
            try {
              if (isOtherUserBlocked) {
                await sdk.contacts.unblock(otherUserId);
                setIsOtherUserBlocked(false);
                Alert.alert('Unblocked', `${otherUserName} has been unblocked`);
              } else {
                await sdk.contacts.block(otherUserId);
                setIsOtherUserBlocked(true);
                Alert.alert('Blocked', `${otherUserName} has been blocked`);
              }
            } catch (error) {
              Alert.alert('Error', `Failed to ${isOtherUserBlocked ? 'unblock' : 'block'} user`);
            } finally {
              setIsBlockingUser(false);
            }
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    const otherUser = getOtherParticipant();
    if (!otherUser) return;

    Alert.alert(
      'Report User',
      'Why are you reporting ' + otherUser.name + '?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spam',
          onPress: () => submitReport(otherUser.userId, 'spam'),
        },
        {
          text: 'Harassment',
          onPress: () => submitReport(otherUser.userId, 'harassment'),
        },
        {
          text: 'Inappropriate Content',
          onPress: () => submitReport(otherUser.userId, 'inappropriate'),
        },
      ]
    );
  };

  const submitReport = async (userId: string, reportType: string) => {
    try {
      await sdk.reports.create({
        reportedUserId: userId,
        reportType: reportType as any,
        description: 'Reported from mobile app',
      });
      Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  const handleDeleteChat = () => {
    const chatType = isDM ? 'conversation' : 'group';
    Alert.alert(
      isDM ? 'Delete Chat' : 'Delete Group',
      'Are you sure you want to delete this ' + chatType + '? This action cannot be undone and all messages will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteConversation?.();
            onClose();
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You will need to be re-invited to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            onLeaveGroup?.();
            onClose();
          },
        },
      ]
    );
  };

  const handleViewProfile = (userId: string, userName?: string, userAvatar?: string, username?: string) => {
    if (onViewProfile) {
      onViewProfile(userId, userName, userAvatar, username);
      onClose();
    } else {
      Alert.alert('View Profile', 'Profile viewing is not available');
    }
  };

  const handleRemoveMember = (member: Participant) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove ' + member.name + ' from this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await sdk.conversations.removeMember(conversation!.id, member.userId);
              setParticipants(participants.filter(p => p.userId !== member.userId));
              Alert.alert('Removed', member.name + ' has been removed from the group');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
    setShowMemberActions(null);
  };

  const handleMakeAdmin = async (member: Participant) => {
    try {
      await sdk.conversations.updateParticipantRole(conversation!.id, member.userId, 'Admin');
      setParticipants(participants.map(p =>
        p.userId === member.userId ? { ...p, role: 'Admin' } : p
      ));
      Alert.alert('Success', member.name + ' is now an admin');
    } catch (error) {
      Alert.alert('Error', 'Failed to update member role');
    }
    setShowMemberActions(null);
  };

  const handleRemoveAdmin = async (member: Participant) => {
    try {
      await sdk.conversations.updateParticipantRole(conversation!.id, member.userId, 'Member');
      setParticipants(participants.map(p =>
        p.userId === member.userId ? { ...p, role: 'Member' } : p
      ));
      Alert.alert('Success', member.name + ' is no longer an admin');
    } catch (error) {
      Alert.alert('Error', 'Failed to update member role');
    }
    setShowMemberActions(null);
  };

  const handleSaveGroupSettings = async () => {
    if (!conversation?.id) return;

    try {
      await sdk.conversations.update(conversation.id, {
        name: editGroupName,
        description: editGroupDescription,
      });
      Alert.alert('Success', 'Group settings updated');
      setShowEditGroup(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update group settings');
    }
  };

  const handleMediaPress = (index: number) => {
    setSelectedMediaIndex(index);
    setShowMediaGallery(true);
  };

  const handleAddMembers = () => {
    if (onAddMembers) {
      onAddMembers();
    } else {
      Alert.alert('Add Members', 'Member adding is not available');
    }
  };

  const getOtherParticipant = (): Participant | null => {
    if (!isDM) return null;
    return participants.find((p) => p.userId !== user?.id) || null;
  };

  const getDisplayName = () => {
    if (isDM) {
      const other = getOtherParticipant();
      return other?.name || conversation?.name || 'Unknown';
    }
    return conversation?.name || 'Group Chat';
  };

  const getAvatarUrl = () => {
    if (isDM) {
      const other = getOtherParticipant();
      return other?.avatarUrl || conversation?.avatarUrl;
    }
    return conversation?.avatarUrl;
  };

  const getOnlineStatus = (): 'online' | 'offline' | undefined => {
    if (!isDM) return undefined;
    const otherUserId = (conversation as any)?.otherUserId;
    if (otherUserId && onlineUsers[otherUserId]) {
      return 'online';
    }
    return 'offline';
  };

  const filteredMembers = memberSearch.trim()
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          p.username.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : participants;

  const currentUserRole = participants.find((p) => p.userId?.toLowerCase() === user?.id?.toLowerCase())?.role;
  const isAdmin = currentUserRole === 'Owner' || currentUserRole === 'Admin';
  const isOwner = currentUserRole === 'Owner';

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner': return '#EAB308';
      case 'Admin': return '#3B82F6';
      default: return 'transparent';
    }
  };

  const renderMemberItem = ({ item }: { item: Participant }) => {
    const isCurrentUser = item.userId?.toLowerCase() === user?.id?.toLowerCase();
    const isOnline = onlineUsers[item.userId];
    const canManage = isAdmin && !isCurrentUser && item.role !== 'Owner';

    return (
      <TouchableOpacity
        style={styles.memberItem}
        onPress={() => !isCurrentUser && handleViewProfile(item.userId, item.name, item.avatarUrl, item.username)}
        onLongPress={() => canManage && setShowMemberActions(item.userId)}
      >
        <Avatar
          uri={item.avatarUrl}
          name={item.name}
          size={44}
          status={isOnline ? 'online' : 'offline'}
        />
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.name}
              {isCurrentUser && ' (You)'}
            </Text>
            {item.role !== 'Member' && (
              <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
                <Text style={styles.roleBadgeText}>{item.role}</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberUsername}>@{item.username}</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.memberMenuButton}
            onPress={() => setShowMemberActions(item.userId)}
          >
            <Icon name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Member Actions Menu */}
        {showMemberActions === item.userId && (
          <View style={styles.memberActionsMenu}>
            <TouchableOpacity
              style={styles.memberActionItem}
              onPress={() => handleViewProfile(item.userId, item.name, item.avatarUrl, item.username)}
            >
              <Icon name="person-outline" size={18} color={colors.text} />
              <Text style={styles.memberActionText}>View Profile</Text>
            </TouchableOpacity>
            {item.role === 'Member' && isOwner && (
              <TouchableOpacity
                style={styles.memberActionItem}
                onPress={() => handleMakeAdmin(item)}
              >
                <Icon name="shield-outline" size={18} color={colors.primary} />
                <Text style={[styles.memberActionText, { color: colors.primary }]}>Make Admin</Text>
              </TouchableOpacity>
            )}
            {item.role === 'Admin' && isOwner && (
              <TouchableOpacity
                style={styles.memberActionItem}
                onPress={() => handleRemoveAdmin(item)}
              >
                <Icon name="shield-outline" size={18} color={colors.warning} />
                <Text style={[styles.memberActionText, { color: colors.warning }]}>Remove Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.memberActionItem}
              onPress={() => handleRemoveMember(item)}
            >
              <Icon name="person-remove-outline" size={18} color={colors.error} />
              <Text style={[styles.memberActionText, { color: colors.error }]}>Remove from Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.memberActionItem, styles.memberActionCancel]}
              onPress={() => setShowMemberActions(null)}
            >
              <Text style={styles.memberActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMediaItem = ({ item, index }: { item: SharedMedia; index: number }) => (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => handleMediaPress(index)}
    >
      {item.type === 'image' ? (
        <Image source={{ uri: item.thumbnailUrl || item.url }} style={styles.mediaImage} />
      ) : item.type === 'video' ? (
        <View style={styles.mediaVideo}>
          <Icon name="play" size={24} color={colors.white} />
        </View>
      ) : (
        <View style={styles.mediaFile}>
          <Icon name="document-text" size={24} color={colors.textSecondary} />
          <Text style={styles.mediaFileName} numberOfLines={1}>{item.fileName || 'File'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (!visible || !conversation) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <TouchableOpacity
                onPress={() => {
                  if (isDM) {
                    const other = getOtherParticipant();
                    if (other) {
                      handleViewProfile(other.userId, other.name, other.avatarUrl, other.username);
                    }
                  }
                }}
              >
                <Avatar
                  uri={getAvatarUrl()}
                  name={getDisplayName()}
                  size={80}
                  status={getOnlineStatus()}
                />
              </TouchableOpacity>
              <Text style={styles.displayName}>{getDisplayName()}</Text>
              {isDM && getOtherParticipant()?.username && (
                <Text style={styles.username}>@{getOtherParticipant()?.username}</Text>
              )}
              {!isDM && (
                <Text style={styles.memberCount}>
                  {participants.length || conversation.participantCount || 0} members
                </Text>
              )}
              {isDM && (
                <Text style={[styles.statusText, getOnlineStatus() === 'online' && styles.statusOnline]}>
                  {getOnlineStatus() === 'online' ? 'Online' : 'Offline'}
                </Text>
              )}
              {conversation.description && (
                <Text style={styles.description}>{conversation.description}</Text>
              )}

              {/* Quick Actions */}
              {!isBroadcast && (
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => onStartCall?.('voice')}
                  >
                    <View style={styles.quickActionIcon}>
                      <Icon name="call" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.quickActionLabel}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => onStartCall?.('video')}
                  >
                    <View style={styles.quickActionIcon}>
                      <Icon name="videocam" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.quickActionLabel}>Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickActionButton} onPress={handleMuteToggle}>
                    <View style={styles.quickActionIcon}>
                      <Icon
                        name={isMuted ? 'notifications-off' : 'notifications'}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.quickActionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                  </TouchableOpacity>
                  {isDM && (
                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={() => {
                        const other = getOtherParticipant();
                        if (other) {
                          handleViewProfile(other.userId, other.name, other.avatarUrl, other.username);
                        }
                      }}
                    >
                      <View style={styles.quickActionIcon}>
                        <Icon name="person" size={22} color={colors.primary} />
                      </View>
                      <Text style={styles.quickActionLabel}>Profile</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* DM Content */}
            {isDM && (
              <View style={styles.dmContent}>
                {/* Media Section Header */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    fetchSharedMedia();
                    setActiveTab(activeTab === 'media' ? 'members' : 'media');
                  }}
                >
                  <Icon name="images-outline" size={22} color={colors.textSecondary} />
                  <Text style={styles.menuItemText}>Media, Links, and Docs</Text>
                  <Text style={styles.menuItemCount}>
                    {sharedMedia.length + sharedLinks.length + sharedDocs.length > 0
                      ? sharedMedia.length + sharedLinks.length + sharedDocs.length
                      : ''}
                  </Text>
                  <Icon
                    name={activeTab === 'media' ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Expanded Media Section with Sub-tabs */}
                {activeTab === 'media' && (
                  <View style={styles.mediaSection}>
                    {/* Sub-tabs */}
                    <View style={styles.subTabs}>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'media' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('media')}
                      >
                        <Icon name="images-outline" size={18} color={mediaSubTab === 'media' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'media' && styles.subTabTextActive]}>
                          Media ({sharedMedia.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'links' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('links')}
                      >
                        <Icon name="link-outline" size={18} color={mediaSubTab === 'links' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'links' && styles.subTabTextActive]}>
                          Links ({sharedLinks.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'docs' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('docs')}
                      >
                        <Icon name="document-outline" size={18} color={mediaSubTab === 'docs' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'docs' && styles.subTabTextActive]}>
                          Docs ({sharedDocs.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sub-tab Content */}
                    <View style={styles.subTabContent}>
                      {isLoadingMedia ? (
                        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                      ) : mediaSubTab === 'media' ? (
                        sharedMedia.length > 0 ? (
                          <FlatList
                            data={sharedMedia}
                            renderItem={renderMediaItem}
                            keyExtractor={(item) => item.id}
                            numColumns={3}
                            scrollEnabled={false}
                          />
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="images-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared media</Text>
                          </View>
                        )
                      ) : mediaSubTab === 'links' ? (
                        sharedLinks.length > 0 ? (
                          <View style={styles.linksList}>
                            {sharedLinks.map((link) => (
                              <TouchableOpacity
                                key={link.id}
                                style={styles.linkItem}
                                onPress={() => Linking.openURL(link.url)}
                              >
                                <View style={styles.linkIcon}>
                                  <Icon name="globe-outline" size={24} color={colors.primary} />
                                </View>
                                <View style={styles.linkContent}>
                                  <Text style={styles.linkTitle} numberOfLines={1}>{link.title}</Text>
                                  <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                                </View>
                                <Icon name="open-outline" size={20} color={colors.textSecondary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="link-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared links</Text>
                          </View>
                        )
                      ) : (
                        sharedDocs.length > 0 ? (
                          <View style={styles.docsList}>
                            {sharedDocs.map((doc) => (
                              <TouchableOpacity
                                key={doc.id}
                                style={styles.docItem}
                                onPress={() => Linking.openURL(doc.url)}
                              >
                                <View style={[styles.docIcon, { backgroundColor: getDocColor(doc.fileType) }]}>
                                  <Text style={styles.docIconText}>{doc.fileType.substring(0, 3)}</Text>
                                </View>
                                <View style={styles.docContent}>
                                  <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                                  <Text style={styles.docMeta}>
                                    {doc.fileType} {formatFileSize(doc.fileSize) && `• ${formatFileSize(doc.fileSize)}`}
                                  </Text>
                                </View>
                                <Icon name="download-outline" size={22} color={colors.textSecondary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="document-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared documents</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}

                {/* Toggles */}
                <View style={styles.toggleSection}>
                  <View style={styles.toggleItem}>
                    <Icon name={isPinned ? 'pin' : 'pin-outline'} size={22} color={colors.textSecondary} />
                    <Text style={styles.toggleText}>Pin Conversation</Text>
                    <Switch
                      value={isPinned}
                      onValueChange={handlePinToggle}
                      trackColor={{ false: colors.gray[300], true: colors.primary }}
                    />
                  </View>
                  <View style={styles.toggleItem}>
                    <Icon
                      name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
                      size={22}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.toggleText}>Mute Notifications</Text>
                    <Switch
                      value={isMuted}
                      onValueChange={handleMuteToggle}
                      trackColor={{ false: colors.gray[300], true: colors.primary }}
                    />
                  </View>
                  {/* Disappearing Messages */}
                  <TouchableOpacity
                    style={styles.toggleItem}
                    onPress={() => setShowDisappearingPicker(!showDisappearingPicker)}
                  >
                    <Icon name="timer-outline" size={22} color={colors.textSecondary} />
                    <Text style={styles.toggleText}>Disappearing Messages</Text>
                    <View style={styles.disappearingValue}>
                      <Text style={styles.disappearingValueText}>
                        {getDisappearingLabel(disappearingDuration)}
                      </Text>
                      <Icon
                        name={showDisappearingPicker ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                  {showDisappearingPicker && (
                    <View style={styles.disappearingPicker}>
                      {['off', '24h', '7d', '30d', '90d'].map((duration) => (
                        <TouchableOpacity
                          key={duration}
                          style={[
                            styles.disappearingOption,
                            disappearingDuration === duration && styles.disappearingOptionActive,
                          ]}
                          onPress={() => handleDisappearingChange(duration)}
                        >
                          <Text
                            style={[
                              styles.disappearingOptionText,
                              disappearingDuration === duration && styles.disappearingOptionTextActive,
                            ]}
                          >
                            {getDisappearingLabel(duration)}
                          </Text>
                          {disappearingDuration === duration && (
                            <Icon name="checkmark" size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Danger Zone */}
                <View style={styles.dangerSection}>
                  <TouchableOpacity style={styles.dangerItem} onPress={handleBlockUser} disabled={isBlockingUser}>
                    <Icon
                      name={isOtherUserBlocked ? "lock-open-outline" : "ban-outline"}
                      size={22}
                      color={colors.warning}
                    />
                    <Text style={[styles.dangerText, { color: colors.warning }]}>
                      {isOtherUserBlocked ? 'Unblock User' : 'Block User'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerItem} onPress={handleReportUser}>
                    <Icon name="flag-outline" size={22} color={colors.warning} />
                    <Text style={[styles.dangerText, { color: colors.warning }]}>Report User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteChat}>
                    <Icon name="trash-outline" size={22} color={colors.error} />
                    <Text style={[styles.dangerText, { color: colors.error }]}>Delete Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Chatroom Content */}
            {(isChatroom || isBroadcast) && (
              <View style={styles.chatroomContent}>
                {/* Tabs */}
                <View style={styles.tabs}>
                  {/* Hide Members tab for platform/broadcast channels */}
                  {!isPlatformChannel && (
                    <TouchableOpacity
                      style={[styles.tab, activeTab === 'members' && styles.tabActive]}
                      onPress={() => setActiveTab('members')}
                    >
                      <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
                        Members
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'media' && styles.tabActive]}
                    onPress={() => {
                      setActiveTab('media');
                      fetchSharedMedia();
                    }}
                  >
                    <Text style={[styles.tabText, activeTab === 'media' && styles.tabTextActive]}>
                      Media
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
                    onPress={() => setActiveTab('settings')}
                  >
                    <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
                      Settings
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Members Tab - Hidden for platform channels */}
                {activeTab === 'members' && !isPlatformChannel && (
                  <View style={styles.tabContent}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search members..."
                      placeholderTextColor={colors.textSecondary}
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                    />

                    {/* Add Members Button */}
                    {isAdmin && !isBroadcast && (
                      <TouchableOpacity style={styles.addMembersButton} onPress={handleAddMembers}>
                        <Icon name="person-add-outline" size={20} color={colors.primary} />
                        <Text style={styles.addMembersText}>Add Members</Text>
                      </TouchableOpacity>
                    )}

                    {isLoadingMembers ? (
                      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                    ) : (
                      <FlatList
                        data={filteredMembers}
                        renderItem={renderMemberItem}
                        keyExtractor={(item) => item.userId}
                        scrollEnabled={false}
                        ListEmptyComponent={
                          <Text style={styles.emptyText}>No members found</Text>
                        }
                      />
                    )}
                  </View>
                )}

                {/* Media Tab */}
                {activeTab === 'media' && (
                  <View style={styles.mediaSection}>
                    {/* Sub-tabs */}
                    <View style={styles.subTabs}>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'media' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('media')}
                      >
                        <Icon name="images-outline" size={18} color={mediaSubTab === 'media' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'media' && styles.subTabTextActive]}>
                          Media ({sharedMedia.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'links' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('links')}
                      >
                        <Icon name="link-outline" size={18} color={mediaSubTab === 'links' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'links' && styles.subTabTextActive]}>
                          Links ({sharedLinks.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.subTab, mediaSubTab === 'docs' && styles.subTabActive]}
                        onPress={() => setMediaSubTab('docs')}
                      >
                        <Icon name="document-outline" size={18} color={mediaSubTab === 'docs' ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.subTabText, mediaSubTab === 'docs' && styles.subTabTextActive]}>
                          Docs ({sharedDocs.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sub-tab Content */}
                    <View style={styles.subTabContent}>
                      {isLoadingMedia ? (
                        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                      ) : mediaSubTab === 'media' ? (
                        sharedMedia.length > 0 ? (
                          <FlatList
                            data={sharedMedia}
                            renderItem={renderMediaItem}
                            keyExtractor={(item) => item.id}
                            numColumns={3}
                            scrollEnabled={false}
                          />
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="images-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared media</Text>
                          </View>
                        )
                      ) : mediaSubTab === 'links' ? (
                        sharedLinks.length > 0 ? (
                          <View style={styles.linksList}>
                            {sharedLinks.map((link) => (
                              <TouchableOpacity
                                key={link.id}
                                style={styles.linkItem}
                                onPress={() => Linking.openURL(link.url)}
                              >
                                <View style={styles.linkIcon}>
                                  <Icon name="globe-outline" size={24} color={colors.primary} />
                                </View>
                                <View style={styles.linkContent}>
                                  <Text style={styles.linkTitle} numberOfLines={1}>{link.title}</Text>
                                  <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                                </View>
                                <Icon name="open-outline" size={20} color={colors.textSecondary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="link-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared links</Text>
                          </View>
                        )
                      ) : (
                        sharedDocs.length > 0 ? (
                          <View style={styles.docsList}>
                            {sharedDocs.map((doc) => (
                              <TouchableOpacity
                                key={doc.id}
                                style={styles.docItem}
                                onPress={() => Linking.openURL(doc.url)}
                              >
                                <View style={[styles.docIcon, { backgroundColor: getDocColor(doc.fileType) }]}>
                                  <Text style={styles.docIconText}>{doc.fileType.substring(0, 3)}</Text>
                                </View>
                                <View style={styles.docContent}>
                                  <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
                                  <Text style={styles.docMeta}>
                                    {doc.fileType} {formatFileSize(doc.fileSize) && `• ${formatFileSize(doc.fileSize)}`}
                                  </Text>
                                </View>
                                <Icon name="download-outline" size={22} color={colors.textSecondary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.emptyMedia}>
                            <Icon name="document-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No shared documents</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <View style={styles.tabContent}>
                    {/* Edit Group Info (Admin only) */}
                    {isAdmin && !isBroadcast && (
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => setShowEditGroup(true)}
                      >
                        <Icon name="create-outline" size={22} color={colors.textSecondary} />
                        <Text style={styles.menuItemText}>Edit Group Info</Text>
                        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}

                    <View style={styles.toggleSection}>
                      {/* Hide Pin for platform channels */}
                      {!isPlatformChannel && (
                        <View style={styles.toggleItem}>
                          <Icon name={isPinned ? 'pin' : 'pin-outline'} size={22} color={colors.textSecondary} />
                          <Text style={styles.toggleText}>Pin Conversation</Text>
                          <Switch
                            value={isPinned}
                            onValueChange={handlePinToggle}
                            trackColor={{ false: colors.gray[300], true: colors.primary }}
                          />
                        </View>
                      )}
                      <View style={styles.toggleItem}>
                        <Icon
                          name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
                          size={22}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.toggleText}>Mute Notifications</Text>
                        <Switch
                          value={isMuted}
                          onValueChange={handleMuteToggle}
                          trackColor={{ false: colors.gray[300], true: colors.primary }}
                        />
                      </View>
                      {/* Disappearing Messages - Only for chatrooms, not broadcasts */}
                      {!isBroadcast && (
                        <>
                          <TouchableOpacity
                            style={styles.toggleItem}
                            onPress={() => setShowDisappearingPicker(!showDisappearingPicker)}
                          >
                            <Icon name="timer-outline" size={22} color={colors.textSecondary} />
                            <Text style={styles.toggleText}>Disappearing Messages</Text>
                            <View style={styles.disappearingValue}>
                              <Text style={styles.disappearingValueText}>
                                {getDisappearingLabel(disappearingDuration)}
                              </Text>
                              <Icon
                                name={showDisappearingPicker ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={colors.textSecondary}
                              />
                            </View>
                          </TouchableOpacity>
                          {showDisappearingPicker && (
                            <View style={styles.disappearingPicker}>
                              {['off', '24h', '7d', '30d', '90d'].map((duration) => (
                                <TouchableOpacity
                                  key={duration}
                                  style={[
                                    styles.disappearingOption,
                                    disappearingDuration === duration && styles.disappearingOptionActive,
                                  ]}
                                  onPress={() => handleDisappearingChange(duration)}
                                >
                                  <Text
                                    style={[
                                      styles.disappearingOptionText,
                                      disappearingDuration === duration && styles.disappearingOptionTextActive,
                                    ]}
                                  >
                                    {getDisappearingLabel(duration)}
                                  </Text>
                                  {disappearingDuration === duration && (
                                    <Icon name="checkmark" size={18} color={colors.primary} />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>

                    <View style={styles.dangerSection}>
                      {!isBroadcast && (
                        <TouchableOpacity style={styles.dangerItem} onPress={handleLeaveGroup}>
                          <Icon name="exit-outline" size={22} color={colors.warning} />
                          <Text style={[styles.dangerText, { color: colors.warning }]}>Leave Group</Text>
                        </TouchableOpacity>
                      )}
                      {isOwner && (
                        <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteChat}>
                          <Icon name="trash-outline" size={22} color={colors.error} />
                          <Text style={[styles.dangerText, { color: colors.error }]}>Delete Group</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Edit Group Modal */}
      <Modal visible={showEditGroup} animationType="slide" transparent>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Group</Text>
              <TouchableOpacity onPress={() => setShowEditGroup(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.editModalContent}>
              <Text style={styles.editLabel}>Group Name</Text>
              <TextInput
                style={styles.editInput}
                value={editGroupName}
                onChangeText={setEditGroupName}
                placeholder="Enter group name"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={styles.editLabel}>Description</Text>
              <TextInput
                style={[styles.editInput, styles.editInputMultiline]}
                value={editGroupDescription}
                onChangeText={setEditGroupDescription}
                placeholder="Enter group description"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveGroupSettings}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Media Gallery Modal */}
      <Modal visible={showMediaGallery} animationType="fade" transparent>
        <View style={styles.galleryOverlay}>
          <TouchableOpacity style={styles.galleryClose} onPress={() => setShowMediaGallery(false)}>
            <Icon name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          {sharedMedia[selectedMediaIndex] && (
            <Image
              source={{ uri: sharedMedia[selectedMediaIndex].url }}
              style={styles.galleryImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.galleryNav}>
            <TouchableOpacity
              style={styles.galleryNavButton}
              onPress={() => setSelectedMediaIndex(Math.max(0, selectedMediaIndex - 1))}
              disabled={selectedMediaIndex === 0}
            >
              <Icon name="chevron-back" size={32} color={selectedMediaIndex === 0 ? colors.gray[600] : colors.white} />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
              {selectedMediaIndex + 1} / {sharedMedia.length}
            </Text>
            <TouchableOpacity
              style={styles.galleryNavButton}
              onPress={() => setSelectedMediaIndex(Math.min(sharedMedia.length - 1, selectedMediaIndex + 1))}
              disabled={selectedMediaIndex === sharedMedia.length - 1}
            >
              <Icon name="chevron-forward" size={32} color={selectedMediaIndex === sharedMedia.length - 1 ? colors.gray[600] : colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    height: screenHeight * 0.1,
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight * 0.9,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray[300],
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  memberCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  statusOnline: {
    color: colors.online,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 20,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.text,
    marginTop: 6,
  },
  dmContent: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  menuItemCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  mediaGridSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mediaSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
  },
  subTabActive: {
    backgroundColor: colors.primary + '15',
  },
  subTabText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  subTabTextActive: {
    color: colors.primary,
  },
  subTabContent: {
    padding: 12,
    minHeight: 150,
  },
  linksList: {
    gap: 8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    marginBottom: 8,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
    marginRight: 8,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  linkUrl: {
    fontSize: 13,
    color: colors.primary,
  },
  docsList: {
    gap: 8,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    marginBottom: 8,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  docContent: {
    flex: 1,
    marginRight: 8,
  },
  docName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  docMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  toggleSection: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  disappearingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disappearingValueText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  disappearingPicker: {
    backgroundColor: colors.gray[50],
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  disappearingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  disappearingOptionActive: {
    backgroundColor: colors.primary + '10',
  },
  disappearingOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  disappearingOptionTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  dangerSection: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dangerText: {
    fontSize: 16,
    marginLeft: 12,
  },
  chatroomContent: {
    paddingTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchInput: {
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  addMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    marginBottom: 12,
  },
  addMembersText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  memberUsername: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberMenuButton: {
    padding: 8,
  },
  memberActionsMenu: {
    position: 'absolute',
    right: 40,
    top: 0,
    backgroundColor: colors.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
    minWidth: 180,
  },
  memberActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberActionCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
  },
  memberActionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 10,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 20,
    fontSize: 14,
  },
  mediaItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gray[200],
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gray[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFile: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  mediaFileName: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyMedia: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  // Edit Group Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: screenWidth - 40,
    maxHeight: screenHeight * 0.6,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editModalContent: {
    padding: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  editInput: {
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  editInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // Gallery Modal
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  galleryImage: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  galleryNav: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  galleryNavButton: {
    padding: 16,
  },
  galleryCounter: {
    color: colors.white,
    fontSize: 16,
    marginHorizontal: 20,
  },
});

export default ConversationInfoSheet;
