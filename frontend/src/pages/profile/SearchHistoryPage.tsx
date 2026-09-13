import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { userActivityService } from '@/services/userActivityService';
import { formatDate } from '@/lib/utils';

/**
 * Signed-in-only page (route sits under AccountLayout inside ProtectedRoute) surfacing the same
 * `user_activity/{uid}.recent_searches` list the SearchBar dropdown already reads via useSearch —
 * this just gives it a permanent, dedicated home in "My Account" alongside Orders/Wishlist/
 * Addresses, with full timestamps and result counts instead of the dropdown's compact chip view.
 */
export function SearchHistoryPage() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['search-history', identityId];

  const { data: activity, isLoading } = useQuery({
    queryKey,
    queryFn: () => userActivityService.get(identityId),
  });

  const searches = activity?.recent_searches ?? [];

  const handleClearAll = async () => {
    await userActivityService.clearRecentSearches(identityId);
    queryClient.invalidateQueries({ queryKey });
    toast.success('Search history cleared');
  };

  const handleRemoveOne = async (normalizedQuery: string) => {
    await userActivityService.removeSearchEntry(identityId, normalizedQuery);
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div>
      <Seo title="Search History" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Search History</h1>
        {searches.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} /> Clear all
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!isLoading && searches.length === 0 && (
        <EmptyState icon={History} title="No search history yet" description="Products you search for will show up here so you can quickly search them again." />
      )}

      {!isLoading && searches.length > 0 && (
        <div className="card-surface divide-y divide-primary-100 dark:divide-primary-700">
          {searches.map((entry) => (
            <div key={entry.normalized_query} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary-50 dark:hover:bg-primary-800">
              <Link to={`/search?q=${encodeURIComponent(entry.query)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Search size={16} className="shrink-0 text-primary-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary-900 dark:text-white">{entry.query}</p>
                  <p className="text-xs text-primary-400">
                    {formatDate(entry.searched_at)} · {entry.result_count} {entry.result_count === 1 ? 'result' : 'results'}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleRemoveOne(entry.normalized_query)}
                aria-label={`Remove "${entry.query}" from search history`}
                className="shrink-0 rounded-full p-1.5 text-primary-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
