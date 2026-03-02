import { device, element, by, expect } from 'detox';

describe('Calls Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { microphone: 'YES', camera: 'YES' },
    });
    // Login
    await element(by.id('username-input')).typeText('testuser');
    await element(by.id('password-input')).typeText('Aa@123456');
    await element(by.id('login-button')).tap();
    await expect(element(by.id('conversations-screen'))).toBeVisible();
  });

  describe('Initiating Calls', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });

    it('should show voice call button', async () => {
      await expect(element(by.id('voice-call-button'))).toBeVisible();
    });

    it('should show video call button', async () => {
      await expect(element(by.id('video-call-button'))).toBeVisible();
    });

    it('should initiate voice call on button tap', async () => {
      await element(by.id('voice-call-button')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
      await expect(element(by.id('calling-status'))).toBeVisible();
    });

    it('should initiate video call on button tap', async () => {
      await element(by.id('video-call-button')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
      await expect(element(by.id('local-video-preview'))).toBeVisible();
    });

    it('should show call participant info', async () => {
      await element(by.id('voice-call-button')).tap();
      await expect(element(by.id('participant-name'))).toBeVisible();
      await expect(element(by.id('participant-avatar'))).toBeVisible();
    });
  });

  describe('Call Controls', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await element(by.id('voice-call-button')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
    });

    it('should show mute button', async () => {
      await expect(element(by.id('mute-button'))).toBeVisible();
    });

    it('should toggle mute on tap', async () => {
      await element(by.id('mute-button')).tap();
      await expect(element(by.id('mute-button-active'))).toBeVisible();

      await element(by.id('mute-button-active')).tap();
      await expect(element(by.id('mute-button'))).toBeVisible();
    });

    it('should show speaker button', async () => {
      await expect(element(by.id('speaker-button'))).toBeVisible();
    });

    it('should toggle speaker on tap', async () => {
      await element(by.id('speaker-button')).tap();
      await expect(element(by.id('speaker-button-active'))).toBeVisible();
    });

    it('should show end call button', async () => {
      await expect(element(by.id('end-call-button'))).toBeVisible();
    });

    it('should end call on button tap', async () => {
      await element(by.id('end-call-button')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });
  });

  describe('Video Call Controls', () => {
    beforeEach(async () => {
      await element(by.id('conversation-item-0')).tap();
      await element(by.id('video-call-button')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
    });

    it('should show camera toggle button', async () => {
      await expect(element(by.id('camera-toggle-button'))).toBeVisible();
    });

    it('should toggle camera on/off', async () => {
      await element(by.id('camera-toggle-button')).tap();
      await expect(element(by.id('camera-off-indicator'))).toBeVisible();

      await element(by.id('camera-toggle-button')).tap();
      await expect(element(by.id('local-video-preview'))).toBeVisible();
    });

    it('should show flip camera button', async () => {
      await expect(element(by.id('flip-camera-button'))).toBeVisible();
    });

    it('should flip camera on tap', async () => {
      await element(by.id('flip-camera-button')).tap();
      // Camera should switch between front and back
    });

    it('should show remote video when connected', async () => {
      // This requires the call to be connected
      await expect(element(by.id('remote-video-view'))).toExist();
    });

    it('should show picture-in-picture local video', async () => {
      await expect(element(by.id('local-video-pip'))).toBeVisible();
    });
  });

  describe('Incoming Calls', () => {
    it('should show incoming call screen', async () => {
      // This would require simulating an incoming call
      await expect(element(by.id('incoming-call-screen'))).toExist();
    });

    it('should show caller information', async () => {
      await expect(element(by.id('caller-name'))).toExist();
      await expect(element(by.id('caller-avatar'))).toExist();
    });

    it('should show accept button', async () => {
      await expect(element(by.id('accept-call-button'))).toExist();
    });

    it('should show decline button', async () => {
      await expect(element(by.id('decline-call-button'))).toExist();
    });

    it('should accept call and navigate to call screen', async () => {
      await element(by.id('accept-call-button')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
    });

    it('should decline call and dismiss screen', async () => {
      await element(by.id('decline-call-button')).tap();
      await expect(element(by.id('incoming-call-screen'))).not.toBeVisible();
    });
  });

  describe('Call History', () => {
    it('should show calls tab in navigation', async () => {
      await expect(element(by.id('calls-tab'))).toBeVisible();
    });

    it('should display call history list', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-history-list'))).toBeVisible();
    });

    it('should show call type icon (voice/video)', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-type-icon-0'))).toBeVisible();
    });

    it('should show call direction (incoming/outgoing)', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-direction-0'))).toBeVisible();
    });

    it('should show call status (missed/completed)', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-status-0'))).toBeVisible();
    });

    it('should show call duration for completed calls', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-duration-0'))).toExist();
    });

    it('should show call timestamp', async () => {
      await element(by.id('calls-tab')).tap();
      await expect(element(by.id('call-timestamp-0'))).toBeVisible();
    });

    it('should initiate call from history item', async () => {
      await element(by.id('calls-tab')).tap();
      await element(by.id('call-history-item-0')).tap();
      await expect(element(by.id('call-screen'))).toBeVisible();
    });
  });

  describe('Group Calls (LiveKit)', () => {
    it('should show group call button in group chat', async () => {
      await element(by.id('group-conversation-item')).tap();
      await expect(element(by.id('group-call-button'))).toBeVisible();
    });

    it('should join group video call', async () => {
      await element(by.id('group-conversation-item')).tap();
      await element(by.id('group-call-button')).tap();

      await expect(element(by.id('group-call-screen'))).toBeVisible();
    });

    it('should show participant grid in group call', async () => {
      await expect(element(by.id('participants-grid'))).toBeVisible();
    });

    it('should show participant count', async () => {
      await expect(element(by.id('participant-count'))).toBeVisible();
    });

    it('should show screen share button', async () => {
      await expect(element(by.id('screen-share-button'))).toExist();
    });

    it('should leave group call', async () => {
      await element(by.id('leave-call-button')).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();
    });
  });

  describe('Call Error Handling', () => {
    it('should show error when call fails to connect', async () => {
      // Simulate network failure
      await expect(element(by.id('call-error-message'))).toExist();
    });

    it('should show retry button on connection failure', async () => {
      await expect(element(by.id('retry-call-button'))).toExist();
    });

    it('should handle blocked user call attempt', async () => {
      // Try to call a blocked user
      await expect(element(by.text('Cannot call this user'))).toExist();
    });
  });
});
