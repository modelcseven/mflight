/** Shared building blocks for the admin dashboard. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { parseDate } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="font-race text-3xl uppercase text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-white shadow-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          {title && <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.06em] text-ink">{title}</h2>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-ink-faint">
      <Loader2 className="animate-spin" size={22} />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 font-bold underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-ink-muted">{children}</p>;
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'gold';
const TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-gold-light text-gold-dark ring-gold/30',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  neutral: 'bg-silver-light text-ink-muted ring-silver/40',
  info: 'bg-bmw-blue-light text-bmw-blue ring-bmw-blue/25',
  gold: 'bg-gold text-white ring-gold',
};
export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1', TONES[tone])}>{children}</span>;
}

export const statusTone = (s: string): Tone =>
  ({
    Active: 'success', paid: 'success', going: 'success', resolved: 'success', free: 'info',
    Pending: 'warning', pending: 'warning', unpaid: 'warning', waitlist: 'warning', open: 'warning',
    Suspended: 'danger', Rejected: 'danger', refunded: 'danger', cancelled: 'neutral', dismissed: 'neutral', Sold: 'neutral',
  } as Record<string, Tone>)[s] ?? 'neutral';

export function Btn({
  children, busy, tone = 'primary', size = 'md', className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; tone?: 'primary' | 'ghost' | 'danger' | 'gold' | 'subtle'; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={busy || rest.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-[40px] px-3 py-1.5 text-xs md:min-h-0 md:px-2.5' : 'min-h-[44px] px-4 py-2.5 text-sm md:min-h-0',
        tone === 'primary' && 'bg-bmw-blue text-white hover:bg-bmw-blue-dark',
        tone === 'ghost' && 'border border-border bg-white text-ink hover:border-bmw-blue/40 hover:text-bmw-blue',
        tone === 'danger' && 'border border-danger/30 bg-white text-danger hover:bg-danger/5',
        tone === 'gold' && 'bg-gold text-ink-dark hover:bg-[#d8b33a]',
        tone === 'subtle' && 'text-ink-muted hover:bg-slate-100 hover:text-ink',
        className,
      )}
    >
      {busy && <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />}
      {children}
    </button>
  );
}

export const inputCls =
  'h-11 w-full rounded-xl border border-border bg-white px-3 text-sm md:h-10 text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-bmw-blue focus:ring-2 focus:ring-bmw-blue/15 disabled:bg-bg-app';

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-ink-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-3 after:content-[""] disabled:opacity-50', checked ? 'bg-bmw-blue' : 'bg-silver-light')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, 'pl-9 pr-8')} />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
            value === o.id ? 'bg-ink text-bg-app' : 'bg-white text-ink-muted ring-1 ring-border hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Responsive table: a normal table on tablets/desktop; on phones every row becomes a card
 * and each cell is labelled with its column name (labels are filled in automatically).
 */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      const names = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
      root.querySelectorAll('tbody tr').forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((cell) => {
          const td = cell as HTMLTableCellElement;
          const span = td.colSpan || 1;
          td.dataset.label = span > 1 ? '' : names[col] ?? '';
          col += span;
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    <div ref={ref} className="mtable md:overflow-x-auto">
      <table className="w-full text-left text-sm md:min-w-[640px]">
        <thead className="border-b border-border bg-bg-app/70 text-[11px] uppercase tracking-[0.07em] text-ink-faint">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const td = 'px-4 py-3 align-middle';

export function SidePanel({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className={cn('w-full overflow-y-auto p-0 sm:max-w-md', wide && 'sm:max-w-3xl')}>
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="font-display text-lg font-extrabold">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-6 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function Modal({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('max-h-[92dvh] overflow-y-auto rounded-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = 'info', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon: React.ElementType; tone?: Tone; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('min-w-0 rounded-2xl border border-border bg-white p-4 text-left shadow-card sm:p-5', onClick && 'transition-shadow hover:shadow-elevated')}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', TONES[tone])}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 truncate font-mono text-2xl font-bold leading-none tabular-nums text-ink sm:text-[28px]">{value}</p>
      {sub && <p className="mt-2 text-xs text-ink-muted">{sub}</p>}
    </Comp>
  );
}

export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (d: string | null | undefined) =>
  d ? parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
