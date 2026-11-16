import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  CircleDot,
  Cog,
  Disc3,
  Gauge,
  Layers,
  MapPin,
  Palette,
  Receipt,
  Waypoints,
  Wind,
  Wrench,
  Pencil,
  Trash2,
  Flag,
} from 'lucide-react';
import { CARS, MEMBER_PROFILE, SETTINGS, carById, carPhoto, memberById } from '@/lib/data';
import type { Car } from '@/lib/data';
import { api } from '@/lib/api';
import { removeById, upsert, useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import AddCarDialog from '@/components/garage/AddCarDialog';
import ReportDialog from '@/components/ReportDialog';
import ConfirmDialog from '@/components/Confirm';
import MembershipPlate from '@/components/MembershipPlate';
import SpecSection from '@/components/SpecSection';
import PhotoGallery from '@/components/garage/PhotoGallery';
import AiInsights from '@/components/garage/AiInsights';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const eur = (n: number) => (n ? `€ ${n.toLocaleString('en-GB')}` : '—');
const dateFmt = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Virtual Garage — single car detail. Desktop: two columns — left (≈58%)
 * photo gallery + purchase/mileage card, right (≈42%) sticky specifications
 * panel. AI insights slot spans full width at the bottom.
 * Mobile: gallery first, then stacked spec cards.
 */
export default function CarDetail() {
  const { carId } = useParams();
  useStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const car = carId ? carById(carId) : undefined;
  if (!car) return <Navigate to="/garage" replace />;

  const owner = memberById(car.ownerId);
  const title = `${car.year} ${car.make} ${car.model}`;
  const mine = car.ownerId === MEMBER_PROFILE.id;

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api.post<{ car: Car }>(`/cars/${car.id}/insights`);
      upsert(CARS, r.car);
      toast('Fresh insights generated for your car.', { title: 'AI Insights', variant: 'success' });
    } catch (e) {
      toast((e as Error).message, { title: 'AI Insights' });
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/cars/${car.id}`);
      removeById(CARS, car.id);
      toast(`${car.model} removed from your garage.`);
      navigate('/garage');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Back + header */}
      <motion.div variants={fadeUp}>
        <Link
          to="/garage"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-bmw-blue"
        >
          <ArrowLeft size={15} />
          Back to Garage
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {title}
          </h1>
          {owner && <MembershipPlate number={owner.membershipNumber} size="sm" className="mt-1" />}
          <div className="ml-auto flex items-center gap-2">
            {mine ? (
              <>
                <AddCarDialog
                  car={car}
                  trigger={
                    <button className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:border-bmw-blue/40 hover:text-bmw-blue">
                      <Pencil size={14} /> Edit
                    </button>
                  }
                />
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-xl border border-danger/30 px-3.5 py-2 text-sm font-semibold text-danger hover:bg-danger/5">
                  <Trash2 size={14} /> Delete
                </button>
              </>
            ) : (
              <button onClick={() => setReporting(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-slate-100 hover:text-ink">
                <Flag size={14} /> Report
              </button>
            )}
          </div>
        </div>

        {/* Owner line — conceptually links to the club member */}
        {owner && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-full border border-border bg-white py-1.5 pl-1.5 pr-4 shadow-card">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bmw-blue font-display text-[11px] font-bold text-white">
              {owner.avatarInitials}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {owner.name}
              {owner.verified && <BadgeCheck size={15} className="text-bmw-blue" />}
            </span>
            <span className="hidden items-center gap-1 text-xs text-ink-muted sm:inline-flex">
              <MapPin size={12} />
              {owner.location}
            </span>
          </div>
        )}
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left — gallery (≈58%) */}
        <div className="space-y-6 lg:col-span-7">
          <motion.div variants={fadeUp}>
            <PhotoGallery photos={car.photos.length ? car.photos : [carPhoto(car)]} alt={title} />
          </motion.div>

          {/* Purchase & mileage — secondary card */}
          <motion.div variants={fadeUp}>
            <SpecSection
              icon={Receipt}
              title="Purchase & Mileage"
              className="bg-bg-app/60"
              rows={[
                { label: 'Current mileage', value: `${car.mileage.toLocaleString('en-GB')} km`, mono: true },
                { label: 'Purchase date', value: dateFmt(car.purchase.date), mono: true },
                { label: 'Purchase price', value: eur(car.purchase.price), mono: true },
                { label: 'Purchased at', value: car.purchase.dealer },
              ]}
            />
          </motion.div>
        </div>

        {/* Right — sticky specifications panel (≈42%) */}
        <motion.div variants={fadeUp} className="lg:col-span-5">
          <div className="space-y-5 lg:sticky lg:top-20">
            {/* Engine — big mono figures */}
            <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
              <header className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bmw-blue-light text-bmw-blue">
                  <Gauge size={16} />
                </span>
                <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">
                  Engine
                </h3>
                <span className="ml-auto font-mono text-xs font-semibold text-ink-faint">
                  {car.engine.code}
                </span>
              </header>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg-app px-4 py-3 text-center">
                  <p className="font-mono text-3xl font-bold tabular-nums text-bmw-blue">
                    {car.engine.hp}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    Horsepower
                  </p>
                </div>
                <div className="rounded-xl bg-bg-app px-4 py-3 text-center">
                  <p className="font-mono text-3xl font-bold tabular-nums text-ink">
                    {car.engine.torque}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    Nm Torque
                  </p>
                </div>
              </div>
              <dl className="mt-4 divide-y divide-border">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[13px] text-ink-muted">Engine code</dt>
                  <dd className="font-mono text-sm font-semibold tabular-nums text-ink">
                    {car.engine.code}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 pb-0 pt-2.5">
                  <dt className="text-[13px] text-ink-muted">Displacement</dt>
                  <dd className="font-mono text-sm font-semibold tabular-nums text-ink">
                    {car.engine.displacement}
                  </dd>
                </div>
              </dl>
            </section>

            <SpecSection
              icon={Cog}
              title="Transmission"
              rows={[{ label: 'Gearbox', value: car.transmission }]}
            />
            <SpecSection
              icon={Waypoints}
              title="Drivetrain"
              rows={[{ label: 'Drive type', value: car.drivetrain }]}
            />
            <SpecSection
              icon={Disc3}
              title="Tires"
              rows={[
                { label: 'Front', value: car.tires.front, mono: true },
                { label: 'Rear', value: car.tires.rear, mono: true },
              ]}
            />
            <SpecSection
              icon={Palette}
              title="Paint"
              rows={[
                {
                  label: 'Color',
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: car.paint.hex }}
                      />
                      {car.paint.name}
                    </span>
                  ),
                },
              ]}
            />
            <SpecSection
              icon={CircleDot}
              title="Wheels"
              rows={[{ label: 'Setup', value: car.wheels }]}
            />
            <SpecSection
              icon={Layers}
              title="Suspension"
              rows={[{ label: 'System', value: car.suspension }]}
            />
            <SpecSection
              icon={Wind}
              title="Exhaust"
              rows={[{ label: 'System', value: car.exhaust }]}
            />

            {/* Modifications — clean vertical list */}
            <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
              <header className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-light text-gold-dark">
                  <Wrench size={16} />
                </span>
                <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink">
                  Modifications
                </h3>
                <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-ink-faint">
                  {car.modifications.length}
                </span>
              </header>
              {car.modifications.length > 0 ? (
                <ul className="mt-4 space-y-2.5">
                  {car.modifications.map((mod) => (
                    <li key={mod} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      <span className="text-[13px] font-medium text-ink">{mod}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-ink-faint">Fully stock — no modifications yet.</p>
              )}
            </section>
          </div>
        </motion.div>
      </div>

      {/* Dedicated AI insights slot — full width, safe when empty */}
      <motion.div variants={fadeUp}>
        <AiInsights
          insights={car.aiInsights}
          onGenerate={mine && SETTINGS.ai?.enabled ? generate : undefined}
          generating={generating}
        />
      </motion.div>
      {reporting && <ReportDialog targetType="car" targetId={car.id} onClose={() => setReporting(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${car.model}?`}
        description="This removes the car and its photos from your garage. This cannot be undone."
        confirmLabel="Delete car"
        onConfirm={remove}
      />
    </motion.div>
  );
}
