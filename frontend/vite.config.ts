import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// GitHub Pages serves project sites from a /<repo-name>/ subpath, not the domain root — the
// deploy workflow (.github/workflows/deploy-pages.yml) sets this from the repo name at build
// time. Every other environment (local dev, Capacitor's bundled assets, a custom-domain
// deployment) serves from the root, so this defaults to '/' unchanged.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Firebase Messaging already ships its own service worker (public/firebase-messaging-sw.js,
      // registered manually by src/hooks/useFcmToken.ts) — this plugin's generated SW is a separate,
      // additional one (app-shell precache + runtime image caching) and must not clobber that file.
      injectRegister: 'auto',
      manifest: {
        name: 'DressMart',
        short_name: 'DressMart',
        description: "Premium online shopping for Men's and Kids' wear",
        theme_color: '#131921',
        background_color: '#131921',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: '/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icons/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell; runtime-cache product photos (the bulk of network traffic)
        // with a stale-while-revalidate strategy so repeat visits render instantly while still
        // picking up updated images in the background. Firestore/Storage API calls are intentionally
        // NOT cached here — that's Firestore's own offline-persistence layer's job (see src/lib/firebase.ts).
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/images\/products\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
