// Staff accounts for Daily Track. Only an active supervisor may call it: creating a login, resetting a password and
// reading last sign-in times need the admin key, which never leaves this function.
// verify_jwt is off because the new API keys are not JWTs; the caller's session token is checked below instead.
// Deploy: Supabase dashboard > Edge Functions > staff-admin (verify JWT off), or `supabase functions deploy staff-admin --no-verify-jwt`.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const key = (plural: string, legacy: string) => {
  try { const k = JSON.parse(Deno.env.get(plural) ?? '{}')['default']; if (k) return k as string; } catch (_) { /* fall back */ }
  return Deno.env.get(legacy) ?? '';
};
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const PUBLISHABLE = key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SECRET = key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const DOMAIN = '@dailytrack.local';
const BRANCHES = ['', 'rca', 'bn', 'ck'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// bcrypt (used by Auth) takes at most 72 bytes, and a Thai letter is 3 bytes
const goodPassword = (p: unknown) => typeof p === 'string' && p.length >= 8 && new TextEncoder().encode(p).length <= 72;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!URL_ || !PUBLISHABLE || !SECRET) return json({ error: 'config' }, 500);

  // who is calling: the session token must be valid and belong to an active supervisor
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'not_allowed' }, 401);
  const caller = createClient(URL_, PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await caller.auth.getUser(token);
  if (!who?.user) return json({ error: 'not_allowed' }, 401);
  const { data: isSup } = await caller.rpc('is_sup');
  if (isSup !== true) return json({ error: 'not_allowed' }, 403);
  const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  // belt and braces: read the caller's own profile too, so this never rests on is_sup() alone
  const { data: me } = await admin.from('profiles').select('role,active').eq('id', who.user.id).maybeSingle();
  if (!me || me.role !== 'sup' || me.active !== true) return json({ error: 'not_allowed' }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad_request' }, 400);

  if (body.action === 'list') {
    // last sign-in per user, for the staff table
    const seen: Record<string, string | null> = {};
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: 'failed' }, 500);
      for (const u of data.users) seen[u.id] = u.last_sign_in_at ?? null;
      if (data.users.length < 1000) break;
    }
    return json({ seen });
  }

  if (body.action === 'create') {
    if (typeof body.code !== 'string') return json({ error: 'bad_code' }, 400);
    if (typeof body.name !== 'string') return json({ error: 'bad_value' }, 400);
    const code = body.code.trim().toUpperCase();
    const name = body.name.trim();
    const role = body.role === 'sup' ? 'sup' : body.role === 'tech' ? 'tech' : '';
    const branch = String(body.branch ?? '');
    if (!/^[A-Z0-9]{2,12}$/.test(code)) return json({ error: 'bad_code' }, 400);
    if (!name || name.length > 40) return json({ error: 'bad_value' }, 400);
    if (!role || !BRANCHES.includes(branch)) return json({ error: 'bad_value' }, 400);
    if (role === 'tech' && !branch) return json({ error: 'branch_required' }, 400);
    if (!goodPassword(body.password)) return json({ error: 'bad_password' }, 400);

    const { data: taken } = await admin.from('profiles').select('id').eq('emp_code', code).maybeSingle();
    if (taken) return json({ error: 'code_taken' }, 409);
    const { data: made, error } = await admin.auth.admin.createUser({
      email: code.toLowerCase() + DOMAIN, password: body.password as string, email_confirm: true,
    });
    if (error || !made?.user) {
      const dup = /already|registered|exists/i.test(error?.message ?? '');
      return json({ error: dup ? 'code_taken' : 'failed' }, dup ? 409 : 500);
    }

    // a database trigger has just made the profile; fill in the rest, and undo the login if that fails
    const { error: perr } = await admin.from('profiles').update({ display_name: name, role, branch }).eq('id', made.user.id);
    if (perr) {
      const { error: derr } = await admin.auth.admin.deleteUser(made.user.id);
      if (derr) await admin.from('profiles').update({ active: false }).eq('id', made.user.id); // an orphan login must at least be switched off
      return json({ error: 'failed' }, 500);
    }
    if (role === 'sup') await admin.from('tech_days').delete().eq('tech_id', made.user.id);
    return json({ id: made.user.id, code });
  }

  if (body.action === 'password') {
    const id = String(body.id ?? '');
    if (!UUID.test(id)) return json({ error: 'bad_value' }, 400);
    if (!goodPassword(body.password)) return json({ error: 'bad_password' }, 400);
    const { data: p } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
    if (!p) return json({ error: 'not_found' }, 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password as string });
    if (error) return json({ error: 'failed' }, 500);
    await admin.rpc('revoke_user_sessions', { p_user: id }); // a reset must also end sign-ins that used the old password
    return json({ ok: true });
  }

  if (body.action === 'recode') {
    // the employee code is the login: change the Auth email and the profile together, and put the email back if the profile fails
    const id = String(body.id ?? '');
    if (!UUID.test(id) || typeof body.code !== 'string') return json({ error: 'bad_value' }, 400);
    const code = body.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(code)) return json({ error: 'bad_code' }, 400);
    const { data: cur } = await admin.from('profiles').select('emp_code').eq('id', id).maybeSingle();
    if (!cur) return json({ error: 'not_found' }, 404);
    if (cur.emp_code === code) return json({ ok: true, code });
    const { data: taken } = await admin.from('profiles').select('id').eq('emp_code', code).maybeSingle();
    if (taken) return json({ error: 'code_taken' }, 409);
    const { error: e1 } = await admin.auth.admin.updateUserById(id, { email: code.toLowerCase() + DOMAIN, email_confirm: true });
    if (e1) {
      const dup = /already|registered|exists/i.test(e1.message ?? '');
      return json({ error: dup ? 'code_taken' : 'failed' }, dup ? 409 : 500);
    }
    const { error: e2 } = await admin.from('profiles').update({ emp_code: code }).eq('id', id);
    if (e2) {
      const { error: e3 } = await admin.auth.admin.updateUserById(id, { email: String(cur.emp_code).toLowerCase() + DOMAIN, email_confirm: true });
      if (e3) console.error('recode revert failed: login is now', code, 'profile still', cur.emp_code, id);
      return json({ error: e3 ? 'failed_partial' : 'failed' }, 500);
    }
    return json({ ok: true, code });
  }

  if (body.action === 'delete') {
    // the database checks and tidies first (as the caller, so is_sup applies); then the login goes and the profile follows
    const id = String(body.id ?? '');
    if (!UUID.test(id)) return json({ error: 'bad_value' }, 400);
    const { error: perr } = await caller.rpc('prepare_delete_staff', { p_id: id });
    if (perr) {
      const known = ['not_allowed', 'not_found', 'self_lock', 'owns_templates', 'not_off'];
      if (!known.includes(perr.message)) return json({ error: 'failed' }, 500); // a fault, not a refusal
      return json({ error: perr.message }, 409);
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    // a second click that lost the race finds the user already gone: that is the outcome asked for
    if (error && !/not.?found/i.test(error.message ?? '')) return json({ error: 'failed' }, 500);
    return json({ ok: true });
  }

  return json({ error: 'bad_request' }, 400);
});
