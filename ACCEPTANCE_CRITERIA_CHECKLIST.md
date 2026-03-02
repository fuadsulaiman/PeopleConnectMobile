# PeopleConnect Mobile - Acceptance Criteria Checklist

**Version:** 1.0
**Last Updated:** March 2, 2026
**Based on:** Business Requirements Document (BRD)

---

## How to Use This Document

Each feature section contains:
1. **Acceptance Criteria** extracted from BRD Gherkin scenarios
2. **Test Status** checkboxes for tracking test coverage
3. **Notes** for any implementation-specific details

Legend:
- [ ] Not tested / Not started
- [x] Passed
- [-] Blocked / N/A
- [!] Failed / Needs fix

---

## Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Messaging Features](#2-messaging-features)
3. [Voice and Video Calling](#3-voice-and-video-calling)
4. [Contacts and Connections](#4-contacts-and-connections)
5. [Notifications and Presence](#5-notifications-and-presence)
6. [Organization and Management](#6-organization-and-management)
7. [Security and Compliance](#7-security-and-compliance)
8. [Test Summary](#8-test-summary)

---

## 1. Authentication & User Management

### F-001: User Registration

#### Acceptance Criteria

**Scenario: Successful registration**
- [ ] Given I am on the registration page
- [ ] And registration is enabled on the platform
- [ ] When I enter a valid name (2+ characters)
- [ ] And I enter a valid username (3-30 characters, alphanumeric/underscore)
- [ ] And I enter a valid password (8+ chars, uppercase, lowercase, number)
- [ ] And I confirm my password correctly
- [ ] Then I should be redirected to login page with success message
- [ ] And my account should be created in the system

**Scenario: Registration with invitation code**
- [ ] Given invite-only mode is enabled
- [ ] And I have a valid invitation code
- [ ] When I complete the registration form with the invitation code
- [ ] Then my account should be created
- [ ] And the invitation should be marked as used

**Scenario: Registration disabled**
- [ ] Given registration is disabled by administrator
- [ ] When I navigate to the registration page
- [ ] Then I should see a message indicating registration is closed

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-002: User Login

#### Acceptance Criteria

**Scenario: Successful login**
- [ ] Given I am a registered user
- [ ] When I enter correct username and password
- [ ] Then I should be redirected to the chat page
- [ ] And my session should be established

**Scenario: Login with 2FA enabled**
- [ ] Given I have 2FA enabled on my account
- [ ] When I enter correct credentials
- [ ] Then I should see the 2FA verification screen
- [ ] When I enter a valid 6-digit code or backup code
- [ ] Then I should be logged in successfully

**Scenario: Account with active warnings**
- [ ] Given I have active warnings on my account
- [ ] When I log in successfully
- [ ] Then I should see a modal displaying my warnings
- [ ] And I must acknowledge the warnings before proceeding

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-003: Password Recovery

#### Acceptance Criteria

**Scenario: Request password reset**
- [ ] Given I have an account with a registered email
- [ ] When I request a password reset on the forgot-password page
- [ ] Then a reset link should be sent to my email
- [ ] And I should see confirmation that email was sent

**Scenario: Complete password reset**
- [ ] Given I have a valid password reset link
- [ ] When I click the link and enter a new valid password
- [ ] And I confirm the new password
- [ ] Then my password should be updated
- [ ] And I should be redirected to login with success message

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-004: Two-Factor Authentication (2FA)

#### Acceptance Criteria

**Scenario: Enable 2FA**
- [ ] Given I am logged in and on the profile security tab
- [ ] When I click "Enable 2FA"
- [ ] Then I should see a QR code and secret key
- [ ] When I scan the QR code with an authenticator app
- [ ] And I enter the generated code
- [ ] Then 2FA should be enabled on my account
- [ ] And I should receive backup codes

**Scenario: Login with 2FA**
- [ ] Given 2FA is enabled on my account
- [ ] When I enter my username and password
- [ ] And I enter the code from my authenticator app
- [ ] Then I should be logged in successfully

**Scenario: Use backup code**
- [ ] Given I have lost access to my authenticator app
- [ ] When I enter a valid backup code
- [ ] Then I should be logged in
- [ ] And that backup code should be invalidated

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-005: User Profile Management

#### Acceptance Criteria

**Scenario: Update profile information**
- [ ] Given I am on the profile page
- [ ] When I update my name, username, or bio
- [ ] And I click save
- [ ] Then my profile should be updated
- [ ] And other users should see my updated information

**Scenario: Upload and crop avatar**
- [ ] Given I am on the profile page
- [ ] When I click on my avatar to upload a new image
- [ ] And I select an image file
- [ ] Then I should see a cropping interface
- [ ] When I adjust the crop and save
- [ ] Then my avatar should be updated across the platform

**Scenario: Change password**
- [ ] Given I am on the security tab of my profile
- [ ] When I enter my current password
- [ ] And I enter a new valid password twice
- [ ] Then my password should be updated
- [ ] And I should see a success confirmation

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-006: Privacy Settings

#### Acceptance Criteria

**Scenario: Hide online status**
- [ ] Given I am on the privacy settings tab
- [ ] And the admin has enabled online status globally
- [ ] When I disable "Show online status"
- [ ] Then other users should not see me as online
- [ ] And I should not appear in online contact lists

**Scenario: Disable read receipts**
- [ ] Given I have disabled read receipts
- [ ] When another user sends me a message and I read it
- [ ] Then they should not see "Read" status on their message

**Scenario: Admin override**
- [ ] Given the admin has disabled a privacy feature globally
- [ ] Then I should not be able to enable it for myself
- [ ] And the setting should be locked

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 2. Messaging Features

### F-010: Direct Messaging (1:1 Chat)

#### Acceptance Criteria

**Scenario: Start new direct message**
- [ ] Given I have a contact in my contact list
- [ ] When I click on the contact and select "Message"
- [ ] Then a new conversation should open or existing one should be selected
- [ ] And I should be able to send messages

**Scenario: Real-time message delivery**
- [ ] Given I am in a conversation with another user
- [ ] When I send a message
- [ ] Then the message should appear in my chat instantly
- [ ] And the recipient should receive it in real-time via WebSocket
- [ ] And message status should show "Sent" then "Delivered"

**Scenario: Read receipts**
- [ ] Given I have sent a message to another user
- [ ] When they view the conversation
- [ ] Then my message status should change to "Read" (if enabled)

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-011: Group Chat (Chatrooms)

#### Acceptance Criteria

**Scenario: Create group chat**
- [ ] Given I am on the chat page
- [ ] When I click "New Conversation" and select "Create Group"
- [ ] And I enter a group name and select participants
- [ ] Then a new group should be created
- [ ] And I should be the owner with full permissions

**Scenario: Manage member roles**
- [ ] Given I am the owner or admin of a group
- [ ] When I open group settings and go to members tab
- [ ] Then I should be able to change roles (Admin/Member)
- [ ] And I should be able to remove members

**Scenario: Leave group**
- [ ] Given I am a member of a group
- [ ] When I open group settings and click "Leave Group"
- [ ] Then I should be removed from the group
- [ ] And the conversation should be removed from my list

**Scenario: MaxGroupSize enforcement**
- [ ] Given the admin has set MaxGroupSize to 50
- [ ] When I try to add members that would exceed 50 participants
- [ ] Then I should see an error message
- [ ] And the addition should be blocked

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-012: Rich Text Messaging

#### Acceptance Criteria

**Scenario: Send image message**
- [ ] Given I am in a conversation
- [ ] When I click the attachment button and select an image
- [ ] Then the image should be uploaded
- [ ] And a preview should appear in the chat
- [ ] And the recipient should see the image

**Scenario: Send file with size limit**
- [ ] Given the admin has set max file size to 25MB
- [ ] When I try to upload a file larger than 25MB
- [ ] Then I should see an error message
- [ ] And the upload should be blocked

**Scenario: Share location**
- [ ] Given I am in a conversation
- [ ] When I click the attachment button and select "Location"
- [ ] And I allow location access
- [ ] Then my location should be sent as a map preview
- [ ] And the recipient can click to open in maps

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-013: Message Reactions

#### Acceptance Criteria

**Scenario: Add reaction**
- [ ] Given I am viewing a message
- [ ] When I click the reaction button and select an emoji
- [ ] Then the reaction should appear on the message
- [ ] And other users should see my reaction

**Scenario: View reactors**
- [ ] Given a message has reactions
- [ ] When I hover/click on the reaction count
- [ ] Then I should see the list of users who reacted

**Scenario: Remove reaction**
- [ ] Given I have reacted to a message
- [ ] When I click on my reaction again
- [ ] Then my reaction should be removed

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-014: Message Reply

#### Acceptance Criteria

**Scenario: Reply to message**
- [ ] Given I am in a conversation
- [ ] When I swipe/right-click a message and select "Reply"
- [ ] And I type my response and send
- [ ] Then my message should show the replied message context
- [ ] And the original sender should be notified

**Scenario: Navigate to original**
- [ ] Given I see a message with a reply preview
- [ ] When I click on the reply preview
- [ ] Then I should scroll to the original message

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-015: Message Editing

#### Acceptance Criteria

**Scenario: Edit message within time limit**
- [ ] Given I sent a message less than X minutes ago (admin configured)
- [ ] When I click Edit on my message
- [ ] And I modify the content and save
- [ ] Then the message should be updated
- [ ] And "(edited)" label should appear

**Scenario: Edit after time limit**
- [ ] Given I sent a message more than X minutes ago
- [ ] When I try to edit the message
- [ ] Then the Edit option should be disabled or hidden

**Scenario: View edit history**
- [ ] Given a message has been edited and history is enabled
- [ ] When I click on "(edited)" label
- [ ] Then I should see the edit history with timestamps

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-016: Message Deletion

#### Acceptance Criteria

**Scenario: Delete for me**
- [ ] Given I am viewing a message in conversation
- [ ] When I click Delete and select "Delete for me"
- [ ] Then the message should be hidden from my view only
- [ ] And others should still see the message

**Scenario: Delete for everyone with time limit**
- [ ] Given I sent a message within the time limit
- [ ] When I click Delete and select "Delete for everyone"
- [ ] Then the message should be replaced with "This message was deleted"
- [ ] And all recipients should see the deleted placeholder

**Scenario: Delete message with replies warning**
- [ ] Given my message has replies from other users
- [ ] When I try to delete it
- [ ] Then I should see a confirmation dialog
- [ ] And the dialog should warn about orphaned replies

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-017: Message Forwarding

#### Acceptance Criteria

**Scenario: Forward message**
- [ ] Given I am viewing a message
- [ ] When I click Forward and select a conversation
- [ ] Then the message should appear in the selected conversation
- [ ] And it should be marked as forwarded

**Scenario: Forward to multiple**
- [ ] Given I am forwarding a message
- [ ] When I select multiple conversations
- [ ] Then the message should be sent to all selected conversations

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-018: Voice Messages

#### Acceptance Criteria

**Scenario: Record voice message**
- [ ] Given I am in a conversation
- [ ] When I click the microphone button and speak
- [ ] And I release/click stop
- [ ] Then I should see a preview of my recording
- [ ] When I click send
- [ ] Then the voice message should be delivered

**Scenario: Voice message playback**
- [ ] Given I received a voice message
- [ ] When I click play
- [ ] Then the audio should play with progress indicator
- [ ] And I can pause, seek, and adjust speed

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-019: Video Messages

#### Acceptance Criteria

**Scenario: Record video message**
- [ ] Given I am in a conversation
- [ ] When I click the video record button
- [ ] And I record using my camera
- [ ] Then I should see a preview
- [ ] When I send it
- [ ] Then the video should be uploaded and delivered

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-020: Disappearing Messages

#### Acceptance Criteria

**Scenario: Enable disappearing messages**
- [ ] Given I am admin of a conversation
- [ ] When I go to settings and select disappearing messages duration
- [ ] Then new messages should have an expiration timestamp
- [ ] And a system message should announce the change

**Scenario: Message expiration**
- [ ] Given disappearing messages is set to 24 hours
- [ ] When 24 hours pass after a message is sent
- [ ] Then the message should be automatically deleted
- [ ] And it should no longer appear in the conversation

**Scenario: Admin disable feature**
- [ ] Given admin disables EnableDisappearingMessages globally
- [ ] When the feature is disabled
- [ ] Then all conversations should have disappearing messages turned off
- [ ] And users should see "Disappearing messages was turned off by administrator"

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-021: View-Once Messages

#### Acceptance Criteria

**Scenario: Send view-once message**
- [ ] Given I am attaching an image
- [ ] When I toggle "View once" option and send
- [ ] Then the message should be marked as view-once
- [ ] And the recipient should see a locked/blurred preview

**Scenario: View view-once message**
- [ ] Given I received a view-once message
- [ ] When I click to view it
- [ ] Then a timer should start (configurable seconds)
- [ ] When the timer expires
- [ ] Then the message should disappear permanently
- [ ] And sender should see "Viewed" status

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-022: Search in Conversation

#### Acceptance Criteria

**Scenario: Search in conversation**
- [ ] Given I am in a conversation
- [ ] When I open search and type a query
- [ ] Then matching messages should be highlighted
- [ ] And I should see a count of results
- [ ] When I click on a result
- [ ] Then I should scroll to that message

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-023: Link Previews

#### Acceptance Criteria

**Scenario: Link preview generation**
- [ ] Given EnableLinkPreview setting is enabled
- [ ] When I send a message containing a URL
- [ ] Then a preview card should be generated (if available)
- [ ] And it should show title, description, and image

**Scenario: Video preview**
- [ ] Given I share a YouTube or Vimeo link
- [ ] When the message is sent
- [ ] Then a video thumbnail should appear
- [ ] And the video title should be displayed

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 3. Voice and Video Calling

### F-030: 1:1 Voice Calls

#### Acceptance Criteria

**Scenario: Initiate voice call**
- [ ] Given EnableVoiceCalls setting is enabled
- [ ] And I am in a conversation with another user
- [ ] When I click the phone icon
- [ ] Then a call should be initiated
- [ ] And the recipient should receive a ringing notification

**Scenario: Accept incoming call**
- [ ] Given another user is calling me
- [ ] When I see the incoming call notification
- [ ] And I click Accept
- [ ] Then the call should connect
- [ ] And we should hear each other

**Scenario: Call controls**
- [ ] Given I am in an active voice call
- [ ] When I click the mute button
- [ ] Then my microphone should be muted
- [ ] And the other party should not hear me

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-031: 1:1 Video Calls

#### Acceptance Criteria

**Scenario: Initiate video call**
- [ ] Given EnableVideoCalls setting is enabled
- [ ] When I click the video call icon in a conversation
- [ ] Then a video call should be initiated
- [ ] And my camera should turn on

**Scenario: Toggle camera**
- [ ] Given I am in a video call
- [ ] When I click the camera toggle button
- [ ] Then my video should turn off/on
- [ ] And the other party should see a placeholder or my video accordingly

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-032: Group Video Calls (LiveKit)

#### Acceptance Criteria

**Scenario: Start group call**
- [ ] Given I am in a group conversation
- [ ] When I click the video call button
- [ ] Then a LiveKit room should be created
- [ ] And participants should be notified

**Scenario: Join group call**
- [ ] Given there is an ongoing group call
- [ ] When I receive the notification
- [ ] And I click Join
- [ ] Then I should enter the video conference
- [ ] And see other participants

**Scenario: Participant limit**
- [ ] Given MaxGroupCallParticipants is set to 10
- [ ] When 10 users are already in the call
- [ ] Then additional users should see a "room full" message

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-033: Screen Sharing

#### Acceptance Criteria

**Scenario: Start screen sharing**
- [ ] Given EnableScreenShare setting is enabled
- [ ] And I am in a video call
- [ ] When I click the share screen button
- [ ] And I select a screen/window to share
- [ ] Then my screen should be shared with other participants

**Scenario: Stop screen sharing**
- [ ] Given I am sharing my screen
- [ ] When I click stop sharing
- [ ] Then screen sharing should end
- [ ] And my camera view should resume

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-034: Call Recording

#### Acceptance Criteria

**Scenario: Start recording**
- [ ] Given EnableRecording setting is enabled
- [ ] And I am in a call
- [ ] When I click the record button
- [ ] Then recording should start
- [ ] And other participants should see a recording indicator

**Scenario: Recording notification**
- [ ] Given another participant starts recording
- [ ] Then I should see a prominent indicator
- [ ] And I should see the recorder's name

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 4. Contacts and Connections

### F-040: Contact Management

#### Acceptance Criteria

**Scenario: Send contact request**
- [ ] Given I found a user via search
- [ ] When I click "Add Contact"
- [ ] Then a pending request should be sent
- [ ] And the recipient should receive a notification

**Scenario: Accept contact request**
- [ ] Given I have pending contact requests
- [ ] When I go to Contacts > Pending tab
- [ ] And I click Accept on a request
- [ ] Then that user should be added to my contacts
- [ ] And we should be able to message each other

**Scenario: Mark as favorite**
- [ ] Given I have accepted contacts
- [ ] When I click the star icon on a contact
- [ ] Then they should appear in my Starred tab
- [ ] And they should appear at top of All contacts

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-041: User Blocking

#### Acceptance Criteria

**Scenario: Block user**
- [ ] Given I have a contact or conversation with a user
- [ ] When I block them from their profile or conversation settings
- [ ] Then they should not be able to message me
- [ ] And they should not be able to call me
- [ ] And they should move to my Blocked contacts list

**Scenario: Blocked user attempts contact**
- [ ] Given I am blocked by another user
- [ ] When I try to send a message
- [ ] Then I should see an error "Cannot send message. This conversation has been blocked."

**Scenario: Unblock user**
- [ ] Given I have blocked a user
- [ ] When I go to Blocked tab and click Unblock
- [ ] Then the block should be removed
- [ ] And we should be able to communicate again

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 5. Notifications and Presence

### F-050: Real-Time Presence

#### Acceptance Criteria

**Scenario: View online status**
- [ ] Given ShowOnlineStatus is enabled globally and for the user
- [ ] When I view my contacts list
- [ ] Then online contacts should have a green indicator
- [ ] And I should see their status (Online, Away, Busy)

**Scenario: View last seen**
- [ ] Given ShowLastSeen is enabled
- [ ] When I view an offline contact's conversation
- [ ] Then I should see "Last seen X minutes/hours ago"

**Scenario: Privacy respects settings**
- [ ] Given a user has disabled ShowOnlineStatus
- [ ] When I view their profile
- [ ] Then I should not see their online status

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-051: Typing Indicators

#### Acceptance Criteria

**Scenario: Show typing indicator**
- [ ] Given EnableMessagingIndicators is enabled
- [ ] When another user starts typing in our conversation
- [ ] Then I should see "User is typing..." indicator

**Scenario: Recording indicator**
- [ ] Given a user is recording a voice message
- [ ] Then I should see a microphone icon with "User is recording..."

**Scenario: Indicator in conversation list**
- [ ] Given someone is typing in a conversation
- [ ] Then I should see the indicator in the conversation list sidebar too

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-052: Push Notifications

#### Acceptance Criteria

**Scenario: Receive message notification**
- [ ] Given I have notifications enabled
- [ ] When someone sends me a message while I am not active
- [ ] Then I should receive a push notification
- [ ] And clicking it should open the conversation

**Scenario: Customize preferences**
- [ ] Given I am in notification settings
- [ ] When I disable message notifications
- [ ] Then I should not receive message push notifications
- [ ] But I should still receive call notifications

**Scenario: Muted conversation**
- [ ] Given I have muted a conversation
- [ ] When a message arrives in that conversation
- [ ] Then I should not receive a notification

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-053: Notification Center

#### Acceptance Criteria

**Scenario: View notifications**
- [ ] Given I have unread notifications
- [ ] When I click the bell icon
- [ ] Then I should see a dropdown with recent notifications
- [ ] And unread count should be displayed

**Scenario: Mark all as read**
- [ ] Given I have multiple unread notifications
- [ ] When I click "Mark all read"
- [ ] Then all notifications should be marked as read
- [ ] And the unread count should reset to 0

**Scenario: Filter notifications**
- [ ] Given I am on the notifications page
- [ ] When I select a filter (e.g., "Messages", "Calls")
- [ ] Then only notifications of that type should be shown

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 6. Organization and Management

### F-060: Conversation Management

#### Acceptance Criteria

**Scenario: Pin conversation**
- [ ] Given I right-click on a conversation
- [ ] When I select "Pin"
- [ ] Then the conversation should appear at the top of my list
- [ ] And show a pin icon

**Scenario: Mute conversation**
- [ ] Given I open conversation settings
- [ ] When I toggle "Mute Notifications"
- [ ] Then I should not receive notifications for that conversation
- [ ] And a muted icon should appear

**Scenario: Archive conversation**
- [ ] Given I right-click on a conversation
- [ ] When I select "Archive"
- [ ] Then the conversation should move to Archives section
- [ ] And be hidden from main list

**Scenario: Restore archived**
- [ ] Given I have archived conversations
- [ ] When I expand Archives section and click "Unarchive"
- [ ] Then the conversation should return to main list

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-061: Global Search

#### Acceptance Criteria

**Scenario: Global search**
- [ ] Given EnableMessageSearch is enabled
- [ ] When I press Ctrl+K or click the search bar
- [ ] And I type a search query
- [ ] Then I should see results categorized by Users, Messages, Conversations

**Scenario: Search users**
- [ ] Given AllowProfileSearch is enabled
- [ ] When I search for a username or name
- [ ] Then matching users should appear
- [ ] And I can click to view their profile or start a conversation

**Scenario: Search privacy**
- [ ] Given AllowProfileSearch is disabled globally
- [ ] When I try to search for users
- [ ] Then user search should be blocked
- [ ] And I should only see messages and conversations

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 7. Security and Compliance

### F-080: Content Reporting

#### Acceptance Criteria

**Scenario: Report message**
- [ ] Given I see an inappropriate message
- [ ] When I click the report option
- [ ] And I select a report reason (spam, harassment, inappropriate, etc.)
- [ ] And I provide additional details
- [ ] Then the report should be submitted
- [ ] And I should see confirmation

**Scenario: Report user**
- [ ] Given I want to report a user
- [ ] When I go to their profile or conversation info
- [ ] And I click "Report User"
- [ ] And I complete the report form
- [ ] Then the user should be reported to moderators

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

### F-081: Session Management

#### Acceptance Criteria

**Scenario: View sessions**
- [ ] Given I am on the devices/sessions tab in profile
- [ ] Then I should see a list of my active sessions
- [ ] And each should show device type, browser, and last active time

**Scenario: Revoke session**
- [ ] Given I see an unfamiliar session
- [ ] When I click "Revoke" or "Log out"
- [ ] Then that session should be terminated
- [ ] And the device should be logged out

**Scenario: Session timeout warning**
- [ ] Given session timeout warning is enabled
- [ ] When my session is about to expire
- [ ] Then I should see a warning modal
- [ ] And I can extend my session

#### Test Status
- [ ] Unit Tests Written
- [ ] Integration Tests Written
- [ ] E2E Tests Written
- [ ] Manual Testing Passed

---

## 8. Test Summary

### Coverage Summary by Feature Category

| Category | Total Criteria | Unit | Integration | E2E | Manual |
|----------|----------------|------|-------------|-----|--------|
| Auth & User Management (F-001 to F-006) | 42 | [ ] | [ ] | [ ] | [ ] |
| Messaging Features (F-010 to F-023) | 56 | [ ] | [ ] | [ ] | [ ] |
| Voice and Video Calling (F-030 to F-034) | 20 | [ ] | [ ] | [ ] | [ ] |
| Contacts and Connections (F-040 to F-041) | 14 | [ ] | [ ] | [ ] | [ ] |
| Notifications and Presence (F-050 to F-053) | 18 | [ ] | [ ] | [ ] | [ ] |
| Organization and Management (F-060 to F-061) | 12 | [ ] | [ ] | [ ] | [ ] |
| Security and Compliance (F-080 to F-081) | 10 | [ ] | [ ] | [ ] | [ ] |
| **Total** | **172** | - | - | - | - |

### Test Execution Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Developer | | | |
| Product Owner | | | |

### Release Readiness Checklist

- [ ] All P0 test cases passed
- [ ] All P1 test cases passed
- [ ] >= 95% P2 test cases passed
- [ ] No critical bugs open
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Accessibility audit passed
- [ ] Device compatibility verified

### Notes and Issues

| Issue ID | Description | Severity | Status |
|----------|-------------|----------|--------|
| | | | |
| | | | |
| | | | |

---

*Document maintained by QA Team. Last review: March 2, 2026*
