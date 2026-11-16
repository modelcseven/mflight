import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Users, Flag } from 'lucide-react';
import type { MemberGeo } from '@/lib/data';
import { totalMembers, topCityForCountry } from '@/lib/data';
import { memberColor } from './mapGeo';

interface CountryDetailPanelProps {
  geo: MemberGeo | null;
  onClose: () => void;
}

export default function CountryDetailPanel({ geo, onClose }: CountryDetailPanelProps) {
  const total = totalMembers();
  return (
    <AnimatePresence>
      {geo && (
        <motion.aside
          key={geo.isoA3}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="absolute bottom-4 right-4 top-16 z-20 flex w-[280px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
        >
          {/* Header */}
          <div
            className="relative px-5 pb-5 pt-6"
            style={{
              background: `linear-gradient(135deg, ${memberColor(geo.members)} 0%, #030712 160%)`,
            }}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
              aria-label="Close panel"
            >
              <X size={14} />
            </button>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              {geo.isoA3}
            </p>
            <h3 className="mt-1 font-display text-xl font-extrabold tracking-tight text-white">
              {geo.name}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-white/70">{geo.continent}</p>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
                <Users size={16} />
              </span>
              <div>
                <p className="font-mono text-lg font-bold tabular-nums leading-none text-ink">
                  {geo.members.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">members</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-light text-gold-dark">
                <Flag size={16} />
              </span>
              <div>
                <p className="font-mono text-lg font-bold tabular-nums leading-none text-ink">
                  {geo.chapters}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  local {geo.chapters === 1 ? 'chapter' : 'chapters'}
                </p>
              </div>
            </div>
            {(() => {
              const city = topCityForCountry(geo.name);
              return (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-ink-muted">
                    <MapPin size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-none text-ink">
                      {city ? city.city : '—'}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-ink-muted">
                      {city ? `${city.members} members` : 'no city cluster'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Share bar */}
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                  Share of club
                </p>
                <p className="font-mono text-[11px] font-bold tabular-nums text-ink">
                  {((geo.members / total) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(geo.members / total) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  className="h-full rounded-full"
                  style={{ background: memberColor(geo.members) }}
                />
              </div>
            </div>

            {/* Growth */}
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                YoY growth
              </p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-success">
                +{geo.growth.toFixed(1)}%
              </p>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
