// Technician day persistence. Same localStorage keys and shapes as the static site, so the UI never learns where data lives.
// Prototype: sample data only, state kept in this browser. shortcut: swap these two functions for a database call later.
export const KEY = 'dailytrack.sample.v2';
const PKEY = KEY + '.photos'; // photos live apart from task state, so a full storage quota can never lose a status change

// one drawn sample photo, shown only so the sample day is consistent
const SHOT = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='128' y='60' width='64' height='140' rx='14' fill='#D6261E'/><rect x='146' y='36' width='28' height='30' rx='6' fill='#14181B'/><rect x='140' y='110' width='40' height='30' rx='4' fill='#EDF0EE'/></svg>");
const SAMPLE = () => [
  { id: 1, title: 'ล้างแอร์ ห้อง 302', time: '08:00', place: 'อาคาร B', status: 'done', before: SHOT, after: SHOT, beforeAt: '08:02', afterAt: '08:41' },
  { id: 2, title: 'เปลี่ยนเบรกเกอร์', time: '10:30', place: 'ตู้ไฟชั้น 2 อาคาร A', status: 'doing', before: SHOT, beforeAt: '10:34' },
  { id: 3, title: 'ตรวจปั๊มน้ำ', time: '13:00', place: 'โรงงาน 2', status: 'todo' },
  { id: 4, title: 'ซ่อมไฟทางเดิน', time: '15:00', place: 'ลานจอดรถ', status: 'todo' },
  { id: 5, title: 'เช็คสายไฟชั้น 5', time: '16:30', place: 'อาคาร C', status: 'todo' },
];

// { tasks, queue }: the stored day, or the sample when nothing usable is stored
export function loadDay() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tasks)) {
      const tasks = d.tasks;
      try {
        const p = JSON.parse(localStorage.getItem(PKEY)) || {};
        tasks.forEach((t) => Object.assign(t, p[t.id]));
      } catch (e) { /* photos lost: a doing task without its before photo shows the repair button */ }
      return { tasks, queue: d.queue || [] };
    }
  } catch (e) { /* storage unavailable: start from the sample */ }
  return { tasks: SAMPLE(), queue: [] };
}

// returns false when the photos did not fit in storage (task state is written first and separately)
export function saveDay(tasks, queue) {
  try { localStorage.setItem(KEY, JSON.stringify({ tasks: tasks.map(({ before, after, ...t }) => t), queue })); } catch (e) { /* ignore */ }
  try {
    localStorage.setItem(PKEY, JSON.stringify(Object.fromEntries(
      tasks.filter((t) => t.before || t.after).map((t) => [t.id, { before: t.before, after: t.after }]))));
    return true;
  } catch (e) { return false; }
}
