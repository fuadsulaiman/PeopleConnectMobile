import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuthStore } from "../../stores";
import { useTheme } from "../../hooks";
import { ProfileScreenProps, RootStackParamList, ProfileStackParamList } from "../../navigation/types";

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const rootNavigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();
  const { colors } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Create dynamic styles based on theme colors
  const styles = useMemo(() => createStyles(colors), [colors]);

  const menuItems = [
    { icon: "person-outline", label: "Edit Profile", onPress: () => navigation.navigate("EditProfile") },
    { icon: "settings-outline", label: "Settings", onPress: () => navigation.navigate("Settings") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => rootNavigation.navigate("Notifications") },
    { icon: "shield-outline", label: "Privacy", onPress: () => {} },
    { icon: "help-circle-outline", label: "Help & Support", onPress: () => {} },
    { icon: "information-circle-outline", label: "About", onPress: () => {} },
  ];

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> :
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={48} color={colors.white} /></View>}
          <TouchableOpacity style={styles.editAvatarButton} onPress={() => navigation.navigate("EditProfile")}>
            <Icon name="camera" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{user?.name || "User"}</Text>
        <Text style={styles.username}>@{user?.username || "username"}</Text>
        {user?.statusMessage && <Text style={styles.statusMessage}>{user.statusMessage}</Text>}
      </View>
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <View style={styles.menuIconContainer}><Icon name={item.icon} size={22} color={colors.primary} /></View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <Icon name="log-out-outline" size={22} color={colors.error} />
        )}
        <Text style={styles.logoutText}>{isLoggingOut ? "Logging out..." : "Log Out"}</Text>
      </TouchableOpacity>
      <Text style={styles.version}>PeopleConnect v1.0.0</Text>
    </ScrollView>
  );
};

// Create dynamic styles based on theme colors
const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: "center", paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarContainer: { position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  editAvatarButton: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: colors.background },
  name: { fontSize: 24, fontWeight: "bold", color: colors.text, marginTop: 16 },
  username: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  statusMessage: { fontSize: 14, color: colors.textSecondary, marginTop: 8, fontStyle: "italic" },
  menuContainer: { marginTop: 24 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 16, color: colors.text },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, marginTop: 24, marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 12 },
  logoutText: { fontSize: 16, fontWeight: "600", color: colors.error, marginLeft: 8 },
  version: { textAlign: "center", fontSize: 12, color: colors.textSecondary, marginVertical: 24 },
});

export default ProfileScreen;
