import { useEffect, useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { RotateCw } from 'lucide-react';

interface Product360ViewerProps {
  frames: string[];
  alt: string;
  className?: string;
}

const DRAG_PIXELS_PER_FRAME = 10;

export function Product360Viewer({ frames, alt, className }: Product360ViewerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dragStartIndex = useRef(0);

  useEffect(() => {
    setFrameIndex(0);
    setHasInteracted(false);
  }, [frames]);

  const handleDrag = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const deltaFrames = Math.round(info.offset.x / DRAG_PIXELS_PER_FRAME);
    const next = (((dragStartIndex.current + deltaFrames) % frames.length) + frames.length) % frames.length;
    setFrameIndex(next);
  };

  return (
    <div
      className={className ?? 'relative flex h-full w-full items-center justify-center'}
      onPointerDown={() => {
        dragStartIndex.current = frameIndex;
        setHasInteracted(true);
      }}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={handleDrag}
        className="h-full w-full touch-none select-none"
        style={{ cursor: 'grab' }}
        whileDrag={{ cursor: 'grabbing' }}
      >
        <img src={frames[frameIndex]} alt={alt} draggable={false} className="h-full w-full select-none object-cover" />
      </motion.div>
      {!hasInteracted && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary-950/70 px-3 py-1.5 text-xs text-white">
          <RotateCw size={13} /> Drag to rotate 360°
        </div>
      )}
    </div>
  );
}
