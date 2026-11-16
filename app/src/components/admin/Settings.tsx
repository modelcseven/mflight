import { useEffect, useState } from 'react';
import { Copy, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api, uploadImage } from '@/lib/api';
import { MEMBER_PROFILE, eur } from '@/lib/data';
import { refresh } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/Confirm';
import { Btn, Chip, ErrorBox, Field, Loading, Modal, PageHeader, Panel, Table, Toggle, inputCls, td, useAdminData } from './ui';

type Val = string | number | boolean | string[];
type Section = Record<string, Val>;
interface Tier { id: string; name: string; priceYearly: number; benefits: string[]; color: string; sort: number; isDefault: boolean }
interface Geo { isoA3: string; isoN: string; name: string; members: number; chapters: number; continent: string; growth: number }
interface City { id: number; city: string; country: string; members: number; lon: number; lat: number }
interface SettingsData {
  settings: Record<string, Section>;
  superOnly: string[];
  tiers: Tier[];
  tierCounts: Record<string, number>;
  geo: Geo[];
  cities: City[];
  oauthRedirects: { google: string; facebook: string; stripeWebhook: string };
}

type FieldDef =
  | { key: string; label: string; type: 'text' | 'email' | 'url' | 'password' | 'color'; hint?: string; placeholder?: string }
  | { key: string; label: string; type: 'number'; hint?: string; min?: number }
  | { key: string; label: string; type: 'bool'; hint?: string }
  | { key: string; label: string; type: 'list'; hint?: string }
  | { key: string; label: string; type: 'image'; hint?: string };

