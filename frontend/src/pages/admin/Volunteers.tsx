import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EnumBadge, ErrorState, Field, Input, Modal, Select, formatApiError, reportFormError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useSuggestVolunteers, useVolunteerTasks } from '../../lib/queries.ts';
import type { User, VolunteerTask } from '../../lib/types.ts';
import { useUsers } from '../../lib/queries.ts';

const taskSchema = z.object({
  volunteerId: z.string().min(1, 'Pick a volunteer'),
  title: z.string().min(3).max(200),
  taskType: z.string().min(1, 'Pick a task type'),
  location: z.string().min(1).max(300),
});
type TaskInput = z.infer<typeof taskSchema>;

const taskColumns: Column<VolunteerTask>[] = [
  { key: 'title', header: 'Task', render: (t) => <span><strong>{t.title}</strong><br /><span className="text-xs text-slate-500">{t.location} · {t.volunteer?.name}</span></span>, sortValue: (t) => t.title },
  { key: 'type', header: 'Type', render: (t) => <EnumBadge group="volunteerTaskTypes" value={t.taskType} /> },
  { key: 'status', header: 'Status', render: (t) => <EnumBadge group="volunteerTaskStatuses" value={t.status} />, sortValue: (t) => t.status },
];

const volColumns: Column<User>[] = [
  { key: 'name', header: 'Volunteer', render: (v) => <span><strong>{v.name}</strong><br /><span className="text-xs text-slate-500">{v.email} · {v.serviceArea ?? '—'}</span></span>, sortValue: (v) => v.name },
  { key: 'skills', header: 'Skills', render: (v) => <span className="text-xs">{(v.skills ?? '—').split(',').join(' · ')}</span> },
  { key: 'avail', header: 'Availability', render: (v) => <span className="text-xs font-semibold">{v.availability ?? '—'}</span> },
];

function AssignTaskForm({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: { volunteerId: '', title: '', taskType: '', location: '' } });
  const taskType = watch('taskType');
  const location = watch('location');
  const suggest = useSuggestVolunteers(taskType || undefined, location || undefined);
  const mut = useMutation({
    mutationFn: (body: TaskInput) => apiSendOne<VolunteerTask>('post', '/volunteer-tasks', 'task', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volunteer-tasks'] }),
  });
  async function onSubmit(data: TaskInput) {
    setServerError(null);
    try { await mut.mutateAsync(data); push('success', 'Task assigned.'); onDone(); }
    catch (err) { reportFormError(err, { setError: setError as never, setServerError, push }); }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Task type" error={errors.taskType?.message}>
          <Select {...register('taskType')}>
            <option value="">Pick…</option>
            {options('volunteerTaskTypes').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Location" error={errors.location?.message}><Input {...register('location')} placeholder="Andheri camp" /></Field>
      </div>
      {suggest.data && suggest.data.volunteers.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800">
          <p className="font-bold">Suggested (skill + area ranked)</p>
          <ul className="mt-1 space-y-1">
            {suggest.data.volunteers.slice(0, 5).map((v) => (
              <li key={v.id}><button type="button" className="link font-semibold" onClick={() => setValue('volunteerId', v.id)}>{v.name}</button> <span className="text-slate-500">· score {v.score} · {v.skills}</span></li>
            ))}
          </ul>
        </div>
      )}
      <Field label="Title" error={errors.title?.message}><Input {...register('title')} placeholder="First-aid post at…" /></Field>
      <Field label="Volunteer ID" error={errors.volunteerId?.message} hint="Click a suggested volunteer above, or paste an ID.">
        <Input {...register('volunteerId')} placeholder="Volunteer user ID" />
      </Field>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Assigning…' : 'Assign task'}</Button>
    </form>
  );
}

export default function AdminVolunteers() {
  const [page, setPage] = useState(1);
  const [tPage, setTPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const vols = useUsers({ role: 'VOLUNTEER', page, limit: 10 });
  const tasks = useVolunteerTasks({ page: tPage, limit: 10 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🤝 Volunteers & tasks</h1>
        <Button onClick={() => setShowForm(true)}>+ Assign task</Button>
      </div>
      <Card>
        <CardTitle>Tasks</CardTitle>
        {tasks.isError && <ErrorState message="Could not load tasks." onRetry={() => void tasks.refetch()} />}
        {tasks.data && <DataTable rows={tasks.data.items} columns={taskColumns} meta={tasks.data.meta} page={tPage} onPage={setTPage} emptyTitle="No volunteer tasks yet" />}
      </Card>
      <Card>
        <CardTitle>Registered volunteers</CardTitle>
        {vols.data && <DataTable rows={vols.data.items} columns={volColumns} meta={vols.data.meta} page={page} onPage={setPage} emptyTitle="No volunteers registered" />}
      </Card>
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Assign volunteer task" wide>
        <AssignTaskForm onDone={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
