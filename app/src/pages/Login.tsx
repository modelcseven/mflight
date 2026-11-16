import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Lock, Mail } from 'lucide-react';
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

const OAUTH_MESSAGES: Record<string, string> = {
  failed: 'Social sign-in failed. Please try again.',
  cancelled: 'Social sign-in was cancelled.',
  disabled: 'That sign-in option is not enabled.',
  closed: 'New sign-ups are closed. Contact the club to join.',
  noemail: 'Your social account did not share an email address. Sign up with email instead.',
  suspended: 'This account is suspended. Contact the club for help.',
  totp: 'Your account uses two-step verification. Sign in with your email and password.',
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const o = params.get('oauth');
    if (o && OAUTH_MESSAGES[o]) setFormError(OAUTH_MESSAGES[o]);
    if (params.get('verified') === '0') setFormError('That verification link is invalid or has expired.');
  }, [params]);

  const from = (location.state as { from?: string } | null)?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Enter your password';
    if (needCode && !/^\d{6}$/.test(code.replace(/\s/g, ''))) next.code = 'Enter the 6-digit code';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) {
      setShakeKey((k) => k + 1);
      return;
    }
    setLoading(true);
    try {
      const r = await signIn(email, password, needCode ? code : undefined);
      if ('needTotp' in r) {
        setNeedCode(true);
        setLoading(false);
        return;
      }
      toast(`Welcome back, ${r.firstName}`, { variant: 'success' });
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (err) {
      setFormError((err as Error).message);
      setShakeKey((k) => k + 1);
      setLoading(false);
    }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show">
      <Emblem />
      <AuthHeading title={`Welcome to ${SETTINGS.club?.name ?? 'MFlight'}`} subtitle={needCode ? 'Enter your two-step code' : 'Sign in to continue'} />

      {!needCode && <SocialButtons disabled={loading} />}
      <FormError message={formError} />

      <ShakeOnError shakeKey={shakeKey}>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {!needCode ? (
            <>
              <AuthField label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={setEmail}
                error={errors.email} autoComplete="email" />
              <AuthField label="Password" placeholder="••••••••" icon={Lock} value={password} onChange={setPassword}
                error={errors.password} isPassword autoComplete="current-password" />
            </>
          ) : (
            <AuthField label="Authenticator code" placeholder="123 456" icon={KeyRound} value={code} onChange={setCode}
              error={errors.code} autoComplete="one-time-code" />
          )}
          <motion.div variants={staggerItem} className="pt-2">
            <PrimaryButton loading={loading}>{needCode ? 'Verify and sign in' : 'Sign in'}</PrimaryButton>
          </motion.div>
          {needCode && (
            <button type="button" onClick={() => { setNeedCode(false); setCode(''); }}
              className="w-full text-center text-[13px] text-ink-muted hover:text-ink">
              Use a different account
            </button>
          )}
        </form>
      </ShakeOnError>

      <motion.div variants={staggerItem} className="mt-6 flex items-center justify-between text-[13px]">
        <Link to="/forgot-password" className="text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline">
          Forgot password?
        </Link>
        {SETTINGS.auth?.allowSignup !== false && (
          <p className="text-ink-muted">
            Need an account?{' '}
            <Link to="/signup" className="font-semibold text-ink transition-colors hover:text-bmw-blue">
              Sign up
            </Link>
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
