import { CheckCircle, Loader2, AlertTriangle, Clock, Shield, XCircle } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

const ACTION_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  application_submitted: {
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/30',
    label: 'Application Submitted',
  },
  ai_analysis_completed: {
    icon: Shield,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/30',
    label: 'AI Analysis Complete',
  },
  application_reviewed: {
    icon: CheckCircle,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/30',
    label: 'Review Submitted',
  },
  processing_failed: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30',
    label: 'Processing Failed',
  },
};

interface TimelineProps {
  entries: AuditLogEntry[];
}

export function Timeline({ entries }: TimelineProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
        Waiting for events...
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-border" />
      <div className="space-y-4">
        {sorted.map((entry, i) => {
          const config = ACTION_CONFIG[entry.action] || {
            icon: Clock,
            color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
            label: entry.action,
          };
          const Icon = config.icon;
          const isLast = i === sorted.length - 1;

          return (
            <div key={entry.id} className="relative flex items-start gap-3 pl-1">
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center w-7 h-7 rounded-full shrink-0',
                  config.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className={cn('pt-0.5 pb-1', isLast && 'font-medium')}>
                <p className="text-sm text-foreground">{config.label}</p>
                <p className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</p>
                {entry.details && <TimelineDetails details={entry.details} action={entry.action} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineDetails({ details, action }: { details: Record<string, unknown>; action: string }) {
  if (action === 'ai_analysis_completed') {
    return (
      <div className="flex gap-2 mt-1 flex-wrap">
        {details.risk_level != null && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            Risk: {String(details.risk_level)}
          </span>
        )}
        {details.confidence_score !== undefined && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            Confidence: {Math.round(Number(details.confidence_score) * 100)}%
          </span>
        )}
        {details.flag_count !== undefined && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(details.flag_count)} flags
          </span>
        )}
      </div>
    );
  }

  if (action === 'application_reviewed') {
    return (
      <div className="flex gap-2 mt-1 flex-wrap">
        {details.decision != null && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded font-medium capitalize',
            details.decision === 'approved' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' :
            details.decision === 'rejected' ? 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300' :
            'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300'
          )}>
            {String(details.decision)}
          </span>
        )}
        {details.reason != null && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{String(details.reason)}</span>
        )}
        {details.is_override != null && (
          <span className="text-xs bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
            <AlertTriangle className="h-3 w-3" /> Override
          </span>
        )}
      </div>
    );
  }

  return null;
}
