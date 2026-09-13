import { X } from 'lucide-react';
import { useBackButtonDismiss } from '@/hooks/useBackButtonDismiss';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The mobile (lg:hidden) slide-in filter panel shared by ProductListingPage, SearchResultsPage,
 * and VisualSearchResultsPage — previously each page hand-rolled its own `fixed inset-0` overlay,
 * none of which handled the Android hardware back button, so pressing Back while the drawer was
 * open would navigate away from (or exit past) the underlying listing page instead of just
 * closing the drawer. Centralizing it here means every consumer gets that fixed once.
 */
export function MobileFilterDrawer({ isOpen, onClose, children }: MobileFilterDrawerProps) {
  useBackButtonDismiss(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="absolute inset-0 bg-primary-950/50" onClick={onClose} />
      <div className="relative ml-auto h-full w-[85%] max-w-sm space-y-4 overflow-y-auto bg-surface p-4 dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Filters</h3>
          <button onClick={onClose} aria-label="Close filters" className="tap-target-48">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
