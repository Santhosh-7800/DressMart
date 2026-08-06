import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { CatalogHealthGate } from '@/components/common/CatalogHealthGate';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { AppRoutes } from '@/routes/AppRoutes';

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            {/* BASE_URL is Vite's resolved `base` config ('/' everywhere except a GitHub Pages
                project-site deploy, which serves from '/<repo-name>/' — see vite.config.ts). */}
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <ScrollToTop />
              <OfflineBanner />
              <CatalogHealthGate>
                <AppRoutes />
              </CatalogHealthGate>
              <Toaster
                position="top-center"
                containerStyle={{ top: 140 }}
                toastOptions={{
                  duration: 3000,
                  style: { background: '#131921', color: '#fff', borderRadius: '0.75rem', fontSize: '0.875rem' },
                  success: { iconTheme: { primary: '#FF9900', secondary: '#131921' } },
                }}
              />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
