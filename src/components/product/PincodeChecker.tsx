import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { pincodeService, type PincodeCheckResult } from '@/services/pincodeService';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface PincodeCheckerProps {
  onVerified?: (pincode: string) => void;
}

export function PincodeChecker({ onVerified }: PincodeCheckerProps) {
  const [savedPincode, setSavedPincode] = useLocalStorage('dressmart:pincode', '400001');
  const [input, setInput] = useState(savedPincode);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<PincodeCheckResult | null>(null);

  const handleCheck = async () => {
    setIsChecking(true);
    setResult(null);
    try {
      const checkResult = await pincodeService.check(input.trim());
      setResult(checkResult);
      if (checkResult.isServiceable) {
        setSavedPincode(input.trim());
        onVerified?.(input.trim());
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="Enter pincode"
          className="input-field max-w-[160px] !py-1.5 text-sm"
        />
        <button onClick={handleCheck} disabled={isChecking || input.length !== 6} className="text-sm font-medium text-accent-600 hover:underline disabled:cursor-not-allowed disabled:text-primary-300">
          {isChecking ? <Loader2 size={14} className="animate-spin" /> : 'Check'}
        </button>
      </div>
      {result && (
        <p className={`mt-1.5 flex items-center gap-1 text-xs ${result.isServiceable ? 'text-emerald-600' : 'text-red-500'}`}>
          {result.isServiceable ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {result.message}
        </p>
      )}
    </div>
  );
}
