// Mock the SDK services - must be before import
jest.mock('../../../src/services/sdk', () => ({
  conversations: {
    list: jest.fn(),
    create: jest.fn(),
    createGroup: jest.fn(),
  },
  messages: {
    list: jest.fn(),
    send: jest.fn(),
    delete: jest.fn(),
    edit: jest.fn(),
    markAsRead: jest.fn(),
    markViewOnceViewed: jest.fn(),
  },
  broadcasts: {
    getMessages: jest.fn(),
  },
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    verify2FA: jest.fn(),
  },
  initializeSDK: jest.fn(),
  storeTokens: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
  getStoredTokens: jest.fn(() => Promise.resolve(null)),
  setOnUnauthorizedCallback: jest.fn(),
}));

import { useChatStore } from '../../../src/stores/chatStore';

jest.mock('../../../src/services/signalr', () => ({
  signalRService: {
    sendTypingIndicator: jest.fn(),
    stopTypingIndicator: jest.fn(),
  },
}));

jest.mock('../../../src/constants', () => ({
  config: {
    API_BASE_URL: 'https://test.api.com/api',
  },
}));

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      conversations: [],
      archivedConversations: [],
      messages: {},
      activeConversationId: null,
      isLoading: false,
      isLoadingMore: false,
      hasMoreMessages: {},
      error: null,
      platformChannelSeenCount: 0,
      typingUsers: [],
      recordingUsers: [],
    });
  });

  describe('Initial State', () => {
    it('should initialize with empty conversations', () => {
      const { conversations } = useChatStore.getState();
      expect(conversations).toEqual([]);
    });

    it('should initialize with null activeConversationId', () => {
      const { activeConversationId } = useChatStore.getState();
      expect(activeConversationId).toBeNull();
    });

    it('should initialize with empty messages', () => {
      const { messages } = useChatStore.getState();
      expect(messages).toEqual({});
    });

    it('should initialize with empty typingUsers array', () => {
      const { typingUsers } = useChatStore.getState();
      expect(typingUsers).toEqual([]);
    });

    it('should initialize with empty recordingUsers array', () => {
      const { recordingUsers } = useChatStore.getState();
      expect(recordingUsers).toEqual([]);
    });

    it('should initialize with isLoading as false', () => {
      const { isLoading } = useChatStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should initialize with no error', () => {
      const { error } = useChatStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('setActiveConversation', () => {
    it('should set active conversation id', () => {
      useChatStore.getState().setActiveConversation('conv-1');

      const { activeConversationId } = useChatStore.getState();
      expect(activeConversationId).toBe('conv-1');
    });

    it('should clear active conversation when set to null', () => {
      useChatStore.setState({ activeConversationId: 'conv-1' });

      useChatStore.getState().setActiveConversation(null);

      const { activeConversationId } = useChatStore.getState();
      expect(activeConversationId).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      const conversationId = 'conv-1';
      const message = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'Hello',
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      useChatStore.getState().addMessage(message);

      const { messages } = useChatStore.getState();
      expect(messages[conversationId]).toBeDefined();
      expect(messages[conversationId]).toHaveLength(1);
      expect(messages[conversationId][0].content).toBe('Hello');
    });

    it('should append message to existing conversation messages', () => {
      const conversationId = 'conv-1';
      const existingMessage = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'First',
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      useChatStore.setState({
        messages: { [conversationId]: [existingMessage] },
      });

      const newMessage = {
        id: 'msg-2',
        conversationId,
        senderId: 'user-2',
        content: 'Second',
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      useChatStore.getState().addMessage(newMessage);

      const { messages } = useChatStore.getState();
      expect(messages[conversationId]).toHaveLength(2);
    });

    it('should not add duplicate messages', () => {
      const conversationId = 'conv-1';
      const message = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'Hello',
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      useChatStore.setState({
        messages: { [conversationId]: [message] },
      });

      // Try to add the same message again
      useChatStore.getState().addMessage(message);

      const { messages } = useChatStore.getState();
      // Should still only have 1 message (no duplicates)
      expect(messages[conversationId]).toHaveLength(1);
    });
  });

  describe('updateMessage', () => {
    it('should update existing message', () => {
      const conversationId = 'conv-1';
      const originalMessage = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'Original',
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      useChatStore.setState({
        messages: { [conversationId]: [originalMessage] },
      });

      useChatStore.getState().updateMessage(conversationId, 'msg-1', {
        content: 'Updated',
        isEdited: true,
      });

      const { messages } = useChatStore.getState();
      expect(messages[conversationId][0].content).toBe('Updated');
      expect(messages[conversationId][0].isEdited).toBe(true);
    });

    it('should not modify other messages', () => {
      const conversationId = 'conv-1';
      const messageList = [
        { id: 'msg-1', conversationId, senderId: 'user-1', content: 'First', type: 'text', createdAt: new Date().toISOString() },
        { id: 'msg-2', conversationId, senderId: 'user-1', content: 'Second', type: 'text', createdAt: new Date().toISOString() },
      ];

      useChatStore.setState({ messages: { [conversationId]: messageList } });

      useChatStore.getState().updateMessage(conversationId, 'msg-1', {
        content: 'Updated First',
      });

      const state = useChatStore.getState();
      expect(state.messages[conversationId][0].content).toBe('Updated First');
      expect(state.messages[conversationId][1].content).toBe('Second');
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status', () => {
      const conversationId = 'conv-1';
      const message = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'Test',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'sending' as const,
      };

      useChatStore.setState({
        messages: { [conversationId]: [message] },
      });

      useChatStore.getState().updateMessageStatus(conversationId, 'msg-1', 'delivered');

      const { messages } = useChatStore.getState();
      expect(messages[conversationId][0].status).toBe('delivered');
    });

    it('should handle read status', () => {
      const conversationId = 'conv-1';
      const message = {
        id: 'msg-1',
        conversationId,
        senderId: 'user-1',
        content: 'Test',
        type: 'text',
        createdAt: new Date().toISOString(),
        status: 'delivered' as const,
      };

      useChatStore.setState({
        messages: { [conversationId]: [message] },
      });

      useChatStore.getState().updateMessageStatus(conversationId, 'msg-1', 'read');

      const { messages } = useChatStore.getState();
      expect(messages[conversationId][0].status).toBe('read');
    });
  });

  describe('Typing Indicators', () => {
    it('should add typing user', () => {
      useChatStore.getState().addTypingUser('conv-1', 'user-1', 'John');

      const { typingUsers } = useChatStore.getState();
      expect(typingUsers).toHaveLength(1);
      expect(typingUsers[0]).toEqual({
        conversationId: 'conv-1',
        userId: 'user-1',
        name: 'John',
      });
    });

    it('should remove typing user', () => {
      useChatStore.setState({
        typingUsers: [{ conversationId: 'conv-1', userId: 'user-1', name: 'John' }],
      });

      useChatStore.getState().removeTypingUser('conv-1', 'user-1');

      const { typingUsers } = useChatStore.getState();
      expect(typingUsers).toHaveLength(0);
    });

    it('should handle multiple typing users in same conversation', () => {
      useChatStore.getState().addTypingUser('conv-1', 'user-1', 'John');
      useChatStore.getState().addTypingUser('conv-1', 'user-2', 'Jane');

      const { typingUsers } = useChatStore.getState();
      expect(typingUsers).toHaveLength(2);
    });

    it('should not duplicate typing user', () => {
      useChatStore.getState().addTypingUser('conv-1', 'user-1', 'John');
      useChatStore.getState().addTypingUser('conv-1', 'user-1', 'John');

      const { typingUsers } = useChatStore.getState();
      // Should still only have 1 entry
      expect(typingUsers.filter(t => t.userId === 'user-1')).toHaveLength(1);
    });

    it('should handle typing users across different conversations', () => {
      useChatStore.getState().addTypingUser('conv-1', 'user-1', 'John');
      useChatStore.getState().addTypingUser('conv-2', 'user-2', 'Jane');

      const { typingUsers } = useChatStore.getState();
      expect(typingUsers).toHaveLength(2);

      const conv1Users = typingUsers.filter(t => t.conversationId === 'conv-1');
      const conv2Users = typingUsers.filter(t => t.conversationId === 'conv-2');
      expect(conv1Users).toHaveLength(1);
      expect(conv2Users).toHaveLength(1);
    });
  });

  describe('Recording Indicators', () => {
    it('should add recording user', () => {
      useChatStore.getState().addRecordingUser('conv-1', 'user-1', 'John');

      const { recordingUsers } = useChatStore.getState();
      expect(recordingUsers).toHaveLength(1);
      expect(recordingUsers[0]).toEqual({
        conversationId: 'conv-1',
        userId: 'user-1',
        name: 'John',
      });
    });

    it('should remove recording user', () => {
      useChatStore.setState({
        recordingUsers: [{ conversationId: 'conv-1', userId: 'user-1', name: 'John' }],
      });

      useChatStore.getState().removeRecordingUser('conv-1', 'user-1');

      const { recordingUsers } = useChatStore.getState();
      expect(recordingUsers).toHaveLength(0);
    });

    it('should handle multiple recording users', () => {
      useChatStore.getState().addRecordingUser('conv-1', 'user-1', 'John');
      useChatStore.getState().addRecordingUser('conv-1', 'user-2', 'Jane');

      const { recordingUsers } = useChatStore.getState();
      expect(recordingUsers).toHaveLength(2);
    });
  });

  describe('updateConversation', () => {
    it('should update conversation properties', () => {
      const conversation = {
        id: 'conv-1',
        name: 'Test Chat',
        type: 'DirectMessage' as const,
        unreadCount: 0,
      };

      useChatStore.setState({ conversations: [conversation] });

      useChatStore.getState().updateConversation({
        id: 'conv-1',
        unreadCount: 5,
      });

      const { conversations } = useChatStore.getState();
      expect(conversations[0].unreadCount).toBe(5);
      expect(conversations[0].name).toBe('Test Chat'); // Unchanged
    });

    it('should update lastMessage', () => {
      const conversation = {
        id: 'conv-1',
        name: 'Test Chat',
        type: 'DirectMessage' as const,
        unreadCount: 0,
      };

      useChatStore.setState({ conversations: [conversation] });

      useChatStore.getState().updateConversation({
        id: 'conv-1',
        lastMessage: {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'user-1',
          content: 'New message',
          type: 'text',
          createdAt: new Date().toISOString(),
        },
        lastMessageAt: new Date().toISOString(),
      });

      const { conversations } = useChatStore.getState();
      expect(conversations[0].lastMessage?.content).toBe('New message');
    });
  });

  describe('incrementUnreadCount', () => {
    it('should increment unread count', () => {
      const conversation = {
        id: 'conv-1',
        type: 'DirectMessage' as const,
        unreadCount: 3,
      };

      useChatStore.setState({ conversations: [conversation] });

      useChatStore.getState().incrementUnreadCount('conv-1');

      const { conversations } = useChatStore.getState();
      expect(conversations[0].unreadCount).toBe(4);
    });

    it('should initialize unread count if undefined', () => {
      const conversation = {
        id: 'conv-1',
        type: 'DirectMessage' as const,
        unreadCount: 0,
      };

      useChatStore.setState({ conversations: [conversation] });

      useChatStore.getState().incrementUnreadCount('conv-1');

      const { conversations } = useChatStore.getState();
      expect(conversations[0].unreadCount).toBe(1);
    });
  });
});
