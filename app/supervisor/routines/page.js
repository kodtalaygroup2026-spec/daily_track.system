'use client';
import '../../styles/sup.css';
import '../../styles/sup-plan.css';
import { useSession } from '@/lib/auth';
import Routines from '@/components/sup/Routines';

export default function Page() {
  const user = useSession('sup');
  return user ? <Routines user={user} /> : null;
}
