import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, RotateCcw, UserCog, Clock, Plus, KeyRound, Trash2, LogIn, PackagePlus, PencilLine } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatDateTime } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { staffAdminService } from '@/services/staffAdminService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, StaffActivityAction, StaffPermissionKey, StaffPermissions, StaffStatus } from '@/types';

const PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  add_products: 'Add Products',
  edit_products: 'Edit Products',
  delete_products: 'Delete Products',
  manage_inventory: 'Manage Inventory',
  upload_images: 'Upload Product Images',
  process_orders: 'Process Orders',
  update_order_status: 'Update Order Status',
  approve_returns: 'Approve Returns/Refunds',
  reply_to_customers: 'Reply to Customer Reviews',
  view_reports: 'View Reports',
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as StaffPermissionKey[];

function blankPermissions(): Record<StaffPermissionKey, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Record<StaffPermissionKey, boolean>;
}

function StaffStatusBadge({ status }: { status: StaffStatus | undefined }) {
  const isActive = status !== 'disabled';
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
        isActive ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      )}
    >
      {isActive ? 'active' : 'disabled'}
    </span>
  );
}

/** Checkbox grid shared by the Add Staff and Edit Permissions modals. */
function PermissionsGrid({ value, onChange }: { value: Record<StaffPermissionKey, boolean>; onChange: (next: Record<StaffPermissionKey, boolean>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {PERMISSION_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-primary-100 px-3 py-2 text-sm dark:border-primary-700">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          {PERMISSION_LABELS[key]}
        </label>
      ))}
    </div>
  );
}

