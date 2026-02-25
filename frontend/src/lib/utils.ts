import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: 'Submitted',
    processing: 'Processing',
    processing_failed: 'Failed',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    needs_info: 'Needs Info',
  };
  return labels[status] || status;
}

export function documentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    drivers_license: "Driver's License",
    passport: 'Passport',
    national_id: 'National ID',
  };
  return labels[type] || type;
}
