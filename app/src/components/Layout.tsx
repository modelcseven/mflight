import { logoUrl } from '@/lib/store';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  CarFront,
  CheckCheck,
  Flag,
  Globe,
  Home,
  LogOut,
  MessageCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore, bump } from '@/lib/store';
import { useToast } from '@/lib/toast';
import type { AppNotification } from '@/lib/data';
import { SETTINGS } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { MEMBER_PROFILE, NOTIFICATIONS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useChatBadgePolling, useChatCounts } from '@/lib/chat';
import MembershipPlate from '@/components/MembershipPlate';
import BottomTabs from '@/components/shell/BottomTabs';
import { CountBadge, StripeMark, ThemeToggle } from '@/components/shell/ShellBits';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { to: '/dashboard', label: 'Paddock', icon: Home },
  { to: '/events', label: 'The Grid', icon: Flag },
  { to: '/garage', label: 'Garage', icon: CarFront },
  { to: '/podium', label: 'Podium', icon: Trophy },
  { to: '/parts', label: 'MFlight', icon: ShoppingBag },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/map', label: 'Global Map', icon: Globe },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Paddock',
  '/garage': 'Garage',
  '/events': 'The Grid',
  '/map': 'Global Map',
  '/profile': 'Driver',
  '/parts': 'MFlight',
  '/settings': 'Settings',
  '/messages': 'Messages',
  '/podium': 'Podium',
};

/** Screens that bring their own full-height layout on phones (chat conversation). */
const IMMERSIVE = [/^\/messages\/[^/]+$/];

async function markRead(id?: string) {
  const r = await api.post<{ notifications: AppNotification[] }>(id ? `/notifications/${id}/read` : '/notifications/read-all');
  NOTIFICATIONS.splice(0, NOTIFICATIONS.length, ...r.notifications);
  bump();
}

