import { useMeta } from '../lib/meta.tsx';
import { Badge, EnumBadge } from './ui.tsx';

/** Citizen timeline: canonical request steps from meta + live mission readout. */
export function StatusTimeline({ status, missionStatus, displayStatus }: { status: string; missionStatus: string | null; displayStatus: string }) {
  const { meta, label } = useMeta();
  const steps = meta?.requestLifecycle ?? ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS', 'RESOLVED'];
  const terminal = ['REJECTED', 'DUPLICATE', 'CANCELLED'].includes(status);
  const activeIdx = steps.indexOf(status);

  return (
    <div aria-label={`Request status: ${displayStatus}`}>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <EnumBadge group="requestStatuses" value={status} />
        {missionStatus && <EnumBadge group="assignmentStatuses" value={missionStatus} />}
        <span className="font-medium text-slate-700 dark:text-slate-300">{displayStatus}</span>
      </p>
      {terminal ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This request ended as <strong>{label('requestStatuses', status)}</strong>. {status === 'DUPLICATE' ? 'It was linked to an earlier request — no separate dispatch was needed.' : ''}
        </p>
      ) : (
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const done = i < activeIdx || status === 'RESOLVED' && i <= activeIdx;
            const current = i === activeIdx;
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                {i < steps.length - 1 && (
                  <span aria-hidden className={`absolute left-[11px] top-6 h-full w-0.5 ${i < activeIdx ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
                <span aria-hidden className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-green-500 text-white' : current ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-950' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                  {done ? '✓' : i + 1}
                </span>
                <div className="pt-0.5">
                  <p className={`text-sm font-semibold ${current ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>{label('requestStatuses', step)}</p>
                  {current && missionStatus && ['ASSIGNED'].includes(status) && (
                    <p className="text-xs text-slate-500">Mission: {label('assignmentStatuses', missionStatus)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Compact assignment chip: shows "Additional support" for repeat dispatches. */
export function AssignmentChip({ assignment, additional }: { assignment: { status: string; team: { name: string } }; additional?: boolean }) {
  const { badgeClass, label } = useMeta();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge className={badgeClass('assignmentStatuses', assignment.status)}>
        {additional ? 'Additional support · ' : ''}{assignment.team.name} — {label('assignmentStatuses', assignment.status)}
      </Badge>
    </span>
  );
}
