import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';

const riskStyles: Record<RiskLevel, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
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