function SidebarContent() {
  const { member, signOut, isStaff } = useAuth();
  const navigate = useNavigate();
  const { unread } = useChatCounts();
  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      <Link to="/dashboard" className="flex items-center gap-3 px-4 pb-5 pt-6 lg:px-5">
        <img src={logoUrl()} alt={SETTINGS.club?.clubName ?? 'Club emblem'} className="h-10 w-10 shrink-0" />
        <div className="hidden min-w-0 lg:block">
          <p className="font-race text-2xl leading-none text-ink">{(SETTINGS.club?.name ?? 'MFlight').toUpperCase()}</p>
          <StripeMark size="sm" className="mt-1.5" />
        </div>
      </Link>

      <nav className="mt-1 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                'group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 font-display text-[15px] font-semibold transition-colors duration-150',
                isActive ? 'bg-bmw-blue-light text-ink' : 'text-ink-muted hover:bg-slate-50 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sky"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">
                  <Icon size={19} className={cn('shrink-0', isActive ? 'text-bmw-blue' : 'text-ink-faint group-hover:text-ink-muted')} />
                  {to === '/messages' && <CountBadge n={unread} className="-right-2 -top-2 lg:hidden" />}
                </span>
                <span className="hidden truncate lg:inline">{label}</span>
                {to === '/messages' && unread > 0 && (
                  <span className="ml-auto hidden rounded-full bg-hot px-2 py-0.5 text-[11px] font-bold text-hot-on lg:inline">{unread}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
        {isStaff && (
          <NavLink
            to="/admin"
            title="Admin"
            className="group relative mt-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-gold/40 bg-gold-light/60 px-3 font-display text-[15px] font-semibold text-gold-dark transition-colors hover:bg-gold-light"
          >
            <ShieldCheck size={19} className="shrink-0" />
            <span className="hidden truncate lg:inline">Admin</span>
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border p-3 lg:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bmw-blue font-display text-sm font-bold text-white">
            {member?.initials ?? '··'}
          </span>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-ink">{member?.name ?? MEMBER_PROFILE.name}</p>
            <p className="truncate font-mono text-[11px] text-ink-faint">{MEMBER_PROFILE.membershipNumber}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          title="Sign out"
          className="mt-3 flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-50 hover:text-ink"
        >
          <LogOut size={17} />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </div>
  );
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell size={20} />
          {unread > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-navbar bg-hot" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-16px))] rounded-2xl p-2">
        <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5 font-display text-base font-bold">
          Notifications
          {unread > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                markRead().catch(() => {});
              }}
              className="flex min-h-[36px] items-center gap-1 text-xs font-semibold text-bmw-blue hover:underline"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NOTIFICATIONS.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-muted">You're all caught up.</p>}
        <div className="max-h-[60vh] overflow-y-auto">
          {NOTIFICATIONS.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => {
                if (n.unread) markRead(n.id).catch(() => {});
                if (n.link) navigate(n.link);
              }}
              className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5"
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
  );
}

function AccountMenu() {
  const { member, signOut, isStaff } = useAuth();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-11 items-center gap-2 rounded-full pl-1 pr-1 transition-colors hover:bg-slate-100 sm:pr-3" aria-label="Account menu">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bmw-blue font-display text-[13px] font-bold text-white">
            {member?.initials ?? '··'}
          </span>
          <span className="hidden text-sm font-semibold text-ink sm:inline">{member?.firstName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5">
          <span className="block text-sm font-semibold">{member?.name}</span>
          <span className="block truncate text-xs font-normal text-ink-muted">{member?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[
          { to: '/profile', label: 'My profile', icon: User },
          { to: '/podium', label: 'Podium · Car of the Month', icon: Trophy },
          { to: '/map', label: 'Global map', icon: Globe },
          { to: '/settings', label: 'Account settings', icon: SettingsIcon },
        ].map((i) => (
          <DropdownMenuItem key={i.to} onClick={() => navigate(i.to)} className="min-h-[44px] cursor-pointer gap-2.5 rounded-xl">
            <i.icon size={16} /> {i.label}
          </DropdownMenuItem>
        ))}
        {isStaff && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="min-h-[44px] cursor-pointer gap-2.5 rounded-xl text-gold-dark">
            <ShieldCheck size={16} /> Admin dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="min-h-[44px] cursor-pointer gap-2.5 rounded-xl text-danger focus:text-danger"
        >
          <LogOut size={16} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Post-login app shell: tab bar on phones, icon rail on tablets, full sidebar on desktop. */
export default function Layout() {
  const location = useLocation();
  const { member } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  useStore();
  useChatBadgePolling(!!member);
  const { unread: chatUnread } = useChatCounts();
  const title = location.pathname.startsWith('/garage/')
    ? 'Car'
    : location.pathname.startsWith('/messages/')
      ? 'Chat'
      : (TITLES[location.pathname] ?? SETTINGS.club?.name ?? 'MFlight');
  const immersive = IMMERSIVE.some((r) => r.test(location.pathname));

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

  // Scroll to top on screen change (native feel).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-[100dvh] bg-bg-app text-ink">
      {/* Icon rail on tablets (md), full sidebar on desktop (lg) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] md:block lg:w-[256px]">
        <SidebarContent />
      </aside>

      <div className="md:pl-[76px] lg:pl-[256px]">
        <header
          className={cn(
            'sticky top-0 z-30 border-b border-border bg-navbar/95 pt-safe backdrop-blur-xl',
            immersive && 'hidden md:block',
          )}
        >
          <div className="flex h-14 items-center gap-1 px-3 sm:h-16 sm:gap-2 sm:px-6">
            <Link to="/dashboard" className="flex items-center gap-2 md:hidden" aria-label="Paddock">
              <StripeMark />
            </Link>
            <h1 className="ml-1 min-w-0 truncate pr-1.5 font-race text-[26px] uppercase leading-none text-ink sm:text-[28px] md:ml-0">{title}</h1>

            <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
              <MembershipPlate number={MEMBER_PROFILE.membershipNumber} size="sm" className="mr-2 hidden xl:inline-flex" />
              <ThemeToggle />
              <Link
                to="/messages"
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
                aria-label={`Messages${chatUnread ? `, ${chatUnread} unread` : ''}`}
              >
                <MessageCircle size={20} />
                <CountBadge n={chatUnread} className="right-0.5 top-0.5" />
              </Link>
              <NotificationsMenu />
              <AccountMenu />
            </div>
          </div>

          {MEMBER_PROFILE.status === 'Pending' && (
            <div className="border-t border-gold/30 bg-gold-light/70 px-4 py-2.5 text-center text-[13px] font-medium text-gold-dark sm:px-6">
              Your membership is awaiting approval by the club. You can browse, but some actions may be limited.
            </div>
          )}
          {!MEMBER_PROFILE.emailVerified && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-bmw-blue/20 bg-bmw-blue-light px-4 py-2 text-[13px] font-medium text-ink sm:px-6">
              Please confirm your email address.
              <button
                className="min-h-[32px] font-bold text-bmw-blue underline"
                onClick={() =>
                  api
                    .post('/auth/resend-verification')
                    .then(() => toast('Verification email sent.', { variant: 'success' }))
                    .catch((e) => toast((e as Error).message))
                }
              >
                Resend email
              </button>
            </div>
          )}
        </header>

        <main
          className={cn(
            'mx-auto w-full max-w-[1280px]',
            immersive ? 'md:px-6 md:py-6' : 'px-3 pb-[calc(96px+var(--safe-bottom))] pt-4 sm:px-6 sm:pt-6 md:pb-10',
          )}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {!immersive && <BottomTabs />}
    </div>
  );
}
