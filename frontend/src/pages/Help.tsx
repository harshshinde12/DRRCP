import { useAuth } from '../lib/auth.tsx';
import { HELPLINES } from '../lib/strings.ts';
import { Card, CardTitle } from '../components/ui.tsx';

const GUIDES: Array<{ roles: string[]; id: string; title: string; steps: string[] }> = [
  { roles: ['CITIZEN'], id: 'help-citizen', title: '🧭 Citizen quick guide', steps: ['Raise a request in 3 steps: type → map location → details.', 'Track it under My requests — the timeline shows verification, dispatch and rescue progress.', 'Find open shelters with free beds on Nearby shelters.', 'You will be notified on every status change.'] },
  { roles: ['ADMIN'], id: 'help-admin', title: '🛰️ Administrator guide', steps: ['Watch the command center map and queue; triage SUBMITTED requests first.', 'Verify with the right priority, then assign the nearest AVAILABLE team.', 'Force-assigning a busy team needs a written reason (audited).', 'Publish alerts, manage stock, and review the audit log.'] },
  { roles: ['RESCUE_TEAM'], id: 'help-team', title: '🚑 Rescue team guide', steps: ['Open a mission, acknowledge it, then tap On the way → Start rescue.', 'If the rescue fails, request support — admins are alerted instantly.', 'File the rescue report to complete the mission and resolve the request.'] },
  { roles: ['VOLUNTEER'], id: 'help-volunteer', title: '🤝 Volunteer guide', steps: ['Keep your skills and availability toggle up to date.', 'Accept or decline each assigned low-risk task, then mark progress.', 'Professional rescue work stays with trained teams.'] },
  { roles: ['SHELTER_MANAGER'], id: 'help-shelter', title: '🏠 Shelter manager guide', steps: ['Use +/− to adjust occupancy; occupancy can never exceed capacity without an emergency override.', 'Raise resource requests when supplies run low.', 'You will be alerted when allocations arrive.'] },
  { roles: ['NGO'], id: 'help-ngo', title: '📦 NGO guide', steps: ['Register stock against catalogue items.', 'Approve field requests, then allocate — over-allocation is blocked atomically.', 'Watch the shortage panel to prioritize procurement.'] },
];

export default function Help() {
  const { user } = useAuth();
  const guides = GUIDES.filter((g) => !user || g.roles.includes(user.role));
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">❓ Help & walkthrough</h1>
      {guides.map((g) => (
        <Card key={g.title}>
          <div id={g.id} className="scroll-mt-20" />
          <CardTitle>{g.title}</CardTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {g.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </Card>
      ))}
      <Card>
        <div id="help-helplines" className="scroll-mt-20" />
        <CardTitle>🆘 Emergency helplines</CardTitle>
        <p className="text-sm">
          {HELPLINES.map((h, i) => (
            <span key={h.n}>{i > 0 && ' · '}{h.d} <a className="link font-bold" href={`tel:${h.n}`}>{h.n}</a></span>
          ))}
        </p>
      </Card>
    </div>
  );
}
