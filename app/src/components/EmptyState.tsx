import type { ReactNode } from 'react';
import { CarFront } from 'lucide-react';

/**
 * Empty state: centered illustration (dashed circle + icon), headline, body, CTA.
 */
export default function EmptyState({
  title,
  body,
  action,
  illustration,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {illustration ?? (
        <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-silver bg-bmw-blue-light/60 text-bmw-blue">
          <CarFront size={32} />
        </span>
      )}
      <h3 className="mt-6 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
