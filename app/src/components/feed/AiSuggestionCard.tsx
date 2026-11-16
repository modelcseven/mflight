import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { Car } from '@/lib/data';
import { carPhoto, memberById } from '@/lib/data';

/**
 * Reserved AI slot (redesign-spec §AI Layout Hooks): suggests a club car the
 * member does NOT own, with a gold "AI pick" badge and a reason line derived
 * from shared semanticTags with the member's own garage.
 */
export default function AiSuggestionCard({ car, sharedTags }: { car: Car; sharedTags: string[] }) {
  const owner = memberById(car.ownerId);
  const reason = car.featured
    ? `Chosen by the club${owner ? ` · ${owner.name}'s garage` : ''}`
    : sharedTags.length > 0
      ? `Matched to your garage: ${sharedTags.slice(0, 3).join(' · ')}`
      : `Trending in the club: ${car.semanticTags.slice(0, 3).join(' · ')}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-card"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight text-ink">
          <Sparkles size={16} className="text-gold-dark" />
          {car.featured ? 'Car of the Month' : 'AI suggested for you'}
        </h3>
        <span className="rounded-full bg-gradient-to-b from-[#E9C766] via-[#C9A227] to-[#8A6D1A] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
          {car.featured ? 'Featured' : 'AI pick'}
        </span>
      </header>

      <Link to={`/garage/${car.id}`} className="group mt-4 block px-5">
        <div className="relative overflow-hidden rounded-xl border border-border">
          <img
            src={carPhoto(car)}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-ink backdrop-blur-sm">
            {car.year}
          </span>
        </div>
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/garage/${car.id}`} className="block truncate font-display text-base font-extrabold tracking-tight text-ink transition-colors hover:text-bmw-blue">
              {car.make} {car.model}
            </Link>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {car.engine.code} · {car.engine.displacement} · owned by {owner?.firstName ?? 'a club member'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-bold leading-none tabular-nums text-bmw-blue">{car.engine.hp}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">hp</p>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-gold-light px-3.5 py-2.5 text-xs leading-relaxed text-gold-dark">
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          {reason}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span
            className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
            style={{ backgroundColor: car.paint.hex }}
            title={car.paint.name}
          />
          <Link
            to={`/garage/${car.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-bmw-blue transition-colors hover:text-[#165CAD]"
          >
            View in garage <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
