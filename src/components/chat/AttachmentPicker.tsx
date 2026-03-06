import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';

interface AttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  isViewOnce: boolean;
  onToggleViewOnce: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickDocument: () => void;
  onShareLocation: () => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  visible,
  onClose,
  isViewOnce,
  onToggleViewOnce,
  onTakePhoto,
  onRecordVideo,
  onPickImage,
  onPickVideo,
  onPickDocument,
  onShareLocation,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: colors.white }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Share</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[
                  styles.viewOnceToggle,
                  isViewOnce
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: 'transparent' },
                ]}
                onPress={onToggleViewOnce}
              >
                <Icon
                  name={isViewOnce ? 'eye-off' : 'eye-outline'}
                  size={18}
                  color={isViewOnce ? colors.white : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          {isViewOnce && (
            <View style={[styles.viewOnceWarning, { backgroundColor: colors.warning + '20' }]}>
              <Text style={{ fontSize: 12, color: colors.warning, textAlign: 'center' }}>
                View once enabled - recipient can only view once
              </Text>
            </View>
          )}
          <View style={styles.grid}>
            <TouchableOpacity style={styles.item} onPress={onTakePhoto}>
              <View style={[styles.icon, { backgroundColor: '#4CAF50' }]}>
                <Icon name="camera" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={onRecordVideo}>
              <View style={[styles.icon, { backgroundColor: '#E91E63' }]}>
                <Icon name="videocam" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={onPickImage}>
              <View style={[styles.icon, { backgroundColor: '#2196F3' }]}>
                <Icon name="image" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={onPickVideo}>
              <View style={[styles.icon, { backgroundColor: '#9C27B0' }]}>
                <Icon name="film" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={onPickDocument}>
              <View style={[styles.icon, { backgroundColor: '#FF9800' }]}>
                <Icon name="document" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Document</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={onShareLocation}>
              <View style={[styles.icon, { backgroundColor: '#F44336' }]}>
                <Icon name="location" size={28} color={colors.white} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', padding: 16 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerRight: { alignItems: 'center', flexDirection: 'row' },
  icon: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 8,
    width: 56,
  },
  item: { alignItems: 'center', marginBottom: 20, width: '25%' },
  label: { fontSize: 12, textAlign: 'center' },
  overlay: { backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'flex-end' },
  title: { fontSize: 18, fontWeight: '600' },
  viewOnceToggle: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
    width: 36,
  },
  viewOnceWarning: { paddingHorizontal: 16, paddingVertical: 8 },
});

export default AttachmentPicker;
