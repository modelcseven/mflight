import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { eur, memberById } from '@/lib/data';
import type { ListingStatus, MarketplaceListing } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import ConfirmDialog from '@/components/Confirm';
import { Btn, Chip, Empty, ErrorBox, FilterChips, Loading, PageHeader, Panel, SearchBox, Table, fmtDate, inputCls, statusTone, td, useAdminData } from './ui';

export default function Marketplace() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'all') as ListingStatus | 'all';
  const { data, setData, error, loading, reload } = useAdminData<{ listings: MarketplaceListing[] }>('/admin/listings');
  const [q, setQ] = useState('');
  const [deleting, setDeleting] = useState<MarketplaceListing | null>(null);
  const all = useMemo(() => data?.listings ?? [], [data]);
  const list = useMemo(() => all.filter((l) => (status === 'all' || l.status === status) && (!q || l.title.toLowerCase().includes(q.toLowerCase()))), [all, status, q]);

  const setStatus = async (l: MarketplaceListing, s: ListingStatus) => {
    try {
      const r = await api.patch<{ listing: MarketplaceListing }>(`/admin/listings/${l.id}`, { status: s });
      setData((d) => d && { listings: d.listings.map((x) => (x.id === l.id ? r.listing : x)) });
      refresh().catch(() => {});
      toast(`Listing ${s === 'Active' ? 'approved' : s.toLowerCase()}.`, { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const count = (s: string) => all.filter((l) => l.status === s).length;

  return (
    <div>
      <PageHeader title="Marketplace" description="Approve member listings and keep the Part Store clean." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search listings…" />
        <FilterChips value={status} onChange={(v) => setParams(v === 'all' ? {} : { status: v }, { replace: true })} options={[
          { id: 'all', label: 'All', count: all.length }, { id: 'Pending', label: 'Pending', count: count('Pending') }, { id: 'Active', label: 'Active', count: count('Active') },
          { id: 'Sold', label: 'Sold', count: count('Sold') }, { id: 'Rejected', label: 'Rejected', count: count('Rejected') },
        ]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {list.length === 0 ? <Empty>No listings.</Empty> : (
            <Table head={['Listing', 'Seller', 'Price', 'Listed', 'Status', '']}>
              {list.map((l) => (
                <tr key={l.id} className="hover:bg-bg-app/60">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {l.image ? <img src={l.image} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="h-10 w-14 shrink-0 rounded-lg bg-bg-app" />}
                      <div className="min-w-0"><p className="truncate font-semibold text-ink">{l.title}</p><p className="text-[12px] text-ink-muted">{l.category} · {l.condition}</p></div>
                    </div>
                  </td>
                  <td className={`${td} text-[13px]`}>{memberById(l.sellerId)?.name ?? '—'}</td>
                  <td className={`${td} font-mono text-[12px]`}>{eur(l.price)}</td>
                  <td className={`${td} whitespace-nowrap font-mono text-[12px]`}>{fmtDate(l.listedAt)}</td>
                  <td className={td}><Chip tone={statusTone(l.status)}>{l.status}</Chip></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <div className="flex justify-end gap-1">
                      {l.status === 'Pending' && <>
                        <Btn size="sm" onClick={() => setStatus(l, 'Active')}><Check size={13} /> Approve</Btn>
                        <Btn size="sm" tone="danger" onClick={() => setStatus(l, 'Rejected')}><X size={13} /> Reject</Btn>
                      </>}
                      {l.status !== 'Pending' && (
                        <select value={l.status} onChange={(e) => setStatus(l, e.target.value as ListingStatus)} className={`${inputCls} h-8 w-auto text-xs`} aria-label="Status">
                          {['Active', 'Pending', 'Sold', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      )}
                      <Btn size="sm" tone="subtle" onClick={() => setDeleting(l)} aria-label="Delete"><Trash2 size={13} className="text-danger" /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete listing?" description={deleting?.title} confirmLabel="Delete"
        onConfirm={async () => { await api.del(`/admin/listings/${deleting!.id}`); setData((d) => d && { listings: d.listings.filter((x) => x.id !== deleting!.id) }); refresh().catch(() => {}); toast('Listing deleted.'); }} />
    </div>
  );
}
