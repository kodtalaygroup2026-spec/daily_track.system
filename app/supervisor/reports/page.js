'use client';
import '../../styles/sup.css';
import '../../styles/sup-plan.css';
import '../../styles/sup-reports.css';
import { useSession } from '@/lib/auth';
import Reports from '@/components/sup/Reports';

export default function Page() {
  const user = useSession('sup');
  return user ? <Reports user={user} /> : null;
}
