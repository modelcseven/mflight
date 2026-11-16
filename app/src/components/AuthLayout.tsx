import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SETTINGS } from '@/lib/data';

/**
 * Pre-login centered shell: full-viewport BMW M race car backdrop behind the
 * floating white auth card (max-w-420px, elevated shadow). The image background
 * applies to ALL auth routes (/login, /signup, /forgot-password) — no exception.
 * Card content crossfades between routes via AnimatePresence.
 */
/** Keeps each animated card bound to the route it was created for (prevents remounting mid-transition). */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

export default function AuthLayout() {
  const location = useLocation();
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-ink-dark p-4">
      {/* BMW M race car backdrop, cover-fitted with readability scrim */}
      <motion.img
        key="auth-bg"
        src={`${import.meta.env.BASE_URL}signup-bg.jpg`}
        alt=""
        aria-hidden
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="pointer-events-none fixed inset-0 h-full w-full object-cover object-[center_30%]"
      />
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg, rgba(3,7,18,0.55) 0%, rgba(3,7,18,0.35) 40%, rgba(3,7,18,0.65) 100%)',
        }}
      />
      <div className="relative w-full max-w-[420px]">
        <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
          <div className="relative w-full rounded-2xl bg-white p-7 shadow-elevated sm:p-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut', delay: 0.06 }}
              >
                <FrozenOutlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
        <p className="mt-6 text-center text-xs text-white/70">{SETTINGS.club?.clubName ?? 'BMW Car Club Europe'} · Members only</p>
      </div>
    </div>
  );
}
