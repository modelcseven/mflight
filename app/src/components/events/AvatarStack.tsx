import { cn } from '@/lib/utils';
import { initialsOf } from './eventUtils';

const COLORS = ['bg-bmw-blue', 'bg-bmw-blue-dark', 'bg-gold', 'bg-success', 'bg-warning'];

/** Stacked avatar circles with initials, ring-2 white (events.md §3). */
export default function AvatarStack({
  names,
  size = 'md',
  className,
}: {
  names: string[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-8 w-8 text-[10px]';
  return (
    <div className={cn('flex -space-x-2', className)}>
      {names.slice(0, 4).map((name, i) => (
        <span
          key={name}
          title={name}
          className={cn(
            'flex items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-white',
            dim,
            COLORS[i % COLORS.length],
          )}
        >
          {initialsOf(name)}
        </span>
      ))}
    </div>
  );
}
