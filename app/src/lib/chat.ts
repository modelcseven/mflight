import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';

export interface ChatAttachment {
  type: 'car' | 'event' | 'image' | 'listing';
  id?: string;
  url?: string;
  title?: string;
  subtitle?: string;
  image?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  attachment: ChatAttachment | null;
  createdAt: string;
  mine: boolean;
  deleted?: boolean;
  kind?: 'text' | 'system';
  replyTo?: { id: string; senderName: string; body: string } | null;
}

export interface GroupMember {
  id: string;
  name: string;
  initials: string;
  location: string;
  clubPosition: string | null;
  role: 'admin' | 'member';
  isMe: boolean;
}

export interface MemberRead {
  userId: string;
  lastReadAt: string;
}

export interface ChatPeer {
  id: string;
  name: string;
  initials: string;
  location?: string;
}

export interface Conversation {
  id: string;
  kind: 'direct' | 'crew' | 'group';
  description?: string;
  myRole?: 'admin' | 'member';
  muted?: boolean;
  peerDeclined?: boolean;
  title: string;
  subtitle?: string;
  image?: string | null;
  eventId?: string | null;
  peer?: ChatPeer | null;
  memberCount: number;
  status: 'active' | 'request';
  /** true when I sent the first message and the other member has not accepted yet */
  awaitingAccept?: boolean;
  lastMessage: { body: string; senderName: string; mine: boolean; system?: boolean; createdAt: string; attachmentType?: string | null } | null;
  lastMessageAt: string | null;
  unread: number;
  blocked?: boolean;
  peerLastReadAt?: string | null;
}

interface Counts {
  unread: number;
  requests: number;
}

let counts: Counts = { unread: 0, requests: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshChatCounts() {
  try {
    counts = await api.get<Counts>('/chats/unread');
    emit();
  } catch {
    /* signed out or offline */
  }
}

export function useChatCounts(): Counts {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => counts,
    () => counts,
  );
}

/** Polls the unread badge while the app is open (pauses in background tabs). */
export function useChatBadgePolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    refreshChatCounts();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshChatCounts();
    }, 20000);
    const onVis = () => document.visibilityState === 'visible' && refreshChatCounts();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);
}

export const chatApi = {
  list: () => api.get<{ conversations: Conversation[] }>('/chats'),
  get: (id: string) => api.get<{ conversation: Conversation; messages: ChatMessage[]; reads: MemberRead[] | null }>(`/chats/${id}`),
  since: (id: string, after: string) =>
    api.get<{ messages: ChatMessage[]; peerLastReadAt?: string | null; reads?: MemberRead[] | null }>(`/chats/${id}/messages?after=${encodeURIComponent(after)}`),
  send: (id: string, body: string, attachment?: ChatAttachment | null, replyTo?: string | null) =>
    api.post<{ message: ChatMessage }>(`/chats/${id}/messages`, { body, attachment: attachment ?? null, replyTo: replyTo ?? null }),
  mute: (id: string, muted: boolean) => api.post<{ ok: true; muted: boolean }>(`/chats/${id}/mute`, { muted }),
  createGroup: (g: { title: string; description?: string; image?: string | null; memberIds: string[] }) =>
    api.post<{ conversation: Conversation; skipped: string[] }>('/chats/groups', g),
  updateGroup: (id: string, g: { title?: string; description?: string; image?: string | null }) =>
    api.patch<{ conversation: Conversation }>(`/chats/${id}`, g),
  deleteGroup: (id: string) => api.del<{ ok: true }>(`/chats/${id}`),
  members: (id: string) => api.get<{ members: GroupMember[] }>(`/chats/${id}/members`),
  addMembers: (id: string, userIds: string[]) => api.post<{ ok: true; added: string[]; skipped: string[] }>(`/chats/${id}/members`, { userIds }),
  setRole: (id: string, userId: string, role: 'admin' | 'member') => api.patch<{ ok: true }>(`/chats/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => api.del<{ ok: true }>(`/chats/${id}/members/${userId}`),
  start: (userId: string) => api.post<{ conversation: Conversation }>('/chats', { userId }),
  accept: (id: string) => api.post<{ conversation: Conversation }>(`/chats/${id}/accept`),
  decline: (id: string, block = false) => api.post<{ ok: true }>(`/chats/${id}/decline`, { block }),
  leave: (id: string) => api.post<{ ok: true }>(`/chats/${id}/leave`),
  block: (userId: string) => api.post<{ ok: true }>('/blocks', { userId }),
  unblock: (userId: string) => api.del<{ ok: true }>(`/blocks/${userId}`),
  blocks: () => api.get<{ blocks: ChatPeer[] }>('/blocks'),
  deleteMessage: (id: string) => api.del<{ ok: true }>(`/messages/${id}`),
};
