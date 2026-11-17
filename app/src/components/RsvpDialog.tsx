import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Car, Check, CreditCard, Loader2, Minus, Plus, TicketCheck, Trash2, Users, X } from 'lucide-react';
import type { ClubEvent } from '@/lib/data';
import { SETTINGS, eur } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import type { Rsvp } from '@/lib/rsvp';
import { clearRsvp, maxCars, maxGuests, payForEvent, setRsvp, useRsvps } from '@/lib/rsvp';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

function Stepper({
  icon: Icon,
  label,
  value,
  max,
  onChange,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-bg-app px-3.5 py-2.5">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon size={15} className="text-bmw-blue" />
        {label}
      </span>
      <span className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          aria-label={`Fewer ${label.toLowerCase()}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-ink transition-colors hover:border-bmw-blue/50 hover:text-bmw-blue disabled:opacity-35 disabled:hover:border-border disabled:hover:text-ink"
        >
          <Minus size={13} strokeWidth={2.5} />
        </button>
        <span className="w-5 text-center font-mono text-sm font-bold tabular-nums text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value === max}
          aria-label={`More ${label.toLowerCase()}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-ink transition-colors hover:border-bmw-blue/50 hover:text-bmw-blue disabled:opacity-35 disabled:hover:border-border disabled:hover:text-ink"
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </span>
    </div>
  );
}

/**
 * Shared RSVP controls (going toggle + guests/cars steppers + save/clear).
 * Used inside RsvpDialog on the feed and inline in the Events page modal —
 * both write to the same store, so both pages stay in sync.
 */
export function RsvpForm({ event, onDone }: { event: ClubEvent; onDone?: () => void }) {
  const { toast } = useToast();
  const rsvps = useRsvps();
  const existing = rsvps[event.id];

  const [draft, setDraft] = useState<Rsvp>(() => existing ?? { going: true, guests: 0, cars: 0 });

  // Re-sync the draft whenever the stored RSVP for this event changes
  // (e.g. edited on the other page, or dialog re-opened for another event).
  useEffect(() => {
    setDraft(existing ?? { going: true, guests: 0, cars: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, existing?.going, existing?.guests, existing?.cars]);

  const party = draft.going ? 1 + draft.guests : 0;
  const [busy, setBusy] = useState<null | 'save' | 'clear' | 'pay'>(null);
  const stripe = !!SETTINGS.payments?.stripe;
  const total = (event.packagePrice || 0) * party;
  const owes = existing?.going && existing.paymentStatus === 'unpaid';

  const handleSave = async (payNow = false) => {
    if (busy) return;
    if (!draft.going) {
      if (existing) await handleClear();
      else onDone?.();
      return;
    }
    setBusy(payNow ? 'pay' : 'save');
    try {
      const r = await setRsvp(event.id, draft, { payNow });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.rsvp.status === 'waitlist') {
        toast("The event is full, so you're on the waitlist. We'll confirm automatically if a place opens.", {
          title: `Waitlisted · ${event.title}`,
        });
      } else {
        toast(
          `You're in — party of ${party}${draft.cars > 0 ? ` · ${draft.cars} ${draft.cars === 1 ? 'car' : 'cars'}` : ''}.${
            r.rsvp.paymentStatus === 'unpaid' ? ` ${eur(r.rsvp.amount ?? total)} due${stripe ? ' — pay any time from this event.' : ' — the club will contact you about payment.'}` : ' See you there!'
          }`,
          { title: `RSVP confirmed · ${event.title}`, variant: 'success' },
        );
      }
      onDone?.();
    } catch (e) {
      toast((e as Error).message, { title: 'Could not save RSVP' });
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    setBusy('clear');
    try {
      await clearRsvp(event.id);
      toast("Can't make it anymore — RSVP removed.", { title: event.title });
      onDone?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handlePay = async () => {
    setBusy('pay');
    try {
      await payForEvent(event.id);
    } catch (e) {
      toast((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div>
      {/* Going toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={draft.going}
        onClick={() => setDraft((d) => ({ ...d, going: !d.going }))}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors',
          draft.going ? 'border-success/40 bg-success/10' : 'border-border bg-white hover:border-bmw-blue/40',
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              draft.going ? 'bg-success text-white' : 'bg-bmw-blue-light text-bmw-blue',
            )}
          >
            {draft.going ? <Check size={15} strokeWidth={3} /> : <TicketCheck size={15} />}
          </span>
          <span className="text-left">
            <span className={cn('block text-sm font-bold', draft.going ? 'text-success' : 'text-ink')}>
              {draft.going ? "I'm coming" : "I'm coming?"}
            </span>
            <span className="block text-[11px] text-ink-muted">
              {draft.going ? 'Your seat is held while you edit details' : 'Flip the switch to hold your seat'}
            </span>
          </span>
        </span>
        <span
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            draft.going ? 'bg-success' : 'bg-silver-light',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition-all',
              draft.going ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </span>
      </button>

      {/* Steppers */}
      {draft.going && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-3 space-y-2"
        >
          <Stepper
            icon={Users}
            label="Guests"
            value={draft.guests}
            max={maxGuests()}
            onChange={(guests) => setDraft((d) => ({ ...d, guests }))}
          />
          <Stepper
            icon={Car}
            label="Cars"
            value={draft.cars}
            max={maxCars()}
            onChange={(cars) => setDraft((d) => ({ ...d, cars }))}
          />
          <p className="px-1 font-mono text-[11px] tabular-nums text-ink-muted">
            Party of {party} {party === 1 ? 'person' : 'people'}
            {draft.cars > 0 ? ` · ${draft.cars} ${draft.cars === 1 ? 'car' : 'cars'}` : ''}
            {total > 0 ? ` · ${eur(total)} total` : ''}
          </p>
        </motion.div>
      )}

      {existing?.status === 'waitlist' && (
        <p className="mt-3 rounded-xl bg-gold-light px-3.5 py-2.5 text-[12px] font-medium text-gold-dark">
          You're on the waitlist. We'll confirm your place automatically if one opens.
        </p>
      )}
      {owes && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold-light/60 px-3.5 py-2.5">
          <span className="text-[12px] font-medium text-gold-dark">
            {eur(existing.amount ?? 0)} outstanding{stripe ? '' : ' — the club will contact you about payment'}
          </span>
          {stripe && (
            <button type="button" onClick={handlePay} disabled={!!busy}
              className="flex items-center gap-1.5 rounded-lg bg-navy-950 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
              {busy === 'pay' ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />} Pay now
            </button>
          )}
        </div>
      )}
      {existing?.paymentStatus === 'paid' && (
        <p className="mt-3 rounded-xl bg-success/10 px-3.5 py-2.5 text-[12px] font-semibold text-success">Paid — you're all set.</p>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {draft.going && total > 0 && stripe && !existing?.going && (
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={!!busy}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-navy-950 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'pay' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            RSVP & pay {eur(total)}
          </button>
        )}
        <button
          type="button"
          disabled={!!busy}
          onClick={() => handleSave(false)}
          className={cn(
            'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]',
            draft.going ? 'bg-bmw-blue hover:bg-bmw-blue-dark' : 'bg-ink-muted hover:bg-ink',
          )}
        >
          {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : draft.going ? <Check size={15} strokeWidth={3} /> : <X size={15} />}
          {draft.going ? (total > 0 && stripe && !existing?.going ? 'RSVP, pay later' : 'Save RSVP') : 'Not going'}
        </button>
        {existing && (
          <button
            type="button"
            disabled={!!busy}
            onClick={handleClear}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-danger/30 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/5"
          >
            <Trash2 size={14} />
            Can't make it anymore
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * RSVP dialog (feed rail + anywhere else): small centered modal wrapping
 * RsvpForm. Render inside <AnimatePresence> and only while `event` is set.
 */
export default function RsvpDialog({ event, onClose }: { event: ClubEvent; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-ink-dark/55 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`RSVP — ${event.title}`}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-modal"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full bg-bg-app p-1.5 text-ink-muted transition-colors hover:text-ink"
        >
          <X size={16} />
        </button>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-dark">RSVP</p>
        <h3 className="mt-1 pr-8 font-display text-lg font-extrabold tracking-tight text-ink">{event.title}</h3>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-muted">
          {event.location}
        </p>
        <div className="mt-4 border-t border-border pt-4">
          <RsvpForm event={event} onDone={onClose} />
        </div>
      </motion.div>
    </div>
  );
}
