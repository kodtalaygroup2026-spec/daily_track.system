'use strict';
// Prototype: sample data only, state kept in this browser. No backend yet.
// Photos are the gate: a task starts only with a BEFORE photo and finishes only with an AFTER photo.
const KEY = 'dailytrack.sample.v2';
const PKEY = KEY + '.photos'; // photos live apart from task state, so a full storage quota can never lose a status change
const LABEL = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };
// one drawn sample photo, shown only so the sample day is consistent
const SHOT = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'><rect width='320' height='240' fill='#C9D1CD'/><rect x='128' y='60' width='64' height='140' rx='14' fill='#D6261E'/><rect x='146' y='36' width='28' height='30' rx='6' fill='#14181B'/><rect x='140' y='110' width='40' height='30' rx='4' fill='#EDF0EE'/></svg>");
const SAMPLE = () => [
  { id: 1, title: 'ล้างแอร์ ห้อง 302', time: '08:00', place: 'อาคาร B', status: 'done', before: SHOT, after: SHOT, beforeAt: '08:02', afterAt: '08:41' },
  { id: 2, title: 'เปลี่ยนเบรกเกอร์', time: '10:30', place: 'ตู้ไฟชั้น 2 อาคาร A', status: 'doing', before: SHOT, beforeAt: '10:34' },
  { id: 3, title: 'ตรวจปั๊มน้ำ', time: '13:00', place: 'โรงงาน 2', status: 'todo' },
  { id: 4, title: 'ซ่อมไฟทางเดิน', time: '15:00', place: 'ลานจอดรถ', status: 'todo' },
  { id: 5, title: 'เช็คสายไฟชั้น 5', time: '16:30', place: 'อาคาร C', status: 'todo' },
];

const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const hhmm = () => new Date().toTimeString().slice(0, 5);

let tasks, queue, lastChange = null, toastTimer = null, drag = null;
let pending = null, busy = false, photosOk = true; // pending = the photo the open camera is for

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tasks)) {
      tasks = d.tasks; queue = d.queue || [];
      try {
        const p = JSON.parse(localStorage.getItem(PKEY)) || {};
        tasks.forEach((t) => Object.assign(t, p[t.id]));
      } catch (e) { /* photos lost: a doing task without its before photo shows the repair button */ }
      return;
    }
  } catch (e) { /* storage unavailable: start from the sample */ }
  tasks = SAMPLE(); queue = [];
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ tasks: tasks.map(({ before, after, ...t }) => t), queue })); } catch (e) { /* ignore */ }
  try {
    localStorage.setItem(PKEY, JSON.stringify(Object.fromEntries(
      tasks.filter((t) => t.before || t.after).map((t) => [t.id, { before: t.before, after: t.after }]))));
    photosOk = true;
  } catch (e) { photosOk = false; }
}

function boxHTML(t) {
  const from = lastChange && lastChange.id === t.id ? ` data-from="${lastChange.from}"` : '';
  const meta = `<p class="meta">${esc(t.time)} · ${esc(t.place)}</p>`;
  const label = (ic) => `<span class="st">${ic || ''}${LABEL[t.status]}</span>`;
  if (t.status === 'todo') {
    return `<li><article class="box" data-state="todo"${from}>
      <button type="button" class="main" data-start="${t.id}">
        <h2>${esc(t.title)}</h2>${meta}<span class="cue">${icon('camera')}ถ่ายรูปก่อนเริ่ม</span>
      </button>${label()}</article></li>`;
  }
  if (t.status === 'doing') {
    // no before photo (lost from storage): repair it here, and the finish track stays out of the way
    const body = t.before
      ? `<div class="tools"><img class="shot" src="${t.before}" alt="รูปก่อนเริ่ม ${esc(t.title)}"><button type="button" class="photo" data-photo="${t.id}">${icon('camera')}ถ่ายรูปก่อนใหม่</button></div>
        <div class="track" data-id="${t.id}"><div class="fill"></div><span class="lbl">ปัดเพื่อถ่ายรูปหลัง</span>
          <button type="button" class="thumb" aria-label="ถ่ายรูปหลังแล้วจบงาน ${esc(t.title)} (ลากไปทางขวา หรือกด Enter)">${icon('chev')}</button></div>`
      : `<div class="tools"><button type="button" class="photo need" data-photo="${t.id}">${icon('camera')}ถ่ายรูปก่อน</button></div>
        <p class="needtxt">ต้องมีรูปก่อนจึงจะจบงานได้</p>`;
    return `<li><article class="box" data-state="doing"${from}>
      <div class="band" aria-hidden="true"></div>
      <div class="doing-body">${label()}<h2>${esc(t.title)}</h2>${meta}${body}</div></article></li>`;
  }
  const both = t.before && t.after ? `<span class="cue">${icon('camera')}รูปก่อน-หลังครบ</span>` : '';
  return `<li><article class="box" data-state="done"${from}>${label(icon('check'))}
    <h2>${esc(t.title)}</h2>${meta}${both}</article></li>`;
}

