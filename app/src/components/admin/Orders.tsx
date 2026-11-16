import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { eur, SETTINGS } from '@/lib/data';
import type { Order } from '@/lib/data';
import { useToast } from '@/lib/toast';
import ConfirmDialog from '@/components/Confirm';
import { Btn, Chip, Empty, ErrorBox, FilterChips, Loading, PageHeader, Panel, SearchBox, Stat, Table, fmtDateTime, statusTone, td, useAdminData } from './ui';
import { CreditCard, Clock, RotateCcw } from 'lucide-react';

export default function Orders() {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useAdminData<{ orders: Order[] }>('/admin/orders');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Order['status']>('all');
  const [type, setType] = useState<'all' | Order['type']>('all');
  const [confirm, setConfirm] = useState<{ order: Order; action: 'mark-paid' | 'refund' | 'cancel' } | null>(null);
  const all = useMemo(() => data?.orders ?? [], [data]);
  const list = useMemo(() => all.filter((o) =>
    (status === 'all' || o.status === status) && (type === 'all' || o.type === type) &&
    (!q || `${o.description} ${o.userName ?? ''} ${o.userEmail ?? ''} ${o.id}`.toLowerCase().includes(q.toLowerCase())),
  ), [all, q, status, type]);
  const sum = (s: Order['status']) => all.filter((o) => o.status === s).reduce((n, o) => n + o.amount, 0);

  const run = async () => {
    if (!confirm) return;
    const { order, action } = confirm;
    try {
      const r = await api.post<{ order: Order }>(`/admin/orders/${order.id}/${action}`);
      setData((d) => d && { orders: d.orders.map((x) => (x.id === order.id ? r.order : x)) });
      toast(action === 'mark-paid' ? 'Marked as paid.' : action === 'refund' ? 'Refund issued.' : 'Order cancelled.', { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
      throw e;
    }
  };

  return (
    <div>
      <PageHeader title="Orders & payments" description={SETTINGS.payments?.stripe ? 'Online payments via Stripe are on. Manual payments can be marked paid here.' : 'Online payments are off — mark payments as received here, or connect Stripe in Settings → Payments.'}
        actions={<Btn tone="ghost" onClick={() => downloadFile('/admin/orders.csv', 'orders.csv').catch((e) => toast((e as Error).message))}><Download size={15} /> Export CSV</Btn>} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Paid" value={eur(sum('paid'))} icon={CreditCard} tone="success" />
        <Stat label="Outstanding" value={eur(sum('pending'))} icon={Clock} tone="warning" />
        <Stat label="Refunded" value={eur(sum('refunded'))} icon={RotateCcw} tone="danger" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search member, item or order id…" />
        <FilterChips value={status} onChange={setStatus} options={[{ id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'paid', label: 'Paid' }, { id: 'refunded', label: 'Refunded' }, { id: 'cancelled', label: 'Cancelled' }]} />
        <FilterChips value={type} onChange={setType} options={[{ id: 'all', label: 'All types' }, { id: 'event', label: 'Events' }, { id: 'membership', label: 'Memberships' }, { id: 'listing', label: 'Marketplace' }]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {list.length === 0 ? <Empty>No orders.</Empty> : (
            <Table head={['Date', 'Member', 'Item', 'Type', 'Amount', 'Status', '']}>
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-bg-app/60">
                  <td className={`${td} whitespace-nowrap font-mono text-[12px]`}>{fmtDateTime(o.createdAt)}</td>
                  <td className={td}><p className="font-semibold text-ink">{o.userName ?? 'Deleted member'}</p><p className="text-[12px] text-ink-muted">{o.userEmail}</p></td>
                  <td className={`${td} text-[13px]`}>{o.description}<p className="font-mono text-[10px] text-ink-faint">{o.id} · {o.provider}</p></td>
                  <td className={`${td} text-[13px] capitalize`}>{o.type}</td>
                  <td className={`${td} whitespace-nowrap font-mono`}>{eur(o.amount)}</td>
                  <td className={td}><Chip tone={statusTone(o.status)}>{o.status}</Chip></td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <div className="flex justify-end gap-1">
                      {o.status === 'pending' && <>
                        <Btn size="sm" onClick={() => setConfirm({ order: o, action: 'mark-paid' })}>Mark paid</Btn>
                        <Btn size="sm" tone="subtle" onClick={() => setConfirm({ order: o, action: 'cancel' })}>Cancel</Btn>
                      </>}
                      {o.status === 'paid' && <Btn size="sm" tone="danger" onClick={() => setConfirm({ order: o, action: 'refund' })}>Refund</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone={confirm?.action === 'mark-paid' ? 'primary' : 'danger'}
        title={confirm?.action === 'mark-paid' ? 'Mark as paid?' : confirm?.action === 'refund' ? 'Refund this order?' : 'Cancel this order?'}
        description={confirm ? `${confirm.order.description} · ${eur(confirm.order.amount)}${confirm.action === 'refund' && confirm.order.provider === 'stripe' ? ' — the card payment will be refunded through Stripe.' : ''}${confirm.action === 'mark-paid' ? ' — applies the purchase (confirms the booking, extends membership or marks the item sold).' : ''}` : ''}
        confirmLabel={confirm?.action === 'mark-paid' ? 'Mark paid' : confirm?.action === 'refund' ? 'Refund' : 'Cancel order'}
        onConfirm={run}
      />
    </div>
  );
}
