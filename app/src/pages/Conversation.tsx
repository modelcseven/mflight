import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Ban, CalendarDays, CarFront, Check, Flag, ImagePlus, Loader2, Lock, LogOut, MoreVertical, Plus, SendHorizonal, ShoppingBag, Trash2, Users, X,
} from 'lucide-react';
import { chatApi, refreshChatCounts } from '@/lib/chat';
import type { ChatAttachment, ChatMessage, Conversation as Conv } from '@/lib/chat';
import { CARS, CLUB_EVENTS, MARKETPLACE_LISTINGS, MEMBER_PROFILE, parseDate } from '@/lib/data';
import { uploadImage } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import ReportDialog from '@/components/ReportDialog';
import { ThemeToggle } from '@/components/shell/ShellBits';
import { Avatar } from '@/pages/Messages';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const dayLabel = (d: Date) => {
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
};

function attachmentLink(a: ChatAttachment) {
  if (a.type === 'car' && a.id) return `/garage/${a.id}`;
  if (a.type === 'event' && a.id) return `/events?event=${a.id}`;
  if (a.type === 'listing' && a.id) return `/parts?listing=${a.id}`;
  return null;
}

function AttachmentCard({ a, mine }: { a: ChatAttachment; mine: boolean }) {
  if (a.type === 'image' && a.url) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl">
        <img src={a.url} alt="Shared photo" className="max-h-72 w-full max-w-[260px] object-cover" loading="lazy" />
      </a>
    );
  }
  const to = attachmentLink(a);
  const label = { car: 'From the garage', event: 'Event', listing: 'MFlight listing', image: '' }[a.type];
  const Icon = a.type === 'car' ? CarFront : a.type === 'event' ? CalendarDays : ShoppingBag;
  const body = (
    <div className={cn('w-[240px] overflow-hidden rounded-2xl border', mine ? 'border-white/20 bg-white/10' : 'border-border bg-surface')}>
      {a.image && <img src={a.image} alt="" className="h-28 w-full object-cover" loading="lazy" />}
      <div className="px-3 py-2.5">
        <p className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em]', mine ? 'text-white/80' : 'text-bmw-blue')}>
          <Icon size={12} /> {label}
        </p>
        <p className="mt-0.5 font-display text-[17px] font-bold leading-tight">{a.title}</p>
        {a.subtitle && <p className={cn('text-[12px]', mine ? 'text-white/80' : 'text-ink-muted')}>{a.subtitle}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function ShareSheet({ open, onClose, onPick, onPhoto }: { open: boolean; onClose: () => void; onPick: (a: ChatAttachment) => void; onPhoto: () => void }) {
  const [pane, setPane] = useState<'menu' | 'car' | 'event' | 'listing'>('menu');
  useStore();
  useEffect(() => {
    if (open) setPane('menu');
  }, [open]);
  const today = new Date().toISOString().slice(0, 10);
  const myCars = CARS.filter((c) => c.ownerId === MEMBER_PROFILE.id);
  const events = CLUB_EVENTS.filter((e) => !e.cancelled && e.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const listings = MARKETPLACE_LISTINGS.filter((l) => l.status === 'Active').slice(0, 30);
  const Item = ({ title, sub, img, onClick }: { title: string; sub?: string; img?: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
      {img ? <img src={img} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-xl bg-surface-2" />}
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {sub && <span className="block truncate text-[13px] text-ink-muted">{sub}</span>}
      </span>
    </button>
  );
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="flex max-h-[80dvh] flex-col rounded-t-3xl border-border bg-surface px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 sm:mx-auto sm:max-w-lg [&>button]:hidden">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="font-race text-2xl uppercase">{pane === 'menu' ? 'Share' : pane === 'car' ? 'Share a car' : pane === 'event' ? 'Share an event' : 'Share a listing'}</SheetTitle>
          <SheetDescription className="sr-only">Attach something to your message</SheetDescription>
        </SheetHeader>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {pane === 'menu' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Photo', icon: ImagePlus, act: () => { onClose(); onPhoto(); } },
                { label: 'My car', icon: CarFront, act: () => setPane('car') },
                { label: 'Event', icon: CalendarDays, act: () => setPane('event') },
                { label: 'Listing', icon: ShoppingBag, act: () => setPane('listing') },
              ].map((o) => (
                <button key={o.label} onClick={o.act} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 text-[14px] font-semibold text-ink active:bg-bmw-blue-light">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bmw-blue text-white"><o.icon size={20} /></span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {pane === 'car' && (myCars.length ? myCars.map((c) => (
            <Item key={c.id} title={`${c.year} ${c.make} ${c.model}`} sub={c.paint?.name} img={c.photos?.[0]} onClick={() => onPick({ type: 'car', id: c.id })} />
          )) : <p className="py-8 text-center text-sm text-ink-muted">Add a car to your garage first.</p>)}
          {pane === 'event' && events.map((e) => (
            <Item key={e.id} title={e.title} sub={`${parseDate(e.startDate).toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${e.location}`} img={e.image} onClick={() => onPick({ type: 'event', id: e.id })} />
          ))}
          {pane === 'listing' && (listings.length ? listings.map((l) => (
            <Item key={l.id} title={l.title} sub={`€${l.price.toLocaleString()}`} img={l.image} onClick={() => onPick({ type: 'listing', id: l.id })} />
          )) : <p className="py-8 text-center text-sm text-ink-muted">No active listings.</p>)}
        </div>
        {pane !== 'menu' && (
          <button onClick={() => setPane('menu')} className="mt-2 h-12 rounded-2xl text-[15px] font-semibold text-ink-muted">Back</button>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Conversation() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conv, setConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [peerRead, setPeerRead] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<ChatAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);

  const scrollDown = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    setConv(null);
    setMessages(null);
    chatApi
      .get(id)
      .then((r) => {
        if (!alive) return;
        setConv(r.conversation);
        setMessages(r.messages);
        setPeerRead(r.conversation.peerLastReadAt ?? null);
        scrollDown();
        refreshChatCounts();
      })
      .catch((e) => {
        toast((e as Error).message);
        navigate('/messages', { replace: true });
      });
    return () => {
      alive = false;
    };
  }, [id, navigate, toast, scrollDown]);

  // Poll for new messages while the chat is open.
  const lastAt = messages?.length ? messages[messages.length - 1].createdAt : null;
  useEffect(() => {
    if (!messages) return;
    const t = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await chatApi.since(id, lastAt ?? new Date(0).toISOString());
        if (r.peerLastReadAt !== undefined) setPeerRead(r.peerLastReadAt ?? null);
        if (r.messages.length) {
          setMessages((cur) => {
            const map = new Map((cur ?? []).map((m) => [m.id, m]));
            r.messages.forEach((m) => map.set(m.id, m));
            return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          });
          if (atBottom.current) scrollDown(true);
          refreshChatCounts();
        }
      } catch {
        /* offline: try again next tick */
      }
    }, 3500);
    return () => window.clearInterval(t);
  }, [id, lastAt, messages, scrollDown]);

  const send = async () => {
    const body = text.trim();
    if ((!body && !pending) || sending) return;
    setSending(true);
    try {
      const r = await chatApi.send(id, body, pending);
      setMessages((cur) => [...(cur ?? []), r.message]);
      setText('');
      setPending(null);
      if (conv?.status === 'request') setConv({ ...conv, status: 'active' });
      scrollDown(true);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setPending({ type: 'image', url });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const accept = async () => {
    try {
      const r = await chatApi.accept(id);
      setConv(r.conversation);
      refreshChatCounts();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const decline = async (block: boolean) => {
    try {
      await chatApi.decline(id, block);
      toast(block ? 'Declined and blocked.' : 'Request declined.');
      refreshChatCounts();
      navigate('/messages', { replace: true });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const blockPeer = async () => {
    if (!conv?.peer) return;
    if (!window.confirm(`Block ${conv.peer.name}? They won't be able to message you.`)) return;
    try {
      await chatApi.block(conv.peer.id);
      setConv({ ...conv, blocked: true });
      toast(`${conv.peer.name} is blocked. You can unblock in Settings → Privacy.`);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const unblockPeer = async () => {
    if (!conv?.peer) return;
    try {
      await chatApi.unblock(conv.peer.id);
      setConv({ ...conv, blocked: false });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const leaveCrew = async () => {
    if (!window.confirm('Leave this crew chat?')) return;
    try {
      await chatApi.leave(id);
      navigate('/messages', { replace: true });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const deleteMsg = async (mid: string) => {
    try {
      await chatApi.deleteMessage(mid);
      setMessages((cur) => (cur ?? []).map((m) => (m.id === mid ? { ...m, body: '', attachment: null, deleted: true } as ChatMessage : m)));
      setSelected(null);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const lastMineId = useMemo(() => [...(messages ?? [])].reverse().find((m) => m.mine)?.id, [messages]);
  const seen = !!(conv?.kind === 'direct' && peerRead && lastMineId && messages?.find((m) => m.id === lastMineId && m.createdAt <= peerRead));

  const isCrew = conv?.kind === 'crew';
  const canWrite = conv && !conv.blocked && !(conv as Conv & { peerDeclined?: boolean }).peerDeclined;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg-app md:relative md:inset-auto md:z-auto md:h-[calc(100dvh-64px-48px)] md:overflow-hidden md:rounded-3xl md:border md:border-border">
      {/* Header */}
      <header className="border-b border-border bg-navbar/95 pt-safe backdrop-blur-xl">
        <div className="flex h-[60px] items-center gap-1.5 px-1.5">
          <Link to="/messages" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink" aria-label="Back to messages">
            <ArrowLeft size={22} />
          </Link>
          {conv ? (
            isCrew ? (
              conv.image ? <img src={conv.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bmw-blue-light text-bmw-blue"><Users size={19} /></span>
            ) : (
              <Avatar initials={conv.peer?.initials ?? '··'} size={40} />
            )
          ) : (
            <span className="h-10 w-10 rounded-full bg-surface-2" />
          )}
          <div className="ml-1.5 min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold leading-tight text-ink">{conv?.title ?? ' '}</p>
            <p className="truncate text-[12px] text-ink-muted">
              {conv ? (isCrew ? `${conv.memberCount} drivers · ${conv.subtitle ?? ''}` : conv.subtitle || 'Private chat') : ' '}
            </p>
          </div>
          <ThemeToggle />
          {conv && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink" aria-label="Chat options">
                  <MoreVertical size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                {isCrew && conv.eventId && (
                  <DropdownMenuItem onClick={() => navigate(`/events?event=${conv.eventId}`)} className="min-h-[44px] gap-2.5 rounded-xl">
                    <CalendarDays size={16} /> View event
                  </DropdownMenuItem>
                )}
                {isCrew ? (
                  <DropdownMenuItem onClick={leaveCrew} className="min-h-[44px] gap-2.5 rounded-xl text-danger focus:text-danger">
                    <LogOut size={16} /> Leave crew chat
                  </DropdownMenuItem>
                ) : (
                  <>
                    {conv.blocked ? (
                      <DropdownMenuItem onClick={unblockPeer} className="min-h-[44px] gap-2.5 rounded-xl">
                        <Check size={16} /> Unblock
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={blockPeer} className="min-h-[44px] gap-2.5 rounded-xl text-danger focus:text-danger">
                        <Ban size={16} /> Block {conv.peer?.name.split(' ')[0]}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => conv.peer && setReport(`user:${conv.peer.id}`)} className="min-h-[44px] gap-2.5 rounded-xl">
                      <Flag size={16} /> Report member
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        onClick={() => setSelected(null)}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          <p className="mx-auto mb-2 flex max-w-[320px] items-start gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-[12px] leading-snug text-ink-muted">
            <Lock size={15} className="mt-px shrink-0 text-bmw-blue" />
            {isCrew
              ? 'Crew chat for drivers going to this event. Only members of the crew can see it.'
              : `Private chat — only you${conv?.peer ? ` and ${conv.peer.name.split(' ')[0]}` : ''} can see it. You can block or report anytime.`}
          </p>
          {messages === null && (
            <div className="flex justify-center py-10 text-ink-faint">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {messages?.map((m, i) => {
            const d = new Date(m.createdAt);
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== d.toDateString();
            const grouped = prev && !newDay && prev.senderId === m.senderId && d.getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
            const deleted = (m as ChatMessage & { deleted?: boolean }).deleted;
            return (
              <div key={m.id} className="flex flex-col">
                {newDay && <p className="my-2 self-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{dayLabel(d)}</p>}
                {isCrew && !m.mine && !grouped && <p className="ml-3 mt-1.5 text-[11px] font-semibold text-ink-muted">{m.senderName}</p>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!deleted) setSelected(selected === m.id ? null : m.id);
                  }}
                  className={cn('flex max-w-[82%] flex-col gap-1 text-left', m.mine ? 'self-end items-end' : 'self-start items-start', !grouped && 'mt-1')}
                >
                  {m.attachment && <AttachmentCard a={m.attachment} mine={m.mine} />}
                  {(m.body || deleted) && (
                    <span
                      className={cn(
                        'whitespace-pre-wrap break-words px-3.5 py-2.5 text-[15px] leading-snug',
                        m.mine ? 'rounded-[20px] rounded-br-md bg-bmw-blue text-white' : 'rounded-[20px] rounded-bl-md bg-surface-2 text-ink',
                        deleted && 'italic opacity-60',
                      )}
                    >
                      {deleted ? 'Message deleted' : m.body}
                    </span>
                  )}
                </button>
                {selected === m.id && (
                  <div className={cn('mt-1 flex items-center gap-2 text-[12px]', m.mine ? 'self-end' : 'self-start')}>
                    <span className="text-ink-faint">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.mine ? (
                      <button onClick={() => deleteMsg(m.id)} className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 font-semibold text-danger">
                        <Trash2 size={13} /> Delete
                      </button>
                    ) : (
                      <button onClick={() => setReport(`message:${m.id}`)} className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3 font-semibold text-ink">
                        <Flag size={13} /> Report
                      </button>
                    )}
                  </div>
                )}
                {m.id === lastMineId && seen && <p className="mr-1 mt-1 self-end text-[11px] text-ink-faint">Seen</p>}
              </div>
            );
          })}
          {conv?.awaitingAccept && messages && messages.length > 0 && (
            <p className="mt-3 self-center text-center text-[12px] text-ink-faint">Waiting for {conv.peer?.name.split(' ')[0]} to accept your message request.</p>
          )}
        </div>
      </div>

      {/* Request bar / composer */}
      {conv?.status === 'request' ? (
        <div className="border-t border-border bg-navbar px-4 pb-[calc(12px+var(--safe-bottom))] pt-3">
          <p className="text-center text-[13px] text-ink-muted">
            <b className="text-ink">{conv.peer?.name}</b> wants to message you. Accept to reply — they won’t know you’ve read it until you do.
          </p>
          <div className="mx-auto mt-3 grid max-w-md grid-cols-3 gap-2">
            <button onClick={() => decline(true)} className="h-12 rounded-2xl border border-border font-semibold text-danger">Block</button>
            <button onClick={() => decline(false)} className="h-12 rounded-2xl border border-border font-semibold text-ink">Decline</button>
            <button onClick={accept} className="h-12 rounded-2xl bg-bmw-blue font-semibold text-white">Accept</button>
          </div>
        </div>
      ) : conv && !canWrite ? (
        <div className="border-t border-border bg-navbar px-4 pb-[calc(14px+var(--safe-bottom))] pt-3.5 text-center text-[13px] text-ink-muted">
          {conv.blocked ? (
            <>You can’t message each other. <button onClick={unblockPeer} className="font-semibold text-bmw-blue">Unblock</button></>
          ) : (
            'This member isn’t accepting your messages.'
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-border bg-navbar/95 px-2.5 pb-[calc(10px+var(--safe-bottom))] pt-2.5 backdrop-blur-xl"
        >
          {(pending || uploading) && (
            <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-[13px] text-ink">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : pending?.type === 'image' ? <ImagePlus size={16} /> : <Plus size={16} />}
              <span className="flex-1 truncate">{uploading ? 'Uploading photo…' : pending?.type === 'image' ? 'Photo attached' : `Sharing a ${pending?.type}`}</span>
              {!uploading && (
                <button type="button" onClick={() => setPending(null)} aria-label="Remove attachment" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted">
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              type="button"
              onClick={() => setSharing(true)}
              aria-label="Share a photo, car, event or listing"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink"
            >
              <Plus size={22} />
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={isCrew ? 'Message the crew…' : `Message ${conv?.peer?.name.split(' ')[0] ?? ''}…`}
                className="block max-h-32 min-h-[44px] w-full resize-none rounded-[22px] border border-border bg-surface px-4 py-[11px] text-[15px] leading-snug text-ink outline-none placeholder:text-ink-faint focus:border-bmw-blue"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
            </label>
            <button
              type="submit"
              disabled={sending || (!text.trim() && !pending)}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hot text-hot-on transition-opacity disabled:opacity-40"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={19} />}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </form>
      )}

      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        onPhoto={() => fileRef.current?.click()}
        onPick={(a) => {
          setPending(a);
          setSharing(false);
        }}
      />
      {report && (
        <ReportDialog
          targetType={report.split(':')[0] as 'user' | 'message'}
          targetId={report.split(':')[1]}
          onClose={() => {
            setReport(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
