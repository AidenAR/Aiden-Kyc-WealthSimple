import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, CheckCircle, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WebcamCaptureProps {
  onCapture: (file: File | null) => void;
}

export function WebcamCapture({ onCapture }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
          onCapture(file);
        }
      },
      'image/jpeg',
      0.9,
    );
  }

  function retake() {
    setCaptured(null);
    onCapture(null);
    startCamera();
  }

  if (captured) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 bg-black">
          <img src={captured} alt="Captured selfie" className="w-full" />
          <div className="absolute top-3 right-3 bg-emerald-500 text-white p-1.5 rounded-full">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>
        <button
          type="button"
          onClick={retake}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-input text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Retake Photo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      {cameraActive ? (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border-2 border-accent bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[15%] border-2 border-white/30 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={takePhoto}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent text-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition"
            >
              <Camera className="h-4 w-4" />
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="px-4 py-2.5 border border-input rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            error ? 'border-red-300 dark:border-red-700' : 'border-input hover:border-accent',
          )}
        >
          {error ? (
            <>
              <VideoOff className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
            </>
          ) : (
            <>
              <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Live selfie required</p>
              <p className="text-xs text-muted-foreground mb-4">
                Position your face in the frame and take a clear photo
              </p>
            </>
          )}
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            <Camera className="h-4 w-4" />
            Open Camera
          </button>
        </div>
      )}
    </div>
  );
}
