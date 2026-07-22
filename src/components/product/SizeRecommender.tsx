import { useState } from 'react';
import { Ruler, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { recommendSize, BODY_TYPE_OPTIONS, type BodyType, type SizeRecommendation } from '@/lib/sizeRecommender';
import { cn } from '@/lib/utils';

interface SizeRecommenderProps {
  sizes: string[];
  stockBySize: Record<string, number>;
  onSelectSize: (size: string) => void;
}

interface StoredSizeProfile {
  heightCm: string;
  weightKg: string;
  age: string;
  bodyType: BodyType;
}

const DEFAULT_PROFILE: StoredSizeProfile = { heightCm: '', weightKg: '', age: '', bodyType: 'regular' };

export function SizeRecommender({ sizes, stockBySize, onSelectSize }: SizeRecommenderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useLocalStorage<StoredSizeProfile>('dressmart:size-profile', DEFAULT_PROFILE);
  const [result, setResult] = useState<SizeRecommendation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (sizes.length <= 1) return null;

  const handleSubmit = () => {
    const heightCm = Number(profile.heightCm);
    const weightKg = Number(profile.weightKg);
    const age = Number(profile.age);

    if (!heightCm || heightCm < 80 || heightCm > 230) {
      setFormError('Enter a height between 80cm and 230cm.');
      return;
    }
    if (!weightKg || weightKg < 10 || weightKg > 220) {
      setFormError('Enter a weight between 10kg and 220kg.');
      return;
    }
    if (!age || age < 1 || age > 100) {
      setFormError('Enter a valid age.');
      return;
    }
    setFormError(null);
    setResult(recommendSize(sizes, { heightCm, weightKg, age, bodyType: profile.bodyType }, stockBySize));
  };

  const handleUseSize = () => {
    if (!result) return;
    onSelectSize(result.alternateSize ?? result.size);
    setIsOpen(false);
  };

  const confidenceColor = result && result.confidence >= 80 ? 'bg-emerald-500' : result && result.confidence >= 60 ? 'bg-accent' : 'bg-red-400';

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:underline">
        <Ruler size={13} /> Find My Size
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setResult(null);
        }}
        title="Smart Size Recommendation"
      >
        {!result ? (
          <div className="space-y-3">
            <p className="text-sm text-primary-400">Tell us a bit about yourself and we'll recommend the best size for this product.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Height (cm)"
                type="number"
                inputMode="numeric"
                placeholder="175"
                value={profile.heightCm}
                onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })}
              />
              <Input
                label="Weight (kg)"
                type="number"
                inputMode="numeric"
                placeholder="70"
                value={profile.weightKg}
                onChange={(e) => setProfile({ ...profile, weightKg: e.target.value })}
              />
            </div>
            <Input label="Age" type="number" inputMode="numeric" placeholder="28" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} />

            <div>
              <p className="mb-1.5 text-sm font-medium">Body Type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BODY_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile({ ...profile, bodyType: opt.value })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium',
                      profile.bodyType === opt.value
                        ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/10'
                        : 'border-primary-200 dark:border-primary-600',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-xs font-medium text-red-500">{formError}</p>}

            <Button variant="accent" fullWidth onClick={handleSubmit}>
              <Sparkles size={15} /> Get My Recommendation
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div>
              <p className="text-sm text-primary-400">Recommended Size</p>
              <p className="text-4xl font-bold text-accent-600">{result.size}</p>
              {result.alternateSize && (
                <p className="mt-1 text-xs text-primary-400">
                  {result.size} is currently out of stock — closest available: <span className="font-semibold">{result.alternateSize}</span>
                </p>
              )}
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">Confidence</span>
                <span>{result.confidence}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100 dark:bg-primary-700">
                <div className={cn('h-full rounded-full transition-all', confidenceColor)} style={{ width: `${result.confidence}%` }} />
              </div>
            </div>

            <p className="text-left text-xs text-primary-400">{result.note}</p>

            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setResult(null)}>
                Try Again
              </Button>
              <Button variant="accent" fullWidth onClick={handleUseSize}>
                Use This Size
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
