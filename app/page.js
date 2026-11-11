'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor } from '@/lib/auth';

// "/" sends each visitor to their own page, or to sign in
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace(homeFor()); }, [router]);
  return null;
}
