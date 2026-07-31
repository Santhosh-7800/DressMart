import { cn } from '@/lib/utils';

export interface ColorOption {
  name: string;
  hex: string;
  image?: string;
}

interface ColorSwatchesProps {
  colors: ColorOption[];
  activeColor: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ colors, activeColor, onChange }: ColorSwatchesProps) {
  return (
    <div>
      <p className="mb-2.5 text-sm font-medium text-primary-700 dark:text-primary-300">
        Colour: <span className="font-bold uppercase text-primary-900 dark:text-white">{activeColor}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isActive = activeColor === color.name;
          if (color.image) {
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => onChange(color.name)}
                title={color.name}
                className={cn(
                  'group relative h-14 w-12 overflow-hidden rounded-xl border-2 bg-primary-50 transition-all focus:outline-none dark:bg-primary-800',
                  isActive
                    ? 'border-blue-600 ring-2 ring-blue-600/30 dark:border-blue-400'
                    : 'border-primary-200 opacity-80 hover:opacity-100 hover:border-primary-400 dark:border-primary-700',
                )}
                aria-label={`Select colour ${color.name}`}
              >
                <img src={color.image} alt={color.name} className="h-full w-full object-cover" />
              </button>
            );
          }
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onChange(color.name)}
              title={color.name}
              className={cn(
                'h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none',
                isActive ? 'border-blue-600 ring-2 ring-blue-600/30 dark:border-blue-400' : 'border-transparent ring-1 ring-primary-200 dark:ring-primary-600',
              )}
              style={{ backgroundColor: color.hex }}
              aria-label={`Select colour ${color.name}`}
            />
          );
        })}
      </div>
    </div>
  );
}

