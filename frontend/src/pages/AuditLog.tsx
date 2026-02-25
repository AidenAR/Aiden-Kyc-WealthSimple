import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, Loader2, ExternalLink, Download } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { getAuditExportUrl } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  application_submitted: 'Application Submitted',
  ai_analysis_completed: 'AI Analysis Complete',
  application_reviewed: 'Application Reviewed',
  processing_failed: 'Processing Failed',
};

const ACTION_COLORS: Record<string, string> = {
  application_submitted: 'bg-blue-100 text-blue-800',
  ai_analysis_completed: 'bg-indigo-100 text-indigo-800',
  application_reviewed: 'bg-emerald-100 text-emerald-800',
  processing_failed: 'bg-red-100 text-red-800',
};

export function AuditLog() {
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLog({
    action: actionFilter || undefined,
    actor: actorFilter || undefined,
    page,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Complete chronological record of system and human actions
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Actions</option>
          <option value="application_submitted">Submitted</option>
          <option value="ai_analysis_completed">AI Analysis</option>
          <option value="application_reviewed">Reviewed</option>
          <option value="processing_failed">Failed</option>
        </select>

        <select
          value={actorFilter}
          onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Actors</option>
          <option value="applicant">Applicant</option>
          <option value="ai_system">AI System</option>
          <option value="compliance_officer">Compliance Officer</option>
        </select>

        <a
          href={getAuditExportUrl({
            action: actionFilter || undefined,
            actor: actorFilter || undefined,
          })}
          download
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data?.entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No audit entries</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Actor</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Application</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                          ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-800'
                        )}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground capitalize">
                      {entry.actor.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3">
                      {entry.application_id ? (
                        <Link
                          to={`/application/${entry.application_id}`}
                          className="text-accent hover:underline inline-flex items-center gap-1"
                        >
                          {entry.application_id.slice(0, 8)}...
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.details ? (
                        <DetailsDisplay details={entry.details} />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.total > 50 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(data.total / 50)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(data.total / 50)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DetailsDisplay({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return <span>—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.slice(0, 4).map(([key, value]) => (
        <span key={key} className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {key.replace(/_/g, ' ')}: {String(value)}
        </span>
      ))}
      {entries.length > 4 && (
        <span className="text-xs text-muted-foreground">+{entries.length - 4} more</span>
      )}
    </div>
  );
}
