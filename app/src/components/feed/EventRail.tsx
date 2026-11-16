import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Car, Check, ChevronLeft, ChevronRight, MapPin, Navigation, Pencil, Users } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';
import { MEMBERS, eur } from '@/lib/data';
import { cn } from '@/lib/utils';
import { goingCount, useRsvps } from '@/lib/rsvp';
import RsvpDialog from '@/components/RsvpDialog';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const AUTOPLAY_MS = 5000;

/** Deterministic 4-member avatar stack per event (profile icon circles). */
function attendeesFor(eventId: string) {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = (h * 31 + eventId.charCodeAt(i)) >>> 0;
  return Array.from({ length: 4 }, (_, i) => MEMBERS[(h + i * 2) % MEMBERS.length]);
}

function AvatarStack({ eventId }: { eventId: string }) {
  const people = attendeesFor(eventId);
  return (
    <span className="flex items-center">
      {people.map((m, i) => (
        <span
          key={m.id}
          title={m.name}
          style={{ zIndex: people.length - i }}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-bmw-blue text-[10px] font-bold text-white',
            i > 0 && '-ml-2.5',
            i % 2 === 1 && 'bg-m-red',
          )}
        >
          {m.avatarInitials}
        </span>
      ))}
    </span>
  );
}

function RailCard({
  event,
  onRsvp,
}: {
  event: ClubEvent;
  onRsvp: (event: ClubEvent) => void;
}) {
  const rsvps = useRsvps();
  const rsvp = rsvps[event.id];
  const going = !!rsvp?.going;
  const count = goingCount(event.id, rsvps);
  const date = new Date(`${event.startDate}T12:00:00`);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

  return (
    <li className="w-full shrink-0 snap-start">
      <article
        className={cn(
          'relative flex h-[510px] flex-col justify-end overflow-hidden rounded-2xl border shadow-card transition-shadow duration-200 hover:shadow-modal sm:h-[600px]',
          going ? 'border-success/50' : 'border-border',
        )}
      >
        {/* Photo + gradient */}
        <img
          src={event.image}
          alt={event.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-dark/90 via-ink-dark/35 to-ink-dark/15" />

        {/* Date badge + event cost */}
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <span className="flex flex-col items-center rounded-xl bg-white/92 px-3.5 py-2 backdrop-blur">
            <span className="font-mono text-xl font-bold leading-none tabular-nums text-ink">{day}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-dark">{month}</span>
          </span>
          <span className="flex items-center gap-1 self-start rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-ink-dark shadow-sm">
            {eur(event.packagePrice)}
            <span className="text-[10px] font-semibold text-ink-dark/70">/ person</span>
          </span>
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-ink-dark/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
          {event.category}
        </span>

        {/* Body */}
        <div className="relative p-5 sm:p-6">
          <h3 className="line-clamp-1 font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {event.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/75">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            <AvatarStack eventId={event.id} />
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="font-mono text-base tabular-nums">{count}</span>
              <span className="text-white/75">people going</span>
            </p>
          </div>

          {/* RSVP + directions row */}
          <div className="mt-4 flex items-center justify-between gap-3">
            {going ? (
              <button
                onClick={() => onRsvp(event)}
                className="flex h-11 items-center justify-between gap-3 rounded-xl bg-success px-4 text-sm font-bold text-white transition-colors hover:bg-success/90 active:scale-[0.98]"
              >
                <span className="flex items-center gap-1.5">
                  <Check size={15} strokeWidth={3} />
                  You're going
                  {rsvp!.guests > 0 && (
                    <span className="flex items-center gap-0.5 font-mono tabular-nums">
                      · <Users size={13} /> +{rsvp!.guests}
                    </span>
                  )}
                  {rsvp!.cars > 0 && (
                    <span className="flex items-center gap-0.5 font-mono tabular-nums">
                      · <Car size={13} /> {rsvp!.cars}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/85">
                  <Pencil size={12} /> Edit
                </span>
              </button>
            ) : (
              <button
                onClick={() => onRsvp(event)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-bmw-blue px-5 text-sm font-bold text-white transition-colors hover:bg-bmw-blue-dark active:scale-[0.98]"
              >
                <Check size={15} strokeWidth={3} />
                I'm coming
              </button>
            )}

            {/* Directions — bottom right */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Directions to ${event.location}`}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/92 px-4 text-sm font-bold text-ink backdrop-blur transition-colors hover:bg-white active:scale-[0.98]"
            >
              <Navigation size={15} className="text-bmw-blue" />
              <span className="hidden sm:inline">Directions</span>
            </a>
          </div>
        </div>
      </article>
    </li>
  );
}

/**
 * Full-width upcoming-events carousel at the top of the feed — one event at a
 * time, snap scrolling, on-image carrots, position dots, 5s autoplay.
 * Live "people going" counts + per-event RSVP, synced with the Events page
 * through the shared RSVP store.
 */
export default function EventRail({ events }: { events: ClubEvent[] }) {
  const [rsvpEvent, setRsvpEvent] = useState<ClubEvent | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const scrollTo = useCallback((index: number) => {
    const list = listRef.current;
    if (!list) return;
    const clamped = Math.max(0, Math.min(events.length - 1, index));
    list.scrollTo({ left: clamped * list.clientWidth, behavior: 'smooth' });
  }, [events.length]);

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list || list.clientWidth === 0) return;
    setActive(Math.round(list.scrollLeft / list.clientWidth));
  }, []);

  // Autoplay: advance one event every 5s, wrap around; pause on hover / open dialog
  useEffect(() => {
    if (paused || rsvpEvent || events.length <= 1) return;
    const t = window.setInterval(() => {
      scrollTo((active + 1) % events.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [active, paused, rsvpEvent, events.length, scrollTo]);

  if (events.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: EASE }}
      aria-label="Upcoming events"
      className="-mx-2 mb-6 sm:-mx-4 lg:-mx-6"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight text-ink">
          <CalendarDays size={16} className="text-bmw-blue" />
          Upcoming events
        </h2>
        <Link
          to="/events"
          className="flex items-center gap-1 text-xs font-semibold text-bmw-blue transition-colors hover:text-bmw-blue-dark"
        >
          All events <ArrowRight size={13} />
        </Link>
      </header>

      <div
        className="group relative"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <ul
          ref={listRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {events.map((e) => (
            <RailCard key={e.id} event={e} onRsvp={setRsvpEvent} />
          ))}
        </ul>

        {/* On-image left / right scroll carrots */}
        <button
          onClick={() => scrollTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous event"
          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink-dark/45 text-white backdrop-blur transition-all hover:bg-ink-dark/70 disabled:opacity-0"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => scrollTo(active + 1)}
          disabled={active === events.length - 1}
          aria-label="Next event"
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink-dark/45 text-white backdrop-blur transition-all hover:bg-ink-dark/70 disabled:opacity-0"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Position dots */}
      <div className="mt-3 flex justify-center gap-1.5">
        {events.map((e, i) => (
          <button
            key={e.id}
            onClick={() => scrollTo(i)}
            aria-label={`Go to event ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === active ? 'w-5 bg-m-red' : 'w-1.5 bg-ink-faint/40 hover:bg-ink-faint',
            )}
          />
        ))}
      </div>

      <AnimatePresence>
        {rsvpEvent && <RsvpDialog key={rsvpEvent.id} event={rsvpEvent} onClose={() => setRsvpEvent(null)} />}
      </AnimatePresence>
    </motion.section>
  );
}
