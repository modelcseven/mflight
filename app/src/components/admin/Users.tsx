import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, Download, KeyRound, LogOut, ShieldOff, Trash2, UserPlus } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { MEMBER_PROFILE, SETTINGS } from '@/lib/data';
import type { Role } from '@/lib/data';
import { useToast } from '@/lib/toast';
import ConfirmDialog from '@/components/Confirm';
import {
  Btn, Chip, Empty, ErrorBox, Field, FilterChips, Loading, Modal, PageHeader, Panel, SearchBox, SidePanel, Table, Toggle,
  fmtDate, fmtDateTime, inputCls, statusTone, td, useAdminData,
} from './ui';

export interface AdminUser {
  id: string; name: string; firstName: string; lastName: string; email: string; phone: string; membershipNumber: string;
  location: string; joinDate: string; avatarInitials: string; verified: boolean; status: 'Active' | 'Pending' | 'Suspended';
  role: Role; roleLabel: string; tierId: string | null; chapterCountry: string | null; membershipExpires: string | null;
  emailVerified: boolean; totpEnabled: boolean; hasPassword: boolean; lastLoginAt: string | null; createdAt: string;
  clubPosition?: string | null;
  stats: { cars: number; posts: number; events: number };
}
interface Meta {
  roles: { id: Role; label: string; areas: string[] }[];
  me: { role: Role; chapterCountry: string | null };
  tiers: { id: string; name: string }[];
  countries: string[];
}

const RANK: Record<Role, number> = { super_admin: 4, admin: 3, chapter_lead: 2, moderator: 2, member: 1 };

function useMeta() {
  return useAdminData<Meta>('/admin/meta').data;
}

function InviteDialog({ open, onClose, meta, onCreated }: { open: boolean; onClose: () => void; meta: Meta | null; onCreated: (u: AdminUser) => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', role: 'member' as Role, tierId: '', chapterCountry: '', location: '', verified: true });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const myRank = RANK[MEMBER_PROFILE.role];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ user: AdminUser; inviteLink: string | null; emailed: boolean }>('/admin/users', f);
      onCreated(r.user);
      if (r.inviteLink) setLink(r.inviteLink);
      else {
        toast(r.emailed ? `Invitation emailed to ${r.user.email}.` : 'Member created.', { variant: 'success' });
        onClose();
      }
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { setLink(null); onClose(); }} title="Add a member" description="They get an email to set their password.">
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">Member created. Email is not configured yet, so send them this one-time link to set their password (valid 2 days):</p>
          <input readOnly value={link} className={inputCls} onFocus={(e) => e.target.select()} />
          <div className="flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link copied.'))}>Copy link</Btn>
            <Btn onClick={() => { setLink(null); onClose(); }}>Done</Btn>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Field label="First name"><input required value={f.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} /></Field>
          <Field label="Last name"><input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} /></Field>
          <Field label="Email" className="col-span-2"><input required type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></Field>
          <Field label="Role">
            <select value={f.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
              {meta?.roles.filter((r) => MEMBER_PROFILE.role === 'super_admin' || RANK[r.id] < myRank).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Tier">
            <select value={f.tierId} onChange={(e) => set('tierId', e.target.value)} className={inputCls}>
              <option value="">Default</option>
              {meta?.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          {MEMBER_PROFILE.role !== 'chapter_lead' && (
            <Field label="Chapter (country)">
              <input list="countries" value={f.chapterCountry} onChange={(e) => set('chapterCountry', e.target.value)} className={inputCls} />
            </Field>
          )}
          <Field label="Location"><input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" className={inputCls} /></Field>
          <div className="col-span-2"><Toggle checked={f.verified} onChange={(v) => set('verified', v)} label="Verified member" hint="Shows the blue check next to their name." /></div>
          <datalist id="countries">{meta?.countries.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Btn tone="subtle" onClick={onClose}>Cancel</Btn>
            <Btn type="submit" busy={busy}><UserPlus size={15} /> Create member</Btn>
          </div>
        </form>
      )}
    </Modal>
  );
}

