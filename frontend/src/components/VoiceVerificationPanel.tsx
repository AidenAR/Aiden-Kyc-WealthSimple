import { useRef, useState } from 'react';
import { Mic, CheckCircle, XCircle, AlertTriangle, Info, Volume2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceVerification {
  passphrase_match: boolean;
  passphrase_similarity: number;
  transcription: string;
  expected_passphrase: string;
  spoken_name: string | null;
  name_matches_claim: boolean;
  audio_quality: string;
  confidence: number;
  language_detected: string;
  anomalies: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }>;
  verification_result: string;
  explanation: string;
}

const SEVERITY_STYLES = {
  critical: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
};

const RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: 'bg-emerald-100 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'PASS' },
  fail: { bg: 'bg-red-100 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', label: 'FAIL' },
  inconclusive: { bg: 'bg-amber-100 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', label: 'INCONCLUSIVE' },
  error: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'ERROR' },
};

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <button
        onClick={toggle}
        className="p-1.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className="text-[10px] text-muted-foreground font-medium">
        {playing ? 'Playing enrolled sample…' : 'Play enrolled voice sample'}
      </span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}

export function VoiceVerificationPanel({ data, voiceUrl }: { data: VoiceVerification; voiceUrl?: string | null }) {
  const resultStyle = RESULT_STYLES[data.verification_result] || RESULT_STYLES.error;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="h-4 w-4 text-accent" />
          Voice Verification
        </h2>
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', resultStyle.bg, resultStyle.text)}>
          {resultStyle.label}
        </span>
      </div>

      {voiceUrl && <AudioPlayer src={voiceUrl} />}
      {voiceUrl && <div className="h-3" />}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground">{(data.passphrase_similarity * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Passphrase Match</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground">{(data.confidence * 100).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Confidence</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-foreground capitalize">{data.audio_quality}</p>
          <p className="text-[10px] text-muted-foreground">Audio Quality</p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Expected</span>
          </div>
          <p className="text-xs text-foreground italic">&ldquo;{data.expected_passphrase}&rdquo;</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Mic className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Transcribed</span>
          </div>
          <p className="text-xs text-foreground italic">&ldquo;{data.transcription || '(empty)'}&rdquo;</p>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name Spoken</span>
          <span className="font-medium text-foreground">{data.spoken_name || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name Matches Claim</span>
          <span className={cn('font-medium', data.name_matches_claim ? 'text-emerald-600' : 'text-red-600')}>
            {data.name_matches_claim ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Language</span>
          <span className="font-medium text-foreground">{data.language_detected}</span>
        </div>
      </div>

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
