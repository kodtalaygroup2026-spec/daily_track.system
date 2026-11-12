'use client';
import '../../styles/sup.css';
import '../../styles/sup-plan.css';
import '../../styles/sup-staff.css';
import { useSession } from '@/lib/auth';
import Staff from '@/components/sup/Staff';

export default function Page() {
  const user = useSession('sup');
  return user ? <Staff user={user} /> : null;
}
