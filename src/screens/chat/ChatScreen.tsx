import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Dimensions, Linking, Modal, Alert, PermissionsAndroid, Animated, Vibration, ScrollView } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/Ionicons";
import { launchImageLibrary, launchCamera, MediaType } from "react-native-image-picker";
import DocumentPicker from "react-native-document-picker";
import { useChatStore, useAuthStore, usePresenceStore, useSettingsStore } from "../../stores";
import { useTheme } from "../../hooks";
import { config } from "../../constants";
import { ChatScreenProps } from "../../navigation/types";
import { Message } from "../../types";
import { MediaViewer } from "../../components/MediaViewer";
import { VideoRecorder } from "../../components/VideoRecorder";
import { Avatar } from "../../components/common/Avatar";
import { ConversationInfoSheet } from "../../components/ConversationInfoSheet";
import { sdk, conversations as conversationsApi, contacts as contactsApi } from "../../services/sdk";
import { signalRService } from "../../services/signalr";
import { LinkPreview, extractFirstUrl } from "../../components/chat";
import { LocationPicker } from "../../components/chat/LocationPicker";
import { LocationMessage } from "../../components/chat/LocationMessage";
import { locationService, LocationData } from "../../services/locationService";

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  // Handle URLs with or without leading slash
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

// Try to import optional packages
let EmojiPicker: any = null;

try {
  EmojiPicker = require('rn-emoji-keyboard').default;
} catch (e) {
  console.log('rn-emoji-keyboard not installed');
}

// Audio recording is not available without native module
// Users can use the video recording feature to record audio with video
const _AudioRecorderPlayer: any = null;

const { width: screenWidth } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = screenWidth * 0.65;

// Polling interval for Platform Channel (5 seconds)
const PLATFORM_CHANNEL_POLL_INTERVAL = 5000;

// Maximum characters before showing "Read more"
const MAX_MESSAGE_LENGTH = 300;

