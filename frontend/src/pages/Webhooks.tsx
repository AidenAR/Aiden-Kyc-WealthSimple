import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Webhook,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Save,
  RotateCcw,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';
import {
  getWebhookConfig,
  updateWebhookConfig,
  getWebhookLogs,
  getWebhookScenarios,
  simulateIncomingWebhook,
  type WebhookConfig,
  type WebhookLogEntry,
  type WebhookScenario,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';

const EVENT_LABELS: Record<string, string> = {
  decision_made: 'Decision Made',
  processing_complete: 'Processing Complete',
  high_risk_flagged: 'High Risk Flagged',
};

const DIRECTION_STYLES = {
  incoming: { icon: ArrowDownLeft, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950/30', label: 'IN' },
  outgoing: { icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/30', label: 'OUT' },
};

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle; color: string }> = {
  success: { icon: CheckCircle, color: 'text-emerald-600' },
  failed: { icon: XCircle, color: 'text-red-600' },
  pending: { icon: Clock, color: 'text-amber-600' },
};

export function Webhooks() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Webhook className="h-6 w-6 text-accent" />
          Wealthsimple Webhook Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          Simulates the bi-directional webhook API that would connect VeriFlow to Wealthsimple&apos;s platform
        </p>
      </div>

      <WebhookConfigPanel addToast={addToast} queryClient={queryClient} />
      <SimulateIncoming addToast={addToast} queryClient={queryClient} />
      <WebhookLogPanel />
    </div>
  );
}


type ToastFn = ReturnType<typeof useToast>['addToast'];

function WebhookConfigPanel({
  addToast,
  queryClient,
}: {
  addToast: ToastFn;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: config, isLoading } = useQuery({
    queryKey: ['webhookConfig'],
    queryFn: getWebhookConfig,
  });

  const [draft, setDraft] = useState<WebhookConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config && !draft) setDraft(config);
  }, [config, draft]);

  const saveMutation = useMutation({
    mutationFn: updateWebhookConfig,
    onSuccess: (saved) => {
      setDraft(saved);
      setDirty(false);
      queryClient.setQueryData(['webhookConfig'], saved);
      addToast('Webhook configuration saved', 'success');
    },
    onError: () => addToast('Failed to save webhook config', 'error'),
  });

  const update = useCallback(<K extends keyof WebhookConfig>(key: K, value: WebhookConfig[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }, []);

  if (isLoading || !draft) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          Connection Settings
        </h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={() => { setDraft(config!); setDirty(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate(draft)}
            disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white dark:text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
          </label>
          <span className="text-sm font-medium text-foreground">
            {draft.enabled ? 'Webhooks enabled' : 'Webhooks disabled'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Callback URL</label>
            <input
              type="text"
              value={draft.callback_url}
              onChange={(e) => update('callback_url', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">HMAC Secret</label>
            <input
              type="password"
              value={draft.secret}
              onChange={(e) => update('secret', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Subscribed Events</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(draft.events).map(([key, enabled]) => (
              <label
                key={key}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-colors',
                  enabled
                    ? 'border-accent/30 bg-accent/5 text-foreground'
                    : 'border-border bg-muted/30 text-muted-foreground'
                )}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() =>
                    update('events', { ...draft.events, [key]: !enabled })
                  }
                  className="h-3 w-3 rounded border-border text-accent focus:ring-accent"
                />
                {EVENT_LABELS[key] || key}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function SimulateIncoming({
  addToast,
  queryClient,
}: {
  addToast: ToastFn;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data } = useQuery({
    queryKey: ['webhookScenarios'],
    queryFn: getWebhookScenarios,
  });

  const scenarios = data?.scenarios || [];

  const fireMutation = useMutation({
    mutationFn: (idx: number) => simulateIncomingWebhook(idx),
    onSuccess: () => {
      addToast('Incoming webhook simulated — application created', 'success');
      queryClient.invalidateQueries({ queryKey: ['webhookLogs'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: () => addToast('Simulation failed', 'error'),
  });

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <ArrowDownLeft className="h-4 w-4 text-blue-500" />
        Simulate Incoming Webhook
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Trigger a mock Wealthsimple &rarr; VeriFlow webhook, simulating a client whose auto-verification failed
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s: WebhookScenario) => (
          <div
            key={s.index}
            className="border border-border rounded-lg p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{s.name}</span>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                s.priority === 'high'
                  ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
              )}>
                {s.priority}
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex-1 mb-3">{s.failure_details}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
              <span className="bg-muted px-1.5 py-0.5 rounded">{s.country}</span>
              <span className="bg-muted px-1.5 py-0.5 rounded">{s.document_type}</span>
              <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                {s.failure_reason.replace(/_/g, ' ')}
              </span>
            </div>
            <button
              onClick={() => fireMutation.mutate(s.index)}
              disabled={fireMutation.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {fireMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Fire Webhook
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


function WebhookLogPanel() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['webhookLogs', filter],
    queryFn: () => getWebhookLogs(filter),
    refetchInterval: 5000,
  });

  const logs = data?.logs || [];

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Eye className="h-4 w-4 text-accent" />
          Webhook Activity Log
        </h2>
        <div className="flex gap-1">
          {[
            { label: 'All', value: undefined },
            { label: 'Incoming', value: 'incoming' },
            { label: 'Outgoing', value: 'outgoing' },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                filter === f.value
                  ? 'bg-accent text-white dark:text-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No webhook events yet. Try simulating one above.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log: WebhookLogEntry) => {
            const dir = DIRECTION_STYLES[log.direction] || DIRECTION_STYLES.incoming;
            const DirIcon = dir.icon;
            const st = STATUS_STYLES[log.status] || STATUS_STYLES.pending;
            const StIcon = st.icon;
            const isExpanded = expanded === log.id;

            return (
              <div key={log.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className={cn('p-1.5 rounded-md', dir.bg)}>
                    <DirIcon className={cn('h-3.5 w-3.5', dir.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{dir.label}</span>
                      <span className="text-xs font-medium text-foreground">
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                      {log.application_id && (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {log.application_id.slice(0, 8)}
                        </code>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <StIcon className={cn('h-4 w-4', st.color)} />
                  {log.status_code && (
                    <span className={cn(
                      'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                      log.status_code < 300
                        ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700'
                        : 'bg-red-100 dark:bg-red-950/30 text-red-700'
                    )}>
                      {log.status_code}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {log.error && (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">Error</p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{log.error}</p>
                      </div>
                    )}

                    {log.payload && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Payload</p>
                        <pre className="text-[10px] bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-48 text-foreground font-mono">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.response_body && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Response</p>
                        <pre className="text-[10px] bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-32 text-foreground font-mono">
                          {(() => {
                            try { return JSON.stringify(JSON.parse(log.response_body), null, 2); }
                            catch { return log.response_body; }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
