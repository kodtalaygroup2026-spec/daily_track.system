'use strict';
// Prototype: sample data only, kept in this browser. Changes do not reach technician phones.
const KEY = 'dailytrack.sup.v3';
const TECHS = ['สมชาย ป.', 'วิชัย ก.', 'ประเสริฐ ท.', 'อนุชา ส.', 'สุรชัย ม.', 'ธนากร พ.', 'ณัฐพล ว.', 'กิตติ ร.'];
const PLACES = ['อาคาร A', 'อาคาร B', 'อาคาร C', 'อาคาร D', 'ลานจอดรถ', 'โรงงาน 1', 'โรงงาน 2', 'ห้องประชุม 2'];
const COMMON = ['ล้างแอร์', 'ตรวจปั๊มน้ำ', 'เปลี่ยนหลอดไฟ', 'ตรวจสายไฟ', 'ซ่อมประตู'];
const LABEL = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };
const ORDER = { todo: 0, doing: 1, done: 2 };
const FILTERS = [['all', 'ทั้งหมด'], ['todo', 'รอทำ'], ['doing', 'กำลังทำ'], ['done', 'เสร็จ'], ['photo', 'รูปไม่ครบ']];
const NAMES = { before: 'ก่อนเริ่ม', after: 'หลังเสร็จ' };
const HEADS = [['status', 'สถานะ'], ['time', 'เวลา'], ['title', 'ภารกิจ'], ['tech', 'ช่าง']];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/* ---- real clock and calendar days. A day is an ISO string "YYYY-MM-DD" in the device's own time zone. ---- */
const MIN_DAY = '2000-01-01', MAX_DAY = '2099-12-31'; // a typed two-digit year would otherwise land in 19xx
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return isoOf(d); };
// minutes from a task's scheduled moment until now (negative while it is still in the future)
const minsSince = (date, time) => (dayNum(today()) - dayNum(date)) * 1440 + nowMins() - mins(time);

// photos: before = taken to start the task, after = taken to finish it (both required by the technician app)
const T = (id, time, title, tech, place, status, x = {}) => ({ id, date: today(), time, title, tech, place, status, before: null, after: null, beforeAt: null, afterAt: null, ...x });
// the sample day is laid out around the current time, so some tasks are always done, doing, late or still ahead
const SAMPLE = () => {
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
const photoURI = (k) => (PHOTOS[k] ? 'data:image/svg+xml,' + encodeURIComponent(PHOTOS[k]) : k); // a real photo would arrive as a URL

// before is due once the task has started, after once it is done; a due photo that is absent is "missing"
const need = (t, k) => (k === 'before' ? t.status !== 'todo' : t.status === 'done');
const slot = (t, k) => (t[k] ? 'ok' : need(t, k) ? 'miss' : 'due');
const issue = (t) => slot(t, 'before') === 'miss' || slot(t, 'after') === 'miss';
const emptyText = (t, k) => (slot(t, k) === 'miss' ? 'ยังไม่ได้รับรูป' : t.status === 'todo' ? 'ยังไม่เริ่มงาน' : 'รอช่างจบงาน');

let S, toastTimer = null;
const UI = { date: today(), filter: 'all', tech: '', sort: { key: 'time', dir: 1 }, sel: null, mode: null, lastFocus: null };

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    // a sample saved on an earlier day has nothing left for today: start a fresh one
    if (d && Array.isArray(d.tasks) && d.tasks.some((t) => t.date >= today())) { S = d; return; }
  } catch (e) { /* storage unavailable: use the sample */ }
  S = SAMPLE();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

const dayTasks = () => S.tasks.filter((t) => t.date === UI.date);
function lateMins(t) { return t.status === 'done' ? 0 : Math.max(0, minsSince(t.date, t.time)); }
function dur(m) {
  m = Math.max(0, m);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), n = m % 60;
  if (d) return `${d} วัน${h ? ' ' + h + ' ชม.' : ''}`;
  return h ? `${h} ชม.${n ? ' ' + n + ' น.' : ''}` : `${m} น.`;
}
function fmtLate(m) { return 'เลย ' + dur(m); }

