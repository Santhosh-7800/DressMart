import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Zap } from 'lucide-react';
import { useCategories } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';

function GenderMenu({ gender, label }: { gender: 'men' | 'kids'; label: string }) {
  const { data: categories } = useCategories(gender);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <Link to={`/${gender}`} className="flex items-center gap-1 px-3 py-2.5 text-sm font-medium hover:text-accent">
        {label}
        <ChevronDown size={14} />
      </Link>
      <div
        className={cn(
          'absolute left-0 top-full z-30 grid w-[560px] grid-cols-3 gap-x-4 gap-y-1 rounded-2xl bg-card p-5 shadow-popover transition-all dark:bg-card-dark',
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
        )}
      >
        {(categories ?? []).map((category) => (
          <Link
            key={category.id}
            to={`/${gender}/${category.slug}`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-primary-600 hover:bg-primary-50 hover:text-primary-900 dark:text-primary-200 dark:hover:bg-primary-800 dark:hover:text-white"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CategoryNav() {
  return (
    <nav className="hidden items-center border-t border-primary-100 lg:flex dark:border-primary-700">
      <GenderMenu gender="men" label="Men" />
      <GenderMenu gender="kids" label="Kids" />
      <Link to="/flash-sales" className="flex items-center gap-1 px-3 py-2.5 text-sm font-semibold text-red-500 hover:text-red-600">
        <Zap size={14} className="fill-red-500" /> Flash Sale
      </Link>
      <Link to="/deals" className="px-3 py-2.5 text-sm font-medium text-accent-600 hover:text-accent-700">
        Deals of the Day
      </Link>
      <Link to="/new-arrivals" className="px-3 py-2.5 text-sm font-medium hover:text-accent">
        New Arrivals
      </Link>
      <Link to="/best-sellers" className="px-3 py-2.5 text-sm font-medium hover:text-accent">
        Best Sellers
      </Link>
    </nav>
  );
}
