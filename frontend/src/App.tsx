import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell, PublicLayout, RequireAuth, RequireRole } from './components/Layout.tsx';
import { Skeleton } from './components/ui.tsx';
import Help from './pages/Help.tsx';
import Landing from './pages/Landing.tsx';
import Login from './pages/Login.tsx';
import Notifications from './pages/Notifications.tsx';
import Register from './pages/Register.tsx';
import NotFound from './pages/NotFound.tsx';

// Heavy pages (maps / charts) are code-split so first paint stays fast.
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.tsx'));
const RequestQueue = lazy(() => import('./pages/admin/RequestQueue.tsx'));
const CitizenShelters = lazy(() => import('./pages/citizen/Shelters.tsx'));
const NewRequest = lazy(() => import('./pages/citizen/NewRequest.tsx'));
const MissionDetail = lazy(() => import('./pages/team/MissionDetail.tsx'));

import { Audit, Disasters, Users, default as Alerts } from './pages/admin/Manage.tsx';
import Relief from './pages/admin/Relief.tsx';
import AdminShelters from './pages/admin/Shelters.tsx';
import AdminVolunteers from './pages/admin/Volunteers.tsx';
import AdminTeams from './pages/admin/Teams.tsx';
import MyRequests from './pages/citizen/MyRequests.tsx';
import RequestDetail from './pages/citizen/RequestDetail.tsx';
import { NgoAllocations, NgoFieldRequests, NgoInventory } from './pages/ngo/Relief.tsx';
import { ShelterManagerHome, ShelterRequests } from './pages/shelter/Shelters.tsx';
import Missions from './pages/team/Missions.tsx';
import Profile from './pages/volunteer/Profile.tsx';
import Tasks from './pages/volunteer/Tasks.tsx';

const TITLES: Array<[RegExp, string]> = [
  [/^\/admin\/requests/, 'Request queue · DRRCP'],
  [/^\/admin\/teams/, 'Rescue teams · DRRCP'],
  [/^\/admin\/volunteers/, 'Volunteers · DRRCP'],
  [/^\/admin\/shelters/, 'Shelters · DRRCP'],
  [/^\/admin\/relief/, 'Relief & stock · DRRCP'],
  [/^\/admin\/alerts/, 'Alerts · DRRCP'],
  [/^\/admin\/users/, 'Users · DRRCP'],
  [/^\/admin\/disasters/, 'Disaster events · DRRCP'],
  [/^\/admin\/audit/, 'Audit log · DRRCP'],
  [/^\/admin$/, 'Command center · DRRCP'],
  [/^\/my-requests\/.+/, 'Request details · DRRCP'],
  [/^\/my-requests/, 'My requests · DRRCP'],
  [/^\/request-help/, 'Request help · DRRCP'],
  [/^\/missions\/.+/, 'Mission details · DRRCP'],
  [/^\/missions/, 'My missions · DRRCP'],
  [/^\/tasks/, 'My tasks · DRRCP'],
  [/^\/profile/, 'Volunteer profile · DRRCP'],
  [/^\/my-shelters/, 'My shelters · DRRCP'],
  [/^\/resource-requests/, 'Resource requests · DRRCP'],
  [/^\/inventory/, 'Inventory · DRRCP'],
  [/^\/allocations/, 'Allocations · DRRCP'],
  [/^\/relief-requests/, 'Field requests · DRRCP'],
  [/^\/notifications/, 'Notifications · DRRCP'],
  [/^\/shelters/, 'Find shelter · DRRCP'],
  [/^\/help/, 'Help · DRRCP'],
  [/^\/login/, 'Log in · DRRCP'],
  [/^\/register/, 'Register · DRRCP'],
  [/^\//, 'DRRCP — Disaster Relief & Rescue Coordination Platform'],
];

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'DRRCP';
  }, [pathname]);
  return null;
}

function LazyFallback() {
  return (
    <div className="space-y-3" aria-label="Loading page">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <RouteTitle />
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-5"><LazyFallback /></div>}>
        <Routes>
          {/* public */}
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/shelters" element={<CitizenShelters />} />
            <Route path="/404" element={<NotFound />} />
          </Route>

          {/* authenticated shell */}
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/help" element={<Help />} />

            <Route path="/my-requests" element={<RequireRole roles={['CITIZEN']}><MyRequests /></RequireRole>} />
            <Route path="/my-requests/:id" element={<RequireRole roles={['CITIZEN']}><RequestDetail /></RequireRole>} />
            <Route path="/request-help" element={<RequireRole roles={['CITIZEN']}><NewRequest /></RequireRole>} />

            <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AdminDashboard /></RequireRole>} />
            <Route path="/admin/requests" element={<RequireRole roles={['ADMIN']}><RequestQueue /></RequireRole>} />
            <Route path="/admin/teams" element={<RequireRole roles={['ADMIN']}><AdminTeams /></RequireRole>} />
            <Route path="/admin/volunteers" element={<RequireRole roles={['ADMIN']}><AdminVolunteers /></RequireRole>} />
            <Route path="/admin/shelters" element={<RequireRole roles={['ADMIN']}><AdminShelters /></RequireRole>} />
            <Route path="/admin/relief" element={<RequireRole roles={['ADMIN']}><Relief /></RequireRole>} />
            <Route path="/admin/alerts" element={<RequireRole roles={['ADMIN']}><Alerts /></RequireRole>} />
            <Route path="/admin/users" element={<RequireRole roles={['ADMIN']}><Users /></RequireRole>} />
            <Route path="/admin/disasters" element={<RequireRole roles={['ADMIN']}><Disasters /></RequireRole>} />
            <Route path="/admin/audit" element={<RequireRole roles={['ADMIN']}><Audit /></RequireRole>} />

            <Route path="/missions" element={<RequireRole roles={['RESCUE_TEAM']}><Missions /></RequireRole>} />
            <Route path="/missions/:id" element={<RequireRole roles={['RESCUE_TEAM']}><MissionDetail /></RequireRole>} />

            <Route path="/tasks" element={<RequireRole roles={['VOLUNTEER']}><Tasks /></RequireRole>} />
            <Route path="/profile" element={<RequireRole roles={['VOLUNTEER']}><Profile /></RequireRole>} />

            <Route path="/my-shelters" element={<RequireRole roles={['SHELTER_MANAGER']}><ShelterManagerHome /></RequireRole>} />
            <Route path="/resource-requests" element={<RequireRole roles={['SHELTER_MANAGER']}><ShelterRequests /></RequireRole>} />

            <Route path="/inventory" element={<RequireRole roles={['NGO']}><NgoInventory /></RequireRole>} />
            <Route path="/allocations" element={<RequireRole roles={['NGO']}><NgoAllocations /></RequireRole>} />
            <Route path="/relief-requests" element={<RequireRole roles={['NGO']}><NgoFieldRequests /></RequireRole>} />

            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
