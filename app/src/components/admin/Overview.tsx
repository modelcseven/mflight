import { useNavigate } from 'react-router-dom';
import { CalendarDays, CreditCard, Flag, Tag, UserPlus, Users } from 'lucide-react';
import { eur, MEMBER_PROFILE } from '@/lib/data';
import type { ClubEvent } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ErrorBox, Loading, PageHeader, Panel, Stat, fmtDate, fmtDateTime, useAdminData } from './ui';

interface OverviewData {
  stats: {
    members: number; active: number; pending_users: number; new_30d: number; pending_listings: number; active_listings: number;
    open_reports: number; upcoming_events: number; cars: number; posts_30d: number; revenue: number; revenue_30d: number; outstanding: number;
  };
  signups: { month: string; n: number }[];
  revenueByMonth: { month: string; total: number }[];
  events: ClubEvent[];
  recent: { id: string; action: string; actorName: string; targetType: string | null; targetId: string | null; createdAt: string }[];
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' });

function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function Bars({ data, format }: { data: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">{format(d.value)}</span>
          <div className="w-full rounded-t-md bg-bmw-blue/85 transition-colors group-hover:bg-bmw-blue" style={{ height: `${Math.max(2, (d.value / max) * 120)}px` }} />
          <span className="text-[10px] text-ink-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'user.signup': 'New member signed up',
  'user.login': 'Signed in',
  'user.created': 'Created a member',
  'user.updated': 'Updated a member',
  'user.deleted': 'Deleted a member',
  'event.created': 'Created an event',
  'event.updated': 'Updated an event',
  'rsvp.updated': 'Updated an attendee',
  'listing.status': 'Changed a listing status',
  'listing.purchase_requested': 'Requested a purchase',
  'announcement.sent': 'Sent an announcement',
  'settings.updated': 'Changed settings',
  'order.marked_paid': 'Marked an order paid',
  'order.refunded': 'Refunded an order',
};

export default function Overview() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { data, error, loading, reload } = useAdminData<OverviewData>('/admin/overview');
  const can = (a: string) => member?.permissions.includes(a as never);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const s = data.stats;

  const months = lastMonths(12);
  const signups = months.map((m) => ({ label: monthLabel(m), value: data.signups.find((x) => x.month === m)?.n ?? 0 }));
  const revenue = months.map((m) => ({ label: monthLabel(m), value: Number(data.revenueByMonth.find((x) => x.month === m)?.total ?? 0) }));

  const queue = [
    { n: s.pending_users, label: 'membership approvals', to: '/admin/users?status=Pending', area: 'users' },
    { n: s.pending_listings, label: 'listings awaiting review', to: '/admin/marketplace?status=Pending', area: 'marketplace' },
    { n: s.open_reports, label: 'open reports', to: '/admin/moderation', area: 'moderation' },
  ].filter((q) => q.n > 0 && can(q.area));

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${MEMBER_PROFILE.firstName}`}
        description={MEMBER_PROFILE.role === 'chapter_lead' ? `Member figures are for the ${MEMBER_PROFILE.chapterCountry ?? 'your'} chapter.` : 'Here is how the club is doing.'}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Members" value={s.members} sub={`${s.active} active · +${s.new_30d} in 30 days`} icon={Users} onClick={can('users') ? () => navigate('/admin/users') : undefined} />
        <Stat label="Upcoming events" value={s.upcoming_events} sub="Not cancelled" icon={CalendarDays} tone="success" onClick={can('events') ? () => navigate('/admin/events') : undefined} />
        <Stat label="Active listings" value={s.active_listings} sub={`${s.pending_listings} awaiting review`} icon={Tag} tone="warning" onClick={can('marketplace') ? () => navigate('/admin/marketplace') : undefined} />
        {can('orders') ? (
          <Stat label="Revenue (30 days)" value={eur(s.revenue_30d)} sub={`${eur(s.revenue)} all time · ${eur(s.outstanding)} outstanding`} icon={CreditCard} tone="gold" onClick={() => navigate('/admin/orders')} />
        ) : (
          <Stat label="Open reports" value={s.open_reports} sub="Needs review" icon={Flag} tone="danger" onClick={can('moderation') ? () => navigate('/admin/moderation') : undefined} />
        )}
      </div>

      {queue.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {queue.map((q) => (
            <button key={q.label} onClick={() => navigate(q.to)} className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-light px-4 py-2.5 text-sm font-semibold text-gold-dark hover:bg-gold-light/70">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-bold text-white">{q.n}</span>
              {q.label} →
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><UserPlus size={15} /> New members · 12 months</span>}>
          <Bars data={signups} format={(n) => String(n)} />
        </Panel>
        {can('orders') && (
          <Panel title={<span className="flex items-center gap-2"><CreditCard size={15} /> Paid revenue · 12 months</span>}>
            <Bars data={revenue} format={(n) => eur(n)} />
          </Panel>
        )}
        <Panel title="Upcoming events" pad={false} actions={can('events') && <button onClick={() => navigate('/admin/events')} className="text-xs font-bold text-bmw-blue">Manage →</button>}>
          {data.events.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">No upcoming events.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.events.map((e) => {
                const cap = e.capacity ?? 1;
                const pct = Math.min(100, Math.round(((e.goingTotal ?? 0) / cap) * 100));
                return (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint">{fmtDate(e.startDate)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-app">
                        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-m-red' : pct >= 70 ? 'bg-gold' : 'bg-success')} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-ink-muted">{e.goingTotal}/{cap}{e.waitlist ? ` · ${e.waitlist} waiting` : ''}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity" pad={false} actions={can('audit') && <button onClick={() => navigate('/admin/audit')} className="text-xs font-bold text-bmw-blue">Audit log →</button>}>
          {data.recent.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <p className="min-w-0 truncate text-sm text-ink">
                    <span className="font-semibold">{a.actorName}</span> · {ACTION_LABEL[a.action] ?? a.action}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-ink-faint">{fmtDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
