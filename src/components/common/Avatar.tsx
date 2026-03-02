import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, ViewStyle } from "react-native";
import { config } from "../../constants";
import { useTheme } from "../../hooks";

// Helper to convert relative URLs to absolute URLs
const toAbsoluteUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${path}`;
};

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  status?: "online" | "away" | "busy" | "offline";
  style?: ViewStyle;
}

export function Avatar({ uri, name, size = 40, status, style }: AvatarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initials = (name || "")
    .split(" ")
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const statusColors = {
    online: colors.online,
    away: colors.away,
    busy: colors.busy,
    offline: colors.offline,
  };

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {uri ? (
        <Image
          source={{ uri: toAbsoluteUrl(uri) }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {status && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColors[status],
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              borderWidth: size * 0.05,
            },
          ]}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof import('../../hooks').useTheme>['colors']) => StyleSheet.create({
  container: {
    position: "relative",
  },
  image: {
    backgroundColor: colors.gray[200],
  },
  placeholder: {
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    color: colors.white,
    fontWeight: "600",
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderColor: colors.white,
  },
});

export default Avatar;
