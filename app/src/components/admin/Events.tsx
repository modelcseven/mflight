import { useMemo, useState } from 'react';
import { CalendarPlus, Download, ImagePlus, Loader2, Mail, Pencil, Star, Trash2, Users } from 'lucide-react';
import { api, downloadFile, uploadImage } from '@/lib/api';
import { SETTINGS, eur } from '@/lib/data';
import type { ClubEvent } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/Confirm';
import {
  Btn, Chip, Empty, ErrorBox, Field, FilterChips, Loading, Modal, PageHeader, Panel, SearchBox, SidePanel, Table, Toggle,
  fmtDate, inputCls, statusTone, td, useAdminData,
} from './ui';

type AdminEvent = ClubEvent & { revenue: number };
interface Attendee {
  id: string; userId: string; name: string; email: string; phone: string; membershipNumber: string; status: 'going' | 'waitlist' | 'cancelled';
  guests: number; cars: number; checkedIn: boolean; paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'free'; amount: number; notes: string;
}

const blank = (): Partial<AdminEvent> => ({
  title: '', location: '', country: '', nearestAirport: '', startDate: '', endDate: '', image: '', category: SETTINGS.events?.categories?.[0] ?? 'Festival',
  description: '', packagePrice: 0, perks: [], capacity: SETTINGS.events?.defaultCapacity ?? 40, baseAttendees: 0, featured: false, published: true,
});

