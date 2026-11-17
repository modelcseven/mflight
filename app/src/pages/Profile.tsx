import { Link } from 'react-router-dom';
import PositionBadge from '@/components/PositionBadge';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CalendarDays, MapPin } from 'lucide-react';
import { MEMBER_PROFILE, SETTINGS, carsByOwner, formatDate } from '@/lib/data';
import { parseDate } from '@/lib/data';
import { useStore } from '@/lib/store';
import MembershipPlate from '@/components/MembershipPlate';
import StatStrip from '@/components/StatStrip';
import CarCard from '@/components/CarCard';
import ActivityFeed from '@/components/profile/ActivityFeed';
import MembershipStatusCard from '@/components/profile/MembershipStatusCard';
import ProfileForm from '@/components/profile/ProfileForm';

const YEAR_MS = 31_557_600_000;

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || MEMBER_PROFILE.initials
  );
}

/**
 * Profile — hero (avatar + identity left, large metallic membership plate
 * right), stats strip, My Garage horizontal scroll, right sidebar with
 * activity feed + membership status, and an editable profile form.
 */
export default function Profile() {
  useStore();
  const profile = MEMBER_PROFILE;
  const displayName = MEMBER_PROFILE.name;
  const cars = carsByOwner(MEMBER_PROFILE.id);
  const yearsMember = Math.max(
    1,
    Math.floor((Date.now() - parseDate(MEMBER_PROFILE.joinDate).getTime()) / YEAR_MS),
  );

  return (
    <div className="space-y-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="overflow-hidden rounded-2xl border border-border bg-white shadow-card"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          {/* Identity */}
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-5">
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-bmw-blue to-bmw-blue-dark font-display text-3xl font-extrabold text-white ring-2 ring-gold ring-offset-2 ring-offset-white sm:h-28 sm:w-28">
                {initialsOf(displayName)}
              </span>
              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                    {displayName}
                  </h1>
                  {MEMBER_PROFILE.verified && (
                    <BadgeCheck size={22} className="shrink-0 text-bmw-blue" aria-label="Verified member" />
                  )}
                  <span className="rounded-full bg-gold-light px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-dark">
                    {MEMBER_PROFILE.tier}
                  </span>
                  <PositionBadge position={MEMBER_PROFILE.clubPosition} size="md" />
                </div>
                <div className="mt-3">
                  <MembershipPlate number={MEMBER_PROFILE.membershipNumber} size="sm" />
                </div>
              </div>
            </div>

            {profile.bio && <p className="mt-5 max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{profile.bio}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-ink-faint" />
                  {profile.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-ink-faint" />
                Joined {formatDate(MEMBER_PROFILE.joinDate, { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Membership plate — the visual star */}
          <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden border-t border-border bg-ink-dark carbon-texture px-6 py-8 sm:py-10 lg:border-l lg:border-t-0">
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bmw-blue/25 blur-3xl"
            />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.32em] text-gold">
              {SETTINGS.club?.clubName ?? 'BMW Car Club Europe'}
            </p>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <MembershipPlate number={MEMBER_PROFILE.membershipNumber} size="lg" />
            </motion.div>
            <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
              Member since {parseDate(MEMBER_PROFILE.joinDate).getFullYear()}
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <StatStrip
        stats={[
          { value: MEMBER_PROFILE.stats.cars, label: 'Cars' },
          { value: MEMBER_PROFILE.stats.events, label: 'Events' },
          { value: MEMBER_PROFILE.stats.posts, label: 'Posts' },
          { value: yearsMember, label: 'Years Member' },
        ]}
      />

      {/* ── Main + sidebar (12-col) ──────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 xl:gap-8">
        <div className="col-span-12 space-y-8 xl:col-span-8">
          {/* My Garage */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
                  My Garage
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  <span className="font-mono tabular-nums">{cars.length}</span> cars · open a card
                  for full specs
                </p>
              </div>
              <Link
                to="/garage"
                className="group flex shrink-0 items-center gap-1.5 font-display text-sm font-bold text-bmw-blue transition-colors hover:text-bmw-blue-dark"
              >
                View All Garage
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {cars.map((car) => (
                <div key={car.id} className="w-[280px] shrink-0 snap-start sm:w-[330px]">
                  <CarCard car={car} />
                </div>
              ))}
              {/* Add-car teaser */}
              <Link
                to="/garage"
                className="flex w-[200px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-silver bg-white/60 p-6 text-center transition-colors hover:border-bmw-blue hover:bg-bmw-blue-light/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bmw-blue-light text-bmw-blue">
                  <ArrowRight size={18} />
                </span>
                <span className="text-[13px] font-semibold text-ink-muted">
                  Manage garage &amp; add a car
                </span>
              </Link>
            </div>
          </section>

          {/* Edit profile */}
          <ProfileForm />
        </div>

        {/* Right sidebar */}
        <aside className="col-span-12 space-y-6 xl:col-span-4">
          <ActivityFeed />
          <MembershipStatusCard />
        </aside>
      </div>
    </div>
  );
}
