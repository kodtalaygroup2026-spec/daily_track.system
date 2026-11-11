// Supervisor persistence. Same localStorage key and data shape as the static site, so the UI never learns where data lives.
// Prototype: sample data only, kept in this browser. shortcut: swap loadSup/saveSup for a database call later.
import { hhmm, nowMins, today } from './dates';

export const KEY = 'dailytrack.sup.v3';
export const TECHS = ['สมชาย ป.', 'วิชัย ก.', 'ประเสริฐ ท.', 'อนุชา ส.', 'สุรชัย ม.', 'ธนากร พ.', 'ณัฐพล ว.', 'กิตติ ร.'];
export const PLACES = ['อาคาร A', 'อาคาร B', 'อาคาร C', 'อาคาร D', 'ลานจอดรถ', 'โรงงาน 1', 'โรงงาน 2', 'ห้องประชุม 2'];
export const COMMON = ['ล้างแอร์', 'ตรวจปั๊มน้ำ', 'เปลี่ยนหลอดไฟ', 'ตรวจสายไฟ', 'ซ่อมประตู'];

// photos: before = taken to start the task, after = taken to finish it (both required by the technician app)
export const newTask = (id, time, title, tech, place, status, x = {}) => ({ id, date: today(), time, title, tech, place, status, before: null, after: null, beforeAt: null, afterAt: null, ...x });
const T = newTask;

// the sample day is laid out around the current time, so some tasks are always done, doing, late or still ahead
export const sampleSup = () => {
  const base = Math.min(Math.max(Math.floor(nowMins() / 30) * 30, 180), 1229); // keeps every offset (-180..+210) inside the day
  const at = (off) => hhmm(base + off);
  return {
    nextId: 15,
    tasks: [
      T(1, at(-180), 'ล้างแอร์ ห้อง 302', 'สมชาย ป.', 'อาคาร B', 'done', { before: 'a', beforeAt: at(-178), after: 'a2', afterAt: at(-139) }),
      T(2, at(-150), 'ตรวจถังดับเพลิง', 'สุรชัย ม.', 'อาคาร C', 'done', { before: 'b', beforeAt: at(-147), after: 'b2', afterAt: at(-122) }),
      T(3, at(-120), 'ซ่อมมือจับประตู', 'กิตติ ร.', 'อาคาร B', 'done', { before: 'b', beforeAt: at(-116) }), // finished, after photo missing
      T(4, at(-90), 'ซ่อมประตูเหล็ก', 'วิชัย ก.', 'อาคาร D', 'doing', { before: 'a', beforeAt: at(-84) }),
      T(5, at(-60), 'เปลี่ยนเบรกเกอร์', 'สมชาย ป.', 'ตู้ไฟชั้น 2 อาคาร A', 'doing', { before: 'b', beforeAt: at(-56) }),
      T(6, at(-30), 'เปลี่ยนหลอดไฟ', 'ประเสริฐ ท.', 'ลานจอดรถ', 'todo'),
      T(7, at(-30), 'ตรวจแอร์', 'อนุชา ส.', 'ห้องประชุม 2', 'doing'), // started, before photo missing
      T(8, at(0), 'ตรวจตู้ควบคุม', 'สุรชัย ม.', 'อาคาร C', 'todo'),
      T(9, at(30), 'ตรวจปั๊มน้ำ', 'สมชาย ป.', 'โรงงาน 2', 'todo'),
      T(10, at(30), 'ตรวจระบบน้ำ', 'ณัฐพล ว.', 'อาคาร A', 'todo'),
      T(11, at(60), 'ซ่อมไฟทางเดิน', 'ธนากร พ.', 'ลานจอดรถ', 'todo'),
      T(12, at(90), 'ล้างแอร์ ห้อง 401', 'อนุชา ส.', 'อาคาร B', 'todo'),
      T(13, at(150), 'เช็คสายไฟชั้น 5', 'อนุชา ส.', 'อาคาร C', 'todo'),
      T(14, at(210), 'ตรวจมาตรวัดน้ำ', 'ประเสริฐ ท.', 'โรงงาน 1', 'todo'),
    ],
  };
};

// Synthetic sample photos, drawn here; every one is labelled "รูปตัวอย่าง" where it is shown.
const PHOTOS = {
  a: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='50' y='56' width='220' height='96' rx='10' fill='#14181B'/><rect x='66' y='72' width='188' height='14' rx='4' fill='#EDF0EE'/><circle cx='230' cy='120' r='14' fill='#17713D'/><rect x='80' y='170' width='160' height='10' rx='5' fill='#8A938E'/></svg>",
  a2: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='50' y='56' width='220' height='96' rx='10' fill='#17713D'/><rect x='66' y='72' width='188' height='14' rx='4' fill='#EDF0EE'/><rect x='66' y='96' width='120' height='10' rx='4' fill='#EDF0EE'/><circle cx='230' cy='120' r='14' fill='#EDF0EE'/><rect x='80' y='170' width='160' height='10' rx='5' fill='#8A938E'/></svg>",
  b2: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='128' y='60' width='64' height='140' rx='14' fill='#D6261E'/><rect x='146' y='36' width='28' height='30' rx='6' fill='#17713D'/><rect x='170' y='44' width='36' height='8' rx='4' fill='#14181B'/><rect x='140' y='110' width='40' height='30' rx='4' fill='#EDF0EE'/><rect x='146' y='150' width='28' height='8' rx='4' fill='#EDF0EE'/></svg>",
  b: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='128' y='60' width='64' height='140' rx='14' fill='#D6261E'/><rect x='146' y='36' width='28' height='30' rx='6' fill='#14181B'/><rect x='170' y='44' width='36' height='8' rx='4' fill='#14181B'/><rect x='140' y='110' width='40' height='30' rx='4' fill='#EDF0EE'/></svg>",
};
export const photoURI = (k) => (PHOTOS[k] ? 'data:image/svg+xml,' + encodeURIComponent(PHOTOS[k]) : k); // a real photo would arrive as a URL

// { nextId, tasks }: the stored data, or a fresh sample
export function loadSup() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    // a sample saved on an earlier day has nothing left for today: start a fresh one
    if (d && Array.isArray(d.tasks) && d.tasks.some((t) => t.date >= today())) return d;
  } catch (e) { /* storage unavailable: use the sample */ }
  return sampleSup();
}

export function saveSup(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
