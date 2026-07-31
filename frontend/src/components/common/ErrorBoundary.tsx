import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Includes the current path so a render failure scoped to one route (vs. the whole app) is
    // identifiable in the console — this boundary wraps <Outlet> per-route (see PageTransition.tsx),
    // so most failures caught here are route-specific rather than global.
    const path = typeof window !== 'undefined' ? window.location.pathname : '(unknown)';
    console.error(`[ErrorBoundary] Failed to render route "${path}":`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold">{this.props.fallbackTitle ?? 'Something went wrong'}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-primary-400 dark:text-primary-300">
            Please refresh the page. If the problem persists, contact our support team.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-6">
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