const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId, conversation: routeConversation } = route.params;
  const { messages, conversations, fetchMessages, fetchMoreMessages, fetchBroadcastMessages, fetchConversations, sendMessage, markViewOnceViewed, updateMessage, deleteMessage, editMessage, setActiveConversation, isLoading, isLoadingMore, hasMoreMessages } = useChatStore();

  // Get conversation from store (updates when store changes) or fallback to route params
  const conversation = conversations.find(c => c.id === conversationId) || routeConversation;
  const { user } = useAuthStore();
  const { onlineUsers, version: presenceVersion } = usePresenceStore();
  // Get settings from store - read directly from publicSettings to trigger re-renders
  const settingsStore = useSettingsStore();
  const publicSettings = settingsStore.publicSettings;

  // Reply settings
  const replyAllowed = publicSettings?.reply?.allowReply === true;

  // Editing settings - with defaults
  const editingSettings = {
    allowEditing: publicSettings?.editing?.allowEditing ?? true,
    editTimeLimitMinutes: publicSettings?.editing?.editTimeLimitMinutes ?? 15,
    showEditHistory: publicSettings?.editing?.showEditHistory ?? true,
  };

  // Deletion settings - with defaults
  const deletionSettings = {
    timeLimitMinutes: publicSettings?.deletion?.timeLimitMinutes ?? -1,
    deleteForMeAlwaysAllowed: publicSettings?.deletion?.deleteForMeAlwaysAllowed ?? true,
    showDeleteConfirmation: publicSettings?.deletion?.showDeleteConfirmation ?? true,
  };
  // Link preview setting
  const linkPreviewEnabled = publicSettings?.messaging?.linkPreviewEnabled !== false;
  const { colors } = useTheme();

  // Fetch settings on mount
  useEffect(() => {
    settingsStore.fetchPublicSettings();
  }, []);

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: 'image' | 'video' | 'audio' | 'file';
    fileName?: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [videoRecorderVisible, setVideoRecorderVisible] = useState(false);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName?: string }[]>([]);
  const [recordingUsers, setRecordingUsers] = useState<{ userId: string; userName?: string }[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageActionsVisible, setMessageActionsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardTargets, setForwardTargets] = useState<any[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<{ id: string; isOwn: boolean } | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [viewOnceRevealedMessages, setViewOnceRevealedMessages] = useState<Set<string>>(new Set());
  const [viewOnceTimers, setViewOnceTimers] = useState<Record<string, number>>({});
  const [revealingViewOnce, setRevealingViewOnce] = useState<string | null>(null);
  const viewOnceTimerRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const scrollOffsetRef = useRef<number>(0);
  const contentHeightRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const _audioRecorderRef = useRef<any>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingAnimValue = useRef(new Animated.Value(1)).current;
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const conversationMessages = messages[conversationId] || [];
  // Check if this is a Platform Channel (broadcast) - declared early to use in handleLoadMore
  const isBroadcast = (conversation as any)?.isBroadcast === true || (conversation as any)?.type === "BroadcastChannel";
  const reversedMessages = useMemo(() => {
    return [...conversationMessages].reverse();
  }, [conversationMessages]);

  // Memoize load more handler
  const handleLoadMore = useCallback(() => {
    if (!isBroadcast && hasMoreMessages[conversationId] && !isLoadingMore) {
      console.log('[ChatScreen] Loading more messages...');
      fetchMoreMessages(conversationId);
    }
  }, [isBroadcast, hasMoreMessages, conversationId, isLoadingMore, fetchMoreMessages]);

  // Track scroll position to prevent jumping
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    // For inverted list, "near bottom" (newest messages) is when offsetY is close to 0
    isNearBottomRef.current = offsetY < 100;
  }, []);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    const prevHeight = contentHeightRef.current;
    contentHeightRef.current = height;

    // Only auto-scroll to bottom when user is already near bottom and content grows
    if (isNearBottomRef.current && height > prevHeight && flatListRef.current) {
      // For inverted list, scrolling to offset 0 shows newest messages
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // Check if this is a DM (for call buttons)
  const isDM = conversation?.type === 'DirectMessage';
  const isChatroom = conversation?.type === 'Chatroom';

  // Toggle message expansion
  const toggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // Handle view-once message reveal
  const handleViewOnceReveal = useCallback(async (messageId: string) => {
    if (revealingViewOnce || viewOnceRevealedMessages.has(messageId)) return;

    setRevealingViewOnce(messageId);
    try {
      await markViewOnceViewed(conversationId, messageId);
      setViewOnceRevealedMessages(prev => new Set(prev).add(messageId));

      // Start countdown timer (10 seconds default)
      const timerDuration = 10;
      setViewOnceTimers(prev => ({ ...prev, [messageId]: timerDuration }));

      // Clear any existing timer
      if (viewOnceTimerRefs.current[messageId]) {
        clearInterval(viewOnceTimerRefs.current[messageId]);
      }

      // Start countdown
      viewOnceTimerRefs.current[messageId] = setInterval(() => {
        setViewOnceTimers(prev => {
          const currentTime = prev[messageId];
          if (currentTime === undefined || currentTime <= 1) {
            clearInterval(viewOnceTimerRefs.current[messageId]);
            delete viewOnceTimerRefs.current[messageId];
            // Update message in store after timer expires
            updateMessage(conversationId, messageId, {
              viewOnceViewedAt: new Date().toISOString()
            });
            const { [messageId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [messageId]: currentTime - 1 };
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to reveal view-once message:', error);
      Alert.alert('Error', 'Failed to open view-once message');
    } finally {
      setRevealingViewOnce(null);
    }
  }, [conversationId, revealingViewOnce, viewOnceRevealedMessages, markViewOnceViewed, updateMessage]);

  // Cleanup view-once timers on unmount
  useEffect(() => {
    return () => {
      Object.values(viewOnceTimerRefs.current).forEach(timer => clearInterval(timer));
    };
  }, []);

  const openMedia = (url: string, type: 'image' | 'video' | 'audio' | 'file', fileName?: string) => {
    setSelectedMedia({ url, type, fileName });
    setMediaViewerVisible(true);
  };

  const closeMedia = () => {
    setMediaViewerVisible(false);
    setSelectedMedia(null);
  };

  useEffect(() => {
    setActiveConversation(conversationId);

    // Fetch messages based on conversation type
    if (isBroadcast) {
      fetchBroadcastMessages(conversationId, true);

      // Set up polling for Platform Channel (every 5 seconds)
      pollIntervalRef.current = setInterval(() => {
        fetchBroadcastMessages(conversationId, true);
      }, PLATFORM_CHANNEL_POLL_INTERVAL);
    } else {
      fetchMessages(conversationId, true);
    }

    return () => {
      setActiveConversation(null);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [conversationId, isBroadcast]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (isBroadcast) return; // No typing indicators for broadcasts

    const unsubscribe = signalRService.onTyping((data: any) => {
      const typingConversationId = data?.conversationId || data?.ConversationId;
      const typingUserId = data?.userId || data?.UserId;
      const typingUserName = data?.userName || data?.UserName || data?.user?.name;
      const isStoppedTyping = data?.stoppedTyping === true;

      // Only handle typing for this conversation and not from current user
      if (typingConversationId !== conversationId || typingUserId === user?.id) {
        return;
      }

      // If user stopped typing, remove them from the list
      if (isStoppedTyping) {
        setTypingUsers(prev => prev.filter(u => u.userId !== typingUserId));
        return;
      }

      // Add user to typing list
      setTypingUsers(prev => {
        const exists = prev.some(u => u.userId === typingUserId);
        if (exists) return prev;
        return [...prev, { userId: typingUserId, userName: typingUserName }];
      });

      // Remove user from typing list after 3 seconds (fallback if StoppedTyping event not received)
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== typingUserId));
      }, 3000);
    });

    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, isBroadcast, user?.id]);

  // Subscribe to recording indicators
  useEffect(() => {
    if (isBroadcast) return; // No recording indicators for broadcasts

    const unsubscribe = signalRService.onRecording((data: any) => {
      const recordingConversationId = data?.conversationId || data?.ConversationId;
      const recordingUserId = data?.userId || data?.UserId;
      const recordingUserName = data?.userName || data?.UserName || data?.user?.name;
      const isStoppedRecording = data?.stoppedRecording === true;

      // Only handle recording for this conversation and not from current user
      if (recordingConversationId !== conversationId || recordingUserId === user?.id) {
        return;
      }

      // If user stopped recording, remove them from the list
      if (isStoppedRecording) {
        setRecordingUsers(prev => prev.filter(u => u.userId !== recordingUserId));
        return;
      }

      // Add user to recording list
      setRecordingUsers(prev => {
        const exists = prev.some(u => u.userId === recordingUserId);
        if (exists) return prev;
        return [...prev, { userId: recordingUserId, userName: recordingUserName }];
      });

      // Remove user from recording list after 10 seconds (fallback)
      setTimeout(() => {
        setRecordingUsers(prev => prev.filter(u => u.userId !== recordingUserId));
      }, 10000);
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId, isBroadcast, user?.id]);

  // Send typing indicator (debounced)
  const sendTypingIndicator = useCallback(() => {
    if (isBroadcast) return;

    const now = Date.now();
    // Only send typing indicator every 2 seconds
    if (now - lastTypingSentRef.current < 2000) return;

    lastTypingSentRef.current = now;
    signalRService.sendTyping(conversationId).catch(err => {
      console.log('Failed to send typing indicator:', err);
    });
  }, [conversationId, isBroadcast]);

  // Handle initiating a call
  const handleCall = useCallback(async (callType: 'voice' | 'video') => {
    if (isDM) {
      // For DMs, use otherUserId directly (more reliable) or fallback to participants
      let targetUserId = (conversation as any)?.otherUserId;
      let targetUserName = conversation?.name || 'Unknown';
      let targetUserAvatar = (conversation as any)?.otherUserAvatarUrl;

      // If otherUserId not available, try to find from participants
      if (!targetUserId && conversation?.participants) {
        const otherParticipant = conversation.participants.find(
          (p: any) => (p.userId || p.user?.id) !== user?.id
        );
        targetUserId = otherParticipant?.userId || otherParticipant?.user?.id;
        targetUserName = otherParticipant?.user?.name || otherParticipant?.user?.username || conversation?.name || 'Unknown';
        targetUserAvatar = otherParticipant?.user?.avatarUrl;
      }

      // If still no target user ID, fetch conversation details from API
      if (!targetUserId && conversationId) {
        try {
          console.log('Fetching conversation details to get other user ID...');
          const detail = await sdk.conversations.get(conversationId);
          console.log('Conversation detail:', JSON.stringify(detail, null, 2));

          if (detail?.participants) {
            const otherParticipant = detail.participants.find(
              (p: any) => (p.userId || p.user?.id) !== user?.id
            );
            targetUserId = otherParticipant?.userId || otherParticipant?.user?.id;
            targetUserName = otherParticipant?.user?.name || otherParticipant?.user?.username || conversation?.name || 'Unknown';
            targetUserAvatar = otherParticipant?.user?.avatarUrl;
          }
        } catch (error) {
          console.error('Failed to fetch conversation details:', error);
        }
      }

      if (!targetUserId) {
        console.error('Cannot initiate call: No target user ID found. Conversation:', JSON.stringify(conversation, null, 2));
        Alert.alert('Error', 'Unable to start call. Could not find target user.');
        return;
      }

      const targetUser = {
        id: targetUserId,
        name: targetUserName,
        username: '',
        avatarUrl: targetUserAvatar,
      };

      console.log('Initiating call to user:', targetUser);

      // Navigate to the CallsTab -> Call screen
      navigation.getParent()?.navigate('CallsTab', {
        screen: 'Call',
        params: {
          user: targetUser,
          type: callType,
        },
      });
    } else if (isChatroom) {
      // For chatrooms, navigate to LiveKit group call
      Alert.alert(
        'Group Call',
        `Start a ${callType} call with ${conversation?.name || 'this group'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: () => {
              // Navigate to GroupCall screen (uses LiveKit)
              navigation.getParent()?.getParent()?.navigate('GroupCall', {
                conversationId: conversationId,
                conversationName: conversation?.name,
                type: callType,
              });
            },
          },
        ]
      );
    }
  }, [isDM, isChatroom, conversation, conversationId, user, navigation]);

  // Determine the display name for the conversation
  // API returns 'name' directly for all types: DMs (other user's name), Chatrooms, Channels
  const getConversationDisplayName = useCallback(() => {
    if (!conversation) return 'Chat';

    // Use conversation name directly (API provides correct name for all types)
    if (conversation.name) {
      return conversation.name;
    }

    // Fallbacks based on type
    if (isDM) return 'Direct Message';
    if (isChatroom) return 'Chatroom';
    if (isBroadcast) return 'Platform Channel';

    return 'Chat';
  }, [conversation, isDM, isChatroom, isBroadcast]);

  // Get other participant's status for DMs - uses presence store for real-time updates
  const getOtherParticipantStatus = useCallback((): 'online' | 'offline' | undefined => {
    if (!isDM || !conversation) return undefined;

    // API returns otherUserId directly for DMs (may not be in type definition)
    const otherUserId = (conversation as any).otherUserId;

    // Check presence store for real-time status (from SignalR)
    if (otherUserId && onlineUsers[otherUserId]) {
      return 'online';
    }

    return 'offline';
  }, [isDM, conversation, onlineUsers, presenceVersion]);

  // Set up header with avatar, name, and call buttons
  useEffect(() => {
    const displayName = getConversationDisplayName();
    const avatarUrl = conversation?.avatarUrl;
    const userStatus = getOtherParticipantStatus();

    // Calculate max width for title (screen width minus back button, call buttons, and padding)
    const maxTitleWidth = screenWidth - 180; // Reserve space for back button (~50) + call buttons (~80) + padding (~50)

    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', maxWidth: maxTitleWidth }}
          onPress={() => setInfoSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={avatarUrl}
            name={displayName}
            size={36}
            status={userStatus}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1, maxWidth: maxTitleWidth - 50 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            {isDM && userStatus && (
              <Text style={{ fontSize: 12, color: userStatus === 'online' ? colors.online : colors.textSecondary }}>
                {userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
              </Text>
            )}
            {isBroadcast && (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {(conversation as any)?.isPlatformChannel ? 'Official Channel' : 'Broadcast Channel'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        !isBroadcast ? (
          <View style={{ flexDirection: 'row', marginRight: 8 }}>
            <TouchableOpacity
              onPress={() => handleCall('voice')}
              style={{ padding: 8, marginRight: 4 }}
            >
              <Icon name="call-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCall('video')}
              style={{ padding: 8 }}
            >
              <Icon name="videocam-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null
      ),
    });
  }, [navigation, conversation, isBroadcast, isDM, handleCall, getConversationDisplayName, getOtherParticipantStatus, onlineUsers, presenceVersion]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || sending) return;

    // Clear input immediately for responsive UI
    const messageContent = inputText.trim();
    const viewOnceFlag = isViewOnce;
    const replyId = replyToMessage?.id;
    setInputText("");
    setIsViewOnce(false);
    setReplyToMessage(null);

    // Send stopped typing indicator
    signalRService.sendStoppedTyping(conversationId).catch(() => {});

    // Start sending message (don't await - optimistic update happens immediately)
    // The message will show "sending" status until API responds
    sendMessage(conversationId, messageContent, undefined, viewOnceFlag, replyId).catch((err) => {
      console.error('Send message error:', err);
    });
  }, [inputText, sending, sendMessage, conversationId, isViewOnce, replyToMessage]);

  // Upload file to server - returns attachment data with id and url
  const uploadFile = useCallback(async (uri: string, fileName: string, mimeType: string): Promise<{id: string, url: string, fileName?: string, contentType?: string, fileSize?: number} | null> => {
    try {
      // On Android, ensure the URI has proper format
      let fileUri = uri;
      if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
        fileUri = `file://${uri}`;
      }

      console.log('Uploading file:', { uri: fileUri, fileName, mimeType });

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);

      const token = sdk.getAccessToken();
      const baseUrl = config.API_BASE_URL;
      const uploadUrl = `${baseUrl}/media/upload?conversationId=${conversationId}`;

      console.log('Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - fetch will set it with the correct boundary for FormData
        },
        body: formData,
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Upload response text:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse upload response:', parseError);
        return null;
      }
      console.log('Upload result:', JSON.stringify(result, null, 2));

      // Handle wrapped API response format: { success: true, data: {...} }
      const data = result.data || result;

      // Return the full upload data including id (attachment ID) and downloadUrl
      if (!data.id) {
        console.error('No attachment ID in upload response:', result);
        Alert.alert('Upload Response Error', `Server returned: ${JSON.stringify(result).substring(0, 200)}`);
        return null;
      }

      console.log('Uploaded file - ID:', data.id, 'URL:', data.downloadUrl);

      // Return object with both id and url
      return {
        id: data.id,
        url: data.downloadUrl || data.url,
        fileName: data.fileName,
        contentType: data.contentType,
        fileSize: data.fileSize,
      };
    } catch (error: any) {
      console.error('Upload error:', error?.message || error);
      return null;
    }
  }, [conversationId]);

  // Send message with attachment - uses attachment ID from upload response
  const sendWithAttachment = useCallback((
    attachmentData: {id: string, url: string, fileName?: string, contentType?: string, fileSize?: number},
    messageType: string,
    caption?: string,
    viewOnce?: boolean
  ) => {
    const content = caption || '';
    // Pass the attachment with its ID - the backend expects attachmentIds
    const attachments = [{
      id: attachmentData.id,
      url: attachmentData.url,
      type: messageType,
      fileName: attachmentData.fileName,
      contentType: attachmentData.contentType,
      fileSize: attachmentData.fileSize,
    }];
    console.log('Sending with attachment:', { content, attachments, isViewOnce: viewOnce || isViewOnce });

    // Reset view-once immediately
    setIsViewOnce(false);

    // Fire and forget - optimistic update happens immediately in sendMessage
    sendMessage(conversationId, content, attachments, viewOnce || isViewOnce).catch((error) => {
      console.error('Failed to send attachment:', error);
    });
  }, [conversationId, sendMessage, isViewOnce]);

  // Pick image from gallery
  const handlePickImage = useCallback(async () => {
    setAttachmentMenuVisible(false);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Selected image:', { uri: asset.uri, fileName: asset.fileName, type: asset.type });
        if (asset.uri) {
          setUploadingMedia(true);
          try {
            const fileName = asset.fileName || `image_${Date.now()}.jpg`;
            const mimeType = asset.type || 'image/jpeg';
            const uploadResult = await uploadFile(asset.uri, fileName, mimeType);
            if (uploadResult) {
              sendWithAttachment(uploadResult, 'image');
            } else {
              Alert.alert('Upload Failed', 'Could not upload image. Check console for details.');
            }
          } catch (uploadError: any) {
            console.error('Upload error:', uploadError);
            Alert.alert('Upload Error', uploadError?.message || 'Failed to upload image');
          } finally {
            setUploadingMedia(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Picker Error', error?.message || 'Failed to open image picker');
    }
  }, [sendWithAttachment, uploadFile]);

  // Pick video from gallery
  const handlePickVideo = useCallback(async () => {
    setAttachmentMenuVisible(false);
    try {
      const result = await launchImageLibrary({
        mediaType: 'video' as MediaType,
        quality: 0.8,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Selected video:', { uri: asset.uri, fileName: asset.fileName, type: asset.type });
        if (asset.uri) {
          setUploadingMedia(true);
          try {
            const fileName = asset.fileName || `video_${Date.now()}.mp4`;
            const mimeType = asset.type || 'video/mp4';
            const uploadResult = await uploadFile(asset.uri, fileName, mimeType);
            if (uploadResult) {
              sendWithAttachment(uploadResult, 'video');
            } else {
              Alert.alert('Upload Failed', 'Could not upload video. Check console for details.');
            }
          } catch (uploadError: any) {
            console.error('Upload error:', uploadError);
            Alert.alert('Upload Error', uploadError?.message || 'Failed to upload video');
          } finally {
            setUploadingMedia(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Video picker error:', error);
      Alert.alert('Picker Error', error?.message || 'Failed to open video picker');
    }
  }, [sendWithAttachment, uploadFile]);

  // Take photo with camera
  const handleTakePhoto = useCallback(async () => {
    setAttachmentMenuVisible(false);
    try {
      // Request camera permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Camera permission is required');
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('Captured photo:', { uri: asset.uri, fileName: asset.fileName, type: asset.type });
        if (asset.uri) {
          setUploadingMedia(true);
          try {
            const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
            const mimeType = asset.type || 'image/jpeg';
            const uploadResult = await uploadFile(asset.uri, fileName, mimeType);
            if (uploadResult) {
              sendWithAttachment(uploadResult, 'image');
            } else {
              Alert.alert('Upload Failed', 'Could not upload photo. Check console for details.');
            }
          } catch (uploadError: any) {
            console.error('Upload error:', uploadError);
            Alert.alert('Upload Error', uploadError?.message || 'Failed to upload photo');
          } finally {
            setUploadingMedia(false);
          }
        }
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', error?.message || 'Failed to open camera');
    }
  }, [sendWithAttachment, uploadFile]);

  // Pick document/file
  const handlePickDocument = useCallback(async () => {
    setAttachmentMenuVisible(false);
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      if (result && result[0]) {
        const file = result[0];
        console.log('Selected document:', { uri: file.uri, name: file.name, type: file.type });
        setUploadingMedia(true);
        try {
          const fileName = file.name || `file_${Date.now()}`;
          const mimeType = file.type || 'application/octet-stream';
          const uploadResult = await uploadFile(file.uri, fileName, mimeType);
          if (uploadResult) {
            sendWithAttachment(uploadResult, 'file');
          } else {
            Alert.alert('Upload Failed', 'Could not upload file. Check console for details.');
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload Error', uploadError?.message || 'Failed to upload file');
        } finally {
          setUploadingMedia(false);
        }
      }
    } catch (error: any) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('Document picker error:', error);
        Alert.alert('Picker Error', error?.message || 'Failed to open document picker');
      }
    }
  }, [sendWithAttachment, uploadFile]);

  // Share location
  // Share location - open location picker modal
  const handleShareLocation = useCallback(() => {
    setAttachmentMenuVisible(false);
    setLocationPickerVisible(true);
  }, []);

  // Handle location selected from picker
  const handleLocationSelect = useCallback((location: LocationData) => {
    const locationContent = locationService.serializeLocationData(location);

    // Fire and forget - optimistic update happens immediately
    sendMessage(conversationId, locationContent, [{ type: 'location' }]).catch(console.error);
  }, [conversationId, sendMessage]);


  // Record video using in-app camera
  const handleRecordVideo = useCallback(() => {
    setAttachmentMenuVisible(false);
    setVideoRecorderVisible(true);
  }, []);

  // Handle video recorded from VideoRecorder
  const handleVideoRecorded = useCallback(async (videoUri: string, duration: number) => {
    console.log('Video recorded:', { videoUri, duration });
    setUploadingMedia(true);
    try {
      const fileName = `video_${Date.now()}.mp4`;
      const mimeType = 'video/mp4';
      const uploadResult = await uploadFile(videoUri, fileName, mimeType);
      if (uploadResult) {
        sendWithAttachment(uploadResult, 'video');
      } else {
        Alert.alert('Upload Failed', 'Could not upload video.');
      }
    } catch (error: any) {
      console.error('Video upload error:', error);
      Alert.alert('Upload Error', error?.message || 'Failed to upload video');
    } finally {
      setUploadingMedia(false);
    }
  }, [uploadFile, sendWithAttachment]);

  // Process video asset (shared between record and pick)
  const _processVideoAsset = useCallback(async (asset: any) => {
    console.log('Processing video:', { uri: asset.uri, fileName: asset.fileName, type: asset.type, fileSize: asset.fileSize });
    setUploadingMedia(true);
    try {
      const fileName = asset.fileName || `video_${Date.now()}.mp4`;
      const mimeType = asset.type || 'video/mp4';
      console.log('Uploading video with:', { fileName, mimeType, uri: asset.uri });
      const uploadResult = await uploadFile(asset.uri, fileName, mimeType);
      console.log('Video upload result:', uploadResult);
      if (uploadResult) {
        console.log('Sending video with attachment:', uploadResult);
        sendWithAttachment(uploadResult, 'video');
        console.log('Video sent successfully');
      } else {
        console.log('Upload returned null');
        Alert.alert('Upload Failed', 'Could not upload video.');
      }
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      Alert.alert('Upload Error', uploadError?.message || 'Failed to upload video');
    } finally {
      setUploadingMedia(false);
    }
  }, [sendWithAttachment, uploadFile]);

  // Start audio recording
  const startAudioRecording = useCallback(async () => {
    // Audio recording requires native module - show alternative
    Alert.alert(
      'Voice Message',
      'Voice message recording requires additional setup. You can record a video instead and the audio will be captured.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record Video',
          onPress: () => {
            handleRecordVideo();
          },
        },
      ]
    );
  }, [handleRecordVideo]);

  // Stop and send audio recording (placeholder - not used without native module)
  const stopAudioRecording = useCallback(async () => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // Cancel audio recording (placeholder - not used without native module)
  const cancelAudioRecording = useCallback(async () => {
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // Format recording duration
  const formatRecordingDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle emoji selection
  const handleEmojiSelected = useCallback((emoji: any) => {
    setInputText((prev) => prev + (emoji.emoji || emoji));
    setEmojiPickerVisible(false);
  }, []);

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Helper to check if URL is an image
  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|tiff|heic|heif)(\?|$)/i.test(url);
  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|ogv|ts|mts)(\?|$)/i.test(url);
  const isAudioUrl = (url: string) => /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|amr|3gpp)(\?|$)/i.test(url);

  // Helper to parse location data from message content
  const parseLocationData = (content: string): { latitude: number; longitude: number; address?: string; name?: string } | null => {
    try {
      // Try to parse as JSON first
      if (content.startsWith('{')) {
        const data = JSON.parse(content);
        if (data.latitude && data.longitude) {
          return {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            address: data.address,
            name: data.name,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // Open location in maps app
  const openLocationInMaps = (latitude: number, longitude: number, label?: string) => {
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const latLng = `${latitude},${longitude}`;
    const labelText = label ? encodeURIComponent(label) : '';

    const url = Platform.select({
      ios: `${scheme}${latLng}?q=${labelText || latLng}`,
      android: `${scheme}${latLng}?q=${latLng}(${labelText})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
      });
    }
  };

  // Get attachment URL from message (converts relative URLs to absolute)
  const getAttachmentUrl = (item: any): string | null => {
    let url: string | null = null;

    // Check attachments array first
    if (item.attachments && item.attachments.length > 0) {
      const attachment = item.attachments[0];
      if (typeof attachment === 'string') {
        url = attachment;
      } else if (attachment?.url && typeof attachment.url === 'string') {
        url = attachment.url;
      }
    }
    // Check imageUrl (broadcast messages)
    if (!url && item.imageUrl && typeof item.imageUrl === 'string') {
      url = item.imageUrl;
    }
    // Check mediaUrl
    if (!url && item.mediaUrl && typeof item.mediaUrl === 'string') {
      url = item.mediaUrl;
    }

    // Convert relative URL to absolute
    return url ? (toAbsoluteUrl(url) || null) : null;
  };

  // Get attachment file name from message
  const getAttachmentFileName = (item: any): string => {
    // Check attachments array for fileName
    if (item.attachments && item.attachments.length > 0) {
      const attachment = item.attachments[0];
      if (attachment.fileName) return attachment.fileName;
      if (attachment.name) return attachment.name;
      if (attachment.originalName) return attachment.originalName;
    }
    // Check direct fileName field
    if (item.fileName) return item.fileName;
    if (item.originalFileName) return item.originalFileName;
    // Check title field (some APIs use this)
    if (item.title) return item.title;

    // Fall back to extracting from URL
    const url = getAttachmentUrl(item);
    if (url && typeof url === 'string') {
      const pathPart = url.split('?')[0];
      const urlFileName = pathPart.split('/').pop() || '';

      // Check if filename looks like a UUID (e.g., 46265bb8-1328-4403-a28f-2779168fca2d.webp)
      const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\./i;
      if (uuidPattern.test(urlFileName)) {
        // Extract extension and return friendly name
        const ext = urlFileName.split('.').pop()?.toLowerCase() || '';
        const friendlyNames: Record<string, string> = {
          // Images
          jpg: 'Image.jpg', jpeg: 'Image.jpeg', png: 'Image.png', gif: 'Image.gif', webp: 'Image.webp',
          // Videos
          mp4: 'Video.mp4', webm: 'Video.webm', mov: 'Video.mov', avi: 'Video.avi',
          // Audio
          mp3: 'Audio.mp3', wav: 'Audio.wav', ogg: 'Audio.ogg', m4a: 'Audio.m4a',
          // Documents
          pdf: 'Document.pdf', doc: 'Document.doc', docx: 'Document.docx',
          xls: 'Spreadsheet.xls', xlsx: 'Spreadsheet.xlsx',
          ppt: 'Presentation.ppt', pptx: 'Presentation.pptx',
          txt: 'Text File.txt', csv: 'Data File.csv',
          zip: 'Archive.zip', rar: 'Archive.rar',
        };
        return friendlyNames[ext] || `File.${ext}`;
      }

      // Return the actual filename if it doesn't look like a UUID
      if (urlFileName) return urlFileName;
    }
    return 'File';
  };

  // Helper to get thumbnail URL for a message
  const getMessageThumbnailUrl = (item: any): string | null => {
    if (!item) return null;
    // Check for thumbnailUrl in attachments
    if (item.attachments && item.attachments.length > 0) {
      const attachment = item.attachments[0];
      if (attachment.thumbnailUrl) {
        return toAbsoluteUrl(attachment.thumbnailUrl) || null;
      }
    }
    // For images, use the image URL directly as thumbnail
    const url = getAttachmentUrl(item);
    if (url && isImageUrl(url)) {
      return url;
    }
    return null;
  };

  // Helper to get media type and info for reply preview
  const getReplyMediaInfo = (message: any): { type: 'text' | 'image' | 'video' | 'audio' | 'file'; thumbnailUrl: string | null; fileName: string | null; duration: number | null } => {
    if (!message) return { type: 'text', thumbnailUrl: null, fileName: null, duration: null };

    const attachmentUrl = getAttachmentUrl(message);
    if (!attachmentUrl) {
      return { type: 'text', thumbnailUrl: null, fileName: null, duration: null };
    }

    const thumbnailUrl = getMessageThumbnailUrl(message);
    const fileName = getAttachmentFileName(message);
    const duration = message.attachments?.[0]?.duration || message.duration || null;

    if (isImageUrl(attachmentUrl)) {
      return { type: 'image', thumbnailUrl, fileName, duration: null };
    }
    if (isVideoUrl(attachmentUrl)) {
      return { type: 'video', thumbnailUrl, fileName, duration };
    }
    if (isAudioUrl(attachmentUrl)) {
      return { type: 'audio', thumbnailUrl: null, fileName, duration };
    }
    return { type: 'file', thumbnailUrl: null, fileName, duration: null };
  };

  // Render reply preview content with media support
  const renderReplyPreviewContent = (message: any, isOwn: boolean = false, isInBubble: boolean = false) => {
    const mediaInfo = getReplyMediaInfo(message);
    const textColor = isInBubble
      ? (isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary)
      : colors.textSecondary;

    // For text messages, just show the content
    if (mediaInfo.type === 'text') {
      return (
        <Text
          style={[
            isInBubble ? styles.replyPreviewText : styles.replyText,
            isInBubble && isOwn && styles.replyPreviewTextOwn
          ]}
          numberOfLines={1}
        >
          {message?.content || '[Message]'}
        </Text>
      );
    }

    // For media messages, show thumbnail/icon + description
    const getIconName = () => {
      switch (mediaInfo.type) {
        case 'image': return 'image';
        case 'video': return 'videocam';
        case 'audio': return 'mic';
        case 'file': return 'document';
        default: return 'attach';
      }
    };

    const getMediaTypeLabel = () => {
      switch (mediaInfo.type) {
        case 'image': return 'Photo';
        case 'video': return 'Video';
        case 'audio': return 'Voice message';
        case 'file': return 'File';
        default: return 'Media';
      }
    };

    const getCaption = () => {
      // If there's content/caption, show type + caption
      if (message?.content && message.content.trim()) {
        return message.content;
      }
      // Otherwise show type with duration if available
      if (mediaInfo.duration && (mediaInfo.type === 'video' || mediaInfo.type === 'audio')) {
        const mins = Math.floor(mediaInfo.duration / 60);
        const secs = Math.floor(mediaInfo.duration % 60);
        return `${getMediaTypeLabel()} (${mins}:${secs.toString().padStart(2, '0')})`;
      }
      if (mediaInfo.type === 'file' && mediaInfo.fileName) {
        return mediaInfo.fileName;
      }
      return getMediaTypeLabel();
    };

    const hasThumbnail = mediaInfo.thumbnailUrl && (mediaInfo.type === 'image' || mediaInfo.type === 'video');
    const iconColor = isOwn ? 'rgba(255,255,255,0.8)' : colors.primary;

    return (
      <View style={styles.replyMediaContainer}>
        {/* Show thumbnail for images/videos when available */}
        {hasThumbnail ? (
          <View style={styles.replyThumbnailContainer}>
            <Image
              source={{ uri: mediaInfo.thumbnailUrl || undefined }}
              style={styles.replyThumbnail}
              resizeMode="cover"
            />
            {mediaInfo.type === 'video' && (
              <View style={styles.replyVideoOverlay}>
                <Icon name="play" size={16} color="#fff" />
              </View>
            )}
          </View>
        ) : (
          /* Show larger icon placeholder when no thumbnail */
          <View style={[
            styles.replyMediaIcon,
            { backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : `${colors.primary}15` }
          ]}>
            <Icon name={getIconName()} size={20} color={iconColor} />
          </View>
        )}
        {/* Label with inline icon for clarity */}
        <View style={styles.replyMediaLabel}>
          <Icon
            name={`${getIconName()}-outline`}
            size={14}
            color={textColor}
            style={styles.replyMediaIconSmall}
          />
          <Text
            style={[
              isInBubble ? styles.replyPreviewText : styles.replyText,
              isInBubble && isOwn && styles.replyPreviewTextOwn,
              styles.replyMediaText
            ]}
            numberOfLines={1}
          >
            {getCaption()}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessageContent = (item: any, isOwn: boolean) => {
    const attachmentUrl = getAttachmentUrl(item);
    const hasText = item.content && item.content.trim().length > 0;

    // Determine actual media type from URL, not from message type field
    const getMediaType = (url: string | null): 'image' | 'video' | 'audio' | 'file' | null => {
      if (!url) return null;
      if (isImageUrl(url)) return 'image';
      if (isVideoUrl(url)) return 'video';
      if (isAudioUrl(url)) return 'audio';
      return 'file'; // Default to file for any other attachment
    };

    const actualMediaType = getMediaType(attachmentUrl);

    // Render image - only if URL is actually an image
    if (attachmentUrl && actualMediaType === 'image') {
      return (
        <View>
          <TouchableOpacity onPress={() => attachmentUrl && openMedia(attachmentUrl, 'image')}>
            <Image
              source={{ uri: attachmentUrl! }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          {hasText && (
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn, { marginTop: 8 }]}>
              {item.content}
            </Text>
          )}
        </View>
      );
    }

    // Render video
    if (attachmentUrl && actualMediaType === 'video') {
      const videoFileName = getAttachmentFileName(item);
      return (
        <TouchableOpacity
          style={styles.mediaContainer}
          onPress={() => openMedia(attachmentUrl, 'video', videoFileName)}
        >
          <View style={styles.videoPlaceholder}>
            <Icon name="play" size={40} color={colors.white} />
            <Text style={styles.mediaLabel}>Video</Text>
          </View>
          {hasText && (
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn, { marginTop: 8 }]}>
              {item.content}
            </Text>
          )}
        </TouchableOpacity>
      );
    }

    // Render audio/voice message
    if (attachmentUrl && actualMediaType === 'audio') {
      const audioFileName = getAttachmentFileName(item);
      return (
        <TouchableOpacity
          style={styles.audioContainer}
          onPress={() => openMedia(attachmentUrl, 'audio', audioFileName)}
        >
          <Icon name="musical-notes" size={24} color={isOwn ? colors.white : colors.primary} />
          <Text style={[styles.audioLabel, isOwn && { color: colors.white }]}>Voice Message</Text>
          <Icon name="play" size={20} color={isOwn ? colors.white : colors.primary} />
        </TouchableOpacity>
      );
    }

    // Render file/document (any attachment that's not image/video/audio)
    if (attachmentUrl && actualMediaType === 'file') {
      const fileName = getAttachmentFileName(item);
      return (
        <TouchableOpacity
          style={styles.fileContainer}
          onPress={() => openMedia(attachmentUrl, 'file', fileName)}
        >
          <Icon name="document-text" size={32} color={isOwn ? colors.white : colors.primary} />
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, isOwn && { color: colors.white }]} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={[styles.fileTap, isOwn && { color: 'rgba(255,255,255,0.7)' }]}>Tap to download</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Render location with LocationMessage component
    if (item.type?.toLowerCase() === 'location' || (hasText && item.content.includes('"latitude"'))) {
      const parsedLocation = locationService.parseLocationData(item.content);
      if (parsedLocation) {
        return <LocationMessage location={parsedLocation} isOwn={isOwn} />;
      }
      // Fallback for unparseable location
      return (
        <TouchableOpacity
          style={styles.locationContainer}
          onPress={() => {
            // Try to parse any coordinates from content
            const match = item.content.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
            if (match) {
              locationService.openInMaps(parseFloat(match[1]), parseFloat(match[2]), 'Shared Location');
            }
          }}
        >
          <Icon name="location" size={32} color={isOwn ? colors.white : colors.primary} />
          <Text style={[styles.locationLabel, isOwn && { color: colors.white }]}>
            Location
          </Text>
        </TouchableOpacity>
      );
    }

    // Default: render text with "Read more" for long messages
    if (hasText) {
      const content = item.content;
      const isLongMessage = content.length > MAX_MESSAGE_LENGTH;
      const isExpanded = expandedMessages.has(item.id);
      const displayText = isLongMessage && !isExpanded
        ? content.substring(0, MAX_MESSAGE_LENGTH) + '...'
        : content;

      // Check for URLs to show link preview
      const firstUrl = linkPreviewEnabled ? extractFirstUrl(content) : null;

      return (
        <View>
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {displayText}
          </Text>
          {isLongMessage && (
            <TouchableOpacity onPress={() => toggleMessageExpansion(item.id)}>
              <Text style={[styles.readMoreText, isOwn && styles.readMoreTextOwn]}>
                {isExpanded ? 'Show less' : 'Read more'}
              </Text>
            </TouchableOpacity>
          )}
          {firstUrl && (
            <LinkPreview url={firstUrl} isOwn={isOwn} />
          )}
        </View>
      );
    }

    return (
      <Text style={[styles.messageText, isOwn && styles.messageTextOwn, { fontStyle: 'italic' }]}>
        [Media]
      </Text>
    );
  };

  // Render message status indicator
  const renderStatusIndicator = (status: string | undefined, isOwn: boolean) => {
    if (!isOwn) return null;

    const iconColor = 'rgba(255,255,255,0.7)';
    const iconSize = 14;

    switch (status) {
      case 'sending':
        return <Icon name="time-outline" size={iconSize} color={iconColor} style={styles.statusIcon} />;
      case 'sent':
        return <Icon name="checkmark" size={iconSize} color={iconColor} style={styles.statusIcon} />;
      case 'delivered':
        return <Icon name="checkmark-done" size={iconSize} color={iconColor} style={styles.statusIcon} />;
      case 'read':
        return <Icon name="checkmark-done" size={iconSize} color="#4FC3F7" style={styles.statusIcon} />;
      case 'viewed':
        return <Icon name="eye" size={iconSize} color="#4FC3F7" style={styles.statusIcon} />;
      case 'played':
        return <Icon name="play" size={iconSize} color="#4FC3F7" style={styles.statusIcon} />;
      case 'failed':
        return <Icon name="alert-circle" size={iconSize} color="#FF5252" style={styles.statusIcon} />;
      default:
        // Default to sent for messages without status (older messages)
        return <Icon name="checkmark" size={iconSize} color={iconColor} style={styles.statusIcon} />;
    }
  };

  // Handle reply action when message is swiped
  const handleReply = useCallback((message: Message) => {
    // Check if reply is allowed
    if (!replyAllowed) return;

    setReplyToMessage(message);
    // Close the swipeable
    if (swipeableRefs.current[message.id]) {
      swipeableRefs.current[message.id]?.close();
    }
  }, [replyAllowed]);

  // Clear reply
  const clearReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  // Long press to show message actions
  const handleMessageLongPress = useCallback((message: Message) => {
    const messageType = ((message as any).type || 'text').toLowerCase();
    // Don't show actions for system or call messages
    if (messageType === 'system' || messageType === 'voicecall' || messageType === 'videocall') {
      return;
    }
    Vibration.vibrate(50);
    setSelectedMessage(message);
    setMessageActionsVisible(true);
  }, []);

  // Close message actions menu
  const closeMessageActions = useCallback(() => {
    setMessageActionsVisible(false);
    setSelectedMessage(null);
  }, []);

  // Copy message text - disabled (requires @react-native-clipboard/clipboard package)
  // const handleCopyMessage = useCallback(() => { }, []);

  // Reply to message from action menu
  const handleReplyFromMenu = useCallback(() => {
    // Check if reply is allowed
    if (!replyAllowed) {
      closeMessageActions();
      return;
    }

    if (selectedMessage) {
      setReplyToMessage(selectedMessage);
    }
    closeMessageActions();
  }, [selectedMessage, closeMessageActions, replyAllowed]);

  // Open edit modal
  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditingMessageId(selectedMessage.id);
      setEditText(selectedMessage.content || '');
      setEditModalVisible(true);
      setMessageActionsVisible(false);
      setSelectedMessage(null);
    }
  }, [selectedMessage]);

  // Submit edit
  const handleSubmitEdit = useCallback(async () => {
    if (!editingMessageId) {
      Alert.alert('Error', 'No message selected');
      return;
    }

    if (!editText.trim()) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    try {
      await editMessage(conversationId, editingMessageId, editText.trim());
    } catch (error) {
      Alert.alert('Error', 'Failed to edit message');
    } finally {
      // Always close the modal
      setEditModalVisible(false);
      setEditText('');
      setEditingMessageId(null);
    }
  }, [editingMessageId, editText, conversationId, editMessage]);

  // Helper to check if message is within time limit
  const isWithinTimeLimit = useCallback((createdAt: string, timeLimitMinutes: number): boolean => {
    if (timeLimitMinutes === -1) return true; // No limit
    const messageTime = new Date(createdAt).getTime();
    const now = Date.now();
    const limitMs = timeLimitMinutes * 60 * 1000;
    return (now - messageTime) <= limitMs;
  }, []);

  // Check if user can edit a message (following User Portal business logic)
  const canEditMessage = useCallback((message: Message): boolean => {
    // Use editingSettings from component scope (triggers re-render on change)
    const allowEditing = editingSettings.allowEditing ?? true;
    const timeLimit = editingSettings.editTimeLimitMinutes ?? 15;
    if (allowEditing === false) return false;
    return isWithinTimeLimit(message.createdAt, timeLimit);
  }, [editingSettings, isWithinTimeLimit]);

  // Check if user can delete a message (following User Portal business logic)
  const canDeleteMessage = useCallback((message: Message, isOwn: boolean): boolean => {
    // Use deletionSettings from component scope (triggers re-render on change)
    // For "delete for me", always allowed if setting permits (default true)
    if (!isOwn && (deletionSettings.deleteForMeAlwaysAllowed !== false)) return true;
    // For own messages, check time limit (default -1 = no limit)
    const timeLimit = deletionSettings.timeLimitMinutes ?? -1;
    return isWithinTimeLimit(message.createdAt, timeLimit);
  }, [deletionSettings, isWithinTimeLimit]);

  // Perform the actual delete
  const performDelete = useCallback(async (messageId: string, forEveryone: boolean) => {
    try {
      await deleteMessage(conversationId, messageId, forEveryone);
      setDeleteConfirmVisible(false);
      setDeletingMessage(null);
      setSelectedMessage(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
  }, [conversationId, deleteMessage]);

  // Delete message - follows User Portal business logic
  const handleDeleteMessage = useCallback(() => {
    if (!selectedMessage) return;

    const isOwnMessage = selectedMessage.senderId === user?.id;

    // Check if we should show confirmation dialog (use deletionSettings from component scope)
    const showConfirmation = deletionSettings.showDeleteConfirmation !== false;

    if (showConfirmation) {
      // Close action menu and show delete confirmation dialog
      setMessageActionsVisible(false);
      setDeletingMessage({ id: selectedMessage.id, isOwn: isOwnMessage });
      setDeleteConfirmVisible(true);
    } else {
      // Delete without confirmation (delete for me by default)
      performDelete(selectedMessage.id, false);
    }
  }, [selectedMessage, user?.id, deletionSettings, performDelete]);

  // Handle delete for me
  const handleDeleteForMe = useCallback(() => {
    if (!deletingMessage) return;
    performDelete(deletingMessage.id, false);
  }, [deletingMessage, performDelete]);

  // Handle delete for everyone (own messages only)
  const handleDeleteForEveryone = useCallback(() => {
    if (!deletingMessage || !deletingMessage.isOwn) return;
    performDelete(deletingMessage.id, true);
  }, [deletingMessage, performDelete]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmVisible(false);
    setDeletingMessage(null);
    setSelectedMessage(null);
  }, []);

  // Report message - open report modal (only for other's messages)
  const handleReportMessage = useCallback(() => {
    if (!selectedMessage) return;
    const isOwnMessage = selectedMessage.senderId === user?.id;
    if (isOwnMessage) return; // Can't report own messages

    setMessageActionsVisible(false);
    setReportingMessage(selectedMessage);
    setReportModalVisible(true);
  }, [selectedMessage, user?.id]);

  // Submit report
  const handleSubmitReport = useCallback(async (reportType: string, description: string) => {
    if (!reportingMessage) return;

    try {
      await sdk.reports.create({
        reportType: reportType as any,
        description,
        reportedMessageId: reportingMessage.id,
      });
      setReportModalVisible(false);
      setReportingMessage(null);
      setSelectedMessage(null);
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  }, [reportingMessage]);

  // Cancel report
  const handleCancelReport = useCallback(() => {
    setReportModalVisible(false);
    setReportingMessage(null);
    setSelectedMessage(null);
  }, []);

  // Forward message - open modal and load targets
  const handleForwardMessage = useCallback(async () => {
    setMessageActionsVisible(false);
    setForwardModalVisible(true);
    setForwardLoading(true);
    setForwardSearchQuery("");
    setForwardTargets([]);

    try {
      // Fetch conversations using the same method as chatStore
      const result = await conversationsApi.list();
      console.log('Forward - conversations result:', JSON.stringify(result, null, 2));

      const convList = Array.isArray(result) ? result : (result as any).items || [];
      console.log('Forward - convList length:', convList.length);

      // Filter out current conversation and map to target format
      const targets = convList
        .filter((c: any) => c.id !== conversationId && !c.isArchived)
        .map((c: any) => ({
          id: c.id,
          type: 'conversation' as const,
          name: c.name || 'Chat',
          avatarUrl: c.avatarUrl,
          conversationType: c.type,
        }));

      console.log('Forward - targets:', targets.length);
      setForwardTargets(targets);
    } catch (error) {
      console.error('Failed to load forward targets:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setForwardLoading(false);
    }
  }, [conversationId]);

  // Handle forward to a target (conversation or user)
  const handleForwardTo = useCallback(async (target: any) => {
    if (!selectedMessage) return;

    setForwardLoading(true);
    try {
      let targetConversationId = target.id;

      // If it's a user, create or get DM first
      if (target.type === 'user') {
        const dm = await conversationsApi.createDM({ userId: target.id });
        targetConversationId = dm.id;
      }

      // Forward the message using the API
      await sdk.messages.forward(conversationId, selectedMessage.id, [targetConversationId]);

      // Refresh conversations list to show the forwarded message
      await fetchConversations();

      // Close modal
      setForwardModalVisible(false);
      setForwardTargets([]);
      setForwardSearchQuery("");
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to forward message:', error);
      Alert.alert('Error', 'Failed to forward message');
    } finally {
      setForwardLoading(false);
    }
  }, [selectedMessage, conversationId, fetchConversations]);

  // Search for forward targets (users)
  const handleForwardSearchChange = useCallback(async (query: string) => {
    setForwardSearchQuery(query);

    if (query.trim().length < 2) {
      // Reset to conversations when not searching
      try {
        const result = await conversationsApi.list();
        const convList = Array.isArray(result) ? result : (result as any).items || [];
        const targets = convList
          .filter((c: any) => c.id !== conversationId && !c.isArchived)
          .map((c: any) => ({
            id: c.id,
            type: 'conversation' as const,
            name: c.name || 'Chat',
            avatarUrl: c.avatarUrl,
            conversationType: c.type,
          }));
        setForwardTargets(targets);
      } catch (e) {
        console.error('Failed to reload conversations:', e);
      }
      return;
    }

    setForwardLoading(true);
    try {
      // Search for users
      const users = await contactsApi.searchUsers(query.trim(), 20);
      console.log('Forward search - users result:', users);

      const userTargets = (users || [])
        .filter((u: any) => u.id !== user?.id)
        .map((u: any) => ({
          id: u.id,
          type: 'user' as const,
          name: u.name || u.username,
          username: u.username,
          avatarUrl: u.avatarUrl,
        }));

      // Also filter conversations by name
      const result = await conversationsApi.list();
      const convList = Array.isArray(result) ? result : (result as any).items || [];
      const q = query.trim().toLowerCase();
      const convTargets = convList
        .filter((c: any) => c.id !== conversationId && !c.isArchived && (c.name || '').toLowerCase().includes(q))
        .map((c: any) => ({
          id: c.id,
          type: 'conversation' as const,
          name: c.name || 'Unknown',
          avatarUrl: c.avatarUrl,
          conversationType: c.type,
        }));

      setForwardTargets([...userTargets, ...convTargets]);
    } catch (error) {
      console.error('Forward search error:', error);
    } finally {
      setForwardLoading(false);
    }
  }, [conversationId, user]);

  // Add reaction to message
  const handleAddReaction = useCallback(async (emoji: string) => {
    if (selectedMessage) {
      try {
        await sdk.messages.react(conversationId, selectedMessage.id, emoji);
        // Update local state with reaction
        updateMessage(conversationId, selectedMessage.id, {
          reactions: [
            ...(selectedMessage.reactions || []),
            { emoji, count: 1, users: [{ userId: user?.id || '' }], hasReacted: true }
          ]
        });
      } catch (error) {
        console.error('Failed to add reaction:', error);
        Alert.alert('Error', 'Failed to add reaction');
      }
    }
    setReactionPickerVisible(false);
    setSelectedMessage(null);
  }, [selectedMessage, conversationId, updateMessage, user]);

  // Show reaction picker (keep selectedMessage so we can add reaction to it)
  const handleShowReactionPicker = useCallback(() => {
    setMessageActionsVisible(false);
    setReactionPickerVisible(true);
    // Don't clear selectedMessage - we need it for the reaction
  }, []);

  // Render right swipe actions (reply icon indicator)
  const renderRightActions = useCallback(() => {
    return (
      <View style={styles.swipeAction}>
        <Icon name="arrow-undo" size={24} color={colors.primary} />
      </View>
    );
  }, [colors]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;
    const attachmentUrl = getAttachmentUrl(item);
    // Only use media bubble styling for actual images
    const isImageMedia = attachmentUrl && isImageUrl(attachmentUrl);
    const messageType = ((item as any).type || 'text').toLowerCase();

    // Handle system messages (centered style)
    if (messageType === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Icon name="information-circle-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    // Handle VoiceCall and VideoCall messages (centered style like system messages)
    if (messageType === 'voicecall' || messageType === 'videocall') {
      const isVideoCall = messageType === 'videocall';
      const callIcon = isVideoCall ? 'videocam' : 'call';
      const isMissed = (item.content || '').toLowerCase() === 'missed';
      const iconColor = isMissed ? colors.error : colors.success;

      // Format the call message text
      let callText = item.content || '';
      if (isMissed) {
        callText = isVideoCall ? 'Missed Video Call' : 'Missed Voice Call';
      } else if (callText && callText !== 'Missed') {
        // If it has duration like "2:30", format it as "Video Call - 2:30" or "Voice Call - 2:30"
        const callTypeText = isVideoCall ? 'Video Call' : 'Voice Call';
        callText = callText.includes(':') ? `${callTypeText} - ${callText}` : callText;
      }

      return (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessageBubble, { paddingVertical: 10, paddingHorizontal: 16 }]}>
            <Icon name={callIcon} size={18} color={iconColor} style={{ marginRight: 8 }} />
            <Text style={[styles.systemMessageText, isMissed && { color: colors.error }]}>
              {callText}
            </Text>
          </View>
        </View>
      );
    }

    // Check view-once status
    const isViewOnceMsg = (item as any).isViewOnce || (item as any).IsViewOnce || (item as any).viewOnce;
    const viewOnceViewedAt = (item as any).viewOnceViewedAt || (item as any).ViewOnceViewedAt;
    const isViewOnceHidden = isViewOnceMsg && !viewOnceViewedAt && !viewOnceRevealedMessages.has(item.id);
    const isViewOnceViewed = isViewOnceMsg && !!viewOnceViewedAt;
    const viewOnceTimer = viewOnceTimers[item.id];
    const isViewOnceTimerActive = viewOnceRevealedMessages.has(item.id) && viewOnceTimer !== undefined && viewOnceTimer > 0;
    const isViewOnceExpired = viewOnceRevealedMessages.has(item.id) && viewOnceTimer === undefined;

    // Render view-once message content
    const renderViewOnceContent = () => {
      // Determine content type for appropriate labels
      const hasMedia = !!attachmentUrl;
      const isPhoto = hasMedia && isImageUrl(attachmentUrl);
      const isVid = hasMedia && isVideoUrl(attachmentUrl);

      // Get label based on content type
      let contentLabel = 'message';
      let contentIcon = 'chatbubble-outline';
      if (isPhoto) {
        contentLabel = 'photo';
        contentIcon = 'image-outline';
      } else if (isVid) {
        contentLabel = 'video';
        contentIcon = 'videocam-outline';
      } else if (hasMedia) {
        contentLabel = 'media';
        contentIcon = 'attach-outline';
      }

      if (isViewOnceHidden) {
        if (isOwn) {
          // Sender sees "Waiting for recipient to view"
          return (
            <View style={styles.viewOnceContainer}>
              <Icon name={contentIcon} size={32} color={colors.white} />
              <Text style={[styles.viewOnceText, { color: colors.white }]}>View once {contentLabel}</Text>
              <Text style={[styles.viewOnceSubtext, { color: 'rgba(255,255,255,0.7)' }]}>Waiting for recipient to view</Text>
            </View>
          );
        } else {
          // Recipient sees "Tap to view"
          return (
            <TouchableOpacity
              style={styles.viewOnceContainer}
              onPress={() => handleViewOnceReveal(item.id)}
              disabled={revealingViewOnce === item.id}
            >
              <Icon name={contentIcon} size={32} color={colors.primary} />
              <Text style={styles.viewOnceText}>
                {revealingViewOnce === item.id ? 'Opening...' : `Tap to view ${contentLabel}`}
              </Text>
              <Text style={styles.viewOnceSubtext}>Can only be viewed once</Text>
            </TouchableOpacity>
          );
        }
      }

      if (isViewOnceViewed || isViewOnceExpired) {
        // Show "viewed" placeholder with appropriate label
        const viewedLabel = isPhoto ? 'Photo' : (isVid ? 'Video' : (hasMedia ? 'Media' : 'Message'));
        return (
          <View style={styles.viewOnceViewedContainer}>
            <Icon name="eye-off-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.viewOnceViewedText}>{viewedLabel} viewed</Text>
          </View>
        );
      }

      // Show content with timer if actively viewing
      return (
        <View>
          {isViewOnceTimerActive && (
            <View style={styles.viewOnceTimerContainer}>
              <Icon name="eye-off-outline" size={12} color={colors.warning} />
              <Text style={styles.viewOnceTimerText}>Viewing... {viewOnceTimer}s</Text>
            </View>
          )}
          {renderMessageContent(item, isOwn)}
        </View>
      );
    };

    // Get reply info (the message this item is replying to)
    const replyTo = item.replyTo || (item as any).ReplyTo || (item as any).replyToMessage || (item as any).ReplyToMessage;
    console.log("[REPLY CHECK]", item.id, "replyTo:", replyTo, "replyToId:", item.replyToId || (item as any).replyToMessageId);
    const replyToIdVal = item.replyToId || (item as any).ReplyToId || (item as any).replyToMessageId || (item as any).ReplyToMessageId;

    // Find the replied message in conversation if we have replyToId but not full replyTo
    const repliedToMsg = replyTo || (replyToIdVal ? conversationMessages.find(m => m.id === replyToIdVal) : null);

    // Get reactions
    const reactions = item.reactions || [];

    const messageContent = (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={300}
      >
        <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
          {!isOwn && <View style={styles.messageAvatar}><Icon name="person" size={16} color={colors.white} /></View>}
          <View>
            <View style={[
              styles.messageBubble,
              isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
              isImageMedia && !isViewOnceHidden && !isViewOnceViewed && !isViewOnceExpired && styles.mediaBubble
            ]}>
              {/* Reply preview inside bubble */}
              {repliedToMsg && (
                <View style={[styles.replyPreviewInBubble, isOwn && styles.replyPreviewInBubbleOwn]}>
                  <View style={[styles.replyBar, { backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : colors.primary }]} />
                  <View style={styles.replyPreviewContent}>
                    <Text style={[styles.replyPreviewName, isOwn && styles.replyPreviewNameOwn]} numberOfLines={1}>
                      {(repliedToMsg as any).senderName || (repliedToMsg as any).sender?.name || 'Unknown'}
                    </Text>
                    {renderReplyPreviewContent(repliedToMsg, isOwn, true)}
                  </View>
                </View>
              )}
              {isViewOnceMsg ? renderViewOnceContent() : renderMessageContent(item, isOwn)}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>{formatTime(item.createdAt)}</Text>
                {renderStatusIndicator((item as any).status, isOwn)}
              </View>
            </View>
            {/* Reactions display */}
            {reactions.length > 0 && (
              <View style={[styles.reactionsContainer, isOwn && styles.reactionsContainerOwn]}>
                {reactions.map((reaction, index) => (
                  <View key={index} style={styles.reactionBadge}>
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                    {reaction.count > 1 && (
                      <Text style={styles.reactionCount}>{reaction.count}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    // Don't allow reply to system or call messages
    if (messageType === 'system' || messageType === 'voicecall' || messageType === 'videocall') {
      return messageContent;
    }

    // Wrap in Swipeable for reply gesture - only if reply is allowed
    if (!replyAllowed) {
      // Reply not allowed - just return the message without swipe
      return messageContent;
    }

    return (
      <Swipeable
        ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableOpen={(direction) => {
          if (direction === 'right') {
            handleReply(item);
          }
        }}
      >
        {messageContent}
      </Swipeable>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {isLoading && conversationMessages.length === 0 ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View> :
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingMoreText}>Loading older messages...</Text>
              </View>
            ) : null
          }
          // Performance optimizations
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={15}
          windowSize={10}
          initialNumToRender={20}
          updateCellsBatchingPeriod={50}
        />}
      {/* Typing/Recording Indicator */}
      {(typingUsers.length > 0 || recordingUsers.length > 0) && (
        <View style={styles.typingIndicatorContainer}>
          {recordingUsers.length > 0 ? (
            <>
              <Icon name="mic" size={16} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.typingText}>
                {recordingUsers.length === 1
                  ? `${recordingUsers[0].userName || 'Someone'} is recording...`
                  : recordingUsers.length === 2
                  ? `${recordingUsers[0].userName || 'Someone'} and ${recordingUsers[1].userName || 'someone'} are recording...`
                  : `${recordingUsers.length} people are recording...`}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.typingDots}>
                <Animated.View style={[styles.typingDot, { opacity: 0.4 }]} />
                <Animated.View style={[styles.typingDot, { opacity: 0.6 }]} />
                <Animated.View style={[styles.typingDot, { opacity: 0.8 }]} />
              </View>
              <Text style={styles.typingText}>
                {typingUsers.length === 1
                  ? `${typingUsers[0].userName || 'Someone'} is typing...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0].userName || 'Someone'} and ${typingUsers[1].userName || 'someone'} are typing...`
                  : `${typingUsers.length} people are typing...`}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Reply Preview */}
      {replyToMessage && (
        <View style={styles.replyContainer}>
          <View style={[styles.replyBar, { backgroundColor: colors.primary }]} />
          <View style={styles.replyContent}>
            <Text style={styles.replyName} numberOfLines={1}>
              Replying to {(replyToMessage as any).senderName || (replyToMessage as any).sender?.name || 'message'}
            </Text>
            {renderReplyPreviewContent(replyToMessage, false, false)}
          </View>
          <TouchableOpacity style={styles.replyCancelButton} onPress={clearReply}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Hide input for Platform Channel - only admins can post */}
      {!isBroadcast && (
        isRecording ? (
          // Recording UI
          <View style={styles.recordingContainer}>
            <TouchableOpacity style={styles.cancelRecordButton} onPress={cancelAudioRecording}>
              <Icon name="trash-outline" size={24} color={colors.error} />
            </TouchableOpacity>
            <View style={styles.recordingInfo}>
              <Animated.View style={[styles.recordingDot, { opacity: recordingAnimValue }]} />
              <Text style={styles.recordingDuration}>{formatRecordingDuration(recordingDuration)}</Text>
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
            <TouchableOpacity style={styles.sendRecordButton} onPress={stopAudioRecording}>
              <Icon name="send" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setAttachmentMenuVisible(true)}
              disabled={uploadingMedia || sending}
            >
              {uploadingMedia ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="add-circle-outline" size={28} color={colors.primary} />
              )}
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} placeholder="Type a message..." placeholderTextColor={colors.textSecondary} value={inputText} onChangeText={(text) => { setInputText(text); if (text.length > 0) sendTypingIndicator(); }} multiline />
              <TouchableOpacity style={styles.emojiButton} onPress={() => setEmojiPickerVisible(true)}>
                <Icon name="happy-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {inputText.trim() ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.viewOnceToggle,
                    isViewOnce ? styles.viewOnceToggleActive : styles.viewOnceToggleInactive
                  ]}
                  onPress={() => setIsViewOnce(!isViewOnce)}
                >
                  <Icon
                    name={isViewOnce ? "eye-off" : "eye-outline"}
                    size={20}
                    color={isViewOnce ? colors.white : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sendButton, (sending || uploadingMedia) && styles.sendButtonDisabled]} onPress={handleSend} disabled={sending || uploadingMedia}>
                  {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="send" size={20} color={colors.white} />}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.micButton} onPress={startAudioRecording} disabled={uploadingMedia || sending}>
                <Icon name="mic" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )
      )}

      {/* Attachment Menu Modal */}
      <Modal
        visible={attachmentMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachmentMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.attachmentModalOverlay}
          activeOpacity={1}
          onPress={() => setAttachmentMenuVisible(false)}
        >
          <View style={styles.attachmentMenuContainer}>
            <View style={styles.attachmentMenuHeader}>
              <Text style={styles.attachmentMenuTitle}>Share</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.viewOnceToggle,
                    isViewOnce ? styles.viewOnceToggleActive : styles.viewOnceToggleInactive,
                    { marginRight: 8 }
                  ]}
                  onPress={() => setIsViewOnce(!isViewOnce)}
                >
                  <Icon
                    name={isViewOnce ? "eye-off" : "eye-outline"}
                    size={18}
                    color={isViewOnce ? colors.white : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAttachmentMenuVisible(false)}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            {isViewOnce && (
              <View style={{ backgroundColor: colors.warning + '20', paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: colors.warning, textAlign: 'center' }}>
                  🔒 View once enabled - recipient can only view once
                </Text>
              </View>
            )}
            <View style={styles.attachmentMenuGrid}>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleTakePhoto}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#4CAF50' }]}>
                  <Icon name="camera" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleRecordVideo}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#E91E63' }]}>
                  <Icon name="videocam" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handlePickImage}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#2196F3' }]}>
                  <Icon name="image" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handlePickVideo}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#9C27B0' }]}>
                  <Icon name="film" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handlePickDocument}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#FF9800' }]}>
                  <Icon name="document" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleShareLocation}>
                <View style={[styles.attachmentMenuIcon, { backgroundColor: '#F44336' }]}>
                  <Icon name="location" size={28} color={colors.white} />
                </View>
                <Text style={styles.attachmentMenuLabel}>Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media Viewer Modal */}
      <MediaViewer
        visible={mediaViewerVisible}
        mediaUrl={selectedMedia?.url || null}
        mediaType={selectedMedia?.type || 'image'}
        fileName={selectedMedia?.fileName}
        onClose={closeMedia}
      />

      {/* Video Recorder Modal */}
      <VideoRecorder
        visible={videoRecorderVisible}
        onClose={() => setVideoRecorderVisible(false)}
        onVideoRecorded={handleVideoRecorded}
        onRecordingStart={() => {
          signalRService.sendRecording(conversationId).catch(err => {
            console.log('Failed to send recording indicator:', err);
          });
        }}
        onRecordingStop={() => {
          signalRService.sendStoppedRecording(conversationId).catch(err => {
            console.log('Failed to send stopped recording indicator:', err);
          });
        }}
        maxDuration={60}
      />

      {/* Emoji Picker Modal */}
      {EmojiPicker && (
        <EmojiPicker
          onEmojiSelected={handleEmojiSelected}
          open={emojiPickerVisible}
          onClose={() => setEmojiPickerVisible(false)}
        />
      )}

      {/* Fallback emoji picker if package not installed */}
      {!EmojiPicker && emojiPickerVisible && (
        <Modal
          visible={emojiPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setEmojiPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.attachmentModalOverlay}
            activeOpacity={1}
            onPress={() => setEmojiPickerVisible(false)}
          >
            <View style={styles.emojiPickerFallback}>
              <Text style={styles.emojiPickerTitle}>Quick Emojis</Text>
              <View style={styles.emojiGrid}>
                {['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🎉', '🔥', '💯', '✨', '🙏'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiItem}
                    onPress={() => handleEmojiSelected(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.emojiNote}>Install rn-emoji-keyboard for full emoji picker</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Conversation Info Sheet */}
      <ConversationInfoSheet
        visible={infoSheetVisible}
        conversation={conversation || null}
        onClose={() => setInfoSheetVisible(false)}
        onStartCall={handleCall}
        onViewProfile={(userId, userName, userAvatar, username) => {
          setInfoSheetVisible(false);
          navigation.navigate('UserProfile', { userId, userName, userAvatar, username });
        }}
        onLeaveGroup={async () => {
          try {
            await sdk.conversations.leave(conversationId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to leave group');
          }
        }}
        onDeleteConversation={async () => {
          try {
            await sdk.conversations.delete(conversationId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete conversation');
          }
        }}
      />

      {/* Message Actions Modal */}
      <Modal
        visible={messageActionsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMessageActions}
      >
        <TouchableOpacity
          style={styles.messageActionsOverlay}
          activeOpacity={1}
          onPress={closeMessageActions}
        >
          <View style={styles.messageActionsContainer}>
            {/* Reply - only if settings allow */}
            {replyAllowed && (
              <TouchableOpacity style={styles.messageActionItem} onPress={handleReplyFromMenu}>
                <Icon name="arrow-undo-outline" size={24} color={colors.text} />
                <Text style={styles.messageActionText}>Reply</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.messageActionItem} onPress={handleShowReactionPicker}>
              <Icon name="happy-outline" size={24} color={colors.text} />
              <Text style={styles.messageActionText}>React</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageActionItem} onPress={handleForwardMessage}>
              <Icon name="arrow-redo-outline" size={24} color={colors.text} />
              <Text style={styles.messageActionText}>Forward</Text>
            </TouchableOpacity>
            {/* Edit - only for own messages AND within time limit */}
            {selectedMessage && selectedMessage.senderId === user?.id && canEditMessage(selectedMessage) && (
              <TouchableOpacity style={styles.messageActionItem} onPress={handleEditMessage}>
                <Icon name="create-outline" size={24} color={colors.text} />
                <Text style={styles.messageActionText}>Edit</Text>
              </TouchableOpacity>
            )}
            {/* Delete - check if allowed based on settings */}
            {selectedMessage && canDeleteMessage(selectedMessage, selectedMessage.senderId === user?.id) && (
              <TouchableOpacity style={styles.messageActionItem} onPress={handleDeleteMessage}>
                <Icon name="trash-outline" size={24} color={colors.error} />
                <Text style={[styles.messageActionText, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {/* Report - only for other's messages */}
            {selectedMessage && selectedMessage.senderId !== user?.id && (
              <TouchableOpacity style={styles.messageActionItem} onPress={handleReportMessage}>
                <Icon name="flag-outline" size={24} color={colors.warning || '#FFA500'} />
                <Text style={[styles.messageActionText, { color: colors.warning || '#FFA500' }]}>Report</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setEditModalVisible(false); setEditingMessageId(null); setEditText(''); }}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Message</Text>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); setEditingMessageId(null); setEditText(''); }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editModalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Edit your message..."
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalCancelButton]}
                onPress={() => { setEditModalVisible(false); setEditingMessageId(null); setEditText(''); }}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.editModalSaveButton]}
                onPress={handleSubmitEdit}
              >
                <Text style={styles.editModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Forward Message Modal */}
      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setForwardModalVisible(false); setForwardTargets([]); setForwardSearchQuery(""); }}
      >
        <View style={styles.forwardModalContainer}>
          <View style={styles.forwardModalContent}>
            {/* Header */}
            <View style={styles.forwardModalHeader}>
              <Text style={styles.forwardModalTitle}>Forward Message</Text>
              <TouchableOpacity onPress={() => { setForwardModalVisible(false); setForwardTargets([]); setForwardSearchQuery(""); }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Message Preview */}
            {selectedMessage && (
              <View style={{ backgroundColor: colors.surface, margin: 16, marginTop: 0, padding: 12, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Forwarding:</Text>
                <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={2}>
                  {selectedMessage.content || '[Media]'}
                </Text>
              </View>
            )}

            {/* Search Input */}
            <View style={styles.forwardSearchContainer}>
              <Icon name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.forwardSearchInput}
                placeholder="Search users or conversations..."
                placeholderTextColor={colors.textSecondary}
                value={forwardSearchQuery}
                onChangeText={handleForwardSearchChange}
                autoCapitalize="none"
              />
              {forwardLoading && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Targets List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Loading State */}
              {forwardLoading && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading...</Text>
                </View>
              )}

              {/* Section Header */}
              {!forwardLoading && forwardTargets.length > 0 && (
                <Text style={styles.forwardSectionTitle}>
                  {forwardSearchQuery.length >= 2 ? 'Search Results' : 'Recent Conversations'}
                </Text>
              )}

              {/* Target Items */}
              {!forwardLoading && forwardTargets.map((item) => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={styles.forwardConversationItem}
                  onPress={() => handleForwardTo(item)}
                >
                  <View style={styles.forwardConversationAvatar}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: toAbsoluteUrl(item.avatarUrl) }} style={styles.forwardAvatarImage} />
                    ) : (
                      <Icon
                        name={item.type === 'user' ? 'person' : (item.conversationType === 'Chatroom' ? 'people' : 'person')}
                        size={20}
                        color={colors.white}
                      />
                    )}
                  </View>
                  <View style={styles.forwardUserInfo}>
                    <Text style={styles.forwardConversationName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.forwardUsername} numberOfLines={1}>
                      {item.type === 'user' ? `@${item.username}` : (item.conversationType === 'Chatroom' ? 'Group' : 'Direct Message')}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}

              {/* Empty State */}
              {!forwardLoading && forwardTargets.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Icon name="chatbubbles-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                    {forwardSearchQuery.length >= 2 ? 'No results found' : 'No conversations available'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Icon name="trash-outline" size={32} color={colors.error} />
              <Text style={styles.deleteModalTitle}>Delete Message</Text>
            </View>
            <Text style={styles.deleteModalMessage}>
              {deletingMessage?.isOwn
                ? 'How would you like to delete this message?'
                : 'This message will be deleted from your view.'}
            </Text>
            <View style={styles.deleteModalButtons}>
              {/* Delete for me - always shown */}
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteForMeButton]}
                onPress={handleDeleteForMe}
              >
                <Icon name="person-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
                <Text style={styles.deleteForMeText}>Delete for me</Text>
              </TouchableOpacity>

              {/* Delete for everyone - only for own messages */}
              {deletingMessage?.isOwn && (
                <TouchableOpacity
                  style={[styles.deleteModalButton, styles.deleteForEveryoneButton]}
                  onPress={handleDeleteForEveryone}
                >
                  <Icon name="people-outline" size={18} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.deleteForEveryoneText}>Delete for everyone</Text>
                </TouchableOpacity>
              )}

              {/* Cancel button */}
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={handleCancelDelete}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Message Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={handleCancelReport}
        onSubmit={handleSubmitReport}
        messageContent={reportingMessage?.content}
      />

      {/* Reaction Picker Modal */}
      <Modal
        visible={reactionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setReactionPickerVisible(false); setSelectedMessage(null); }}
      >
        <View style={styles.reactionPickerOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setReactionPickerVisible(false); setSelectedMessage(null); }}
          />
          <View style={styles.reactionPickerContainer}>
            {['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🙏'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickerItem}
                onPress={() => handleAddReaction(emoji)}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      {/* Location Picker Modal */}
      <LocationPicker
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onLocationSelect={handleLocationSelect}
      />
    </KeyboardAvoidingView>
  );
};

// Report Modal Component - matches User Portal report types
const REPORT_TYPES = [
  { value: 'spam', label: 'Spam', description: 'Unwanted or repetitive content' },
  { value: 'harassment', label: 'Harassment', description: 'Bullying or threatening behavior' },
  { value: 'inappropriate', label: 'Inappropriate', description: 'Offensive or explicit material' },
  { value: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { value: 'other', label: 'Other', description: 'Something else not listed above' },
] as const;

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reportType: string, description: string) => void;
  messageContent?: string;
}

const ReportModal: React.FC<ReportModalProps> = ({ visible, onClose, onSubmit, messageContent }) => {
  const { colors } = useTheme();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide additional details');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedType, description.trim());
      // Reset state
      setSelectedType(null);
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          maxHeight: '80%',
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Report Message</Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Message Preview */}
          {messageContent && (
            <View style={{
              backgroundColor: colors.surface,
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Message:</Text>
              <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={3}>{messageContent}</Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: 300 }}>
            {/* Report Types */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 12 }}>
              Why are you reporting this message?
            </Text>
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  backgroundColor: selectedType === type.value ? colors.primary + '20' : colors.surface,
                  borderWidth: selectedType === type.value ? 1 : 0,
                  borderColor: colors.primary,
                }}
                onPress={() => setSelectedType(type.value)}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: selectedType === type.value ? colors.primary : colors.textSecondary,
                  marginRight: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {selectedType === type.value && (
                    <View style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.primary,
                    }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{type.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{type.description}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Description */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 16, marginBottom: 8 }}>
              Additional details
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                color: colors.text,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
              placeholder="Please provide more information about this report..."
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </ScrollView>

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.error,
              padding: 16,
              borderRadius: 12,
              marginTop: 16,
              alignItems: 'center',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={{ color: colors.white, fontWeight: '600', fontSize: 16 }}>Submit Report</Text>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={{ padding: 16, alignItems: 'center' }}
            onPress={handleClose}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingMoreContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16 },
  loadingMoreText: { marginLeft: 8, fontSize: 14, color: colors.textSecondary },
  messagesList: { padding: 16 },
  messageRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  messageRowOwn: { justifyContent: "flex-end" },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  messageBubble: { maxWidth: "75%", borderRadius: 20, padding: 12, paddingBottom: 8 },
  messageBubbleOwn: { backgroundColor: colors.messageBubbleOwn, borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: colors.messageBubbleOther, borderBottomLeftRadius: 4 },
  mediaBubble: { padding: 4, paddingBottom: 8 },
  messageText: { fontSize: 16, color: colors.messageTextOther, lineHeight: 22 },
  messageTextOwn: { color: colors.messageTextOwn },
  readMoreText: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 4 },
  readMoreTextOwn: { color: 'rgba(255,255,255,0.9)' },
  messageTime: { fontSize: 11, color: colors.messageTextOther, opacity: 0.7, textAlign: "right" },
  messageTimeOwn: { color: colors.messageTextOwn, opacity: 0.7 },
  messageFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4, paddingHorizontal: 4 },
  statusIcon: { marginLeft: 4 },
  // Media styles
  messageImage: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH * 0.75,
    borderRadius: 16,
    backgroundColor: colors.gray[200],
  },
  mediaContainer: { alignItems: "center" },
  videoPlaceholder: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH * 0.56,
    borderRadius: 16,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  mediaLabel: { color: colors.white, marginTop: 4, fontSize: 12 },
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 150,
  },
  audioLabel: { flex: 1, marginHorizontal: 8, fontSize: 14, color: colors.messageTextOther },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 180,
  },
  fileInfo: { flex: 1, marginLeft: 8 },
  fileName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  fileTap: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  locationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    minWidth: 200,
  },
  locationMapPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationMapPreviewOwn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  locationTap: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  locationLabel: { marginLeft: 8, fontSize: 14, color: colors.text },
  // Typing indicator styles
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginHorizontal: 2,
  },
  typingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // Input styles
  inputContainer: { flexDirection: "row", alignItems: "flex-end", padding: 8, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border },
  attachButton: { padding: 8 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, paddingHorizontal: 12, marginHorizontal: 8, minHeight: 44, maxHeight: 120 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  emojiButton: { padding: 4 },
  micButton: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  sendButtonDisabled: { backgroundColor: colors.gray[300] },
  // Recording styles
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
    marginRight: 8,
  },
  recordingDuration: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sendRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Attachment menu styles
  attachmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachmentMenuContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  attachmentMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attachmentMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  attachmentMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'flex-start',
  },
  attachmentMenuItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 20,
  },
  attachmentMenuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentMenuLabel: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  // Emoji picker fallback styles
  emojiPickerFallback: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 34,
  },
  emojiPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emojiItem: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
  emojiNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  // System message styles
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // View-once message styles
  viewOnceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    minWidth: 180,
  },
  viewOnceText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginTop: 8,
  },
  viewOnceSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  viewOnceViewedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minWidth: 150,
  },
  viewOnceViewedText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  viewOnceTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewOnceTimerText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
    marginLeft: 4,
  },
  // View-once toggle button
  viewOnceToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  viewOnceToggleActive: {
    backgroundColor: colors.primary,
  },
  viewOnceToggleInactive: {
    backgroundColor: 'transparent',
  },
  // Swipe to reply styles
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    marginVertical: 4,
  },
  // Reply container above input
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyBar: {
    width: 3,
    height: '100%',
    minHeight: 36,
    borderRadius: 1.5,
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  replyCancelButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Reply preview inside message bubble
  replyPreviewInBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    minWidth: 150,
  },
  replyPreviewInBubbleOwn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replyPreviewContent: {
    flex: 1,
    minWidth: 0,
  },
  replyPreviewName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  replyPreviewNameOwn: {
    color: 'rgba(255,255,255,0.9)',
  },
  replyPreviewText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  replyPreviewTextOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  // Reply media styles
  replyMediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  replyThumbnailContainer: {
    position: 'relative',
    marginRight: 8,
  },
  replyThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  replyVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 6,
  },
  replyMediaIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyMediaIconSmall: {
    marginRight: 4,
  },
  replyMediaText: {
    flex: 1,
  },
  replyMediaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Reactions styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginLeft: 40,
  },
  reactionsContainerOwn: {
    justifyContent: 'flex-end',
    marginLeft: 0,
    marginRight: 0,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  // Message Actions Modal styles
  messageActionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageActionsContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  messageActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageActionText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  // Edit Modal styles
  editModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editModalInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  editModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  editModalCancelButton: {
    backgroundColor: colors.surface,
  },
  editModalCancelText: {
    fontSize: 16,
    color: colors.text,
  },
  editModalSaveButton: {
    backgroundColor: colors.primary,
  },
  editModalSaveText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  // Forward Modal styles
  forwardModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  forwardModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    paddingBottom: 34,
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  forwardModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  forwardConversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  forwardConversationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  forwardAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  forwardConversationName: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  forwardSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  forwardSearchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
    paddingVertical: 4,
  },
  forwardScrollView: {
    flex: 1,
  },
  forwardSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  forwardUserInfo: {
    flex: 1,
  },
  forwardUsername: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  forwardEmptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: 20,
    fontSize: 14,
  },
  // Delete Confirmation Modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteModalButtons: {
    width: '100%',
    gap: 12,
  },
  deleteModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  deleteForMeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteForMeText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  deleteForEveryoneButton: {
    backgroundColor: colors.error,
  },
  deleteForEveryoneText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
  },
  deleteCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  // Reaction Picker styles
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reactionPickerItem: {
    padding: 8,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
});

export default ChatScreen;
