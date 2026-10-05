import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { homeForRole, useAuth } from '../lib/auth.tsx';
import { Button, Card, Field, Input, reportFormError } from '../components/ui.tsx';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginInput = z.infer<typeof loginSchema>;

const DEMO = [
  { email: 'admin@drrcp.local', role: 'ADMIN' },
  { email: 'citizen1@drrcp.local', role: 'CITIZEN' },
  { email: 'team.alpha@drrcp.local', role: 'RESCUE_TEAM' },
  { email: 'volunteer1@drrcp.local', role: 'VOLUNTEER' },
  { email: 'shelter.manager@drrcp.local', role: 'SHELTER_MANAGER' },
  { email: 'ngo1@drrcp.local', role: 'NGO' },
];

export default function Login() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (isAuthenticated && user) return <Navigate to={location.state?.from ?? homeForRole(user.role)} replace />;

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    try {
      const u = await login(data.email, data.password);
      navigate(location.state?.from ?? homeForRole(u.role), { replace: true });
    } catch (err) {
      reportFormError(err, { setError: setError as never, setServerError });
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 py-10">
      <Card>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mb-4 text-sm text-slate-500">Log in to your coordination workspace.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Email" error={errors.email?.message} htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.org" {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          {serverError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Signing in…' : 'Log in'}</Button>
        </form>
        <p className="mt-3 text-center text-sm text-slate-500">No account? <Link className="link font-semibold" to="/register">Register</Link></p>
      </Card>
      <Card className="mt-3">
        <p className="label">One-click demo logins (password: Password@123)</p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => { setValue('email', d.email); setValue('password', 'Password@123'); }}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              {d.role}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
