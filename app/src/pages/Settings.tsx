import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell, CreditCard, KeyRound, Link2, Loader2, Lock, Mail, ShieldCheck, Trash2, UserCog, Eye,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { setProfile, useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { MEMBER_PROFILE, SETTINGS, TIERS, eur, formatDate } from '@/lib/data';
import { parseDate } from '@/lib/data';
import type { MemberProfile, Order } from '@/lib/data';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/Confirm';

const TABS = [
  { id: 'account', label: 'Account', icon: UserCog },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Eye },
  { id: 'connections', label: 'Connected accounts', icon: Link2 },
  { id: 'billing', label: 'Membership & billing', icon: CreditCard },
] as const;
type TabId = (typeof TABS)[number]['id'];

const INPUT =
  'h-11 w-full rounded-xl border border-border bg-white px-3.5 text-[15px] text-ink outline-none transition-colors focus:border-bmw-blue focus:ring-2 focus:ring-bmw-blue/15';

function Card({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={cn('rounded-2xl border bg-white p-5 shadow-card sm:p-6', tone === 'danger' ? 'border-danger/30' : 'border-border')}>
      <h2 className={cn('font-display text-base font-extrabold tracking-tight', tone === 'danger' ? 'text-danger' : 'text-ink')}>{title}</h2>
      {description && <p className="mt-1 text-[13px] text-ink-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Btn({ children, busy, tone = 'primary', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; tone?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50',
        tone === 'primary' && 'bg-bmw-blue text-white hover:bg-bmw-blue-dark',
        tone === 'ghost' && 'border border-border bg-white text-ink hover:border-bmw-blue/40',
        tone === 'danger' && 'bg-danger text-white hover:bg-danger/90',
        rest.className,
      )}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-ink-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-bmw-blue' : 'bg-silver-light')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

function useApply() {
  const { setUser } = useAuth();
  return (p: MemberProfile) => {
    setProfile(p);
    setUser(p);
  };
}

// --------------------------------------------------------------------------- tabs
function AccountTab() {
  const { toast } = useToast();
  const apply = useApply();
  const [email, setEmail] = useState(MEMBER_PROFILE.email);
  const [emailPw, setEmailPw] = useState('');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    try {
      const r = await api.patch<{ user: MemberProfile }>('/me/email', { email, password: emailPw });
      apply(r.user);
      setEmailPw('');
      toast('Email address updated.', { variant: 'success' });
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast('New password must be at least 8 characters.');
    if (next !== confirm) return toast('New passwords do not match.');
    setBusy('pw');
    try {
      const r = await api.patch<{ user: MemberProfile }>('/me/password', { currentPassword: cur, newPassword: next });
      apply(r.user);
      setCur(''); setNext(''); setConfirm('');
      toast('Password changed. Other devices have been signed out.', { variant: 'success' });
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.del('/me', { password: delPw, confirm: delConfirm });
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast((err as Error).message);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Email address" description="Used to sign in and for club emails.">
        <form onSubmit={saveEmail} className="grid gap-3 sm:grid-cols-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} aria-label="Email" />
          {MEMBER_PROFILE.hasPassword && (
            <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} placeholder="Current password" className={INPUT} aria-label="Current password" />
          )}
          <div className="sm:col-span-2">
            <Btn busy={busy === 'email'} disabled={email === MEMBER_PROFILE.email}><Mail size={15} /> Update email</Btn>
          </div>
        </form>
      </Card>

      <Card title={MEMBER_PROFILE.hasPassword ? 'Change password' : 'Set a password'}
        description={MEMBER_PROFILE.hasPassword ? 'Changing your password signs you out on other devices.' : 'You signed up with a social account. Add a password to also sign in with email.'}>
        <form onSubmit={savePw} className="grid gap-3 sm:grid-cols-3">
          {MEMBER_PROFILE.hasPassword && (
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" className={INPUT} autoComplete="current-password" aria-label="Current password" />
          )}
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8+ chars)" className={INPUT} autoComplete="new-password" aria-label="New password" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={INPUT} autoComplete="new-password" aria-label="Confirm new password" />
          <div className="sm:col-span-3">
            <Btn busy={busy === 'pw'} disabled={!next}><Lock size={15} /> {MEMBER_PROFILE.hasPassword ? 'Change password' : 'Set password'}</Btn>
          </div>
        </form>
      </Card>

      <Card title="Delete account" tone="danger" description="Permanently removes your profile, garage, posts and listings. This cannot be undone.">
        <Btn tone="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> Delete my account</Btn>
      </Card>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete your account?" confirmLabel="Delete forever" onConfirm={deleteAccount}
        description="Your membership, garage, posts and listings will be permanently deleted.">
        <div className="space-y-2">
          {MEMBER_PROFILE.hasPassword && (
            <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" className={INPUT} />
          )}
          <input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="Type DELETE to confirm" className={INPUT} />
        </div>
      </ConfirmDialog>
    </div>
  );
}

