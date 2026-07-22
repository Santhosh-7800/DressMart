/** Shared swipe-to-navigate math for Framer Motion `onDragEnd` handlers (gallery, lightbox, carousels). */

export const SWIPE_CONFIDENCE_THRESHOLD = 10000;

export function swipePower(offset: number, velocity: number): number {
  return Math.abs(offset) * velocity;
}

export type SwipeDirection = 'left' | 'right' | null;

/** Positive offset/velocity (dragged right) resolves to 'right'; negative to 'left'. */
export function resolveSwipeDirection(offset: number, velocity: number): SwipeDirection {
  const power = swipePower(offset, velocity);
  if (power > SWIPE_CONFIDENCE_THRESHOLD || offset > 80) return 'right';
  if (power < -SWIPE_CONFIDENCE_THRESHOLD || offset < -80) return 'left';
  return null;
}