function visible() {
  const { key, dir } = UI.sort;
  const cmp = {
    time: (a, b) => mins(a.time) - mins(b.time) || a.id - b.id,
    status: (a, b) => ORDER[a.status] - ORDER[b.status] || mins(a.time) - mins(b.time),
    title: (a, b) => a.title.localeCompare(b.title, 'th'),
    tech: (a, b) => a.tech.localeCompare(b.tech, 'th') || mins(a.time) - mins(b.time),
  }[key];
  return dayTasks().filter((t) => (!UI.tech || t.tech === UI.tech) && (UI.filter === 'all' || (UI.filter === 'photo' ? issue(t) : t.status === UI.filter)))
    .sort((a, b) => cmp(a, b) * dir);
}

/* ---- static controls, built once so focus survives re-renders ---- */
function buildControls() {
  $('#seg').innerHTML = FILTERS.map(([k]) => `<button type="button" data-filter="${k}" aria-pressed="false"></button>`).join('');
  $('#tech').innerHTML = `<option value="">ช่างทุกคน</option>` + TECHS.map((n) => `<option>${esc(n)}</option>`).join('');
  $('#places').innerHTML = PLACES.map((p) => `<option value="${esc(p)}">`).join('');
  document.querySelectorAll('th[data-key]').forEach((th) => {
    const [, label] = HEADS.find(([k]) => k === th.dataset.key);
    th.innerHTML = `<button type="button" data-sort="${th.dataset.key}">${label}<span class="dir"></span></button>`;
  });
}

function relLabel() {
  const diff = dayNum(UI.date) - dayNum(today());
  return diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : diff === -1 ? 'เมื่อวาน' : diff > 1 ? `อีก ${diff} วัน` : `ย้อนหลัง ${-diff} วัน`;
}

function renderChrome() {
  const th = (o) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', o).format(toDate(UI.date));
  $('#date').textContent = th({ weekday: 'long' }) + ' ' + th({ day: 'numeric', month: 'short', year: 'numeric' });
  $('#rel').textContent = relLabel();
  $('#day').value = UI.date;
  $('#today').setAttribute('aria-disabled', String(UI.date === today())); // not :disabled, so a focused button keeps focus
  $('#clock').textContent = hhmm(nowMins());

  const pool = dayTasks().filter((t) => !UI.tech || t.tech === UI.tech);
  document.querySelectorAll('#seg button').forEach((b) => {
    const k = b.dataset.filter;
    const n = k === 'all' ? pool.length : k === 'photo' ? pool.filter(issue).length : pool.filter((t) => t.status === k).length;
    b.textContent = `${FILTERS.find(([f]) => f === k)[1]} ${n}`;
    b.setAttribute('aria-pressed', String(UI.filter === k));
  });
  document.querySelectorAll('th[data-key]').forEach((th) => {
    const on = UI.sort.key === th.dataset.key;
    th.setAttribute('aria-sort', on ? (UI.sort.dir > 0 ? 'ascending' : 'descending') : 'none');
    th.querySelector('.dir').innerHTML = on ? icon(UI.sort.dir > 0 ? 'up' : 'down') : '';
  });
}

function timeCell(t) {
  const late = lateMins(t);
  return late ? `<td class="late">${t.time}<small>${fmtLate(late)}</small></td>` : `<td>${t.time}</td>`;
}

function renderRows() {
  const rows = visible();
  const empty = $('#empty');
  const none = !dayTasks().length;
  $('#table').hidden = !rows.length;
  empty.hidden = !!rows.length;
  if (!rows.length) {
    empty.innerHTML = none
      ? `<h2>${UI.date === today() ? 'วันนี้' : 'วันที่นี้'}ยังไม่มีภารกิจ</h2><p>กด “สร้างภารกิจ” เพื่อมอบหมายงานให้ช่าง หรือเลือกวันอื่นจากปฏิทิน</p><button type="button" class="primary" data-act="create">${icon('plus')}สร้างภารกิจ</button>`
      : `<h2>ไม่พบภารกิจตามตัวกรอง</h2><p>ลองเลือกสถานะหรือช่างอื่น</p><button type="button" class="secondary" data-act="clear">ล้างตัวกรอง</button>`;
  }
  $('#rows').innerHTML = rows.map((t) => {
    const stat = `<td class="s" data-s="${t.status}"><span>${t.status === 'done' ? icon('check') : ''}${LABEL[t.status]}</span></td>`;
    const time = timeCell(t);
    const cell = (k) => {
      const s = slot(t, k);
      if (s === 'ok') return `<button type="button" class="shot" data-shot="${t.id}" aria-label="ดูรูป${NAMES[k]}ของ ${esc(t.title)}"><img src="${photoURI(t[k])}" alt=""></button>`;
      if (s === 'miss') return `<button type="button" class="slot miss" data-shot="${t.id}" aria-label="รอรูป${NAMES[k]}ของ ${esc(t.title)}">รอรูป</button>`;
      return `<span class="slot due"><span class="sr">ยังไม่ถึงขั้นตอนถ่ายรูป${NAMES[k]}</span>—</span>`;
    };
    const shot = `<div class="pair">${cell('before')}${cell('after')}</div>`;
    return `<tr data-id="${t.id}" data-sel="${UI.sel === t.id}" class="${t.status === 'done' ? 'is-done' : ''}">${stat}${time}
      <td class="task"><button type="button" class="open" data-open="${t.id}"${UI.sel === t.id ? ' aria-current="true"' : ''}>${esc(t.title)}</button><p>${esc(t.place)}</p></td>
      <td class="c-h">${esc(t.tech)}</td><td class="c-p">${shot}</td></tr>`;
  }).join('');
}

