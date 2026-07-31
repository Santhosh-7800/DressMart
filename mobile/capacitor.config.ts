import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Wraps the existing Vite web build (dist/) in a native Android shell — no business logic, no
 * Firebase/Razorpay integration, and no UI code changes here; this only configures the native
 * container. appId is the Android package name — it's immutable once published to the Play Store,
 * so confirm it (or change it) before a real release build.
 */
const config: CapacitorConfig = {
  appId: 'com.dressmart.app',
  appName: 'DressMart',
  webDir: 'dist',
  backgroundColor: '#131921',
  android: {
    backgroundColor: '#131921',
  },
};

export default config;
