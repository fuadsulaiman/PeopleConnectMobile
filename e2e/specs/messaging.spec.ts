import { device, element, by, expect } from 'detox';

describe('Messaging Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Login
    await element(by.id('username-input')).typeText('testuser');
    await element(by.id('password-input')).typeText('Aa@123456');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('conversations-screen'))).toBeVisible();
  });

  describe('Conversation List', () => {
    it('should display conversation list', async () => {
      await expect(element(by.id('conversation-list'))).toBeVisible();
    });

    it('should show new conversation button', async () => {
      await expect(element(by.id('new-conversation-button'))).toBeVisible();
    });

    it('should display conversation items with avatar and name', async () => {
      await expect(element(by.id('conversation-item-0'))).toBeVisible();
      await expect(element(by.id('conversation-avatar-0'))).toBeVisible();
      await expect(element(by.id('conversation-name-0'))).toBeVisible();
    });

    it('should show last message preview', async () => {
      await expect(element(by.id('conversation-preview-0'))).toBeVisible();
    });

    it('should show unread count badge', async () => {
      // This depends on having unread messages
      await expect(element(by.id('unread-badge-0'))).toExist();
    });

    it('should open conversation on tap', async () => {
      await element(by.id('conversation-item-0')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should pull to refresh conversations', async () => {
      await element(by.id('conversation-list')).swipe('down', 'fast');
      // Should trigger refresh
      await expect(element(by.id('conversation-list'))).toBeVisible();
    });
  });

  describe('Chat Screen', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should display message list', async () => {
      await expect(element(by.id('message-list'))).toBeVisible();
    });

    it('should display message input', async () => {
      await expect(element(by.id('message-input'))).toBeVisible();
    });

    it('should display send button', async () => {
      await expect(element(by.id('send-button'))).toBeVisible();
    });

    it('should send text message', async () => {
      const testMessage = 'Hello, this is a test message!';
      await element(by.id('message-input')).typeText(testMessage);
      await element(by.id('send-button')).tap();

      // Message should appear in list
      await expect(element(by.text(testMessage))).toBeVisible();
    });

    it('should show message timestamp', async () => {
      await expect(element(by.id('message-timestamp-0'))).toExist();
    });

    it('should show delivery status', async () => {
      await expect(element(by.id('message-status-0'))).toExist();
    });

    it('should scroll to load older messages', async () => {
      await element(by.id('message-list')).swipe('down', 'slow');
      // Should load more messages
    });

    it('should show typing indicator', async () => {
      // This would require another user typing
      await expect(element(by.id('typing-indicator'))).toExist();
    });
  });

  describe('Message Actions', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should show message actions on long press', async () => {
      await element(by.id('message-item-0')).longPress();
      await expect(element(by.id('message-actions-sheet'))).toBeVisible();
    });

    it('should copy message text', async () => {
      await element(by.id('message-item-0')).longPress();
      await element(by.id('copy-message-action')).tap();

      // Should show copied toast
      await expect(element(by.text('Message copied'))).toBeVisible();
    });

    it('should reply to message', async () => {
      await element(by.id('message-item-0')).longPress();
      await element(by.id('reply-message-action')).tap();

      // Should show reply preview
      await expect(element(by.id('reply-preview'))).toBeVisible();
    });

    it('should forward message', async () => {
      await element(by.id('message-item-0')).longPress();
      await element(by.id('forward-message-action')).tap();

      // Should show forward modal
      await expect(element(by.id('forward-modal'))).toBeVisible();
    });

    it('should edit own message', async () => {
      // Send a message first
      await element(by.id('message-input')).typeText('Edit this message');
      await element(by.id('send-button')).tap();

      // Long press on sent message
      await element(by.id('own-message-0')).longPress();
      await element(by.id('edit-message-action')).tap();

      // Should show edit mode
      await expect(element(by.id('edit-mode-indicator'))).toBeVisible();
    });

    it('should delete own message', async () => {
      await element(by.id('own-message-0')).longPress();
      await element(by.id('delete-message-action')).tap();

      // Should show confirmation
      await expect(element(by.text('Delete message?'))).toBeVisible();
    });

    it('should add reaction to message', async () => {
      await element(by.id('message-item-0')).longPress();
      await element(by.id('add-reaction-action')).tap();

      // Should show reaction picker
      await expect(element(by.id('reaction-picker'))).toBeVisible();
    });
  });

  describe('Media Messages', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should show attachment button', async () => {
      await expect(element(by.id('attachment-button'))).toBeVisible();
    });

    it('should show attachment options on tap', async () => {
      await element(by.id('attachment-button')).tap();
      await expect(element(by.id('attachment-sheet'))).toBeVisible();
      await expect(element(by.id('camera-option'))).toBeVisible();
      await expect(element(by.id('gallery-option'))).toBeVisible();
      await expect(element(by.id('document-option'))).toBeVisible();
    });

    it('should show voice record button', async () => {
      await expect(element(by.id('voice-record-button'))).toBeVisible();
    });

    it('should start voice recording on long press', async () => {
      await element(by.id('voice-record-button')).longPress(1000);
      await expect(element(by.id('voice-recording-indicator'))).toBeVisible();
    });

    it('should display image messages', async () => {
      // Assuming there's an image message in the conversation
      await expect(element(by.id('image-message-0'))).toExist();
    });

    it('should open image in full screen on tap', async () => {
      await element(by.id('image-message-0')).tap();
      await expect(element(by.id('image-viewer'))).toBeVisible();
    });

    it('should display video messages with play button', async () => {
      await expect(element(by.id('video-message-0'))).toExist();
      await expect(element(by.id('video-play-button-0'))).toExist();
    });
  });

  describe('Group Chat', () => {
    it('should open group chat settings', async () => {
      // Open a group conversation
      await element(by.id('group-conversation-item')).tap();
      await element(by.id('chat-header')).tap();

      await expect(element(by.id('group-settings-screen'))).toBeVisible();
    });

    it('should display group members', async () => {
      await expect(element(by.id('members-list'))).toBeVisible();
    });

    it('should show group name', async () => {
      await expect(element(by.id('group-name'))).toBeVisible();
    });

    it('should show group avatar', async () => {
      await expect(element(by.id('group-avatar'))).toBeVisible();
    });

    it('should allow editing group name for admin', async () => {
      await element(by.id('edit-group-name')).tap();
      await expect(element(by.id('edit-group-name-modal'))).toBeVisible();
    });
  });

  describe('New Conversation', () => {
    it('should open new conversation modal', async () => {
      await element(by.id('new-conversation-button')).tap();
      await expect(element(by.id('new-conversation-modal'))).toBeVisible();
    });

    it('should show contact search', async () => {
      await element(by.id('new-conversation-button')).tap();
      await expect(element(by.id('contact-search-input'))).toBeVisible();
    });

    it('should display contacts list', async () => {
      await element(by.id('new-conversation-button')).tap();
      await expect(element(by.id('contacts-list'))).toBeVisible();
    });

    it('should start DM with selected contact', async () => {
      await element(by.id('new-conversation-button')).tap();
      await element(by.id('contact-item-0')).tap();

      // Should navigate to chat with that contact
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should allow creating group chat', async () => {
      await element(by.id('new-conversation-button')).tap();
      await element(by.id('create-group-button')).tap();

      await expect(element(by.id('create-group-screen'))).toBeVisible();
    });
  });
});
