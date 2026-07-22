import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Search } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminDataService } from '@/services/adminDataService';
import { formatDate } from '@/lib/utils';

export function AdminCustomersPage() {
  const [search, setSearch] = useState('');
  const { data: profiles, isLoading } = useQuery({ queryKey: ['admin', 'customers'], queryFn: () => adminDataService.getAllProfiles() });

  const customers = (profiles ?? []).filter((p) => p.role === 'customer');
  const q = search.trim().toLowerCase();
  const filtered = q ? customers.filter((c) => c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : customers;

  return (
    <div>
      <Seo title="Admin — Customers" />
      <div className="mb-5 flex items-center gap-2">
        <Users size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <div className="mb-4">
        <Input placeholder="Search by name or email" leftIcon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Joined</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-admin-orange-light to-admin-orange text-xs font-bold text-white">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-admin-text">{c.full_name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-admin-text-secondary">{c.email}</td>
                  <td className="p-3 text-admin-text-secondary">{c.phone ?? '—'}</td>
                  <td className="p-3 text-admin-text-secondary">{formatDate(c.created_at)}</td>
                  <td className="p-3 text-right">
                    <Link to={`/admin/customers/${c.id}`} className="text-sm font-medium text-admin-orange hover:underline">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-admin-text-secondary">
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
