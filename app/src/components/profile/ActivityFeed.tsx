import { Activity, CalendarDays, CarFront, Newspaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CLUB_EVENTS, MEMBER_PROFILE, POSTS, carsByOwner, formatDate, timeAgo } from '@/lib/data';
import { getRsvps } from '@/lib/rsvp';
import { useStore } from '@/lib/store';

interface ActivityItem {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  iso: string;
}

/** Derive the member's recent activity from posts, garage additions and events. */
function buildActivity(): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const post of POSTS.filter((p) => p.authorId === MEMBER_PROFILE.id)) {
    items.push({
      id: `post-${post.id}`,
      icon: Newspaper,
      title: 'Posted to the club feed',
      detail: post.text,
      iso: post.createdAt,
    });
  }

  for (const car of carsByOwner(MEMBER_PROFILE.id)) {
    items.push({
      id: `car-${car.id}`,
      icon: CarFront,
      title: `Added the ${car.year} ${car.make} ${car.model}`,
      detail: `${car.paint.name} · ${car.engine.hp} hp · ${car.transmission}`,
      iso: car.purchase.date || new Date().toISOString(),
    });
  }

  const rsvps = getRsvps();
  const upcoming = [...CLUB_EVENTS]
    .filter((e) => rsvps[e.id] && new Date(e.endDate).getTime() > Date.now())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);
  for (const ev of upcoming) {
    items.push({
      id: `event-${ev.id}`,
      icon: CalendarDays,
      title: `${rsvps[ev.id]?.status === 'waitlist' ? 'Waitlisted' : 'Registered'} — ${ev.title}`,
      detail: `${ev.location} · starts ${formatDate(ev.startDate)}`,
      iso: ev.startDate,
    });
  }

  return items.sort((a, b) => b.iso.localeCompare(a.iso)).slice(0, 6);
}

/** Right-sidebar activity feed: compact icon rows with relative timestamps. */
export default function ActivityFeed() {
  useStore();
  const items = buildActivity();

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
          <Activity size={16} />
        </span>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">
          Activity
        </h2>
      </header>

      {items.length === 0 && <p className="mt-4 text-[13px] text-ink-muted">No activity yet — post, add a car or RSVP to an event.</p>}
      <ul className="mt-4 divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
              <item.icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-semibold text-ink">{item.title}</p>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                  {new Date(item.iso).getTime() <= Date.now()
                    ? timeAgo(item.iso)
                    : formatDate(item.iso, { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
