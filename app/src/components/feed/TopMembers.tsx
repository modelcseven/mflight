import { motion } from 'framer-motion';
import { BadgeCheck, Users } from 'lucide-react';
import type { ClubMember } from '@/lib/data';
import MembershipPlate from '@/components/MembershipPlate';

/** Sidebar panel: most active club members with sm membership plates + post counts. */
export default function TopMembers({ members }: { members: ClubMember[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border bg-white p-5 shadow-card"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-extrabold tracking-tight text-ink">
          <Users size={16} className="text-bmw-blue" />
          Top members
        </h3>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">This season</span>
      </header>

      <ul className="mt-4 divide-y divide-border/70">
        {members.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="relative shrink-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bmw-blue font-display text-xs font-bold text-white">
                {m.avatarInitials}
              </span>
              {i < 3 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gold font-mono text-[9px] font-bold text-navy-950 ring-2 ring-white">
                  {i + 1}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-ink">{m.name}</span>
                {m.verified && <BadgeCheck size={14} className="shrink-0 text-bmw-blue" />}
              </span>
              <span className="mt-1 block">
                <MembershipPlate number={m.membershipNumber} size="sm" />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-sm font-bold tabular-nums text-ink">{m.stats.posts}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">posts</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
