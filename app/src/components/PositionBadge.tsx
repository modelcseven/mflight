import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Club office badge (President, Vice President…), set by a super admin. */
export default function PositionBadge({ position, size = 'sm', className }: { position?: string | null; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  if (!position) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-bmw-blue/30 bg-bmw-blue-light font-bold uppercase text-bmw-blue',
        size === 'xs' && 'px-1.5 py-px text-[9px] tracking-[0.08em]',
        size === 'sm' && 'px-2 py-0.5 text-[10px] tracking-[0.1em]',
        size === 'md' && 'px-2.5 py-1 text-[11px] tracking-[0.12em]',
        className,
      )}
    >
      <Award size={size === 'md' ? 13 : 11} aria-hidden />
      {position}
    </span>
  );
}
