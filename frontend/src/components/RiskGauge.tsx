import { cn } from '@/lib/utils';

interface GaugeProps {
  value: number;
  label: string;
  size?: number;
  colorScheme?: 'risk' | 'confidence';
}

export function RiskGauge({ value, label, size = 100, colorScheme = 'risk' }: GaugeProps) {
  const percentage = Math.round(value * 100);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value * circumference);

  function getColor() {
    if (colorScheme === 'confidence') {
      if (value >= 0.8) return 'text-emerald-500';
      if (value >= 0.6) return 'text-amber-500';
      return 'text-red-500';
    }
    if (value <= 0.3) return 'text-emerald-500';
    if (value <= 0.7) return 'text-amber-500';
    return 'text-red-500';
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/50"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('transition-all duration-700 ease-out', getColor())}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{percentage}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
