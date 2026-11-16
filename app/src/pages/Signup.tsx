import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { SETTINGS } from '@/lib/data';
import {
  AuthField,
  AuthHeading,
  EMAIL_RE,
  Emblem,
  FormError,
  PrimaryButton,
  ShakeOnError,
  SocialButtons,
  staggerContainer,
  staggerItem,
} from '@/components/AuthShared';

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  if (SETTINGS.auth && !SETTINGS.auth.allowSignup) {
    return (
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="text-center">
        <Emblem />
        <AuthHeading title="Membership by invitation" subtitle="New sign-ups are currently closed." />
        <p className="mt-6 text-sm text-ink-muted">
          Contact the club at <span className="font-medium text-ink">{SETTINGS.club?.contactEmail}</span> to request membership.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-ink hover:text-bmw-blue">Back to sign in</Link>
      </motion.div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name';
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address';
    if (password.length < 8) next.password = 'Password must be at least 8 characters';
    if (confirm !== password || !confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) {
      setShakeKey((k) => k + 1);
      return;
    }
    setLoading(true);
    const [firstName, ...rest] = name.trim().split(/\s+/);
    try {
      const m = await signUp({ firstName, lastName: rest.join(' '), email, password });
      toast(`Account created — welcome to the club, ${m.firstName}`, { variant: 'success' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError((err as Error).message);
      setShakeKey((k) => k + 1);
      setLoading(false);
    }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show">
      <Emblem />
      <AuthHeading title={`Join ${SETTINGS.club?.name ?? 'MFlight'}`} subtitle="Create your member account" />
      <SocialButtons disabled={loading} />
      <FormError message={formError} />
      <ShakeOnError shakeKey={shakeKey}>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <AuthField label="Full name" placeholder="Alex Berger" icon={User} value={name} onChange={setName} error={errors.name} autoComplete="name" />
          <AuthField label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
          <AuthField label="Password" placeholder="At least 8 characters" icon={Lock} value={password} onChange={setPassword} error={errors.password} isPassword autoComplete="new-password" />
          <AuthField label="Confirm password" placeholder="••••••••" icon={Lock} value={confirm} onChange={setConfirm} error={errors.confirm} isPassword autoComplete="new-password" />
          <motion.div variants={staggerItem} className="pt-2">
            <PrimaryButton loading={loading}>Create account</PrimaryButton>
          </motion.div>
        </form>
      </ShakeOnError>
      <motion.div variants={staggerItem} className="mt-6 text-center text-[13px] text-ink-muted">
        Already a member?{' '}
        <Link to="/login" className="font-semibold text-ink transition-colors hover:text-bmw-blue">Sign in</Link>
      </motion.div>
    </motion.div>
  );
}
