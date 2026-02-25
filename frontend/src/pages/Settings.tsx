import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Shield,
  Globe,
  AlertTriangle,
  Loader2,
  Save,
  RotateCcw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { getScreeningConfig, updateScreeningConfig } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { ScreeningConfig } from '@/types';

export function Settings() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ['screeningConfig'],
    queryFn: getScreeningConfig,
  });

  const [draft, setDraft] = useState<ScreeningConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config && !draft) setDraft(config);
  }, [config, draft]);

  const saveMutation = useMutation({
    mutationFn: updateScreeningConfig,
    onSuccess: (saved) => {
      setDraft(saved);
      setDirty(false);
      queryClient.setQueryData(['screeningConfig'], saved);
      addToast('Screening configuration saved', 'success');
    },
    onError: () => addToast('Failed to save configuration', 'error'),
  });

  const update = useCallback(<K extends keyof ScreeningConfig>(key: K, value: ScreeningConfig[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }, []);

  function handleReset() {
    if (config) {
      setDraft(config);
      setDirty(false);
    }
  }

  if (isLoading || !draft) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-accent" />
            Screening Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure which checks run on every application and fine-tune thresholds
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate(draft)}
            disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white dark:text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <AutoApproveSection draft={draft} update={update} />
        <CheckToggles draft={draft} update={update} />
        <ThresholdsSection draft={draft} update={update} />
        <BoostsSection draft={draft} update={update} />
        <CountryListSection
          title="High-Risk Countries"
          description="Countries on the FATF grey list. Triggers enhanced due diligence."
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          items={draft.high_risk_countries}
          onChange={(v) => update('high_risk_countries', v)}
        />
        <CountryListSection
          title="Elevated-Risk Countries"
          description="Countries flagged for elevated AML/CFT risk. Triggers additional scrutiny."
          icon={<Globe className="h-4 w-4 text-amber-500" />}
          items={draft.elevated_countries}
          onChange={(v) => update('elevated_countries', v)}
        />
        <CountryListSection
          title="Sanctioned Countries"
          description="Countries under comprehensive sanctions. Triggers asset freeze and reporting."
          icon={<Shield className="h-4 w-4 text-red-600" />}
          items={draft.sanctioned_countries}
          onChange={(v) => update('sanctioned_countries', v)}
        />
        <CountryListSection
          title="Sanctions Programs"
          description="Screening databases checked for every application."
          icon={<Shield className="h-4 w-4 text-indigo-500" />}
          items={draft.sanctions_programs}
          onChange={(v) => update('sanctions_programs', v)}
        />
      </div>
    </div>
  );
}


function AutoApproveSection({
  draft,
  update,
}: {
  draft: ScreeningConfig;
  update: <K extends keyof ScreeningConfig>(key: K, value: ScreeningConfig[K]) => void;
}) {
  const aa = draft.auto_approve ?? {
    enabled: false,
    max_risk_score: 0.3,
    min_confidence: 0.85,
    require_facial_match: true,
    min_facial_similarity: 0.7,
    block_on_critical_flags: true,
  };

  function set<K extends keyof typeof aa>(key: K, val: (typeof aa)[K]) {
    update('auto_approve', { ...aa, [key]: val });
  }

  return (
    <div className={cn(
      'rounded-xl border p-5 transition-colors',
      aa.enabled
        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-700'
        : 'bg-card border-border',
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={cn('h-4 w-4', aa.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Auto-Approval</h2>
            <p className="text-xs text-muted-foreground">
              Automatically approve low-risk applications. Rejections always require human review.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={aa.enabled}
            onChange={() => set('enabled', !aa.enabled)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {aa.enabled && (
        <div className="space-y-4 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <SliderField
              label="Max Risk Score"
              value={aa.max_risk_score}
              min={0.05} max={0.5} step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => set('max_risk_score', v)}
            />
            <SliderField
              label="Min AI Confidence"
              value={aa.min_confidence}
              min={0.5} max={1} step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => set('min_confidence', v)}
            />
            <SliderField
              label="Min Facial Similarity"
              value={aa.min_facial_similarity}
              min={0.5} max={1} step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              onChange={(v) => set('min_facial_similarity', v)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm',
              aa.require_facial_match
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-border bg-muted/30',
            )}>
              <input
                type="checkbox"
                checked={aa.require_facial_match}
                onChange={() => set('require_facial_match', !aa.require_facial_match)}
                className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              Require facial match
            </label>
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm',
              aa.block_on_critical_flags
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-border bg-muted/30',
            )}>
              <input
                type="checkbox"
                checked={aa.block_on_critical_flags}
                onChange={() => set('block_on_critical_flags', !aa.block_on_critical_flags)}
                className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              Block if critical flags
            </label>
          </div>
        </div>
      )}
    </div>
  );
}


