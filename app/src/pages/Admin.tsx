import { Navigate, Route, Routes } from 'react-router-dom';
import {
  CalendarDays, CarFront, CreditCard, Gauge, History, Megaphone, Settings as SettingsIcon, ShieldAlert, Tag, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminArea } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import Overview from '@/components/admin/Overview';
import UsersAdmin from '@/components/admin/Users';
import EventsAdmin from '@/components/admin/Events';
import Moderation from '@/components/admin/Moderation';
import Garages from '@/components/admin/Garages';
import Marketplace from '@/components/admin/Marketplace';
import Orders from '@/components/admin/Orders';
import Announcements from '@/components/admin/Announcements';
import Audit from '@/components/admin/Audit';
import SettingsAdmin from '@/components/admin/Settings';

export interface SectionDef {
  id: AdminArea;
  label: string;
  icon: LucideIcon;
  element: React.ReactNode;
}

export const SECTIONS: SectionDef[] = [
  { id: 'overview', label: 'Overview', icon: Gauge, element: <Overview /> },
  { id: 'users', label: 'Members', icon: Users, element: <UsersAdmin /> },
  { id: 'events', label: 'Events', icon: CalendarDays, element: <EventsAdmin /> },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert, element: <Moderation /> },
  { id: 'garages', label: 'Garages', icon: CarFront, element: <Garages /> },
  { id: 'marketplace', label: 'Marketplace', icon: Tag, element: <Marketplace /> },
  { id: 'orders', label: 'Orders & payments', icon: CreditCard, element: <Orders /> },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, element: <Announcements /> },
  { id: 'audit', label: 'Audit log', icon: History, element: <Audit /> },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, element: <SettingsAdmin /> },
];

/** Admin hub — staff roles only; sections filtered by the signed-in role's permissions. */
export default function Admin() {
  const { member } = useAuth();
  const allowed = SECTIONS.filter((s) => member?.permissions.includes(s.id));
  if (!allowed.length) return <Navigate to="/dashboard" replace />;
  return (
    <AdminShell sections={allowed}>
      <Routes>
        <Route index element={<Navigate to={allowed[0].id} replace />} />
        {allowed.map((s) => (
          <Route key={s.id} path={s.id} element={s.element} />
        ))}
        <Route path="*" element={<Navigate to={allowed[0].id} replace />} />
      </Routes>
    </AdminShell>
  );
}
