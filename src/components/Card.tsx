interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div
      className={`
        rounded-xl
        bg-[#111113]
        border border-white/[0.06]
        ${noPadding ? '' : 'p-5'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
}

export function StatCard({ label, value, subValue, className = '' }: StatCardProps) {
  return (
    <div className={`${className}`}>
      <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {subValue && <p className="text-xs text-grey-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

interface ScoreCircleProps {
  score: number;
  label: string;
  subLabel?: string;
  color?: string;
}

export function ScoreCircle({ score, label, subLabel, color = '#8b5cf6' }: ScoreCircleProps) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth="3"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
          {score}%
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {subLabel && <p className="text-xs text-grey-500">{subLabel}</p>}
      </div>
    </div>
  );
}