function EditPermissionsModal({ staff, onClose }: { staff: Profile | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Record<StaffPermissionKey, boolean>>(blankPermissions());

  const permissionsQuery = useQuery({
    queryKey: queryKeys.staff.permissions(staff?.id ?? ''),
    queryFn: () => staffAdminService.getStaffPermissions(staff!.id),
    enabled: Boolean(staff),
  });

  useEffect(() => {
    if (permissionsQuery.data) {
      const next = blankPermissions();
      PERMISSION_KEYS.forEach((key) => {
        next[key] = Boolean((permissionsQuery.data as StaffPermissions)[key]);
      });
      setPermissions(next);
    } else if (staff) {
      setPermissions(blankPermissions());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsQuery.data, staff?.id]);

  const saveMutation = useMutation({
    mutationFn: (next: Record<StaffPermissionKey, boolean>) => staffAdminService.updateStaffPermissions(staff!.id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.permissions(staff!.id) });
      toast.success('Permissions updated');
      onClose();
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update permissions.')),
  });

  return (
    <Modal isOpen={Boolean(staff)} onClose={onClose} title={`Permissions — ${staff?.full_name ?? ''}`}>
      <div className="space-y-4">
        {permissionsQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <PermissionsGrid value={permissions} onChange={setPermissions} />
        )}
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button variant="account" fullWidth onClick={() => saveMutation.mutate(permissions)} isLoading={saveMutation.isPending}>
            Save Permissions
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Full staff roster for this store, with per-account actions. */
function RosterSection({ sellerId, onEditPermissions }: { sellerId: string; onEditPermissions: (staff: Profile) => void }) {
  const queryClient = useQueryClient();
  const [disableTarget, setDisableTarget] = useState<Profile | null>(null);
  const [disableReason, setDisableReason] = useState('');

  const staffQuery = useQuery({
    queryKey: queryKeys.staff.roster(sellerId),
    queryFn: () => staffAdminService.listStaff(sellerId),
    enabled: Boolean(sellerId),
  });

  const invalidateRoster = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.staff.roster(sellerId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.staff.activity(sellerId) });
  };

  const statusMutation = useMutation({
    mutationFn: ({ staffId, status, reason }: { staffId: string; status: StaffStatus; reason: string | null }) =>
      staffAdminService.setStaffStatus(staffId, status, reason),
    onSuccess: invalidateRoster,
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update this staff account.')),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: staffAdminService.resetStaffPassword,
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, "Could not reset this staff member's password.")),
  });

  const removeMutation = useMutation({
    mutationFn: staffAdminService.removeStaff,
    onSuccess: invalidateRoster,
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not remove this staff account.')),
  });

  const handleResetPassword = (staff: Profile) => {
    resetPasswordMutation.mutate(staff.id, { onSuccess: () => toast.success(`Password reset email sent to ${staff.email}`) });
  };

  const handleRemove = (staff: Profile) => {
    if (!confirm(`Permanently remove ${staff.full_name}? This deletes their login and cannot be undone.`)) return;
    removeMutation.mutate(staff.id, { onSuccess: () => toast.success(`${staff.full_name} removed`) });
  };

  const handleReactivate = (staff: Profile) => {
    statusMutation.mutate({ staffId: staff.id, status: 'active', reason: null }, { onSuccess: () => toast.success(`${staff.full_name} reactivated`) });
  };

  const handleDisable = () => {
    if (!disableTarget) return;
    if (!disableReason.trim()) {
      toast.error('Add a reason for the staff member.');
      return;
    }
    statusMutation.mutate(
      { staffId: disableTarget.id, status: 'disabled', reason: disableReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${disableTarget.full_name} disabled`);
          setDisableTarget(null);
          setDisableReason('');
        },
      },
    );
  };

  const staff = staffQuery.data ?? [];

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Staff Roster</h2>
      {staffQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" description="Staff you add will show up here." />
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <Card key={member.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{member.full_name}</p>
                  <StaffStatusBadge status={member.staff_status} />
                </div>
                <p className="text-sm text-acc-text-secondary">{member.email}{member.phone ? ` · ${member.phone}` : ''}</p>
                {member.staff_status === 'disabled' && member.staff_status_reason && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reason: {member.staff_status_reason}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onEditPermissions(member)}>
                  <UserCog size={15} /> Permissions
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(member)} isLoading={resetPasswordMutation.isPending}>
                  <KeyRound size={15} /> Reset Password
                </Button>
                {member.staff_status === 'disabled' ? (
                  <Button size="sm" variant="account" onClick={() => handleReactivate(member)} isLoading={statusMutation.isPending}>
                    <RotateCcw size={15} /> Enable
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setDisableTarget(member)}>
                    <Ban size={15} /> Disable
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => handleRemove(member)} isLoading={removeMutation.isPending}>
                  <Trash2 size={15} /> Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(disableTarget)} onClose={() => setDisableTarget(null)} title={`Disable ${disableTarget?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-acc-text-secondary">This immediately blocks the staff member from using the dashboard until re-enabled.</p>
          <Input floating label="Reason for disabling" value={disableReason} onChange={(e) => setDisableReason(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setDisableTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleDisable} isLoading={statusMutation.isPending}>
              Disable Staff
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

const BLANK_ADD_STAFF_FORM = { fullName: '', email: '', phone: '', designation: '', employeeId: '', department: '' };

function AddStaffButton({ sellerId }: { sellerId: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(BLANK_ADD_STAFF_FORM);
  const [permissions, setPermissions] = useState<Record<StaffPermissionKey, boolean>>(blankPermissions());

  const addMutation = useMutation({
    mutationFn: staffAdminService.addStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.roster(sellerId) });
      toast.success(`${form.fullName} added — a password setup email was sent to ${form.email}`);
      setIsOpen(false);
      setForm(BLANK_ADD_STAFF_FORM);
      setPermissions(blankPermissions());
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not add this staff member.')),
  });

  const handleSubmit = () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.designation.trim()) {
      toast.error('Full name, email, and designation are required.');
      return;
    }
    addMutation.mutate({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      designation: form.designation.trim(),
      employeeId: form.employeeId.trim() || undefined,
      department: form.department.trim() || undefined,
      permissions,
    });
  };

  return (
    <>
      <Button variant="account" onClick={() => setIsOpen(true)}>
        <Plus size={15} /> Add Staff
      </Button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Add Staff">
        <div className="space-y-4">
          <Input floating label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input floating label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input floating label="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Inventory Manager" />
          <Input floating label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input floating label="Employee ID (optional)" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
            <Input floating label="Department (optional)" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-primary-800 dark:text-primary-100">Permissions</p>
            <PermissionsGrid value={permissions} onChange={setPermissions} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={addMutation.isPending}>
              Add Staff
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const ACTIVITY_ICON: Record<StaffActivityAction, typeof LogIn> = {
  login: LogIn,
  product_created: PackagePlus,
  product_updated: PencilLine,
  product_deleted: Trash2,
};

const ACTIVITY_LABEL: Record<StaffActivityAction, string> = {
  login: 'logged in',
  product_created: 'added',
  product_updated: 'updated',
  product_deleted: 'deleted',
};

/** Most recent Add/Edit/Delete actions and logins across the whole staff roster. */
function ActivityLogSection({ sellerId }: { sellerId: string }) {
  const activityQuery = useQuery({
    queryKey: queryKeys.staff.activity(sellerId),
    queryFn: () => staffAdminService.listStaffActivity(sellerId),
    enabled: Boolean(sellerId),
  });

  const activity = activityQuery.data ?? [];

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Activity Logs</h2>
      {activityQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <EmptyState icon={Clock} title="No activity yet" description="Staff logins and product changes show up here." />
      ) : (
        <div className="space-y-2">
          {activity.map((entry) => {
            const Icon = ACTIVITY_ICON[entry.action];
            return (
              <Card key={entry.id} hover={false} className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500 dark:bg-primary-800">
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{entry.staff_name}</span> {ACTIVITY_LABEL[entry.action]}
                    {entry.target_label && <span className="text-primary-500"> · {entry.target_label}</span>}
                  </p>
                  <p className="text-xs text-primary-400">{formatDateTime(entry.created_at)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SellerStaffPage() {
  const { user } = useAuth();
  const sellerId = user?.id ?? '';
  const [permissionsTarget, setPermissionsTarget] = useState<Profile | null>(null);

  return (
    <div className="space-y-8">
      <Seo title="Staff Management" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Staff Management</h1>
        <AddStaffButton sellerId={sellerId} />
      </div>
      <RosterSection sellerId={sellerId} onEditPermissions={setPermissionsTarget} />
      <ActivityLogSection sellerId={sellerId} />
      <EditPermissionsModal staff={permissionsTarget} onClose={() => setPermissionsTarget(null)} />
    </div>
  );
}
