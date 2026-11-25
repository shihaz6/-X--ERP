import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alchemyx.connect',
  appName: 'AlchemyX Connect',
  // The web build from frontend/dist is bundled into the APK.
  webDir: '../frontend/dist',
  android: {
    // Served from https://localhost, which the backend allows in CORS.
    allowMixedContent: false,
  },
};

export default config;
