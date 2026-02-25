import { UserCheck, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FacialMatch } from '@/types';

const RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  match: { bg: 'bg-emerald-100 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'MATCH' },
  mismatch: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', label: 'MISMATCH' },
  inconclusive: { bg: 'bg-amber-100 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', label: 'INCONCLUSIVE' },
  error: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'ERROR' },
};

const ASSESSMENT_COLORS: Record<string, string> = {
  match: 'text-emerald-600',
  possible_match: 'text-amber-600',
  mismatch: 'text-red-600',
  unclear: 'text-gray-500',
};

const SEVERITY_STYLES = {
  critical: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
};

export function FacialMatchPanel({ data, selfieUrl }: { data: FacialMatch; selfieUrl?: string | null }) {
  const resultStyle = RESULT_STYLES[data.match_result] || RESULT_STYLES.error;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-accent" />
          Facial Comparison
        </h2>
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', resultStyle.bg, resultStyle.text)}>
          {resultStyle.label}
        </span>
      </div>

      {selfieUrl && (
        <div className="mb-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Applicant Selfie</p>
          <img
            src={selfieUrl}
            alt="Applicant selfie"
            className="w-full max-w-[200px] rounded-lg border border-border object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground">{(data.similarity_score * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Similarity</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground">{(data.confidence * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Confidence</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground capitalize">{data.document_photo_quality}</p>
          <p className="text-[10px] text-muted-foreground">Doc Photo</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground capitalize">{data.selfie_quality}</p>
          <p className="text-[10px] text-muted-foreground">Selfie</p>
        </div>
      </div>

      {data.key_observations && data.key_observations.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-foreground mb-2">Feature Analysis</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {data.key_observations.map((obs, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground capitalize">{obs.feature.replace(/_/g, ' ')}</span>
                <span className={cn('text-xs font-medium capitalize', ASSESSMENT_COLORS[obs.assessment] || 'text-foreground')}>
                  {obs.assessment.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.anomalies && data.anomalies.length > 0 && (
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-semibold text-foreground">Anomalies</h3>
          {data.anomalies.map((a, i) => {
            const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info;
            const Icon = style.icon;
            return (
              <div key={i} className={cn('p-2.5 rounded-lg border text-xs', style.bg)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', style.text)} />
                  <div>
                    <span className={cn('font-medium', style.text)}>{a.type.replace(/_/g, ' ')}</span>
                    <p className="text-foreground/80 mt-0.5">{a.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">{data.explanation}</p>
    </div>
  );
}
