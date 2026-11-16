import { useState } from 'react';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, MailCheck } from 'lucide-react';
import {
  AuthField,
  AuthHeading,
  EMAIL_RE,
  Emblem,
  PrimaryButton,
  ShakeOnError,
  staggerContainer,
  staggerItem,
} from '@/components/AuthShared';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address');
      setShakeKey((k) => k + 1);
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.post('/auth/forgot', { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="py-4 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bmw-blue-light">
            <MailCheck size={28} className="text-bmw-blue" />
          </div>
          <h1 className="mt-6 font-display text-[28px] font-extrabold tracking-[-0.02em] text-ink">
            Check your inbox
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link is on its
            way.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-sm font-semibold text-ink transition-colors hover:text-bmw-blue"
          >
            Back to sign in
          </Link>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
        >
          <Emblem />
          <AuthHeading title="Reset password" subtitle="We'll email you a reset link" />
          <ShakeOnError shakeKey={shakeKey}>
            <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
              <AuthField
                label="Email"
                type="email"
                placeholder="you@example.com"
                icon={Mail}
                value={email}
                onChange={setEmail}
                error={error}
                autoComplete="email"
              />
              <motion.div variants={staggerItem} className="pt-2">
                <PrimaryButton loading={loading}>Send reset link</PrimaryButton>
              </motion.div>
            </form>
          </ShakeOnError>
          <motion.div variants={staggerItem} className="mt-6 text-center text-[13px] text-ink-muted">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-ink transition-colors hover:text-bmw-blue">
              Sign in
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
