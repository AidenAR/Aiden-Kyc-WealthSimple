import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Shield } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';
import { timeAgo, documentTypeLabel } from '@/lib/utils';
import type { Application } from '@/types';

export function ApplicationCard({ app }: { app: Application }) {
  const flagCount = app.flags?.length ?? 0;
  const criticalFlags = app.flags?.filter((f) => f.severity === 'critical').length ?? 0;

  return (
    <Link
      to={`/application/${app.id}`}
      className="block bg-card rounded-xl border border-border p-5 hover:shadow-md hover:border-accent/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">
            {app.first_name} {app.last_name}
          </h3>
          <p className="text-sm text-muted-foreground">{documentTypeLabel(app.document_type)}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <RiskBadge level={app.risk_level} />

        {app.risk_score !== null && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            Score: {(app.risk_score * 100).toFixed(0)}%
          </span>
        )}

        {flagCount > 0 && (
          <span className="text-xs flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {flagCount} flag{flagCount !== 1 ? 's' : ''}
            {criticalFlags > 0 && ` (${criticalFlags} critical)`}
          </span>
        )}

        {app.confidence_score !== null && (
          <span className="text-xs text-muted-foreground">
            Confidence: {(app.confidence_score * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 mr-1" />
        {timeAgo(app.created_at)}
      </div>
    </Link>
  );
}
