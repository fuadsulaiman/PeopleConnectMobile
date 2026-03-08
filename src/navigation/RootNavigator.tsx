import React, { useEffect, useRef, createRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuthStore } from '../stores/authStore';
import { useCallStore } from '../stores/callStore';
import { colors } from '../constants/colors';
import {
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
  ChatStackParamList,
  ContactsStackParamList,
  CallsStackParamList,
  ProfileStackParamList,
} from './types';

// Export navigation ref for use in App.tsx (for handling group call notifications)
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();

// Auth Screens - default imports
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';

// Chat Screens - default imports
import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import ArchivedConversationsScreen from '../screens/chat/ArchivedConversationsScreen';
import UserProfileScreen from '../screens/chat/UserProfileScreen';

// Contacts Screens - default imports
import ContactsScreen from '../screens/contacts/ContactsScreen';
import AddContactScreen from '../screens/contacts/AddContactScreen';

// Calls Screens - default imports
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';
import CallScreen from '../screens/calls/CallScreen';
import GroupCallScreen from '../screens/calls/GroupCallScreen';

// Profile Screens - default imports
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

// Settings Screens - default imports
import SettingsScreen from '../screens/settings/SettingsScreen';

import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import TwoFactorSettingsScreen from '../screens/settings/TwoFactorSettingsScreen';
import PrivacySettingsScreen from '../screens/settings/PrivacySettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';

// Devices Screen - default import
import DevicesScreen from '../screens/devices/DevicesScreen';

// Notifications Screen - default import
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Broadcasts Screens - default imports
import BroadcastsScreen from '../screens/broadcasts/BroadcastsScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const ContactsStack = createNativeStackNavigator<ContactsStackParamList>();
const CallsStack = createNativeStackNavigator<CallsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const AuthNavigator: React.FC = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <AuthStack.Screen name="TwoFactor" component={TwoFactorScreen} />
    <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
  </AuthStack.Navigator>
);

const ChatTabNavigator: React.FC = () => (
  <ChatStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <ChatStack.Screen name="Conversations" component={ConversationsScreen} />
    <ChatStack.Screen
      name="Chat"
      component={ChatScreen}
      options={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    />
    <ChatStack.Screen
      name="NewChat"
      component={NewChatScreen}
      options={{
        headerShown: true,
        title: 'New Chat',
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    />
    <ChatStack.Screen
      name="ArchivedConversations"
      component={ArchivedConversationsScreen}
      options={{
        headerShown: false,
      }}
    />
    <ChatStack.Screen
      name="UserProfile"
      component={UserProfileScreen}
      options={{
        headerShown: false,
      }}
    />
  </ChatStack.Navigator>
);

const ContactsTabNavigator: React.FC = () => (
  <ContactsStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <ContactsStack.Screen name="ContactsList" component={ContactsScreen} />
    <ContactsStack.Screen name="AddContact" component={AddContactScreen} />
  </ContactsStack.Navigator>
);

const CallsTabNavigator: React.FC = () => (
  <CallsStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <CallsStack.Screen name="CallHistory" component={CallHistoryScreen} />
    <CallsStack.Screen name="Call" component={CallScreen as any} />
  </CallsStack.Navigator>
);

const ProfileTabNavigator: React.FC = () => (
  <ProfileStack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
    <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <ProfileStack.Screen name="TwoFactorSettings" component={TwoFactorSettingsScreen} />
    <ProfileStack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
    <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
    <ProfileStack.Screen name="Devices" component={DevicesScreen} />
  </ProfileStack.Navigator>
);

const MainNavigator: React.FC = () => (
  <MainTab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarStyle: {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
      },
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: string;
        switch (route.name) {
          case 'ChatTab':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'ContactsTab':
            iconName = focused ? 'people' : 'people-outline';
            break;
          case 'CallsTab':
            iconName = focused ? 'call' : 'call-outline';
            break;
          case 'BroadcastsTab':
            iconName = focused ? 'megaphone' : 'megaphone-outline';
            break;
          case 'ProfileTab':
            iconName = focused ? 'person' : 'person-outline';
            break;
          default:
            iconName = 'ellipse';
        }
        return <Icon name={iconName} size={size} color={color} />;
      },
    })}
  >
    <MainTab.Screen
      name="ChatTab"
      component={ChatTabNavigator}
      options={{ tabBarLabel: 'Chats' }}
    />
    <MainTab.Screen
      name="ContactsTab"
      component={ContactsTabNavigator}
      options={{ tabBarLabel: 'Contacts' }}
    />
    <MainTab.Screen
      name="CallsTab"
      component={CallsTabNavigator}
      options={{ tabBarLabel: 'Calls' }}
    />
    <MainTab.Screen
      name="BroadcastsTab"
      component={BroadcastsScreen}
      options={{ tabBarLabel: 'Broadcasts' }}
    />
    <MainTab.Screen
      name="ProfileTab"
      component={ProfileTabNavigator}
      options={{ tabBarLabel: 'Profile' }}
    />
  </MainTab.Navigator>
);

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { callState, currentCall } = useCallStore();
  // Use the exported navigationRef for navigation from App.tsx
  const hasNavigatedToCallRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Watch for incoming calls and navigate to ActiveCall screen
  useEffect(() => {
    if (!isAuthenticated || !navigationRef.current) {
      return;
    }

    if (
      (callState === 'incoming' ||
        callState === 'connecting' ||
        callState === 'connected') &&
      currentCall &&
      !hasNavigatedToCallRef.current
    ) {
      // Determine if this is an incoming call (callee perspective)
      const isIncoming = callState === 'incoming';
      
      console.log('Navigating to ActiveCall screen for call:', currentCall.id);
      hasNavigatedToCallRef.current = true;
      navigationRef.current.navigate('ActiveCall', {
        call: currentCall as any,
        user: currentCall.caller as any,
        type: currentCall.type,
        isIncoming,
      });
    } else if (callState === 'idle' || callState === 'ended') {
      hasNavigatedToCallRef.current = false;
    }
  }, [callState, currentCall, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainNavigator} />
            <RootStack.Screen
              name="ActiveCall"
              component={CallScreen as any}
              options={{
                presentation: 'modal',
                gestureEnabled: false,
              }}
            />
            <RootStack.Screen
              name="GroupCall"
              component={GroupCallScreen}
              options={{
                presentation: 'modal',
                gestureEnabled: false,
              }}
            />
            <RootStack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                presentation: 'modal',
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

export default RootNavigator;
