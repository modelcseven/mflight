import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Check, Clock, Crown, Loader2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { CARS, MEMBER_PROFILE, memberById } from '@/lib/data';
import type { Car } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface PodiumData {
  month: string;
  closesAt: string;
  totalVotes: number;
  standings: { carId: string; votes: number }[];
  myVote: string | null;
  lastWinner: { month: string; carId: string; votes: number } | null;
  clubPickCarId: string | null;
}

const carName = (c: Car) => `${c.model}`;
const photo = (c?: Car) => c?.photos?.[0] || '/car-placeholder.svg';
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Podium() {
  const v = useStore();
  const { toast } = useToast();
  const [data, setData] = useState<PodiumData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api.get<PodiumData>('/podium').then(setData).catch((e) => toast((e as Error).message)), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const votes = new Map(data.standings.map((s) => [s.carId, s.votes]));
    return CARS.filter((c) => !c.hidden)
      .map((c) => ({ car: c, votes: votes.get(c.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.car.model.localeCompare(b.car.model));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, v]);

  const vote = async (carId: string) => {
    if (!data) return;
    setBusy(carId);
    try {
      if (data.myVote === carId) await api.del('/podium/vote');
      else await api.post('/podium/vote', { carId });
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-24 text-ink-faint">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(data.closesAt).getTime() - Date.now()) / 86400000));
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]]; // P2, P1, P3 on the podium
  const pick = CARS.find((c) => c.id === data.clubPickCarId);
  const last = data.lastWinner && CARS.find((c) => c.id === data.lastWinner?.carId);

  const VoteBtn = ({ car, compact }: { car: Car; compact?: boolean }) => {
    const own = car.ownerId === MEMBER_PROFILE.id;
    const mine = data.myVote === car.id;
    return (
      <button
        onClick={() => vote(car.id)}
        disabled={own || busy !== null}
        aria-pressed={mine}
        className={cn(
          'flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-[14px] font-bold transition-colors disabled:opacity-50',
          compact && 'h-10 px-3 text-[13px]',
          mine ? 'bg-hot text-hot-on' : own ? 'border border-border text-ink-faint' : 'bg-bmw-blue text-white',
        )}
      >
        {busy === car.id ? <Loader2 size={15} className="animate-spin" /> : mine ? <Check size={15} /> : null}
        {own ? 'Your car' : mine ? 'Voted' : 'Vote'}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-hot">Car of the Month · {monthName(data.month)}</p>
          <p className="mt-1 text-sm text-ink-muted">One vote per member each month. You can change it until voting closes.</p>
        </div>
        <span className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-ink">
          <Clock size={14} className="text-bmw-blue" /> {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left · {data.totalVotes} {data.totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Podium */}
      {top.length > 0 && (
        <section aria-label="Top three" className="mt-6 flex items-end justify-center gap-2 sm:gap-4">
          {order.map((r, i) => {
            if (!r) return <div key={i} className="w-[30%] max-w-[150px]" />;
            const place = i === 1 ? 1 : i === 0 ? 2 : 3;
            const owner = memberById(r.car.ownerId);
            return (
              <div key={r.car.id} className="flex w-[31%] max-w-[170px] flex-col items-center">
                {place === 1 && <Crown size={26} className="mb-1 fill-hot text-hot" aria-label="Leader" />}
                <Link to={`/garage/${r.car.id}`} className="block">
                  <img
                    src={photo(r.car)}
                    alt={`${owner?.name ?? 'Member'}'s ${carName(r.car)}`}
                    className={cn(
                      'rounded-full object-cover',
                      place === 1 ? 'h-24 w-24 border-[3px] border-hot sm:h-28 sm:w-28' : 'h-[72px] w-[72px] border-[3px] sm:h-20 sm:w-20',
                      place === 2 && 'border-silver',
                      place === 3 && 'border-[#B07A4A]',
                    )}
                  />
                </Link>
                <p className="mt-2 max-w-full truncate text-[13px] font-semibold text-ink">{owner?.firstName ?? 'Member'} {owner?.lastName?.[0] ? `${owner.lastName[0]}.` : ''}</p>
                <p className="max-w-full truncate text-[11px] text-ink-muted">{carName(r.car)}</p>
                <div
                  className={cn(
                    'mt-2 flex w-full flex-col items-center justify-center rounded-t-2xl',
                    place === 1 ? 'h-28 bg-hot text-hot-on' : 'border border-b-0 border-border bg-surface',
                    place === 2 && 'h-20',
                    place === 3 && 'h-16',
                  )}
                >
                  <span className={cn('font-race leading-none', place === 1 ? 'text-5xl' : 'text-3xl', place === 2 && 'text-ink-muted', place === 3 && 'text-[#B07A4A]')}>P{place}</span>
                  <span className={cn('text-[12px] font-semibold', place === 1 ? '' : 'text-ink-muted')}>{r.votes} {r.votes === 1 ? "vote" : "votes"}</span>
                </div>
              </div>
            );
          })}
        </section>
      )}
      <div aria-hidden className="flex h-1 gap-[3px]">
        <span className="flex-1 bg-sky" /><span className="flex-1 bg-bmw-blue" /><span className="flex-1 bg-hot [html[data-theme=light]_&]:bg-[#0B2E6B]" />
      </div>

      {(pick || last) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pick && (
            <Link to={`/garage/${pick.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <img src={photo(pick)} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-gold-dark"><Star size={12} /> Club pick</p>
                <p className="truncate font-display text-lg font-bold text-ink">{pick.model}</p>
                <p className="truncate text-[12px] text-ink-muted">{memberById(pick.ownerId)?.name}</p>
              </div>
            </Link>
          )}
          {last && data.lastWinner && (
            <Link to={`/garage/${last.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <img src={photo(last)} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-bmw-blue"><Award size={12} /> {monthName(data.lastWinner.month)} winner</p>
                <p className="truncate font-display text-lg font-bold text-ink">{last.model}</p>
                <p className="truncate text-[12px] text-ink-muted">{memberById(last.ownerId)?.name} · {data.lastWinner.votes} votes</p>
              </div>
            </Link>
          )}
        </div>
      )}

      <section aria-label="Standings" className="mt-6">
        <h2 className="font-race text-2xl uppercase text-ink">Standings</h2>
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => {
            const owner = memberById(r.car.ownerId);
            return (
              <div key={r.car.id} className={cn('flex items-center gap-3 rounded-2xl border bg-surface p-2 pl-3', data.myVote === r.car.id ? 'border-hot' : 'border-border')}>
                <span className="w-8 shrink-0 font-race text-2xl text-ink-muted">P{i + 1}</span>
                <Link to={`/garage/${r.car.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <img src={photo(r.car)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{owner?.name ?? 'Member'}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{r.car.year} {carName(r.car)} · {r.votes} {r.votes === 1 ? "vote" : "votes"}</span>
                  </span>
                </Link>
                <VoteBtn car={r.car} compact />
              </div>
            );
          })}
          {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">No cars in the club garage yet.</p>}
        </div>
      </section>
    </div>
  );
}
