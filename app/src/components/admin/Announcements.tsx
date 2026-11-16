import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { MEMBER_PROFILE, TIERS } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/Confirm';
import { Chip, Empty, ErrorBox, Field, Loading, PageHeader, Panel, Toggle, Btn, fmtDateTime, inputCls, useAdminData } from './ui';

interface Ann { id: string; title: string; body: string; audience: { type: string; value?: string }; channels: { inApp: boolean; email: boolean; feed: boolean }; recipients: number; createdAt: string; sentBy: string }
interface Meta { roles: { id: string; label: string }[]; countries: string[] }

export default function Announcements() {
  const { toast } = useToast();
  const lead = MEMBER_PROFILE.role === 'chapter_lead';
  const { data, error, loading, reload } = useAdminData<{ announcements: Ann[] }>('/admin/announcements');
  const meta = useAdminData<Meta>('/admin/meta').data;
  const [f, setF] = useState({ title: '', body: '', type: lead ? 'chapter' : 'all', value: lead ? MEMBER_PROFILE.chapterCountry ?? '' : '', inApp: true, email: false, feed: false });
  const [confirm, setConfirm] = useState(false);

  const audienceLabel = (a: Ann['audience']) =>
    a.type === 'all' ? 'All active members' : a.type === 'tier' ? `Tier: ${TIERS.find((t) => t.id === a.value)?.name ?? a.value}` : a.type === 'role' ? `Role: ${meta?.roles.find((r) => r.id === a.value)?.label ?? a.value}` : `Chapter: ${a.value}`;

  const send = async () => {
    try {
      const r = await api.post<{ recipients: number; emailed: number }>('/admin/announcements', {
        title: f.title, body: f.body, audience: { type: f.type, value: f.value || undefined }, channels: { inApp: f.inApp, email: f.email, feed: f.feed },
      });
      toast(`Sent to ${r.recipients} member${r.recipients === 1 ? '' : 's'}${f.email ? ` · ${r.emailed} emailed` : ''}.`, { title: 'Announcement sent', variant: 'success' });
      setF({ ...f, title: '', body: '' });
      reload();
      if (f.feed || f.inApp) refresh().catch(() => {});
    } catch (e) {
      toast((e as Error).message);
      throw e;
    }
  };

  return (
    <div>
      <PageHeader title="Announcements" description="Broadcast news to members in-app, by email or as a pinned feed post." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel title={<span className="flex items-center gap-2"><Megaphone size={15} /> New announcement</span>} className="xl:col-span-2">
          <form onSubmit={(e) => { e.preventDefault(); setConfirm(true); }} className="space-y-3">
            <Field label="Title"><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></Field>
            <Field label="Message"><textarea required rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={cn(inputCls, 'h-auto py-2')} /></Field>
            {!lead && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Audience">
                  <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, value: '' })} className={inputCls}>
                    <option value="all">All members</option>
                    <option value="tier">A membership tier</option>
                    <option value="chapter">A chapter (country)</option>
                    <option value="role">A staff role</option>
                  </select>
                </Field>
                {f.type !== 'all' && (
                  <Field label={f.type === 'tier' ? 'Tier' : f.type === 'role' ? 'Role' : 'Country'}>
                    {f.type === 'tier' ? (
                      <select required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={inputCls}><option value="">Choose…</option>{TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                    ) : f.type === 'role' ? (
                      <select required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={inputCls}><option value="">Choose…</option>{meta?.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
                    ) : (
                      <><input required list="ann-countries" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={inputCls} /><datalist id="ann-countries">{meta?.countries.map((c) => <option key={c} value={c} />)}</datalist></>
                    )}
                  </Field>
                )}
              </div>
            )}
            {lead && <p className="text-[12px] text-ink-muted">Goes to members of the {MEMBER_PROFILE.chapterCountry} chapter.</p>}
            <div className="divide-y divide-border">
              <Toggle checked={f.inApp} onChange={(v) => setF({ ...f, inApp: v })} label="In-app notification" />
              <Toggle checked={f.email} onChange={(v) => setF({ ...f, email: v })} label="Email" hint="Respects each member's email preference. Requires SMTP." />
              {!lead && <Toggle checked={f.feed} onChange={(v) => setF({ ...f, feed: v })} label="Pinned feed post" hint="Shows at the top of the club feed for everyone." />}
            </div>
            <Btn type="submit" disabled={!f.title || !f.body || (!f.inApp && !f.email && !f.feed)}><Send size={15} /> Review & send</Btn>
          </form>
        </Panel>
        <Panel title="Sent" pad={false} className="xl:col-span-3">
          {error && <ErrorBox message={error} onRetry={reload} />}
          {loading && !data ? <Loading /> : !data?.announcements.length ? <Empty>No announcements yet.</Empty> : (
            <ul className="divide-y divide-border">
              {data.announcements.map((a) => (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{a.title}</p>
                    <span className="ml-auto font-mono text-[11px] text-ink-faint">{fmtDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-[13px] text-ink-muted">{a.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tone="info">{audienceLabel(a.audience)}</Chip>
                    <Chip>{a.recipients} recipients</Chip>
                    {a.channels.inApp && <Chip>In-app</Chip>}
                    {a.channels.email && <Chip>Email</Chip>}
                    {a.channels.feed && <Chip tone="warning">Feed</Chip>}
                    <span className="text-[11px] text-ink-faint">by {a.sentBy}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} tone="primary" title={`Send “${f.title}”?`} confirmLabel="Send now"
        description={`To: ${lead ? `${MEMBER_PROFILE.chapterCountry} chapter` : f.type === 'all' ? 'all active members' : `${f.type} ${f.value}`} · via ${[f.inApp && 'in-app', f.email && 'email', f.feed && 'feed'].filter(Boolean).join(', ')}. This cannot be unsent.`}
        onConfirm={send} />
    </div>
  );
}
