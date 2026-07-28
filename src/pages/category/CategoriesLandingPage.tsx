import { useState } from 'react';
import type { Gender } from '@/types';
import { cn } from '@/lib/utils';
import { CategoryOverviewPage } from './CategoryOverviewPage';

const TABS: { gender: Gender; label: string; title: string }[] = [
  { gender: 'men', label: 'Men', title: "Men's Wear" },
  { gender: 'kids', label: 'Kids', title: "Kids' Wear" },
];

/**
 * The bottom nav's Categories tab needs one landing spot, but the catalog is split by gender
 * (Men/Kids each with their own routes, category grid, carousels) — this puts a segmented switcher
 * on top of the existing per-gender CategoryOverviewPage instead of building a second, parallel
 * "everything at once" page. `/men` and `/kids` themselves are untouched and still reachable
 * directly (CategoryNav, MobileMenu, deep links) — this is purely a new combined entry point.
 */
export function CategoriesLandingPage() {
  const [gender, setGender] = useState<Gender>('men');
  const active = TABS.find((t) => t.gender === gender) ?? TABS[0];

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-primary-100 bg-surface dark:border-primary-700 dark:bg-surface-dark">
        <div className="container-app flex gap-2 py-3">
          {TABS.map((tab) => (
            <button
              key={tab.gender}
              onClick={() => setGender(tab.gender)}
              className={cn(
                'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors',
                tab.gender === gender
                  ? 'bg-primary text-white'
                  : 'bg-primary-50 text-primary-600 dark:bg-primary-800 dark:text-primary-200',
              )}
              aria-current={tab.gender === gender ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <CategoryOverviewPage key={active.gender} gender={active.gender} title={active.title} />
    </div>
  );
}
