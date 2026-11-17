import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellOff, Flag, Image as ImageIcon, Loader2, Lock, MessageCirclePlus, PenSquare, Search, Users } from 'lucide-react';
import { GroupAvatar, NewGroupSheet } from '@/components/chat/GroupSheets';
import { chatApi, refreshChatCounts } from '@/lib/chat';
import type { Conversation } from '@/lib/chat';
import { MEMBERS, MEMBER_PROFILE } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Tab = 'private' | 'groups' | 'requests';

export function shortTime(isoStr: string | null | undefined) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 6 * 86400) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function Avatar({ initials, size = 52, tone = 'blue' }: { initials: string; size?: number; tone?: 'blue' | 'navy' | 'muted' }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-bold',
        tone === 'blue' && 'bg-bmw-blue text-white',
        tone === 'navy' && 'bg-[#2A4FA8] text-white',
        tone === 'muted' && 'border border-border bg-surface-2 text-ink',
      )}
    >
      {initials}
    </span>
  );
}

function preview(c: Conversation) {
  const m = c.lastMessage;
  if (!m) return c.kind === 'direct' ? 'No messages yet' : 'Say hello to the group';
  if (m.system) return m.body;
  const who = m.mine ? 'You: ' : c.kind !== 'direct' ? `${m.senderName.split(' ')[0]}: ` : '';
  if (!m.body && m.attachmentType) {
    const label = { image: 'Sent a photo', car: 'Shared a car', event: 'Shared an event', listing: 'Shared a listing' }[m.attachmentType] ?? 'Shared something';
    return `${who}${label}`;
  }
  return `${who}${m.body}`;
}

