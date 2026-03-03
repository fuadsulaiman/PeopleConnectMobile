import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../hooks";

interface SystemMessageProps {
  content: string;
  type?: "info" | "voicecall" | "videocall";
  isMissed?: boolean;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
  content,
  type = "info",
  isMissed = false,
}) => {
  const { colors } = useTheme();

  const getIcon = () => {
    switch (type) {
      case "voicecall": return "call";
      case "videocall": return "videocam";
      default: return "information-circle-outline";
    }
  };

  const getIconColor = () => {
    if (type === "voicecall" || type === "videocall") {
      return isMissed ? colors.error : colors.success;
    }
    return colors.textSecondary;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
        <Icon
          name={getIcon()}
          size={type === "info" ? 14 : 18}
          color={getIconColor()}
          style={styles.icon}
        />
        <Text style={[styles.text, { color: isMissed ? colors.error : colors.textSecondary }]}>
          {content}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 8,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
  },
});

export default SystemMessage;
