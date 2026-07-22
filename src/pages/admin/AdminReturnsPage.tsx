import { RotateCcw } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ReturnsList } from '@/components/admin/ReturnsList';

export function AdminReturnsPage() {
  return (
    <div>
      <Seo title="Admin — Returns & Refunds" />
      <div className="mb-5 flex items-center gap-2">
        <RotateCcw size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Returns &amp; Refunds</h1>
      </div>
      <ReturnsList />
    </div>
  );
}