function render() {
  const list = $('#list');
  const done = tasks.filter((t) => t.status === 'done').length;
  const doing = tasks.some((t) => t.status === 'doing');
  const todo = tasks.some((t) => t.status === 'todo');

  const now = new Date();
  const th = (o) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', o).format(now);
  $('#date').textContent = th({ day: 'numeric', month: 'short' });
  $('#date').setAttribute('aria-label', th({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  $('#weekday').textContent = th({ weekday: 'long' });

  $('#prog').innerHTML = tasks.map((t) => `<i data-s="${t.status}"></i>`).join('');
  $('#prog').setAttribute('aria-label', `เสร็จ ${done} จาก ${tasks.length} ภารกิจ`);
  $('#count').textContent = tasks.length ? `เสร็จ ${done} จาก ${tasks.length}` : '';
  $('#hint').hidden = !(todo && !doing);

  if (!tasks.length) {
    list.innerHTML = `<li class="empty"><h2>วันนี้ยังไม่มีภารกิจ</h2><p>เมื่อหัวหน้ามอบหมายงาน กล่องภารกิจจะขึ้นที่นี่</p></li>`;
  } else {
    const banner = done === tasks.length ? `<li class="alldone"><h2>เสร็จครบทั้ง ${tasks.length} ภารกิจ</h2></li>` : '';
    list.innerHTML = banner + tasks.map(boxHTML).join('');
  }
  lastChange = null;
  renderNet();
}

let sentCount = 0, sentTimer = null;
function renderNet() {
  const off = !navigator.onLine;
  const msgs = [];
  if (!photosOk) msgs.push('เก็บรูปในเครื่องไม่ได้ พื้นที่เต็ม รูปจะหายถ้าปิดหน้านี้');
  if (off) {
    const shots = queue.filter((q) => q.ph).length;
    msgs.push('ไม่มีสัญญาณ งานและรูปที่ถ่ายจะบันทึกไว้ในเครื่องและส่งเมื่อมีสัญญาณ'
      + (queue.length ? ` · รอส่ง ${queue.length - shots} รายการ` + (shots ? ` · รูป ${shots} ใบ` : '') : ''));
  } else if (sentCount) msgs.push(`ส่งแล้ว ${sentCount} รายการ`);
  $('#net').hidden = !msgs.length;
  $('#netText').textContent = msgs.join(' · ');
}

// move focus to where the next action is, since render() rebuilds the list
function focusAfter(id, to) {
  const el = to === 'doing' ? document.querySelector(`.track[data-id="${id}"] .thumb`) || document.querySelector(`[data-photo="${id}"]`)
    // after a finish, focus the next thing to do (the 8 s undo button would vanish under the user's focus)
    : to === 'done' ? document.querySelector('[data-start]') || document.querySelector('.thumb') || $('#undo')
    : to === 'todo' ? document.querySelector(`[data-start="${id}"]`)
    : document.querySelector(`[data-photo="${id}"]`);
  if (el) el.focus();
}

function queuePhoto(id, ph) {
  if (!navigator.onLine && !queue.some((q) => q.id === id && q.ph === ph)) queue.push({ id, ph });
}

function setStatus(id, to, opts = {}) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.status === to) return;
  // the gate: the photo must already be on the task, whichever control got here
  if ((to === 'doing' && t.status === 'todo' && !t.before) || (to === 'done' && !(t.before && t.after))) return;
  lastChange = { id, from: t.status };
  t.status = to;
  if (!navigator.onLine && !opts.noQueue) { queue.push({ id, to }); if (opts.ph) queuePhoto(id, opts.ph); }
  save();
  if (to === 'done') showToast(`จบงาน “${t.title}” แล้ว`, t.id);
  render();
  focusAfter(id, to);
}

// undoId set: the toast carries "เลิกทำ" for 8 s; otherwise it is a plain 4 s message that never replaces a live undo
// force: a failure the technician must hear about may replace a live undo toast
function showToast(text, undoId, force) {
  const live = $('#toast').classList.contains('show') && !$('#undo').hidden;
  if (!undoId && !force && live) return;
  clearTimeout(toastTimer);
  $('#toastText').textContent = text;
  $('#undo').hidden = !undoId;
  if (undoId) $('#undo').dataset.id = undoId;
  $('#toast').classList.add('show'); // stays in the DOM so the live region announces the text
  toastTimer = setTimeout(hideToast, undoId ? 8000 : 4000);
}
function hideToast() { $('#toast').classList.remove('show'); }

$('#undo').addEventListener('click', (e) => {
  const id = Number(e.currentTarget.dataset.id);
  const t = tasks.find((x) => x.id === id);
  const i = queue.map((q) => q.id === id && q.to === 'done').lastIndexOf(true);
  if (i >= 0) queue.splice(i, 1);
  queue = queue.filter((q) => !(q.id === id && q.ph === 'after'));
  if (t) { t.after = null; t.afterAt = null; } // the finish is undone, so its photo goes with it
  hideToast(); setStatus(id, 'doing', { noQueue: i >= 0 });
  showToast('เลิกทำแล้ว · ลบรูปหลังแล้ว ต้องถ่ายใหม่ตอนจบงาน');
});

/* ---- camera: every start and finish goes through here ---- */
function openCamera(id, kind) {
  if (busy) return;
  pending = { id, kind }; // overwritten, never blocking: a cancelled camera must not leave the app stuck
  const f = $('#file'); f.value = ''; f.click();
}

// downscale so ~12 photos fit in localStorage. shortcut: 800px / JPEG .6 may be too small to read a serial number, raise when supervisors ask
async function toJpeg(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}

const allowed = (t, kind) => kind === 'before' || (t.status === 'doing' && !!t.before);

function release(p) {
  pending = null;
  if (!p) return;
  const t = tasks.find((x) => x.id === p.id);
  showToast(p.kind === 'after' ? 'ยังไม่จบงาน · ต้องถ่ายรูปหลังก่อน'
    : t && t.status === 'todo' ? 'ยังไม่ได้เริ่มงาน · ต้องถ่ายรูปก่อน'
    : t && !t.before ? 'ยังไม่มีรูปก่อน · ต้องถ่ายก่อนจึงจะจบงานได้' : 'ไม่ได้ถ่ายใหม่ · ใช้รูปเดิมต่อ');
  focusAfter(p.id, p.kind === 'after' ? 'doing' : t && t.status === 'todo' ? 'todo' : 'photo');
}

$('#file').addEventListener('cancel', () => release(pending));
$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0], p = pending;
  if (!p) return;
  if (!f) return release(p);
  pending = null; busy = true;
  $('#list').setAttribute('aria-busy', 'true');
  try {
    const t = tasks.find((x) => x.id === p.id);
    if (!t || !allowed(t, p.kind)) return; // the day was reset while the camera was open
    t[p.kind] = await toJpeg(f);
    t[p.kind + 'At'] = hhmm();
    if (p.kind === 'before' && t.status === 'todo') setStatus(t.id, 'doing', { ph: 'before' });
    else if (p.kind === 'after' && t.status === 'doing') setStatus(t.id, 'done', { ph: 'after' });
    else { queuePhoto(t.id, p.kind); save(); render(); focusAfter(t.id, 'photo'); }
    if (!photosOk) showToast('พื้นที่ในเครื่องเต็ม · รูปจะหายถ้าปิดหน้านี้', null, true);
  } catch (err) {
    showToast('เปิดรูปนี้ไม่ได้ · ลองถ่ายใหม่', null, true);
    focusAfter(p.id, p.kind === 'after' ? 'doing' : 'photo');
  } finally {
    busy = false;
    $('#list').removeAttribute('aria-busy');
  }
});

