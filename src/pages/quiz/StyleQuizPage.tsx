import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sparkles, ArrowLeft, ArrowRight, RotateCcw, Check } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { ColorSwatches } from '@/components/product/ColorSwatches';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Skeleton } from '@/components/ui/Skeleton';
import { brandService } from '@/services/productService';
import { useStylePreferences } from '@/hooks/useStylePreferences';
import { generateStyleRecommendations, type StyleQuizResult } from '@/lib/styleQuizRecommender';
import { QUIZ_COLORS, QUIZ_FITS, QUIZ_BUDGETS, QUIZ_OCCASIONS, QUIZ_BRANDS, MAX_FAVORITE_BRANDS } from '@/lib/styleQuizData';
import { cn } from '@/lib/utils';

const STEPS = ['color', 'fit', 'budget', 'occasion', 'brands'] as const;
type StepKey = (typeof STEPS)[number];

const STEP_TITLES: Record<StepKey, string> = {
  color: 'What color do you gravitate towards?',
  fit: 'How do you like your clothes to fit?',
  budget: "What's your usual budget per item?",
  occasion: 'What are you shopping for?',
  brands: 'Any favorite brands? (pick up to 3)',
};

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
        active ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/10' : 'border-primary-200 hover:border-primary-400 dark:border-primary-600',
      )}
    >
      {children}
    </button>
  );
}

