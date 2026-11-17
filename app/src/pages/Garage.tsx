import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CarFront } from 'lucide-react';
import { CARS } from '@/lib/data';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import CarCard from '@/components/CarCard';
import MembershipPlate from '@/components/MembershipPlate';
import AddCarDialog from '@/components/garage/AddCarDialog';

/**
 * Virtual Garage — overview. Top bar with the member's plate + gold-edged
 * "Add Car" action, then a responsive grid of all club cars.
 */
export default function Garage() {
  const { member } = useAuth();
  useStore();
  const mineCount = CARS.filter((c) => c.ownerId === member?.id).length;
  const [tab, setTab] = useState<'mine' | 'club'>(mineCount ? 'mine' : 'club');
  const [params] = useSearchParams();
  const addOpen = params.get('add') === '1';
  const list = tab === 'mine' ? CARS.filter((c) => c.ownerId === member?.id) : CARS;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Virtual Garage
            </h1>
            {member && <MembershipPlate number={member.memberNo} size="sm" className="mt-0.5" />}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-mono font-semibold tabular-nums text-ink">{CARS.length}</span> cars
            registered across the club
          </p>
        </div>
        <div className="ml-auto">
          <AddCarDialog defaultOpen={addOpen} />
        </div>
      </div>

      <div className="flex gap-2">
        {([['mine', `My garage (${mineCount})`], ['club', `Club garage (${CARS.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === id ? 'bg-bmw-blue text-white' : 'border border-border bg-white text-ink-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>

      {/* Car grid */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        key={tab}
      >
        {list.map((car) => (
          <motion.div
            key={car.id}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
          >
            <CarCard car={car} />
          </motion.div>
        ))}
      </motion.div>

      {list.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white py-16 text-center">
          <CarFront size={28} className="text-ink-faint" />
          <p className="text-sm text-ink-muted">{tab === 'mine' ? 'You have not added a car yet.' : 'No cars in the garage yet.'}</p>
          {tab === 'mine' && <AddCarDialog />}
        </div>
      )}
    </div>
  );
}
