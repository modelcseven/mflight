import { Link } from 'react-router-dom';
import { AlertTriangle, Crown, ShieldCheck } from 'lucide-react';
import { MEMBER_PROFILE, formatDate } from '@/lib/data';
import { parseDate } from '@/lib/data';
import MembershipPlate from '@/components/MembershipPlate';

const YEAR_MS = 31_557_600_000; // average Gregorian year

/** Next annual renewal date, on the join-date anniversary. */
export function nextRenewal(joinIso: string): Date {
  const join = new Date(joinIso);
  const now = new Date();
  let renewal = new Date(now.getFullYear(), join.getMonth(), join.getDate());
  if (renewal.getTime() <= now.getTime()) {
    renewal = new Date(now.getFullYear() + 1, join.getMonth(), join.getDate());
  }
  return renewal;
}

/**
 * Premium dark membership status card: tier, since date, renewal, and a gold
 * progress bar for the current membership year.
 */
export default function MembershipStatusCard() {
  const renewal = MEMBER_PROFILE.membershipExpires ? parseDate(MEMBER_PROFILE.membershipExpires) : nextRenewal(MEMBER_PROFILE.joinDate);
  const expired = renewal.getTime() < Date.now();
  const soon = !expired && renewal.getTime() - Date.now() < 30 * 86400000;
  const status = MEMBER_PROFILE.status === 'Active' ? (expired ? 'Expired' : 'Active') : MEMBER_PROFILE.status;
  const periodStart = new Date(renewal.getFullYear() - 1, renewal.getMonth(), renewal.getDate());
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((Date.now() - periodStart.getTime()) / (renewal.getTime() - periodStart.getTime())) * 100)),
  );
  const years = Math.max(1, Math.floor((Date.now() - parseDate(MEMBER_PROFILE.joinDate).getTime()) / YEAR_MS));

  const rows: { label: string; value: string; mono?: boolean; gold?: boolean }[] = [
    { label: 'Tier', value: MEMBER_PROFILE.tier, gold: true },
    {
      label: 'Member since',
      value: formatDate(MEMBER_PROFILE.joinDate, { month: 'long', year: 'numeric' }),
    },
    { label: expired ? 'Expired' : 'Renews', value: formatDate(renewal.toISOString()), mono: true },
    { label: 'Club number', value: MEMBER_PROFILE.membershipNumber, mono: true },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-dark bg-ink-dark carbon-texture p-5 text-white shadow-card sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold">
            <Crown size={16} />
          </span>
          <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">
            Membership
          </h2>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${status === 'Active' ? 'bg-success/15 text-success' : 'bg-gold/20 text-gold'}`}>
          {status === 'Active' ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
          {status}
        </span>
      </header>

      <div className="mt-5 flex justify-center">
        <MembershipPlate number={MEMBER_PROFILE.membershipNumber} size="md" />
      </div>

      <dl className="mt-5 divide-y divide-white/10">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-[13px] text-white/55">{row.label}</dt>
            <dd
              className={
                row.mono
                  ? 'text-right font-mono text-sm font-semibold tabular-nums text-white'
                  : row.gold
                    ? 'text-right font-display text-[13px] font-bold text-gold'
                    : 'text-right text-[13px] font-medium text-white'
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
            Membership year
          </span>
          <span className="font-mono text-[11px] tabular-nums text-white/70">
            {pct}% · yr {years}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-[#E9C766]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {(expired || soon) && (
        <Link to="/settings?tab=billing" className="mt-5 flex w-full items-center justify-center rounded-xl bg-gold px-4 py-2.5 font-display text-sm font-bold text-ink-dark hover:bg-[#d8b33a]">
          Renew membership
        </Link>
      )}
      {!expired && !soon && (
        <Link to="/settings?tab=billing" className="mt-4 block text-center text-[12px] font-semibold text-white/60 hover:text-white">
          Membership &amp; billing →
        </Link>
      )}
    </section>
  );
}
