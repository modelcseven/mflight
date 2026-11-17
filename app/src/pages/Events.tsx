import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { ArrowRight, ChevronDown, Crown, LayoutGrid, List, Search } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';
import { parseDate } from '@/lib/data';
import { CLUB_EVENTS, SETTINGS, formatDate } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useRsvps } from '@/lib/rsvp';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EventCard, { type EventView } from '@/components/events/EventCard';
import EventModal from '@/components/events/EventModal';
import Countdown from '@/components/events/Countdown';
import HeroRouteArc from '@/components/events/HeroRouteArc';
import { shortTitle } from '@/components/events/eventUtils';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const PLURAL: Record<string, string> = { Festival: 'Festivals', 'Track Day': 'Track Days', Tour: 'Tours', Rally: 'Rallies', Lifestyle: 'Lifestyle' };
/** Filter chips built from the categories configured in admin settings. */
function buildFilters(): { id: string; label: string; cats: string[] | null }[] {
  const cats = SETTINGS.events?.categories?.length ? SETTINGS.events.categories : [...new Set(CLUB_EVENTS.map((e) => e.category))];
  return [{ id: 'all', label: 'All', cats: null }, ...cats.map((c) => ({ id: c, label: PLURAL[c] ?? c, cats: [c] }))];
}

