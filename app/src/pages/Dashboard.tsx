import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Car, ShoppingBag } from 'lucide-react';
import type { FeedPost } from '@/lib/data';
import { CARS, CLUB_EVENTS, MEMBERS, POSTS, SETTINGS } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { upsert, useStore } from '@/lib/store';
import PostCard from '@/components/PostCard';
import Composer from '@/components/feed/Composer';
import type { ComposerMode } from '@/components/feed/Composer';
import UpcomingEvents from '@/components/feed/UpcomingEvents';
import EventRail from '@/components/feed/EventRail';
import TopMembers from '@/components/feed/TopMembers';
import AiSuggestionCard from '@/components/feed/AiSuggestionCard';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function Dashboard() {
  const { member } = useAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  // Resolve the signed-in member against the club roster (membership no. match).
  const v = useStore();
  const me = useMemo(
    () => MEMBERS.find((m) => m.id === member?.id) ?? MEMBERS[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member?.id, v],
  );

  const posts = POSTS;
  const [params] = useSearchParams();
  const composeNow = params.get('compose') === '1';

  const handlePost = async (text: string, mode: ComposerMode, image?: string) => {
    const r = await api.post<{ post: FeedPost }>('/posts', { text, image, kind: mode });
    upsert(POSTS, r.post, true);
    toast(
      mode === 'event'
        ? 'Your event post is live on the club feed'
        : mode === 'photo'
          ? 'Your photo post is live on the club feed'
          : 'Your post is live on the club feed',
      { title: 'Posted', variant: 'success' },
    );
  };

  // Right rail data (deterministic, static mock set).
  const upcomingEvents = useMemo(
    () => [...CLUB_EVENTS].filter((e) => !e.cancelled && e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v],
  );
  // Feed-top event rail: all events, soonest first.
  const railEvents = useMemo(
    () => [...CLUB_EVENTS].filter((e) => !e.cancelled && e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v],
  );
  const topMembers = useMemo(
    () => [...MEMBERS].sort((a, b) => b.stats.posts - a.stats.posts).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v],
  );

  // AI pick: a car the member does NOT own, ranked by shared semantic tags
  // with the member's own garage.
  const aiPick = useMemo(() => {
    if (!me) return null;
    const featured = CARS.find((c) => c.featured && c.ownerId !== me.id);
    if (featured) return { car: featured, sharedTags: [] as string[] };
    const mine = CARS.filter((c) => c.ownerId === me.id);
    const myTags = new Set(mine.flatMap((c) => c.semanticTags));
    const candidates = CARS.filter((c) => c.ownerId !== me.id);
    let best = candidates[0];
    let bestTags: string[] = [];
    for (const car of candidates) {
      const shared = car.semanticTags.filter((t) => myTags.has(t));
      if (shared.length > bestTags.length) {
        best = car;
        bestTags = shared;
      }
    }
    return best ? { car: best, sharedTags: bestTags } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, v]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      {/* Greeting */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="mb-6"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">
          {SETTINGS.club?.clubName ?? 'BMW Car Club Europe'} · {member?.tier ?? 'Member'}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {greeting}, {member?.firstName ?? ''}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Here’s what the club has been up to.</p>
      </motion.header>

      {/* Upcoming events rail — horizontal scroll, live going counts + RSVP */}
      <EventRail events={railEvents} />

      {/* Quick-nav menu: Events / My Garage / Part Store */}
      <motion.nav
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
        aria-label="Quick navigation"
        className="mb-6 hidden gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-card sm:gap-3 sm:p-2.5 md:flex"
      >
        {[
          { to: '/events', label: 'Events', icon: Calendar },
          { to: '/garage', label: 'My Garage', icon: Car },
          { to: '/parts', label: 'Part Store', icon: ShoppingBag },
        ].map(({ to, label, icon: Icon }) => (
          <motion.div
            key={to}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
            }}
            className="shrink-0"
          >
            <Link
              to={to}
              className="group inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-bmw-blue-light hover:text-bmw-blue sm:px-5"
            >
              <Icon size={16} className="text-ink-faint transition-colors group-hover:text-bmw-blue" />
              {label}
            </Link>
          </motion.div>
        ))}
      </motion.nav>

      {/* 12-col grid: feed (~65%) + right sidebar (~30%) */}
      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-12 lg:col-span-9">
          <Composer onPost={handlePost} autoFocus={composeNow} />

          <div className="mt-6 space-y-5">
            {posts.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-ink-muted">
                No posts yet — be the first to share something with the club.
              </p>
            )}
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 + Math.min(i, 6) * 0.07, ease: EASE }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-3">
          <div className="space-y-5 lg:sticky lg:top-24">
            <UpcomingEvents events={upcomingEvents} />
            <TopMembers members={topMembers} />
            {aiPick && <AiSuggestionCard car={aiPick.car} sharedTags={aiPick.sharedTags} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
