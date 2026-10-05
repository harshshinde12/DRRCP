import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { homeForRole, useAuth } from '../lib/auth.tsx';
import { useMeta } from '../lib/meta.tsx';
import { Button, Card, Field, Input, Select, Textarea, formatApiError } from '../components/ui.tsx';

// Mirrors backend registerSchema (role constrained to public roles server-side too).
const registerSchema = z.object({
  name: z.string().min(2, 'Name needs at least 2 characters').max(100),
  email: z.string().email('Enter a valid email').max(255),
  password: z.string().min(8, 'Minimum 8 characters').max(128),
  phone: z.string().max(20).optional().or(z.literal('')),
  role: z.string().min(1, 'Pick a role'),
  address: z.string().max(500).optional().or(z.literal('')),
  skills: z.string().max(500).optional().or(z.literal('')),
  availability: z.string().max(100).optional().or(z.literal('')),
  serviceArea: z.string().max(200).optional().or(z.literal('')),
  organizationName: z.string().max(200).optional().or(z.literal('')),
});
type RegisterInput = z.infer<typeof registerSchema>;

export default function Register() {
  const { isAuthenticated, user, register: doRegister } = useAuth();
  const { options } = useMeta();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', phone: '', role: 'CITIZEN', address: '', skills: '', availability: 'FULL_TIME', serviceArea: '', organizationName: '' },
  });
  const role = watch('role');
  const publicRoles = options('publicRoles');

  if (isAuthenticated && user) return <Navigate to={homeForRole(user.role)} replace />;

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    try {
      const payload: Record<string, string> = { name: data.name, email: data.email, password: data.password, role: data.role };
      for (const k of ['phone', 'address', 'skills', 'availability', 'serviceArea', 'organizationName'] as const) {
        if (data[k]) payload[k] = data[k] as string;
      }
      const u = await doRegister(payload);
      navigate(homeForRole(u.role), { replace: true });
    } catch (err) {
      setServerError(formatApiError(err));
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4 py-8">
      <Card>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Join the response network</h1>
        <p className="mb-4 text-sm text-slate-500">Admins and rescue-team accounts are provisioned by an administrator.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" error={errors.name?.message} htmlFor="name"><Input id="name" {...register('name')} /></Field>
            <Field label="Role" error={errors.role?.message} htmlFor="role">
              <Select id="role" {...register('role')}>
                {publicRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message} htmlFor="email"><Input id="email" type="email" {...register('email')} /></Field>
            <Field label="Password" error={errors.password?.message} htmlFor="password"><Input id="password" type="password" autoComplete="new-password" {...register('password')} /></Field>
          </div>
          <Field label="Phone (optional)" error={errors.phone?.message} htmlFor="phone"><Input id="phone" {...register('phone')} /></Field>
          {role === 'CITIZEN' && (
            <Field label="Address (optional)" htmlFor="address"><Textarea id="address" rows={2} {...register('address')} /></Field>
          )}
          {role === 'VOLUNTEER' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Skills (comma separated)" hint="e.g. FIRST_AID, LOGISTICS" error={errors.skills?.message} htmlFor="skills"><Input id="skills" placeholder="FIRST_AID, LOGISTICS" {...register('skills')} /></Field>
              <Field label="Service area" htmlFor="serviceArea"><Input id="serviceArea" placeholder="Andheri" {...register('serviceArea')} /></Field>
            </div>
          )}
          {role === 'NGO' && (
            <Field label="Organization name" htmlFor="organizationName"><Input id="organizationName" {...register('organizationName')} /></Field>
          )}
          {serverError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
        </form>
        <p className="mt-3 text-center text-sm text-slate-500">Have an account? <Link className="link font-semibold" to="/login">Log in</Link></p>
      </Card>
    </div>
  );
}
