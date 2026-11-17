import { logoUrl } from '@/lib/store';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, LogOut, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { MEMBER_PROFILE, SETTINGS } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { SectionDef } from '@/pages/Admin';
import { StripeMark, ThemeToggle } from '@/components/shell/ShellBits';

/**
 * Admin shell.
 * Phones: compact header + a swipeable section bar (always one thumb-tap away) and an "All sections" sheet.
 * Tablet/desktop: left section rail.
 */
export default function AdminShell({ sections, children }: { sections: SectionDef[]; children: React.ReactNode }) {
  const { member, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the active section chip in view on phones.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
    setOpen(false);
  }, [location.pathname]);

  const nav = (
    <nav className="space-y-1" aria-label="Admin sections">
      {sections.map(({ id, label, icon: Icon }) => (
        <NavLink
          key={id}
          to={`/admin/${id}`}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 font-display text-[15px] font-semibold transition-colors',
              isActive ? 'bg-bmw-blue-light text-ink' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={18} className={isActive ? 'text-bmw-blue' : ''} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-bg-app text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-navbar/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-2 sm:h-16 sm:gap-3 sm:px-6">
          <Link
            to="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-slate-100 hover:text-ink sm:w-auto sm:gap-1.5 sm:px-3"
            aria-label="Back to the club"
          >
            <ArrowLeft size={19} />
            <span className="hidden text-sm font-semibold sm:inline">Club</span>
          </Link>
          <img src={logoUrl()} alt="" className="hidden h-9 w-9 shrink-0 sm:block" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-race text-[22px] uppercase leading-none text-ink sm:text-2xl">
              <StripeMark size="sm" className="sm:hidden" />
              {SETTINGS.club?.name ?? 'MFlight'} <span className="text-bmw-blue">Admin</span>
            </p>
            <p className="mt-0.5 hidden text-[10px] font-bold uppercase tracking-[0.14em] text-gold-dark sm:block">
              {MEMBER_PROFILE.roleLabel}
              {MEMBER_PROFILE.role === 'chapter_lead' && MEMBER_PROFILE.chapterCountry ? ` · ${MEMBER_PROFILE.chapterCountry}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
            <span className="hidden text-sm font-semibold text-ink md:inline">{member?.name}</span>
            <ThemeToggle />
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-slate-100 hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Phone/tablet section bar */}
        <div className="flex items-center gap-1 border-t border-border lg:hidden">
          <div ref={stripRef} className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-2 py-2">
            {sections.map(({ id, label, icon: Icon }) => (
              <NavLink
                key={id}
                to={`/admin/${id}`}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                    isActive ? 'bg-bmw-blue text-white' : 'border border-border bg-surface text-ink-muted',
                  )
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink"
            aria-label="All admin sections"
          >
            <LayoutGrid size={17} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-4 pb-[calc(16px+var(--safe-bottom))] pt-3">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
            <div className="mb-2 flex items-center justify-between">
              <p className="font-race text-2xl uppercase text-ink">Admin sections</p>
              <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px] gap-8 px-3 pb-[calc(32px+var(--safe-bottom))] pt-4 sm:px-6 sm:py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">{nav}</div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
