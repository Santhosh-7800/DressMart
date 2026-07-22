import { RotateCcw, Download, Move } from 'lucide-react';

interface TryOnControlsProps {
  scale: number;
  rotation: number;
  opacity: number;
  onScaleChange: (value: number) => void;
  onRotationChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  onReset: () => void;
  onDownload: () => void;
}

export function TryOnControls({ scale, rotation, opacity, onScaleChange, onRotationChange, onOpacityChange, onReset, onDownload }: TryOnControlsProps) {
  return (
    <div className="card-surface space-y-4 p-4">
      <p className="flex items-center gap-1.5 text-xs text-primary-400">
        <Move size={13} /> Drag the garment on your photo to reposition it
      </p>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium">Size</span>
          <span className="text-primary-400">{Math.round(scale * 100)}%</span>
        </div>
        <input
          type="range"
          min={50}
          max={180}
          value={Math.round(scale * 100)}
          onChange={(e) => onScaleChange(Number(e.target.value) / 100)}
          className="w-full accent-accent"
        />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium">Rotate</span>
          <span className="text-primary-400">{rotation}°</span>
        </div>
        <input type="range" min={-45} max={45} value={rotation} onChange={(e) => onRotationChange(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium">Blend</span>
          <span className="text-primary-400">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={30}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onReset} className="btn-outline flex-1 !py-2 text-sm">
          <RotateCcw size={14} /> Reset
        </button>
        <button onClick={onDownload} className="btn-accent flex-1 !py-2 text-sm">
          <Download size={14} /> Save Preview
        </button>
      </div>
    </div>
  );
}
