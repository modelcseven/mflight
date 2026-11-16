import { logoUrl } from '@/lib/store';
import { useState } from 'react';
import { SETTINGS } from '@/lib/data';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Stagger variants per login.md §Animations: children 0.07s, y 12→0, 300ms, start 350ms. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function Emblem() {
  return (
    <motion.div
      initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.25 }}
      className="flex justify-center"
    >
      <motion.img
        src={logoUrl()}
        alt="BMW Car Club Europe emblem"
        className="h-[88px] w-[88px]"
        style={{ filter: 'drop-shadow(0 6px 16px rgba(10,15,30,0.18))' }}
        whileHover={{ rotate: 360 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <motion.h1
        variants={staggerItem}
        className="mt-6 text-center font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink"
      >
        {title}
      </motion.h1>
      <motion.p variants={staggerItem} className="mt-1.5 text-center text-sm text-ink-muted">
        {subtitle}
      </motion.p>
    </>
  );
}

export function SocialButton({
  icon,
  label,
  onClick,
  loading,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.98 }}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-[15px] font-medium text-ink transition-colors duration-150 hover:border-[#C9CEDA] hover:bg-[#FBFBFD] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin text-ink-muted" />
      ) : (
        <img src={icon} alt="" className="h-5 w-5" />
      )}
      {label}
    </motion.button>
  );
}

export function OrDivider() {
  return (
    <motion.div variants={staggerItem} className="relative mt-6">
      <div className="border-t border-border" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs uppercase tracking-[0.12em] text-ink-faint">
        OR
      </span>
    </motion.div>
  );
}

export function AuthField({
  label,
  type = 'text',
  placeholder,
  icon: Icon,
  value,
  onChange,
  error,
  isPassword = false,
  autoComplete,
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  isPassword?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const actualType = isPassword ? (show ? 'text' : 'password') : type;
  return (
    <motion.div variants={staggerItem}>
      <label className="mb-1.5 block text-center text-[13px] font-semibold text-ink">{label}</label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type={actualType}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-12 w-full rounded-xl border bg-white pl-11 pr-11 text-[15px] text-ink outline-none transition-all duration-150 placeholder:text-ink-faint',
            'focus:border-bmw-blue focus:ring-[3px] focus:ring-bmw-blue/15',
            error ? 'border-danger' : 'border-border',
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink-muted"
            aria-label={show ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-center text-xs text-danger">{error}</p>}
    </motion.div>
  );
}

export function PrimaryButton({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.98 }}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-bmw-blue text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-bmw-blue-dark disabled:opacity-70"
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : children}
    </motion.button>
  );
}

/** Shake keyframes on validation failure (login.md §6: x 0→-6→6→-3→0, 300ms). */
export function ShakeOnError({ shakeKey, children }: { shakeKey: number; children: ReactNode }) {
  return (
    <motion.div
      key={shakeKey}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: shakeKey > 0 ? 0 : 0.3 } } }}
      initial={shakeKey > 0 ? 'show' : 'hidden'}
      animate={shakeKey > 0 ? { x: [0, -6, 6, -3, 0] } : 'show'}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Google / Facebook buttons — shown only when the provider is configured in admin settings. */
export function SocialButtons({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const providers = [
    { id: 'google', label: 'Continue with Google', icon: 'google-g.svg', on: SETTINGS.auth?.google },
    { id: 'facebook', label: 'Continue with Facebook', icon: 'facebook-f.svg', on: SETTINGS.auth?.facebook },
  ].filter((p) => p.on);
  if (!providers.length) return null;
  return (
    <>
      <motion.div variants={staggerItem} className="mt-8 space-y-3">
        {providers.map((p) => (
          <SocialButton
            key={p.id}
            icon={`${import.meta.env.BASE_URL}${p.icon}`}
            label={p.label}
            loading={loading === p.id}
            disabled={disabled || loading !== null}
            onClick={() => {
              setLoading(p.id);
              window.location.href = `/api/auth/oauth/${p.id}/start`;
            }}
          />
        ))}
      </motion.div>
      <OrDivider />
    </>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="mt-6 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-center text-[13px] font-medium text-danger"
    >
      {message}
    </motion.p>
  );
}
