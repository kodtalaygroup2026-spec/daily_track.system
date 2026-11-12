'use client';
/* Every database call the screens make. The screens never touch Supabase directly.
   Task shape used by both the supervisor and the technician screens (camelCase, times as "HH:MM" in the device's time zone):
   { id, date, time, title, place, branch, status: 'todo'|'doing'|'done', techId|null, tech, ownerId|null, owner,
     routine, templateId, before, after (signed photo URLs or null), beforeAt, afterAt, items: [{ id, title, done }] }
   techId null = nobody yet (a routine whose technician is off that day); owner = the regular technician of a routine,
   so tech !== owner means someone is covering. Failed calls throw an Error with .code and a Thai .message. */
import { BUCKET, supabase } from './supabase';

const TEXT = {
  config: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล',
  not_allowed: 'ไม่มีสิทธิ์ทำรายการนี้',
  not_yours: 'งานนี้ไม่ใช่ของคุณ',
  not_started: 'ต้องเริ่มงานก่อน',
  stale: 'ข้อมูลเปลี่ยนไปแล้ว ลองโหลดใหม่',
  items_open: 'ยังมีงานย่อยที่ไม่ได้ติ๊ก',
  items_locked: 'งานเริ่มแล้ว แก้งานย่อยไม่ได้',
  locked: 'งานเสร็จแล้ว แก้ไขไม่ได้',
  started: 'งานเริ่มแล้ว เปลี่ยนคนทำไม่ได้',
  bad_tech: 'เลือกช่างที่ยังใช้งานอยู่',
  too_many_items: 'งานย่อยมากเกินไป (สูงสุด 30 ข้อ)',
  not_found: 'ไม่พบรายการนี้ อาจถูกลบไปแล้ว',
  bad_range: 'เลือกได้ไม่เกิน 31 วัน',
};
function fail(error) {
  const code = (error && (error.message || error.code)) || 'unknown';
  const net = /fetch|network|failed to/i.test(code);
  const e = new Error(TEXT[code] || (net ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่' : 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง'));
  e.code = net ? 'network' : code;
  return e;
}
const db = () => { if (!supabase) throw fail({ message: 'config' }); return supabase; };
async function rpc(name, args) {
  const { data, error } = await db().rpc(name, args);
  if (error) throw fail(error);
  return data;
}
async function ok(q) {
  const { data, error } = await q;
  if (error) throw fail(error);
  return data;
}
export const errText = (e) => (e && e.message) || 'ทำรายการไม่สำเร็จ';

const hm = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : null);
const items = (a) => (a || []).map((i) => ({ id: i.id, title: i.title, done: !!i.done }));

/* ---- photos: private bucket, shown through short-lived signed URLs ---- */
const urls = new Map(); // path -> { url, until }
async function sign(paths) {
  const want = [...new Set(paths.filter(Boolean))].filter((p) => !urls.has(p) || urls.get(p).until < Date.now());
  if (want.length) {
    const { data } = await db().storage.from(BUCKET).createSignedUrls(want, 3600);
    (data || []).forEach((r) => { if (r.signedUrl) urls.set(r.path, { url: r.signedUrl, until: Date.now() + 50 * 60 * 1000 }); });
  }
  return (p) => (p && urls.has(p) ? urls.get(p).url : null);
}

