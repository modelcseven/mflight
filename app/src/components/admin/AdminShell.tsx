import { logoUrl } from '@/lib/store';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { MEMBER_PROFILE, SETTINGS } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { SectionDef } from '@/pages/Admin';

/** Standalone admin shell: top bar + left section nav (drawer on mobile). */
export default function AdminShell({ sections, children }: { sections: SectionDef[]; children: React.ReactNode }) {
  const { member, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-1" aria-label="Admin sections">
      {sections.map(({ id, label, icon: Icon }) => (
        <NavLink
          key={id}
          to={`/admin/${id}`}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-display text-sm font-semibold transition-colors',
              isActive ? 'bg-bmw-blue-light text-bmw-blue' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
            )
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-bg-app">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 lg:hidden" aria-label="Open admin menu">
            <Menu size={20} />
          </button>
          <img src={logoUrl()} alt="" className="h-9 w-9 shrink-0" />
          <p className="font-display text-lg font-extrabold leading-none tracking-tight text-ink">
            {SETTINGS.club?.name ?? 'MFlight'} <span className="text-bmw-blue">Admin</span>
          </p>
          <span className="hidden rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white sm:inline">
            {MEMBER_PROFILE.roleLabel}
            {MEMBER_PROFILE.role === 'chapter_lead' && MEMBER_PROFILE.chapterCountry ? ` · ${MEMBER_PROFILE.chapterCountry}` : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to club</span>
            </Link>
            <span className="hidden text-sm font-semibold text-ink md:inline">{member?.name}</span>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="rounded-lg p-2 text-ink-muted hover:bg-slate-100 hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-dark/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-white p-4 shadow-xl">
            <button onClick={() => setOpen(false)} className="mb-3 rounded-lg p-2 text-ink-muted hover:bg-slate-100" aria-label="Close menu">
              <X size={18} />
            </button>
            {nav}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px] gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">{nav}</div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
