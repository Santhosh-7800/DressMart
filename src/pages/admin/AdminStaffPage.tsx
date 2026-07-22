import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserCog, Plus, Trash2, Search, Ban, CheckCircle2, KeyRound, PackageSearch, Pencil, Eye } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { adminDataService } from '@/services/adminDataService';
import { adminStaffService } from '@/services/adminStaffService';
import { staffService } from '@/services/staffService';
import { authService } from '@/services/authService';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/utils';
import type { StaffMember, UserRole } from '@/types';

const ROLE_BADGE: Record<UserRole, string> = {
  customer: 'badge-accent',
  staff: 'badge-accent',
  admin: 'badge-success',
  shop_owner: 'badge-success',
};

export function AdminStaffPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      const all = await adminDataService.getAllProfiles();
      return staffService.listAllWithDetails(all as StaffMember[]);
    },
  });

  const invalidateStaff = () => queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const setRole = useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) => adminStaffService.setRoleByEmail(email, role),
    onSuccess: () => {
      invalidateStaff();
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success('Role updated');
      setIsModalOpen(false);
      setEmail('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRole = useMutation({
    mutationFn: (userId: string) => adminStaffService.removeRole(userId),
    onSuccess: () => {
      invalidateStaff();
      toast.success('Removed from staff');
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ staffId, status }: { staffId: string; status: 'active' | 'inactive' }) => staffService.setStatus(staffId, status),
    onSuccess: (_r, { status }) => {
      invalidateStaff();
      toast.success(status === 'active' ? 'Staff account activated' : 'Staff account deactivated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetPassword = useMutation({
    mutationFn: ({ email: staffEmail, newPassword }: { email: string; newPassword: string }) => staffService.resetPassword(staffEmail, newPassword),
    onSuccess: ({ mode }) => {
      toast.success(mode === 'direct' ? 'Password reset' : 'Password reset email sent');
      setResetTarget(null);
      setNewPassword('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editName = useMutation({
    mutationFn: ({ staffId, fullName }: { staffId: string; fullName: string }) => authService.updateProfile(staffId, { full_name: fullName }),
    onSuccess: () => {
      invalidateStaff();
      toast.success('Name updated');
      setEditNameTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole_] = useState<UserRole>('staff');
  const [search, setSearch] = useState('');
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [viewTarget, setViewTarget] = useState<StaffMember | null>(null);
  const [editNameTarget, setEditNameTarget] = useState<StaffMember | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const q = search.trim().toLowerCase();
  const staff = (profiles ?? [])
    .filter((p) => p.role !== 'customer')
    .filter(
      (p) =>
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.employee_id ?? '').toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q),
    );

  return (
    <div>
      <Seo title="Admin — Staff" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Staff</h1>
        </div>
        <Button variant="accent" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Add Staff
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by name, email, employee ID, or department" leftIcon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Department</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Since</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3 text-primary-500">{s.email}</td>
                  <td className="p-3 text-primary-500">{s.role === 'staff' ? s.employee_id || '—' : '—'}</td>
                  <td className="p-3 text-primary-500">{s.role === 'staff' ? s.department || '—' : '—'}</td>
                  <td className="p-3">
                    <span className={ROLE_BADGE[s.role]}>{s.role.replace('_', ' ')}</span>
                  </td>
                  <td className="p-3">
                    {s.role === 'staff' ? (
                      <span className={s.status === 'inactive' ? 'badge-danger' : 'badge-success'}>{s.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-primary-400">{formatDate(s.updated_at)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {s.role === 'staff' && (
                        <>
                          <button onClick={() => setViewTarget(s)} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="View profile">
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditNameTarget(s);
                              setEditNameValue(s.full_name);
                            }}
                            className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                            title="Edit name"
                          >
                            <Pencil size={15} />
                          </button>
                          <Link to={`/admin/staff-products?staffId=${s.id}`} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="View products">
                            <PackageSearch size={15} />
                          </Link>
                          <button
                            onClick={() => setResetTarget(s)}
                            className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                            title="Reset password"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() => toggleStatus.mutate({ staffId: s.id, status: s.status === 'inactive' ? 'active' : 'inactive' })}
                            className={s.status === 'inactive' ? 'rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50' : 'rounded-lg p-1.5 text-amber-600 hover:bg-amber-50'}
                            title={s.status === 'inactive' ? 'Activate' : 'Deactivate'}
                          >
                            {s.status === 'inactive' ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                          </button>
                        </>
                      )}
                      {s.id !== currentUser?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${s.full_name} from staff (revert to customer)?`)) removeRole.mutate(s.id);
                          }}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remove"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-primary-400">
                    No staff accounts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Staff Member">
        <div className="space-y-3">
          <p className="text-sm text-primary-500">Enter the email of an existing DressMart account to grant it backend access.</p>
          <Input label="Email" name="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
          <div>
            <p className="mb-1.5 text-sm font-medium">Role</p>
            <select className="input-field" value={role} onChange={(e) => setRole_(e.target.value as UserRole)}>
              <option value="staff">Staff (in-shop product management)</option>
              <option value="shop_owner">Shop Owner (full backend access)</option>
              <option value="admin">Admin (full backend access)</option>
            </select>
          </div>
          <Button variant="accent" fullWidth onClick={() => setRole.mutate({ email, role })} isLoading={setRole.isPending}>
            Grant Access
          </Button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(resetTarget)} onClose={() => setResetTarget(null)} title="Reset Password">
        <div className="space-y-3">
          {env.useMockData ? (
            <>
              <p className="text-sm text-primary-500">
                Set a new password for <span className="font-medium">{resetTarget?.full_name}</span> ({resetTarget?.email}).
              </p>
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              <Button
                variant="accent"
                fullWidth
                isLoading={resetPassword.isPending}
                onClick={() => {
                  if (newPassword.length < 8) {
                    toast.error('Password must be at least 8 characters');
                    return;
                  }
                  resetPassword.mutate({ email: resetTarget!.email, newPassword });
                }}
              >
                Reset Password
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-primary-500">
                This will send a password-reset email to <span className="font-medium">{resetTarget?.email}</span>. DressMart can't set another
                account's password directly for security reasons.
              </p>
              <Button variant="accent" fullWidth isLoading={resetPassword.isPending} onClick={() => resetPassword.mutate({ email: resetTarget!.email, newPassword: '' })}>
                Send Reset Email
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={Boolean(viewTarget)} onClose={() => setViewTarget(null)} title="Staff Profile">
        {viewTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-xl font-bold text-white">
                {viewTarget.avatar_url ? <img src={viewTarget.avatar_url} alt={viewTarget.full_name} className="h-full w-full object-cover" /> : viewTarget.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{viewTarget.full_name}</p>
                <p className="text-sm text-primary-500">{viewTarget.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-primary-400">Employee ID</dt>
                <dd className="font-medium">{viewTarget.employee_id || '—'}</dd>
              </div>
              <div>
                <dt className="text-primary-400">Phone</dt>
                <dd className="font-medium">{viewTarget.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-primary-400">Department</dt>
                <dd className="font-medium">{viewTarget.department || '—'}</dd>
              </div>
              <div>
                <dt className="text-primary-400">Shop Name</dt>
                <dd className="font-medium">{viewTarget.shop_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-primary-400">Joining Date</dt>
                <dd className="font-medium">{viewTarget.joined_at ? formatDate(viewTarget.joined_at) : '—'}</dd>
              </div>
              <div>
                <dt className="text-primary-400">Status</dt>
                <dd>
                  <span className={viewTarget.status === 'inactive' ? 'badge-danger' : 'badge-success'}>{viewTarget.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(editNameTarget)} onClose={() => setEditNameTarget(null)} title="Edit Staff Name">
        <div className="space-y-3">
          <Input label="Full Name" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} />
          <Button
            variant="accent"
            fullWidth
            isLoading={editName.isPending}
            onClick={() => {
              if (!editNameValue.trim()) {
                toast.error('Name cannot be empty');
                return;
              }
              editName.mutate({ staffId: editNameTarget!.id, fullName: editNameValue.trim() });
            }}
          >
            Save Name
          </Button>
        </div>
      </Modal>
    </div>
  );
}