// a camera photo as a JPEG blob, then its storage path; the path must be sent to tech_start / tech_finish / tech_set_photo
export async function uploadPhoto(taskId, kind, blob) {
  const path = `${taskId}/${kind}-${Date.now()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw fail(error);
  return path;
}

/* ---- supervisor: the days ---- */
// { tasks, absent: [{ techId, day, note }], techs: [{ id, code, name, branch, active, days }] } for from..to (at most 31 days)
// reading also creates the routine tasks of those days, so it is the one call a day screen needs
export async function supDay(from, to = from) {
  const r = await rpc('sup_day', { p_from: from, p_to: to });
  const pick = await sign(r.tasks.flatMap((t) => [t.before_path, t.after_path]));
  return {
    tasks: r.tasks.map((t) => ({
      id: t.id, date: t.date, time: t.time, title: t.title, place: t.place, branch: t.branch, status: t.status,
      techId: t.tech_id, tech: t.tech, ownerId: t.owner_id, owner: t.owner, routine: t.routine, templateId: t.template_id,
      before: pick(t.before_path), after: pick(t.after_path), beforeAt: hm(t.before_at), afterAt: hm(t.after_at), items: items(t.items),
    })),
    absent: r.absent.map((a) => ({ techId: a.tech_id, day: a.day, note: a.note })),
    techs: r.techs.map((p) => ({ id: p.id, code: p.code, name: p.name, branch: p.branch, active: p.active, days: p.days })),
  };
}

// v = { title, place, branch, date, time, techId, items: [string] } ; the new task id
export const createTask = (v) => rpc('create_task', { p_title: v.title, p_place: v.place, p_branch: v.branch, p_date: v.date, p_time: v.time, p_tech: v.techId, p_items: v.items || [] });
// items undefined = leave the sub-tasks alone (they can only change before the task starts)
export const updateTask = (id, v) => rpc('update_task', { p_id: id, p_title: v.title, p_place: v.place, p_branch: v.branch, p_date: v.date, p_time: v.time, p_tech: v.techId, p_items: v.items === undefined ? null : v.items });
// call another technician in for one task; techId null = nobody yet
export const assignCover = (taskId, techId) => rpc('assign_cover', { p_task: taskId, p_tech: techId });

/* ---- supervisor: routine (daily) tasks ---- */
// [{ id, title, place, branch, time, ownerId, owner, startsOn, active, items: [string] }]
export async function listTemplates() {
  const rows = await ok(db().from('task_templates').select('id, title, place, branch, start_time, owner_id, starts_on, active, owner:profiles!task_templates_owner_id_fkey(display_name), template_items(position, title)').order('start_time'));
  return rows.map((t) => ({
    id: t.id, title: t.title, place: t.place, branch: t.branch, time: String(t.start_time).slice(0, 5), ownerId: t.owner_id,
    owner: (t.owner && t.owner.display_name) || '', startsOn: t.starts_on, active: t.active,
    items: [...t.template_items].sort((a, b) => a.position - b.position).map((i) => i.title),
  }));
}
// v = { id (omit to create), title, place, branch, time, ownerId, startsOn, active, items: [string] } ; the template id
// the change reaches every routine task that is not started and not covered by hand, from today on
export const saveTemplate = (v) => rpc('save_template', { p_id: v.id || null, p_title: v.title, p_place: v.place, p_branch: v.branch, p_time: v.time, p_owner: v.ownerId, p_starts_on: v.startsOn || null, p_active: v.active !== false, p_items: v.items || [] });
export const deleteTemplate = (id) => rpc('delete_template', { p_id: id });

/* ---- supervisor: the weekly roster, absences, staff ---- */
// the technicians with the weekdays they work (0 = Sunday ... 6 = Saturday): [{ id, code, name, branch, active, days }]
export async function getRoster() {
  const [people, days] = await Promise.all([
    ok(db().from('profiles').select('id, emp_code, display_name, branch, active').eq('role', 'tech').order('emp_code')),
    ok(db().from('tech_days').select('tech_id, dow')),
  ]);
  return people.map((p) => ({ id: p.id, code: p.emp_code, name: p.display_name, branch: p.branch, active: p.active, days: days.filter((d) => d.tech_id === p.id).map((d) => d.dow).sort() }));
}
// the routines of the days a technician stops working lose their technician, ready for someone to cover
export const setRoster = (techId, days) => rpc('set_roster', { p_tech: techId, p_days: days });
export async function listAbsences(from, to) {
  const rows = await ok(db().from('absences').select('tech_id, day, note').gte('day', from).lte('day', to));
  return rows.map((a) => ({ techId: a.tech_id, day: a.day, note: a.note }));
}
export const setAbsent = (techId, day, absent, note = '') => rpc('set_absent', { p_tech: techId, p_day: day, p_absent: absent, p_note: note });
export const setStaff = (id, { name, branch, active }) => rpc('set_staff', { p_id: id, p_name: name, p_branch: branch, p_active: active });

/* ---- technician ---- */
// today's own tasks (routine tasks included) ordered by time
export async function techDay(day) {
  const rows = await rpc('tech_day', { p_day: day });
  const pick = await sign(rows.flatMap((t) => [t.before_path, t.after_path]));
  return rows.map((t) => ({
    id: t.id, date: day, time: t.time, title: t.title, place: t.place, status: t.status, routine: t.routine, coverFor: t.cover_for || '',
    before: pick(t.before_path), after: pick(t.after_path), beforeAt: hm(t.before_at), afterAt: hm(t.after_at), items: items(t.items),
  }));
}
export const techStart = (taskId, path) => rpc('tech_start', { p_task: taskId, p_before_path: path });
// finishing needs every sub-task ticked (the server refuses with code items_open otherwise)
export const techFinish = (taskId, path) => rpc('tech_finish', { p_task: taskId, p_after_path: path });
export const techSetPhoto = (taskId, kind, path) => rpc('tech_set_photo', { p_task: taskId, p_kind: kind, p_path: path });
export const techUndo = (taskId) => rpc('tech_undo', { p_task: taskId });
export const techSetItem = (itemId, done) => rpc('tech_set_item', { p_item: itemId, p_done: done });
