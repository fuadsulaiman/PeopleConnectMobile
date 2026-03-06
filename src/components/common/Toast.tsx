/**
 * Toast Notification Component
 *
 * A customizable toast notification system for React Native.
 *
 * Usage:
 * // In your root component, add ToastProvider
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 *
 * // Then use the hook anywhere
 * const toast = useToast();
 * toast.show({ title: 'Success!', type: 'success' });
 * toast.success('Operation completed');
 * toast.error('Something went wrong');
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../hooks';
import {
  spacing,
  borderRadius,
  shadows,
  typography,
  animation,
  zIndex,
} from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'message';
export type ToastPosition = 'top' | 'bottom';

export interface ToastConfig {
  id?: string;
  type?: ToastType;
  title?: string;
  message?: string;
  duration?: number;
  position?: ToastPosition;
  showIcon?: boolean;
  showCloseButton?: boolean;
  onPress?: () => void;
  onDismiss?: () => void;
  // For message type
  avatarUri?: string;
  senderName?: string;
}

interface ToastContextType {
  show: (config: ToastConfig) => string;
  hide: (id: string) => void;
  hideAll: () => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast configuration by type
const toastConfig: Record<
  ToastType,
  { icon: string; lightBg: string; lightBorder: string; lightText: string }
> = {
  success: {
    icon: 'checkmark-circle',
    lightBg: '#F0FDF4',
    lightBorder: '#BBF7D0',
    lightText: '#166534',
  },
  error: {
    icon: 'alert-circle',
    lightBg: '#FEF2F2',
    lightBorder: '#FECACA',
    lightText: '#991B1B',
  },
  warning: {
    icon: 'warning',
    lightBg: '#FFFBEB',
    lightBorder: '#FDE68A',
    lightText: '#92400E',
  },
  info: {
    icon: 'information-circle',
    lightBg: '#EFF6FF',
    lightBorder: '#BFDBFE',
    lightText: '#1E40AF',
  },
  message: {
    icon: 'chatbubble',
    lightBg: '#FFFFFF',
    lightBorder: '#E5E7EB',
    lightText: '#1F2937',
  },
};

// Individual Toast Component
const ToastItem: React.FC<{
  toast: ToastConfig & { id: string };
  onDismiss: (id: string) => void;
  position: ToastPosition;
}> = ({ toast, onDismiss, position }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const styles = useMemo(() => createToastStyles(colors), [colors]);
  const config = toastConfig[toast.type || 'info'];

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 100) {
          // Swipe out
          Animated.timing(translateX, {
            toValue: gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
            duration: animation.duration.fast,
            useNativeDriver: true,
          }).start(() => onDismiss(toast.id));
        } else {
          // Spring back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: animation.duration.slow,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: animation.duration.slow,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    if (toast.duration !== 0) {
      const timeout = setTimeout(() => {
        dismissToast();
      }, toast.duration || 4000);

      return () => clearTimeout(timeout);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: animation.duration.normal,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: animation.duration.normal,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
      toast.onDismiss?.();
    });
  };

  const handlePress = () => {
    if (toast.onPress) {
      toast.onPress();
      dismissToast();
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        position === 'top'
          ? { top: insets.top + spacing[2] }
          : { bottom: insets.bottom + spacing[2] },
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[
          styles.toast,
          {
            backgroundColor: config.lightBg,
            borderColor: config.lightBorder,
          },
        ]}
        activeOpacity={toast.onPress ? 0.8 : 1}
        onPress={handlePress}
      >
        {toast.showIcon !== false && (
          <View style={styles.iconContainer}>
            <Icon name={config.icon} size={24} color={config.lightText} />
          </View>
        )}

        <View style={styles.contentContainer}>
          {toast.title && (
            <Text style={[styles.title, { color: config.lightText }]}>{toast.title}</Text>
          )}
          {toast.message && (
            <Text
              style={[
                styles.message,
                { color: config.lightText },
                !toast.title && styles.messageLarge,
              ]}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          )}
        </View>

        {toast.showCloseButton !== false && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={dismissToast}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={20} color={config.lightText} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<(ToastConfig & { id: string })[]>([]);
  const idCounter = useRef(0);

  const show = useCallback((config: ToastConfig): string => {
    const id = config.id || `toast-${++idCounter.current}`;
    const toast = { ...config, id };

    setToasts((prev) => {
      // Remove duplicates with same id
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, toast];
    });

    return id;
  }, []);

  const hide = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hideAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, title?: string) => show({ type: 'success', message, title }),
    [show]
  );

  const error = useCallback(
    (message: string, title?: string) => show({ type: 'error', message, title }),
    [show]
  );

  const warning = useCallback(
    (message: string, title?: string) => show({ type: 'warning', message, title }),
    [show]
  );

  const info = useCallback(
    (message: string, title?: string) => show({ type: 'info', message, title }),
    [show]
  );

  const contextValue = useMemo(
    () => ({ show, hide, hideAll, success, error, warning, info }),
    [show, hide, hideAll, success, error, warning, info]
  );

  // Group toasts by position
  const topToasts = toasts.filter((t) => t.position !== 'bottom');
  const bottomToasts = toasts.filter((t) => t.position === 'bottom');

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Top toasts */}
      <View style={styles.topContainer} pointerEvents="box-none">
        {topToasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={hide} position="top" />
        ))}
      </View>

      {/* Bottom toasts */}
      <View style={styles.bottomContainer} pointerEvents="box-none">
        {bottomToasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={hide} position="bottom" />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Static styles for containers
const styles = StyleSheet.create({
  bottomContainer: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: zIndex.toast,
  },
  topContainer: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: zIndex.toast,
  },
});

// Dynamic styles based on theme
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createToastStyles = (_colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    closeButton: {
      marginLeft: spacing[3],
      padding: spacing[1],
    },
    contentContainer: {
      flex: 1,
    },
    iconContainer: {
      marginRight: spacing[3],
    },
    message: {
      fontSize: typography.fontSize.bodySm,
      fontWeight: typography.fontWeight.regular,
    },
    messageLarge: {
      fontSize: typography.fontSize.body,
    },
    title: {
      fontSize: typography.fontSize.body,
      fontWeight: typography.fontWeight.semibold,
      marginBottom: 2,
    },
    toast: {
      alignItems: 'center',
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      flexDirection: 'row',
      maxWidth: 400,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      width: '100%',
      ...shadows.lg,
    },
    toastContainer: {
      alignItems: 'center',
      left: spacing[4],
      position: 'absolute',
      right: spacing[4],
    },
  });

export default {
  ToastProvider,
  useToast,
};
