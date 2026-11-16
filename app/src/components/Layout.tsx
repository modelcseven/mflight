import { logoUrl } from '@/lib/store';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CarFront,
  Globe,
  LogOut,
  Menu,
  Bell,
  Newspaper,
  User,
  X,
  ShoppingBag,
  Settings as SettingsIcon,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore, bump } from '@/lib/store';
import { useToast } from '@/lib/toast';
import type { AppNotification } from '@/lib/data';
import { SETTINGS } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { MEMBER_PROFILE, NOTIFICATIONS } from '@/lib/data';
import { cn } from '@/lib/utils';
import MembershipPlate from '@/components/MembershipPlate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { to: '/dashboard', label: 'Feed', icon: Newspaper },
  { to: '/garage', label: 'My Garage', icon: CarFront },
  { to: '/events', label: 'Club Events', icon: CalendarDays },
  { to: '/map', label: 'Global Map', icon: Globe },
  { to: '/parts', label: 'Part Store', icon: ShoppingBag },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Club Feed',
  '/garage': 'My Garage',
  '/events': 'Club Events',
  '/map': 'Global Presence',
  '/profile': 'Profile',
  '/parts': 'Part Store',
  '/settings': 'Account Settings',
};

async function markRead(id?: string) {
  const r = await api.post<{ notifications: AppNotification[] }>(id ? `/notifications/${id}/read` : '/notifications/read-all');
  NOTIFICATIONS.splice(0, NOTIFICATIONS.length, ...r.notifications);
  bump();
}

