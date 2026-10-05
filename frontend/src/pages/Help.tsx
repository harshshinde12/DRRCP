import { useAuth } from '../lib/auth.tsx';
import { Card, CardTitle } from '../components/ui.tsx';

const GUIDES: Array<{ roles: string[]; title: string; steps: string[] }> = [
  { roles: ['CITIZEN'], title: '🧭 Citizen quick guide', steps: ['Raise a request in 3 steps: type → map location → details.', 'Track it under My requests — the timeline shows verification, dispatch and rescue progress.', 'Find open shelters with free beds on Nearby shelters.', 'You will be notified on every status change.'] },
  { roles: ['ADMIN'], title: '🛰️ Administrator guide', steps: ['Watch the command center map and queue; triage SUBMITTED requests first.', 'Verify with the right priority, then assign the nearest AVAILABLE team.', 'Force-assigning a busy team needs a written reason (audited).', 'Publish alerts, manage stock, and review the audit log.'] },
  { roles: ['RESCUE_TEAM'], title: '🚑 Rescue team guide', steps: ['Open a mission, acknowledge it, then tap On the way → Start rescue.', 'If the rescue fails, request support — admins are alerted instantly.', 'File the rescue report to complete the mission and resolve the request.'] },
  { roles: ['VOLUNTEER'], title: '🤝 Volunteer guide', steps: ['Keep your skills and availability toggle up to date.', 'Accept or decline each assigned low-risk task, then mark progress.', 'Professional rescue work stays with trained teams.'] },
  { roles: ['SHELTER_MANAGER'], title: '🏠 Shelter manager guide', steps: ['Use +/− to adjust occupancy; occupancy can never exceed capacity without an emergency override.', 'Raise resource requests when supplies run low.', 'You will be alerted when allocations arrive.'] },
  { roles: ['NGO'], title: '📦 NGO guide', steps: ['Register stock against catalogue items.', 'Approve field requests, then allocate — over-allocation is blocked atomically.', 'Watch the shortage panel to prioritize procurement.'] },
];

export default function Help() {
  const { user } = useAuth();
  const guides = GUIDES.filter((g) => !user || g.roles.includes(user.role));
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">❓ Help & walkthrough</h1>
      {guides.map((g) => (
        <Card key={g.title}>
          <CardTitle>{g.title}</CardTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {g.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </Card>
      ))}
      <Card>
        <CardTitle>🆘 Emergency helplines</CardTitle>
        <p className="text-sm">National emergency <a className="link font-bold" href="tel:112">112</a> · Disaster <a className="link font-bold" href="tel:1078">1078</a> · Medical <a className="link font-bold" href="tel:102">102</a> · Fire <a className="link font-bold" href="tel:101">101</a></p>
      </Card>
    </div>
  );
}
