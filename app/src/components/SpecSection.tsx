import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpecRow {
  label: string;
  value: ReactNode;
  /** Render value in large mono type (for HP, torque, tire sizes…). */
  mono?: boolean;
}

/**
 * Spec panel section: icon + header, then perfectly aligned label/value rows.
 * Values marked `mono` use tabular mono type per the design system.
 */
export default function SpecSection({
  icon: Icon,
  title,
  rows,
  className,
}: {
  icon: LucideIcon;
  title: string;
  rows: SpecRow[];
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6', className)}>
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
          <Icon size={16} />
        </span>
        <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">{title}</h3>
      </header>
      <dl className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-[13px] text-ink-muted">{row.label}</dt>
            <dd
              className={cn(
                'text-right text-[13px] font-medium text-ink',
                row.mono && 'font-mono text-sm font-semibold tabular-nums',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
