import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
}

export default function ErrorDisplay({
  title = 'Something went wrong',
  message,
  onRetry,
  showHomeLink = true,
}: ErrorDisplayProps) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6">{message}</p>
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <button onClick={onRetry} className="btn-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
          {showHomeLink && (
            <Link to="/" className="btn-secondary flex items-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
