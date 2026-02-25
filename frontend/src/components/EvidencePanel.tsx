import {
  MapPin,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Scan,
  Fingerprint,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EvidenceAnnotation } from '@/types';

const ISSUE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Eye; color: string; bg: string }
> = {
  match: {
    label: 'Match',
    icon: CheckCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  },
  mismatch: {
    label: 'Mismatch',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  },
  blur: {
    label: 'Blur Detected',
    icon: Eye,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  },
  tampering: {
    label: 'Tampering Suspected',
    icon: Fingerprint,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  },
  quality: {
    label: 'Quality Issue',
    icon: Scan,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  },
  expiry: {
    label: 'Expiry Issue',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  },
  info: {
    label: 'Info',
    icon: CheckCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-400',
};

export function EvidencePanel({ annotations }: { annotations: EvidenceAnnotation[] }) {
  const criticalCount = annotations.filter((a) => a.severity === 'critical').length;
  const warningCount = annotations.filter((a) => a.severity === 'warning').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
        <span>{annotations.length} field{annotations.length !== 1 ? 's' : ''} analyzed</span>
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
      </div>

      {annotations.map((annotation, i) => {
        const config = ISSUE_TYPE_CONFIG[annotation.issue_type] || ISSUE_TYPE_CONFIG.info;
        const Icon = config.icon;

        return (
          <div
            key={i}
            className={cn('rounded-lg border p-3 transition-all', config.bg)}
          >
            <div className="flex items-start gap-2.5">
              <div className={cn('mt-0.5 shrink-0', config.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {annotation.field.replace(/_/g, ' ')}
                  </span>
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                    config.color,
                    config.bg,
                  )}>
                    {config.label}
                  </span>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    SEVERITY_DOT[annotation.severity] || SEVERITY_DOT.info,
                  )} />
                </div>

                <p className="text-sm text-foreground/80 leading-relaxed mb-2">
                  {annotation.description}
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {annotation.extracted_value && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Extracted:</span>
                      <code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-foreground font-mono">
                        {annotation.extracted_value}
                      </code>
                    </div>
                  )}
                  {annotation.submitted_value && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Submitted:</span>
                      <code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-foreground font-mono">
                        {annotation.submitted_value}
                      </code>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {annotation.location}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
