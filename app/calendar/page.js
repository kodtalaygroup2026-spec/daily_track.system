'use client';
import '../styles/tech.css';
import '../styles/tech-calendar.css';
import { useSession } from '@/lib/auth';
import TechCalendar from '@/components/tech/TechCalendar';

export default function Page() {
  const user = useSession('tech');
  return user ? <TechCalendar /> : null;
}
