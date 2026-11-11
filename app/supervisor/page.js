'use client';
import '../styles/sup.css';
import { useSession } from '@/lib/auth';
import SupDay from '@/components/sup/SupDay';

export default function Page() {
  const user = useSession('sup');
  return user ? <SupDay user={user} /> : null;
}
