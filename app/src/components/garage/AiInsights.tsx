import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dedicated AI section slot for the car detail page. Renders generated
 * insights plus reserved suggestion slots. Degrades gracefully: with no
 * insights and no slots it shows a quiet placeholder instead of collapsing.
 */
export default function AiInsights({
  insights,
  className,
  onGenerate,
  generating,
}: {
  insights?: string[];
  className?: string;
  /** Present when the viewer owns the car and AI is configured. */
  onGenerate?: () => void;
  generating?: boolean;
}) {
  const items = insights ?? [];

  return (
    <section
      className={cn(
        'carbon-texture overflow-hidden rounded-2xl border border-navy-800 bg-ink-dark p-5 shadow-card sm:p-6',
        className,
      )}
    >
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold">
          <Sparkles size={16} />
        </span>
        <div>
          <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-white">
            AI Insights
          </h3>
          <p className="text-[11px] text-white/45">Generated from this build sheet</p>
        </div>
        {onGenerate && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-gold/90 px-3 py-1.5 text-[12px] font-bold text-ink-dark transition-colors hover:bg-gold disabled:opacity-60"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {items.length ? 'Regenerate' : 'Generate insights'}
          </button>
        )}
      </header>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((text) => (
            <li key={text} className="flex items-start gap-2.5">
              <Sparkles size={13} className="mt-1 shrink-0 text-gold/80" />
              <p className="text-[13px] leading-relaxed text-white/80">{text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 px-4 py-3 text-[13px] text-white/40">
          {onGenerate ? 'Generate AI insights tailored to this build.' : 'No insights for this car yet.'}
        </p>
      )}

    </section>
  );
}
