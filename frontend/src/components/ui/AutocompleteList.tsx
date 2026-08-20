import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutocompleteListProps<T> {
  items: T[];
  isLoading?: boolean;
  activeIndex: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onHover: (index: number) => void;
  emptyMessage?: string;
}

export function AutocompleteList<T>({ items, isLoading, activeIndex, getKey, renderItem, onSelect, onHover, emptyMessage }: AutocompleteListProps<T>) {
  if (!isLoading && items.length === 0 && !emptyMessage) return null;

  return (
    <div
      role="listbox"
      className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-52 overflow-y-auto rounded-xl border border-primary-200 bg-card p-1 shadow-popover dark:border-primary-600 dark:bg-card-dark"
    >
      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-primary-400">
          <Loader2 size={14} className="animate-spin" /> Searching…
        </div>
      )}
      {!isLoading && items.length === 0 && emptyMessage && <div className="px-3 py-2 text-sm text-primary-400">{emptyMessage}</div>}
      {!isLoading &&
        items.map((item, index) => (
          <button
            type="button"
            key={getKey(item)}
            role="option"
            aria-selected={index === activeIndex}
            // Prevents the field from blurring (and the dropdown closing) before the click registers.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
              index === activeIndex ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-300' : 'hover:bg-primary-100 dark:hover:bg-primary-700',
            )}
          >
            {renderItem(item)}
          </button>
        ))}
    </div>
  );
}
