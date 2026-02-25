import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';

const riskStyles: Record<RiskLevel, string> = {
  high: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  medium: 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  low: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize',
        riskStyles[level]
      )}
    >
      {level} risk
    </span>
  );
}
