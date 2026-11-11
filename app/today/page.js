'use client';
import '../styles/tech.css';
import { useSession } from '@/lib/auth';
import TechDay from '@/components/tech/TechDay';

export default function Page() {
  const user = useSession('tech');
  return user ? <TechDay user={user} /> : null;
}
