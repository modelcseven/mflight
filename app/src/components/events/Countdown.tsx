import { useEffect, useState } from 'react';
import { parseDate } from '@/lib/data';

/** Race-start style countdown to an event's start date (local midnight). */
export default function Countdown({ startDate, label = 'Lights out in' }: { startDate: string; label?: string }) {
  const target = parseDate(startDate).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const parts = [
    { v: String(days), l: 'Days' },
    { v: String(hrs).padStart(2, '0'), l: 'Hrs' },
    { v: String(mins).padStart(2, '0'), l: 'Min', hot: true },
  ];
  return (
    <div aria-label={`${label} ${days} days, ${hrs} hours, ${mins} minutes`} className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">{label}</span>
      <div className="flex gap-1.5" aria-hidden>
        {parts.map((p) => (
          <span key={p.l} className="flex min-w-[48px] flex-col items-center rounded-xl border border-white/15 bg-black/55 px-2 py-1 backdrop-blur">
            <span className={`font-race text-2xl leading-none ${p.hot ? 'text-[#F5C84A]' : 'text-white'}`}>{p.v}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">{p.l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
