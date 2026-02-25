import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Mic,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import {
  getVoiceEnrollment,
  voiceReverify,
  type VoiceReverifyResult,
} from '@/lib/api';

const RESULT_STYLES: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  match: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Voice Match — Identity Confirmed' },
  mismatch: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Voice Mismatch — Identity Not Confirmed' },
  inconclusive: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', label: 'Inconclusive — Please Try Again' },
};

const SEVERITY_STYLES: Record<string, { icon: typeof Info; bg: string; text: string }> = {
  critical: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
};

export function VoiceReverify() {
  const { profile } = useViewMode();
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<VoiceReverifyResult | null>(null);

  const email = profile?.email || '';

  const { data: enrollment, isLoading: enrollLoading } = useQuery({
    queryKey: ['voiceEnrollment', email],
    queryFn: () => getVoiceEnrollment(email),
    enabled: !!email,
  });

  const mutation = useMutation({
    mutationFn: (blob: Blob) => voiceReverify(email, blob),
    onSuccess: (data) => setResult(data),
  });

  const handleVerify = useCallback(() => {
    if (voiceBlob) {
      setResult(null);
      mutation.mutate(voiceBlob);
    }
  }, [voiceBlob, mutation]);

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mic className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No profile set</p>
        <p className="text-sm mt-1">Set up your profile first to use voice verification.</p>
      </div>
    );
  }

  if (enrollLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const passphrase = `My name is ${profile.name || email} and I am verifying my identity`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-accent" />
          Voice Re-verification
        </h1>
        <p className="text-muted-foreground mt-1">
          Quickly verify your identity by recording the same passphrase you used during enrollment.
        </p>
      </div>

      {!enrollment?.enrolled ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Mic className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-lg font-medium text-foreground mb-1">No Voice Enrolled</p>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have a voice sample on file yet.
            Submit an application with a voice recording to enroll your voice biometrics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Enrollment Status</h2>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Voice enrolled</span>
              <span className="text-muted-foreground">as</span>
              <span className="font-medium text-foreground">{enrollment.enrolled_name}</span>
            </div>
            {enrollment.enrolled_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Enrolled on {new Date(enrollment.enrolled_at).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Record Verification Sample</h2>
            <VoiceRecorder passphrase={passphrase} onRecorded={setVoiceBlob} />

            <button
              onClick={handleVerify}
              disabled={!voiceBlob || mutation.isPending}
              className={cn(
                'mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                voiceBlob && !mutation.isPending
                  ? 'bg-accent text-white dark:text-black hover:opacity-90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparing voice samples…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Verify My Identity
                </>
              )}
            </button>

            {mutation.isError && (
              <p className="text-sm text-red-600 mt-2">
                {(mutation.error as Error).message}
              </p>
            )}
          </div>

          {result && (
            <div className="space-y-4">
              {(() => {
                const rs = RESULT_STYLES[result.match_result] || RESULT_STYLES.inconclusive;
                const Icon = rs.icon;
                return (
                  <div className={cn('rounded-xl border p-5', rs.bg)}>
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className={cn('h-6 w-6', rs.color)} />
                      <h3 className={cn('text-lg font-semibold', rs.color)}>{rs.label}</h3>
                    </div>
                    <p className="text-sm text-foreground/80">{result.explanation}</p>
                  </div>
                );
              })()}

              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Analysis Details</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {(result.same_speaker_likelihood * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Speaker Match</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {(result.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Confidence</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">
                      {(result.passphrase_consistency * 100).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Passphrase Match</p>
                  </div>
                </div>

                {result.speech_pattern_notes && (
                  <div className="bg-muted/30 rounded-lg p-3 mb-3">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      Speech Pattern Notes
                    </p>
                    <p className="text-xs text-foreground">{result.speech_pattern_notes}</p>
                  </div>
                )}

                {result.anomalies && result.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Anomalies</h4>
                    {result.anomalies.map((a, i) => {
                      const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info;
                      const SevIcon = sev.icon;
                      return (
                        <div key={i} className={cn('p-2.5 rounded-lg border text-xs', sev.bg)}>
                          <div className="flex items-start gap-2">
                            <SevIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', sev.text)} />
                            <div>
                              <span className={cn('font-medium', sev.text)}>
                                {a.type.replace(/_/g, ' ')}
                              </span>
                              <p className="text-foreground/80 mt-0.5">{a.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
