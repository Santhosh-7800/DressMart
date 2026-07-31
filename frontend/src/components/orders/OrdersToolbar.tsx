import { Search } from 'lucide-react';
import type { OrderStatus } from '@/types';
import { Input } from '@/components/ui/Input';

export type DateFilter = 'all' | '30d' | '3m' | '6m' | 'year';
export type SortOrder = 'newest' | 'oldest';

const STATUS_FILTER_OPTIONS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'placed', label: 'Placed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
];

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: 'year', label: 'This Year' },
];

interface OrdersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: OrderStatus | 'all';
  onStatusFilterChange: (value: OrderStatus | 'all') => void;
  dateFilter: DateFilter;
  onDateFilterChange: (value: DateFilter) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
}

export function OrdersToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  sortOrder,
  onSortOrderChange,
}: OrdersToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="sm:max-w-xs sm:flex-1">
        <Input
          placeholder="Search by product name"
          leftIcon={<Search size={15} />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as OrderStatus | 'all')} className="input-field w-auto text-sm">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select value={dateFilter} onChange={(e) => onDateFilterChange(e.target.value as DateFilter)} className="input-field w-auto text-sm">
        {DATE_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select value={sortOrder} onChange={(e) => onSortOrderChange(e.target.value as SortOrder)} className="input-field w-auto text-sm">
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </div>
  );
}