export function StyleQuizPage() {
  const { preferences, isLoading: isLoadingPreferences, save, isSaving } = useStylePreferences();
  const { data: allBrands } = useQuery({ queryKey: ['brands', 'all'], queryFn: () => brandService.list() });

  const [step, setStep] = useState(0);
  const [color, setColor] = useState('');
  const [fit, setFit] = useState('');
  const [budgetKey, setBudgetKey] = useState('');
  const [occasionKey, setOccasionKey] = useState('');
  const [brandSlugs, setBrandSlugs] = useState<string[]>([]);

  const [result, setResult] = useState<StyleQuizResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [hasHydratedFromSaved, setHasHydratedFromSaved] = useState(false);

  const selectedBudget = QUIZ_BUDGETS.find((b) => b.key === budgetKey);

  const runRecommendations = async (answers: { color: string; fit: string; budgetMin: number; budgetMax: number; occasionKey: string; favoriteBrandSlugs: string[] }) => {
    setIsGenerating(true);
    try {
      const generated = await generateStyleRecommendations(answers);
      setResult(generated);
    } finally {
      setIsGenerating(false);
    }
  };

  // Once preferences + brand list have loaded, silently hydrate the quiz answers and show
  // the saved recommendations immediately, unless the user has explicitly asked to retake it.
  useEffect(() => {
    if (hasHydratedFromSaved || isRetaking || !preferences || !allBrands) return;
    setHasHydratedFromSaved(true);
    setColor(preferences.favorite_color);
    setFit(preferences.preferred_fit);
    setOccasionKey(preferences.occasion);
    const matchedBudget = QUIZ_BUDGETS.find((b) => b.min === preferences.budget_min && b.max === preferences.budget_max);
    if (matchedBudget) setBudgetKey(matchedBudget.key);
    const slugs = allBrands.filter((b) => preferences.favorite_brand_ids.includes(b.id)).map((b) => b.slug);
    setBrandSlugs(slugs);

    runRecommendations({
      color: preferences.favorite_color,
      fit: preferences.preferred_fit,
      budgetMin: preferences.budget_min,
      budgetMax: preferences.budget_max,
      occasionKey: preferences.occasion,
      favoriteBrandSlugs: slugs,
    });
  }, [preferences, allBrands, hasHydratedFromSaved, isRetaking]);

  const toggleBrand = (slug: string) => {
    setBrandSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_FAVORITE_BRANDS) return prev;
      return [...prev, slug];
    });
  };

  const canProceed = useMemo(() => {
    const currentStep: StepKey = STEPS[step];
    if (currentStep === 'color') return Boolean(color);
    if (currentStep === 'fit') return Boolean(fit);
    if (currentStep === 'budget') return Boolean(budgetKey);
    if (currentStep === 'occasion') return Boolean(occasionKey);
    return true; // brands is optional
  }, [step, color, fit, budgetKey, occasionKey]);

  const handleFinish = async () => {
    if (!selectedBudget) return;
    const answers = {
      color,
      fit,
      budgetMin: selectedBudget.min,
      budgetMax: selectedBudget.max,
      occasionKey,
      favoriteBrandSlugs: brandSlugs,
    };
    await runRecommendations(answers);

    const favoriteBrandIds = (allBrands ?? []).filter((b) => brandSlugs.includes(b.slug)).map((b) => b.id);
    try {
      await save({
        favorite_color: color,
        preferred_fit: fit,
        budget_min: selectedBudget.min,
        budget_max: selectedBudget.max,
        occasion: occasionKey,
        favorite_brand_ids: favoriteBrandIds,
      });
      toast.success('Your style profile has been saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your preferences');
    }
  };

  const handleRetake = () => {
    setIsRetaking(true);
    setResult(null);
    setStep(0);
  };

  if (isLoadingPreferences) {
    return (
      <div className="container-app py-8">
        <Skeleton className="mb-6 h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="container-app py-8">
        <Seo title="Your Style Profile" description="Personalized recommendations from your DressMart style quiz." />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h1 className="text-xl font-bold sm:text-2xl">Recommended For You</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetake}>
            <RotateCcw size={14} /> Retake Quiz
          </Button>
        </div>

        <p className="mb-6 text-sm text-primary-400">{result.summary}</p>

        <ProductGrid products={result.products} isLoading={isGenerating} emptyMessage="Try widening your budget or choosing a different occasion." />
      </div>
    );
  }

  const currentStep: StepKey = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="container-app max-w-2xl py-8">
      <Seo title="Style Quiz" description="Answer a few quick questions and get personalized outfit recommendations from DressMart." />
      <div className="mb-6 flex items-center gap-2">
        <Sparkles size={20} className="text-accent" />
        <h1 className="text-xl font-bold sm:text-2xl">Style Quiz</h1>
      </div>

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s, idx) => (
          <div key={s} className={cn('h-1.5 flex-1 rounded-full', idx <= step ? 'bg-accent' : 'bg-primary-100 dark:bg-primary-700')} />
        ))}
      </div>

      <div className="card-surface p-6">
        <p className="mb-5 text-lg font-semibold">{STEP_TITLES[currentStep]}</p>

        {currentStep === 'color' && <ColorSwatches colors={QUIZ_COLORS} activeColor={color} onChange={setColor} />}

        {currentStep === 'fit' && (
          <div className="grid grid-cols-2 gap-3">
            {QUIZ_FITS.map((f) => (
              <ChipButton key={f} active={fit === f} onClick={() => setFit(f)}>
                {f}
              </ChipButton>
            ))}
          </div>
        )}

        {currentStep === 'budget' && (
          <div className="grid grid-cols-2 gap-3">
            {QUIZ_BUDGETS.map((b) => (
              <ChipButton key={b.key} active={budgetKey === b.key} onClick={() => setBudgetKey(b.key)}>
                {b.label}
              </ChipButton>
            ))}
          </div>
        )}

        {currentStep === 'occasion' && (
          <div className="grid grid-cols-2 gap-3">
            {QUIZ_OCCASIONS.map((o) => (
              <ChipButton key={o.key} active={occasionKey === o.key} onClick={() => setOccasionKey(o.key)}>
                {o.label}
              </ChipButton>
            ))}
          </div>
        )}

        {currentStep === 'brands' && (
          <div className="flex flex-wrap gap-2">
            {QUIZ_BRANDS.map((b) => {
              const isActive = brandSlugs.includes(b.slug);
              return (
                <button
                  key={b.slug}
                  onClick={() => toggleBrand(b.slug)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/10' : 'border-primary-200 hover:border-primary-400 dark:border-primary-600',
                  )}
                >
                  {isActive && <Check size={13} />}
                  {b.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft size={15} /> Back
          </Button>
          {isLastStep ? (
            <Button variant="accent" onClick={handleFinish} isLoading={isGenerating || isSaving} disabled={!canProceed}>
              <Sparkles size={15} /> See My Recommendations
            </Button>
          ) : (
            <Button variant="accent" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canProceed}>
              Next <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
