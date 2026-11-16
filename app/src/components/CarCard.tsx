import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Car } from '@/lib/data';
import { carPhoto } from '@/lib/data';

/**
 * Garage car card: 16:9 photo, model + year, key power figure (mono),
 * paint swatch circles, hover lift. Links to `/garage/:id`.
 */
export default function CarCard({ car }: { car: Car }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <Link
        to={`/garage/${car.id}`}
        className="block overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-shadow duration-200 hover:shadow-elevated"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
          <img
            src={carPhoto(car)}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink backdrop-blur-sm">
            {car.year}
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-extrabold tracking-tight text-ink">
                {car.make} {car.model}
              </h3>
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {car.engine.code} · {car.engine.displacement} · {car.transmission}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-lg font-bold leading-none text-bmw-blue">{car.engine.hp}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">hp</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="h-5 w-5 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: car.paint.hex }}
                title={car.paint.name}
              />
              <span className="text-xs text-ink-muted">{car.paint.name}</span>
            </div>
            <span className="font-mono text-[11px] text-ink-faint">
              {car.mileage.toLocaleString('en-GB')} km
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
