import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, Plus, Save, X } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { api, uploadImage } from '@/lib/api';
import { CARS } from '@/lib/data';
import type { Car } from '@/lib/data';
import { upsert } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FIELD =
  'h-10 rounded-lg border-border bg-white font-mono text-sm tabular-nums text-ink placeholder:font-sans placeholder:text-ink-faint focus-visible:ring-bmw-blue/40';

function Field({
  id, label, placeholder, type = 'text', required = false, defaultValue, span = 1,
}: {
  id: string; label: string; placeholder: string; type?: string; required?: boolean; defaultValue?: string | number; span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? 'col-span-2 space-y-1.5' : 'col-span-2 space-y-1.5 sm:col-span-1'}>
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-gold-dark">*</span>}
      </Label>
      <Input id={id} name={id} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className={FIELD} />
    </div>
  );
}

/**
 * Add-car (or edit-car when `car` is given) dialog. Saves to the API, supports photo uploads.
 */
export default function AddCarDialog({ car, trigger, defaultOpen = false }: { car?: Car; trigger?: ReactNode; defaultOpen?: boolean }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>(car?.photos ?? []);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 12 - photos.length)) urls.push(await uploadImage(f));
      setPhotos((p) => [...p, ...urls].slice(0, 12));
    } catch (e) {
      toast((e as Error).message, { title: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const g = (k: string) => String(d.get(k) ?? '').trim();
    const body = {
      make: g('make') || 'BMW',
      model: g('model'),
      year: Number(g('year')) || new Date().getFullYear(),
      engine: { code: g('engine'), displacement: g('displacement'), hp: Number(g('hp')) || 0, torque: Number(g('torque')) || 0 },
      transmission: g('transmission'),
      drivetrain: g('drivetrain'),
      paint: { name: g('paint'), hex: g('paintHex') || '#1C69D4' },
      wheels: g('wheels'),
      tires: { front: g('tireFront'), rear: g('tireRear') },
      suspension: g('suspension'),
      exhaust: g('exhaust'),
      mileage: Number(g('mileage')) || 0,
      modifications: g('mods').split('\n').map((x) => x.trim()).filter(Boolean),
      purchase: { date: g('purchaseDate'), price: Number(g('purchasePrice')) || 0, dealer: g('dealer') },
      photos,
    };
    setSaving(true);
    try {
      const r = car
        ? await api.patch<{ car: Car }>(`/cars/${car.id}`, body)
        : await api.post<{ car: Car }>('/cars', body);
      upsert(CARS, r.car);
      setOpen(false);
      toast(`${r.car.year} ${r.car.make} ${r.car.model} ${car ? 'updated' : 'added to your virtual garage'}.`, {
        title: car ? 'Car updated' : 'Car added',
        variant: 'success',
      });
      if (!car) navigate(`/garage/${r.car.id}`);
    } catch (err) {
      toast((err as Error).message, { title: 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setPhotos(car?.photos ?? []); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="group rounded-xl bg-gradient-to-b from-[#E9C766] via-[#C9A227] to-[#8A6D1A] p-[1.5px] shadow-[0_8px_20px_-8px_rgba(0,102,177,0.55)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0">
            <span className="flex items-center gap-2 rounded-[10px] bg-bmw-blue px-4 py-2.5 font-display text-sm font-bold text-white transition-colors group-hover:bg-bmw-blue-dark">
              <Plus size={16} strokeWidth={2.5} />
              Add Car
            </span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-2xl p-0">
        <div className="rounded-t-2xl bg-ink-dark carbon-texture px-6 pb-5 pt-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-extrabold tracking-tight text-white">
              {car ? `Edit ${car.model}` : 'Add a car to your garage'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-white/60">
              {car ? 'Update the build sheet and photos.' : 'Register a car under your membership. Only model and year are required.'}
            </DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 px-6 py-6">
          <Field id="model" label="Model" placeholder="M4 Competition" required defaultValue={car?.model} />
          <Field id="year" label="Year" placeholder="2024" type="number" required defaultValue={car?.year} />
          <Field id="make" label="Make" placeholder="BMW" defaultValue={car?.make ?? 'BMW'} />
          <Field id="mileage" label="Mileage (km)" placeholder="12000" type="number" defaultValue={car?.mileage} />
          <Field id="engine" label="Engine code" placeholder="S58B30T0" defaultValue={car?.engine.code} />
          <Field id="displacement" label="Displacement" placeholder="3.0 L" defaultValue={car?.engine.displacement} />
          <Field id="hp" label="Power (hp)" placeholder="510" type="number" defaultValue={car?.engine.hp || ''} />
          <Field id="torque" label="Torque (Nm)" placeholder="650" type="number" defaultValue={car?.engine.torque || ''} />
          <Field id="transmission" label="Transmission" placeholder="8-speed M Steptronic" defaultValue={car?.transmission} />
          <Field id="drivetrain" label="Drivetrain" placeholder="RWD / M xDrive" defaultValue={car?.drivetrain} />
          <Field id="paint" label="Paint" placeholder="São Paulo Yellow" defaultValue={car?.paint.name} />
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="paintHex" className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Paint colour</Label>
            <input id="paintHex" name="paintHex" type="color" defaultValue={car?.paint.hex ?? '#1C69D4'} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white p-1" />
          </div>
          <Field id="wheels" label="Wheels" placeholder="826M forged, 19/20&quot;" defaultValue={car?.wheels} />
          <Field id="suspension" label="Suspension" placeholder="KW V3 coilovers" defaultValue={car?.suspension} />
          <Field id="tireFront" label="Front tyres" placeholder="275/35 R19" defaultValue={car?.tires.front} />
          <Field id="tireRear" label="Rear tyres" placeholder="285/30 R20" defaultValue={car?.tires.rear} />
          <Field id="exhaust" label="Exhaust" placeholder="Akrapovič titanium" defaultValue={car?.exhaust} span={2} />
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="mods" className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Modifications (one per line)</Label>
            <textarea id="mods" name="mods" rows={3} defaultValue={car?.modifications.join('\n')}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-bmw-blue" />
          </div>
          <Field id="purchaseDate" label="Purchase date" placeholder="" type="date" defaultValue={car?.purchase.date} />
          <Field id="purchasePrice" label="Purchase price" placeholder="98000" type="number" defaultValue={car?.purchase.price || ''} />
          <Field id="dealer" label="Dealer / seller" placeholder="BMW Welt, Munich" defaultValue={car?.purchase.dealer} span={2} />

          <div className="col-span-2 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">Photos ({photos.length}/12)</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p} className="relative h-20 w-28 overflow-hidden rounded-lg border border-border">
                  <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} aria-label="Remove photo"
                    className="absolute right-1 top-1 rounded-full bg-ink-dark/70 p-0.5 text-white"><X size={12} /></button>
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-gold px-1 text-[9px] font-bold text-white">COVER</span>}
                </div>
              ))}
              {photos.length < 12 && (
                <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-[11px] font-semibold text-ink-muted hover:border-bmw-blue hover:text-bmw-blue">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  {uploading ? 'Uploading…' : 'Add photos'}
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          <div className="col-span-2 mt-1 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploading} className="rounded-lg bg-gradient-to-b from-[#E9C766] via-[#C9A227] to-[#8A6D1A] p-[1.5px] disabled:opacity-60">
              <span className="flex items-center gap-2 rounded-[7px] bg-bmw-blue px-4 py-2 font-display text-sm font-bold text-white transition-colors hover:bg-bmw-blue-dark">
                {saving ? <Loader2 size={15} className="animate-spin" /> : car ? <Save size={15} /> : <Plus size={15} strokeWidth={2.5} />}
                {car ? 'Save changes' : 'Add to Garage'}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
