import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';
import { refresh, applyBranding } from './store';
import { MEMBER_PROFILE, SETTINGS } from './data';
import type { AdminArea, MemberProfile, PublicSettings, Role } from './data';

export interface Member {
  id: string;
  name: string;
  firstName: string;
  email: string;
  initials: string;
  tier: string;
  memberNo: string;
  role: Role;
  permissions: AdminArea[];
}

interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  member: Member | null;
  isAuthenticated: boolean;
  loading: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string, code?: string) => Promise<{ needTotp: true } | Member>;
  signUp: (input: SignUpInput) => Promise<Member>;
  signOut: () => Promise<void>;
  /** Re-reads the session + all club data from the server. */
  reload: () => Promise<void>;
  /** Apply a fresh profile returned by an account endpoint. */
  setUser: (p: MemberProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toMember(p: MemberProfile): Member {
  return {
    id: p.id,
    name: p.name,
    firstName: p.firstName,
    email: p.email,
    initials: p.initials,
    tier: p.tier,
    memberNo: p.membershipNumber,
    role: p.role,
    permissions: p.permissions ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await api.get<{ user: MemberProfile | null }>('/auth/me');
    if (me.user) {
      await refresh();
      setMember(toMember(me.user));
    } else {
      setMember(null);
      // Public branding for the sign-in screens.
      try {
        const s = await api.get<PublicSettings>('/settings/public');
        Object.assign(SETTINGS, s);
        applyBranding(s);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    load()
      .catch(() => setMember(null))
      .finally(() => setLoading(false));
  }, [load]);

  const finish = useCallback(async (user: MemberProfile) => {
    await refresh();
    const m = toMember(user);
    setMember(m);
    return m;
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password, code) => {
    const r = await api.post<{ user?: MemberProfile; needTotp?: boolean }>('/auth/login', { email, password, code });
    if (r.needTotp) return { needTotp: true };
    return finish(r.user!);
  }, [finish]);

  const signUp = useCallback(async (input: SignUpInput) => {
    const r = await api.post<{ user: MemberProfile }>('/auth/signup', input);
    return finish(r.user);
  }, [finish]);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setMember(null);
    }
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const setUser = useCallback((p: MemberProfile) => {
    Object.assign(MEMBER_PROFILE, p);
    setMember(toMember(p));
  }, []);

  const isStaff = !!member && member.role !== 'member';

  return (
    <AuthContext.Provider value={{ member, isAuthenticated: !!member, loading, isStaff, signIn, signUp, signOut, reload, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg-app">
      <div className="flex flex-col items-center gap-3">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-bmw-blue/20 border-t-bmw-blue" />
        <span className="text-sm text-ink-muted">Loading…</span>
      </div>
    </div>
  );
}

/** Wraps app routes: unauthenticated visitors are redirected to /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Admin routes: signed in AND a staff role. */
export function StaffRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, isStaff } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isStaff) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Auth pages: already signed-in visitors go straight to the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
