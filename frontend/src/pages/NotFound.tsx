import { Link, useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/ui.tsx';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md p-4 py-16 text-center">
      <Card>
        <p aria-hidden className="text-6xl">🧭</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The page you are looking for does not exist or you do not have access to it.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>← Go back</Button>
          <Link to="/"><Button>Home</Button></Link>
        </div>
      </Card>
    </div>
  );
}
