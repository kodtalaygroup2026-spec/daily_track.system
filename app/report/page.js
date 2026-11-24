'use client';
import '../styles/tech.css';
import '../styles/tech-calendar.css';
import '../styles/tech-report.css';
import { useSession } from '@/lib/auth';
import TechReport from '@/components/tech/TechReport';

export default function Page() {
  const user = useSession('tech');
  return user ? <TechReport /> : null;
}
