import {
  ShieldAlert,
  ShieldCheck,
  Globe,
  AlertTriangle,
  FileWarning,
  ScanEye,
  Scale,
  UserX,
  Newspaper,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RegulatoryFlag } from '@/types';

const TYPE_ICONS: Record<string, typeof ShieldAlert> = {
  high_risk_jurisdiction: Globe,
  elevated_jurisdiction: Globe,
  jurisdiction_clear: Globe,
  sanctions_screen: ShieldAlert,
  pep_screen: UserX,
  adverse_media_screen: Newspaper,
  expired_document: FileWarning,
  low_confidence: ScanEye,
  critical_ai_flags: AlertTriangle,
  poor_document_quality: ScanEye,
};

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: {
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
};

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  immediate: { label: 'IMMEDIATE', color: 'bg-red-500 text-white' },
  elevated: { label: 'ELEVATED', color: 'bg-amber-500 text-white' },
  standard: { label: 'STANDARD', color: 'bg-emerald-500 text-white' },
};

export function RegulatoryFlags({
  flags,
  priority,
}: {
  flags: RegulatoryFlag[];
  priority: string | null;
}) {
  const alerts = flags.filter((f) => f.severity !== 'info');
  const cleared = flags.filter((f) => f.severity === 'info');
  const criticalCount = flags.filter((f) => f.severity === 'critical').length;
  const warningCount = flags.filter((f) => f.severity === 'warning').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{flags.length} checks run</span>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {warningCount} warning
          </span>
        )}
        {cleared.length > 0 && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle className="h-3 w-3" />
            {cleared.length} clear
          </span>
        )}
        {priority && PRIORITY_STYLES[priority] && (
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              PRIORITY_STYLES[priority].color,
            )}
          >
            {PRIORITY_STYLES[priority].label} PRIORITY
          </span>
        )}
      </div>

      {alerts.map((flag, i) => {
        const Icon = TYPE_ICONS[flag.type] || ShieldAlert;
        const styles = SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.warning;

        return (
          <div
            key={i}
            className={cn('rounded-lg border p-3.5', styles.border, styles.bg)}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', styles.icon)} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">{flag.title}</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{flag.description}</p>
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Scale className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground font-medium">Regulation:</span>
                    <span className="text-foreground/70">{flag.regulation}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs">
                    <ShieldAlert className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground font-medium shrink-0">FINTRAC:</span>
                    <span className="text-foreground/70">{flag.fintrac_obligation}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {cleared.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">Checks Passed</span>
          </div>
          <div className="space-y-1.5">
            {cleared.map((flag, i) => {
              const Icon = TYPE_ICONS[flag.type] || CheckCircle;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-foreground/70">{flag.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
