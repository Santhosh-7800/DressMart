import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root')!;

/**
 * `./App` is imported dynamically (not statically at the top of this file) so that a startup-time
 * failure — most notably lib/firebase.ts throwing on a misconfigured deployment (see its own
 * comment) — can be caught here instead of crashing before React ever mounts. A throw during a
 * *static* import's module evaluation happens during module linking, before any of this file's own
 * code runs, so no try/catch in this file could ever catch it; a dynamic import() returns a promise
 * instead, which can. This is the one thing standing between a real misconfiguration and a
 * permanently blank page with nothing but a console error — see App.tsx's own <ErrorBoundary> for
 * the separate, narrower case of a component actually throwing during render, once the app has
 * already started.
 */
async function bootstrap() {
  try {
    const [{ App }, { initCapacitorNative }] = await Promise.all([import('./App'), import('./lib/capacitorNative')]);
    void initCapacitorNative();
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('[bootstrap] The app failed to start:', error);
    rootElement.innerHTML = `
      <div style="display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font-family:system-ui,sans-serif;background:#F8F8F8;color:#131921;">
        <h1 style="font-size:1.125rem;font-weight:600;margin:0;">Something went wrong</h1>
        <p style="max-width:24rem;margin:0;color:#4a5261;font-size:0.875rem;">We couldn't load DressMart right now. Please try again in a moment.</p>
        <button onclick="location.reload()" style="margin-top:8px;padding:10px 20px;border-radius:9999px;border:none;background:#FF9900;color:#131921;font-weight:600;cursor:pointer;">Retry</button>
      </div>
    `;
  }
}

void bootstrap();
