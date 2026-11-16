import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const ANGLE_LABELS = ['Front ¾', 'Rear ¾', 'Detail'];

/**
 * Multi-angle gallery: large 16:9 hero photo with crossfade, horizontal
 * thumbnail strip underneath. Active thumbnail gets a BMW-blue ring.
 */
export default function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, photos.length - 1);

  return (
    <div>
      {/* Hero */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-slate-100 shadow-card">
        <AnimatePresence initial={false} mode="sync">
          <motion.img
            key={photos[safeActive]}
            src={photos[safeActive]}
            alt={`${alt} — ${ANGLE_LABELS[safeActive] ?? `Photo ${safeActive + 1}`}`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <span className="absolute left-4 top-4 rounded-full bg-ink-dark/70 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
          {ANGLE_LABELS[safeActive] ?? `Photo ${safeActive + 1}`}
        </span>
      </div>

      {/* Thumbnails */}
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {photos.map((src, i) => (
          <button
            key={src}
            onClick={() => setActive(i)}
            aria-label={`View ${ANGLE_LABELS[i] ?? `photo ${i + 1}`}`}
            aria-current={i === safeActive}
            className={cn(
              'relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg border transition-all duration-200 sm:w-28',
              i === safeActive
                ? 'border-bmw-blue ring-2 ring-bmw-blue/40'
                : 'border-border opacity-70 hover:opacity-100',
            )}
          >
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
