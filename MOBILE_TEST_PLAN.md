# PeopleConnect Mobile - Comprehensive Test Plan

**Version:** 1.0
**Last Updated:** March 2, 2026
**Document Owner:** QA Team

---

## Table of Contents

1. [Test Strategy](#1-test-strategy)
2. [Test Environment](#2-test-environment)
3. [Test Categories](#3-test-categories)
4. [Test Cases by Feature](#4-test-cases-by-feature)
5. [Test Data Requirements](#5-test-data-requirements)
6. [Test Execution Schedule](#6-test-execution-schedule)
7. [Summary and Metrics](#7-summary-and-metrics)

---

## 1. Test Strategy

### 1.1 Test Pyramid

| Level | Percentage | Tools | Description |
|-------|------------|-------|-------------|
| Unit Tests | 40% | Jest, React Testing Library | Component-level testing, stores, utilities |
| Integration Tests | 30% | Jest, React Testing Library | Service integration, API mocking, store interactions |
| E2E Tests | 20% | Detox, Maestro | Full user flows, real device testing |
| Manual Tests | 10% | Manual | Exploratory, edge cases, visual verification |

### 1.2 Testing Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **Jest** | Unit and integration testing | `jest.config.js` |
| **React Testing Library** | Component rendering and interaction | `@testing-library/react-native` |
| **Detox** | E2E testing for iOS and Android | `detox.config.js` |
| **Maestro** | Declarative E2E testing | `maestro/` flows |
| **React Native Testing Library** | Native component testing | `@testing-library/react-native` |
| **MSW** | API mocking | Mock Service Worker |
| **Istanbul** | Code coverage | Built into Jest |

### 1.3 Quality Gates

| Gate | Threshold | Enforcement |
|------|-----------|-------------|
| Unit Test Coverage | >= 80% | CI/CD blocking |
| Integration Test Coverage | >= 70% | CI/CD blocking |
| E2E Critical Path Tests | 100% pass | Release blocking |
| No Critical Bugs | 0 | Release blocking |
| No High Bugs | <= 3 | Release blocking |
| Performance Benchmarks | Within targets | Release blocking |

### 1.4 Test Naming Convention

```
TC-{FEATURE_ID}-{NUMBER}: {Test Description}
Example: TC-F001-001: Successful user registration with valid data
```

---

## 2. Test Environment

### 2.1 Device Matrix

#### iOS Devices

| Device | iOS Version | Priority | Notes |
|--------|-------------|----------|-------|
| iPhone 15 Pro Max | iOS 17.x | P0 | Primary test device |
| iPhone 14 | iOS 17.x | P1 | Standard size |
| iPhone SE (3rd gen) | iOS 17.x | P1 | Small screen testing |
| iPhone 13 | iOS 16.x | P2 | Minimum supported |
| iPad Pro 12.9" | iOS 17.x | P2 | Tablet layout |
| iPad Air | iOS 16.x | P3 | Tablet minimum |

#### Android Devices

| Device | Android Version | Priority | Notes |
|--------|-----------------|----------|-------|
| Samsung Galaxy S24 Ultra | Android 14 | P0 | Primary test device |
| Google Pixel 8 | Android 14 | P0 | Stock Android reference |
| Samsung Galaxy A54 | Android 14 | P1 | Mid-range device |
| OnePlus 12 | Android 14 | P1 | Alternative flagship |
| Google Pixel 6a | Android 13 | P2 | Minimum supported |
| Samsung Galaxy Tab S9 | Android 14 | P2 | Tablet layout |
| Xiaomi Redmi Note 12 | Android 13 | P3 | Budget device testing |

### 2.2 Emulators/Simulators

#### iOS Simulators
- iPhone 15 Pro (iOS 17.2) - Primary
- iPhone SE (3rd gen) (iOS 17.2) - Small screen
- iPad Pro 12.9" (iOS 17.2) - Tablet

#### Android Emulators
- Pixel 8 API 34 (Android 14) - Primary
- Pixel 4 API 33 (Android 13) - Minimum supported
- Pixel Tablet API 34 - Tablet layout

### 2.3 Backend Environment

| Environment | URL | Purpose |
|-------------|-----|---------|
| Staging | `https://staging-api.peopleconnect.dev` | E2E and integration testing |
| QA | `https://qa-api.peopleconnect.dev` | Manual testing |
| Mock Server | Local MSW | Unit and offline testing |

### 2.4 Test User Accounts

| Username | Password | Purpose | 2FA |
|----------|----------|---------|-----|
| test_user_01 | Aa@123456 | Primary test user | No |
| test_user_02 | Aa@123456 | Secondary test user | No |
| test_user_2fa | Aa@123456 | 2FA testing | Yes |
| test_admin | Aa@123456 | Admin privileges | No |
| test_blocked | Aa@123456 | Blocked user testing | No |

---

## 3. Test Categories

### 3.1 Priority Levels

| Priority | Description | Examples |
|----------|-------------|----------|
| **P0 (Blocker)** | Core functionality, app unusable if broken | Login, Send Message, Voice Call |
| **P1 (Critical)** | Major features, significant user impact | Register, Group Chat, Video Call, Contacts |
| **P2 (Major)** | Important features, workaround exists | Reactions, Edit/Delete, Profile, 2FA |
| **P3 (Minor)** | Nice-to-have, low user impact | Themes, Sounds, Advanced Settings |

### 3.2 Test Types

| Type | Description | Tools |
|------|-------------|-------|
| **Functional** | Feature works as specified | Jest, Detox |
| **Performance** | Response times, memory usage | Flashlight, Profiler |
| **Security** | Auth, data protection | Manual, OWASP |
| **Accessibility** | Screen reader, contrast | Accessibility Inspector |
| **Usability** | UX flows, error handling | Manual |
| **Compatibility** | Cross-device behavior | Device farm |
| **Network** | Offline, slow network | Detox, Manual |
| **Localization** | RTL, translations | Manual |

---

## 4. Test Cases by Feature

### 4.1 Authentication (F-001 to F-006)

---

## TC-F001-001: Successful registration with valid data

**Feature:** F-001: User Registration
**Priority:** P0
**Type:** Functional

### Preconditions
- User is not logged in
- Registration is enabled on the platform
- Network connection available

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch the app | App opens to login screen |
| 2 | Tap "Create Account" or "Register" | Registration screen appears |
| 3 | Enter valid name (2+ characters): "Test User" | Name field accepts input |
| 4 | Enter valid username (3-30 chars): "testuser123" | Username field accepts input |
| 5 | Enter valid password: "TestPass123!" | Password field shows dots/masked |
| 6 | Confirm password: "TestPass123!" | Confirm field matches |
| 7 | Tap "Register" button | Loading indicator appears |
| 8 | Wait for response | Success message shown, redirected to login |

### Test Data
- Name: "Test User Mobile"
- Username: "test_mobile_${timestamp}"
- Password: "TestPass123!"

### Expected Outcome
- User account created successfully
- Redirect to login page with success message
- User can log in with new credentials

---

## TC-F001-002: Registration with invitation code (Invite-Only Mode)

**Feature:** F-001: User Registration
**Priority:** P1
**Type:** Functional

### Preconditions
- Invite-only mode enabled in system settings
- Valid invitation code available

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to registration screen | Invitation code field is visible |
| 2 | Enter all registration details | Fields populated |
| 3 | Enter valid invitation code | Code accepted |
| 4 | Tap Register | Account created successfully |

### Test Data
- Invitation code: Obtain from admin portal

### Expected Outcome
- Registration succeeds with valid code
- Invitation marked as used

---

## TC-F001-003: Registration validation errors

**Feature:** F-001: User Registration
**Priority:** P1
**Type:** Functional

### Preconditions
- User on registration screen

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Leave all fields empty, tap Register | Validation errors shown for all fields |
| 2 | Enter name with 1 character | "Name must be at least 2 characters" |
| 3 | Enter username with 2 characters | "Username must be at least 3 characters" |
| 4 | Enter weak password: "12345" | Password requirements error shown |
| 5 | Enter mismatched confirm password | "Passwords do not match" error |

### Test Data
- Invalid inputs as per steps

### Expected Outcome
- All validation errors displayed appropriately
- Registration blocked until valid data entered

---

## TC-F002-001: Successful login with valid credentials

**Feature:** F-002: User Login
**Priority:** P0
**Type:** Functional

### Preconditions
- User has registered account
- User is not logged in

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app | Login screen displayed |
| 2 | Enter valid username: "test_user_01" | Username accepted |
| 3 | Enter valid password: "Aa@123456" | Password masked |
| 4 | Tap "Sign In" | Loading indicator shown |
| 5 | Wait for authentication | Redirect to main chat screen |

### Test Data
- Username: test_user_01
- Password: Aa@123456

### Expected Outcome
- User successfully authenticated
- Token stored securely
- Main screen displayed with conversations

---

## TC-F002-002: Login with incorrect credentials

**Feature:** F-002: User Login
**Priority:** P0
**Type:** Functional

### Preconditions
- User on login screen

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter valid username | Username field populated |
| 2 | Enter wrong password | Password field populated |
| 3 | Tap Sign In | Error: "Invalid username or password" |
| 4 | Verify no redirect | User remains on login screen |

### Test Data
- Username: test_user_01
- Password: WrongPassword123

### Expected Outcome
- Login fails with appropriate error message
- No sensitive information leaked
- Rate limiting applied after multiple failures

---

## TC-F002-003: Login with 2FA enabled account

**Feature:** F-002: User Login
**Priority:** P1
**Type:** Functional

### Preconditions
- User has 2FA enabled on account
- Access to authenticator app

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter username: "test_user_2fa" | Username accepted |
| 2 | Enter password | Password accepted |
| 3 | Tap Sign In | 2FA verification screen appears |
| 4 | Enter 6-digit TOTP code | Code input field available |
| 5 | Tap Verify | Login successful, redirect to chat |

### Test Data
- Username: test_user_2fa
- Password: Aa@123456
- TOTP: Generated from authenticator app

### Expected Outcome
- Two-step verification completes successfully
- Full authentication achieved

---

## TC-F002-004: Login with backup code

**Feature:** F-002: User Login
**Priority:** P2
**Type:** Functional

### Preconditions
- User has 2FA enabled
- User has backup codes available
- User cannot access authenticator app

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete password authentication | 2FA screen shown |
| 2 | Enter 8-character backup code | Code accepted |
| 3 | Tap Verify | Login successful |
| 4 | Verify backup code invalidated | Used code no longer works |

### Test Data
- Backup code from initial 2FA setup

### Expected Outcome
- Backup code grants access
- Used code marked as consumed

---

## TC-F003-001: Password reset flow

**Feature:** F-003: Password Recovery
**Priority:** P1
**Type:** Functional

### Preconditions
- User has account with registered email
- Access to email

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap "Forgot Password" on login | Forgot password screen shown |
| 2 | Enter email or username | Input accepted |
| 3 | Tap "Send Reset Link" | Success message shown |
| 4 | Check email | Reset link received |
| 5 | Click reset link | Opens reset form (web/deeplink) |
| 6 | Enter new password | Password accepted |
| 7 | Login with new password | Login successful |

### Test Data
- Email: test@example.com

### Expected Outcome
- Password successfully reset
- User can login with new password
- Old password no longer works

---

## TC-F004-001: Enable 2FA from profile

**Feature:** F-004: Two-Factor Authentication
**Priority:** P2
**Type:** Functional

### Preconditions
- User logged in without 2FA
- Authenticator app available

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Profile > Security | Security settings shown |
| 2 | Tap "Enable 2FA" | QR code and secret key displayed |
| 3 | Scan QR code with authenticator | Code added to app |
| 4 | Enter verification code | Input field available |
| 5 | Tap Enable | 2FA enabled, backup codes shown |
| 6 | Save backup codes | Codes downloadable/copyable |

### Test Data
- TOTP code from authenticator

### Expected Outcome
- 2FA successfully enabled
- Backup codes generated and saved
- Subsequent logins require 2FA

---

## TC-F005-001: Update profile information

**Feature:** F-005: User Profile Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User logged in

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Profile tab | Profile screen displayed |
| 2 | Tap Edit Profile | Edit screen appears |
| 3 | Update display name | Name field editable |
| 4 | Update status message | Bio field editable |
| 5 | Tap Save | Changes saved successfully |
| 6 | Return to profile | Updated info displayed |

### Test Data
- New name: "Updated Name"
- New bio: "Updated bio message"

### Expected Outcome
- Profile updated successfully
- Changes visible immediately
- Changes persist after app restart

---

## TC-F005-002: Upload and crop avatar

**Feature:** F-005: User Profile Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User logged in
- Camera/gallery permissions available

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Edit Profile | Edit screen shown |
| 2 | Tap avatar/camera icon | Image picker appears |
| 3 | Select image from gallery | Image loaded |
| 4 | Adjust crop area | Cropper functional |
| 5 | Tap Save/Confirm | Image uploaded |
| 6 | Verify avatar updated | New avatar displayed |

### Test Data
- Test image file (JPEG/PNG, < 5MB)

### Expected Outcome
- Avatar uploaded and cropped
- New avatar displayed across app
- Old avatar replaced

---

## TC-F006-001: Configure privacy settings

**Feature:** F-006: Privacy Settings
**Priority:** P2
**Type:** Functional

### Preconditions
- User logged in
- Admin has enabled privacy features

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Profile > Privacy | Privacy settings shown |
| 2 | Toggle "Show Online Status" OFF | Toggle changes state |
| 3 | Verify online status hidden | Other users cannot see status |
| 4 | Toggle "Show Read Receipts" OFF | Toggle changes state |
| 5 | Send message to another user | No read receipt sent |

### Test Data
- Secondary test user to verify

### Expected Outcome
- Privacy settings saved
- Settings enforced in real-time
- Other users respect settings

---

### 4.2 Messaging (F-010 to F-023)

---

## TC-F010-001: Send text message in DM

**Feature:** F-010: Direct Messaging
**Priority:** P0
**Type:** Functional

### Preconditions
- User logged in
- Existing conversation with another user

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open existing DM conversation | Conversation screen shown |
| 2 | Tap message input field | Keyboard appears |
| 3 | Type message: "Hello, this is a test" | Text appears in input |
| 4 | Tap Send button | Message sent |
| 5 | Verify message appears in chat | Message shown with "Sent" status |
| 6 | Wait for delivery | Status changes to "Delivered" |

### Test Data
- Message: "Hello, this is a test message"

### Expected Outcome
- Message sent successfully
- Real-time delivery via SignalR
- Message status updates correctly

---

## TC-F010-002: Real-time message reception

**Feature:** F-010: Direct Messaging
**Priority:** P0
**Type:** Functional

### Preconditions
- Two devices/users logged in
- Conversation exists between them

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User A opens conversation | Conversation displayed |
| 2 | User B sends message | Message sent |
| 3 | User A receives message | Message appears in real-time |
| 4 | User A reads message | Read receipt sent to User B |
| 5 | User B sees read status | Message shows "Read" status |

### Test Data
- Two test users: test_user_01, test_user_02

### Expected Outcome
- Messages delivered in real-time
- Read receipts working correctly
- No delay or lost messages

---

## TC-F011-001: Create group chat

**Feature:** F-011: Group Chat (Chatrooms)
**Priority:** P1
**Type:** Functional

### Preconditions
- User logged in
- Has contacts to add

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap New Chat button | New chat options appear |
| 2 | Select "Create Group" | Group creation screen |
| 3 | Enter group name: "Test Group" | Name accepted |
| 4 | Select 2-3 contacts | Contacts selected |
| 5 | Tap Create | Group created |
| 6 | Verify group appears | Group in conversation list |

### Test Data
- Group name: "Test Group Mobile"
- Participants: 2-3 test contacts

### Expected Outcome
- Group created successfully
- User is owner
- Participants added as members

---

## TC-F011-002: MaxGroupSize enforcement

**Feature:** F-011: Group Chat (Chatrooms)
**Priority:** P1
**Type:** Functional

### Preconditions
- MaxGroupSize set in admin settings
- Group exists near limit

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open group settings | Settings displayed |
| 2 | Tap Add Members | Member selection screen |
| 3 | Try to add members exceeding limit | Error toast shown |
| 4 | Verify members not added | Member list unchanged |

### Test Data
- Group at MaxGroupSize - 1 members
- Try to add 2+ members

### Expected Outcome
- Backend enforces limit
- User sees error message
- No members added beyond limit

---

## TC-F012-001: Send image message

**Feature:** F-012: Rich Text Messaging
**Priority:** P1
**Type:** Functional

### Preconditions
- User in active conversation
- Gallery access granted

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation | Chat screen displayed |
| 2 | Tap attachment button | Attachment options shown |
| 3 | Select "Image" | Gallery picker opens |
| 4 | Select image | Image preview shown |
| 5 | Add caption (optional) | Caption input available |
| 6 | Tap Send | Upload progress shown |
| 7 | Wait for upload | Image sent successfully |

### Test Data
- Test image < 10MB

### Expected Outcome
- Image uploaded and sent
- Thumbnail displayed in chat
- Full image viewable on tap

---

## TC-F012-002: File size limit enforcement

**Feature:** F-012: Rich Text Messaging
**Priority:** P2
**Type:** Functional

### Preconditions
- MaxFileSizeMB configured (e.g., 25MB)

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap attachment button | Attachment options shown |
| 2 | Select file larger than limit | File picker opens |
| 3 | Select oversized file | Error toast: "File too large" |
| 4 | Verify file not uploaded | No upload initiated |

### Test Data
- File > 25MB (or configured limit)

### Expected Outcome
- Upload blocked before starting
- Clear error message shown
- No data uploaded

---

## TC-F013-001: Add reaction to message

**Feature:** F-013: Message Reactions
**Priority:** P2
**Type:** Functional

### Preconditions
- User in conversation with messages

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press on message | Message options appear |
| 2 | Tap reaction button | Emoji picker shown |
| 3 | Select thumbsup emoji | Reaction added |
| 4 | Verify reaction appears | Reaction shown on message |
| 5 | Long press same emoji | Reaction removed |

### Test Data
- Existing message in conversation

### Expected Outcome
- Reaction added in real-time
- Other users see reaction
- Toggle behavior works

---

## TC-F014-001: Reply to message

**Feature:** F-014: Message Reply
**Priority:** P1
**Type:** Functional

### Preconditions
- User in conversation with messages

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Swipe right on message | Reply indicator appears |
| 2 | Verify reply preview shown | Original message previewed |
| 3 | Type reply message | Input field active |
| 4 | Tap Send | Reply sent |
| 5 | Verify reply context | Reply shows quoted message |
| 6 | Tap quoted message | Scrolls to original |

### Test Data
- Original message to reply to

### Expected Outcome
- Reply sent with context
- Visual connection to original
- Navigation to original works

---

## TC-F015-001: Edit message within time limit

**Feature:** F-015: Message Editing
**Priority:** P2
**Type:** Functional

### Preconditions
- User has sent message recently
- Edit time limit not exceeded

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press own message | Message options shown |
| 2 | Tap "Edit" | Edit modal opens |
| 3 | Modify message content | Text editable |
| 4 | Tap Save | Message updated |
| 5 | Verify "(edited)" label | Edit indicator shown |

### Test Data
- Recently sent message

### Expected Outcome
- Message edited successfully
- Edit indicator visible
- Other users see updated content

---

## TC-F015-002: Edit blocked after time limit

**Feature:** F-015: Message Editing
**Priority:** P2
**Type:** Functional

### Preconditions
- Message sent longer ago than edit limit

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press old message | Message options shown |
| 2 | Check for Edit option | Edit option not visible/disabled |

### Test Data
- Message older than editTimeLimitMinutes setting

### Expected Outcome
- Edit option unavailable
- User cannot modify old messages

---

## TC-F016-001: Delete message for me

**Feature:** F-016: Message Deletion
**Priority:** P1
**Type:** Functional

### Preconditions
- User in conversation with messages

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press any message | Message options shown |
| 2 | Tap "Delete" | Delete options appear |
| 3 | Select "Delete for me" | Confirmation if enabled |
| 4 | Confirm deletion | Message removed from view |
| 5 | Verify other user still sees it | Message visible to recipient |

### Test Data
- Existing message in conversation

### Expected Outcome
- Message hidden for current user only
- Other participants unaffected

---

## TC-F016-002: Delete message for everyone

**Feature:** F-016: Message Deletion
**Priority:** P1
**Type:** Functional

### Preconditions
- User is message sender
- Within deletion time limit

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press own message | Message options shown |
| 2 | Tap "Delete" | Delete options appear |
| 3 | Select "Delete for everyone" | Confirmation shown |
| 4 | Confirm deletion | Message replaced with placeholder |
| 5 | Verify other user sees deletion | "This message was deleted" shown |

### Test Data
- Recently sent own message

### Expected Outcome
- Message deleted for all participants
- Placeholder shown instead

---

## TC-F017-001: Forward message to conversation

**Feature:** F-017: Message Forwarding
**Priority:** P2
**Type:** Functional

### Preconditions
- User has multiple conversations

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press message | Message options shown |
| 2 | Tap "Forward" | Forward modal opens |
| 3 | Search/select recipient | Recipient selected |
| 4 | Tap Forward | Message forwarded |
| 5 | Open forwarded conversation | Message appears with "Forwarded" label |

### Test Data
- Message to forward
- Target conversation

### Expected Outcome
- Message forwarded successfully
- Forward indicator shown
- Original content preserved

---

## TC-F018-001: Record and send voice message

**Feature:** F-018: Voice Messages
**Priority:** P2
**Type:** Functional

### Preconditions
- Microphone permission granted

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap and hold microphone button | Recording starts |
| 2 | Speak for 5 seconds | Waveform visualization shown |
| 3 | Release button | Recording stops |
| 4 | Preview recording | Playback available |
| 5 | Tap Send | Voice message sent |
| 6 | Verify message appears | Audio player shown in chat |

### Test Data
- 5-10 second voice recording

### Expected Outcome
- Voice message recorded and sent
- Recipient can play back
- Duration displayed

---

## TC-F020-001: Enable disappearing messages

**Feature:** F-020: Disappearing Messages
**Priority:** P2
**Type:** Functional

### Preconditions
- User is admin/owner of conversation
- Feature enabled in admin settings

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation settings | Settings displayed |
| 2 | Tap "Disappearing Messages" | Duration options shown |
| 3 | Select "24 hours" | Duration set |
| 4 | Save settings | System message sent |
| 5 | Send new message | Message has expiration |
| 6 | Wait 24 hours | Message auto-deleted |

### Test Data
- Group conversation user owns

### Expected Outcome
- Disappearing messages enabled
- New messages have expiration
- Auto-deletion after duration

---

## TC-F021-001: Send view-once image

**Feature:** F-021: View-Once Messages
**Priority:** P2
**Type:** Functional

### Preconditions
- EnableViewOnceMessage setting is true

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select image to send | Image preview shown |
| 2 | Toggle "View Once" option | Eye icon indicates view-once |
| 3 | Send image | Image sent with view-once flag |
| 4 | Recipient sees blurred preview | "View once" indicator shown |
| 5 | Recipient taps to view | Timer starts |
| 6 | Timer expires | Image no longer viewable |

### Test Data
- Test image
- viewOnceTimerSeconds setting

### Expected Outcome
- Image can only be viewed once
- Timer controls viewing duration
- Sender sees "Viewed" status

---

## TC-F022-001: Search messages in conversation

**Feature:** F-022: Search in Conversation
**Priority:** P2
**Type:** Functional

### Preconditions
- Conversation with multiple messages

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation | Chat displayed |
| 2 | Tap search icon | Search bar appears |
| 3 | Enter search query | Results highlight |
| 4 | Navigate through results | Up/down arrows work |
| 5 | Tap result | Scrolls to message |

### Test Data
- Search term present in messages

### Expected Outcome
- Messages found and highlighted
- Navigation between results works
- Scroll to selected result

---

### 4.3 Voice and Video Calling (F-030 to F-034)

---

## TC-F030-001: Initiate voice call

**Feature:** F-030: 1:1 Voice Calls
**Priority:** P0
**Type:** Functional

### Preconditions
- EnableVoiceCalls setting is true
- User has contact to call
- Microphone permission granted

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation with contact | Chat displayed |
| 2 | Tap phone icon | Call initiating |
| 3 | Wait for callee | Ringing state shown |
| 4 | Callee accepts | Call connects |
| 5 | Verify audio works | Both parties hear each other |
| 6 | Tap End Call | Call terminates |

### Test Data
- Two test users
- Network connectivity

### Expected Outcome
- Voice call established successfully
- Audio quality acceptable
- Call duration tracked

---

## TC-F030-002: Receive incoming voice call

**Feature:** F-030: 1:1 Voice Calls
**Priority:** P0
**Type:** Functional

### Preconditions
- App in foreground
- Another user initiating call

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User A calls User B | User B receives notification |
| 2 | User B sees caller info | Caller name/avatar shown |
| 3 | User B taps Accept | Call connects |
| 4 | Verify audio works | Both parties hear each other |

### Test Data
- Two test users

### Expected Outcome
- Incoming call notification works
- Accept/reject buttons functional
- Call connects properly

---

## TC-F030-003: Call mute functionality

**Feature:** F-030: 1:1 Voice Calls
**Priority:** P1
**Type:** Functional

### Preconditions
- Active voice call

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During call, tap mute button | Microphone muted |
| 2 | Speak while muted | Other party cannot hear |
| 3 | Tap unmute | Microphone unmuted |
| 4 | Speak while unmuted | Other party hears audio |

### Test Data
- Active call between users

### Expected Outcome
- Mute toggles correctly
- Visual indicator shows mute state
- Other party affected appropriately

---

## TC-F031-001: Initiate video call

**Feature:** F-031: 1:1 Video Calls
**Priority:** P1
**Type:** Functional

### Preconditions
- EnableVideoCalls setting is true
- Camera and microphone permissions

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation | Chat displayed |
| 2 | Tap video call icon | Call initiating |
| 3 | Camera activates | Local preview shown |
| 4 | Callee accepts | Video call connects |
| 5 | Verify video and audio | Both streams working |
| 6 | Toggle camera off | Video stops, placeholder shown |

### Test Data
- Two test users with cameras

### Expected Outcome
- Video call established
- Both audio and video work
- Camera toggle functional

---

## TC-F032-001: Start group video call

**Feature:** F-032: Group Video Calls (LiveKit)
**Priority:** P1
**Type:** Functional

### Preconditions
- Group conversation exists
- LiveKit service available

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open group conversation | Chat displayed |
| 2 | Tap video call icon | Group call initiating |
| 3 | LiveKit room created | Token obtained |
| 4 | Participants notified | Notification sent |
| 5 | Others join call | Participant videos appear |
| 6 | Verify grid layout | All participants visible |

### Test Data
- Group with 3+ members
- Multiple devices

### Expected Outcome
- Group call established
- Multiple participants connected
- Grid/speaker view works

---

## TC-F033-001: Screen sharing in call

**Feature:** F-033: Screen Sharing
**Priority:** P2
**Type:** Functional

### Preconditions
- EnableScreenShare setting is true
- Active video call

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During call, tap share screen | Permission dialog shown |
| 2 | Grant permission | Screen sharing starts |
| 3 | Other participants see screen | Shared content visible |
| 4 | Tap stop sharing | Screen share ends |
| 5 | Camera view resumes | Normal video restored |

### Test Data
- Active group or 1:1 video call

### Expected Outcome
- Screen shared successfully
- All participants can see screen
- Stop sharing works correctly

---

## TC-F034-001: Call recording notification

**Feature:** F-034: Call Recording
**Priority:** P2
**Type:** Functional

### Preconditions
- EnableRecording setting is true
- Active call

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During call, tap record button | Recording starts |
| 2 | Recording indicator shown | All participants see indicator |
| 3 | Stop recording | Recording saved |
| 4 | Verify recording file | Accessible in call history |

### Test Data
- Active call with recording permission

### Expected Outcome
- Recording captured
- All participants notified
- Recording saved properly

---

### 4.4 Contacts and Connections (F-040 to F-041)

---

## TC-F040-001: Send contact request

**Feature:** F-040: Contact Management
**Priority:** P1
**Type:** Functional

### Preconditions
- User logged in
- Target user exists and not already contact

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Contacts | Contacts screen shown |
| 2 | Tap "Add Contact" | Search screen opens |
| 3 | Search for user | Results displayed |
| 4 | Tap "Add" on user | Request sent |
| 5 | Verify pending status | User in Pending tab |

### Test Data
- Username to search: "test_user_02"

### Expected Outcome
- Contact request sent
- Request appears in Pending
- Target user notified

---

## TC-F040-002: Accept contact request

**Feature:** F-040: Contact Management
**Priority:** P1
**Type:** Functional

### Preconditions
- Pending contact request exists

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Contacts | Contacts displayed |
| 2 | Open Pending tab | Pending requests shown |
| 3 | Tap Accept on request | Request accepted |
| 4 | Verify contact in All tab | Contact now in list |
| 5 | Verify can message | DM available |

### Test Data
- Pending request from test user

### Expected Outcome
- Request accepted
- Contact relationship established
- Messaging enabled

---

## TC-F040-003: Mark contact as favorite

**Feature:** F-040: Contact Management
**Priority:** P3
**Type:** Functional

### Preconditions
- User has contacts

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to All contacts | Contacts listed |
| 2 | Long press contact | Options appear |
| 3 | Tap "Add to Favorites" | Star icon appears |
| 4 | Go to Starred tab | Contact appears |
| 5 | Verify sorting | Favorites at top of All tab |

### Test Data
- Existing contact

### Expected Outcome
- Contact marked as favorite
- Appears in Starred tab
- Sorted to top

---

## TC-F041-001: Block user

**Feature:** F-041: User Blocking
**Priority:** P1
**Type:** Functional

### Preconditions
- User has contact to block

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open contact profile | Profile displayed |
| 2 | Tap "Block" button | Confirmation dialog |
| 3 | Confirm block | User blocked |
| 4 | Verify in Blocked tab | User appears |
| 5 | Blocked user tries to message | Error: "Conversation blocked" |
| 6 | Blocked user tries to call | Error: "Contact blocked" |

### Test Data
- Two test users

### Expected Outcome
- User blocked successfully
- Messaging blocked
- Calling blocked

---

## TC-F041-002: Unblock user

**Feature:** F-041: User Blocking
**Priority:** P2
**Type:** Functional

### Preconditions
- User has blocked contact

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Blocked tab | Blocked users shown |
| 2 | Tap "Unblock" on user | Confirmation dialog |
| 3 | Confirm unblock | User unblocked |
| 4 | Verify communication works | Messaging enabled |

### Test Data
- Previously blocked user

### Expected Outcome
- Block removed
- Communication restored
- User back in contacts

---

### 4.5 Notifications and Presence (F-050 to F-053)

---

## TC-F050-001: View online status

**Feature:** F-050: Real-Time Presence
**Priority:** P2
**Type:** Functional

### Preconditions
- ShowOnlineStatus enabled

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View contacts list | Contacts displayed |
| 2 | Identify online contact | Green dot indicator |
| 3 | View offline contact | No indicator/gray |
| 4 | Check last seen | "Last seen X ago" shown |

### Test Data
- Mix of online/offline contacts

### Expected Outcome
- Online status correctly shown
- Last seen accurate
- Respects privacy settings

---

## TC-F051-001: Typing indicator display

**Feature:** F-051: Typing Indicators
**Priority:** P2
**Type:** Functional

### Preconditions
- EnableMessagingIndicators enabled
- Conversation with another user

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation | Chat displayed |
| 2 | Other user starts typing | "User is typing..." appears |
| 3 | Other user stops typing | Indicator disappears |
| 4 | Check conversation list | Indicator also shown there |

### Test Data
- Two active users

### Expected Outcome
- Typing indicator appears
- Updates in real-time
- Shows in list and chat

---

## TC-F052-001: Receive push notification

**Feature:** F-052: Push Notifications
**Priority:** P1
**Type:** Functional

### Preconditions
- Push notifications enabled
- App in background

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Put app in background | App not visible |
| 2 | Other user sends message | Push notification appears |
| 3 | Notification shows content | Sender and preview visible |
| 4 | Tap notification | App opens to conversation |

### Test Data
- Message from another user

### Expected Outcome
- Push notification received
- Content displayed correctly
- Deep link works

---

## TC-F053-001: View notification center

**Feature:** F-053: Notification Center
**Priority:** P2
**Type:** Functional

### Preconditions
- User has notifications

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap notification bell icon | Notification dropdown/page |
| 2 | View unread count | Badge shows correct number |
| 3 | Tap notification | Navigate to source |
| 4 | Tap "Mark all read" | All notifications cleared |

### Test Data
- Multiple notifications

### Expected Outcome
- Notifications listed
- Navigation works
- Mark read functions

---

### 4.6 Organization and Management (F-060 to F-061)

---

## TC-F060-001: Pin conversation

**Feature:** F-060: Conversation Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User has multiple conversations

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press conversation | Context menu appears |
| 2 | Tap "Pin" | Conversation pinned |
| 3 | Verify pin icon | Pin indicator shown |
| 4 | Verify position | Pinned at top of list |
| 5 | Long press and Unpin | Pin removed |

### Test Data
- Existing conversation

### Expected Outcome
- Pin/unpin works
- Pinned conversations at top
- Visual indicator shown

---

## TC-F060-002: Mute conversation

**Feature:** F-060: Conversation Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User has conversation

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press conversation | Context menu |
| 2 | Tap "Mute" | Mute options shown |
| 3 | Select duration | Conversation muted |
| 4 | Verify mute icon | Muted indicator shown |
| 5 | Receive message | No notification |

### Test Data
- Active conversation

### Expected Outcome
- Conversation muted
- No notifications received
- Visual indicator shown

---

## TC-F060-003: Archive conversation

**Feature:** F-060: Conversation Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User has conversation to archive

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press conversation | Context menu |
| 2 | Tap "Archive" | Conversation archived |
| 3 | Verify removed from main list | Not in primary view |
| 4 | Go to Archived section | Conversation appears |
| 5 | Unarchive conversation | Returns to main list |

### Test Data
- Existing conversation

### Expected Outcome
- Archive works
- Moved to archive section
- Unarchive restores

---

## TC-F061-001: Global search

**Feature:** F-061: Global Search
**Priority:** P2
**Type:** Functional

### Preconditions
- User has conversations and contacts

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap search icon/bar | Search interface opens |
| 2 | Enter search query | Results appear |
| 3 | View categorized results | Users, Conversations, Messages |
| 4 | Tap on result | Navigate to item |

### Test Data
- Search term matching content

### Expected Outcome
- Search finds relevant items
- Results categorized
- Navigation works

---

### 4.7 Security and Compliance (F-080 to F-081)

---

## TC-F080-001: Report message

**Feature:** F-080: Content Reporting
**Priority:** P2
**Type:** Functional

### Preconditions
- Message to report exists

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Long press message | Options appear |
| 2 | Tap "Report" | Report form opens |
| 3 | Select reason | Reason selected |
| 4 | Add details (optional) | Details entered |
| 5 | Submit report | Confirmation shown |

### Test Data
- Message to report

### Expected Outcome
- Report submitted
- Confirmation received
- Report visible to moderators

---

## TC-F081-001: View active sessions

**Feature:** F-081: Session Management
**Priority:** P2
**Type:** Functional

### Preconditions
- User logged in on multiple devices

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Profile > Sessions | Sessions list shown |
| 2 | View session details | Device, browser, time shown |
| 3 | Identify current session | Current marked |
| 4 | Tap "Revoke" on other session | Session terminated |
| 5 | Verify other device logged out | App shows login screen |

### Test Data
- User logged in on 2+ devices

### Expected Outcome
- All sessions listed
- Revoke terminates session
- Current session protected

---

### 4.8 Network and Edge Cases

---

## TC-NET-001: Offline mode handling

**Feature:** Network Resilience
**Priority:** P1
**Type:** Network

### Preconditions
- App with data cached

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable airplane mode | Network disconnected |
| 2 | Open app | Cached conversations shown |
| 3 | Try to send message | Message queued |
| 4 | Disable airplane mode | Message sent automatically |

### Test Data
- Cached conversation data

### Expected Outcome
- App usable offline
- Messages queue
- Auto-sync on reconnect

---

## TC-NET-002: Poor network handling

**Feature:** Network Resilience
**Priority:** P1
**Type:** Network

### Preconditions
- Network throttling enabled (slow 3G)

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send message on slow network | Loading indicator shown |
| 2 | Upload image | Progress indicator shown |
| 3 | Verify timeouts handled | Retry option available |

### Test Data
- Network throttled to slow speed

### Expected Outcome
- Graceful degradation
- Progress indicators
- Retry mechanisms work

---

## TC-NET-003: SignalR reconnection

**Feature:** Network Resilience
**Priority:** P1
**Type:** Network

### Preconditions
- Connected SignalR session

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Briefly toggle airplane mode | Connection lost |
| 2 | Restore network | Auto-reconnect initiated |
| 3 | Verify reconnect < 5s | Connection restored |
| 4 | Send/receive message | Real-time works |

### Test Data
- Active SignalR connection

### Expected Outcome
- Auto-reconnection works
- Messages sync correctly
- No data loss

---

### 4.9 Accessibility Tests

---

## TC-A11Y-001: Screen reader navigation

**Feature:** Accessibility
**Priority:** P2
**Type:** Accessibility

### Preconditions
- VoiceOver (iOS) or TalkBack (Android) enabled

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to login screen | All elements announced |
| 2 | Enter credentials | Input fields accessible |
| 3 | Navigate conversations | List items announced |
| 4 | Read message | Content read aloud |
| 5 | Navigate call controls | Buttons announced |

### Test Data
- Standard app flow

### Expected Outcome
- All UI elements accessible
- Proper ARIA labels
- Logical navigation order

---

## TC-A11Y-002: Color contrast

**Feature:** Accessibility
**Priority:** P3
**Type:** Accessibility

### Preconditions
- Accessibility inspector tool

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check text contrast ratios | >= 4.5:1 for normal text |
| 2 | Check button contrast | >= 3:1 for large text |
| 3 | Check error messages | Clearly distinguishable |

### Test Data
- All app screens

### Expected Outcome
- WCAG 2.1 AA compliance
- Readable in all lighting

---

### 4.10 Performance Tests

---

## TC-PERF-001: App launch time

**Feature:** Performance
**Priority:** P1
**Type:** Performance

### Preconditions
- Clean app state or cached state

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cold start app | Measure time to interactive |
| 2 | Target: < 3 seconds | App usable within limit |
| 3 | Warm start app | Measure time |
| 4 | Target: < 1 second | Faster than cold start |

### Test Data
- Performance profiler

### Expected Outcome
- Cold start < 3s
- Warm start < 1s
- No ANR/freeze

---

## TC-PERF-002: Message list scroll performance

**Feature:** Performance
**Priority:** P1
**Type:** Performance

### Preconditions
- Conversation with 500+ messages

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open conversation | Messages load |
| 2 | Scroll rapidly through messages | 60 FPS maintained |
| 3 | Scroll to oldest messages | Pagination works |
| 4 | Memory usage | No memory leaks |

### Test Data
- Large conversation

### Expected Outcome
- Smooth 60 FPS scrolling
- Efficient memory usage
- No UI jank

---

## TC-PERF-003: Image upload performance

**Feature:** Performance
**Priority:** P2
**Type:** Performance

### Preconditions
- Network connected

### Test Steps
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload 5MB image | Progress shown |
| 2 | Target: < 10 seconds | Upload completes |
| 3 | Verify compression applied | Reasonable file size |

### Test Data
- 5MB test image

### Expected Outcome
- Upload within time limit
- Progress accurate
- Image quality acceptable

---

## 5. Test Data Requirements

### 5.1 User Accounts

| Account | Purpose | State |
|---------|---------|-------|
| test_user_01 | Primary testing | Clean, few contacts |
| test_user_02 | Secondary testing | Clean, few contacts |
| test_user_2fa | 2FA testing | 2FA enabled |
| test_user_blocked | Block testing | To be blocked by others |
| test_group_owner | Group admin testing | Owns test groups |
| test_heavy_user | Performance testing | Many conversations/messages |

### 5.2 Test Conversations

| Conversation | Type | Purpose |
|--------------|------|---------|
| Test DM 1-2 | DM | Direct message testing |
| Test Group Small | Chatroom | Group with 5 members |
| Test Group Large | Chatroom | Group with 50+ members |
| Test Empty Chat | DM | Empty state testing |
| Test Heavy Chat | DM | 1000+ messages for performance |

### 5.3 Test Media Files

| File | Type | Size | Purpose |
|------|------|------|---------|
| test_image_small.jpg | Image | 100KB | Normal upload |
| test_image_large.jpg | Image | 5MB | Size limit testing |
| test_image_huge.jpg | Image | 30MB | Rejection testing |
| test_video_short.mp4 | Video | 10MB | Video message |
| test_video_long.mp4 | Video | 100MB | Limit testing |
| test_audio.mp3 | Audio | 2MB | Audio testing |
| test_document.pdf | Document | 1MB | File attachment |

### 5.4 System Settings for Testing

| Setting | Test Value | Purpose |
|---------|------------|---------|
| MaxMessageLength | 5000 | Length limit |
| MaxFileSizeMB | 25 | File limit |
| EditTimeLimitMinutes | 15 | Edit window |
| MaxGroupSize | 256 | Group limit |
| EnableDisappearingMessages | true | Feature test |
| EnableViewOnceMessage | true | Feature test |

---

## 6. Test Execution Schedule

### 6.1 Daily Testing

| Activity | Time | Owner |
|----------|------|-------|
| Automated Unit Tests | CI trigger | CI/CD |
| Integration Tests | CI trigger | CI/CD |
| Smoke Tests | After deploy | QA Lead |
| Bug Verification | Morning | QA Team |

### 6.2 Weekly Testing

| Activity | Day | Owner |
|----------|-----|-------|
| Full Regression | Friday | QA Team |
| Performance Tests | Wednesday | QA Lead |
| Security Scan | Tuesday | Security |
| Accessibility Audit | Thursday | QA Team |

### 6.3 Release Testing

| Phase | Duration | Activities |
|-------|----------|------------|
| Feature Testing | 2 days | New feature verification |
| Regression | 2 days | Full test suite |
| UAT | 2 days | User acceptance |
| Performance | 1 day | Load and stress testing |
| Security | 1 day | Penetration testing |
| Final Verification | 1 day | Smoke tests, sign-off |

---

## 7. Summary and Metrics

### 7.1 Test Case Summary

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Authentication (F-001 to F-006) | 3 | 5 | 6 | 0 | 14 |
| Messaging (F-010 to F-023) | 2 | 6 | 14 | 0 | 22 |
| Calling (F-030 to F-034) | 2 | 5 | 4 | 0 | 11 |
| Contacts (F-040 to F-041) | 0 | 4 | 2 | 1 | 7 |
| Notifications (F-050 to F-053) | 0 | 2 | 4 | 0 | 6 |
| Organization (F-060 to F-061) | 0 | 0 | 5 | 0 | 5 |
| Security (F-080 to F-081) | 0 | 0 | 2 | 0 | 2 |
| Network/Edge Cases | 0 | 3 | 0 | 0 | 3 |
| Accessibility | 0 | 0 | 1 | 1 | 2 |
| Performance | 0 | 2 | 1 | 0 | 3 |
| **Total** | **7** | **27** | **39** | **2** | **75** |

### 7.2 Coverage by Feature Category

| BRD Section | Features | Test Cases | Coverage |
|-------------|----------|------------|----------|
| 3.1 Auth & User Management | F-001 to F-006 | 14 | 100% |
| 3.2 Messaging Features | F-010 to F-023 | 22 | 100% |
| 3.3 Voice and Video Calling | F-030 to F-034 | 11 | 100% |
| 3.4 Contacts and Connections | F-040 to F-041 | 7 | 100% |
| 3.5 Notifications and Presence | F-050 to F-053 | 6 | 100% |
| 3.6 Organization and Management | F-060 to F-061 | 5 | 100% |
| 3.8 Security and Compliance | F-080 to F-081 | 2 | 100% |

### 7.3 Estimated Testing Effort

| Test Type | Test Cases | Hours/Case | Total Hours |
|-----------|------------|------------|-------------|
| Unit Tests | ~150 | 0.5 | 75 hours |
| Integration Tests | ~80 | 1 | 80 hours |
| E2E Tests | ~40 | 2 | 80 hours |
| Manual Tests | 75 | 0.5 | 37.5 hours |
| **Total** | **~345** | - | **272.5 hours** |

### 7.4 Quality Metrics Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Defect Density | < 5 bugs/KLOC | Static analysis |
| Test Coverage | >= 80% | Istanbul |
| P0 Bug Resolution | < 24 hours | Bug tracking |
| P1 Bug Resolution | < 72 hours | Bug tracking |
| Test Execution Rate | > 95% | Test runs |
| Test Pass Rate | > 98% | Test results |

---

## Appendix A: Test Environment Setup

### A.1 iOS Setup

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods

# Setup iOS Simulator
xcrun simctl create "iPhone 15 Pro" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro com.apple.CoreSimulator.SimRuntime.iOS-17-2

# Run iOS tests
npm run ios:test
```

### A.2 Android Setup

```bash
# Set ANDROID_HOME
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Create emulator
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -n "Pixel_8_API_34" -k "system-images;android-34;google_apis;arm64-v8a"

# Run Android tests
npm run android:test
```

### A.3 Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

---

## Appendix B: Bug Severity Definitions

| Severity | Description | Example |
|----------|-------------|---------|
| Critical (P0) | App crash, data loss, security breach | Login crashes app |
| High (P1) | Major feature broken, no workaround | Cannot send messages |
| Medium (P2) | Feature broken, workaround exists | Edit button intermittent |
| Low (P3) | Minor issue, cosmetic | Icon misaligned |
| Trivial | Typo, minor visual | "Mesages" typo |

---

*Document maintained by QA Team. Last review: March 2, 2026*