/* ---- drawer ---- */
const field = (id, label, control, err) =>
  `<div class="field"${err ? ' data-err' : ''}><label for="${id}">${label}</label>${control}${err ? `<p class="err" id="e-${id}" role="alert">${err}</p>` : ''}</div>`;

// a new task today starts at the next half hour; on another day, at 09:00
const defaultTime = () => (UI.date === today() ? hhmm(Math.min(Math.ceil((nowMins() + 1) / 30) * 30, 23 * 60 + 30)) : '09:00');

function formHTML(t, errs = {}, vals = {}, locked = false) {
  const v = (k) => esc(vals[k] ?? (t ? t[k] : ''));
  const d = locked ? ' disabled' : '';
  const inv = (k) => (errs[k] ? ` aria-invalid="true" aria-describedby="e-f-${k}"` : '');
  const techOpts = (t ? '' : `<option value="">เลือกช่าง</option>`) +
    TECHS.map((n) => `<option${n === (vals.tech ?? (t && t.tech)) ? ' selected' : ''}>${esc(n)}</option>`).join('');
  const quick = t ? '' : `<div class="quick" role="group" aria-label="ภารกิจที่ใช้บ่อย">${COMMON.map((c) => `<button type="button" data-quick="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  return field('f-title', 'ภารกิจ', `<input type="text" id="f-title" name="title" value="${v('title')}" autocomplete="off"${d}${inv('title')}>${quick}`, errs.title) +
    field('f-tech', 'ช่าง', `<select id="f-tech" name="tech"${d}${inv('tech')}>${techOpts}</select>`, errs.tech) +
    field('f-date', 'วันที่', `<input type="date" id="f-date" name="date" min="${MIN_DAY}" max="${MAX_DAY}" value="${vals.date ?? (t ? t.date : UI.date)}"${d}${inv('date')}>`, errs.date) +
    field('f-time', 'เวลา', `<input type="time" id="f-time" name="time" value="${vals.time ?? (t ? t.time : defaultTime())}"${d}${inv('time')}>`, errs.time) +
    field('f-place', 'สถานที่', `<input type="text" id="f-place" name="place" list="places" value="${v('place')}" autocomplete="off"${d}${inv('place')}>`, errs.place);
}

function subText(t) {
  const late = lateMins(t);
  let s = `${t.time} · ${esc(t.place)}${late ? ' · ' + fmtLate(late) : ''}`;
  // the photo times are the evidence of when work really started and ended
  if (t.beforeAt) {
    const el = minsSince(t.date, t.beforeAt);
    s += '<br>' + (t.status === 'done'
      ? `เริ่ม ${t.beforeAt}` + (t.afterAt ? ` · จบ ${t.afterAt} · ใช้เวลา ${dur(mins(t.afterAt) - mins(t.beforeAt))}` : '')
      : `เริ่ม ${t.beforeAt}` + (el >= 0 ? ` · ทำมาแล้ว ${dur(el)}` : ''));
  }
  return s;
}
// the clock moved: refresh the late text without rebuilding the form (keeps unsaved input)
function refreshSub() {
  const t = UI.mode === 'view' && S.tasks.find((x) => x.id === UI.sel);
  const el = $('#dsub');
  if (t && el) el.innerHTML = subText(t);
}

