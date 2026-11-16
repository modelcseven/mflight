import { useState } from 'react';
import { BadgeCheck, Flag, Heart, Loader2, Megaphone, MessageCircle, MoreHorizontal, Pin, SendHorizonal, Trash2 } from 'lucide-react';
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
    <article className={cn('rounded-2xl border bg-white p-5 shadow-card sm:p-6', post.isAnnouncement ? 'border-gold/50' : 'border-border')}>
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
            {author && <MembershipPlate number={author.membershipNumber} size="sm" />}
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            {author?.location ? `${author.location} · ` : ''}{timeAgo(post.createdAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" aria-label="Post options">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            {mine ? (
              <DropdownMenuItem onClick={deletePost} className="cursor-pointer gap-2 text-danger focus:text-danger">
                <Trash2 size={15} /> Delete post
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setReport({ type: 'post', id: post.id })} className="cursor-pointer gap-2">
                <Flag size={15} /> Report post
              </DropdownMenuItem>
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
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <img src={post.image} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
        </div>
      )}

      <footer className="mt-4 flex items-center gap-5 border-t border-border pt-3.5 text-[13px] font-medium text-ink-muted">
        <button onClick={toggleLike} aria-pressed={!!post.likedByMe} className="flex items-center gap-1.5 transition-colors hover:text-m-red">
          <Heart size={16} className={cn('text-m-red transition-transform', post.likedByMe && 'scale-110 fill-m-red')} />
          <span className="font-mono">{post.likes}</span>
        </button>
        <button onClick={toggleComments} aria-expanded={open} className="flex items-center gap-1.5 transition-colors hover:text-bmw-blue">
          <MessageCircle size={16} />
          <span className="font-mono">{post.comments}</span>
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
                <button onClick={() => deleteComment(c.id)} aria-label="Delete comment" className="self-center p-1 text-ink-faint opacity-0 hover:text-danger group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              ) : (
                <button onClick={() => setReport({ type: 'comment', id: c.id })} aria-label="Report comment" className="self-center p-1 text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100">
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
              className="h-10 flex-1 rounded-xl border border-border bg-bg-app px-3.5 text-sm outline-none focus:border-bmw-blue focus:bg-white"
            />
            <button onClick={sendComment} disabled={!text.trim() || sending} aria-label="Send comment"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-bmw-blue text-white disabled:opacity-40">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
            </button>
          </div>
        </div>
      )}
      {report && <ReportDialog targetType={report.type} targetId={report.id} onClose={() => setReport(null)} />}
    </article>
  );
}
