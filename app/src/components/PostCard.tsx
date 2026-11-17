import { useState } from 'react';
import { BadgeCheck, Flag, Heart, Loader2, Mail, Megaphone, MessageCircle, MoreHorizontal, Pin, SendHorizonal, Share2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/lib/chat';
import PositionBadge from '@/components/PositionBadge';
import type { FeedPost } from '@/lib/data';
import { MEMBER_PROFILE, POSTS, memberById, timeAgo } from '@/lib/data';
import { api } from '@/lib/api';
import { removeById, upsert } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import MembershipPlate from '@/components/MembershipPlate';
import ReportDialog from '@/components/ReportDialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

/**
 * Social feed card: author, text, optional image, live likes and a comment thread.
 */
export default function PostCard({ post }: { post: FeedPost }) {
  const author = memberById(post.authorId);
  const { toast } = useToast();
  const mine = post.authorId === MEMBER_PROFILE.id;
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liking, setLiking] = useState(false);
  const [report, setReport] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const navigate = useNavigate();

  const messageAuthor = async () => {
    try {
      const r = await chatApi.start(post.authorId);
      navigate(`/messages/${r.conversation.id}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/dashboard`;
    const text = `${author?.name ?? 'A member'} on ${document.title.split(' — ')[0]}: ${post.text.slice(0, 120)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'MFlight', text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast('Copied to clipboard.');
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true);
    // optimistic
    upsert(POSTS, { ...post, likedByMe: !post.likedByMe, likes: post.likes + (post.likedByMe ? -1 : 1) });
    try {
      const r = await api.post<{ post: FeedPost }>(`/posts/${post.id}/like`);
      upsert(POSTS, r.post);
    } catch (e) {
      upsert(POSTS, post);
      toast((e as Error).message);
    } finally {
      setLiking(false);
    }
  };

  const toggleComments = async () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      setLoadingComments(true);
      try {
        const r = await api.get<{ comments: Comment[] }>(`/posts/${post.id}/comments`);
        setComments(r.comments);
      } catch (e) {
        toast((e as Error).message);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const sendComment = async () => {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    try {
      const r = await api.post<{ post: FeedPost; comment: Comment }>(`/posts/${post.id}/comments`, { text: v });
      setComments((c) => [...(c ?? []), r.comment]);
      upsert(POSTS, r.post);
      setText('');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (id: string) => {
    try {
      await api.del(`/comments/${id}`);
      setComments((c) => (c ?? []).filter((x) => x.id !== id));
      upsert(POSTS, { ...post, comments: Math.max(0, post.comments - 1) });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const deletePost = async () => {
    try {
      await api.del(`/posts/${post.id}`);
      removeById(POSTS, post.id);
      toast('Post deleted.');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const [title, ...bodyLines] = post.isAnnouncement ? post.text.split('\n') : [];

  return (
    <article className={cn('rounded-3xl border bg-white p-4 shadow-card sm:p-6', post.isAnnouncement ? 'border-gold/50' : 'border-border')}>
      {(post.pinned || post.isAnnouncement) && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-dark">
          {post.isAnnouncement ? <Megaphone size={13} /> : <Pin size={13} />}
          {post.isAnnouncement ? 'Club announcement' : 'Pinned'}
        </p>
      )}
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bmw-blue font-display text-xs font-bold text-white">
          {author?.avatarInitials ?? '??'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-ink">{author?.name ?? 'Club member'}</span>
            {author?.verified && <BadgeCheck size={15} className="shrink-0 text-bmw-blue" />}
            <PositionBadge position={author?.clubPosition} size="xs" />
            {author && <MembershipPlate number={author.membershipNumber} size="sm" />}
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {author?.location ? `${author.location} · ` : ''}{timeAgo(post.createdAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-faint hover:bg-slate-100 hover:text-ink" aria-label="Post options">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            {mine ? (
              <DropdownMenuItem onClick={deletePost} className="cursor-pointer gap-2 text-danger focus:text-danger">
                <Trash2 size={15} /> Delete post
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={messageAuthor} className="min-h-[44px] cursor-pointer gap-2 rounded-lg">
                  <Mail size={15} /> Message {author?.firstName ?? 'member'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReport({ type: 'post', id: post.id })} className="min-h-[44px] cursor-pointer gap-2 rounded-lg">
                  <Flag size={15} /> Report post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.isAnnouncement ? (
        <div className="mt-4">
          <p className="font-display text-lg font-extrabold text-ink">{title}</p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink">{bodyLines.join('\n').trim()}</p>
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink">{post.text}</p>
      )}

      {post.image && (
        <div className="-mx-4 mt-4 overflow-hidden border-y border-border sm:mx-0 sm:rounded-2xl sm:border">
          <img src={post.image} alt="" className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]" loading="lazy" />
        </div>
      )}

      <footer className="-mx-2 mt-2 flex items-center gap-1 pt-1 text-[14px] font-semibold text-ink-muted">
        <button onClick={toggleLike} aria-pressed={!!post.likedByMe} aria-label={post.likedByMe ? 'Unlike' : 'Like'} className="flex h-11 items-center gap-1.5 rounded-full px-2.5 transition-colors hover:text-hot active:scale-95">
          <Heart size={21} className={cn('text-hot transition-transform', post.likedByMe && 'scale-110 fill-hot')} />
          <span className="font-mono">{post.likes}</span>
        </button>
        <button onClick={toggleComments} aria-expanded={open} aria-label="Comments" className="flex h-11 items-center gap-1.5 rounded-full px-2.5 transition-colors hover:text-bmw-blue">
          <MessageCircle size={21} />
          <span className="font-mono">{post.comments}</span>
        </button>
        <button onClick={share} aria-label="Share" className="ml-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:text-bmw-blue">
          <Share2 size={20} />
        </button>
      </footer>

      {open && (
        <div className="mt-3 space-y-3">
          {loadingComments && <Loader2 size={16} className="animate-spin text-ink-faint" />}
          {comments?.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-950 text-[10px] font-bold text-white">
                {c.authorName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
              </span>
              <div className="min-w-0 flex-1 rounded-xl bg-bg-app px-3 py-2">
                <p className="text-[12px] font-semibold text-ink">
                  {c.authorName} <span className="font-normal text-ink-faint">· {timeAgo(String(c.createdAt))}</span>
                </p>
                <p className="text-[13px] text-ink">{c.text}</p>
              </div>
              {c.authorId === MEMBER_PROFILE.id ? (
                <button onClick={() => deleteComment(c.id)} aria-label="Delete comment" className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full text-ink-faint hover:text-danger md:opacity-0 md:group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              ) : (
                <button onClick={() => setReport({ type: 'comment', id: c.id })} aria-label="Report comment" className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full text-ink-faint hover:text-ink md:opacity-0 md:group-hover:opacity-100">
                  <Flag size={14} />
                </button>
              )}
            </div>
          ))}
          {comments?.length === 0 && <p className="text-[13px] text-ink-muted">No comments yet.</p>}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendComment()}
              placeholder="Write a comment…"
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-bg-app px-4 text-sm outline-none focus:border-bmw-blue focus:bg-white"
            />
            <button onClick={sendComment} disabled={!text.trim() || sending} aria-label="Send comment"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-hot text-hot-on disabled:opacity-40">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
            </button>
          </div>
        </div>
      )}
      {report && <ReportDialog targetType={report.type} targetId={report.id} onClose={() => setReport(null)} />}
    </article>
  );
}
