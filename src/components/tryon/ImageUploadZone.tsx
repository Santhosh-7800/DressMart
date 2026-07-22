import { useRef } from 'react';
import { UploadCloud, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadZoneProps {
  isDragging: boolean;
  error: string | null;
  onFileSelect: (file: File | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}

export function ImageUploadZone({ isDragging, error, onFileSelect, onDrop, onDragOver, onDragLeave }: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={cn(
        'flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
        isDragging ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 bg-primary-50 hover:border-primary-300 dark:border-primary-600 dark:bg-primary-800',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm dark:bg-primary-700">
        <UploadCloud size={26} className="text-accent" />
      </div>
      <div>
        <p className="font-medium">Upload your photo</p>
        <p className="mt-1 text-sm text-primary-400">Drag &amp; drop or click to browse — JPG, PNG or WEBP, up to 8MB</p>
      </div>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      <div className="flex items-center gap-1.5 text-xs text-primary-400">
        <ImageIcon size={12} /> Full-length, front-facing photos work best
      </div>
    </div>
  );
}
