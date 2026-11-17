import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, BellOff, Camera, Check, Crown, Loader2, LogOut, MoreVertical, Pencil, Search, Shield, Trash2, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import { chatApi } from '@/lib/chat';
import type { Conversation, GroupMember } from '@/lib/chat';
import { uploadImage } from '@/lib/api';
import { MEMBERS, MEMBER_PROFILE } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import PositionBadge from '@/components/PositionBadge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const sheetCls =
  'flex max-h-[92dvh] flex-col rounded-t-3xl border-border bg-surface px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 sm:mx-auto sm:max-w-lg [&>button]:hidden';

export function GroupAvatar({ image, title, size = 52, className }: { image?: string | null; title: string; size?: number; className?: string }) {
  if (image) return <img src={image} alt="" style={{ width: size, height: size }} className={cn('shrink-0 rounded-full object-cover', className)} />;
  const letters = title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '·';
  return (
    <span style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} className={cn('flex shrink-0 items-center justify-center rounded-full bg-[#2A4FA8] font-display font-bold text-white', className)}>
      {letters}
    </span>
  );
}

/** Multi-select list of club members. */
function MemberPicker({ selected, toggle, exclude = [] }: { selected: Set<string>; toggle: (id: string) => void; exclude?: string[] }) {
  const [qText, setQ] = useState('');
  useStore();
  const people = useMemo(() => {
    const t = qText.trim().toLowerCase();
    const ex = new Set([MEMBER_PROFILE.id, ...exclude]);
    return MEMBERS.filter((m) => !ex.has(m.id) && (!t || `${m.name} ${m.location} ${m.clubPosition ?? ''}`.toLowerCase().includes(t))).slice(0, 200);
  }, [qText, exclude]);
  return (
    <>
      <label className="flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-3.5">
        <Search size={18} className="text-ink-muted" />
        <span className="sr-only">Search members</span>
        <input value={qText} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint" />
      </label>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {people.map((m) => {
          const on = selected.has(m.id);
          return (
            <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={on} className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bmw-blue font-display text-[15px] font-bold text-white">{m.avatarInitials}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold text-ink">{m.name}</span>
                  <PositionBadge position={m.clubPosition} size="xs" />
                </span>
                <span className="block truncate text-[13px] text-ink-muted">{m.location || m.membershipNumber}</span>
              </span>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-bmw-blue bg-bmw-blue text-white' : 'border-line')}>
                {on && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
        {people.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">No members found.</p>}
      </div>
    </>
  );
}

function PhotoPicker({ value, onChange, title, disabled }: { value: string | null; onChange: (url: string | null) => void; title: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <div className="relative mx-auto w-fit">
      <GroupAvatar image={value} title={title || 'Group'} size={96} />
      {!disabled && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          aria-label="Choose group photo"
          className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-bmw-blue text-white"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onChange(await uploadImage(f));
          } catch (err) {
            toast((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'members' | 'details'>('members');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
    if (open) {
      setStep('members');
      setSelected(new Set());
      setTitle('');
      setDescription('');
      setImage(null);
    }
  }, [open]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const create = async () => {
    if (!title.trim()) return toast('Give the group a name.');
    setBusy(true);
    try {
      const r = await chatApi.createGroup({ title: title.trim(), description: description.trim(), image, memberIds: [...selected] });
      if (r.skipped.length) toast(`Not added (they don’t accept messages from you): ${r.skipped.join(', ')}`);
      onClose();
      navigate(`/messages/${r.conversation.id}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className={sheetCls}>
        <div className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <SheetHeader className="flex-row items-center gap-2 space-y-0 p-0 text-left">
          {step === 'details' && (
            <button onClick={() => setStep('members')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-race text-2xl uppercase">New group</SheetTitle>
            <SheetDescription className="text-ink-muted">
              {step === 'members' ? `Add members · ${selected.size} selected` : 'Name your group'}
            </SheetDescription>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted" aria-label="Close">
            <X size={20} />
          </button>
        </SheetHeader>

        {step === 'members' ? (
          <div className="mt-3 flex min-h-[50dvh] flex-1 flex-col">
            <MemberPicker selected={selected} toggle={toggle} />
            <button
              disabled={selected.size === 0}
              onClick={() => setStep('details')}
              className="mt-3 h-12 shrink-0 rounded-2xl bg-bmw-blue text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <PhotoPicker value={image} onChange={setImage} title={title} />
            <label className="block">
              <span className="text-[13px] font-semibold text-ink">Group name</span>
              <input autoFocus maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. M4 Owners, Munich Chapter" className="mt-1 h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[15px] text-ink outline-none focus:border-bmw-blue" />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-ink">Description (optional)</span>
              <textarea maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What’s this group about?" className="mt-1 w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] text-ink outline-none focus:border-bmw-blue" />
            </label>
            <p className="text-[13px] text-ink-muted">{selected.size} {selected.size === 1 ? 'member' : 'members'} plus you. You’ll be the group admin.</p>
            <button disabled={busy || !title.trim()} onClick={create} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-hot text-[15px] font-semibold text-hot-on disabled:opacity-40">
              {busy && <Loader2 size={17} className="animate-spin" />} Create group
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Group details: photo, name, description, members and admin tools (WhatsApp-style “Group info”). */
export function GroupInfoSheet({
  open, onClose, conv, onChanged, onLeft,
}: { open: boolean; onClose: () => void; conv: Conversation; onChanged: (c: Conversation) => void; onLeft: () => void }) {
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [pane, setPane] = useState<'info' | 'add'>('info');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);
  const [description, setDescription] = useState(conv.description ?? '');
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const isGroup = conv.kind === 'group';
  const admin = isGroup && conv.myRole === 'admin';

  const load = () => chatApi.members(conv.id).then((r) => setMembers(r.members)).catch((e) => toast((e as Error).message));
  useEffect(() => {
    if (!open) return;
    setPane('info');
    setEditing(false);
    setTitle(conv.title);
    setDescription(conv.description ?? '');
    setMembers(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conv.id]);

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    try {
      await fn();
      after?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = (patch: { title?: string; description?: string; image?: string | null }) =>
    run('save', async () => {
      const r = await chatApi.updateGroup(conv.id, patch);
      onChanged(r.conversation);
      setEditing(false);
    });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className={sheetCls}>
        <div className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
        <SheetHeader className="flex-row items-center gap-2 space-y-0 p-0 text-left">
          {pane === 'add' && (
            <button onClick={() => setPane('info')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-race text-2xl uppercase">{pane === 'add' ? 'Add members' : isGroup ? 'Group info' : 'Crew info'}</SheetTitle>
            <SheetDescription className="sr-only">Group details and members</SheetDescription>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted" aria-label="Close">
            <X size={20} />
          </button>
        </SheetHeader>

        {pane === 'add' ? (
          <div className="mt-3 flex min-h-[50dvh] flex-1 flex-col">
            <MemberPicker
              selected={adding}
              exclude={(members ?? []).map((m) => m.id)}
              toggle={(id) => setAdding((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            />
            <button
              disabled={adding.size === 0 || busy === 'add'}
              onClick={() =>
                run('add', async () => {
                  const r = await chatApi.addMembers(conv.id, [...adding]);
                  if (r.skipped.length) toast(`Not added (they don’t accept messages from you): ${r.skipped.join(', ')}`);
                  setAdding(new Set());
                  setPane('info');
                  load();
                })
              }
              className="mt-3 flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-bmw-blue text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {busy === 'add' && <Loader2 size={17} className="animate-spin" />} Add {adding.size || ''} {adding.size === 1 ? 'member' : 'members'}
            </button>
          </div>
        ) : (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {/* Photo, name, description */}
            <div className="flex flex-col items-center text-center">
              {isGroup ? (
                <PhotoPicker value={conv.image ?? null} onChange={(url) => saveDetails({ image: url })} title={conv.title} disabled={!admin} />
              ) : conv.image ? (
                <img src={conv.image} alt="" className="h-24 w-24 rounded-3xl object-cover" />
              ) : (
                <GroupAvatar title={conv.title} size={96} />
              )}
              {editing ? (
                <div className="mt-4 w-full space-y-3 text-left">
                  <input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Group name" className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[15px] text-ink outline-none focus:border-bmw-blue" />
                  <textarea maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Group description" placeholder="Add a description" className="w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] text-ink outline-none focus:border-bmw-blue" />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setEditing(false)} className="h-11 rounded-2xl border border-border font-semibold text-ink">Cancel</button>
                    <button disabled={!title.trim() || busy === 'save'} onClick={() => saveDetails({ title: title.trim(), description: description.trim() })} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-bmw-blue font-semibold text-white disabled:opacity-40">
                      {busy === 'save' && <Loader2 size={16} className="animate-spin" />} Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-3 flex items-center gap-1.5 font-display text-2xl font-bold text-ink">
                    {conv.title}
                    {admin && (
                      <button onClick={() => setEditing(true)} aria-label="Edit group name and description" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted">
                        <Pencil size={16} />
                      </button>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-muted">{isGroup ? 'Group' : 'Event crew'} · {members?.length ?? conv.memberCount} members</p>
                  {conv.description && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{conv.description}</p>}
                </>
              )}
            </div>

            {/* Mute */}
            <button
              onClick={() => run('mute', async () => { const r = await chatApi.mute(conv.id, !conv.muted); onChanged({ ...conv, muted: r.muted }); })}
              className="mt-5 flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 text-left"
            >
              {conv.muted ? <BellOff size={19} className="text-ink-muted" /> : <Bell size={19} className="text-bmw-blue" />}
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-ink">{conv.muted ? 'Muted' : 'Notifications on'}</span>
                <span className="block text-[12px] text-ink-muted">{conv.muted ? 'New messages won’t count in your badge.' : 'Tap to mute this chat.'}</span>
              </span>
              {busy === 'mute' && <Loader2 size={16} className="animate-spin text-ink-muted" />}
            </button>

            {/* Members */}
            <div className="mt-5 flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-muted">{members?.length ?? '…'} members</p>
            </div>
            {admin && (
              <button onClick={() => setPane('add')} className="mt-2 flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bmw-blue text-white"><UserPlus size={19} /></span>
                <span className="text-[15px] font-semibold text-bmw-blue">Add members</span>
              </button>
            )}
            {members === null && <div className="flex justify-center py-6 text-ink-faint"><Loader2 className="animate-spin" /></div>}
            {members?.map((m) => (
              <div key={m.id} className="flex min-h-[60px] items-center gap-3 px-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bmw-blue font-display text-[15px] font-bold text-white">{m.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold text-ink">{m.isMe ? 'You' : m.name}</span>
                    <PositionBadge position={m.clubPosition} size="xs" />
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">{m.location}</span>
                </span>
                {m.role === 'admin' && isGroup && (
                  <span className="flex items-center gap-1 rounded-full bg-gold-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gold-dark">
                    <Crown size={11} /> Admin
                  </span>
                )}
                {admin && !m.isMe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted" aria-label={`Options for ${m.name}`}>
                        {busy === m.id ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={18} />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                      {m.role === 'admin' ? (
                        <DropdownMenuItem onClick={() => run(m.id, () => chatApi.setRole(conv.id, m.id, 'member'), load)} className="min-h-[44px] gap-2.5 rounded-xl">
                          <Shield size={16} /> Dismiss as admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => run(m.id, () => chatApi.setRole(conv.id, m.id, 'admin'), load)} className="min-h-[44px] gap-2.5 rounded-xl">
                          <Crown size={16} /> Make group admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => window.confirm(`Remove ${m.name} from the group?`) && run(m.id, () => chatApi.removeMember(conv.id, m.id), load)}
                        className="min-h-[44px] gap-2.5 rounded-xl text-danger focus:text-danger"
                      >
                        <UserMinus size={16} /> Remove from group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            {/* Leave / delete */}
            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <button
                onClick={() => window.confirm(isGroup ? 'Leave this group?' : 'Leave this crew chat?') && run('leave', () => chatApi.leave(conv.id), onLeft)}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 text-left text-[15px] font-semibold text-danger"
              >
                <LogOut size={19} /> {isGroup ? 'Leave group' : 'Leave crew chat'}
              </button>
              {admin && (
                <button
                  onClick={() => window.confirm('Delete this group for everyone? Messages will be removed.') && run('delete', () => chatApi.deleteGroup(conv.id), onLeft)}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 text-left text-[15px] font-semibold text-danger"
                >
                  <Trash2 size={19} /> Delete group
                </button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { Users as GroupIcon };
