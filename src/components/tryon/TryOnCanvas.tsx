import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { cn } from '@/lib/utils';

export interface TryOnTransform {
  /** px offset from center */
  x: number;
  y: number;
  scale: number;
  /** degrees */
  rotation: number;
  opacity: number;
}

export interface TryOnCanvasHandle {
  download: () => void;
}

interface TryOnCanvasProps {
  photoUrl: string | null;
  isDragging: boolean;
  uploadError: string | null;
  onFileSelect: (file: File | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  garmentUrl: string;
  garmentAlt: string;
  transform: TryOnTransform;
  onTransformChange: (next: TryOnTransform) => void;
}

/** The garment overlay renders at this fraction of the container width when scale=1. */
const GARMENT_BASE_WIDTH_RATIO = 0.5;

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export const TryOnCanvas = forwardRef<TryOnCanvasHandle, TryOnCanvasProps>(function TryOnCanvas(
  { photoUrl, isDragging, uploadError, onFileSelect, onDrop, onDragOver, onDragLeave, garmentUrl, garmentAlt, transform, onTransformChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);
  const garmentImgRef = useRef<HTMLImageElement>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const dragStart = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      e.preventDefault();
      setIsPointerDown(true);
      dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, originX: transform.x, originY: transform.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [transform.x, transform.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (!isPointerDown || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.pointerX;
      const dy = e.clientY - dragStart.current.pointerY;
      onTransformChange({ ...transform, x: dragStart.current.originX + dx, y: dragStart.current.originY + dy });
    },
    [isPointerDown, onTransformChange, transform],
  );

  const handlePointerUp = useCallback(() => {
    setIsPointerDown(false);
    dragStart.current = null;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      download: () => {
        const container = containerRef.current;
        const photoImg = photoImgRef.current;
        const garmentImg = garmentImgRef.current;
        if (!container || !photoImg || !garmentImg || !photoImg.complete || !garmentImg.complete) return;

        const EXPORT_WIDTH = 900;
        const rect = container.getBoundingClientRect();
        const exportHeight = Math.round((rect.height / rect.width) * EXPORT_WIDTH);

        const canvas = document.createElement('canvas');
        canvas.width = EXPORT_WIDTH;
        canvas.height = exportHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        drawCover(ctx, photoImg, 0, 0, EXPORT_WIDTH, exportHeight);

        const scaleFactor = EXPORT_WIDTH / rect.width;
        const garmentWidth = rect.width * GARMENT_BASE_WIDTH_RATIO * transform.scale * scaleFactor;
        const garmentHeight = garmentWidth * (garmentImg.naturalHeight / garmentImg.naturalWidth);
        const centerX = EXPORT_WIDTH / 2 + transform.x * scaleFactor;
        const centerY = exportHeight / 2 + transform.y * scaleFactor;

        ctx.save();
        ctx.globalAlpha = transform.opacity;
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.drawImage(garmentImg, -garmentWidth / 2, -garmentHeight / 2, garmentWidth, garmentHeight);
        ctx.restore();

        const link = document.createElement('a');
        link.download = 'dressmart-try-on.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    }),
    [transform],
  );

  if (!photoUrl) {
    return (
      <ImageUploadZone isDragging={isDragging} error={uploadError} onFileSelect={onFileSelect} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} />
    );
  }

  return (
    <div ref={containerRef} className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-primary-100 dark:bg-primary-800">
      <img ref={photoImgRef} src={photoUrl} alt="Your uploaded photo" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <img
        ref={garmentImgRef}
        src={garmentUrl}
        alt={garmentAlt}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn('absolute left-1/2 top-1/2 w-1/2 touch-none cursor-grab select-none drop-shadow-xl active:cursor-grabbing')}
        style={{
          transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.scale})`,
          opacity: transform.opacity,
        }}
        draggable={false}
      />
    </div>
  );
});