function SidebarContent({ onNavigate, full = false }: { onNavigate?: () => void; full?: boolean }) {
  const { member, signOut, isStaff } = useAuth();
  const navigate = useNavigate();
  const labelCls = full ? 'truncate' : 'hidden truncate lg:inline';
  const blockCls = full ? 'min-w-0' : 'hidden min-w-0 lg:block';
  return (
    <div className="flex h-full flex-col border-r border-border bg-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <img src={logoUrl()} alt="BMW Car Club Europe" className="h-10 w-10 shrink-0" />
        <div className={blockCls}>
          <p className="font-display text-lg font-extrabold leading-none tracking-tight text-ink">{SETTINGS.club?.name ?? 'MFlight'}</p>
          <span className="mt-1 flex gap-0.5" aria-hidden>
            <i className="h-[3px] w-4 -skew-x-[20deg] rounded-full bg-sky" />
            <i className="h-[3px] w-4 -skew-x-[20deg] rounded-full bg-bmw-blue" />
            <i className="h-[3px] w-4 -skew-x-[20deg] rounded-full bg-m-red" />
          </span>
          <span className="mt-1.5 inline-block rounded-full bg-gold-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-gold-dark">
            {member?.role && member.role !== 'member' ? MEMBER_PROFILE.roleLabel : 'Member'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 font-display text-sm font-semibold transition-colors duration-150',
                isActive ? 'bg-bmw-blue-light text-bmw-blue' : 'text-ink-muted hover:bg-slate-50 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-m-red"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={18} className={cn('shrink-0', isActive ? 'text-m-red' : 'text-ink-faint group-hover:text-ink-muted')} />
                <span className={labelCls}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {isStaff && (
          <NavLink
            to="/admin"
            onClick={onNavigate}
            className="group relative mt-4 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-light/60 px-3 py-2.5 font-display text-sm font-semibold text-gold-dark transition-colors hover:bg-gold-light"
          >
            <ShieldCheck size={18} className="shrink-0" />
            <span className={labelCls}>Admin</span>
          </NavLink>
        )}
      </nav>

      {/* Member card + sign out */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bmw-blue font-display text-xs font-bold text-white">
            {member?.initials ?? 'AB'}
          </span>
          <div className={blockCls}>
            <p className="truncate text-sm font-semibold text-ink">{member?.name ?? MEMBER_PROFILE.name}</p>
            <p className="truncate font-mono text-[11px] text-ink-faint">{MEMBER_PROFILE.membershipNumber}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-50 hover:text-ink"
        >
          <LogOut size={16} />
          <span className={labelCls}>Sign out</span>
        </button>
      </div>
    </div>
  );
}

/** Post-login app shell: light sidebar + white topbar, renders <Outlet/>. */
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { member, signOut, isStaff } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = location.pathname.startsWith('/garage/')
    ? 'Car Detail'
    : (TITLES[location.pathname] ?? SETTINGS.club?.name ?? 'MFlight');
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  // Payment return banners (?payment=success|pending|cancelled) and email verification.
  useEffect(() => {
    const p = params.get('payment');
    const v = params.get('verified');
    if (!p && !v) return;
    if (p === 'success') toast('Payment received — thank you!', { title: 'Paid', variant: 'success' });
    if (p === 'pending') toast('We have not received confirmation from the payment provider yet. It may take a minute.', { title: 'Payment pending' });
    if (p === 'cancelled') toast('Payment was cancelled. You can pay later from Settings → Billing.', { title: 'Payment cancelled' });
    if (v === '1') toast('Your email address is confirmed.', { variant: 'success' });
    const next = new URLSearchParams(params);
    next.delete('payment');
    next.delete('verified');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] bg-bg-app">
      {/* Sidebar — icon rail < lg, full 264px >= lg */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] md:block lg:w-[264px]">
        <SidebarContent />
      </aside>

      {/* Off-canvas drawer < md */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-ink-dark/40 backdrop-blur-[6px]"
            onClick={() => setDrawerOpen(false)}
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            className="absolute inset-y-0 left-0 w-[264px]"
          >
            <SidebarContent full onNavigate={() => setDrawerOpen(false)} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute -right-10 top-4 rounded-full bg-white/10 p-2 text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </motion.div>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-[76px] lg:pl-[264px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">{title}</h2>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <MembershipPlate number={MEMBER_PROFILE.membershipNumber} size="sm" className="hidden sm:inline-flex" />

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative rounded-full p-2 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink" aria-label="Notifications">
                  <Bell size={19} />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-m-red opacity-60" />
                      <span className="h-2 w-2 rounded-full bg-m-red" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[340px] rounded-xl p-2">
                <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5 font-display text-sm font-bold">
                  Notifications
                  {unread > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); markRead().catch(() => {}); }}
                      className="flex items-center gap-1 text-xs font-semibold text-bmw-blue hover:underline"
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {NOTIFICATIONS.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-ink-muted">You're all caught up.</p>
                )}
                <div className="max-h-[420px] overflow-y-auto">
                {NOTIFICATIONS.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => {
                      if (n.unread) markRead(n.id).catch(() => {});
                      if (n.link) navigate(n.link);
                    }}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5"
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-bmw-blue' : 'bg-border')} />
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-faint">{n.time}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-slate-100 sm:pr-3" aria-label="Account menu">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bmw-blue font-display text-[11px] font-bold text-white">
                    {member?.initials ?? 'AB'}
                  </span>
                  <span className="hidden text-sm font-semibold text-ink sm:inline">{member?.firstName ?? 'Alex'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuLabel className="px-2 py-1.5">
                  <span className="block text-sm font-semibold">{member?.name}</span>
                  <span className="block text-xs font-normal text-ink-muted">{member?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer gap-2">
                  <User size={15} /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer gap-2">
                  <SettingsIcon size={15} /> Account settings
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer gap-2">
                    <ShieldCheck size={15} /> Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                  className="cursor-pointer gap-2 text-danger focus:text-danger"
                >
                  <LogOut size={15} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Account status banners */}
        {MEMBER_PROFILE.status === 'Pending' && (
          <div className="border-b border-gold/30 bg-gold-light/70 px-4 py-2.5 text-center text-[13px] font-medium text-gold-dark sm:px-6">
            Your membership is awaiting approval by the club. You can browse, but some actions may be limited.
          </div>
        )}
        {!MEMBER_PROFILE.emailVerified && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-bmw-blue/20 bg-bmw-blue-light px-4 py-2.5 text-[13px] font-medium text-bmw-blue sm:px-6">
            Please confirm your email address.
            <button
              className="font-bold underline"
              onClick={() => api.post('/auth/resend-verification').then(() => toast('Verification email sent.', { variant: 'success' })).catch((e) => toast((e as Error).message))}
            >
              Resend email
            </button>
          </div>
        )}

        {/* Page content with route transition */}
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
