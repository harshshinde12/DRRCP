import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, Field, Input, Select, Skeleton, formatApiError, reportFormError, useToast } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth.tsx';
import { apiGetOne, apiSendOne } from '../../lib/api-client.ts';
import type { User } from '../../lib/types.ts';

const profileSchema = z.object({
  phone: z.string().max(20).optional().or(z.literal('')),
  skills: z.string().max(500).optional().or(z.literal('')),
  availability: z.string().max(100).optional().or(z.literal('')),
  serviceArea: z.string().max(200).optional().or(z.literal('')),
});
type ProfileInput = z.infer<typeof profileSchema>;

const AVAILABILITY = ['FULL_TIME', 'WEEKDAYS', 'WEEKENDS', 'UNAVAILABLE'];

export default function Profile() {
  const { user } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) });
  const availability = watch('availability');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiGetOne<User>(`/volunteers/${user.id}`, 'volunteer')
      .then((v) => { if (!cancelled) reset({ phone: v.phone ?? '', skills: v.skills ?? '', availability: v.availability ?? 'FULL_TIME', serviceArea: v.serviceArea ?? '' }); })
      .catch((err) => { if (!cancelled) setServerError(formatApiError(err)); });
    return () => { cancelled = true; };
  }, [user, reset]);

  async function onSubmit(data: ProfileInput) {
    if (!user) return;
    setServerError(null); setSaved(false);
    try {
      await apiSendOne('patch', `/volunteers/${user.id}`, 'volunteer', data);
      push('success', 'Profile saved.');
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err) { reportFormError(err, { setError: setError as never, setServerError, push }); }
  }

  if (!user) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">👤 Volunteer profile</h1>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <div>
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email} · availability: <strong>{availability ?? '—'}</strong></p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              Available now
              <button
                type="button" role="switch" aria-checked={availability !== 'UNAVAILABLE'}
                aria-label="Availability toggle"
                onClick={() => setValue('availability', availability === 'UNAVAILABLE' ? 'FULL_TIME' : 'UNAVAILABLE', { shouldDirty: true })}
                className={`relative h-6 w-11 rounded-full transition ${availability === 'UNAVAILABLE' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-green-500'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${availability === 'UNAVAILABLE' ? 'left-0.5' : 'left-[22px]'}`} />
              </button>
            </label>
          </div>
          <Field label="Phone" error={errors.phone?.message}><Input {...register('phone')} /></Field>
          <Field label="Skills (comma separated)" hint="FIRST_AID, LOGISTICS, COOKING, COMMUNICATION, DISTRIBUTION" error={errors.skills?.message}>
            <Input {...register('skills')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Availability" error={errors.availability?.message}>
              <Select {...register('availability')}>{AVAILABILITY.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}</Select>
            </Field>
            <Field label="Service area" error={errors.serviceArea?.message}><Input placeholder="Andheri" {...register('serviceArea')} /></Field>
          </div>
          {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
          {saved && !isDirty && <p className="text-sm text-green-600">✓ Saved.</p>}
          <Button type="submit" disabled={isSubmitting || !isDirty} className="w-full">{isSubmitting ? 'Saving…' : 'Save profile'}</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>How tasking works</CardTitle>
        <p className="text-sm text-slate-500">Coordinators assign low-risk tasks matching your skills. Accept or decline each one, then mark progress. Professional rescue work always stays with trained teams.</p>
      </Card>
    </div>
  );
}