function renderDrawer(errs, vals) {
  const dr = $('#drawer');
  dr.dataset.open = String(!!UI.mode);
  const close = `<button type="button" class="x" data-act="close" aria-label="ปิด">${icon('close')}</button>`;
  if (UI.mode === 'create') {
    dr.innerHTML = `<form id="form" novalidate><div class="dhead"><h2 tabindex="-1">สร้างภารกิจ</h2>${close}</div>
      ${formHTML(null, errs, vals)}
      <div class="actions"><button type="submit" class="primary">มอบหมาย</button><button type="button" class="secondary" data-act="close">ยกเลิก</button></div></form>`;
    return;
  }
  const t = S.tasks.find((x) => x.id === UI.sel);
  if (!t) {
    dr.innerHTML = `<div class="prompt"><h2>เลือกภารกิจ</h2><p class="sub">แตะแถวในตารางเพื่อดูรายละเอียด แก้ไข หรือย้ายไปให้ช่างคนอื่น</p>
      <button type="button" class="primary" data-act="create">${icon('plus')}สร้างภารกิจ</button></div>`;
    return;
  }
  const locked = t.status === 'done';
  const fig = (k) => {
    const s = slot(t, k);
    const lab = `<span class="lab">${NAMES[k]}${t[k + 'At'] ? ' · ' + t[k + 'At'] : ''}</span>`;
    return `<div>${lab}` + (s === 'ok'
      ? `<button type="button" data-shot="${t.id}" aria-label="ดูรูป${NAMES[k]}ใหญ่ของ ${esc(t.title)}"><img src="${photoURI(t[k])}" alt="รูปตัวอย่าง${NAMES[k]} ${esc(t.title)}"></button>`
      : `<div class="noimg${s === 'miss' ? ' miss' : ''}">${emptyText(t, k)}</div>`) + '</div>';
  };
  const photo = `<div class="photo"><div class="pair2">${fig('before')}${fig('after')}</div>${t.before || t.after ? '<small>รูปตัวอย่าง · แตะเพื่อดูรูปก่อนและหลังคู่กัน</small>' : ''}</div>`;
  dr.innerHTML = `<form id="form" novalidate><div class="dhead"><div><h2 tabindex="-1">${esc(t.title)}</h2>
      <p class="sub" id="dsub">${subText(t)}</p></div>${close}</div>
    <p class="stat" data-s="${t.status}">${LABEL[t.status]}</p>
    ${formHTML(t, errs, vals, locked)}${photo}
    ${locked ? '<p class="lock">งานเสร็จแล้ว แก้ไขไม่ได้</p>' : ''}
    <div class="actions">${locked ? '' : '<button type="submit" class="primary">บันทึก</button>'}<button type="button" class="secondary" data-act="close">ปิด</button></div></form>`;
}

function render() { renderChrome(); renderRows(); renderDrawer(); }

/* ---- actions ---- */
const narrow = () => document.body.dataset.narrow === '1'; // set by applyLayout(): the drawer is a panel over the table

function open(id, from) {
  if (UI.mode === 'view' && UI.sel === id && !from) return; // re-clicking the open row must not wipe unsaved edits
  UI.sel = id; UI.mode = 'view'; UI.lastFocus = from || null;
  renderRows(); renderDrawer();
  // keyboard opens (and any open on a narrow screen) move focus into the drawer; closing returns it to the row
  if (narrow() || from === 'row') $('#drawer h2').focus();
}
function startCreate() {
  UI.sel = null; UI.mode = 'create'; UI.lastFocus = 'create';
  renderRows(); renderDrawer();
  $('#f-title').focus();
}
function closeDrawer() {
  const id = UI.sel, from = UI.lastFocus;
  UI.sel = null; UI.mode = null;
  renderRows(); renderDrawer();
  const back = id && document.querySelector(`[data-open="${id}"]`);
  (back || (from === 'create' ? $('#create') : null) || $('#create')).focus();
}
// the live region stays in the DOM (hidden by CSS class only) so screen readers announce the text change
function toast(msg) {
  const el = $('#toast');
  el.classList.remove('show');
  clearTimeout(toastTimer);
  setTimeout(() => { el.textContent = msg; el.classList.add('show'); }, 50);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 4500);
}

