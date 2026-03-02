const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Get the SDK path
const sdkPath = path.resolve(__dirname, '../PeopleConnectSDK');

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
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json', 'mjs'],
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
    // Follow symlinks
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enableSymlinks: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