function EventForm({ event, onClose, onSaved }: { event: Partial<AdminEvent> | null; onClose: () => void; onSaved: (e: AdminEvent) => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Partial<AdminEvent>>(() => event ?? blank());
  const [perks, setPerks] = useState((event?.perks ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof AdminEvent>(k: K, v: AdminEvent[K]) => setF((x) => ({ ...x, [k]: v }));
  const editing = !!event?.id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, perks: perks.split('\n').map((p) => p.trim()).filter(Boolean) };
      const r = editing
        ? await api.patch<{ event: AdminEvent }>(`/admin/events/${event!.id}`, body)
        : await api.post<{ event: AdminEvent }>('/admin/events', body);
      onSaved({ ...r.event, revenue: (event as AdminEvent)?.revenue ?? 0 });
      toast(editing ? 'Event updated.' : 'Event created and members notified.', { variant: 'success' });
      onClose();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} wide title={editing ? `Edit ${event?.title}` : 'New event'} description="Members see published events on the feed and Events page.">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input required value={f.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
        <Field label="Location"><input required value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Munich, Germany" className={inputCls} /></Field>
        <Field label="Country" hint="Used for chapter scoping. Defaults to the last part of the location.">
          <input value={f.country ?? ''} onChange={(e) => set('country', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Start date"><input required type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputCls} /></Field>
        <Field label="End date"><input required type="date" value={f.endDate} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} className={inputCls} /></Field>
        <Field label="Category">
          <select value={f.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
            {(SETTINGS.events?.categories ?? []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Nearest airport (IATA)"><input value={f.nearestAirport} maxLength={4} onChange={(e) => set('nearestAirport', e.target.value.toUpperCase())} placeholder="MUC" className={inputCls} /></Field>
        <Field label={`Package price per person (${SETTINGS.club?.currency ?? 'EUR'})`} hint="0 = free event">
          <input type="number" min={0} value={f.packagePrice} onChange={(e) => set('packagePrice', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Capacity (people)"><input type="number" min={1} value={f.capacity} onChange={(e) => set('capacity', Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Offline / pre-registered attendees" hint="People confirmed outside the app; counts toward capacity.">
          <input type="number" min={0} value={f.baseAttendees} onChange={(e) => set('baseAttendees', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Cover image">
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-ink-muted hover:border-bmw-blue">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : f.image ? <img src={f.image} alt="" className="h-7 w-10 rounded object-cover" /> : <ImagePlus size={15} />}
            {f.image ? 'Change image' : 'Upload image'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try { set('image', await uploadImage(file)); } catch (err) { toast((err as Error).message); } finally { setUploading(false); }
            }} />
          </label>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} className={cn(inputCls, 'h-auto py-2')} />
        </Field>
        <Field label="Perks (one per line)" className="sm:col-span-2">
          <textarea rows={3} value={perks} onChange={(e) => setPerks(e.target.value)} className={cn(inputCls, 'h-auto py-2')} />
        </Field>
        <div className="sm:col-span-2 grid gap-x-6 sm:grid-cols-2">
          <Toggle checked={!!f.published} onChange={(v) => set('published', v)} label="Published" hint="Unpublished events are drafts only staff can see." />
          <Toggle checked={!!f.featured} onChange={(v) => set('featured', v)} label="Featured" hint="Highlighted at the top of the events rail." />
        </div>
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <Btn tone="subtle" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" busy={busy} disabled={uploading}>{editing ? 'Save event' : 'Create event'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function AttendeesPanel({ event, onClose, onChanged }: { event: AdminEvent; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useAdminData<{ attendees: Attendee[] }>(`/admin/events/${event.id}/attendees`);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState({ title: `Update: ${event.title}`, body: '', email: false });
  const [sending, setSending] = useState(false);
  const list = data?.attendees ?? [];

  const patch = async (a: Attendee, body: Partial<Attendee>) => {
    try {
      const r = await api.patch<{ attendee: Attendee | null }>(`/admin/events/${event.id}/attendees/${a.id}`, body);
      setData((d) => d && { attendees: r.attendee ? d.attendees.map((x) => (x.id === a.id ? r.attendee! : x)) : d.attendees.filter((x) => x.id !== a.id) });
      if (body.status || body.paymentStatus) { reload(); onChanged(); }
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const r = await api.post<{ recipients: number; emailed: number }>(`/admin/events/${event.id}/message`, msg);
      toast(`Sent to ${r.recipients} attendee${r.recipients === 1 ? '' : 's'}${msg.email ? ` (${r.emailed} emailed)` : ''}.`, { variant: 'success' });
      setMsgOpen(false);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const going = list.filter((a) => a.status === 'going');
  const checked = going.filter((a) => a.checkedIn).length;

  return (
    <SidePanel open onClose={onClose} wide title={event.title} description={`${fmtDate(event.startDate)} · ${event.location}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip tone="success">{going.reduce((n, a) => n + 1 + a.guests, 0)} going</Chip>
        <Chip tone="warning">{list.filter((a) => a.status === 'waitlist').length} waitlist</Chip>
        <Chip tone="info">{checked}/{going.length} checked in</Chip>
        <div className="ml-auto flex gap-2">
          <Btn size="sm" tone="ghost" onClick={() => downloadFile(`/admin/events/${event.id}/attendees.csv`, `${event.id}-attendees.csv`).catch((e) => toast((e as Error).message))}><Download size={13} /> CSV</Btn>
          <Btn size="sm" onClick={() => setMsgOpen(true)} disabled={!list.length}><Mail size={13} /> Message attendees</Btn>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : list.length === 0 ? (
        <Empty>No RSVPs yet.</Empty>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className={cn('rounded-xl border p-3', a.checkedIn ? 'border-success/40 bg-success/5' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.name} <span className="font-mono text-[11px] font-normal text-ink-faint">{a.membershipNumber}</span></p>
                  <p className="truncate text-[12px] text-ink-muted">{a.email}{a.phone ? ` · ${a.phone}` : ''} · party of {1 + a.guests}{a.cars ? ` · ${a.cars} car${a.cars === 1 ? '' : 's'}` : ''}{a.amount ? ` · ${eur(a.amount)}` : ''}</p>
                </div>
                <select value={a.status} onChange={(e) => patch(a, { status: e.target.value as Attendee['status'] })} className={cn(inputCls, 'h-8 w-auto text-xs')} aria-label="RSVP status">
                  <option value="going">Going</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="cancelled">Cancel</option>
                </select>
                <select value={a.paymentStatus} onChange={(e) => patch(a, { paymentStatus: e.target.value as Attendee['paymentStatus'] })} className={cn(inputCls, 'h-8 w-auto text-xs')} aria-label="Payment status">
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="free">Free</option>
                  <option value="refunded">Refunded</option>
                </select>
                <Btn size="sm" tone={a.checkedIn ? 'ghost' : 'primary'} disabled={a.status !== 'going'} onClick={() => patch(a, { checkedIn: !a.checkedIn })}>
                  {a.checkedIn ? 'Undo check-in' : 'Check in'}
                </Btn>
              </div>
              <input
                defaultValue={a.notes}
                placeholder="Notes (dietary, room, car…)"
                onBlur={(e) => e.target.value !== a.notes && patch(a, { notes: e.target.value })}
                className={cn(inputCls, 'mt-2 h-8 text-xs')}
              />
            </div>
          ))}
        </div>
      )}
      <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title="Message attendees" description="Goes to everyone going or on the waitlist.">
        <div className="space-y-3">
          <Field label="Title"><input value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} className={inputCls} /></Field>
          <Field label="Message"><textarea rows={5} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} className={cn(inputCls, 'h-auto py-2')} /></Field>
          <Toggle checked={msg.email} onChange={(v) => setMsg({ ...msg, email: v })} label="Also send by email" hint="Requires email (SMTP) to be configured in Settings." />
          <div className="flex justify-end gap-2"><Btn tone="subtle" onClick={() => setMsgOpen(false)}>Cancel</Btn><Btn busy={sending} disabled={!msg.body.trim()} onClick={send}>Send</Btn></div>
        </div>
      </Modal>
    </SidePanel>
  );
}

export default function EventsAdmin() {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useAdminData<{ events: AdminEvent[] }>('/admin/events');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'drafts' | 'cancelled' | 'all'>('upcoming');
  const [editing, setEditing] = useState<Partial<AdminEvent> | null>(null);
  const [attendees, setAttendees] = useState<AdminEvent | null>(null);
  const [deleting, setDeleting] = useState<AdminEvent | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const events = useMemo(() => data?.events ?? [], [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'upcoming' && (e.cancelled || e.endDate < today || !e.published)) return false;
      if (filter === 'past' && e.endDate >= today) return false;
      if (filter === 'drafts' && e.published) return false;
      if (filter === 'cancelled' && !e.cancelled) return false;
      return !s || `${e.title} ${e.location} ${e.category}`.toLowerCase().includes(s);
    });
  }, [events, q, filter, today]);

  const save = (e: AdminEvent) => {
    setData((d) => d && { events: d.events.some((x) => x.id === e.id) ? d.events.map((x) => (x.id === e.id ? { ...x, ...e } : x)) : [...d.events, e] });
    refresh().catch(() => {});
  };

  const quick = async (e: AdminEvent, body: Partial<AdminEvent>, msg: string) => {
    try {
      const r = await api.patch<{ event: AdminEvent }>(`/admin/events/${e.id}`, body);
      save({ ...r.event, revenue: e.revenue });
      toast(msg, { variant: 'success' });
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Events" description="Plan events, manage capacity and run check-in." actions={<Btn onClick={() => setEditing(blank())}><CalendarPlus size={15} /> New event</Btn>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search events…" />
        <FilterChips value={filter} onChange={setFilter} options={[
          { id: 'upcoming', label: 'Upcoming' }, { id: 'drafts', label: 'Drafts' }, { id: 'past', label: 'Past' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'all', label: 'All' },
        ]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {filtered.length === 0 ? <Empty>No events here.</Empty> : (
            <Table head={['Event', 'Dates', 'Price', 'Capacity', 'Revenue', 'Status', '']}>
              {filtered.map((e) => {
                const pct = Math.min(100, Math.round(((e.goingTotal ?? 0) / (e.capacity || 1)) * 100));
                return (
                  <tr key={e.id} className="hover:bg-bg-app/60">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        {e.image ? <img src={e.image} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="h-10 w-14 shrink-0 rounded-lg bg-bg-app" />}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate font-semibold text-ink">{e.featured && <Star size={13} className="fill-gold text-gold" />}{e.title}</p>
                          <p className="truncate text-[12px] text-ink-muted">{e.category} · {e.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap font-mono text-[12px]`}>{fmtDate(e.startDate)}</td>
                    <td className={`${td} font-mono text-[12px]`}>{e.packagePrice ? eur(e.packagePrice) : 'Free'}</td>
                    <td className={td}>
                      <div className="w-32">
                        <div className="h-1.5 overflow-hidden rounded-full bg-bg-app"><div className={cn('h-full rounded-full', pct >= 90 ? 'bg-m-red' : pct >= 70 ? 'bg-gold' : 'bg-success')} style={{ width: `${pct}%` }} /></div>
                        <p className="mt-1 font-mono text-[11px] text-ink-muted">{e.goingTotal}/{e.capacity}{e.waitlist ? ` · ${e.waitlist} wait` : ''}</p>
                      </div>
                    </td>
                    <td className={`${td} font-mono text-[12px]`}>{eur(e.revenue)}</td>
                    <td className={td}>
                      {e.cancelled ? <Chip tone="danger">Cancelled</Chip> : !e.published ? <Chip>Draft</Chip> : e.endDate < today ? <Chip>Past</Chip> : <Chip tone={statusTone('Active')}>Live</Chip>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <div className="flex justify-end gap-1">
                        <Btn size="sm" tone="ghost" onClick={() => setAttendees(e)}><Users size={13} /> Attendees</Btn>
                        <Btn size="sm" tone="subtle" onClick={() => setEditing(e)} aria-label="Edit"><Pencil size={13} /></Btn>
                        <Btn size="sm" tone="subtle" onClick={() => quick(e, { featured: !e.featured }, e.featured ? 'Unfeatured.' : 'Featured.')} aria-label="Toggle featured"><Star size={13} /></Btn>
                        {!e.cancelled ? (
                          <Btn size="sm" tone="subtle" onClick={() => quick(e, { cancelled: true }, 'Event cancelled and attendees notified.')}>Cancel</Btn>
                        ) : (
                          <Btn size="sm" tone="subtle" onClick={() => quick(e, { cancelled: false }, 'Event restored.')}>Restore</Btn>
                        )}
                        <Btn size="sm" tone="subtle" onClick={() => setDeleting(e)} aria-label="Delete"><Trash2 size={13} className="text-danger" /></Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      )}
      {editing && <EventForm event={editing} onClose={() => setEditing(null)} onSaved={save} />}
      {attendees && <AttendeesPanel event={attendees} onClose={() => setAttendees(null)} onChanged={reload} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.title}?`}
        description="Deletes the event and all its RSVPs. Consider cancelling instead so attendees are notified." confirmLabel="Delete event"
        onConfirm={async () => {
          await api.del(`/admin/events/${deleting!.id}`);
          setData((d) => d && { events: d.events.filter((x) => x.id !== deleting!.id) });
          refresh().catch(() => {});
          toast('Event deleted.');
        }} />
    </div>
  );
}
