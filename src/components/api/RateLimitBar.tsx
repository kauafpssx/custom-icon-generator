import { Key } from 'lucide-react';

export interface RateLimitInfo {
  tier: string;
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

export function RateLimitBar({ rl }: { rl: RateLimitInfo }) {
  const isUnlimited = rl.tier === 'master';
  const pct = rl.limit !== null && rl.limit > 0
    ? rl.remaining !== null
      ? (rl.remaining / rl.limit) * 100
      : 100
    : null;
  const unknownRemaining = rl.remaining === null && rl.limit !== null;

  const barColor = pct === null || isUnlimited
    ? 'bg-violet-500'
    : pct > 50 ? 'bg-emerald-500'
    : pct > 10 ? 'bg-amber-500'
    : 'bg-red-500';

  const labelColor = pct === null || isUnlimited
    ? 'text-violet-400'
    : pct > 50 ? 'text-emerald-400'
    : pct > 10 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="border rounded-lg px-3 py-2.5 bg-muted/20 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5">
          <Key className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Rate limit</span>
          <span className={`font-mono font-semibold ${labelColor}`}>{rl.tier}</span>
        </span>
        <span className="font-mono text-muted-foreground">
          {isUnlimited
            ? '∞ unlimited'
            : rl.limit !== null
            ? rl.remaining !== null
              ? `${rl.remaining} / ${rl.limit} remaining`
              : `? / ${rl.limit} remaining`
            : '—'}
        </span>
      </div>
      {!isUnlimited && pct !== null && (
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor} ${unknownRemaining ? 'opacity-30' : ''}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}