const list = $('#list');
list.addEventListener('click', (e) => {
  const start = e.target.closest('[data-start]');
  if (start) return openCamera(Number(start.dataset.start), 'before');
  const photo = e.target.closest('[data-photo]');
  if (photo) openCamera(Number(photo.dataset.photo), 'before');
});

// swipe to finish: a forgiving drag on a dedicated track, never on the whole card
list.addEventListener('pointerdown', (e) => {
  const th = e.target.closest('.thumb');
  if (!th) return;
  const track = th.parentElement;
  drag = { th, track, id: Number(track.dataset.id), startX: e.clientX, x: 0, max: track.clientWidth - th.offsetWidth - 8 };
  th.setPointerCapture(e.pointerId);
  track.classList.add('drag');
});
list.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.x = Math.min(Math.max(e.clientX - drag.startX, 0), drag.max);
  drag.track.style.setProperty('--x', drag.x + 'px');
});
function endDrag(e) {
  if (!drag) return;
  const { track, th, id, x, max } = drag;
  drag = null;
  track.classList.remove('drag');
  track.style.setProperty('--x', '0px'); // the thumb always eases back: nothing can leave it stuck while the camera is open
  if (e.type === 'pointerup' && x >= max * 0.72) return openCamera(id, 'after'); // a pointercancel is not a user gesture, never opens the camera
  if (x < 6) { th.classList.add('nudge'); setTimeout(() => th.classList.remove('nudge'), 650); }
}
list.addEventListener('pointerup', endDrag);
list.addEventListener('pointercancel', endDrag);
// a click with no pointer drag (screen reader double-tap, switch or voice control) opens the camera for the after photo
list.addEventListener('click', (e) => {
  const th = e.target.closest('.thumb');
  if (th && e.detail === 0) openCamera(Number(th.parentElement.dataset.id), 'after');
});
list.addEventListener('keydown', (e) => {
  const th = e.target.closest('.thumb');
  if (th && ['Enter', ' ', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    openCamera(Number(th.parentElement.dataset.id), 'after');
  }
});

window.addEventListener('online', () => {
  sentCount = queue.length; queue = []; save(); renderNet();
  clearTimeout(sentTimer);
  sentTimer = setTimeout(() => { sentCount = 0; renderNet(); }, 3000);
});
window.addEventListener('offline', renderNet);

load(); render();
