// Jest setup file for React Native
// Minimal mocking approach for Zustand stores

// Mock react-native
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  NativeModules: {},
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((style) => style),
  },
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  StatusBar: 'StatusBar',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Pressable: 'Pressable',
  Animated: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    Image: 'Animated.Image',
    createAnimatedComponent: jest.fn((component) => component),
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => ({})),
    })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
  })),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  },
}));

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
  NavigationContainer: ({ children }) => children,
}));

// Mock SignalR
jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: jest.fn().mockImplementation(() => ({
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      invoke: jest.fn().mockResolvedValue(undefined),
      state: 'Connected',
    }),
  })),
  HubConnectionState: {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
    Disconnecting: 'Disconnecting',
    Reconnecting: 'Reconnecting',
  },
}));

// Mock Image Picker
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

// Mock Document Picker
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  isCancel: jest.fn(),
  types: {
    allFiles: '*/*',
    images: 'image/*',
    video: 'video/*',
    audio: 'audio/*',
  },
}));

// Mock LiveKit
jest.mock('@livekit/react-native', () => ({
  useRoom: jest.fn(() => ({
    room: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  useParticipant: jest.fn(() => ({
    participant: null,
    isSpeaking: false,
    isMuted: true,
  })),
  VideoView: 'VideoView',
  AudioSession: {
    configure: jest.fn(),
    startAudioSession: jest.fn(),
    stopAudioSession: jest.fn(),
  },
}));

// Mock @livekit/react-native-webrtc
jest.mock('@livekit/react-native-webrtc', () => ({
  registerGlobals: jest.fn(),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: 'Swipeable',
  DrawerLayout: 'DrawerLayout',
  State: {},
  ScrollView: 'ScrollView',
  Slider: 'Slider',
  Switch: 'Switch',
  TextInput: 'TextInput',
  ToolbarAndroid: 'ToolbarAndroid',
  ViewPagerAndroid: 'ViewPagerAndroid',
  DrawerLayoutAndroid: 'DrawerLayoutAndroid',
  WebView: 'WebView',
  NativeViewGestureHandler: 'NativeViewGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  FlingGestureHandler: 'FlingGestureHandler',
  ForceTouchGestureHandler: 'ForceTouchGestureHandler',
  LongPressGestureHandler: 'LongPressGestureHandler',
  PanGestureHandler: 'PanGestureHandler',
  PinchGestureHandler: 'PinchGestureHandler',
  RotationGestureHandler: 'RotationGestureHandler',
  RawButton: 'RawButton',
  BaseButton: 'BaseButton',
  RectButton: 'RectButton',
  BorderlessButton: 'BorderlessButton',
  FlatList: 'FlatList',
  gestureHandlerRootHOC: jest.fn((component) => component),
  Directions: {},
}));

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  CachesDirectoryPath: '/mock/cache',
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('')),
  unlink: jest.fn(() => Promise.resolve()),
  exists: jest.fn(() => Promise.resolve(false)),
  mkdir: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  PERMISSIONS: {
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      MICROPHONE: 'ios.permission.MICROPHONE',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    },
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    BLOCKED: 'blocked',
    DENIED: 'denied',
    GRANTED: 'granted',
    LIMITED: 'limited',
  },
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
  QueryClientProvider: ({ children }) => children,
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isLoading: false })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
}));

// Global test utilities
global.fetch = jest.fn();

// Silence specific console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('componentWillReceiveProps') ||
      message.includes('componentWillMount') ||
      message.includes('extracted from react-native core') ||
      message.includes('NativeEventEmitter'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Warning:') ||
      message.includes('Error: Not implemented:'))
  ) {
    return;
  }
  originalError.apply(console, args);
};
