'use client';
/* Sign-in with Supabase. An employee code becomes the login email "<code>@dailytrack.local" (the same rule the database
   uses to build the profile), so staff only ever type their code and password.
   The signed-in user { id, code, role, name, branch } is cached in localStorage so pages can read it synchronously;
   useSession() checks that the cache still matches a live Supabase session and refreshes it from the profile row. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

const KEY = 'dailytrack.session.v2';
export const HOME = { tech: '/today', sup: '/supervisor' };
const emailOf = (code) => `${String(code).trim().toLowerCase()}@dailytrack.local`;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
function write(u) {
  try { localStorage.setItem(KEY, JSON.stringify(u)); return true; } catch (e) { return false; }
}

// the signed-in user { id, code, role, name, branch }, or null. branch '' = all branches.
export function session() {
  const s = read();
  return s && s.id && s.code && HOME[s.role] ? s : null;
}

async function loadProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('id, emp_code, role, display_name, branch, active').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!data || !data.active) return null;
  return { id: data.id, code: data.emp_code, role: data.role, name: data.display_name, branch: data.branch || '' };
}

// returns the path to open, null for a wrong code or password (or a switched-off account), false when the browser refuses
// to store the session; throws when the server cannot be reached
export async function login(code, pw) {
  if (!supabase) throw new Error('config');
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailOf(code), password: pw });
  if (error) {
    if (error.status === 400 || /invalid/i.test(error.message)) return null;
    throw error;
  }
  const u = await loadProfile(data.user.id);
  if (!u) { await supabase.auth.signOut(); return null; }
  return write(u) ? HOME[u.role] : false;
}

// saves the new display name; false when the server or the browser refuses, or nobody is signed in
export async function rename(name) {
  const s = session();
  if (!s || !supabase) return false;
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', s.id);
  if (error) return false;
  return write({ ...s, name });
}

export function logout() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored, nothing to clear */ }
  if (supabase) supabase.auth.signOut().catch(() => {});
}

export const homeFor = () => { const s = session(); return s ? HOME[s.role] : '/login'; };

/* Page guard. want = 'tech' | 'sup' | 'any' (either role) | 'login' (signed-in users are sent home).
   Returns undefined until the session has been checked, the user when the page may show, null while redirecting. */
export function useSession(want) {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    let live = true;
    const go = (u) => {
      if (!live) return;
      let ok = true;
      if (want === 'login') {
        if (u) { router.replace(HOME[u.role]); ok = false; }
      } else if (want === 'any') {
        if (!u) { router.replace('/login'); ok = false; }
      } else if (!u || u.role !== want) {
        router.replace(u ? HOME[u.role] : '/login');
        ok = false;
      }
      setUser(ok ? u : null);
    };
    (async () => {
      const cached = session();
      if (!supabase) return go(want === 'login' ? null : cached);
      let u = null;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // read the profile every visit: the supervisor may have changed the role, branch or name, or switched the account off
          u = await loadProfile(data.session.user.id);
          if (u) write(u); else supabase.auth.signOut().catch(() => {});
        }
      } catch (e) { u = cached; /* offline: keep the cached user, the next call will say what is wrong */ }
      if (!u) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
      go(u);
    })();
    return () => { live = false; };
  }, [want, router]);
  // back button after logging out must not show a cached page
  useEffect(() => {
    const onShow = (e) => { if (e.persisted && want !== 'login' && !session()) router.replace('/login'); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [want, router]);
  return user;
}
