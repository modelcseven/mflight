import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, ProtectedRoute, StaffRoute, FullPageLoader } from '@/lib/auth';
import AuthLayout from '@/components/AuthLayout';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Garage from '@/pages/Garage';
import CarDetail from '@/pages/CarDetail';
import Events from '@/pages/Events';
import Profile from '@/pages/Profile';
import PartStore from '@/pages/PartStore';
import Settings from '@/pages/Settings';
const Map = lazy(() => import('@/pages/Map'));
const Admin = lazy(() => import('@/pages/Admin'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth (pre-login shell) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Admin hub — staff roles only, own shell */}
      <Route
        path="/admin/*"
        element={
          <StaffRoute>
            <Suspense fallback={<FullPageLoader />}>
              <Admin />
            </Suspense>
          </StaffRoute>
        }
      />

      {/* App (post-login shell) */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/garage" element={<Garage />} />
        <Route path="/garage/:carId" element={<CarDetail />} />
        <Route path="/events" element={<Events />} />
        <Route
          path="/map"
          element={
            <Suspense fallback={<div className="flex h-96 items-center justify-center text-sm text-ink-muted">Loading map…</div>}>
              <Map />
            </Suspense>
          }
        />
        <Route path="/parts" element={<PartStore />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
