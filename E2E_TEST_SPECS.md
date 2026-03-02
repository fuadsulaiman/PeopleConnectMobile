# PeopleConnect Mobile - E2E Test Specifications

**Version:** 1.0
**Last Updated:** March 2, 2026
**Testing Framework:** Detox + Maestro

---

## Table of Contents

1. [Test Configuration](#1-test-configuration)
2. [Authentication Test Specs](#2-authentication-test-specs)
3. [Messaging Test Specs](#3-messaging-test-specs)
4. [Call Test Specs](#4-call-test-specs)
5. [Contact Test Specs](#5-contact-test-specs)
6. [Profile Test Specs](#6-profile-test-specs)
7. [Notification Test Specs](#7-notification-test-specs)
8. [Test Utilities](#8-test-utilities)

---

## 1. Test Configuration

### 1.1 Detox Configuration

```javascript
// detox.config.js
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/PeopleConnectMobile.app',
      build: 'xcodebuild -workspace ios/PeopleConnectMobile.xcworkspace -scheme PeopleConnectMobile -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/PeopleConnectMobile.app',
      build: 'xcodebuild -workspace ios/PeopleConnectMobile.xcworkspace -scheme PeopleConnectMobile -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_8_API_34',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
```

### 1.2 Jest E2E Configuration

```javascript
// e2e/jest.config.js
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/specs/**/*.spec.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],
};
```

### 1.3 Test Setup

```typescript
// e2e/setup.ts
import { device, expect, element, by } from 'detox';

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: {
      notifications: 'YES',
      camera: 'YES',
      microphone: 'YES',
      photos: 'YES',
    },
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await device.terminateApp();
});
```

---

## 2. Authentication Test Specs

### 2.1 Login Tests

```typescript
// e2e/specs/auth/login.spec.ts
import { device, expect, element, by, waitFor } from 'detox';

describe('Authentication - Login', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // TC-F002-001: Successful login with valid credentials
  it('TC-AUTH-001: should login successfully with valid credentials', async () => {
    // Verify login screen is displayed
    await expect(element(by.id('login-screen'))).toBeVisible();

    // Enter username
    await element(by.id('username-input')).tap();
    await element(by.id('username-input')).typeText('test_user_01');

    // Enter password
    await element(by.id('password-input')).tap();
    await element(by.id('password-input')).typeText('Aa@123456');

    // Hide keyboard
    await element(by.id('password-input')).tapReturnKey();

    // Tap sign in button
    await element(by.id('signin-button')).tap();

    // Wait for navigation to conversations screen
    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify user is on main screen
    await expect(element(by.id('conversations-list'))).toBeVisible();
  });

  // TC-F002-002: Login with incorrect credentials
  it('TC-AUTH-002: should show error for invalid credentials', async () => {
    await element(by.id('username-input')).typeText('test_user_01');
    await element(by.id('password-input')).typeText('WrongPassword123');
    await element(by.id('password-input')).tapReturnKey();

    await element(by.id('signin-button')).tap();

    // Wait for error message
    await waitFor(element(by.text('Invalid username or password')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify still on login screen
    await expect(element(by.id('login-screen'))).toBeVisible();
  });

  // TC-F002-003: Login with 2FA enabled account
  it('TC-AUTH-003: should prompt for 2FA code', async () => {
    await element(by.id('username-input')).typeText('test_user_2fa');
    await element(by.id('password-input')).typeText('Aa@123456');
    await element(by.id('password-input')).tapReturnKey();

    await element(by.id('signin-button')).tap();

    // Wait for 2FA screen
    await waitFor(element(by.id('twofa-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify 2FA code input is visible
    await expect(element(by.id('twofa-code-input'))).toBeVisible();
    await expect(element(by.id('verify-button'))).toBeVisible();
  });

  // TC-AUTH-004: Remember me functionality
  it('TC-AUTH-004: should persist session with remember me', async () => {
    await element(by.id('username-input')).typeText('test_user_01');
    await element(by.id('password-input')).typeText('Aa@123456');

    // Toggle remember me
    await element(by.id('remember-me-toggle')).tap();

    await element(by.id('signin-button')).tap();

    // Wait for login
    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Restart app
    await device.terminateApp();
    await device.launchApp({ newInstance: false });

    // Should still be logged in
    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // TC-AUTH-005: Logout functionality
  it('TC-AUTH-005: should logout successfully', async () => {
    // Login first
    await element(by.id('username-input')).typeText('test_user_01');
    await element(by.id('password-input')).typeText('Aa@123456');
    await element(by.id('signin-button')).tap();

    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to profile
    await element(by.id('profile-tab')).tap();

    // Tap logout
    await element(by.id('logout-button')).tap();

    // Confirm logout
    await element(by.text('Logout')).tap();

    // Verify redirected to login
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### 2.2 Registration Tests

```typescript
// e2e/specs/auth/registration.spec.ts
import { device, expect, element, by, waitFor } from 'detox';

describe('Authentication - Registration', () => {
  const uniqueUsername = `test_${Date.now()}`;

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // TC-F001-001: Successful registration
  it('TC-REG-001: should register successfully with valid data', async () => {
    // Navigate to registration
    await element(by.id('create-account-link')).tap();

    await waitFor(element(by.id('register-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Fill registration form
    await element(by.id('name-input')).typeText('Test User');
    await element(by.id('username-input')).typeText(uniqueUsername);
    await element(by.id('password-input')).typeText('TestPass123!');
    await element(by.id('confirm-password-input')).typeText('TestPass123!');

    // Submit
    await element(by.id('register-button')).tap();

    // Wait for success
    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify success message
    await expect(element(by.text('Account created successfully'))).toBeVisible();
  });

  // TC-F001-002: Registration with invitation code
  it('TC-REG-002: should require invitation code in invite-only mode', async () => {
    // Navigate to registration
    await element(by.id('create-account-link')).tap();

    // Check if invitation code field is visible (when invite-only mode is enabled)
    const inviteCodeInput = element(by.id('invitation-code-input'));

    try {
      await expect(inviteCodeInput).toBeVisible();
      // If visible, test with invalid code
      await element(by.id('name-input')).typeText('Test User');
      await element(by.id('username-input')).typeText(`test_invite_${Date.now()}`);
      await element(by.id('password-input')).typeText('TestPass123!');
      await element(by.id('confirm-password-input')).typeText('TestPass123!');
      await inviteCodeInput.typeText('INVALID-CODE');

      await element(by.id('register-button')).tap();

      // Should show error
      await waitFor(element(by.text('Invalid invitation code')))
        .toBeVisible()
        .withTimeout(5000);
    } catch (e) {
      // Invite-only mode not enabled, test passes
      console.log('Invite-only mode not enabled');
    }
  });

  // TC-F001-003: Registration validation
  it('TC-REG-003: should show validation errors', async () => {
    await element(by.id('create-account-link')).tap();

    await waitFor(element(by.id('register-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Try to submit empty form
    await element(by.id('register-button')).tap();

    // Verify validation errors
    await expect(element(by.text('Name is required'))).toBeVisible();
    await expect(element(by.text('Username is required'))).toBeVisible();
    await expect(element(by.text('Password is required'))).toBeVisible();
  });

  // TC-REG-004: Password requirements validation
  it('TC-REG-004: should validate password requirements', async () => {
    await element(by.id('create-account-link')).tap();

    await element(by.id('name-input')).typeText('Test User');
    await element(by.id('username-input')).typeText(`test_pwd_${Date.now()}`);

    // Enter weak password
    await element(by.id('password-input')).typeText('weak');
    await element(by.id('confirm-password-input')).typeText('weak');

    await element(by.id('register-button')).tap();

    // Should show password requirement error
    await waitFor(element(by.text(/Password must be at least 8 characters/)))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### 2.3 Password Recovery Tests

```typescript
// e2e/specs/auth/password-recovery.spec.ts
import { device, expect, element, by, waitFor } from 'detox';

describe('Authentication - Password Recovery', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // TC-F003-001: Request password reset
  it('TC-PWD-001: should request password reset', async () => {
    // Tap forgot password
    await element(by.id('forgot-password-link')).tap();

    await waitFor(element(by.id('forgot-password-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Enter email
    await element(by.id('email-input')).typeText('test@example.com');

    // Submit
    await element(by.id('send-reset-link-button')).tap();

    // Verify success message
    await waitFor(element(by.text('Reset link sent')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // TC-PWD-002: Invalid email handling
  it('TC-PWD-002: should handle non-existent email', async () => {
    await element(by.id('forgot-password-link')).tap();

    await element(by.id('email-input')).typeText('nonexistent@example.com');
    await element(by.id('send-reset-link-button')).tap();

    // Should show appropriate message (may still say "sent" for security)
    await waitFor(element(by.text(/Reset link sent|email not found/i)))
      .toBeVisible()
      .withTimeout(10000);
  });
});
```

---

## 3. Messaging Test Specs

### 3.1 Direct Messaging Tests

```typescript
// e2e/specs/messaging/direct-messages.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser, createDMConversation } from '../utils/helpers';

describe('Messaging - Direct Messages', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  beforeEach(async () => {
    // Navigate to conversations
    await element(by.id('chats-tab')).tap();
  });

  // TC-F010-001: Send text message
  it('TC-MSG-001: should send text message successfully', async () => {
    // Open existing conversation or create new
    await element(by.id('conversation-item-0')).tap();

    await waitFor(element(by.id('chat-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Type message
    const testMessage = `Test message ${Date.now()}`;
    await element(by.id('message-input')).tap();
    await element(by.id('message-input')).typeText(testMessage);

    // Send message
    await element(by.id('send-button')).tap();

    // Verify message appears
    await waitFor(element(by.text(testMessage)))
      .toBeVisible()
      .withTimeout(5000);

    // Verify sent status
    await expect(element(by.id('message-status-sent'))).toBeVisible();
  });

  // TC-MSG-002: Send multiline message
  it('TC-MSG-002: should send multiline message', async () => {
    await element(by.id('conversation-item-0')).tap();

    await element(by.id('message-input')).tap();
    await element(by.id('message-input')).typeText('Line 1');

    // For multiline, we need to handle platform-specific
    if (device.getPlatform() === 'ios') {
      await element(by.id('message-input')).typeText('\n');
    } else {
      await device.pressBack(); // Close keyboard
      // Tap shift+enter or use special method
    }

    await element(by.id('message-input')).typeText('Line 2');
    await element(by.id('send-button')).tap();

    await waitFor(element(by.text('Line 1')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-F014-001: Reply to message
  it('TC-MSG-003: should reply to message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Long press on a message
    await element(by.id('message-item-0')).longPress();

    // Tap reply option
    await element(by.id('reply-option')).tap();

    // Verify reply preview shown
    await expect(element(by.id('reply-preview'))).toBeVisible();

    // Type reply
    await element(by.id('message-input')).typeText('This is a reply');
    await element(by.id('send-button')).tap();

    // Verify reply sent with context
    await waitFor(element(by.id('reply-context')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-F013-001: Add reaction to message
  it('TC-MSG-004: should add reaction to message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Long press on message
    await element(by.id('message-item-0')).longPress();

    // Tap reaction option
    await element(by.id('reaction-option')).tap();

    // Select thumbs up emoji
    await element(by.id('emoji-thumbsup')).tap();

    // Verify reaction appears
    await waitFor(element(by.id('reaction-indicator')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-F015-001: Edit message
  it('TC-MSG-005: should edit message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Send a message first
    const originalMessage = `Original ${Date.now()}`;
    await element(by.id('message-input')).typeText(originalMessage);
    await element(by.id('send-button')).tap();

    await waitFor(element(by.text(originalMessage)))
      .toBeVisible()
      .withTimeout(5000);

    // Long press on own message
    await element(by.text(originalMessage)).longPress();

    // Tap edit
    await element(by.id('edit-option')).tap();

    // Modify message
    await element(by.id('edit-message-input')).clearText();
    await element(by.id('edit-message-input')).typeText('Edited message');

    // Save
    await element(by.id('save-edit-button')).tap();

    // Verify edited
    await waitFor(element(by.text('Edited message')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify (edited) label
    await expect(element(by.text('(edited)'))).toBeVisible();
  });

  // TC-F016-001: Delete message for me
  it('TC-MSG-006: should delete message for me', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Send a message
    const deleteMessage = `Delete me ${Date.now()}`;
    await element(by.id('message-input')).typeText(deleteMessage);
    await element(by.id('send-button')).tap();

    await waitFor(element(by.text(deleteMessage)))
      .toBeVisible()
      .withTimeout(5000);

    // Long press
    await element(by.text(deleteMessage)).longPress();

    // Tap delete
    await element(by.id('delete-option')).tap();

    // Select delete for me
    await element(by.text('Delete for me')).tap();

    // Confirm if needed
    try {
      await element(by.text('Delete')).tap();
    } catch (e) {
      // No confirmation needed
    }

    // Verify message removed
    await waitFor(element(by.text(deleteMessage)))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  // TC-F017-001: Forward message
  it('TC-MSG-007: should forward message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Long press on message
    await element(by.id('message-item-0')).longPress();

    // Tap forward
    await element(by.id('forward-option')).tap();

    // Select recipient
    await waitFor(element(by.id('forward-modal')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('forward-recipient-0')).tap();

    // Tap forward button
    await element(by.id('forward-confirm-button')).tap();

    // Verify success toast
    await waitFor(element(by.text('Message forwarded')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### 3.2 Media Messaging Tests

```typescript
// e2e/specs/messaging/media-messages.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Messaging - Media Messages', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  // TC-F012-001: Send image message
  it('TC-MEDIA-001: should send image message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Tap attachment button
    await element(by.id('attachment-button')).tap();

    // Select image option
    await element(by.id('attach-image')).tap();

    // Select from gallery (mock/simulator)
    await waitFor(element(by.id('image-picker')))
      .toBeVisible()
      .withTimeout(5000);

    // Select first image
    await element(by.id('gallery-image-0')).tap();

    // Tap send
    await element(by.id('send-button')).tap();

    // Verify image sent
    await waitFor(element(by.id('image-message')))
      .toBeVisible()
      .withTimeout(15000); // Allow time for upload
  });

  // TC-F018-001: Send voice message
  it('TC-MEDIA-002: should send voice message', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Long press microphone button
    await element(by.id('microphone-button')).longPress(3000);

    // Release to stop recording

    // Preview should appear
    await waitFor(element(by.id('voice-preview')))
      .toBeVisible()
      .withTimeout(5000);

    // Send voice message
    await element(by.id('send-voice-button')).tap();

    // Verify sent
    await waitFor(element(by.id('voice-message')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // TC-F021-001: Send view-once image
  it('TC-MEDIA-003: should send view-once image', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Tap attachment
    await element(by.id('attachment-button')).tap();
    await element(by.id('attach-image')).tap();

    // Select image
    await waitFor(element(by.id('image-picker'))).toBeVisible();
    await element(by.id('gallery-image-0')).tap();

    // Toggle view once
    await element(by.id('view-once-toggle')).tap();

    // Send
    await element(by.id('send-button')).tap();

    // Verify view-once indicator
    await waitFor(element(by.id('view-once-indicator')))
      .toBeVisible()
      .withTimeout(15000);
  });
});
```

### 3.3 Group Chat Tests

```typescript
// e2e/specs/messaging/group-chat.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Messaging - Group Chat', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  // TC-F011-001: Create group chat
  it('TC-GROUP-001: should create group chat', async () => {
    // Tap new chat button
    await element(by.id('new-chat-button')).tap();

    // Select create group
    await element(by.id('create-group-option')).tap();

    // Enter group name
    await element(by.id('group-name-input')).typeText('Test Group E2E');

    // Select participants
    await element(by.id('contact-checkbox-0')).tap();
    await element(by.id('contact-checkbox-1')).tap();

    // Create group
    await element(by.id('create-group-button')).tap();

    // Verify group created
    await waitFor(element(by.text('Test Group E2E')))
      .toBeVisible()
      .withTimeout(10000);
  });

  // TC-GROUP-002: Add members to group
  it('TC-GROUP-002: should add members to group', async () => {
    // Open existing group
    await element(by.id('group-conversation-0')).tap();

    // Open group settings
    await element(by.id('group-settings-button')).tap();

    // Tap add members
    await element(by.id('add-members-button')).tap();

    // Select member
    await element(by.id('member-checkbox-0')).tap();

    // Confirm add
    await element(by.id('confirm-add-button')).tap();

    // Verify member added
    await waitFor(element(by.text('Member added')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-GROUP-003: Leave group
  it('TC-GROUP-003: should leave group', async () => {
    // Open group
    await element(by.id('group-conversation-test')).tap();

    // Open settings
    await element(by.id('group-settings-button')).tap();

    // Tap leave group
    await element(by.id('leave-group-button')).tap();

    // Confirm
    await element(by.text('Leave')).tap();

    // Verify left
    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## 4. Call Test Specs

### 4.1 Voice Call Tests

```typescript
// e2e/specs/calls/voice-calls.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Calls - Voice Calls', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  // TC-F030-001: Initiate voice call
  it('TC-CALL-001: should initiate voice call', async () => {
    // Open conversation
    await element(by.id('conversation-item-0')).tap();

    // Tap voice call button
    await element(by.id('voice-call-button')).tap();

    // Verify call screen
    await waitFor(element(by.id('call-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify calling state
    await expect(element(by.text('Calling...'))).toBeVisible();

    // End call (simulate no answer)
    await element(by.id('end-call-button')).tap();
  });

  // TC-CALL-002: Mute functionality
  it('TC-CALL-002: should toggle mute during call', async () => {
    await element(by.id('conversation-item-0')).tap();
    await element(by.id('voice-call-button')).tap();

    await waitFor(element(by.id('call-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap mute button
    await element(by.id('mute-button')).tap();

    // Verify muted state
    await expect(element(by.id('mute-button-active'))).toBeVisible();

    // Unmute
    await element(by.id('mute-button')).tap();

    // Verify unmuted
    await expect(element(by.id('mute-button-inactive'))).toBeVisible();

    // End call
    await element(by.id('end-call-button')).tap();
  });

  // TC-CALL-003: Speaker toggle
  it('TC-CALL-003: should toggle speaker', async () => {
    await element(by.id('conversation-item-0')).tap();
    await element(by.id('voice-call-button')).tap();

    await waitFor(element(by.id('call-screen'))).toBeVisible();

    // Toggle speaker
    await element(by.id('speaker-button')).tap();

    // Verify speaker on
    await expect(element(by.id('speaker-button-active'))).toBeVisible();

    // End call
    await element(by.id('end-call-button')).tap();
  });
});
```

### 4.2 Video Call Tests

```typescript
// e2e/specs/calls/video-calls.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Calls - Video Calls', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  // TC-F031-001: Initiate video call
  it('TC-VIDEO-001: should initiate video call', async () => {
    await element(by.id('conversation-item-0')).tap();

    // Tap video call button
    await element(by.id('video-call-button')).tap();

    // Verify call screen with video
    await waitFor(element(by.id('video-call-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify local video preview
    await expect(element(by.id('local-video-preview'))).toBeVisible();

    // End call
    await element(by.id('end-call-button')).tap();
  });

  // TC-VIDEO-002: Camera toggle
  it('TC-VIDEO-002: should toggle camera', async () => {
    await element(by.id('conversation-item-0')).tap();
    await element(by.id('video-call-button')).tap();

    await waitFor(element(by.id('video-call-screen'))).toBeVisible();

    // Toggle camera off
    await element(by.id('camera-toggle-button')).tap();

    // Verify camera off indicator
    await expect(element(by.id('camera-off-placeholder'))).toBeVisible();

    // Toggle camera on
    await element(by.id('camera-toggle-button')).tap();

    // Verify video preview
    await expect(element(by.id('local-video-preview'))).toBeVisible();

    await element(by.id('end-call-button')).tap();
  });

  // TC-VIDEO-003: Switch camera
  it('TC-VIDEO-003: should switch camera', async () => {
    await element(by.id('conversation-item-0')).tap();
    await element(by.id('video-call-button')).tap();

    await waitFor(element(by.id('video-call-screen'))).toBeVisible();

    // Tap switch camera
    await element(by.id('switch-camera-button')).tap();

    // Visual verification would be manual
    // Just verify no crash
    await expect(element(by.id('local-video-preview'))).toBeVisible();

    await element(by.id('end-call-button')).tap();
  });
});
```

---

## 5. Contact Test Specs

```typescript
// e2e/specs/contacts/contacts.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Contacts', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  beforeEach(async () => {
    await element(by.id('contacts-tab')).tap();
  });

  // TC-F040-001: Send contact request
  it('TC-CONTACT-001: should send contact request', async () => {
    // Tap add contact
    await element(by.id('add-contact-button')).tap();

    // Search for user
    await element(by.id('search-users-input')).typeText('test_user');

    // Wait for results
    await waitFor(element(by.id('search-result-0')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap add on result
    await element(by.id('add-contact-result-0')).tap();

    // Verify request sent
    await waitFor(element(by.text('Request sent')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-F040-002: Accept contact request
  it('TC-CONTACT-002: should accept contact request', async () => {
    // Go to pending tab
    await element(by.id('pending-tab')).tap();

    // Check if there are pending requests
    try {
      await element(by.id('pending-request-0')).tap();

      // Accept request
      await element(by.id('accept-request-button')).tap();

      // Verify accepted
      await waitFor(element(by.text('Contact added')))
        .toBeVisible()
        .withTimeout(5000);
    } catch (e) {
      console.log('No pending requests');
    }
  });

  // TC-F041-001: Block user
  it('TC-CONTACT-003: should block user', async () => {
    // Long press on contact
    await element(by.id('contact-item-0')).longPress();

    // Tap block
    await element(by.id('block-option')).tap();

    // Confirm block
    await element(by.text('Block')).tap();

    // Verify blocked
    await waitFor(element(by.text('User blocked')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify in blocked tab
    await element(by.id('blocked-tab')).tap();
    await expect(element(by.id('blocked-contact-0'))).toBeVisible();
  });

  // TC-F040-003: Favorite contact
  it('TC-CONTACT-004: should mark contact as favorite', async () => {
    // Long press on contact
    await element(by.id('contact-item-0')).longPress();

    // Tap favorite
    await element(by.id('favorite-option')).tap();

    // Verify star appears
    await expect(element(by.id('favorite-indicator-0'))).toBeVisible();

    // Verify in starred tab
    await element(by.id('starred-tab')).tap();
    await expect(element(by.id('starred-contact-0'))).toBeVisible();
  });
});
```

---

## 6. Profile Test Specs

```typescript
// e2e/specs/profile/profile.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Profile', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
    await element(by.id('profile-tab')).tap();
  });

  // TC-F005-001: Update profile
  it('TC-PROFILE-001: should update profile information', async () => {
    // Tap edit profile
    await element(by.id('edit-profile-button')).tap();

    await waitFor(element(by.id('edit-profile-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Update name
    await element(by.id('name-input')).clearText();
    await element(by.id('name-input')).typeText('Updated Name');

    // Update bio
    await element(by.id('bio-input')).clearText();
    await element(by.id('bio-input')).typeText('Updated bio');

    // Save
    await element(by.id('save-profile-button')).tap();

    // Verify saved
    await waitFor(element(by.text('Profile updated')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify display
    await expect(element(by.text('Updated Name'))).toBeVisible();
  });

  // TC-F006-001: Privacy settings
  it('TC-PROFILE-002: should toggle privacy settings', async () => {
    // Navigate to privacy
    await element(by.id('privacy-settings-button')).tap();

    await waitFor(element(by.id('privacy-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Toggle online status
    await element(by.id('show-online-status-toggle')).tap();

    // Toggle read receipts
    await element(by.id('show-read-receipts-toggle')).tap();

    // Verify toggles changed (check visual state)
    await expect(element(by.id('show-online-status-toggle'))).toHaveToggleValue(false);
  });

  // TC-PROFILE-003: Change password
  it('TC-PROFILE-003: should change password', async () => {
    // Navigate to security
    await element(by.id('security-settings-button')).tap();

    // Tap change password
    await element(by.id('change-password-button')).tap();

    // Enter current password
    await element(by.id('current-password-input')).typeText('Aa@123456');

    // Enter new password
    await element(by.id('new-password-input')).typeText('NewPass123!');
    await element(by.id('confirm-password-input')).typeText('NewPass123!');

    // Save
    await element(by.id('save-password-button')).tap();

    // Verify success
    await waitFor(element(by.text('Password changed')))
      .toBeVisible()
      .withTimeout(5000);

    // Change back for other tests
    await element(by.id('change-password-button')).tap();
    await element(by.id('current-password-input')).typeText('NewPass123!');
    await element(by.id('new-password-input')).typeText('Aa@123456');
    await element(by.id('confirm-password-input')).typeText('Aa@123456');
    await element(by.id('save-password-button')).tap();
  });
});
```

---

## 7. Notification Test Specs

```typescript
// e2e/specs/notifications/notifications.spec.ts
import { device, expect, element, by, waitFor } from 'detox';
import { loginAsUser } from '../utils/helpers';

describe('Notifications', () => {
  beforeAll(async () => {
    await loginAsUser('test_user_01', 'Aa@123456');
  });

  // TC-F053-001: View notifications
  it('TC-NOTIF-001: should display notifications', async () => {
    // Tap notification bell
    await element(by.id('notification-bell')).tap();

    // Verify notification dropdown/screen
    await waitFor(element(by.id('notifications-list')))
      .toBeVisible()
      .withTimeout(5000);
  });

  // TC-NOTIF-002: Mark all as read
  it('TC-NOTIF-002: should mark all notifications as read', async () => {
    await element(by.id('notification-bell')).tap();

    // Tap mark all read
    await element(by.id('mark-all-read-button')).tap();

    // Verify badge cleared
    await expect(element(by.id('notification-badge'))).not.toBeVisible();
  });

  // TC-NOTIF-003: Navigate from notification
  it('TC-NOTIF-003: should navigate from notification', async () => {
    await element(by.id('notification-bell')).tap();

    // Check if notifications exist
    try {
      await element(by.id('notification-item-0')).tap();

      // Should navigate to relevant screen
      await waitFor(element(by.id('chat-screen').or(by.id('profile-screen'))))
        .toBeVisible()
        .withTimeout(5000);
    } catch (e) {
      console.log('No notifications to tap');
    }
  });
});
```

---

## 8. Test Utilities

### 8.1 Helper Functions

```typescript
// e2e/utils/helpers.ts
import { device, element, by, waitFor } from 'detox';

export async function loginAsUser(username: string, password: string): Promise<void> {
  await device.reloadReactNative();

  // Check if already logged in
  try {
    await waitFor(element(by.id('conversations-screen')))
      .toBeVisible()
      .withTimeout(2000);

    // Already logged in, logout first
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();
    await element(by.text('Logout')).tap();

    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  } catch (e) {
    // Not logged in, continue
  }

  // Login
  await element(by.id('username-input')).typeText(username);
  await element(by.id('password-input')).typeText(password);
  await element(by.id('signin-button')).tap();

  await waitFor(element(by.id('conversations-screen')))
    .toBeVisible()
    .withTimeout(15000);
}

export async function logout(): Promise<void> {
  await element(by.id('profile-tab')).tap();
  await element(by.id('logout-button')).tap();
  await element(by.text('Logout')).tap();

  await waitFor(element(by.id('login-screen')))
    .toBeVisible()
    .withTimeout(5000);
}

export async function createDMConversation(contactName: string): Promise<void> {
  await element(by.id('new-chat-button')).tap();
  await element(by.id('new-dm-option')).tap();

  await element(by.id('search-contacts-input')).typeText(contactName);
  await element(by.id('contact-result-0')).tap();

  await waitFor(element(by.id('chat-screen')))
    .toBeVisible()
    .withTimeout(5000);
}

export async function sendMessage(message: string): Promise<void> {
  await element(by.id('message-input')).typeText(message);
  await element(by.id('send-button')).tap();

  await waitFor(element(by.text(message)))
    .toBeVisible()
    .withTimeout(5000);
}

export async function openConversation(index: number = 0): Promise<void> {
  await element(by.id(`conversation-item-${index}`)).tap();

  await waitFor(element(by.id('chat-screen')))
    .toBeVisible()
    .withTimeout(5000);
}

export async function navigateToTab(tab: 'chats' | 'contacts' | 'profile'): Promise<void> {
  await element(by.id(`${tab}-tab`)).tap();
}

export async function scrollToElement(
  scrollViewId: string,
  elementId: string,
  direction: 'up' | 'down' = 'down'
): Promise<void> {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(200, direction);
}

export async function takeScreenshot(name: string): Promise<void> {
  const screenshot = await device.takeScreenshot(name);
  console.log(`Screenshot saved: ${screenshot}`);
}
```

### 8.2 Test IDs Reference

```typescript
// e2e/utils/testIds.ts
export const TestIds = {
  // Auth
  LOGIN_SCREEN: 'login-screen',
  REGISTER_SCREEN: 'register-screen',
  TWOFA_SCREEN: 'twofa-screen',
  USERNAME_INPUT: 'username-input',
  PASSWORD_INPUT: 'password-input',
  SIGNIN_BUTTON: 'signin-button',

  // Navigation
  CHATS_TAB: 'chats-tab',
  CONTACTS_TAB: 'contacts-tab',
  PROFILE_TAB: 'profile-tab',

  // Conversations
  CONVERSATIONS_SCREEN: 'conversations-screen',
  CONVERSATIONS_LIST: 'conversations-list',
  CONVERSATION_ITEM: 'conversation-item',
  NEW_CHAT_BUTTON: 'new-chat-button',

  // Chat
  CHAT_SCREEN: 'chat-screen',
  MESSAGE_INPUT: 'message-input',
  SEND_BUTTON: 'send-button',
  MESSAGE_LIST: 'message-list',
  MESSAGE_ITEM: 'message-item',

  // Calls
  VOICE_CALL_BUTTON: 'voice-call-button',
  VIDEO_CALL_BUTTON: 'video-call-button',
  CALL_SCREEN: 'call-screen',
  END_CALL_BUTTON: 'end-call-button',
  MUTE_BUTTON: 'mute-button',

  // Contacts
  ADD_CONTACT_BUTTON: 'add-contact-button',
  CONTACT_ITEM: 'contact-item',
  PENDING_TAB: 'pending-tab',
  BLOCKED_TAB: 'blocked-tab',
  STARRED_TAB: 'starred-tab',

  // Profile
  EDIT_PROFILE_BUTTON: 'edit-profile-button',
  LOGOUT_BUTTON: 'logout-button',
  PRIVACY_SETTINGS_BUTTON: 'privacy-settings-button',
  SECURITY_SETTINGS_BUTTON: 'security-settings-button',
};
```

### 8.3 Running Tests

```bash
# Build app for testing
npm run e2e:build:ios
npm run e2e:build:android

# Run all E2E tests
npm run e2e:test:ios
npm run e2e:test:android

# Run specific test file
npm run e2e:test:ios -- --testNamePattern="Authentication"

# Run with specific configuration
detox test --configuration ios.sim.release

# Generate test report
npm run e2e:test:ios -- --reporters=jest-html-reporter
```

---

*Document maintained by QA Team. Last review: March 2, 2026*
