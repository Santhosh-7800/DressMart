import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, CheckCircle2, Box, Truck, MapPin, Home, XCircle, Copy, Check, Phone, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Order, OrderStatus } from '@/types';
import { formatDate, formatDateTime, cn } from '@/lib/utils';

interface OrderTrackingTimelineProps {
  order: Order;
}

const HAPPY_PATH_STEPS: { status: OrderStatus; label: string; icon: typeof Package }[] = [
  { status: 'placed', label: 'Placed', icon: Package },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'packed', label: 'Packed', icon: Box },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { status: 'delivered', label: 'Delivered', icon: Home },
];

function daysUntil(dateIso: string): number {
  const diffMs = new Date(dateIso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function deliveryEta(order: Order, isDelivered: boolean): string {
  if (isDelivered) return `Delivered on ${formatDate(order.estimated_delivery)}`;
  const days = daysUntil(order.estimated_delivery);
  if (days > 1) return `Arriving in ${days} days`;
  if (days === 1) return 'Arriving tomorrow';
  if (days === 0) return 'Arriving today';
  return 'Delivery running behind schedule';
}

export function OrderTrackingTimeline({ order }: OrderTrackingTimelineProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyTracking = async () => {
    if (!order.tracking_number) return;
    await navigator.clipboard.writeText(order.tracking_number);
    setIsCopied(true);
    toast.success('Tracking number copied');
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (order.status === 'cancelled') {
    const cancelledEvent = order.timeline.find((e) => e.status === 'cancelled');
    return (
      <div className="rounded-xl bg-red-50 p-4 dark:bg-red-900/20">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle size={20} />
          <p className="font-semibold">Order Cancelled</p>
        </div>
        {cancelledEvent && (
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">
            {formatDateTime(cancelledEvent.timestamp)}
            {cancelledEvent.note ? ` — ${cancelledEvent.note}` : ''}
          </p>
        )}
      </div>
    );
  }

  const effectiveStatus = order.status === 'returned' ? 'delivered' : order.status;
  const currentIndex = Math.max(
    HAPPY_PATH_STEPS.findIndex((s) => s.status === effectiveStatus),
    0,
  );
  const progressPercent = (currentIndex / (HAPPY_PATH_STEPS.length - 1)) * 100;
  const isDelivered = order.status === 'delivered' || order.status === 'returned';
  const timestampFor = (status: OrderStatus) => order.timeline.find((e) => e.status === status)?.timestamp;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-primary-50 p-4 dark:bg-primary-800">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-400">
            <Clock size={12} /> {isDelivered ? 'Delivered On' : 'Estimated Delivery'}
          </p>
          <p className="mt-1 text-lg font-bold">{formatDate(order.estimated_delivery)}</p>
          <p className="mt-0.5 text-xs font-medium text-accent-600">{deliveryEta(order, isDelivered)}</p>
        </div>

        <div className="rounded-xl bg-primary-50 p-4 dark:bg-primary-800">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-400">Courier</p>
          <p className="mt-1 text-sm font-semibold">{order.courier_name ?? 'Will be assigned once packed'}</p>
          {order.tracking_number && (
            <button onClick={handleCopyTracking} className="mt-1 flex items-center gap-1 text-xs text-accent-600 hover:underline">
              {isCopied ? <Check size={11} /> : <Copy size={11} />}
              {order.tracking_number}
            </button>
          )}
          {order.courier_phone && (
            <p className="mt-1 flex items-center gap-1 text-xs text-primary-400">
              <Phone size={11} /> {order.courier_phone}
            </p>
          )}
        </div>
      </div>

      {/* Desktop / tablet: horizontal animated stepper */}
      <div className="hidden sm:block">
        <div className="relative pt-4">
          <div className="absolute left-[8%] right-[8%] top-8 h-1 rounded-full bg-primary-100 dark:bg-primary-700" />
          <div className="absolute left-[8%] right-[8%] top-8 h-1 overflow-hidden rounded-full">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
          <div className="relative grid grid-cols-6">
            {HAPPY_PATH_STEPS.map((step, idx) => {
              const isComplete = idx <= currentIndex;
              const isCurrent = idx === currentIndex && !isDelivered;
              const Icon = step.icon;
              const ts = timestampFor(step.status);
              return (
                <div key={step.status} className="flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card dark:bg-card-dark',
                      isComplete ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-primary-200 text-primary-300 dark:border-primary-600',
                      isCurrent && 'animate-pulse ring-4 ring-emerald-100 dark:ring-emerald-900/30',
                    )}
                  >
                    <Icon size={15} />
                  </motion.div>
                  <p className={cn('mt-2 px-1 text-xs font-medium', isComplete ? 'text-primary-900 dark:text-white' : 'text-primary-300')}>{step.label}</p>
                  {ts && <p className="text-[10px] text-primary-400">{formatDate(ts)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: vertical animated stepper */}
      <div className="sm:hidden">
        {HAPPY_PATH_STEPS.map((step, idx) => {
          const isComplete = idx <= currentIndex;
          const isCurrent = idx === currentIndex && !isDelivered;
          const isLast = idx === HAPPY_PATH_STEPS.length - 1;
          const isSegmentFilled = idx < currentIndex;
          const Icon = step.icon;
          const ts = timestampFor(step.status);
          return (
            <div key={step.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-card dark:bg-card-dark',
                    isComplete ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-primary-200 text-primary-300 dark:border-primary-600',
                    isCurrent && 'animate-pulse ring-4 ring-emerald-100 dark:ring-emerald-900/30',
                  )}
                >
                  <Icon size={13} />
                </div>
                {!isLast && (
                  <div className="relative my-1 w-0.5 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-700" style={{ minHeight: '2rem' }}>
                    <motion.div
                      className="absolute inset-x-0 top-0 bg-emerald-500"
                      initial={{ height: 0 }}
                      animate={{ height: isSegmentFilled ? '100%' : '0%' }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                    />
                  </div>
                )}
              </div>
              <div className={cn('pb-7', isLast && 'pb-0')}>
                <p className={cn('text-sm font-medium', isComplete ? 'text-primary-900 dark:text-white' : 'text-primary-300')}>{step.label}</p>
                {ts && <p className="text-xs text-primary-400">{formatDateTime(ts)}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
