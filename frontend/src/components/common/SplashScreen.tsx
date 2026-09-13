/**
 * Branded boot splash — shown while CatalogHealthGate is waiting on the one-time catalog probe
 * and/or AuthContext's initial auth restore (see CatalogHealthGate.tsx, which owns the timing/exit
 * transition; this component is purely presentational).
 *
 * The hero image is a pre-cropped WebP (logo + wordmark + tagline + the two-boys photo only — the
 * source design's static "Loading your style..." + progress bar footer was cropped OUT, since that
 * part is recreated below as a real, live-animated indicator instead of a frozen graphic). See
 * frontend/src/assets/splash-source/ for the original full mockup this was cropped from.
 *
 * Deliberately `object-contain`-style (scale to fit, never crop) rather than a `cover` full-bleed
 * background: on unusual aspect ratios (very short/wide devices, tablets) a `cover` crop risks
 * clipping the logo or the models, which is worse than letterboxing onto the matching navy
 * background — the two are visually seamless since the image's own background is the same navy.
 *
 * `exiting` drives the fade/scale-out transition (see CatalogHealthGate, which flips it then keeps
 * this mounted for the transition's duration before removing it — avoiding an abrupt cut to the app
 * underneath). The transition lives on this component's own root rather than a wrapping element:
 * a `transform` on an ancestor of a `fixed` element repositions it relative to that ancestor instead
 * of the viewport, so scaling would visibly drift instead of just fading in place.
 */
export function SplashScreen({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#111827] transition-all duration-300 ease-out ${
        exiting ? 'pointer-events-none scale-105 opacity-0' : 'scale-100 opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading DressMart"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 pt-safe">
        <img
          src="/images/splash/dressmart-splash-hero.webp"
          alt="DressMart — Fashion for Men & Kids"
          className="h-auto max-h-full w-auto max-w-full object-contain"
          // Only image on screen at boot — decode it eagerly rather than deferring to an idle frame.
          fetchPriority="high"
          decoding="sync"
        />
      </div>

      <div className="flex flex-col items-center gap-3 pb-10 pt-2 pb-safe">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/15 border-t-[#FF9800]"
          aria-hidden="true"
        />
        <p className="text-sm text-[#9CA3AF]">Loading your style...</p>
        <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 w-1/3 animate-splash-progress rounded-full bg-gradient-to-r from-[#FF9800] to-[#FF8A00]" />
        </div>
      </div>
    </div>
  );
}