function UserPanel({ user, meta, onClose, onChange, onDelete }: { user: AdminUser; meta: Meta | null; onClose: () => void; onChange: (u: AdminUser) => void; onDelete: (id: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'delete' | 'signout'>(null);
  const [link, setLink] = useState<string | null>(null);
  const isSelf = user.id === MEMBER_PROFILE.id;
  const myRank = RANK[MEMBER_PROFILE.role];
  const canManage = isSelf || MEMBER_PROFILE.role === 'super_admin' || RANK[user.role] < myRank;
  const [draft, setDraft] = useState({
    firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, location: user.location,
    tierId: user.tierId ?? '', chapterCountry: user.chapterCountry ?? '', membershipExpires: user.membershipExpires ?? '',
  });

  const patch = async (body: Record<string, unknown>, key = 'save', msg = 'Saved.') => {
    setBusy(key);
    try {
      const r = await api.patch<{ user: AdminUser }>(`/admin/users/${user.id}`, body);
      onChange(r.user);
      toast(msg, { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy('reset');
    try {
      const r = await api.post<{ emailed: boolean; link: string | null }>(`/admin/users/${user.id}/reset-password`);
      if (r.link) setLink(r.link);
      else toast(`Password reset email sent to ${user.email}.`, { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SidePanel open onClose={onClose} title={user.name} description={`${user.membershipNumber}${user.clubPosition ? ` · ${user.clubPosition}` : ""} · member since ${fmtDate(user.joinDate)}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Chip tone={statusTone(user.status)}>{user.status}</Chip>
          <Chip tone="info">{user.roleLabel}</Chip>
          {user.clubPosition && <Chip tone="warning">{user.clubPosition}</Chip>}
          {user.verified && <Chip tone="info">Verified</Chip>}
          {user.totpEnabled && <Chip tone="success">2FA on</Chip>}
          {!user.emailVerified && <Chip tone="warning">Email unconfirmed</Chip>}
        </div>
        <p className="text-[12px] text-ink-muted">
          {user.stats.cars} cars · {user.stats.posts} posts · {user.stats.events} events · last sign-in {fmtDateTime(user.lastLoginAt)}
        </p>

        {!canManage && <p className="rounded-xl bg-gold-light px-3.5 py-2.5 text-[13px] text-gold-dark">This member is at your level or above. Only a super admin can change them.</p>}

        <div className="space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">Status</p>
          <div className="flex flex-wrap gap-2">
            {user.status === 'Pending' && <Btn size="sm" disabled={!canManage} busy={busy === 'approve'} onClick={() => patch({ status: 'Active' }, 'approve', 'Membership approved.')}>Approve</Btn>}
            {user.status !== 'Suspended' && !isSelf && <Btn size="sm" tone="danger" disabled={!canManage} busy={busy === 'suspend'} onClick={() => patch({ status: 'Suspended' }, 'suspend', 'Member suspended and signed out.')}>Suspend</Btn>}
            {user.status === 'Suspended' && <Btn size="sm" tone="ghost" disabled={!canManage} busy={busy === 'reinstate'} onClick={() => patch({ status: 'Active' }, 'reinstate', 'Member reinstated.')}>Reinstate</Btn>}
            <Btn size="sm" tone="ghost" disabled={!canManage} busy={busy === 'verify'} onClick={() => patch({ verified: !user.verified }, 'verify', user.verified ? 'Verification removed.' : 'Member verified.')}>
              <BadgeCheck size={13} /> {user.verified ? 'Remove verification' : 'Verify'}
            </Btn>
          </div>
        </div>

        {!isSelf && (
          <Field label="Role" hint={meta?.roles.find((r) => r.id === user.role)?.areas.length ? `Admin areas: ${meta?.roles.find((r) => r.id === user.role)?.areas.join(', ')}` : 'No admin access'}>
            <select
              value={user.role}
              disabled={!canManage || busy === 'role'}
              onChange={(e) => patch({ role: e.target.value }, 'role', 'Role updated. They will need to sign in again.')}
              className={inputCls}
            >
              {meta?.roles.map((r) => (
                <option key={r.id} value={r.id} disabled={MEMBER_PROFILE.role !== 'super_admin' && RANK[r.id] >= myRank}>{r.label}</option>
              ))}
            </select>
          </Field>
        )}

        {MEMBER_PROFILE.role === 'super_admin' ? (
          <ClubStanding user={user} busy={busy} onSave={(body, msg) => patch(body, 'standing', msg)} />
        ) : (
          <p className="text-[12px] text-ink-muted">
            Club position: <b className="text-ink">{user.clubPosition || 'None'}</b> · Joined the club: <b className="text-ink">{fmtDate(user.joinDate)}</b> · Only super admins can change these.
          </p>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); patch({ ...draft, tierId: draft.tierId || null, chapterCountry: draft.chapterCountry || null, membershipExpires: draft.membershipExpires || null }); }}
          className="grid grid-cols-2 gap-3"
        >
          <Field label="First name"><input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          <Field label="Last name"><input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          <Field label="Email" className="col-span-2"><input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          <Field label="Phone"><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          <Field label="Location"><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          <Field label="Tier">
            <select value={draft.tierId} onChange={(e) => setDraft({ ...draft, tierId: e.target.value })} className={inputCls} disabled={!canManage}>
              <option value="">None</option>
              {meta?.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Membership expires"><input type="date" value={draft.membershipExpires} onChange={(e) => setDraft({ ...draft, membershipExpires: e.target.value })} className={inputCls} disabled={!canManage} /></Field>
          {MEMBER_PROFILE.role !== 'chapter_lead' && (
            <Field label="Chapter (country)" className="col-span-2">
              <input list="admin-countries" value={draft.chapterCountry} onChange={(e) => setDraft({ ...draft, chapterCountry: e.target.value })} className={inputCls} disabled={!canManage} />
              <datalist id="admin-countries">{meta?.countries.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
          )}
          <div className="col-span-2"><Btn type="submit" busy={busy === 'save'} disabled={!canManage}>Save details</Btn></div>
        </form>

        {!isSelf && canManage && (
          <div className="space-y-2 border-t border-border pt-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">Access</p>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" tone="ghost" busy={busy === 'reset'} onClick={reset}><KeyRound size={13} /> Send password reset</Btn>
              <Btn size="sm" tone="ghost" onClick={() => setConfirm('signout')}><LogOut size={13} /> Sign out everywhere</Btn>
              {user.totpEnabled && <Btn size="sm" tone="ghost" busy={busy === '2fa'} onClick={() => patch({ disable2fa: true }, '2fa', 'Two-step verification turned off.')}><ShieldOff size={13} /> Turn off 2FA</Btn>}
              {MEMBER_PROFILE.role !== 'chapter_lead' && <Btn size="sm" tone="danger" onClick={() => setConfirm('delete')}><Trash2 size={13} /> Delete member</Btn>}
            </div>
            {link && (
              <div className="space-y-2 rounded-xl bg-bg-app p-3">
                <p className="text-[12px] text-ink-muted">Email is not configured. Send this one-time reset link to the member:</p>
                <input readOnly value={link} className={inputCls} onFocus={(e) => e.target.select()} />
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} title={`Delete ${user.name}?`}
        description="Removes the member and all their cars, posts, comments, RSVPs and listings. Orders are kept for accounting." confirmLabel="Delete member"
        onConfirm={async () => { await api.del(`/admin/users/${user.id}`); onDelete(user.id); toast('Member deleted.'); }} />
      <ConfirmDialog open={confirm === 'signout'} onOpenChange={(o) => !o && setConfirm(null)} tone="primary" title="Sign out everywhere?"
        description="Ends all of this member's sessions on every device." confirmLabel="Sign out"
        onConfirm={async () => { await api.post(`/admin/users/${user.id}/signout`); toast('Member signed out everywhere.'); }} />
    </SidePanel>
  );
}

export default function UsersAdmin() {
  const [params, setParams] = useSearchParams();
  const meta = useMeta();
  const { data, setData, error, loading, reload } = useAdminData<{ users: AdminUser[] }>('/admin/users');
  const [q, setQ] = useState('');
  const status = (params.get('status') ?? 'all') as 'all' | 'Active' | 'Pending' | 'Suspended' | 'staff';
  const [selected, setSelected] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  useEffect(() => setSelected(null), [status]);
  const users = useMemo(() => data?.users ?? [], [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (status === 'staff' ? u.role === 'member' : status !== 'all' && u.status !== status) return false;
      if (!s) return true;
      return [u.name, u.email, u.membershipNumber, u.location, u.chapterCountry ?? ''].some((x) => x.toLowerCase().includes(s));
    });
  }, [users, q, status]);

  const update = (u: AdminUser) => setData((d) => d && { users: d.users.map((x) => (x.id === u.id ? u : x)) });
  const sel = users.find((u) => u.id === selected);
  const count = (s: string) => users.filter((u) => u.status === s).length;

  return (
    <div>
      <PageHeader
        title="Members"
        description={MEMBER_PROFILE.role === 'chapter_lead' ? `Members in the ${MEMBER_PROFILE.chapterCountry ?? ''} chapter.` : 'Approve, manage and support club members.'}
        actions={
          <>
            <Btn tone="ghost" onClick={() => downloadFile('/admin/users.csv', 'members.csv').catch((e) => toast((e as Error).message))}><Download size={15} /> Export CSV</Btn>
            <Btn onClick={() => setInviting(true)}><UserPlus size={15} /> Add member</Btn>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, email, number, location…" />
        <FilterChips
          value={status}
          onChange={(v) => setParams(v === 'all' ? {} : { status: v }, { replace: true })}
          options={[
            { id: 'all', label: 'All', count: users.length },
            { id: 'Pending', label: 'Pending', count: count('Pending') },
            { id: 'Active', label: 'Active', count: count('Active') },
            { id: 'Suspended', label: 'Suspended', count: count('Suspended') },
            { id: 'staff', label: 'Staff', count: users.filter((u) => u.role !== 'member').length },
          ]}
        />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : (
        <Panel pad={false}>
          {filtered.length === 0 ? (
            <Empty>No members match.</Empty>
          ) : (
            <Table head={['Member', 'Number', 'Role', 'Tier', 'Chapter', 'Expires', 'Status', '']}>
              {filtered.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u.id)} className="cursor-pointer hover:bg-bg-app/60">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bmw-blue text-[11px] font-bold text-white">{u.avatarInitials}</span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-semibold text-ink">{u.name}{u.verified && <BadgeCheck size={13} className="text-bmw-blue" />}</p>
                        <p className="truncate text-[12px] text-ink-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} font-mono text-[12px]`}>{u.membershipNumber}</td>
                  <td className={td}>{u.role === 'member' ? <span className="text-ink-muted">Member</span> : <Chip tone="info">{u.roleLabel}</Chip>}</td>
                  <td className={`${td} text-[13px]`}>{meta?.tiers.find((t) => t.id === u.tierId)?.name ?? '—'}</td>
                  <td className={`${td} text-[13px]`}>{u.chapterCountry ?? '—'}</td>
                  <td className={`${td} whitespace-nowrap font-mono text-[12px] ${u.membershipExpires && new Date(u.membershipExpires) < new Date() ? 'text-danger' : ''}`}>{fmtDate(u.membershipExpires)}</td>
                  <td className={td}><Chip tone={statusTone(u.status)}>{u.status}</Chip></td>
                  <td className={`${td} text-right`}>
                    {u.status === 'Pending' && (
                      <Btn size="sm" onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const r = await api.patch<{ user: AdminUser }>(`/admin/users/${u.id}`, { status: 'Active' });
                          update(r.user);
                          toast(`${u.name} approved.`, { variant: 'success' });
                        } catch (err) { toast((err as Error).message); }
                      }}>Approve</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
      {sel && (
        <UserPanel key={sel.id} user={sel} meta={meta} onClose={() => setSelected(null)} onChange={update}
          onDelete={(id) => { setData((d) => d && { users: d.users.filter((x) => x.id !== id) }); setSelected(null); }} />
      )}
      <InviteDialog open={inviting} onClose={() => setInviting(false)} meta={meta} onCreated={(u) => setData((d) => d && { users: [u, ...d.users] })} />
    </div>
  );
}


/** Super admins only: the member's club office (President, VP…) and the date they actually joined the club. */
function ClubStanding({ user, busy, onSave }: { user: AdminUser; busy: string | null; onSave: (body: Record<string, unknown>, msg: string) => void }) {
  const positions = SETTINGS.positions?.list ?? [];
  const [pos, setPos] = useState(user.clubPosition ?? '');
  const [joined, setJoined] = useState(user.joinDate);
  useEffect(() => {
    setPos(user.clubPosition ?? '');
    setJoined(user.joinDate);
  }, [user.clubPosition, user.joinDate]);
  const dirty = pos !== (user.clubPosition ?? '') || joined !== user.joinDate;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3 rounded-2xl border border-gold/40 bg-gold-light/40 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-gold-dark">Club standing · super admin</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Club position" hint={positions.length ? undefined : 'Add positions in Settings → Club positions.'}>
          <select value={pos} onChange={(e) => setPos(e.target.value)} className={inputCls}>
            <option value="">No position</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
            {pos && !positions.includes(pos) && <option value={pos}>{pos} (removed from list)</option>}
          </select>
        </Field>
        <Field label="Joined the club" hint={`Account created ${fmtDate(user.createdAt)}`}>
          <input type="date" max={today} value={joined} onChange={(e) => setJoined(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Btn size="sm" disabled={!dirty || !joined} busy={busy === 'standing'} onClick={() => onSave({ clubPosition: pos, joinDate: joined }, 'Club standing saved.')}>
        Save club standing
      </Btn>
    </div>
  );
}
