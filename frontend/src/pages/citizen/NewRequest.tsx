import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { LocationPicker } from '../../components/Maps.tsx';
import { Button, Card, Field, Input, Select, Textarea, reportFormError, useToast } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { useSubmitRequest } from '../../lib/queries.ts';

// Mirrors backend createRequestSchema.
const schema = z.object({
  emergencyType: z.string().min(1, 'Pick an emergency type'),
  peopleAffected: z.coerce.number().int().min(1, 'At least 1 person').max(100000),
  injuryPresent: z.boolean(),
  injurySeverity: z.string().optional(),
  location: z.string().min(2, 'Describe the location').max(500),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  description: z.string().min(5, 'Give a few more details (min 5 characters)').max(2000),
});
type Form = z.infer<typeof schema>;

export default function NewRequest() {
  const { options } = useMeta();
  const { push } = useToast();
  const navigate = useNavigate();
  const submit = useSubmitRequest();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, setError, trigger, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { emergencyType: '', peopleAffected: 1, injuryPresent: false, injurySeverity: 'UNKNOWN', location: '', latitude: null, longitude: null, description: '' },
  });
  const injuryPresent = watch('injuryPresent');
  const injurySeverities = options('injurySeverities');

  async function next(fromStep: number) {
    const fields: Record<number, Array<keyof Form>> = {
      1: ['emergencyType', 'peopleAffected'],
      2: ['location'],
      3: ['description'],
    };
    if (await trigger(fields[fromStep])) setStep(fromStep + 1);
  }

  async function onSubmit(data: Form) {
    setServerError(null);
    try {
      const created = await submit.mutateAsync({
        emergencyType: data.emergencyType,
        description: data.description,
        location: data.location,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        peopleAffected: data.peopleAffected,
        injuryPresent: data.injuryPresent,
        injurySeverity: data.injuryPresent ? (data.injurySeverity || 'UNKNOWN') : 'NONE',
      });
      push('success', 'Emergency request submitted — authorities have been notified.');
      navigate(`/my-requests/${created.id}`);
    } catch (err) {
      reportFormError(err, { setError: setError as never, setServerError, push });
    }
  }

  const steps = ['Emergency type', 'Location', 'Details & confirm'];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🆘 Request emergency help</h1>
      <ol aria-label="Progress" className="mb-4 mt-3 flex gap-1">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <p className={`mt-1 text-[11px] font-semibold ${i + 1 <= step ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}>{i + 1}. {s}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card>
            <Field label="What kind of emergency is it?" error={errors.emergencyType?.message}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Emergency type">
                {options('emergencyTypes').map((t) => (
                  <label key={t.value} className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950 ${watch('emergencyType') === t.value ? '' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" value={t.value} {...register('emergencyType')} className="sr-only" />
                    <span aria-hidden className="text-2xl">{t.icon ?? '🆘'}</span>
                    <span className="text-xs font-semibold">{t.label}</span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="People affected" error={errors.peopleAffected?.message} htmlFor="people">
                <Input id="people" type="number" min={1} {...register('peopleAffected')} />
              </Field>
              <Field label="Injuries?" htmlFor="inj">
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  <input id="inj" type="checkbox" {...register('injuryPresent')} className="h-4 w-4 accent-brand-600" /> Anyone injured?
                </label>
              </Field>
            </div>
            {injuryPresent && (
              <div className="mt-3">
                <Field label="Injury severity" htmlFor="sev">
                  <Select id="sev" {...register('injurySeverity')}>
                    {injurySeverities.filter((s) => s.value !== 'NONE').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            <div className="mt-4 flex justify-end"><Button type="button" onClick={() => void next(1)}>Continue →</Button></div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <Field label="Pin the location on the map" hint="GPS coordinates go to rescue teams; only assigned teams see exact coordinates.">
              <LocationPicker
                value={{ latitude: watch('latitude'), longitude: watch('longitude') }}
                onChange={(v) => { setValue('latitude', v.latitude); setValue('longitude', v.longitude); }}
              />
            </Field>
            <div className="mt-3">
              <Field label="Street address / landmark" error={errors.location?.message} htmlFor="loc">
                <Input id="loc" placeholder="e.g. Bldg 7, Andheri West, near station" {...register('location')} />
              </Field>
            </div>
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button type="button" onClick={() => void next(2)}>Continue →</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <Field label="What exactly is happening?" error={errors.description?.message} htmlFor="desc">
              <Textarea id="desc" rows={4} placeholder="Who needs help, access constraints, landmarks…" {...register('description')} />
            </Field>
            <dl className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Type</dt><dd className="font-semibold">{watch('emergencyType')}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">People</dt><dd className="font-semibold">{watch('peopleAffected')}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Location</dt><dd className="text-right font-semibold">{watch('location')}{watch('latitude') != null && ` (${watch('latitude')}, ${watch('longitude')})`}</dd></div>
            </dl>
            {serverError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button type="submit" disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : '✓ Confirm & submit'}</Button>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}