function Row({ c }: { c: Conversation }) {
  const unread = c.unread > 0 || c.status === 'request';
  return (
    <Link
      to={`/messages/${c.id}`}
      className="flex min-h-[72px] items-center gap-3 rounded-2xl px-2 py-2 transition-colors active:bg-surface-2 sm:px-3 sm:hover:bg-surface-2"
    >
      {c.kind === 'group' ? (
        <GroupAvatar image={c.image} title={c.title} />
      ) : c.kind === 'crew' ? (
        c.image ? (
          <img src={c.image} alt="" className="h-[52px] w-[52px] shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-bmw-blue-light text-bmw-blue">
            <Users size={22} />
          </span>
        )
      ) : (
        <Avatar initials={c.peer?.initials ?? '··'} tone={c.unread ? 'blue' : 'navy'} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {c.kind === 'crew' && <Flag size={13} className="shrink-0 text-bmw-blue" />}
          {c.kind === 'group' && <Users size={13} className="shrink-0 text-bmw-blue" />}
          <p className={cn('truncate text-[15px] text-ink', unread ? 'font-bold' : 'font-semibold')}>{c.title}</p>
          {c.muted && <BellOff size={13} className="shrink-0 text-ink-faint" aria-label="Muted" />}
        </div>
        <p className={cn('mt-0.5 flex items-center gap-1 truncate text-[13px]', unread ? 'font-semibold text-ink' : 'text-ink-muted')}>
          {c.lastMessage?.attachmentType === 'image' && <ImageIcon size={13} className="shrink-0" />}
          <span className="truncate">{preview(c)}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 self-stretch py-1">
        <span className={cn('text-[11px]', c.unread ? 'font-semibold text-bmw-blue' : 'text-ink-faint')}>{shortTime(c.lastMessageAt)}</span>
        {c.unread > 0 && (
          <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold', c.muted ? 'bg-line text-ink-muted' : 'bg-hot text-hot-on')}>{c.unread}</span>
        )}
        {c.kind !== 'direct' && !c.unread && <span className="text-[11px] text-ink-faint">{c.memberCount} {c.kind === 'crew' ? 'drivers' : 'members'}</span>}
      </div>
    </Link>
  );
}

/** Member picker for starting a private chat. */
export function NewChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qText, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  useStore();
  const people = useMemo(() => {
    const t = qText.trim().toLowerCase();
    return MEMBERS.filter((m) => m.id !== MEMBER_PROFILE.id && (!t || `${m.name} ${m.location}`.toLowerCase().includes(t))).slice(0, 60);
  }, [qText]);
  const start = async (id: string) => {
    setBusy(id);
    try {
      const r = await chatApi.start(id);
      onClose();
      navigate(`/messages/${r.conversation.id}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col rounded-t-3xl border-border bg-surface px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 sm:mx-auto sm:max-w-lg">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="font-race text-2xl uppercase">New message</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-ink-muted">
            <Lock size={13} /> Private chats are only visible to the two of you.
          </SheetDescription>
        </SheetHeader>
        <label className="mt-3 flex h-12 items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-3.5">
          <Search size={18} className="text-ink-muted" />
          <span className="sr-only">Search members</span>
          <input
            autoFocus
            value={qText}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members by name or city"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {people.map((m) => (
            <button
              key={m.id}
              onClick={() => start(m.id)}
              disabled={!!busy}
              className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2 disabled:opacity-60"
            >
              <Avatar initials={m.avatarInitials} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                <span className="block truncate text-[13px] text-ink-muted">{m.location || m.membershipNumber}</span>
              </span>
              {busy === m.id && <Loader2 size={18} className="animate-spin text-ink-muted" />}
            </button>
          ))}
          {people.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">No members match “{qText}”.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Messages() {
  const [list, setList] = useState<Conversation[] | null>(null);
  const [tab, setTab] = useState<Tab>('private');
  const [qText, setQ] = useState('');
  const [composing, setComposing] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [chooser, setChooser] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    const load = () =>
      chatApi
        .list()
        .then((r) => alive && setList(r.conversations))
        .catch((e) => alive && toast((e as Error).message));
    load();
    refreshChatCounts();
    const t = window.setInterval(() => document.visibilityState === 'visible' && load(), 10000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [toast]);

  const requests = (list ?? []).filter((c) => c.status === 'request');
  const shown = useMemo(() => {
    const t = qText.trim().toLowerCase();
    return (list ?? [])
      .filter((c) => (tab === 'requests' ? c.status === 'request' : c.status !== 'request' && (tab === 'groups' ? c.kind !== 'direct' : c.kind === 'direct')))
      .filter((c) => !t || `${c.title} ${c.lastMessage?.body ?? ''}`.toLowerCase().includes(t));
  }, [list, tab, qText]);
  const crewUnread = (list ?? []).filter((c) => c.kind !== 'direct' && c.unread > 0 && !c.muted).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-border bg-surface px-3.5">
          <Search size={18} className="text-ink-muted" />
          <span className="sr-only">Search messages</span>
          <input
            value={qText}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search drivers and crews"
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        <button
          onClick={() => setChooser(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bmw-blue text-white active:scale-95"
          aria-label="New message or group"
        >
          <PenSquare size={20} />
        </button>
      </div>

      <div role="tablist" aria-label="Message type" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
        {(
          [
            { id: 'private', label: 'Private', icon: Lock },
            { id: 'groups', label: 'Groups', badge: crewUnread },
            { id: 'requests', label: 'Requests', badge: requests.length },
          ] as { id: Tab; label: string; icon?: typeof Lock; badge?: number }[]
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition-colors',
              tab === t.id ? 'bg-bmw-blue text-white' : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.icon && <t.icon size={14} />}
            {t.label}
            {!!t.badge && (
              <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold', tab === t.id ? 'bg-white text-bmw-blue' : 'bg-hot text-hot-on')}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <p className="mt-3 rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
          Messages from members you haven’t chatted with wait here. They can’t see whether you’ve read them until you reply or accept.
        </p>
      )}
      {tab === 'groups' && (
        <button
          onClick={() => setNewGroup(true)}
          className="mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-dashed border-bmw-blue/50 bg-bmw-blue-light/40 px-3 text-left"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bmw-blue text-white"><Users size={20} /></span>
          <span>
            <span className="block text-[15px] font-semibold text-ink">New group</span>
            <span className="block text-[12px] text-ink-muted">Your chapter, model owners, a road-trip crew… Event crews appear here too.</span>
          </span>
        </button>
      )}

      <div className="mt-2">
        {list === null && (
          <div className="flex justify-center py-16 text-ink-faint">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {list !== null && shown.length === 0 && (
          <div className="py-14 text-center">
            <p className="font-display text-lg font-bold text-ink">
              {tab === 'requests' ? 'No requests' : tab === 'groups' ? 'No groups yet' : 'No private chats yet'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">
              {tab === 'groups' ? 'Create one above, or RSVP to an event to join its crew chat.' : tab === 'private' ? 'Start one with any club member.' : 'You’re all clear.'}
            </p>
            {tab === 'private' && (
              <button onClick={() => setComposing(true)} className="mt-4 h-12 rounded-2xl bg-bmw-blue px-6 font-semibold text-white">
                New message
              </button>
            )}

          </div>
        )}
        {shown.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </div>

      <NewChatSheet open={composing} onClose={() => setComposing(false)} />
      <NewGroupSheet open={newGroup} onClose={() => setNewGroup(false)} />
      <Sheet open={chooser} onOpenChange={setChooser}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-surface px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 sm:mx-auto sm:max-w-lg [&>button]:hidden">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="font-race text-2xl uppercase">Start a chat</SheetTitle>
            <SheetDescription className="sr-only">Choose a private chat or a group</SheetDescription>
          </SheetHeader>
          <div className="mt-3 grid gap-2">
            {[
              { label: 'New message', hint: 'Private chat with one member', icon: MessageCirclePlus, act: () => setComposing(true) },
              { label: 'New group', hint: 'Chat with several members at once', icon: Users, act: () => setNewGroup(true) },
            ].map((o) => (
              <button key={o.label} onClick={() => { setChooser(false); o.act(); }} className="flex min-h-[60px] items-center gap-3.5 rounded-2xl border border-border bg-surface-2 px-4 text-left active:bg-bmw-blue-light">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bmw-blue text-white"><o.icon size={20} /></span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{o.label}</span>
                  <span className="block text-[13px] text-ink-muted">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
