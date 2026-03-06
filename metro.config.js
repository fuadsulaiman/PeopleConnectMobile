const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Get the SDK path - normalize to forward slashes for cross-platform compatibility
const sdkPath = path.resolve(__dirname, '../PeopleConnectSDK');
// Convert Windows backslashes to forward slashes for regex
const sdkPathForRegex = sdkPath.split(path.sep).join('/');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sdkPath],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        // Disabled inlineRequires to fix module initialization order issues on Windows
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    // Note: Removed 'mjs' to avoid issues with ESM modules that have empty chunk files
    // This ensures Metro uses CommonJS (.js) versions of packages like @peopleconnect/sdk
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
    assetExts: [
      'bmp',
      'gif',
      'jpg',
      'jpeg',
      'png',
      'psd',
      'svg',
      'webp',
      'ttf',
      'otf',
      'woff',
      'woff2',
      'mp3',
      'mp4',
      'wav',
      'm4a',
      'aac',
      'webm',
    ],
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
    // Block SDK's node_modules to prevent conflicts
    // Use both forward slash and backslash patterns for Windows compatibility
    blockList: [
      // Forward slash pattern (Unix-style, used internally by Metro)
      new RegExp(`${sdkPathForRegex}/node_modules/.*`),
      // Backslash pattern (Windows native paths) - escape backslashes for regex
      new RegExp(`${sdkPath.replace(/\\/g, '\\\\')}/node_modules/.*`),
    ],
    // Follow symlinks
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enableSymlinks: true,
    // Extra node modules to resolve from (helps with symlinked packages)
    extraNodeModules: {
      '@peopleconnect/sdk': sdkPath,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
