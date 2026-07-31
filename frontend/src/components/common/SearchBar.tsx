import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mic, ScanLine, Search, X, Clock, TrendingUp, Flame, LayoutGrid, Tag } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatCurrency } from '@/lib/utils';

interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultLike[][];
}

export function SearchBar() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const {
    query,
    setQuery,
    suggestions,
    categorySuggestions,
    brandSuggestions,
    recentSearches,
    trendingSearches,
    popularSearches,
    commitSearch,
    clearRecentSearches,
  } = useSearch();

  useOnClickOutside(containerRef, () => setIsFocused(false));

  const runSearch = (term: string) => {
    commitSearch(term);
    setIsFocused(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleVoiceSearch = () => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      runSearch(query || 'voice search unavailable');
      return;
    }

    const recognition = new (SpeechRecognitionCtor as new () => {
      lang: string;
      onresult: ((event: SpeechRecognitionEventLike) => void) | null;
      onend: (() => void) | null;
      start: () => void;
    })();
    recognition.lang = 'en-IN';
    setIsListening(true);
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      runSearch(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) runSearch(query);
        }}
        className="flex items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-primary-100 dark:bg-primary-800 dark:ring-primary-600"
      >
        <Search size={18} className="ml-3.5 shrink-0 text-primary-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          onClick={() => setIsFocused(true)}
          placeholder="Search for shirts, jeans, shoes and more"
          className="w-full bg-transparent px-3 py-2.5 text-sm text-primary-900 outline-none placeholder:text-primary-300 dark:text-white"
          aria-label="Search products"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="mr-1 text-primary-300 hover:text-primary-500" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={handleVoiceSearch}
          className={`mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isListening ? 'animate-pulse bg-accent text-white' : 'text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-700'}`}
          aria-label="Search by voice"
          title="Voice search"
        >
          <Mic size={16} />
        </button>
        <button
          type="button"
          onClick={() => toast('Barcode scanning is coming soon', { icon: '📷' })}
          className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-700"
          aria-label="Scan barcode"
          title="Scan barcode"
        >
          <ScanLine size={16} />
        </button>
        <button type="submit" className="hidden bg-accent px-5 py-2.5 text-sm font-semibold text-primary-900 sm:block">
          Search
        </button>
      </form>

      {isFocused && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl bg-card p-3 shadow-popover dark:bg-card-dark">
          {query.trim().length > 1 ? (
            suggestions.length > 0 || categorySuggestions.length > 0 || brandSuggestions.length > 0 ? (
              <div className="space-y-3">
                {categorySuggestions.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-primary-400">
                      <LayoutGrid size={12} /> Categories
                    </p>
                    <div className="flex flex-wrap gap-2 px-2">
                      {categorySuggestions.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            commitSearch(category.name);
                            setIsFocused(false);
                            navigate(`/${category.gender}/${category.slug}`);
                          }}
                          className="rounded-full bg-primary-50 px-3 py-1 text-xs dark:bg-primary-800"
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {brandSuggestions.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-primary-400">
                      <Tag size={12} /> Brands
                    </p>
                    <div className="flex flex-wrap gap-2 px-2">
                      {brandSuggestions.map((brand) => (
                        <button
                          key={brand.id}
                          onClick={() => runSearch(brand.name)}
                          className="rounded-full bg-primary-50 px-3 py-1 text-xs dark:bg-primary-800"
                        >
                          {brand.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div>
                    {(categorySuggestions.length > 0 || brandSuggestions.length > 0) && (
                      <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-primary-400">Products</p>
                    )}
                    <ul>
                      {suggestions.map((product) => (
                        <li key={product.id}>
                          <button
                            onClick={() => {
                              commitSearch(product.name);
                              setIsFocused(false);
                              navigate(`/product/${product.slug}`);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-primary-50 dark:hover:bg-primary-800"
                          >
                            <ProductImage src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-12 w-10 rounded-md" priority />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{product.name}</p>
                              <p className="text-xs text-primary-400">{formatCurrency(product.price)}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="p-3 text-sm text-primary-400">No products found for "{query}"</p>
            )
          ) : (
            <div className="space-y-4 p-1">
              {recentSearches.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-400">
                      <Clock size={12} /> Recent searches
                    </p>
                    <button onClick={clearRecentSearches} className="text-xs text-accent-600 hover:underline">
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button key={term} onClick={() => runSearch(term)} className="rounded-full bg-primary-50 px-3 py-1 text-xs dark:bg-primary-800">
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {trendingSearches.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-400">
                    <Flame size={12} /> Trending searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((term) => (
                      <button key={term} onClick={() => runSearch(term)} className="rounded-full bg-primary-50 px-3 py-1 text-xs dark:bg-primary-800">
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-400">
                  <TrendingUp size={12} /> Popular searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((term) => (
                    <button key={term} onClick={() => runSearch(term)} className="rounded-full bg-primary-50 px-3 py-1 text-xs dark:bg-primary-800">
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