function CheckToggles({
  draft,
  update,
}: {
  draft: ScreeningConfig;
  update: <K extends keyof ScreeningConfig>(key: K, value: ScreeningConfig[K]) => void;
}) {
  const checks = draft.checks;

  function toggle(key: string) {
    const next = { ...checks, [key]: { ...checks[key], enabled: !checks[key].enabled } };
    update('checks', next);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-accent" />
        Active Checks
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(checks).map(([key, cfg]) => (
          <label
            key={key}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              cfg.enabled
                ? 'border-accent/30 bg-accent/5'
                : 'border-border bg-muted/30 opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={() => toggle(key)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm font-medium text-foreground">{cfg.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


function ThresholdsSection({
  draft,
  update,
}: {
  draft: ScreeningConfig;
  update: <K extends keyof ScreeningConfig>(key: K, value: ScreeningConfig[K]) => void;
}) {
  const t = draft.thresholds;

  function set(key: string, val: number) {
    update('thresholds', { ...t, [key]: val });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">Risk Thresholds</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SliderField
          label="AI Confidence Minimum"
          value={t.ai_confidence_min}
          min={0} max={1} step={0.05}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(v) => set('ai_confidence_min', v)}
        />
        <SliderField
          label="High Risk Threshold"
          value={t.risk_high}
          min={0.1} max={1} step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set('risk_high', v)}
        />
        <SliderField
          label="Medium Risk Threshold"
          value={t.risk_medium}
          min={0} max={0.9} step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => set('risk_medium', v)}
        />
      </div>
    </div>
  );
}


function BoostsSection({
  draft,
  update,
}: {
  draft: ScreeningConfig;
  update: <K extends keyof ScreeningConfig>(key: K, value: ScreeningConfig[K]) => void;
}) {
  const b = draft.boosts;
  const labels: Record<string, string> = {
    high_risk_country: 'High-Risk Country',
    elevated_country: 'Elevated Country',
    expired_document: 'Expired Document',
    low_confidence: 'Low AI Confidence',
    sanctions_match: 'Sanctions Match',
    pep_match: 'PEP Match',
    adverse_media: 'Adverse Media',
  };

  function set(key: string, val: number) {
    update('boosts', { ...b, [key]: val });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1">Risk Score Boosts</h2>
      <p className="text-xs text-muted-foreground mb-4">How much to increase the risk score when each check triggers</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(b).map(([key, val]) => (
          <SliderField
            key={key}
            label={labels[key] || key}
            value={val}
            min={0} max={1} step={0.05}
            format={(v) => `+${(v * 100).toFixed(0)}%`}
            onChange={(v) => set(key, v)}
          />
        ))}
      </div>
    </div>
  );
}


function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs font-mono text-accent">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  );
}


function CountryListSection({
  title,
  description,
  icon,
  items,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newItem, setNewItem] = useState('');

  function add() {
    const trimmed = newItem.trim();
    if (trimmed && !items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...items, trimmed]);
      setNewItem('');
    }
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {icon}
          <div className="text-left">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {items.length}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
              placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}...`}
              className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={add}
              disabled={!newItem.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent text-white dark:text-black text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-foreground"
              >
                {item}
                <button
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
