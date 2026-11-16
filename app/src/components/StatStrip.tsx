import { cn } from '@/lib/utils';

export interface StatItem {
  value: string | number;
  label: string;
}

/** Horizontal stats row: big mono value + small label, in a clean white strip. */
export default function StatStrip({ stats, className }: { stats: StatItem[]; className?: string }) {
  return (
    <div
      className={cn(
        'grid rounded-2xl border border-border bg-white px-2 py-4 shadow-card sm:px-4',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn('flex flex-col items-center gap-1 px-2 text-center', i > 0 && 'border-l border-border')}
        >
          <span className="font-mono text-xl font-bold tabular-nums text-ink sm:text-2xl">{s.value}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
