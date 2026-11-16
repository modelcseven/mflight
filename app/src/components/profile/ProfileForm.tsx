import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, PencilLine, Save } from 'lucide-react';
import { MEMBER_PROFILE } from '@/lib/data';
import type { MemberProfile } from '@/lib/data';
import { api } from '@/lib/api';
import { setProfile } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Draft {
  firstName: string;
  lastName: string;
  location: string;
  phone: string;
  bio: string;
}

const fromProfile = (): Draft => ({
  firstName: MEMBER_PROFILE.firstName,
  lastName: MEMBER_PROFILE.lastName,
  location: MEMBER_PROFILE.location,
  phone: MEMBER_PROFILE.phone,
  bio: MEMBER_PROFILE.bio,
});

/** Edit-profile card: saves to the member record via PATCH /api/me. */
export default function ProfileForm() {
  const { toast } = useToast();
  const { setUser } = useAuth();
  const [base, setBase] = useState<Draft>(fromProfile);
  const [draft, setDraft] = useState<Draft>(fromProfile);
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== base[k]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.firstName.trim()) {
      toast('First name is required.');
      return;
    }
    setSaving(true);
    try {
      const r = await api.patch<{ user: MemberProfile }>('/me', draft);
      setProfile(r.user);
      setUser(r.user);
      setBase(fromProfile());
      setDraft(fromProfile());
      toast('Your profile details were updated.', { title: 'Profile saved', variant: 'success' });
    } catch (err) {
      toast((err as Error).message, { title: 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof Draft) => ({
    value: draft[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
          <PencilLine size={16} />
        </span>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">Edit Profile</h2>
      </header>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-first" className="text-[13px] text-ink-muted">First name</Label>
            <Input id="profile-first" {...field('firstName')} className="rounded-xl" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-last" className="text-[13px] text-ink-muted">Last name</Label>
            <Input id="profile-last" {...field('lastName')} className="rounded-xl" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-location" className="text-[13px] text-ink-muted">Location</Label>
            <Input id="profile-location" {...field('location')} placeholder="City, Country" className="rounded-xl" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-[13px] text-ink-muted">Phone</Label>
            <Input id="profile-phone" type="tel" {...field('phone')} placeholder="+49 …" className="rounded-xl" maxLength={40} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-bio" className="text-[13px] text-ink-muted">Bio</Label>
          <Textarea id="profile-bio" {...field('bio')} placeholder="Tell the club about your cars and driving…"
            className="min-h-[96px] resize-y rounded-xl" maxLength={600} />
          <p className="text-right font-mono text-[11px] tabular-nums text-ink-faint">{draft.bio.length}/600</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={!dirty || saving}
            className="gap-2 rounded-xl bg-bmw-blue font-display font-bold text-white hover:bg-bmw-blue-dark disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save changes
          </Button>
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => setDraft(base)} className="rounded-xl text-ink-muted hover:text-ink">
              Discard
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
