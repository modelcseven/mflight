import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Three slanted bars — the MFlight mark. Light blue / blue / gold in dark; light blue / blue / navy in light. */
export function StripeMark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 'h-3.5' : size === 'lg' ? 'h-7' : 'h-5';
  const w = size === 'lg' ? 'w-[6px]' : 'w-1';
  return (
    <span aria-hidden className={cn('inline-flex -skew-x-[20deg] gap-[3px]', className)}>
      <i className={cn('block rounded-[1px] bg-sky', h, w)} />
      <i className={cn('block rounded-[1px] bg-bmw-blue', h, w)} />
      <i className={cn('block rounded-[1px] bg-hot dark:bg-hot [html[data-theme=light]_&]:bg-[#0B2E6B]', h, w)} />
    </span>
  );
}

export function ThemeToggle({ className, overlay = false }: { className?: string; overlay?: boolean }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
        overlay ? 'bg-black/55 text-white hover:bg-black/70' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
        className,
      )}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

/** Small count badge used on icons (messages, notifications). */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-navbar bg-hot px-1 text-[10px] font-bold leading-none text-hot-on',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}
