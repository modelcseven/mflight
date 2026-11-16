import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Brushed-metal racing plate badge with gold edges showing the club membership
 * number (format MFC-XXXX, mono font, tabular figures).
 *
 * Sizes:
 *  - `sm` — inline chip next to avatars
 *  - `md` — default badge (topbar, garage header, cards)
 *  - `lg` — hero-size plate (Profile hero)
 *
 * A subtle sheen sweep plays on hover.
 */
export default function MembershipPlate({
  number,
  size = 'md',
  className,
}: {
  number: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [sheenKey, setSheenKey] = useState(0);

  const shell = {
    sm: 'rounded-md px-2 py-[3px]',
    md: 'rounded-lg px-3 py-1.5',
    lg: 'rounded-xl px-5 py-3 sm:px-7 sm:py-4',
  }[size];

  const text = {
    sm: 'text-[10px] tracking-[0.08em]',
    md: 'text-xs tracking-[0.1em]',
    lg: 'text-xl sm:text-2xl tracking-[0.14em]',
  }[size];

  const screw = {
    sm: 'hidden',
    md: 'h-1.5 w-1.5',
    lg: 'h-2 w-2',
  }[size];

  return (
    <span
      onMouseEnter={() => setSheenKey((k) => k + 1)}
      className={cn(
        'group relative inline-flex select-none items-center overflow-hidden bg-gradient-to-b from-[#E9C766] via-[#C9A227] to-[#8A6D1A] p-[1.5px] shadow-[0_2px_8px_rgba(3,7,18,0.25),inset_0_1px_0_rgba(255,255,255,0.5)]',
        shell,
        size === 'lg' && 'p-[2px] shadow-[0_10px_30px_-8px_rgba(3,7,18,0.45),inset_0_1px_0_rgba(255,255,255,0.5)]',
        className,
      )}
      title={`Membership No. ${number}`}
    >
      <span
        className={cn(
          'brushed-metal relative flex w-full items-center justify-between gap-3 overflow-hidden',
          {
            sm: 'rounded-[5px] px-1.5 py-px',
            md: 'rounded-[7px] px-2.5 py-1',
            lg: 'rounded-[10px] px-4 py-2.5 sm:px-6 sm:py-3.5',
          }[size],
        )}
      >
        {/* corner screws */}
        <span aria-hidden className={cn('shrink-0 rounded-full bg-gradient-to-br from-white/50 to-black/40 shadow-inner', screw)} />
        <span className={cn('font-mono font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]', text)}>
          {number}
        </span>
        <span aria-hidden className={cn('shrink-0 rounded-full bg-gradient-to-br from-white/50 to-black/40 shadow-inner', screw)} />
        {/* sheen sweep on hover */}
        {sheenKey > 0 && (
          <span
            key={sheenKey}
            aria-hidden
            className="plate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          />
        )}
      </span>
    </span>
  );
}
