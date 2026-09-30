// Placeholders for data loaded from the API: loading, empty list, and failed request.
import React from 'react';
import { AlertCircle, Inbox, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

const frame = 'flex flex-col items-center justify-center text-center gap-2 py-10 px-4 text-xs';

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    role="status"
    aria-label="Đang tải"
    className={cn('inline-block animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full', className)}
  />
);

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({
  label = 'Đang tải dữ liệu...', className
}) => (
  <div className={cn(frame, 'text-slate-500 dark:text-slate-400', className)}>
    <Spinner className="h-6 w-6" />
    <span>{label}</span>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title = 'Chưa có dữ liệu', description, icon, action, className }) => (
  <div className={cn(frame, 'text-slate-500 dark:text-slate-400', className)}>
    <span className="text-slate-300 dark:text-slate-600">{icon ?? <Inbox className="h-8 w-8" />}</span>
    <p className="font-bold text-slate-700 dark:text-slate-300">{title}</p>
    {description && <p className="max-w-md">{description}</p>}
    {action}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Không tải được dữ liệu', message, onRetry, className }) => (
  <div className={cn(frame, className)}>
    <AlertCircle className="h-8 w-8 text-rose-500" />
    <p className="font-bold text-slate-800 dark:text-slate-200">{title}</p>
    <p className="max-w-md text-rose-600 dark:text-rose-400">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} icon={<RotateCcw className="h-3.5 w-3.5" />}>
        Thử lại
      </Button>
    )}
  </div>
);