function submit(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const vals = { title: (f.get('title') || '').trim(), tech: f.get('tech') || '', date: f.get('date') || '', time: f.get('time') || '', place: (f.get('place') || '').trim() };
  const errs = {};
  if (!vals.title) errs.title = 'กรุณาระบุชื่อภารกิจ';
  if (!vals.tech) errs.tech = 'กรุณาเลือกช่าง';
  if (!vals.date) errs.date = 'กรุณาเลือกวันที่';
  else if (vals.date < MIN_DAY || vals.date > MAX_DAY) errs.date = 'วันที่ไม่ถูกต้อง เลือกปี พ.ศ. 2543 ถึง 2642';
  if (!vals.time) errs.time = 'กรุณาระบุเวลา';
  if (!vals.place) errs.place = 'กรุณาระบุสถานที่';
  const bad = Object.keys(errs)[0];
  if (bad) { renderDrawer(errs, vals); $('#f-' + bad).focus(); return; }

  if (UI.mode === 'create') {
    const t = T(S.nextId++, vals.time, vals.title, vals.tech, vals.place, 'todo', { date: vals.date });
    S.tasks.push(t);
    UI.date = t.date; // follow the new task to its day
    if (UI.filter !== 'all' && UI.filter !== 'todo') UI.filter = 'all';
    if (UI.tech && UI.tech !== t.tech) { UI.tech = ''; $('#tech').value = ''; }
    UI.sel = t.id; UI.mode = 'view';
    save(); render(); $('#drawer h2').focus();
    toast(`มอบหมาย “${t.title}” ให้ ${t.tech} แล้ว`);
  } else {
    const t = S.tasks.find((x) => x.id === UI.sel);
    const moved = t.tech !== vals.tech, rescheduled = t.date !== vals.date;
    Object.assign(t, vals);
    UI.date = t.date; // keep the edited row on screen, even when it moved to another day
    if (UI.tech && UI.tech !== t.tech) { UI.tech = ''; $('#tech').value = ''; } // keep the moved row on screen
    save(); render(); $('#drawer h2').focus();
    toast(rescheduled ? `ย้าย “${t.title}” ไปที่ ${relLabel() === 'วันนี้' ? 'วันนี้' : $('#date').textContent} แล้ว`
      : moved ? `ย้าย “${t.title}” ไปให้ ${t.tech} แล้ว` : `บันทึก “${t.title}” แล้ว`);
  }
}

function openLightbox(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  const fig = (k) => {
    const s = slot(t, k);
    return `<figure><figcaption>${NAMES[k]}${t[k + 'At'] ? ' · ' + t[k + 'At'] : ''}</figcaption>` + (s === 'ok'
      ? `<img src="${photoURI(t[k])}" alt="รูปตัวอย่าง${NAMES[k]} ${esc(t.title)}">`
      : `<div class="noimg${s === 'miss' ? ' miss' : ''}">${emptyText(t, k)}</div>`) + '</figure>';
  };
  $('#lbBody').innerHTML = `<div class="pair-lb">${fig('before')}${fig('after')}</div>`;
  $('#lbCap').textContent = `รูปตัวอย่าง · ${t.title} · ${t.tech}`;
  $('#lightbox').showModal();
}

/* ---- events ---- */
document.addEventListener('click', (e) => {
  const q = (s) => e.target.closest(s);
  let el;
  if ((el = q('[data-shot]'))) { e.stopPropagation(); return openLightbox(Number(el.dataset.shot)); }
  if ((el = q('[data-sort]'))) {
    const k = el.dataset.sort;
    UI.sort = UI.sort.key === k ? { key: k, dir: -UI.sort.dir } : { key: k, dir: 1 };
    renderChrome(); return renderRows();
  }
  if ((el = q('[data-filter]'))) { UI.filter = el.dataset.filter; renderChrome(); return renderRows(); }
  if ((el = q('[data-quick]'))) { $('#f-title').value = el.dataset.quick; return $('#f-tech').focus(); }
  if ((el = q('[data-act]'))) {
    const a = el.dataset.act;
    if (a === 'create') return startCreate();
    if (a === 'close') return closeDrawer();
    if (a === 'clear') { UI.filter = 'all'; UI.tech = ''; $('#tech').value = ''; renderChrome(); renderRows(); return document.querySelector('#seg button').focus(); }
  }
  if ((el = q('tbody tr'))) { const id = Number(el.dataset.id); open(id, e.target.closest('.open') ? 'row' : null); }
});

$('#create').addEventListener('click', startCreate);
$('#tech').addEventListener('change', (e) => { UI.tech = e.target.value; renderChrome(); renderRows(); });
$('#drawer').addEventListener('submit', submit);

