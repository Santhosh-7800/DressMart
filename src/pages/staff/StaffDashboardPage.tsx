import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffProducts } from '@/hooks/useStaffProducts';

function StatTile({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="admin-stat-card">
      <div className="mb-2 flex items-center gap-2 text-white/85">
        <Icon size={16} />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export function StaffDashboardPage() {
  const { user } = useAuth();
  const { data: products, isLoading } = useStaffProducts(user?.id);

  const items = products ?? [];
  const pending = items.filter((p) => p.approval_status === 'pending').length;
  const approved = items.filter((p) => p.approval_status === 'approved').length;
  const rejected = items.filter((p) => p.approval_status === 'rejected').length;

  return (
    <div>
      <Seo title="Staff — Dashboard" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Welcome back, {user?.full_name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-admin-text-secondary">Here's what's happening with your products.</p>
        </div>
        <Link to="/staff/products/new" className="btn-accent text-sm">
          <Plus size={15} /> Add Product
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-stat-card animate-pulse opacity-60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={Package} label="My Products" value={String(items.length)} />
          <StatTile icon={Clock} label="Pending Approval" value={String(pending)} />
          <StatTile icon={CheckCircle2} label="Approved" value={String(approved)} />
          <StatTile icon={XCircle} label="Rejected" value={String(rejected)} />
        </div>
      )}

      <div className="card-surface mt-6 p-5">
        <h2 className="mb-3 font-semibold text-admin-text">How approval works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-admin-text-secondary">
          <li>Add a product with photos, price, stock, sizes, and colors.</li>
          <li>It's submitted as <span className="font-medium text-admin-text">Pending Approval</span> — not visible in the store yet.</li>
          <li>Admin reviews it and either approves or rejects it.</li>
          <li>Only approved products appear in the DressMart store.</li>
        </ol>
      </div>
    </div>
  );
}
