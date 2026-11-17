import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { CarFront, Flag, Home, ImagePlus, Plus, ShoppingBag, Tag, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/dashboard', label: 'Paddock', icon: Home },
  { to: '/events', label: 'Grid', icon: Flag },
  null,
  { to: '/garage', label: 'Garage', icon: CarFront },
  { to: '/parts', label: 'MFlight', icon: ShoppingBag },
] as const;

/** Phone tab bar: thumb-reach navigation with a raised “create” button in the middle. */
export default function BottomTabs() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-navbar/95 pb-safe backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex h-[62px] max-w-xl items-start justify-around px-1 pt-1.5">
          {TABS.map((t, i) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-[52px] w-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors',
                    isActive ? 'text-ink' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="tab-active"
                        className="absolute -top-1.5 h-[3px] w-7 rounded-full bg-sky"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <t.icon size={23} strokeWidth={isActive ? 2.4 : 2} />
                    {t.label}
                  </>
                )}
              </NavLink>
            ) : (
              <button
                key={`create-${i}`}
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Create"
                className="-mt-4 flex h-14 w-14 -skew-x-[8deg] items-center justify-center rounded-[18px] bg-hot text-hot-on shadow-[0_8px_22px_-6px_rgb(var(--hot)/0.6)] transition-transform active:scale-95"
              >
                <Plus size={27} strokeWidth={2.6} className="skew-x-[8deg]" />
              </button>
            ),
          )}
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-surface px-4 pb-[calc(20px+var(--safe-bottom))] pt-3 [&>button]:hidden">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="font-race text-2xl uppercase">Create</SheetTitle>
            <SheetDescription className="text-ink-muted">Share with the club.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {[
              { label: 'New post', hint: 'Text, photo or an event shout-out', icon: ImagePlus, to: '/dashboard?compose=1' },
              { label: 'Add a car to my garage', hint: 'Specs, mods and photos', icon: CarFront, to: '/garage?add=1' },
              { label: 'Sell a part or car', hint: 'List it in the MFlight store', icon: Tag, to: '/parts?sell=1' },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => go(a.to)}
                className="flex min-h-[60px] items-center gap-3.5 rounded-2xl border border-border bg-surface-2 px-4 text-left transition-colors active:bg-bmw-blue-light"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bmw-blue text-white">
                  <a.icon size={20} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{a.label}</span>
                  <span className="block text-[13px] text-ink-muted">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-ink-muted"
          >
            <X size={18} /> Cancel
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
