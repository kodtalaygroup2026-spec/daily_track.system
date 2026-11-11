'use client';
/* Prototype sign-in kept from the static site: accounts live in this file and the session in localStorage.
   shortcut: client-side only, anyone can read the codes or edit storage; replaced by Supabase sign-in in the next step. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const KEY = 'dailytrack.session.v1';
const NAMES = 'dailytrack.names.v1'; // display names a user changed, by employee code
const USERS = {
  T01: { pw: '1234', role: 'tech', name: 'สมชาย ป.' },
  S01: { pw: '9999', role: 'sup', name: 'หัวหน้า' },
};
export const HOME = { tech: '/today', sup: '/supervisor' };

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

// the signed-in user { code, role, name }, or null. A session without a code is from an older build: sign in again.
export function session() {
  const s = read(KEY);
  return s && s.code && HOME[s.role] ? s : null;
}

// returns the path to open, null for a wrong code or password, false when the browser refuses to store the session
export function login(code, pw) {
  code = String(code).trim().toUpperCase();
  const u = USERS[code];
  if (!u || u.pw !== pw) return null;
  const name = (read(NAMES) || {})[code] || u.name;
  try { localStorage.setItem(KEY, JSON.stringify({ code, role: u.role, name })); } catch (e) { return false; }
  return HOME[u.role];
}

// keeps the new name for the next sign-in too; false when storage refuses or nobody is signed in
export function rename(name) {
  const s = session();
  if (!s) return false;
  const names = read(NAMES) || {};
  names[s.code] = name;
  s.name = name;
  try {
    localStorage.setItem(NAMES, JSON.stringify(names));
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) { return false; }
  return true;
}

export function logout() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored, nothing to clear */ }
}

export const homeFor = () => { const s = session(); return s ? HOME[s.role] : '/login'; };

/* Page guard. want = 'tech' | 'sup' | 'any' (either role) | 'login' (signed-in users are sent home).
   Returns undefined until the session has been read, the user when the page may show, null while redirecting. */
export function useSession(want) {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    const s = session();
    let ok = true;
    if (want === 'login') {
      if (s) { router.replace(HOME[s.role]); ok = false; }
    } else if (want === 'any') {
      if (!s) { router.replace('/login'); ok = false; }
    } else if (!s || s.role !== want) {
      router.replace(s ? HOME[s.role] : '/login');
      ok = false;
    }
    setUser(ok ? s : null);
  }, [want, router]);
  // back button after logging out must not show a cached page
  useEffect(() => {
    const onShow = (e) => { if (e.persisted && want !== 'login' && !session()) router.replace('/login'); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [want, router]);
  return user;
}
