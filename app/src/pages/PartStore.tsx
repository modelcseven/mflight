import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Flag, ImagePlus, Loader2, Plus, Search, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import type { MarketplaceListing, Order } from '@/lib/data';
import { MARKETPLACE_LISTINGS, MEMBER_PROFILE, SETTINGS, eur, memberById } from '@/lib/data';
import { api, uploadImage } from '@/lib/api';
import { removeById, upsert, useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import MembershipPlate from '@/components/MembershipPlate';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/Confirm';
import ReportDialog from '@/components/ReportDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

function statusChipClass(status: MarketplaceListing['status']): string {
  if (status === 'Active') return 'bg-success/10 text-success ring-1 ring-success/25';
  if (status === 'Pending') return 'bg-gold-light text-gold-dark ring-1 ring-gold/30';
  if (status === 'Rejected') return 'bg-danger/10 text-danger ring-1 ring-danger/25';
  return 'bg-silver-light text-ink-muted ring-1 ring-silver/40';
}

const INPUT = 'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-bmw-blue focus:ring-2 focus:ring-bmw-blue/15';

function SellDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const cats = SETTINGS.marketplace?.categories ?? ['Parts'];
  const conds = SETTINGS.marketplace?.conditions ?? ['New'];
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(cats[0]);
  const [condition, setCondition] = useState(conds[0]);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setPrice(''); setDescription(''); setImage(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post<{ listing: MarketplaceListing }>('/listings', { title, price: Number(price), category, condition, description, image });
      upsert(MARKETPLACE_LISTINGS, r.listing, true);
      toast(r.listing.status === 'Pending' ? 'Your listing is waiting for moderator approval.' : 'Your listing is live.', {
        title: 'Listing created', variant: 'success',
      });
      reset();
      onClose();
    } catch (err) {
      toast((err as Error).message, { title: 'Could not create listing' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Sell an item</DialogTitle>
          <DialogDescription>
            {SETTINGS.marketplace?.requireApproval ? 'New listings are reviewed by a moderator before they go live.' : 'Listings go live straight away.'}
            {SETTINGS.marketplace?.feePercent ? ` A ${SETTINGS.marketplace.feePercent}% club fee applies on sale.` : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling?" className={INPUT} />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={`Price (${SETTINGS.club?.currency ?? 'EUR'})`} className={INPUT} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={INPUT}>
            {conds.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description, fitment, pickup / shipping…" className={INPUT} />
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm text-ink-muted hover:border-bmw-blue">
            {image ? <img src={image} alt="" className="h-14 w-20 rounded-lg object-cover" /> : uploading ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />}
            {image ? 'Change photo' : uploading ? 'Uploading…' : 'Add a photo'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try { setImage(await uploadImage(f)); } catch (err) { toast((err as Error).message); } finally { setUploading(false); }
            }} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="flex items-center gap-2 rounded-xl bg-bmw-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Publish listing
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PartStore() {
  const { toast } = useToast();
  const v = useStore();
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [condition, setCondition] = useState('All conditions');
  const [selling, setSelling] = useState(false);
  const [buying, setBuying] = useState<MarketplaceListing | null>(null);
  const [deleting, setDeleting] = useState<MarketplaceListing | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  const CATEGORIES = ['All', ...(SETTINGS.marketplace?.categories ?? [])];
  const CONDITIONS = ['All conditions', ...(SETTINGS.marketplace?.conditions ?? [])];
  const me = MEMBER_PROFILE.id;

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKETPLACE_LISTINGS.filter((l) => {
      if (tab === 'mine' ? l.sellerId !== me : l.status !== 'Active' && l.status !== 'Sold') return false;
      if (q && !l.title.toLowerCase().includes(q) && !(l.description ?? '').toLowerCase().includes(q)) return false;
      if (category !== 'All' && l.category !== category) return false;
      if (condition !== 'All conditions' && l.condition !== condition) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, condition, tab, v]);

  const myCount = MARKETPLACE_LISTINGS.filter((l) => l.sellerId === me).length;

  const buy = async () => {
    if (!buying) return;
    try {
      const r = await api.post<{ order: Order; url: string | null }>(`/listings/${buying.id}/buy`);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      toast(`${memberById(buying.sellerId)?.name ?? 'The seller'} has your contact details and will be in touch to arrange payment and handover.`, {
        title: 'Purchase request sent', variant: 'success',
      });
    } catch (e) {
      toast((e as Error).message, { title: 'Could not complete' });
      throw e;
    }
  };

  const markSold = async (l: MarketplaceListing) => {
    try {
      const r = await api.patch<{ listing: MarketplaceListing }>(`/listings/${l.id}`, { status: 'Sold' });
      upsert(MARKETPLACE_LISTINGS, r.listing);
      toast('Marked as sold.', { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await api.del(`/listings/${deleting.id}`);
    removeById(MARKETPLACE_LISTINGS, deleting.id);
    toast('Listing deleted.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
        className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-dark">
            {SETTINGS.club?.clubName ?? 'BMW Car Club Europe'} · Members only
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Part Store</h1>
          <p className="mt-1 text-sm text-ink-muted">Parts, wheels and club merchandise listed by fellow members.</p>
        </div>
        <button onClick={() => setSelling(true)}
          className="ml-auto flex items-center gap-2 rounded-xl bg-bmw-blue px-4 py-2.5 font-display text-sm font-bold text-white shadow-sm hover:bg-bmw-blue-dark">
          <Plus size={16} strokeWidth={2.5} /> Sell an item
        </button>
      </motion.div>

      <div className="flex gap-2">
        {([['browse', 'Browse'], ['mine', `My listings (${myCount})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === id ? 'bg-bmw-blue text-white' : 'border border-border bg-white text-ink-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts, wheels, merchandise…"
            className="w-full rounded-xl border border-border bg-bg-app py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-bmw-blue focus:ring-2 focus:ring-bmw-blue/20" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                category === c ? 'bg-bmw-blue text-white shadow-sm' : 'bg-bg-app text-ink-muted ring-1 ring-border hover:text-bmw-blue hover:ring-bmw-blue/30')}>
              <Tag size={12} />{c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CONDITIONS.map((c) => (
            <button key={c} onClick={() => setCondition(c)}
              className={cn('rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                condition === c ? 'bg-ink text-white' : 'bg-bg-app text-ink-muted ring-1 ring-border hover:text-ink')}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Listing grid */}
      {listings.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => {
            const seller = memberById(l.sellerId);
            const sold = l.status === 'Sold';
            const mine = l.sellerId === me;
            return (
              <motion.article key={l.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-shadow hover:shadow-elevated">
                <div className="relative aspect-[16/9] overflow-hidden bg-silver-light">
                  {l.image ? (
                    <img src={l.image} alt={l.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-faint"><ShoppingBag size={32} /></div>
                  )}
                  <span className={cn('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm', statusChipClass(l.status))}>
                    {l.status === 'Pending' ? 'Awaiting approval' : l.status}
                  </span>
                  {!mine && (
                    <button onClick={() => setReporting(l.id)} aria-label="Report listing"
                      className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-ink-muted shadow-sm hover:text-ink">
                      <Flag size={13} />
                    </button>
                  )}
                  {sold && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink-dark/55">
                      <span className="rounded-full bg-white/95 px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-widest text-ink">Sold</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 font-display text-sm font-bold leading-snug text-ink">{l.title}</h3>
                    <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-bmw-blue">{eur(l.price)}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">{l.condition} · {l.category}</p>
                  {l.description && <p className="mt-2 line-clamp-3 text-[13px] text-ink">{l.description}</p>}
                  {seller && !mine && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bmw-blue-light text-[11px] font-bold text-bmw-blue">{seller.avatarInitials}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-ink">{seller.name}</p>
                        <MembershipPlate number={seller.membershipNumber} size="sm" className="mt-0.5" />
                      </div>
                    </div>
                  )}
                  <div className="mt-auto pt-4">
                    {mine ? (
                      <div className="flex gap-2">
                        {l.status === 'Active' && (
                          <button onClick={() => markSold(l)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-ink hover:border-success/40 hover:text-success">
                            <CheckCircle2 size={14} /> Mark sold
                          </button>
                        )}
                        <button onClick={() => setDeleting(l)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger/30 px-3 py-2 text-xs font-bold text-danger hover:bg-danger/5">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    ) : (
                      <button disabled={sold} onClick={() => setBuying(l)}
                        className={cn('inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                          sold ? 'cursor-not-allowed bg-silver-light text-ink-faint' : 'bg-bmw-blue text-white hover:bg-bmw-blue-dark')}>
                        <ShoppingBag size={14} />
                        {sold ? 'No longer available' : SETTINGS.payments?.stripe ? `Buy now · ${eur(l.price)}` : 'Request to buy'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white shadow-card">
          <EmptyState
            title={tab === 'mine' ? 'You have no listings' : 'No parts found'}
            body={tab === 'mine' ? 'Use “Sell an item” to list parts, wheels or merchandise for other members.' : 'No listings match your search or filters. Try a different keyword or clear the filters.'}
            illustration={
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-silver bg-bmw-blue-light/60 text-bmw-blue">
                <ShoppingBag size={32} />
              </span>
            }
          />
        </div>
      )}

      <SellDialog open={selling} onClose={() => setSelling(false)} />
      <ConfirmDialog
        open={!!buying}
        onOpenChange={(o) => !o && setBuying(null)}
        tone="primary"
        title={buying ? `Buy “${buying.title}”?` : ''}
        description={
          SETTINGS.payments?.stripe
            ? `You'll be taken to secure checkout to pay ${buying ? eur(buying.price) : ''}.`
            : `The seller gets your name and email and will contact you to arrange payment of ${buying ? eur(buying.price) : ''} and handover.`
        }
        confirmLabel={SETTINGS.payments?.stripe ? 'Go to checkout' : 'Send request'}
        onConfirm={buy}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this listing?"
        description={deleting?.title}
        confirmLabel="Delete"
        onConfirm={remove}
      />
      {reporting && <ReportDialog targetType="listing" targetId={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
