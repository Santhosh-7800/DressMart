import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Power, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { faqService } from '@/services/faqService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Faq, SupportCategory } from '@/types';

const CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'return', label: 'Returns' },
  { value: 'exchange', label: 'Exchanges' },
  { value: 'product', label: 'Products' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

type FaqFormState = { question: string; answer: string; category: SupportCategory; is_active: boolean };
const EMPTY_FORM: FaqFormState = { question: '', answer: '', category: 'other', is_active: true };

function faqToForm(faq: Faq): FaqFormState {
  return { question: faq.question, answer: faq.answer, category: faq.category, is_active: faq.is_active };
}

/**
 * Section 4: dynamic FAQ management, mirroring SellerBannersPage's CRUD pattern exactly — plain
 * Firestore create/update/delete via faqService (public read, isAdmin() write in
 * firestore.rules), no Cloud Function. Reordering is a simple swap-with-neighbor (Up/Down) rather
 * than drag-and-drop, keeping this consistent with "keep the system simple."
 */
export function AdminFaqPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [form, setForm] = useState<FaqFormState>(EMPTY_FORM);

  const faqsQuery = useQuery({ queryKey: queryKeys.faqs.all, queryFn: () => faqService.listAll() });
  const faqs = faqsQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.faqs.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.faqs.active });
  };

  const createMutation = useMutation({
    mutationFn: () => faqService.create({ question: form.question.trim(), answer: form.answer.trim(), category: form.category, is_active: form.is_active, sort_order: faqs.length }),
    onSuccess: () => {
      toast.success('FAQ created');
      invalidate();
      setIsFormOpen(false);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not create FAQ.')),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingFaq) throw new Error('No FAQ selected.');
      return faqService.update(editingFaq.id, { question: form.question.trim(), answer: form.answer.trim(), category: form.category, is_active: form.is_active });
    },
    onSuccess: () => {
      toast.success('FAQ updated');
      invalidate();
      setIsFormOpen(false);
      setEditingFaq(null);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update FAQ.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ faq, isActive }: { faq: Faq; isActive: boolean }) => faqService.update(faq.id, { is_active: isActive }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update FAQ status.')),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ current, neighbor }: { current: Faq; neighbor: Faq }) => faqService.swapOrder(current, neighbor),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not reorder FAQs.')),
  });

  const removeMutation = useMutation({
    mutationFn: (faqId: string) => faqService.remove(faqId),
    onSuccess: () => {
      toast.success('FAQ deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not delete FAQ.')),
  });

  const openCreate = () => {
    setEditingFaq(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };
  const openEdit = (faq: Faq) => {
    setEditingFaq(faq);
    setForm(faqToForm(faq));
    setIsFormOpen(true);
  };
  const handleSubmit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Question and answer are required.');
      return;
    }
    if (editingFaq) updateMutation.mutate();
    else createMutation.mutate();
  };
  const handleDelete = (faq: Faq) => {
    if (!confirm(`Delete "${faq.question}"? This cannot be undone.`)) return;
    removeMutation.mutate(faq.id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Seo title="FAQ Management" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">FAQ Management</h1>
        <Button variant="account" onClick={openCreate}>
          <Plus size={16} /> New FAQ
        </Button>
      </div>

      {faqsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : faqs.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No FAQs yet" description="Use the New FAQ button above to add the first Help Center article. Until then, the app shows a built-in default set." />
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <Card key={faq.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{faq.question}</p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      faq.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
                    )}
                  >
                    {faq.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-500 dark:bg-primary-800 dark:text-primary-300">
                    {CATEGORY_OPTIONS.find((c) => c.value === faq.category)?.label ?? faq.category}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-acc-text-secondary">{faq.answer}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" disabled={idx === 0} onClick={() => reorderMutation.mutate({ current: faq, neighbor: faqs[idx - 1] })}>
                  <ArrowUp size={14} />
                </Button>
                <Button size="sm" variant="outline" disabled={idx === faqs.length - 1} onClick={() => reorderMutation.mutate({ current: faq, neighbor: faqs[idx + 1] })}>
                  <ArrowDown size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(faq)}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant={faq.is_active ? 'danger' : 'account'} onClick={() => toggleActiveMutation.mutate({ faq, isActive: !faq.is_active })}>
                  <Power size={14} />
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(faq)} isLoading={removeMutation.isPending}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingFaq ? 'Edit FAQ' : 'New FAQ'}>
        <div className="space-y-4">
          <Input floating label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Answer</label>
            <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupportCategory })} className="input-field">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex w-full items-center justify-between rounded-2xl border border-acc-border px-4 py-3 text-sm dark:border-primary-700">
            <span className="text-acc-text dark:text-white">Active</span>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-acc-primary" />
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSaving}>
              {editingFaq ? 'Save Changes' : 'Create FAQ'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
