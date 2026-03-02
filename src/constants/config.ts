export const config = {
  API_BASE_URL: 'https://3.121.226.182/api',
  SIGNALR_URL: 'https://3.121.226.182',
  LIVEKIT_URL: 'wss://3.121.226.182/livekit',
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MESSAGES_PAGE_SIZE: 50,
  
  // Timeouts
  API_TIMEOUT: 30000,
  SIGNALR_RECONNECT_DELAY: 5000,
  
  // Cache durations (ms)
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  // Message settings
  MAX_MESSAGE_LENGTH: 4000,
  TYPING_DEBOUNCE: 500,
  TYPING_TIMEOUT: 3000,
};

export default config;
