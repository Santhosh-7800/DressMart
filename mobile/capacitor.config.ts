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
  // dist/ stays at the repo root (shared with the GitHub Pages web deploy) — this config now
  // lives one level down in mobile/, hence '../dist'.
  webDir: '../dist',
  backgroundColor: '#131921',
  android: {
    backgroundColor: '#131921',
  },
  // Only Google Sign-In is actually implemented (see authService.ts) — disabling the other
  // providers keeps their unconfigured native dependencies (Facebook/Apple/Twitter SDKs) out of
  // the APK entirely, rather than bundling dead code with no App ID/keys behind it.
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
