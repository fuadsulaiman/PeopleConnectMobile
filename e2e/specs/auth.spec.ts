import { device, element, by, expect } from 'detox';

describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login Screen', () => {
    it('should show login screen on app launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.id('username-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should show validation error for empty fields', async () => {
      await element(by.id('login-button')).tap();
      await expect(element(by.text('Username is required'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('username-input')).typeText('invaliduser');
      await element(by.id('password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();

      await expect(element(by.text('Invalid credentials'))).toBeVisible();
    });

    it('should login successfully with valid credentials', async () => {
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('Aa@123456');
      await element(by.id('login-button')).tap();

      // Should navigate to conversations screen
      await expect(element(by.id('conversations-screen'))).toBeVisible();
    });

    it('should toggle password visibility', async () => {
      await element(by.id('password-input')).typeText('testpassword');
      await element(by.id('toggle-password-visibility')).tap();

      // Password should now be visible (as text, not dots)
      await expect(element(by.id('password-input'))).toHaveText('testpassword');
    });

    it('should navigate to register screen', async () => {
      await element(by.id('register-link')).tap();
      await expect(element(by.id('register-screen'))).toBeVisible();
    });

    it('should navigate to forgot password screen', async () => {
      await element(by.id('forgot-password-link')).tap();
      await expect(element(by.id('forgot-password-screen'))).toBeVisible();
    });
  });

  describe('Registration Screen', () => {
    beforeEach(async () => {
      await element(by.id('register-link')).tap();
    });

    it('should show registration form fields', async () => {
      await expect(element(by.id('register-screen'))).toBeVisible();
      await expect(element(by.id('display-name-input'))).toBeVisible();
      await expect(element(by.id('username-input'))).toBeVisible();
      await expect(element(by.id('email-input'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('confirm-password-input'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('email-input')).typeText('invalidemail');
      await element(by.id('register-button')).tap();

      await expect(element(by.text('Invalid email format'))).toBeVisible();
    });

    it('should validate password match', async () => {
      await element(by.id('password-input')).typeText('Password123!');
      await element(by.id('confirm-password-input')).typeText('DifferentPassword');
      await element(by.id('register-button')).tap();

      await expect(element(by.text('Passwords do not match'))).toBeVisible();
    });

    it('should show invitation code field when required', async () => {
      // This test assumes invite-only mode is enabled
      await expect(element(by.id('invitation-code-input'))).toExist();
    });

    it('should navigate back to login', async () => {
      await element(by.id('back-to-login')).tap();
      await expect(element(by.id('login-screen'))).toBeVisible();
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should show 2FA screen when required', async () => {
      // Login with user that has 2FA enabled
      await element(by.id('username-input')).typeText('user2fa');
      await element(by.id('password-input')).typeText('Aa@123456');
      await element(by.id('login-button')).tap();

      await expect(element(by.id('2fa-screen'))).toBeVisible();
      await expect(element(by.id('2fa-code-input'))).toBeVisible();
    });

    it('should show error for invalid 2FA code', async () => {
      await element(by.id('username-input')).typeText('user2fa');
      await element(by.id('password-input')).typeText('Aa@123456');
      await element(by.id('login-button')).tap();

      await element(by.id('2fa-code-input')).typeText('000000');
      await element(by.id('verify-2fa-button')).tap();

      await expect(element(by.text('Invalid verification code'))).toBeVisible();
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Login first
      await element(by.id('username-input')).typeText('testuser');
      await element(by.id('password-input')).typeText('Aa@123456');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('conversations-screen'))).toBeVisible();
    });

    it('should logout successfully', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('logout-button')).tap();

      // Should return to login screen
      await expect(element(by.id('login-screen'))).toBeVisible();
    });

    it('should show confirmation dialog before logout', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('logout-button')).tap();

      await expect(element(by.text('Are you sure you want to logout?'))).toBeVisible();
    });
  });
});
