import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, Check, MapPin, X } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';
import { eur, formatDate } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { goingCount, useRsvps } from '@/lib/rsvp';
import { RsvpForm } from '@/components/RsvpDialog';
import AvatarStack from './AvatarStack';
import { dateRange, membersFor, outboundOptions, packageSaving } from './eventUtils';

const INCLUSIONS = [
  'Return flight from your home airport',
  '2 nights partner hotel',
  'Event pass & paddock access',
  'Airport transfers',
];

/**
 * Event detail modal (events.md §4) — opens from "View package".
 * RSVP flow is the shared RsvpForm (going toggle + guests/cars steppers),
 * writing to the shared RSVP store so it stays in sync with the feed rail.
 */
export default function EventModal({
  event,
  seatsLeft,
  onClose,
}: {
  event: ClubEvent;
  /** Seats remaining after any RSVP. */
  seatsLeft: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const members = membersFor(event);
  const options = outboundOptions(event);
  const [selected, setSelected] = useState(1);
  const rsvps = useRsvps();
  const joined = !!rsvps[event.id]?.going;
  const goingTotal = goingCount(event.id, rsvps);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-ink-dark/55 backdrop-blur-[6px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-modal"
      >
        {/* Image header with clip reveal */}
        <motion.div
          initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
          animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative h-[240px] overflow-hidden"
        >
          <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-dark/70 via-ink-dark/10 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">
            {event.category}
          </span>
          {joined && (
            <span className="absolute left-4 top-12 flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-white">
              <Check size={12} strokeWidth={3} />
              You're going
            </span>
          )}
          <span className="absolute bottom-4 left-4 rounded-lg bg-ink-dark/80 px-2.5 py-1 font-mono text-xs font-medium tracking-wide text-white backdrop-blur">
            {dateRange(event)}
          </span>
          <motion.button
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-ink-dark/50 p-2 text-white backdrop-blur transition-colors hover:bg-ink-dark/70"
          >
            <X size={18} />
          </motion.button>
        </motion.div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink">{event.title}</h3>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-ink-muted">
            <span>
              {formatDate(event.startDate, { day: '2-digit', month: 'short', year: 'numeric' })} →{' '}
              {formatDate(event.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-ink-faint" />
              {event.location} · {event.nearestAirport}
            </span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink/70">
            {event.description} The MFlight travel desk bundles flights, hotel and event access into one member
            package — you just pick a date and show up.{' '}
            {joined ? (
              <>
                <span className="font-semibold text-success">Your seat is reserved.</span> {seatsLeft}{' '}
                {seatsLeft === 1 ? 'package seat remains' : 'package seats remain'} for this departure window.
              </>
            ) : (
              <>
                {seatsLeft} package {seatsLeft === 1 ? 'seat remains' : 'seats remain'} for this departure window.
              </>
            )}
          </p>

          {/* Travel package block */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
            className="mt-6 rounded-xl border border-bmw-blue/10 bg-bmw-blue-light p-5"
          >
            <h4 className="font-display text-base font-bold text-ink-dark">MFlight member package</h4>
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {INCLUSIONS.map((item) => (
                <motion.li
                  key={item}
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                  className="flex items-center gap-2 text-sm text-ink/85"
                >
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-bmw-blue text-white">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {item}
                </motion.li>
              ))}
            </motion.ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink/80">
                From <span className="font-display text-xl font-extrabold text-bmw-blue">{eur(event.packagePrice)}</span>{' '}
                per member
              </p>
              <span className="rounded-full bg-gold-light px-2.5 py-1 text-[11px] font-bold text-gold-dark">
                Save {eur(packageSaving(event))} vs booking separately
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.perks.map((perk) => (
                <span key={perk} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink/75">
                  {perk}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Outbound date selector */}
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Suggested outbound dates</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {options.map((opt, i) => (
              <button
                key={opt.iso}
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3.5 py-2 font-mono text-xs transition-colors',
                  selected === i
                    ? 'border-bmw-blue bg-bmw-blue text-white'
                    : 'border-border bg-white text-ink hover:border-bmw-blue/40',
                )}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className={selected === i ? 'text-sky' : 'text-ink-muted'}>{eur(opt.price)}</span>
              </button>
            ))}
          </div>

          {/* RSVP — shared flow: going toggle + guests/cars steppers (synced with feed rail) */}
          <div className="mt-6 rounded-xl border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Your RSVP</p>
            <RsvpForm event={event} />
          </div>
          <button
            onClick={() =>
              toast('Event added to your calendar', { title: `${event.title} · ${dateRange(event)}`, variant: 'success' })
            }
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-bmw-blue/30 px-6 text-sm font-semibold text-bmw-blue transition-colors hover:border-bmw-blue hover:bg-bmw-blue-light/60"
          >
            <CalendarPlus size={16} />
            Add to calendar
          </button>

          {/* Members going — live count from the shared RSVP store */}
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
            <AvatarStack names={members.names} />
            <p className="text-xs leading-relaxed text-ink-muted">
              <span className="font-semibold text-ink">{members.names.slice(0, 3).join(', ')}</span> and{' '}
              <span className="font-mono font-semibold tabular-nums text-ink">{Math.max(0, goingTotal - 3)}</span>{' '}
              other members are going
              {joined && <span className="font-semibold text-success"> — including you</span>}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
