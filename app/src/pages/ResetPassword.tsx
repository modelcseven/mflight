import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  AuthField, AuthHeading, Emblem, FormError, PrimaryButton, ShakeOnError, staggerContainer, staggerItem,
} from '@/components/AuthShared';

/** Landing page for password-reset and invitation links (/reset-password?token=…). */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { reload } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(token ? null : 'This link is missing its token. Request a new one.');
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = 'At least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) {
      setShakeKey((k) => k + 1);
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await api.post('/auth/reset', { token, password });
      await reload();
      toast('Password saved — you are signed in.', { variant: 'success' });
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
      <AuthHeading title="Set your password" subtitle="Choose a new password for your account" />
      <FormError message={formError} />
      <ShakeOnError shakeKey={shakeKey}>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <AuthField label="New password" placeholder="At least 8 characters" icon={Lock} value={password} onChange={setPassword} error={errors.password} isPassword autoComplete="new-password" />
          <AuthField label="Confirm password" placeholder="••••••••" icon={Lock} value={confirm} onChange={setConfirm} error={errors.confirm} isPassword autoComplete="new-password" />
          <motion.div variants={staggerItem} className="pt-2">
            <PrimaryButton loading={loading}>Save password</PrimaryButton>
          </motion.div>
        </form>
      </ShakeOnError>
      <motion.div variants={staggerItem} className="mt-6 text-center text-[13px] text-ink-muted">
        <Link to="/forgot-password" className="font-semibold text-ink hover:text-bmw-blue">Request a new link</Link>
      </motion.div>
    </motion.div>
  );
}