const SORTS = [
  { id: 'date', label: 'Date', menuLabel: 'Date (soonest first)' },
  { id: 'price-asc', label: 'Price ↑', menuLabel: 'Price: low to high' },
  { id: 'price-desc', label: 'Price ↓', menuLabel: 'Price: high to low' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

const PROMISE_STATS = [
  { value: 28, label: 'Events per season', prefix: '', suffix: '' },
  { value: 12, label: 'Countries', prefix: '', suffix: '' },
  { value: 210, label: 'Avg. member savings', prefix: '€', suffix: '' },
];

export default function Events() {
  const pageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortId>('date');
  const [view, setView] = useState<EventView>('grid');
  const [selected, setSelected] = useState<ClubEvent | null>(null);
  const [params, setParams] = useSearchParams();
  // Deep link: /events?event=<id> opens that event (from chat, notifications, crew chats).
  useEffect(() => {
    const id = params.get('event');
    if (!id) return;
    const ev = CLUB_EVENTS.find((e) => e.id === id);
    if (ev) {
      setSelected(ev);
      const next = new URLSearchParams(params);
      next.delete('event');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, CLUB_EVENTS.length]);
  /** Shared RSVP store — synced with the feed event rail (localStorage-backed). */
  useRsvps(); // re-render on RSVP changes
  const v = useStore();
  const FILTERS = useMemo(buildFilters, [v]);
  const visible = useMemo(() => CLUB_EVENTS.filter((e) => !e.cancelled), [v]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Live seats (server-computed, already includes this member's party). */
  const seatsLeftOf = (event: ClubEvent) => CLUB_EVENTS.find((e) => e.id === event.id)?.seatsLeft ?? event.seatsLeft;

  // Next upcoming event for the hero secondary CTA.
  const nextEvent = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...visible].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return sorted.find((e) => e.endDate >= today) ?? sorted[sorted.length - 1];
  }, [visible]);

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const cats = f.cats as readonly string[] | null;
    const list = cats ? visible.filter((e) => cats.includes(e.category)) : [...visible];
    return list.sort((a, b) =>
      sort === 'date'
        ? a.startDate.localeCompare(b.startDate)
        : sort === 'price-asc'
          ? a.packagePrice - b.packagePrice
          : b.packagePrice - a.packagePrice,
    );
  }, [filter, sort, visible, FILTERS]);
  const listKey = filtered.map((e) => e.id).join(',');

  // Lenis smooth scroll — this page only, synced with GSAP ScrollTrigger.
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Lock page scroll while the detail modal is open.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (selected) {
      lenis?.stop();
      document.body.style.overflow = 'hidden';
    } else {
      lenis?.start();
      document.body.style.overflow = '';
    }
    return () => {
      lenis?.start();
      document.body.style.overflow = '';
    };
  }, [selected]);

  // Hero intro + parallax and closing-band reveals (run once).
  useGSAP(
    () => {
      const heroSplit = new SplitText('.hero-headline', { type: 'words', mask: 'words' });
      const tl = gsap.timeline({ delay: 0.2 });
      tl.fromTo(
        heroSplit.words,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 },
      ).fromTo(
        '.hero-fade',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 },
        '-=0.25',
      );

      // Hero image parallax.
      gsap.fromTo(
        '.hero-img',
        { yPercent: -8, scale: 1.15 },
        {
          yPercent: 8,
          scale: 1.15,
          ease: 'none',
          scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: true },
        },
      );

      // Closing band: clip-path slide-in on scrub.
      gsap.fromTo(
        '.promise-band',
        { clipPath: 'inset(12% 4% round 28px)' },
        {
          clipPath: 'inset(0% 0% round 28px)',
          ease: 'none',
          scrollTrigger: { trigger: '.promise-band', start: 'top 95%', end: 'top 45%', scrub: true },
        },
      );
      const bandSplit = new SplitText('.promise-headline', { type: 'words', mask: 'words' });
      gsap.fromTo(bandSplit.words, { yPercent: 110 }, {
        yPercent: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: '.promise-band', start: 'top 78%', once: true },
      });
      gsap.fromTo('.promise-fade, .promise-stat', { y: 16, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: { trigger: '.promise-band', start: 'top 78%', once: true },
      });

      // Count-up stats (900ms easeOut on first view).
      gsap.utils.toArray<HTMLElement>('.stat-value').forEach((el) => {
        const target = Number(el.dataset.value ?? '0');
        const prefix = el.dataset.prefix ?? '';
        const suffix = el.dataset.suffix ?? '';
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => {
            el.textContent = `${prefix}${Math.round(obj.v)}${suffix}`;
          },
        });
      });

      return () => {
        heroSplit.revert();
        bandSplit.revert();
      };
    },
    { scope: pageRef },
  );

  // Card scroll reveals + per-card image parallax (re-created when the list changes).
  useGSAP(
    () => {
      const reveals = gsap.utils.toArray<HTMLElement>('.event-card-reveal');
      if (reveals.length > 0) {
        gsap.set(reveals, { y: 48, opacity: 0 });
        ScrollTrigger.batch(reveals, {
          start: 'top 85%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.12, overwrite: true }),
        });
        reveals.forEach((el) => {
          const img = el.querySelector('.event-card-img');
          if (img) {
            gsap.fromTo(
              img,
              { yPercent: -6, scale: 1.12 },
              {
                yPercent: 6,
                scale: 1.12,
                ease: 'none',
                scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
              },
            );
          }
        });
      }
      ScrollTrigger.refresh();
    },
    { scope: gridRef, dependencies: [listKey, view] },
  );

  // Recalculate trigger positions after grid↔list layout springs settle.
  useEffect(() => {
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 450);
    return () => window.clearTimeout(t);
  }, [view, filter, sort]);

  const scrollToGrid = () => {
    const el = gridRef.current;
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -110 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={pageRef} className="pb-10">
      {/* ── Section 1 · Hero ─────────────────────────────────────────────── */}
      <section className="hero-section relative h-[70vh] min-h-[520px] overflow-hidden rounded-[28px]">
        <div className="absolute inset-0">
          <img src={`${import.meta.env.BASE_URL}event-m-festival.jpg`} alt="BMW M cars lined up at the M Festival" className="hero-img h-full w-full object-cover" />
        </div>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(3,7,18,0.35), rgba(3,7,18,0.82))' }}
        />
        {/* Animated route-line arc — desktop only */}
        <div className="absolute right-0 top-0 hidden h-full w-1/2 lg:block">
          <HeroRouteArc />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <p className="hero-fade text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            {SETTINGS.club?.clubName ?? 'BMW Car Club Europe'} · {nextEvent ? parseDate(nextEvent.startDate).getFullYear() : new Date().getFullYear()} Season
          </p>
          <h1 className="hero-headline mt-3 max-w-[16ch] font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Where the club takes you
          </h1>
          <p className="hero-fade mt-4 max-w-[52ch] text-[15px] leading-relaxed text-white/85">
            {visible.length} {visible.length === 1 ? 'event' : 'events'}. {new Set(visible.map((e) => e.country || e.location)).size} {new Set(visible.map((e) => e.country || e.location)).size === 1 ? 'country' : 'countries'}. One club. Flights, stays and paddock passes — bundled for members.
          </p>
          {nextEvent && (
            <div className="hero-fade mt-5">
              <Countdown startDate={nextEvent.startDate} />
            </div>
          )}
          <div className="hero-fade mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={scrollToGrid}
              className="group flex h-12 items-center gap-2 rounded-xl bg-bmw-blue px-6 text-sm font-semibold text-white transition-colors hover:bg-bmw-blue-dark active:scale-[0.98]"
            >
              Explore events
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            {nextEvent && (
            <button
              onClick={() => setSelected(nextEvent)}
              className="flex h-12 items-center rounded-xl border border-white/40 px-6 text-sm font-semibold text-white transition-colors hover:border-white/60"
            >
              Next event: {shortTitle(nextEvent.title)} · {formatDate(nextEvent.startDate, { day: 'numeric', month: 'short' })}
            </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Section 2 · Sticky season filter bar ─────────────────────────── */}
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
        className="sticky top-20 z-10 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white/85 p-3 shadow-card backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  active ? 'text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="events-chip-pill"
                    className="absolute inset-0 rounded-full bg-bmw-blue"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative">{f.label}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-bmw-blue/40">
                Sort: {SORTS.find((s) => s.id === sort)?.label}
                <ChevronDown size={14} className="text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              {SORTS.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={cn('cursor-pointer', sort === s.id && 'font-semibold text-bmw-blue')}
                >
                  {s.menuLabel}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex rounded-lg border border-border bg-white p-0.5">
            {(
              [
                { id: 'grid', icon: LayoutGrid, label: 'Grid view' },
                { id: 'list', icon: List, label: 'List view' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-label={label}
                aria-pressed={view === id}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  view === id ? 'bg-bmw-blue text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Section 3 · Event grid ───────────────────────────────────────── */}
      <section ref={gridRef} className="mt-6 scroll-mt-28">
        {filtered.length === 0 ? (
          <EmptyState
            title="No events in this category"
            body="Try another season filter — the club calendar runs all year."
            action={
              <button
                onClick={() => setFilter('all')}
                className="flex h-10 items-center gap-2 rounded-xl bg-bmw-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-bmw-blue-dark"
              >
                <Search size={15} /> Show all events
              </button>
            }
          />
        ) : (
          <div className={cn('grid gap-6', view === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} view={view} onOpen={setSelected} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 5 · Club travel promise (closing band) ───────────────── */}
      <section
        className="promise-band relative mt-12 overflow-hidden rounded-[28px] p-8 text-center sm:p-12"
        style={{ background: 'linear-gradient(135deg, #0066B1 0%, #0055A0 62%, #004178 100%)' }}
      >
        {/* subtle carbon weave over the BMW-blue band */}
        <div className="carbon-texture absolute inset-0" aria-hidden />
        {/* faint checkered-flag strip along the top edge */}
        <div
          className="absolute inset-x-0 top-0 h-8 opacity-[0.07]"
          style={{
            backgroundImage: 'repeating-conic-gradient(#ffffff 0% 25%, transparent 0% 50%)',
            backgroundSize: '16px 16px',
          }}
          aria-hidden
        />
        <Crown size={28} className="promise-fade relative mx-auto text-gold" />
        <h2 className="promise-headline relative mt-4 font-display text-3xl font-extrabold tracking-tight text-white">
          One club. Every road and runway.
        </h2>
        <p className="promise-fade relative mt-3 text-[15px] text-white/75">
          Members save an average of €210 per season on club travel.
        </p>

        <div className="relative mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-4">
          {PROMISE_STATS.map((s) => (
            <div key={s.label} className="promise-stat">
              <p
                className="stat-value font-mono text-2xl font-medium text-white sm:text-3xl"
                data-value={s.value}
                data-prefix={s.prefix}
                data-suffix={s.suffix}
              >
                {s.prefix}0{s.suffix}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/55 sm:text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={scrollToGrid}
          className="group relative mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-bmw-blue-dark transition-transform active:scale-[0.98]"
        >
          Find your event
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </section>

      {/* ── Section 4 · Event detail modal ───────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <EventModal
            key={selected.id}
            event={selected}
            seatsLeft={seatsLeftOf(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
