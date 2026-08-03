import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { parseProductCsv, importProducts, IMPORT_CSV_COLUMNS, type ImportOutcome } from '@/services/productImportService';
import { effectiveSellerId } from '@/lib/roles';
import { queryKeys } from '@/lib/queryClient';
import type { Gender } from '@/types';

const SAMPLE_CSV = `${IMPORT_CSV_COLUMNS.join(',')}\nClassic Crew T-Shirt,,Peter England,T-Shirts,Round Neck,Soft cotton crew-neck tee,499,799,Cotton,Navy,M,25,\n`;

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dressmart-product-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Basic bulk import — each CSV row creates one draft product with a single color/size variant.
 *  Multi-color/multi-size products and image galleries still need the full Add Product form
 *  afterward; see productImportService.ts's doc comment. */
export function ImportProductsModal({ isOpen, onClose }: ImportProductsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<Gender>('men');
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportOutcome | null>(null);

  const reset = () => {
    setFileName('');
    setResult(null);
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const rows = parseProductCsv(text);
    if (rows.length === 0) {
      toast.error('No data rows found in that file.');
      return;
    }
    setIsImporting(true);
    try {
      const sellerId = effectiveSellerId(user);
      const outcome = await importProducts(rows, gender, sellerId, user.store_name ?? user.full_name, { id: user.id, name: user.full_name });
      setResult(outcome);
      if (outcome.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(sellerId) });
        toast.success(`Imported ${outcome.successCount} product${outcome.successCount === 1 ? '' : 's'} as drafts`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import Products"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-acc-text-secondary">
          Upload a CSV to create multiple products at once as <span className="font-medium">drafts</span> — publish each one after reviewing it.
          Each row creates one product with a single color/size; add more colors, sizes, and photos afterward from the product's edit page.
        </p>

        <button onClick={downloadSampleCsv} className="flex items-center gap-2 text-sm font-medium text-acc-primary hover:underline">
          <Download size={14} /> Download CSV template
        </button>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-acc-text dark:text-primary-100">Gender / Section</span>
          <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="men">Men</option>
            <option value="kids">Kids</option>
          </select>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-acc-border p-6 text-center transition-colors hover:border-acc-primary hover:bg-acc-primary/5 dark:border-primary-600"
        >
          <UploadCloud size={22} className="text-acc-text-secondary" />
          <p className="text-xs text-acc-text-secondary">{fileName || 'Click to choose a .csv file'}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </div>

        {isImporting && <p className="text-sm text-acc-text-secondary">Importing…</p>}

        {result && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 size={16} /> {result.successCount} product{result.successCount === 1 ? '' : 's'} imported
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/20">
                {result.errors.map((err) => (
                  <p key={err.row} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Row {err.row} ({err.name}): {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
