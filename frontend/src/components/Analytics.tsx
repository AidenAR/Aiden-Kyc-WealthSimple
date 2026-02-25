import { cn } from '@/lib/utils';
import type { Stats } from '@/types';

export function Analytics({ stats }: { stats: Stats }) {
  const riskData = [
    { label: 'Low', value: stats.risk_distribution.low || 0, color: 'bg-emerald-500' },
    { label: 'Medium', value: stats.risk_distribution.medium || 0, color: 'bg-amber-500' },
    { label: 'High', value: stats.risk_distribution.high || 0, color: 'bg-red-500' },
  ];
  const totalRisk = riskData.reduce((s, d) => s + d.value, 0);

  const statusData = [
    { label: 'Pending', value: stats.pending_review, color: 'bg-amber-500' },
    { label: 'Approved', value: stats.approved, color: 'bg-emerald-500' },
    { label: 'Rejected', value: stats.rejected, color: 'bg-red-500' },
    { label: 'Processing', value: stats.processing, color: 'bg-indigo-500' },
    { label: 'Failed', value: stats.processing_failed, color: 'bg-red-400' },
    { label: 'Needs Info', value: stats.needs_info, color: 'bg-purple-500' },
  ].filter((d) => d.value > 0);
  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Risk Distribution</h3>
        {totalRisk === 0 ? (
          <p className="text-sm text-muted-foreground">No analyzed applications yet</p>
        ) : (
          <div className="space-y-2.5">
            {riskData.map((d) => (
              <BarRow key={d.label} {...d} total={totalRisk} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Status Breakdown</h3>
        {totalStatus === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet</p>
        ) : (
          <div className="space-y-2.5">
            {statusData.map((d) => (
              <BarRow key={d.label} {...d} total={totalStatus} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Key Metrics</h3>
        <div className="space-y-3">
          <MetricRow
            label="Approval Rate"
            value={stats.approval_rate !== null ? `${Math.round(stats.approval_rate * 100)}%` : '—'}
          />
          <MetricRow
            label="Avg Risk Score"
            value={stats.average_risk_score !== null ? `${Math.round(stats.average_risk_score * 100)}%` : '—'}
          />
          <MetricRow
            label="Avg AI Confidence"
            value={stats.average_confidence !== null ? `${Math.round(stats.average_confidence * 100)}%` : '—'}
          />
          <MetricRow label="Total Reviewed" value={stats.approved + stats.rejected} />
          <MetricRow label="In Queue" value={stats.pending_review} />
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
