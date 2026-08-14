import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PromoSlide {
  /** Stable, unique key — also used as the React list/animation key. */
  id: string;
  /** Small uppercase kicker, e.g. "Featured". Unused when `flat` is true. */
  label: string;
  /** Always used for the sr-only live-region announcement and indicator aria-labels, even when
   *  `flat` is true and the title isn't visually rendered. */
  title: string;
  subtitle: string;
  /** Rendered next to an arrow icon, e.g. "Shop Kids" renders as "Shop Kids →". Unused when `flat`
   *  is true. */
  ctaLabel: string;
  /** Route within the app (react-router `to`) — never an external URL. */
  href: string;
  /** Background photo. Null falls back to the same dark gradient used elsewhere (e.g. BannerSlider)
   *  so a slide can ship before its photo asset exists. */
  image: string | null;
  imageAlt: string;
  /** Tailwind `object-*` position class for the background image. Defaults to `object-top`. */
  imagePosition?: string;
  /** True for a pre-designed graphic that already has its own text/CTA baked into the image (e.g.
   *  a seller-supplied sale banner) — skips the component's own label/heading/subtitle/CTA/gradient
   *  overlay so nothing doubles up, and makes the whole slide a single link to `href` instead. */
  flat?: boolean;
}

const AUTO_ROTATE_MS = 6000;
const SWIPE_THRESHOLD_PX = 50;

interface PromotionalCarouselProps {
  slides: PromoSlide[];
  ariaLabel?: string;
}

/** Reusable promotional/marketing carousel — content-agnostic; pass a `slides` config for any
 *  campaign. Mirrors the visual language already established by the homepage's Firestore-driven
 *  BannerSlider (same gradient overlay, chevrons, pill/dot indicators) but reads from a static
 *  config array instead, since campaign slides here aren't seller-managed CMS content. */
export function PromotionalCarousel({ slides, ariaLabel = 'Featured promotions' }: PromotionalCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isPaused || prefersReducedMotion || slides.length <= 1) return undefined;
    timerRef.current = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // `index` is deliberately excluded — it would restart the interval on every auto-advance too,
    // when it only needs to reset on a *manual* interaction (see goTo below).
  }, [isPaused, prefersReducedMotion, slides.length]);

  if (slides.length === 0) return null;

  /** Any manual navigation (chevrons, indicators, swipe) resets the auto-rotate countdown rather
   *  than permanently pausing it, per the "pause/reset on interaction" requirement. */
  const goTo = (next: number) => {
    setDirection(next > index || (index === slides.length - 1 && next === 0) ? 1 : -1);
    setIndex(((next % slides.length) + slides.length) % slides.length);
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused && !prefersReducedMotion && slides.length > 1) {
      timerRef.current = setInterval(() => {
        setDirection(1);
        setIndex((i) => (i + 1) % slides.length);
      }, AUTO_ROTATE_MS);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (delta < -SWIPE_THRESHOLD_PX) goTo(index + 1);
    else if (delta > SWIPE_THRESHOLD_PX) goTo(index - 1);
  };

  const slide = slides[index];

  return (
    <section
      className="container-app py-6"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative h-[220px] w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1F2937] to-[#111827] text-white shadow-card sm:h-[300px] lg:h-[440px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <span className="sr-only" aria-live="polite">
          {slide.title}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -direction * 40 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.5, ease: 'easeOut' }}
            className={cn('absolute inset-0', slide.flat && 'bg-accent-400')}
          >
            {slide.image && (
              <img
                src={slide.image}
                alt={slide.imageAlt}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                // A flat slide is a pre-designed graphic with its own fixed text layout — cropping
                // it via object-cover risks cutting off words on a container whose aspect ratio
                // doesn't match the source image (e.g. the short mobile banner height vs a wide
                // graphic). object-contain always shows the whole design instead, letterboxed
                // against the matching accent background set above.
                className={cn(
                  'absolute inset-0 h-full w-full',
                  slide.flat ? 'object-contain' : cn('object-cover', slide.imagePosition ?? 'object-top'),
                )}
              />
            )}

            {slide.flat ? (
              // The image already carries its own text/CTA — the whole slide is just one link.
              <Link to={slide.href} className="absolute inset-0" aria-label={slide.title} />
            ) : (
              <>
                {/* Dark gradient overlay, strongest on the left where the text sits — same
                    treatment as the homepage's BannerSlider. */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/90 via-[#111827]/55 to-transparent" />

                <div className="relative flex h-full max-w-lg flex-col items-start justify-center gap-2 p-5 sm:gap-3 sm:p-8 lg:gap-4 lg:p-14">
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-accent sm:w-6" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-accent-400 sm:text-xs">{slide.label}</span>
                  </div>
                  <h2 className="text-left text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-5xl">{slide.title}</h2>
                  <p className="max-w-sm text-left text-xs text-white/80 sm:text-sm lg:text-base">{slide.subtitle}</p>
                  <Link to={slide.href} className="btn-accent mt-1 sm:mt-3">
                    {slide.ctaLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <>
            {/* Hidden below `sm` — on the compact mobile banner height the text block runs the full
                height, so a vertically-centered chevron there would sit on top of the label/heading
                text. Swipe + the indicator dots cover navigation on touch screens instead. */}
            <button
              onClick={() => goTo(index - 1)}
              className="absolute left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20 sm:flex"
              aria-label="Previous promotion"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => goTo(index + 1)}
              className="absolute right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20 sm:flex"
              aria-label="Next promotion"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  aria-label={`Go to promotion ${i + 1}: ${s.title}`}
                  aria-current={i === index}
                  className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'w-6 bg-accent' : 'w-1.5 bg-white/40 hover:bg-white/60')}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
