import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeForRole } from '../lib/auth.tsx';
import { useUnreadCount } from '../lib/queries.ts';
import type { Role } from '../lib/types.ts';
import { Button } from './ui.tsx';

/* ---------- Theme ---------- */
export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('drrcp.theme') !== 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('drrcp.theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

/* ---------- Guards ---------- */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

/* ---------- Notification bell ---------- */
function Bell() {
  const { data } = useUnreadCount(true);
  const unread = data ?? 0;
  return (
    <Link to="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
      <span aria-hidden className="text-xl">🔔</span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}

/* ---------- Sidebar config per role ---------- */
interface NavItem { to: string; label: string; icon: string; }
const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: '/admin', label: 'Command center', icon: '🛰️' },
    { to: '/admin/requests', label: 'Request queue', icon: '📥' },
    { to: '/admin/teams', label: 'Rescue teams', icon: '🚑' },
    { to: '/admin/volunteers', label: 'Volunteers', icon: '🤝' },
    { to: '/admin/shelters', label: 'Shelters', icon: '🏠' },
    { to: '/admin/relief', label: 'Relief & stock', icon: '📦' },
    { to: '/admin/alerts', label: 'Alerts', icon: '📢' },
    { to: '/admin/users', label: 'Users', icon: '👥' },
    { to: '/admin/disasters', label: 'Disasters', icon: '🌊' },
    { to: '/admin/audit', label: 'Audit log', icon: '🧾' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
  CITIZEN: [
    { to: '/my-requests', label: 'My requests', icon: '📋' },
    { to: '/request-help', label: 'Request help', icon: '🆘' },
    { to: '/shelters', label: 'Nearby shelters', icon: '🏠' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
  RESCUE_TEAM: [
    { to: '/missions', label: 'My missions', icon: '🚑' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
  VOLUNTEER: [
    { to: '/tasks', label: 'My tasks', icon: '🤝' },
    { to: '/profile', label: 'Profile', icon: '👤' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
  SHELTER_MANAGER: [
    { to: '/my-shelters', label: 'My shelters', icon: '🏠' },
    { to: '/resource-requests', label: 'Resource requests', icon: '📦' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
  NGO: [
    { to: '/inventory', label: 'Inventory', icon: '📦' },
    { to: '/allocations', label: 'Allocations', icon: '🚚' },
    { to: '/relief-requests', label: 'Field requests', icon: '📥' },
    { to: '/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/help', label: 'Help', icon: '❓' },
  ],
};

/* ---------- Shell ---------- */
export function AppShell() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = user ? NAV[user.role] : [];

  return (
    <div className="flex min-h-screen">
      {/* mobile drawer backdrop */}
      {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 ${open ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <Link to="/" className="flex items-center gap-2 px-4 py-4" onClick={() => setOpen(false)}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xl text-white">🌊</span>
          <span className="font-extrabold leading-tight text-slate-900 dark:text-white">DRRCP<span className="block text-[11px] font-medium text-slate-500">Rescue Coordination</span></span>
        </Link>
        <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/admin'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <p className="truncate px-1 text-xs text-slate-500 dark:text-slate-400">{user?.name} · {user?.role}</p>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => void logout()}>↩ Log out</Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-4">
          <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>
          <button onClick={() => navigate(-1)} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 sm:block" aria-label="Go back">←</button>
          <div className="flex-1" />
          <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <span aria-hidden className="text-xl">{dark ? '☀️' : '🌙'}</span>
          </button>
          <Bell />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-3 sm:p-5"><Outlet /></main>
        <footer className="px-4 py-3 text-center text-xs text-slate-400">DRRCP · Disaster Relief & Rescue Coordination Platform ·Release 1.0 · Emergency: <a className="link font-bold" href="tel:112">112</a></footer>
      </div>
    </div>
  );
}

/* ---------- Public layout ---------- */
export function PublicLayout() {
  const { dark, toggle } = useTheme();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/" className="flex items-center gap-2">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xl text-white">🌊</span>
            <span className="font-extrabold text-slate-900 dark:text-white">DRRCP</span>
          </Link>
          <div className="flex-1" />
          <button onClick={toggle} aria-label="Toggle dark mode" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">{dark ? '☀️' : '🌙'}</button>
          <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Log in</Link>
          <Link to="/register" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Register</Link>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        DRRCP Release 1.0 · In-app notifications only · Emergency helplines: <a className="link" href="tel:112">112</a> · <a className="link" href="tel:1078">1078</a> (Disaster) · <a className="link" href="tel:102">102</a> (Medical)
      </footer>
    </div>
  );
}
