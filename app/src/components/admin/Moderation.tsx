import { useMemo, useState } from 'react';
import { EyeOff, Eye, Pin, PinOff, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { memberById } from '@/lib/data';
import type { FeedPost } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Btn, Chip, Empty, ErrorBox, FilterChips, Loading, PageHeader, Panel, SearchBox, fmtDateTime, statusTone, useAdminData } from './ui';

interface Report { id: string; targetType: string; targetId: string; reason: string; status: string; createdAt: string; reporterName: string; preview: string }
interface AdminComment { id: string; postId: string; authorId: string; authorName: string; text: string; hidden: boolean; createdAt: string }

function Reports() {
  const { toast } = useToast();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed' | ''>('open');
  const { data, error, loading, reload } = useAdminData<{ reports: Report[] }>(`/admin/reports${status ? `?status=${status}` : ''}`);
  const act = async (r: Report, action: 'hide' | 'delete' | 'none', next: 'resolved' | 'dismissed' | 'open') => {
    try {
      await api.patch(`/admin/reports/${r.id}`, { action, status: next });
      toast(next === 'dismissed' ? 'Report dismissed.' : action === 'none' ? 'Report updated.' : `Content ${action === 'hide' ? 'hidden' : 'deleted'} and report resolved.`, { variant: 'success' });
      reload();
      if (action !== 'none') refresh().catch(() => {});
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div>
      <div className="mb-3">
        <FilterChips value={status} onChange={setStatus} options={[{ id: 'open', label: 'Open' }, { id: 'resolved', label: 'Resolved' }, { id: 'dismissed', label: 'Dismissed' }, { id: '', label: 'All' }]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {!data?.reports.length ? <Empty>No reports here. 🎉</Empty> : (
            <ul className="divide-y divide-border">
              {data.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="info">{r.targetType}</Chip>
                      <Chip tone={statusTone(r.status)}>{r.status}</Chip>
                      <span className="text-[12px] text-ink-faint">by {r.reporterName} · {fmtDateTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{r.reason}</p>
                    <p className="mt-1 line-clamp-3 rounded-lg bg-bg-app px-3 py-2 text-[13px] text-ink-muted">{r.preview}</p>
                  </div>
                  {r.status === 'open' && (
                    <div className="flex flex-wrap gap-1.5">
                      <Btn size="sm" tone="ghost" onClick={() => act(r, 'hide', 'resolved')}><EyeOff size={13} /> {r.targetType === 'user' ? 'Suspend' : r.targetType === 'listing' ? 'Reject' : 'Hide'}</Btn>
                      {r.targetType !== 'user' && <Btn size="sm" tone="danger" onClick={() => act(r, 'delete', 'resolved')}><Trash2 size={13} /> Delete</Btn>}
                      <Btn size="sm" tone="subtle" onClick={() => act(r, 'none', 'dismissed')}><X size={13} /> Dismiss</Btn>
                    </div>
                  )}
                  {r.status !== 'open' && <Btn size="sm" tone="subtle" onClick={() => act(r, 'none', 'open')}>Reopen</Btn>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function Posts() {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useAdminData<{ posts: FeedPost[]; comments: AdminComment[] }>('/admin/posts');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'posts' | 'comments'>('posts');
  const posts = useMemo(() => (data?.posts ?? []).filter((p) => !q || p.text.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const comments = useMemo(() => (data?.comments ?? []).filter((c) => !q || c.text.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const patchPost = async (p: FeedPost, body: Partial<FeedPost>) => {
    try {
      const r = await api.patch<{ post: FeedPost }>(`/admin/posts/${p.id}`, body);
      setData((d) => d && { ...d, posts: d.posts.map((x) => (x.id === p.id ? r.post : x)) });
      refresh().catch(() => {});
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const delPost = async (p: FeedPost) => {
    try {
      await api.del(`/admin/posts/${p.id}`);
      setData((d) => d && { ...d, posts: d.posts.filter((x) => x.id !== p.id) });
      refresh().catch(() => {});
      toast('Post deleted.');
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const patchComment = async (c: AdminComment, hidden: boolean) => {
    try {
      await api.patch(`/admin/comments/${c.id}`, { hidden });
      setData((d) => d && { ...d, comments: d.comments.map((x) => (x.id === c.id ? { ...x, hidden } : x)) });
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const delComment = async (c: AdminComment) => {
    try {
      await api.del(`/admin/comments/${c.id}`);
      setData((d) => d && { ...d, comments: d.comments.filter((x) => x.id !== c.id) });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search text…" />
        <FilterChips value={view} onChange={setView} options={[{ id: 'posts', label: 'Posts', count: data?.posts.length }, { id: 'comments', label: 'Comments', count: data?.comments.length }]} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? <Loading /> : (
        <Panel pad={false}>
          {view === 'posts' ? (
            posts.length === 0 ? <Empty>No posts.</Empty> : (
              <ul className="divide-y divide-border">
                {posts.map((p) => (
                  <li key={p.id} className={cn('flex flex-wrap items-start gap-3 px-5 py-4', p.hidden && 'bg-bg-app/70')}>
                    {p.image && <img src={p.image} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
                        <span className="font-semibold text-ink">{memberById(p.authorId)?.name ?? 'Member'}</span>
                        · {fmtDateTime(p.createdAt)} · {p.likes} likes · {p.comments} comments
                        {p.pinned && <Chip tone="warning">Pinned</Chip>}
                        {p.isAnnouncement && <Chip tone="gold">Announcement</Chip>}
                        {p.hidden && <Chip tone="danger">Hidden</Chip>}
                      </div>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-ink">{p.text}</p>
                    </div>
                    <div className="flex gap-1">
                      <Btn size="sm" tone="subtle" onClick={() => patchPost(p, { pinned: !p.pinned })} title={p.pinned ? 'Unpin' : 'Pin to top'}>{p.pinned ? <PinOff size={13} /> : <Pin size={13} />}</Btn>
                      <Btn size="sm" tone="subtle" onClick={() => patchPost(p, { hidden: !p.hidden })} title={p.hidden ? 'Unhide' : 'Hide'}>{p.hidden ? <Eye size={13} /> : <EyeOff size={13} />}</Btn>
                      <Btn size="sm" tone="subtle" onClick={() => delPost(p)} title="Delete"><Trash2 size={13} className="text-danger" /></Btn>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : comments.length === 0 ? <Empty>No comments.</Empty> : (
            <ul className="divide-y divide-border">
              {comments.map((c) => (
                <li key={c.id} className={cn('flex items-start gap-3 px-5 py-3', c.hidden && 'bg-bg-app/70')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-ink-faint"><span className="font-semibold text-ink">{c.authorName}</span> · {fmtDateTime(c.createdAt)} {c.hidden && <Chip tone="danger">Hidden</Chip>}</p>
                    <p className="text-[13px] text-ink">{c.text}</p>
                  </div>
                  <Btn size="sm" tone="subtle" onClick={() => patchComment(c, !c.hidden)}>{c.hidden ? <Eye size={13} /> : <EyeOff size={13} />}</Btn>
                  <Btn size="sm" tone="subtle" onClick={() => delComment(c)}><Trash2 size={13} className="text-danger" /></Btn>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState<'reports' | 'content'>('reports');
  return (
    <div>
      <PageHeader title="Moderation" description="Review reports and keep the feed healthy." />
      <div className="mb-5 flex gap-2">
        {([['reports', 'Reports queue'], ['content', 'Posts & comments']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('rounded-full px-4 py-2 text-sm font-semibold', tab === id ? 'bg-bmw-blue text-white' : 'border border-border bg-white text-ink-muted hover:text-ink')}>{label}</button>
        ))}
      </div>
      {tab === 'reports' ? <Reports /> : <Posts />}
    </div>
  );
}
