import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Loader2,
  ShieldAlert,
  UserX,
  ScanEye,
  CheckCircle,
  X,
} from 'lucide-react';
import { getAdversarialScenarios, runAdversarialScenario } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { AdversarialScenario } from '@/types';

const SCENARIO_ICONS: Record<string, typeof FlaskConical> = {
  photoshopped_expiry: ShieldAlert,
  name_mismatch_fraud: UserX,
  blurry_document: ScanEye,
  clean_legitimate: CheckCircle,
};

const SCENARIO_COLORS: Record<string, string> = {
  photoshopped_expiry: 'border-red-300 dark:border-red-700',
  name_mismatch_fraud: 'border-amber-300 dark:border-amber-700',
  blurry_document: 'border-orange-300 dark:border-orange-700',
  clean_legitimate: 'border-emerald-300 dark:border-emerald-700',
};

export function AdversarialTestPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [scenarios, setScenarios] = useState<AdversarialScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    getAdversarialScenarios()
      .then(setScenarios)
      .catch(() => addToast('Failed to load scenarios', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRun(scenarioId: string) {
    setRunning(scenarioId);
    try {
      const result = await runAdversarialScenario(scenarioId);
      addToast(`Scenario created — redirecting to analysis`, 'success');
      onClose();
      navigate(`/application/${result.application_id}`);
    } catch {
      addToast('Failed to run scenario', 'error');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Adversarial Testing Mode</h2>
              <p className="text-xs text-muted-foreground">
                Run simulated fraud attempts to see how the AI catches them
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each scenario creates a real application with pre-analyzed AI results, demonstrating
                how the system detects specific fraud vectors. Click a scenario to run it and
                see the full analysis on the detail page.
              </p>

              {scenarios.map((scenario) => {
                const Icon = SCENARIO_ICONS[scenario.id] || FlaskConical;
                const borderColor = SCENARIO_COLORS[scenario.id] || 'border-border';
                const isRunning = running === scenario.id;

                return (
                  <div
                    key={scenario.id}
                    className={cn(
                      'rounded-xl border-2 p-4 transition-all',
                      borderColor,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-foreground">{scenario.name}</h3>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                            {scenario.attack_type}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                          {scenario.description}
                        </p>
                        <p className="text-xs font-medium text-foreground/70 mb-3">
                          Expected: {scenario.expected_outcome}
                        </p>
                        <button
                          onClick={() => handleRun(scenario.id)}
                          disabled={running !== null}
                          className={cn(
                            'px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2',
                            'bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed',
                          )}
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <FlaskConical className="h-3.5 w-3.5" />
                              Run Scenario
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
