import { LogIn, PackagePlus, PencilLine, Trash2, Truck, RotateCcw, Repeat, Boxes, type LucideIcon } from 'lucide-react';
import type { StaffActivityAction } from '@/types';

/** Shared icon/label for every StaffActivityAction — used by both the Staff Dashboard's inline
 *  activity preview and the full My Activity page, so the two never drift out of sync. */
export const ACTIVITY_ICON: Record<StaffActivityAction, LucideIcon> = {
  login: LogIn,
  product_created: PackagePlus,
  product_updated: PencilLine,
  product_deleted: Trash2,
  order_status_updated: Truck,
  return_processed: RotateCcw,
  exchange_processed: Repeat,
  inventory_updated: Boxes,
};

export const ACTIVITY_LABEL: Record<StaffActivityAction, string> = {
  login: 'Logged in',
  product_created: 'Added',
  product_updated: 'Updated',
  product_deleted: 'Deleted',
  order_status_updated: 'Updated order',
  return_processed: 'Processed return',
  exchange_processed: 'Processed exchange',
  inventory_updated: 'Updated stock for',
};
