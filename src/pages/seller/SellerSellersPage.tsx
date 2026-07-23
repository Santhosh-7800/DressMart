import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X, Ban, RotateCcw, Store, Clock } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatDate } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { sellerAdminService } from '@/services/sellerAdminService';
import { isHeadSeller } from '@/lib/roles';
import type { SellerRequest, SellerStatus, Profile } from '@/types';

const STATUS_TABS: { key: SellerStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

const STATUS_BADGE_CLASSES: Record<SellerStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  suspended: 'bg-primary-100 text-primary-600 dark:bg-primary-800 dark:text-primary-300',
};

function StatusBadge({ status }: { status: SellerStatus }) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', STATUS_BADGE_CLASSES[status])}>{status}</span>;
}

/** Applications queue — seller_requests, filterable by status, with Approve/Reject on pending ones. */
function ApplicationsSection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SellerStatus>('pending');
  const [rejectTarget, setRejectTarget] = useState<SellerRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const requestsQuery = useQuery({
    queryKey: queryKeys.sellerRequests.all,
    queryFn: () => sellerAdminService.listSellerRequests(),
  });

  const reviewMutation = useMutation({
    mutationFn: sellerAdminService.reviewSellerRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seller.sellers });
      queryClient.invalidateQueries({ queryKey: queryKeys.seller.platformOverview });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update this application.'),
  });

  const filtered = useMemo(
    () => (requestsQuery.data ?? []).filter((r) => r.status === activeTab),
    [requestsQuery.data, activeTab],
  );

  const handleApprove = (request: SellerRequest) => {
    reviewMutation.mutate(
      { requestId: request.id, approve: true },
      { onSuccess: () => toast.success(`${request.store_name} approved`) },
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      toast.error('Add a reason for the applicant.');
      return;
    }
    reviewMutation.mutate(
      { requestId: rejectTarget.id, approve: false, rejectionReason: rejectionReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${rejectTarget.store_name} rejected`);
          setRejectTarget(null);
          setRejectionReason('');
        },
      },
    );
  };

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Seller Applications</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-acc-primary text-white'
                : 'bg-white text-acc-text-secondary hover:bg-acc-primary/10 dark:bg-card-dark dark:text-primary-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Clock} title={`No ${activeTab} applications`} description="Applications will show up here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <Card key={request.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{request.store_name}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="text-sm text-acc-text-secondary">
                  {request.full_name} · {request.email} · {request.phone}
                </p>
                <p className="text-xs text-acc-text-secondary">GST: {request.gst_number || '—'} · Applied {formatDate(request.applied_at)}</p>
                {request.status === 'rejected' && request.rejection_reason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reason: {request.rejection_reason}</p>
                )}
              </div>
              {request.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="account" onClick={() => handleApprove(request)} isLoading={reviewMutation.isPending}>
                    <Check size={15} /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectTarget(request)}>
                    <X size={15} /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title={`Reject ${rejectTarget?.store_name ?? ''}`}>
        <div className="space-y-4">
          <Input
            floating
            label="Reason for rejection"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleReject} isLoading={reviewMutation.isPending}>
              Reject Application
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

/** Full seller roster (users where role in ['seller','head_seller']) with a suspend/reactivate action. */
function RosterSection() {
  const queryClient = useQueryClient();
  const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const sellersQuery = useQuery({
    queryKey: queryKeys.seller.sellers,
    queryFn: () => sellerAdminService.listSellers(),
  });

  const suspendMutation = useMutation({
    mutationFn: sellerAdminService.suspendSellerAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seller.sellers });
      queryClient.invalidateQueries({ queryKey: queryKeys.seller.platformOverview });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update this seller.'),
  });

  const handleReactivate = (seller: Profile) => {
    suspendMutation.mutate(
      { sellerId: seller.id, reason: '', suspend: false },
      { onSuccess: () => toast.success(`${seller.store_name || seller.full_name} reactivated`) },
    );
  };

  const handleSuspend = () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      toast.error('Add a reason for the seller.');
      return;
    }
    suspendMutation.mutate(
      { sellerId: suspendTarget.id, reason: suspendReason.trim(), suspend: true },
      {
        onSuccess: () => {
          toast.success(`${suspendTarget.store_name || suspendTarget.full_name} suspended`);
          setSuspendTarget(null);
          setSuspendReason('');
        },
      },
    );
  };

  const sellers = (sellersQuery.data ?? []).filter((s) => !isHeadSeller(s.role));

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Seller Roster</h2>
      {sellersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <EmptyState icon={Store} title="No sellers yet" description="Approved sellers will show up here." />
      ) : (
        <div className="space-y-3">
          {sellers.map((seller) => (
            <Card key={seller.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{seller.store_name || seller.full_name}</p>
                  {seller.seller_status && <StatusBadge status={seller.seller_status} />}
                </div>
                <p className="text-sm text-acc-text-secondary">{seller.full_name} · {seller.email}</p>
                {seller.seller_status === 'suspended' && seller.seller_status_reason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reason: {seller.seller_status_reason}</p>
                )}
              </div>
              <div className="shrink-0">
                {seller.seller_status === 'suspended' ? (
                  <Button size="sm" variant="account" onClick={() => handleReactivate(seller)} isLoading={suspendMutation.isPending}>
                    <RotateCcw size={15} /> Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setSuspendTarget(seller)}>
                    <Ban size={15} /> Suspend
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} title={`Suspend ${suspendTarget?.store_name ?? suspendTarget?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-acc-text-secondary">This immediately blocks the seller from using the dashboard until reactivated.</p>
          <Input floating label="Reason for suspension" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleSuspend} isLoading={suspendMutation.isPending}>
              Suspend Seller
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

export function SellerSellersPage() {
  return (
    <div className="space-y-8">
      <Seo title="Manage Sellers" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Sellers</h1>
      <ApplicationsSection />
      <RosterSection />
    </div>
  );
}