const SCHEMAS: Record<string, { title: string; description: string; fields: FieldDef[] }> = {
  club: {
    title: 'Club & branding',
    description: 'Names and contact details shown across the site.',
    fields: [
      { key: 'name', label: 'App name', type: 'text' },
      { key: 'clubName', label: 'Club name', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'contactEmail', label: 'Contact email', type: 'email' },
      { key: 'currency', label: 'Currency (ISO code)', type: 'text', hint: 'e.g. EUR, USD, GBP' },
      { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'Europe/Berlin' },
      { key: 'supportUrl', label: 'Support / help URL', type: 'url' },
      { key: 'primaryColor', label: 'Primary colour', type: 'color' },
      { key: 'accentColor', label: 'Accent colour', type: 'color' },
      { key: 'logoUrl', label: 'Logo', type: 'image', hint: 'Square image, at least 256 px.' },
    ],
  },
  membership: {
    title: 'Membership rules',
    description: 'Renewals and membership numbers.',
    fields: [
      { key: 'numberPrefix', label: 'Membership number prefix', type: 'text', hint: 'New members get the next number, e.g. MFC-00042.' },
      { key: 'renewalReminderDays', label: 'Renewal reminder (days before expiry)', type: 'number', min: 0 },
      { key: 'gracePeriodDays', label: 'Grace period after expiry (days)', type: 'number', min: 0 },
      { key: 'autoSuspendExpired', label: 'Suspend members after the grace period', type: 'bool' },
    ],
  },
  events: {
    title: 'Events',
    description: 'Defaults for new events and RSVPs.',
    fields: [
      { key: 'categories', label: 'Event categories (one per line)', type: 'list' },
      { key: 'defaultCapacity', label: 'Default capacity', type: 'number', min: 1 },
      { key: 'maxGuests', label: 'Max guests per RSVP', type: 'number', min: 0 },
      { key: 'maxCars', label: 'Max cars per RSVP', type: 'number', min: 0 },
      { key: 'enableWaitlist', label: 'Waitlist when full', type: 'bool', hint: 'Waitlisted members are promoted automatically when places open.' },
    ],
  },
  marketplace: {
    title: 'Marketplace',
    description: 'Rules for the member Part Store.',
    fields: [
      { key: 'requireApproval', label: 'New listings need moderator approval', type: 'bool' },
      { key: 'feePercent', label: 'Club fee on sales (%)', type: 'number', min: 0, hint: 'Shown to sellers when they list.' },
      { key: 'maxActivePerMember', label: 'Max active listings per member', type: 'number', min: 1 },
      { key: 'categories', label: 'Categories (one per line)', type: 'list' },
      { key: 'conditions', label: 'Conditions (one per line)', type: 'list' },
    ],
  },
  auth: {
    title: 'Sign-in & registration',
    description: 'Who can join and how members sign in.',
    fields: [
      { key: 'allowSignup', label: 'Allow new sign-ups', type: 'bool', hint: 'When off, only admins can add members.' },
      { key: 'requireApproval', label: 'New members need approval', type: 'bool', hint: 'New accounts start as Pending until approved under Members.' },
      { key: 'requireEmailVerification', label: 'Require email confirmation', type: 'bool', hint: 'Needs Email (SMTP) to be set up.' },
      { key: 'googleEnabled', label: 'Sign in with Google', type: 'bool' },
      { key: 'googleClientId', label: 'Google client ID', type: 'text' },
      { key: 'googleClientSecret', label: 'Google client secret', type: 'password' },
      { key: 'facebookEnabled', label: 'Sign in with Facebook', type: 'bool' },
      { key: 'facebookAppId', label: 'Facebook app ID', type: 'text' },
      { key: 'facebookAppSecret', label: 'Facebook app secret', type: 'password' },
    ],
  },
  smtp: {
    title: 'Email (SMTP)',
    description: 'Used for password resets, invitations, confirmations and announcements.',
    fields: [
      { key: 'enabled', label: 'Send email', type: 'bool' },
      { key: 'host', label: 'SMTP host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', min: 1 },
      { key: 'secure', label: 'Use TLS (port 465)', type: 'bool' },
      { key: 'user', label: 'Username', type: 'text' },
      { key: 'pass', label: 'Password / app password', type: 'password' },
      { key: 'from', label: 'From address', type: 'text', placeholder: 'MFlight <no-reply@yourdomain.com>' },
    ],
  },
  stripe: {
    title: 'Payments (Stripe)',
    description: 'Take card payments for events, memberships and marketplace items.',
    fields: [
      { key: 'enabled', label: 'Accept online payments', type: 'bool' },
      { key: 'publishableKey', label: 'Publishable key', type: 'text', placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret key', type: 'password', placeholder: 'sk_live_…' },
      { key: 'webhookSecret', label: 'Webhook signing secret', type: 'password', placeholder: 'whsec_…' },
    ],
  },
  ai: {
    title: 'AI',
    description: 'Any OpenAI-compatible endpoint (OpenAI, your own model server, LM Studio…). Powers Garage AI insights.',
    fields: [
      { key: 'enabled', label: 'Enable AI features', type: 'bool' },
      { key: 'baseUrl', label: 'API base URL', type: 'url', placeholder: 'https://api.openai.com/v1' },
      { key: 'apiKey', label: 'API key', type: 'password' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
  },
};

const TABS = [
  { id: 'club', label: 'Club & branding' },
  { id: 'tiers', label: 'Membership & tiers' },
  { id: 'events', label: 'Events' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'geo', label: 'Chapters & map' },
  { id: 'auth', label: 'Sign-in', superOnly: true },
  { id: 'smtp', label: 'Email', superOnly: true },
  { id: 'stripe', label: 'Payments', superOnly: true },
  { id: 'ai', label: 'AI', superOnly: true },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input readOnly value={value} className={cn(inputCls, 'font-mono text-xs')} onFocus={(e) => e.target.select()} />
        <Btn tone="ghost" onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied.'))} aria-label={`Copy ${label}`}><Copy size={14} /></Btn>
      </div>
    </Field>
  );
}

function SectionForm({ sectionKey, value, onSaved, extra }: { sectionKey: string; value: Section; onSaved: (v: Section) => void; extra?: React.ReactNode }) {
  const { toast } = useToast();
  const schema = SCHEMAS[sectionKey];
  const [draft, setDraft] = useState<Section>(value);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put<{ value: Section }>(`/admin/settings/${sectionKey}`, draft);
      onSaved(r.value);
      refresh().catch(() => {});
      toast(`${schema.title} saved.`, { variant: 'success' });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={schema.title} actions={<Btn busy={busy} disabled={!dirty} onClick={save}><Save size={14} /> Save</Btn>}>
      <p className="mb-4 text-[13px] text-ink-muted">{schema.description}</p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
        {schema.fields.map((f) => {
          const v = draft[f.key];
          const set = (nv: Val) => setDraft((d) => ({ ...d, [f.key]: nv }));
          if (f.type === 'bool') return <div key={f.key} className="md:col-span-2"><Toggle checked={!!v} onChange={set} label={f.label} hint={f.hint} /></div>;
          if (f.type === 'list')
            return (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <textarea rows={5} value={(v as string[]).join('\n')} onChange={(e) => set(e.target.value.split('\n'))}
                  onBlur={(e) => set(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} className={cn(inputCls, 'h-auto py-2')} />
              </Field>
            );
          if (f.type === 'image')
            return (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-ink-muted hover:border-bmw-blue">
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : v ? <img src={String(v)} alt="" className="h-7 w-7 rounded object-contain" /> : null}
                  Upload new
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try { set(await uploadImage(file)); } catch (err) { toast((err as Error).message); } finally { setUploading(false); }
                  }} />
                </label>
              </Field>
            );
          if (f.type === 'number')
            return <Field key={f.key} label={f.label} hint={f.hint}><input type="number" min={f.min} value={Number(v)} onChange={(e) => set(Number(e.target.value))} className={inputCls} /></Field>;
          if (f.type === 'color')
            return (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <div className="flex gap-2">
                  <input type="color" value={String(v)} onChange={(e) => set(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-white p-1" />
                  <input value={String(v)} onChange={(e) => set(e.target.value)} className={cn(inputCls, 'font-mono')} />
                </div>
              </Field>
            );
          return (
            <Field key={f.key} label={f.label} hint={f.type === 'password' && v ? 'Saved. Type a new value to replace it.' : f.hint}>
              <input type={f.type === 'password' ? 'password' : f.type} value={String(v ?? '')} placeholder={'placeholder' in f ? f.placeholder : undefined}
                autoComplete="off" onChange={(e) => set(e.target.value)} className={inputCls} />
            </Field>
          );
        })}
      </div>
      {extra && <div className="mt-5 border-t border-border pt-5">{extra}</div>}
    </Panel>
  );
}

function TiersPanel({ tiers, counts, reload }: { tiers: Tier[]; counts: Record<string, number>; reload: () => void }) {
  const { toast } = useToast();
  const [edit, setEdit] = useState<Partial<Tier> | null>(null);
  const [benefits, setBenefits] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Tier | null>(null);

  const open = (t: Partial<Tier>) => { setEdit(t); setBenefits((t.benefits ?? []).join('\n')); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      const body = { ...edit, benefits: benefits.split('\n').map((b) => b.trim()).filter(Boolean) };
      if (edit.id) await api.patch(`/admin/tiers/${edit.id}`, body);
      else await api.post('/admin/tiers', body);
      toast('Tier saved.', { variant: 'success' });
      setEdit(null);
      reload();
      refresh().catch(() => {});
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Membership tiers" pad={false} actions={<Btn size="sm" onClick={() => open({ name: '', priceYearly: 0, color: '#1C69D4', benefits: [] })}><Plus size={13} /> Add tier</Btn>}>
      <Table head={['Tier', 'Price / year', 'Benefits', 'Members', '']}>
        {tiers.map((t) => (
          <tr key={t.id}>
            <td className={td}><span className="flex items-center gap-2 font-semibold text-ink"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} />{t.name}{t.isDefault && <Chip tone="info">Default</Chip>}</span></td>
            <td className={`${td} font-mono`}>{eur(t.priceYearly)}</td>
            <td className={`${td} text-[12px] text-ink-muted`}>{t.benefits.join(' · ')}</td>
            <td className={`${td} font-mono`}>{counts[t.id] ?? 0}</td>
            <td className={`${td} whitespace-nowrap text-right`}>
              <Btn size="sm" tone="subtle" onClick={() => open(t)}>Edit</Btn>
              <Btn size="sm" tone="subtle" onClick={() => setDeleting(t)} aria-label="Delete tier"><Trash2 size={13} className="text-danger" /></Btn>
            </td>
          </tr>
        ))}
      </Table>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? `Edit ${edit.name}` : 'New tier'}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Price per year"><input type="number" min={0} value={edit.priceYearly} onChange={(e) => setEdit({ ...edit, priceYearly: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Colour"><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white p-1" /></Field>
            <Field label="Benefits (one per line)" className="col-span-2"><textarea rows={4} value={benefits} onChange={(e) => setBenefits(e.target.value)} className={cn(inputCls, 'h-auto py-2')} /></Field>
            <div className="col-span-2"><Toggle checked={!!edit.isDefault} onChange={(v) => setEdit({ ...edit, isDefault: v })} label="Default tier for new members" /></div>
            <div className="col-span-2 flex justify-end gap-2"><Btn tone="subtle" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" busy={busy}>Save tier</Btn></div>
          </form>
        </Modal>
      )}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.name}?`} confirmLabel="Delete tier"
        onConfirm={async () => {
          try { await api.del(`/admin/tiers/${deleting!.id}`); toast('Tier deleted.'); reload(); refresh().catch(() => {}); }
          catch (e) { toast((e as Error).message); throw e; }
        }} />
    </Panel>
  );
}

function GeoPanel({ geo, cities, reload }: { geo: Geo[]; cities: City[]; reload: () => void }) {
  const { toast } = useToast();
  const [edit, setEdit] = useState<Partial<Geo> | null>(null);
  const [city, setCity] = useState<Partial<City> | null>(null);
  const [busy, setBusy] = useState(false);

  const saveGeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/admin/geo/${edit!.isoA3}`, edit);
      toast('Country saved.', { variant: 'success' });
      setEdit(null);
      reload();
      refresh().catch(() => {});
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (city!.id) await api.patch(`/admin/cities/${city!.id}`, city);
      else await api.post('/admin/cities', city);
      toast('City saved.', { variant: 'success' });
      setCity(null);
      reload();
      refresh().catch(() => {});
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const del = async (path: string) => {
    try { await api.del(path); reload(); refresh().catch(() => {}); } catch (e) { toast((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <Panel title="Countries & chapters (Global Map)" pad={false} actions={<Btn size="sm" onClick={() => setEdit({ isoA3: '', isoN: '', name: '', members: 0, chapters: 1, continent: 'Europe', growth: 0 })}><Plus size={13} /> Add country</Btn>}>
        <Table head={['Country', 'ISO', 'Members', 'Chapters', 'Continent', 'Growth', '']}>
          {geo.map((g) => (
            <tr key={g.isoA3}>
              <td className={`${td} font-semibold`}>{g.name}</td>
              <td className={`${td} font-mono text-[12px]`}>{g.isoA3} / {g.isoN}</td>
              <td className={`${td} font-mono`}>{g.members}</td>
              <td className={`${td} font-mono`}>{g.chapters}</td>
              <td className={`${td} text-[13px]`}>{g.continent}</td>
              <td className={`${td} font-mono text-[12px]`}>{g.growth}%</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Btn size="sm" tone="subtle" onClick={() => setEdit(g)}>Edit</Btn>
                <Btn size="sm" tone="subtle" onClick={() => del(`/admin/geo/${g.isoA3}`)} aria-label="Delete"><Trash2 size={13} className="text-danger" /></Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Hub cities (map markers)" pad={false} actions={<Btn size="sm" onClick={() => setCity({ city: '', country: '', members: 0, lon: 0, lat: 0 })}><Plus size={13} /> Add city</Btn>}>
        <Table head={['City', 'Country', 'Members', 'Coordinates', '']}>
          {cities.map((c) => (
            <tr key={c.id}>
              <td className={`${td} font-semibold`}>{c.city}</td>
              <td className={`${td} text-[13px]`}>{c.country}</td>
              <td className={`${td} font-mono`}>{c.members}</td>
              <td className={`${td} font-mono text-[12px]`}>{c.lat.toFixed(3)}, {c.lon.toFixed(3)}</td>
              <td className={`${td} whitespace-nowrap text-right`}>
                <Btn size="sm" tone="subtle" onClick={() => setCity(c)}>Edit</Btn>
                <Btn size="sm" tone="subtle" onClick={() => del(`/admin/cities/${c.id}`)} aria-label="Delete"><Trash2 size={13} className="text-danger" /></Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.name ? `Edit ${edit.name}` : 'Add country'} description="Codes must match ISO 3166 so the map can shade the country.">
          <form onSubmit={saveGeo} className="grid grid-cols-2 gap-3">
            <Field label="Country name" className="col-span-2"><input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
            <Field label="ISO alpha-3" hint="e.g. DEU"><input required maxLength={3} value={edit.isoA3} onChange={(e) => setEdit({ ...edit, isoA3: e.target.value.toUpperCase() })} className={cn(inputCls, 'font-mono')} /></Field>
            <Field label="ISO numeric" hint="e.g. 276"><input required maxLength={3} value={edit.isoN} onChange={(e) => setEdit({ ...edit, isoN: e.target.value })} className={cn(inputCls, 'font-mono')} /></Field>
            <Field label="Members"><input type="number" min={0} value={edit.members} onChange={(e) => setEdit({ ...edit, members: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Chapters"><input type="number" min={0} value={edit.chapters} onChange={(e) => setEdit({ ...edit, chapters: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Continent">
              <select value={edit.continent} onChange={(e) => setEdit({ ...edit, continent: e.target.value })} className={inputCls}>
                {['Europe', 'North America', 'South America', 'Asia', 'Africa', 'Oceania'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Growth (% year on year)"><input type="number" step="0.1" value={edit.growth} onChange={(e) => setEdit({ ...edit, growth: Number(e.target.value) })} className={inputCls} /></Field>
            <div className="col-span-2 flex justify-end gap-2"><Btn tone="subtle" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" busy={busy}>Save</Btn></div>
          </form>
        </Modal>
      )}
      {city && (
        <Modal open onClose={() => setCity(null)} title={city.id ? `Edit ${city.city}` : 'Add city'}>
          <form onSubmit={saveCity} className="grid grid-cols-2 gap-3">
            <Field label="City"><input required value={city.city} onChange={(e) => setCity({ ...city, city: e.target.value })} className={inputCls} /></Field>
            <Field label="Country"><input required list="geo-countries" value={city.country} onChange={(e) => setCity({ ...city, country: e.target.value })} className={inputCls} /></Field>
            <datalist id="geo-countries">{geo.map((g) => <option key={g.isoA3} value={g.name} />)}</datalist>
            <Field label="Members"><input type="number" min={0} value={city.members} onChange={(e) => setCity({ ...city, members: Number(e.target.value) })} className={inputCls} /></Field>
            <div />
            <Field label="Latitude"><input type="number" step="any" value={city.lat} onChange={(e) => setCity({ ...city, lat: Number(e.target.value) })} className={inputCls} /></Field>
            <Field label="Longitude"><input type="number" step="any" value={city.lon} onChange={(e) => setCity({ ...city, lon: Number(e.target.value) })} className={inputCls} /></Field>
            <div className="col-span-2 flex justify-end gap-2"><Btn tone="subtle" onClick={() => setCity(null)}>Cancel</Btn><Btn type="submit" busy={busy}>Save</Btn></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function SettingsAdmin() {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useAdminData<SettingsData>('/admin/settings');
  const isSuper = MEMBER_PROFILE.role === 'super_admin';
  const tabs = TABS.filter((t) => !t.superOnly || isSuper);
  const [tab, setTab] = useState('club');
  const [testing, setTesting] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const saved = (key: string) => (v: Section) => setData((d) => d && { ...d, settings: { ...d.settings, [key]: v } });

  const test = async (kind: 'email' | 'ai') => {
    setTesting(kind);
    try {
      if (kind === 'email') {
        const r = await api.post<{ sent: boolean; reason?: string }>('/admin/settings/test-email');
        toast(r.sent ? `Test email sent to ${MEMBER_PROFILE.email}.` : `Not sent: ${r.reason}`, { variant: r.sent ? 'success' : undefined });
      } else {
        const r = await api.post<{ reply: string }>('/admin/settings/test-ai');
        toast(`Model replied: “${r.reply}”`, { variant: 'success' });
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setTesting(null);
    }
  };

  const extra: Record<string, React.ReactNode> = {
    auth: (
      <div className="grid gap-3 md:grid-cols-2">
        <CopyField label="Google authorized redirect URI" value={data.oauthRedirects.google} />
        <CopyField label="Facebook valid OAuth redirect URI" value={data.oauthRedirects.facebook} />
      </div>
    ),
    smtp: <Btn tone="ghost" busy={testing === 'email'} onClick={() => test('email')}>Send a test email to me</Btn>,
    stripe: (
      <div className="space-y-3">
        <CopyField label="Webhook endpoint (event: checkout.session.completed)" value={data.oauthRedirects.stripeWebhook} />
        <p className="text-[12px] text-ink-muted">Payments are also confirmed when members return from checkout, so the webhook is a backup for closed browser tabs.</p>
      </div>
    ),
    ai: <Btn tone="ghost" busy={testing === 'ai'} onClick={() => test('ai')}>Test connection</Btn>,
  };

  return (
    <div>
      <PageHeader title="Settings" description="Configure the club, rules and integrations. Changes apply immediately." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Settings sections">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('shrink-0 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors', tab === t.id ? 'bg-bmw-blue-light text-bmw-blue' : 'text-ink-muted hover:bg-white hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {tab === 'tiers' ? (
            <>
              <TiersPanel tiers={data.tiers} counts={data.tierCounts} reload={reload} />
              <SectionForm sectionKey="membership" value={data.settings.membership} onSaved={saved('membership')} />
            </>
          ) : tab === 'geo' ? (
            <GeoPanel geo={data.geo} cities={data.cities} reload={reload} />
          ) : data.settings[tab] ? (
            <SectionForm key={tab} sectionKey={tab} value={data.settings[tab]} onSaved={saved(tab)} extra={extra[tab]} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
