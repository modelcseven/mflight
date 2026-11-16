import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { carPhoto } from '@/lib/data';
import type { Car } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/Confirm';
import { Btn, Chip, Empty, ErrorBox, FilterChips, Loading, PageHeader, SearchBox, fmtDate, useAdminData } from './ui';

type AdminCar = Car & { ownerName: string; ownerNumber: string; createdAt: string };

export default function Garages() {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useAdminData<{ cars: AdminCar[] }>('/admin/cars');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'featured' | 'hidden'>('all');
  const [deleting, setDeleting] = useState<AdminCar | null>(null);
  const cars = useMemo(() => (data?.cars ?? []).filter((c) => {
    if (filter === 'featured' && !c.featured) return false;
    if (filter === 'hidden' && !c.hidden) return false;
    return !q || `${c.year} ${c.make} ${c.model} ${c.ownerName}`.toLowerCase().includes(q.toLowerCase());
  }), [data, q, filter]);

  const patch = async (c: AdminCar, body: Partial<Car>, msg: string) => {
    try {
      await api.patch(`/admin/cars/${c.id}`, body);
      await reload();
      refresh().catch(() => {});
      toast(msg, { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Garages" description="Feature a Car of the Month and moderate member cars." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search model or owner…" />
        <FilterChips value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All', count: data?.cars.length }, { id: 'featured', label: 'Featured' }, { id: 'hidden', label: 'Hidden' }]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : cars.length === 0 ? <Empty>No cars.</Empty> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cars.map((c) => (
            <article key={c.id} className={cn('overflow-hidden rounded-2xl border bg-white shadow-card', c.featured ? 'border-gold' : 'border-border', c.hidden && 'opacity-60')}>
              <Link to={`/garage/${c.id}`} className="block aspect-[16/9] overflow-hidden bg-bg-app">
                <img src={carPhoto(c)} alt="" className="h-full w-full object-cover" />
              </Link>
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-ink">{c.year} {c.make} {c.model}</p>
                    <p className="truncate text-[12px] text-ink-muted">{c.ownerName} · {c.ownerNumber} · added {fmtDate(c.createdAt)}</p>
                  </div>
                  {c.featured && <Chip tone="gold">Car of the Month</Chip>}
                  {c.hidden && <Chip tone="danger">Hidden</Chip>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Btn size="sm" tone={c.featured ? 'ghost' : 'gold'} onClick={() => patch(c, { featured: !c.featured }, c.featured ? 'No longer featured.' : 'Now Car of the Month — owner notified.')}>
                    <Star size={13} /> {c.featured ? 'Unfeature' : 'Make Car of the Month'}
                  </Btn>
                  <Btn size="sm" tone="subtle" onClick={() => patch(c, { hidden: !c.hidden }, c.hidden ? 'Car visible again.' : 'Car hidden from members.')}>{c.hidden ? <Eye size={13} /> : <EyeOff size={13} />}</Btn>
                  <Btn size="sm" tone="subtle" onClick={() => setDeleting(c)}><Trash2 size={13} className="text-danger" /></Btn>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.model}?`} description={`Removes this car from ${deleting?.ownerName}'s garage.`} confirmLabel="Delete car"
        onConfirm={async () => { await api.del(`/admin/cars/${deleting!.id}`); setData((d) => d && { cars: d.cars.filter((x) => x.id !== deleting!.id) }); refresh().catch(() => {}); toast('Car deleted.'); }} />
    </div>
  );
}