/* ---- day navigation: arrows, native calendar, "today" ---- */
function setDay(iso) {
  if (!iso || iso === UI.date || iso < MIN_DAY || iso > MAX_DAY) return;
  UI.date = iso;
  if (UI.mode === 'create') { // a half-typed new task survives browsing; it just follows the day
    const f = $('#f-date'); if (f) f.value = iso;
    renderChrome(); renderRows();
  } else {
    Object.assign(UI, { sel: null, mode: null }); // the open task belongs to the old day
    render();
  }
  $('#dayLive').textContent = `${$('#date').textContent} · ${dayTasks().length} ภารกิจ`;
}
$('#prev').addEventListener('click', () => setDay(addDays(UI.date, -1)));
$('#next').addEventListener('click', () => setDay(addDays(UI.date, 1)));
$('#today').addEventListener('click', () => setDay(today()));
$('#day').addEventListener('change', (e) => setDay(e.target.value));
$('#pick').addEventListener('click', () => {
  const i = $('#day');
  try { i.showPicker(); } catch (e) { i.focus(); i.click(); } // older browsers: no showPicker, fall back to the field itself
});

function restart(state) {
  S = state;
  Object.assign(UI, { date: today(), filter: 'all', tech: '', sort: { key: 'time', dir: 1 }, sel: null, mode: null });
  $('#tech').value = ''; save(); render();
}
$('#reset').addEventListener('click', () => restart(SAMPLE()));

/* ---- the clock is real: once a minute, refresh the late times without stealing keyboard focus ---- */
let lastMin = nowMins(), lastDay = today();
function tick() {
  const m = nowMins(), d = today();
  if (m === lastMin && d === lastDay) return;
  const rolled = d !== lastDay;
  if (rolled && UI.date === lastDay) { // midnight: a page left on "today" follows the new day
    UI.date = d;
    if (UI.mode !== 'create') Object.assign(UI, { sel: null, mode: null });
  }
  lastMin = m; lastDay = d;
  renderChrome(); refreshSub();
  if (rolled) { renderRows(); if (UI.mode !== 'create') renderDrawer(); return; }
  // only the time cells change from minute to minute; replacing them leaves focus, scroll and clicks alone
  document.querySelectorAll('#rows tr').forEach((tr) => {
    const t = S.tasks.find((x) => x.id === Number(tr.dataset.id));
    if (t) tr.children[1].outerHTML = timeCell(t);
  });
}
setInterval(tick, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
$('#lbClose').addEventListener('click', () => $('#lightbox').close());

/* ---- left menu: docked beside the page from 1280px, a panel over it below. The docked choice is remembered. ---- */
const MENU_KEY = 'dailytrack.menu.v1', MENU_W = 240;
const docked = () => innerWidth >= 1280;
const menuIsOpen = () => document.body.classList.contains('menu-open');
function applyLayout() {
  // an open docked menu takes 15rem from the page
  document.body.dataset.narrow = innerWidth - (docked() && menuIsOpen() ? MENU_W : 0) < 1280 ? '1' : '';
}
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  $('#menuBtn').setAttribute('aria-expanded', String(open));
  if (docked()) { try { localStorage.setItem(MENU_KEY, open ? 'open' : 'closed'); } catch (e) { /* not remembered */ } }
  applyLayout();
}
function savedMenu() { try { return localStorage.getItem(MENU_KEY) !== 'closed'; } catch (e) { return true; } }
let wasDocked = docked();
setMenu(wasDocked ? savedMenu() : false);
$('#menuBtn').addEventListener('click', () => {
  const open = !menuIsOpen();
  setMenu(open);
  if (open && !docked()) $('#menu a').focus(); // a panel over the page takes focus; a docked menu leaves it on the button
});
$('#menuClose').addEventListener('click', () => { setMenu(false); $('#menuBtn').focus(); });
$('#scrim').addEventListener('click', () => { setMenu(false); $('#menuBtn').focus(); });
addEventListener('resize', () => {
  if (docked() !== wasDocked) { wasDocked = docked(); setMenu(wasDocked ? savedMenu() : false); } // crossing 1280px: panel closes, docked menu comes back
  else applyLayout();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (menuIsOpen() && !docked()) { setMenu(false); $('#menuBtn').focus(); return; }
  if (UI.mode && !$('#lightbox').open) closeDrawer();
});

buildControls(); load(); render();
