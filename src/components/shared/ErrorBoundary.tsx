import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="card max-w-lg w-full text-center border-2 border-red-200 p-8 shadow-xl bg-white dark:bg-gray-900">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {this.props.fallbackTitle || 'Display Error'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || this.props.fallbackMessage || 'An unexpected error occurred while rendering the results.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (this.props.onReset) this.props.onReset();
                  else window.location.reload();
                }}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <a
                href="/dashboard"
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