function SecurityTab() {
  const { toast } = useToast();
  const apply = useApply();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const start = async () => {
    setBusy('start');
    try {
      setSetup(await api.post<{ secret: string; qr: string }>('/me/2fa/setup'));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const enable = async () => {
    setBusy('enable');
    try {
      const r = await api.post<{ user: MemberProfile }>('/me/2fa/enable', { code });
      apply(r.user);
      setSetup(null);
      setCode('');
      toast('Two-step verification is on.', { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const disable = async () => {
    setBusy('disable');
    try {
      const r = await api.post<{ user: MemberProfile }>('/me/2fa/disable', { password: pw });
      apply(r.user);
      setPw('');
      toast('Two-step verification is off.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const everywhere = async () => {
    setBusy('all');
    try {
      await api.post('/me/signout-everywhere');
      toast('Signed out of all other devices.', { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Two-step verification" description="Require a code from an authenticator app (Google Authenticator, 1Password, Authy) when you sign in.">
        {MEMBER_PROFILE.totpEnabled ? (
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-[13px] font-semibold text-success"><ShieldCheck size={14} /> On</p>
            <div className="flex flex-wrap gap-2">
              {MEMBER_PROFILE.hasPassword && (
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password to turn off" className={cn(INPUT, 'max-w-xs')} />
              )}
              <Btn tone="ghost" busy={busy === 'disable'} onClick={disable}>Turn off</Btn>
            </div>
          </div>
        ) : setup ? (
          <div className="flex flex-col gap-5 sm:flex-row">
            <img src={setup.qr} alt="Scan this QR code with your authenticator app" className="h-44 w-44 rounded-xl border border-border" />
            <div className="space-y-3">
              <p className="text-[13px] text-ink-muted">1. Scan the QR code with your app. Can't scan? Enter this key:</p>
              <code className="block rounded-lg bg-bg-app px-3 py-2 font-mono text-sm tracking-wider text-ink">{setup.secret}</code>
              <p className="text-[13px] text-ink-muted">2. Enter the 6-digit code it shows:</p>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={cn(INPUT, 'max-w-[160px] font-mono')} />
                <Btn busy={busy === 'enable'} onClick={enable} disabled={code.replace(/\s/g, '').length !== 6}>Verify & turn on</Btn>
              </div>
            </div>
          </div>
        ) : (
          <Btn busy={busy === 'start'} onClick={start}><KeyRound size={15} /> Set up two-step verification</Btn>
        )}
      </Card>
      <Card title="Sessions" description="Signed in on a shared or lost device? Sign out everywhere else.">
        <Btn tone="ghost" busy={busy === 'all'} onClick={everywhere}>Sign out of other devices</Btn>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  const { toast } = useToast();
  const apply = useApply();
  const p = MEMBER_PROFILE.preferences;
  const save = async (k: keyof typeof p, v: boolean) => {
    try {
      const r = await api.patch<{ user: MemberProfile }>('/me/preferences', { [k]: v });
      apply(r.user);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Card title="Notifications" description="Choose what the club sends you. In-app notifications are always on.">
      <div className="divide-y divide-border">
        <Toggle checked={p.emailNotifications} onChange={(v) => save('emailNotifications', v)} label="Email notifications" hint="Announcements and event updates by email." />
        <Toggle checked={p.eventReminders} onChange={(v) => save('eventReminders', v)} label="Event reminders" hint="Reminders before events you're attending." />
        <Toggle checked={p.newsletter} onChange={(v) => save('newsletter', v)} label="Club newsletter" hint="Monthly news from the club." />
        <Toggle checked={p.garageUpdates} onChange={(v) => save('garageUpdates', v)} label="Garage updates" hint="When your car is featured or gets new insights." />
        <Toggle checked={p.marketplace} onChange={(v) => save('marketplace', v)} label="Marketplace" hint="Purchase requests and listing approvals." />
      </div>
    </Card>
  );
}

function PrivacyTab() {
  const { toast } = useToast();
  const apply = useApply();
  const p = MEMBER_PROFILE.privacy;
  const save = async (k: keyof typeof p, v: boolean) => {
    try {
      const r = await api.patch<{ user: MemberProfile }>('/me/privacy', { [k]: v });
      apply(r.user);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Card title="Privacy" description="Control what other members can see.">
      <div className="divide-y divide-border">
        <Toggle checked={p.publicProfile} onChange={(v) => save('publicProfile', v)} label="Show my location" hint="When off, other members see your name but not your city." />
        <Toggle checked={p.publicGarage} onChange={(v) => save('publicGarage', v)} label="Public garage" hint="When off, your cars are only visible to you and club staff." />
      </div>
    </Card>
  );
}

function ConnectionsTab() {
  const { toast } = useToast();
  const apply = useApply();
  const [params] = useSearchParams();
  useEffect(() => {
    const l = params.get('link');
    if (l === 'ok') toast('Account connected.', { variant: 'success' });
    if (l === 'taken') toast('That social account is already linked to another member.');
  }, [params, toast]);
  const providers = [
    { id: 'google' as const, label: 'Google', icon: 'google-g.svg', enabled: SETTINGS.auth?.google },
    { id: 'facebook' as const, label: 'Facebook', icon: 'facebook-f.svg', enabled: SETTINGS.auth?.facebook },
  ];
  const disconnect = async (id: 'google' | 'facebook') => {
    try {
      const r = await api.del<{ user: MemberProfile }>(`/me/connections/${id}`);
      apply(r.user);
      toast('Disconnected.');
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Card title="Connected accounts" description="Sign in with one click using a linked social account.">
      <div className="divide-y divide-border">
        {providers.map((p) => {
          const linked = MEMBER_PROFILE.connections[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <img src={`${import.meta.env.BASE_URL}${p.icon}`} alt="" className="h-6 w-6" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{p.label}</p>
                <p className="text-[12px] text-ink-muted">{linked ? 'Connected' : p.enabled ? 'Not connected' : 'Not available — the club has not enabled this sign-in option'}</p>
              </div>
              {linked ? (
                <Btn tone="ghost" onClick={() => disconnect(p.id)}>Disconnect</Btn>
              ) : p.enabled ? (
                <Btn tone="ghost" onClick={() => { window.location.href = `/api/auth/oauth/${p.id}/start?mode=link`; }}>Connect</Btn>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BillingTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tierId, setTierId] = useState(MEMBER_PROFILE.tierId ?? TIERS[0]?.id ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const stripe = !!SETTINGS.payments?.stripe;

  const load = () => api.get<{ orders: Order[] }>('/me/orders').then((r) => setOrders(r.orders)).catch((e) => toast((e as Error).message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const renew = async () => {
    setBusy('renew');
    try {
      const r = await api.post<{ order: Order; url: string | null }>('/me/membership/renew', { tierId });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      toast(r.order.status === 'paid' ? 'Membership renewed.' : `Renewal requested — ${eur(r.order.amount)} due. The club will contact you about payment.`, { variant: 'success' });
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pay = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.post<{ url: string }>(`/me/orders/${id}/pay`);
      window.location.href = r.url;
    } catch (e) {
      toast((e as Error).message);
      setBusy(null);
    }
  };

  const expires = MEMBER_PROFILE.membershipExpires;
  return (
    <div className="space-y-6">
      <Card title="Membership" description={expires ? `${MEMBER_PROFILE.tier} · ${parseDate(expires) < new Date() ? 'expired' : 'valid until'} ${formatDate(expires)}` : MEMBER_PROFILE.tier}>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIERS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTierId(t.id)}
              className={cn('rounded-xl border p-4 text-left transition-colors', tierId === t.id ? 'border-bmw-blue bg-bmw-blue-light/60 ring-1 ring-bmw-blue/30' : 'border-border hover:border-bmw-blue/40')}>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                <span className="font-display text-sm font-extrabold text-ink">{t.name}</span>
              </span>
              <span className="mt-1 block font-mono text-lg font-bold text-ink">{eur(t.priceYearly)}<span className="text-xs font-medium text-ink-muted"> / year</span></span>
              <ul className="mt-2 space-y-1">
                {t.benefits.map((b) => <li key={b} className="text-[12px] text-ink-muted">• {b}</li>)}
              </ul>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Btn busy={busy === 'renew'} onClick={renew}>
            <CreditCard size={15} /> {tierId === MEMBER_PROFILE.tierId ? 'Renew for 12 months' : 'Switch tier & renew'}
            {stripe ? '' : ' (pay the club)'}
          </Btn>
        </div>
      </Card>

      <Card title="Payment history">
        {orders === null ? (
          <Loader2 className="animate-spin text-ink-faint" size={18} />
        ) : orders.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                <tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Item</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Status</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[12px] text-ink-muted">{formatDate(o.createdAt)}</td>
                    <td className="py-2.5 pr-3 text-ink">{o.description}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono">{eur(o.amount)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold capitalize',
                        o.status === 'paid' ? 'bg-success/10 text-success' : o.status === 'pending' ? 'bg-gold-light text-gold-dark' : 'bg-silver-light text-ink-muted')}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {o.status === 'pending' && stripe && (
                        <Btn className="px-3 py-1.5 text-xs" busy={busy === o.id} onClick={() => pay(o.id)}>Pay</Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stripe && orders.some((o) => o.status === 'pending') && (
              <p className="mt-3 text-[12px] text-ink-muted">Pending amounts are settled directly with the club ({SETTINGS.club?.contactEmail}).</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Settings() {
  useStore();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'account') as TabId;
  const setTab = (id: TabId) => setParams({ tab: id }, { replace: true });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-ink-muted">{MEMBER_PROFILE.email} · {MEMBER_PROFILE.membershipNumber}</p>
      </motion.div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
                tab === id ? 'bg-bmw-blue-light text-bmw-blue' : 'text-ink-muted hover:bg-white hover:text-ink')}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div key={tab}>
          {tab === 'account' && <AccountTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'privacy' && <PrivacyTab />}
          {tab === 'connections' && <ConnectionsTab />}
          {tab === 'billing' && <BillingTab />}
        </div>
      </div>
    </div>
  );
}
