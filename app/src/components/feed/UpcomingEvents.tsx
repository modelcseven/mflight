import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateBadge(iso: string): { day: string; month: string } {
  const d = new Date(`${iso}T00:00:00`);
  return { day: String(d.getDate()).padStart(2, '0'), month: MONTHS[d.getMonth()] };
}

/** Sidebar panel: compact upcoming-event cards linking to /events. */
export default function UpcomingEvents({ events }: { events: ClubEvent[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-white p-5 shadow-card"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight text-ink">
          <CalendarDays size={16} className="text-bmw-blue" />
          Upcoming events
        </h3>
        <Link
          to="/events"
          className="flex items-center gap-1 text-xs font-semibold text-bmw-blue transition-colors hover:text-[#165CAD]"
        >
          View all <ArrowRight size={13} />
        </Link>
      </header>

      <ul className="mt-4 space-y-2.5">
        {events.map((e) => {
          const b = dateBadge(e.startDate);
          return (
            <li key={e.id}>
              <Link
                to="/events"
                className="group flex items-center gap-3.5 rounded-xl border border-border/70 p-3 transition-all duration-150 hover:-translate-y-px hover:border-bmw-blue/40 hover:shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-navy-950 text-white">
                  <span className="font-mono text-base font-bold leading-none tabular-nums">{b.day}</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gold">{b.month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-bmw-blue">
                    {e.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin size={12} className="shrink-0 text-ink-faint" />
                    <span className="truncate">{e.location}</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-bg-app px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {e.category}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
