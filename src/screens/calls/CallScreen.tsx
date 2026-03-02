import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, SafeAreaView } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useCallStore } from "../../stores";
import { colors } from "../../constants/colors";
import { CallScreenProps } from "../../navigation/types";

const { width, height } = Dimensions.get("window");

const CallScreen: React.FC<CallScreenProps> = ({ route, navigation }) => {
  const { call, user, type } = route.params;
  const { currentCall, isMuted, isVideoEnabled, isSpeakerOn, toggleMute, toggleVideo, toggleSpeaker, endCall, acceptCall } = useCallStore();
  const [callDuration, setCallDuration] = useState(0);
  const isConnected = currentCall?.status === "connected";
  const isIncoming = currentCall?.direction === "incoming" && currentCall?.status === "ringing";
  const isVideo = type === "video" || currentCall?.type === "video";

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins.toString().padStart(2, "0") + ":" + secs.toString().padStart(2, "0");
  };

  const handleEndCall = () => {
    endCall();
    navigation.goBack();
  };

  const displayUser = user || currentCall?.participants[0]?.user;

  return (
    <SafeAreaView style={styles.container}>
      {isVideo && <View style={styles.videoContainer}><View style={styles.remoteVideo} /><View style={styles.localVideo} /></View>}
      {!isVideo && (
        <View style={styles.audioContainer}>
          {displayUser?.avatarUrl ? <Image source={{ uri: displayUser.avatarUrl }} style={styles.avatar} /> :
            <View style={[styles.avatar, styles.avatarPlaceholder]}><Icon name="person" size={64} color={colors.white} /></View>}
          <Text style={styles.callerName}>{displayUser?.name || "Unknown"}</Text>
          <Text style={styles.callStatus}>
            {isConnected ? formatDuration(callDuration) : isIncoming ? "Incoming call..." : "Calling..."}
          </Text>
        </View>
      )}
      {isIncoming ? (
        <View style={styles.incomingControls}>
          <TouchableOpacity style={[styles.controlButton, styles.rejectButton]} onPress={handleEndCall}>
            <Icon name="close" size={32} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlButton, styles.acceptButton]} onPress={acceptCall}>
            <Icon name={isVideo ? "videocam" : "call"} size={32} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlButtonActive]} onPress={toggleMute}>
            <Icon name={isMuted ? "mic-off" : "mic"} size={28} color={colors.white} />
          </TouchableOpacity>
          {isVideo && (
            <TouchableOpacity style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]} onPress={toggleVideo}>
              <Icon name={isVideoEnabled ? "videocam" : "videocam-off"} size={28} color={colors.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCall}>
            <Icon name="call" size={32} color={colors.white} style={styles.endCallIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]} onPress={toggleSpeaker}>
            <Icon name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Icon name="camera-reverse" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[900] },
  videoContainer: { flex: 1, position: "relative" },
  remoteVideo: { flex: 1, backgroundColor: colors.gray[800] },
  localVideo: { position: "absolute", top: 40, right: 20, width: 120, height: 160, backgroundColor: colors.gray[700], borderRadius: 12 },
  audioContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  avatarPlaceholder: { backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  callerName: { fontSize: 28, fontWeight: "bold", color: colors.white, marginTop: 24 },
  callStatus: { fontSize: 16, color: colors.gray[400], marginTop: 8 },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 32, paddingHorizontal: 16 },
  incomingControls: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 32, paddingHorizontal: 48 },
  controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.gray[700], justifyContent: "center", alignItems: "center", marginHorizontal: 12 },
  controlButtonActive: { backgroundColor: colors.primary },
  endCallButton: { backgroundColor: colors.error, width: 70, height: 70, borderRadius: 35 },
  endCallIcon: { transform: [{ rotate: "135deg" }] },
  acceptButton: { backgroundColor: colors.success, width: 70, height: 70, borderRadius: 35 },
  rejectButton: { backgroundColor: colors.error, width: 70, height: 70, borderRadius: 35 },
});

export default CallScreen;
