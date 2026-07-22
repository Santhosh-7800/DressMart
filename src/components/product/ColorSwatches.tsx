import { cn } from '@/lib/utils';

interface ColorOption {
  name: string;
  hex: string;
}

interface ColorSwatchesProps {
  colors: ColorOption[];
  activeColor: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ colors, activeColor, onChange }: ColorSwatchesProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        Color: <span className="font-normal text-primary-500">{activeColor}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color.name}
            onClick={() => onChange(color.name)}
            title={color.name}
            className={cn(
              'h-9 w-9 rounded-full border-2 transition-transform hover:scale-110',
              activeColor === color.name ? 'border-accent' : 'border-transparent ring-1 ring-primary-200 dark:ring-primary-600',
            )}
            style={{ backgroundColor: color.hex }}
            aria-label={`Select color ${color.name}`}
          />
        ))}
      </div>
    </div>
  );
}
