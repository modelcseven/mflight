import { motion } from 'framer-motion';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';
import { eur } from '@/lib/data';
import { cn } from '@/lib/utils';
import { goingCount, useRsvps } from '@/lib/rsvp';
import AvatarStack from './AvatarStack';
import { dateBadge, membersFor } from './eventUtils';

export type EventView = 'grid' | 'list';

/**
 * Event card (events.md §3). The outer motion.article handles Framer `layout`
 * (grid↔list toggle); the inner `.event-card-reveal` div is the GSAP scroll-reveal
 * target; `.event-card-img` gets per-card GSAP parallax. Three separate nodes so the
 * libraries never fight over one transform.
 *
 * RSVP state comes from the shared store (useRsvps), so the success chip and
 * members-going count stay in sync with the feed event rail.
 */
export default function EventCard({
  event,
  view,
  onOpen,
}: {
  event: ClubEvent;
  view: EventView;
  onOpen: (event: ClubEvent) => void;
}) {
  const list = view === 'list';
  const members = membersFor(event);
  const rsvps = useRsvps();
  const joined = !!rsvps[event.id]?.going;
  const goingTotal = goingCount(event.id, rsvps);

  return (
    <motion.article
      layout
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className={cn(
        'overflow-hidden rounded-2xl border bg-white shadow-card transition-shadow duration-200 hover:shadow-modal',
        joined ? 'border-success/40' : 'border-border',
      )}
    >
      <div className={cn('event-card-reveal flex h-full', list ? 'flex-col sm:flex-row' : 'flex-col')}>
        {/* Image */}
        <div className={cn('group relative shrink-0 overflow-hidden', list ? 'h-[200px] sm:h-auto sm:w-[300px]' : 'h-[220px]')}>
          <div className="h-full w-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.06]">
            <img src={event.image} alt={event.title} loading="lazy" className="event-card-img h-full w-full object-cover" />
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">
            {event.category}
          </span>
          <span className="absolute right-3 top-3 rounded-lg bg-ink-dark/85 px-2 py-1 font-mono text-[11px] font-medium tracking-wide text-white backdrop-blur">
            {dateBadge(event)}
          </span>
          {joined && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-[11px] font-bold text-white">
              <Check size={12} strokeWidth={3} />
              You're going
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">{event.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin size={13} className="shrink-0 text-ink-faint" />
            {event.location}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/70">{event.description}</p>

          <div className="mt-auto pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Flights + hotel from</p>
                <p className="font-display text-lg font-extrabold text-bmw-blue">{eur(event.packagePrice)}</p>
              </div>
              <button
                onClick={() => onOpen(event)}
                className="group/btn flex h-9 items-center gap-1.5 rounded-lg border border-bmw-blue/30 px-3.5 text-sm font-semibold text-bmw-blue transition-colors hover:border-bmw-blue hover:bg-bmw-blue hover:text-white"
              >
                View package
                <ArrowRight size={15} className="transition-transform duration-200 group-hover/btn:translate-x-1" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <AvatarStack names={members.names} size="sm" />
              <span className="text-xs text-ink-muted">
                +{goingTotal} members going
                {joined && <span className="font-semibold text-success"> · incl. you</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
