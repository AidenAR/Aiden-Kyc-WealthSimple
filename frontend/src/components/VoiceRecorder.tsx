import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  passphrase: string;
  onRecorded: (blob: Blob | null) => void;
}

export function VoiceRecorder({ passphrase, onRecorded }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        cancelAnimationFrame(animRef.current);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        onRecorded(blob);
        setState('recorded');
      };

      mediaRecorder.start(250);
      setState('recording');
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);

      const tick = () => {
        if (analyserRef.current) {
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(avg / 128);
        }
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setState('idle');
    }
  }, [onRecorded]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const playback = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
    audio.play();
    setPlaying(true);
  }, []);

  const discard = useCallback(() => {
    audioRef.current?.pause();
    blobRef.current = null;
    onRecorded(null);
    setState('idle');
    setDuration(0);
    setLevel(0);
    setPlaying(false);
  }, [onRecorded]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-4 w-4 text-accent" />
          <span className="text-xs font-medium text-foreground">Read aloud:</span>
        </div>
        <p className="text-sm text-foreground font-medium italic">
          &ldquo;{passphrase}&rdquo;
        </p>
      </div>

      <div className="flex items-center gap-3">
        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors animate-pulse"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-150"
                  style={{ width: `${Math.min(level * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                {formatTime(duration)}
              </span>
            </div>
          </>
        )}

        {state === 'recorded' && (
          <>
            <button
              type="button"
              onClick={playback}
              disabled={playing}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                playing
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'border-border text-foreground hover:bg-muted'
              )}
            >
              <Play className="h-3.5 w-3.5" />
              {playing ? 'Playing...' : 'Play'}
            </button>
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
            <button
              type="button"
              onClick={discard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Re-record
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Recorded</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
