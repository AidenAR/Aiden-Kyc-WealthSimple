import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Loader2, Search, BarChart3, FlaskConical, MessageSquareWarning } from 'lucide-react';
import { ApplicationCard } from '@/components/ApplicationCard';
import { Analytics } from '@/components/Analytics';
import { AdversarialTestPanel } from '@/components/AdversarialTestPanel';
import { useApplications, useStats } from '@/hooks/useApplications';
import { cn } from '@/lib/utils';

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'processing', label: 'Processing' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'processing_failed', label: 'Failed' },
] as const;

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAdversarial, setShowAdversarial] = useState(false);

  const { data: stats } = useStats();
  const { data, isLoading } = useApplications({
    status: activeTab || undefined,
    risk_level: riskFilter || undefined,
    search: searchQuery || undefined,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Review Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and review KYC applications</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdversarial(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            <FlaskConical className="h-4 w-4" />
            Adversarial Test
          </button>
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
              showAnalytics
                ? 'bg-accent text-white dark:text-black border-accent'
                : 'bg-card text-foreground border-border hover:bg-muted'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </button>
        </div>
      </div>

      {showAnalytics && stats && (
        <div className="mb-8">
          <Analytics stats={stats} />
        </div>
      )}

      {stats && !showAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard icon={Clock} label="Pending Review" value={stats.pending_review} color="text-amber-600 dark:text-amber-400" />
          <StatCard icon={Loader2} label="Processing" value={stats.processing} color="text-indigo-600 dark:text-indigo-400" />
          <StatCard icon={CheckCircle} label="Approved" value={stats.approved} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="text-red-600 dark:text-red-400" />
          <StatCard icon={AlertTriangle} label="High Risk" value={stats.high_risk} color="text-red-600 dark:text-red-400" />
          <StatCard icon={MessageSquareWarning} label="Retraining Queue" value={stats.feedback_queue_size} color="text-amber-500 dark:text-amber-400" />
          <StatCard icon={Shield} label="Total" value={stats.total_applications} color="text-foreground" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex bg-card rounded-lg border border-border p-1 gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activeTab === tab.key
                  ? 'bg-accent text-white dark:text-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Risk Levels</option>
          <option value="high">High Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="low">Low Risk</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data?.applications.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No applications found</p>
          <p className="text-sm mt-1">
            {searchQuery ? 'Try a different search term.' : 'Submit an application to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.applications.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {data.applications.length} of {data.total} applications
        </div>
      )}

      {showAdversarial && (
        <AdversarialTestPanel onClose={() => setShowAdversarial(false)} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
