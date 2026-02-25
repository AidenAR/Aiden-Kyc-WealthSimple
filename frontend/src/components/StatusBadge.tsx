import { cn } from '@/lib/utils';
import { statusLabel } from '@/lib/utils';
import type { ApplicationStatus } from '@/types';

const statusStyles: Record<string, string> = {
  submitted: 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300',
  processing: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300',
  processing_failed: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300',
  pending_review: 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',
  approved: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300',
  rejected: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300',
  needs_info: 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        statusStyles[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
