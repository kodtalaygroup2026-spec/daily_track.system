'use client';
import '../../styles/sup.css';
import '../../styles/sup-plan.css';
import { useSession } from '@/lib/auth';
import Roster from '@/components/sup/Roster';

export default function Page() {
  const user = useSession('sup');
  return user ? <Roster user={user} /> : null;
}
