import { useMemo, useState } from 'react';
import { Empty, ErrorBox, FilterChips, Loading, PageHeader, Panel, SearchBox, Table, fmtDateTime, td, useAdminData } from './ui';

interface Entry { id: string; action: string; targetType: string | null; targetId: string | null; details: Record<string, unknown>; ip: string | null; createdAt: string; actorName: string }

const GROUPS = [
  { id: '', label: 'All' }, { id: 'user', label: 'Members' }, { id: 'event', label: 'Events' }, { id: 'rsvp', label: 'RSVPs' },
  { id: 'order', label: 'Payments' }, { id: 'settings', label: 'Settings' }, { id: 'announcement', label: 'Announcements' },
  { id: 'report', label: 'Moderation' }, { id: 'account', label: 'Account security' },
];

export default function Audit() {
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useAdminData<{ entries: Entry[] }>(`/admin/audit?limit=500${group ? `&action=${group}` : ''}`);
  const list = useMemo(() => (data?.entries ?? []).filter((e) => !q || `${e.action} ${e.actorName} ${e.targetId ?? ''} ${JSON.stringify(e.details)}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <div>
      <PageHeader title="Audit log" description="Every sign-in, admin change and payment action, newest first." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search actor, action, target…" />
        <FilterChips value={group} onChange={setGroup} options={GROUPS} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {list.length === 0 ? <Empty>No entries.</Empty> : (
            <Table head={['When', 'Who', 'Action', 'Target', 'Details', 'IP']}>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap font-mono text-[12px]`}>{fmtDateTime(e.createdAt)}</td>
                  <td className={`${td} text-[13px] font-semibold`}>{e.actorName}</td>
                  <td className={`${td} font-mono text-[12px]`}>{e.action}</td>
                  <td className={`${td} font-mono text-[11px] text-ink-muted`}>{e.targetType ? `${e.targetType}:${e.targetId}` : '—'}</td>
                  <td className={`${td} max-w-[320px] truncate font-mono text-[11px] text-ink-muted`} title={JSON.stringify(e.details)}>
                    {Object.keys(e.details || {}).length ? JSON.stringify(e.details) : '—'}
                  </td>
                  <td className={`${td} font-mono text-[11px] text-ink-faint`}>{e.ip ?? '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
    </div>
  );
}
