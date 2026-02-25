import { useState } from 'react';
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Globe,
  UserX,
  Newspaper,
} from 'lucide-react';
import { simulateRegulatory } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RegulatorySimRequest, RegulatorySimResponse } from '@/types';

const TOGGLES: Array<{
  key: keyof RegulatorySimRequest;
  label: string;
  description: string;
  icon: typeof Scale;
  regulation: string;
}> = [
  {
    key: 'pep_match',
    label: 'Politically Exposed Person (PEP)',
    description: 'Individual holds or has held a prominent public function',
    icon: UserX,
    regulation: 'PCMLTFA s. 9.6',
  },
  {
    key: 'high_risk_country',
    label: 'High-Risk Jurisdiction',
    description: 'FATF grey-list or sanctioned country',
    icon: Globe,
    regulation: 'FATF Rec. 19',
  },
  {
    key: 'sanctions_hit',
    label: 'Sanctions Match',
    description: 'Potential match on OFAC, UN, EU, or SEMA lists',
    icon: ShieldAlert,
    regulation: 'SEMA / UN Act',
  },
  {
    key: 'adverse_media',
    label: 'Adverse Media',
    description: 'Negative news coverage related to financial crime',
    icon: Newspaper,
    regulation: 'PCMLTFA monitoring',
  },
];

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  blocked: { label: 'BLOCKED', color: 'bg-red-600 text-white' },
  immediate: { label: 'IMMEDIATE', color: 'bg-red-500 text-white' },
  elevated: { label: 'ELEVATED', color: 'bg-amber-500 text-white' },
  standard: { label: 'STANDARD', color: 'bg-emerald-500 text-white' },
};

export function RegulatorySimulator({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [toggles, setToggles] = useState<RegulatorySimRequest>({
    pep_match: false,
    high_risk_country: false,
    sanctions_hit: false,
    adverse_media: false,
  });
  const [result, setResult] = useState<RegulatorySimResponse | null>(null);
  const [loading, setLoading] = useState(false);

  function handleToggle(key: keyof RegulatorySimRequest) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setResult(null);
  }

  async function runSimulation() {
    setLoading(true);
    try {
      const res = await simulateRegulatory(applicationId, toggles);
      setResult(res);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const anyActive = Object.values(toggles).some(Boolean);

  return (
    <div className="bg-card rounded-xl border border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-foreground">Simulate Additional Factors</span>
          <span className="text-xs text-muted-foreground">PEP / sanctions / adverse media</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Country risk and document quality are screened automatically. These factors require external
            databases (PEP lists, sanctions registries, media monitoring) that aren't available in demo mode.
            Toggle them to see how they'd impact this application.
          </p>

          <div className="space-y-2">
            {TOGGLES.map(({ key, label, description, icon: Icon, regulation }) => (
              <label
                key={key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  toggles[key]
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-border hover:bg-muted',
                )}
              >
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={() => handleToggle(key)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                    toggles[key]
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-border',
                  )}
                >
                  {toggles[key] && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <Icon className={cn('h-4 w-4 shrink-0', toggles[key] ? 'text-indigo-600' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{regulation}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={runSimulation}
            disabled={!anyActive || loading}
            className="w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Scale className="h-4 w-4" />
                Run Simulation
              </>
            )}
          </button>

          {result && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Original</p>
                  <p className="text-lg font-bold text-foreground">
                    {result.original_risk_score?.toFixed(2) ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{result.original_risk_level ?? '—'}</p>
                </div>
                <div className="text-2xl text-muted-foreground">→</div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Adjusted</p>
                  <p className={cn(
                    'text-lg font-bold',
                    result.adjusted_risk_level === 'high' ? 'text-red-600 dark:text-red-400' :
                    result.adjusted_risk_level === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                  )}>
                    {result.adjusted_risk_score.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{result.adjusted_risk_level}</p>
                </div>
                <div className="ml-auto">
                  <span className={cn(
                    'text-xs font-bold px-2.5 py-1 rounded-full',
                    PRIORITY_STYLES[result.priority]?.color ?? 'bg-gray-500 text-white',
                  )}>
                    {PRIORITY_STYLES[result.priority]?.label ?? result.priority.toUpperCase()}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">{result.explanation}</p>

              {result.fintrac_flags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">FINTRAC Obligations</p>
                  {result.fintrac_flags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{flag}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.adjustments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Applied Adjustments</p>
                  {result.adjustments.map((adj, i) => (
                    <div key={i} className="bg-muted rounded-lg p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-foreground">{adj.factor}</span>
                        <span className="text-red-600 dark:text-red-400 font-mono">+{adj.boost.toFixed(2)}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{adj.regulation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
