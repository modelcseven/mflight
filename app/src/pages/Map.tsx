import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe2, Users, Flag, Earth, TrendingUp } from 'lucide-react';
import {
  MEMBER_GEO,
  MEMBER_CITIES,
  totalMembers,
  countriesWithMembers,
  totalChapters,
  continentsWithMembers,
} from '@/lib/data';
import type { MemberGeo } from '@/lib/data';
import WorldHeatMap from '@/components/map/WorldHeatMap';
import CountryDetailPanel from '@/components/map/CountryDetailPanel';
import { memberColor } from '@/components/map/mapGeo';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  suffix?: string;
  delay: number;
}) {
  const count = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bmw-blue-light text-bmw-blue">
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-bold tabular-nums leading-none tracking-tight text-ink">
          {count.toLocaleString()}
          {suffix}
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-ink-muted">{label}</p>
      </div>
    </motion.div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export default function Map() {
  const [selected, setSelected] = useState<MemberGeo | null>(null);

  const stats = useMemo(
    () => ({
      members: totalMembers(),
      countries: countriesWithMembers(),
      chapters: totalChapters(),
      continents: continentsWithMembers(),
    }),
    [],
  );

  const topCountries = useMemo(
    () => [...MEMBER_GEO].sort((a, b) => b.members - a.members).slice(0, 8),
    [],
  );
  const topCities = useMemo(
    () => [...MEMBER_CITIES].sort((a, b) => b.members - a.members).slice(0, 8),
    [],
  );
  const fastestGrowing = useMemo(
    () => [...MEMBER_GEO].sort((a, b) => b.growth - a.growth).slice(0, 5),
    [],
  );
  const maxCountry = topCountries[0]?.members ?? 1;
  const maxCity = topCities[0]?.members ?? 1;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-bmw-blue">
          Global Map
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Global Presence
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Where MFlight members drive.</p>
      </motion.div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total members" value={stats.members} delay={0.05} />
        <StatCard icon={Globe2} label="Countries" value={stats.countries} delay={0.12} />
        <StatCard icon={Flag} label="Chapters" value={stats.chapters} delay={0.19} />
        <StatCard icon={Earth} label="Continents" value={stats.continents} delay={0.26} />
      </div>

      {/* The map */}
      <motion.section
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-extrabold tracking-tight text-ink">
              Member heat map
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Pan &amp; zoom — click a highlighted country for details.
            </p>
          </div>
          <span className="rounded-full bg-bmw-blue-light px-3 py-1 font-mono text-[11px] font-bold tabular-nums text-bmw-blue">
            {stats.members.toLocaleString()} members live
          </span>
        </div>
        <div className="relative bg-[#F8FAFC]">
          <WorldHeatMap selected={selected} onSelect={setSelected} />
          <CountryDetailPanel geo={selected} onClose={() => setSelected(null)} />
        </div>
      </motion.section>

      {/* Rankings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top countries */}
        <motion.section
          variants={item}
          className="rounded-2xl border border-border bg-white p-6"
        >
          <h2 className="font-display text-base font-extrabold tracking-tight text-ink">
            Top countries
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Ranked by signed-up members</p>
          <ul className="mt-6 space-y-4">
            {topCountries.map((g, i) => (
              <li key={g.isoA3} className="flex items-center gap-3">
                <span
                  className={cn(
                    'w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums',
                    i === 0 ? 'text-[#E10600]' : 'text-ink-faint',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      onClick={() => setSelected(g)}
                      className="truncate text-[13px] font-semibold text-ink transition-colors hover:text-bmw-blue"
                    >
                      {g.name}
                    </button>
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink-muted">
                      {g.members}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(g.members / maxCountry) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          i === 0
                            ? 'linear-gradient(to right, #0066B1, #E10600)'
                            : `linear-gradient(to right, #8FC1E8, ${memberColor(g.members)})`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        <div className="space-y-6">
          {/* Top cities */}
          <motion.section
            variants={item}
            className="rounded-2xl border border-border bg-white p-6"
          >
            <h2 className="font-display text-base font-extrabold tracking-tight text-ink">
              Top cities
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">Largest local clusters</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {topCities.map((c) => (
                <li
                  key={c.city}
                  className="flex items-center gap-3 rounded-xl border border-border bg-slate-50/60 px-3.5 py-3"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: c.members / maxCity > 0.75 ? '#E10600' : '#0066B1',
                      boxShadow:
                        c.members / maxCity > 0.75
                          ? '0 0 8px rgba(225,6,0,0.5)'
                          : '0 0 6px rgba(0,102,177,0.4)',
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{c.city}</p>
                    <p className="truncate text-[11px] text-ink-faint">{c.country}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink-muted">
                    {c.members}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* Fastest growing chapters */}
          <motion.section
            variants={item}
            className="rounded-2xl border border-border bg-white p-6"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <TrendingUp size={15} />
              </span>
              <div>
                <h2 className="font-display text-base font-extrabold tracking-tight text-ink">
                  Fastest growing chapters
                </h2>
                <p className="text-xs text-ink-muted">Year-over-year member growth</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {fastestGrowing.map((g) => (
                <li key={g.isoA3} className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-ink">{g.name}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                      {g.members} members
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-success">
                      +{g.growth.toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
