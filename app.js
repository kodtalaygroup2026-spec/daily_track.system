'use strict';
// Prototype: sample data only, state kept in this browser. No backend yet.
const KEY = 'dailytrack.sample.v1';
const LABEL = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };
const SAMPLE = () => [
  { id: 1, title: 'ล้างแอร์ ห้อง 302', time: '08:00', place: 'อาคาร B', status: 'done' },
  { id: 2, title: 'เปลี่ยนเบรกเกอร์', time: '10:30', place: 'ตู้ไฟชั้น 2 อาคาร A', status: 'doing' },
  { id: 3, title: 'ตรวจปั๊มน้ำ', time: '13:00', place: 'โรงงาน 2', status: 'todo' },
  { id: 4, title: 'ซ่อมไฟทางเดิน', time: '15:00', place: 'ลานจอดรถ', status: 'todo' },
  { id: 5, title: 'เช็คสายไฟชั้น 5', time: '16:30', place: 'อาคาร C', status: 'todo' },
];

const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

let tasks, queue, lastChange = null, toastTimer = null, drag = null;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tasks)) { tasks = d.tasks; queue = d.queue || []; return; }
  } catch (e) { /* storage unavailable: start from the sample */ }
  tasks = SAMPLE(); queue = [];
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ tasks: tasks.map(({ photo, ...t }) => t), queue })); } catch (e) { /* ignore */ }
}

function boxHTML(t) {
  const from = lastChange && lastChange.id === t.id ? ` data-from="${lastChange.from}"` : '';
  const meta = `<p class="meta">${esc(t.time)} · ${esc(t.place)}</p>`;
  const label = (ic) => `<span class="st">${ic || ''}${LABEL[t.status]}</span>`;
  if (t.status === 'todo') {
    return `<li><article class="box" data-state="todo"${from}>
      <button type="button" class="main" data-start="${t.id}" aria-label="เริ่มงาน ${esc(t.title)}">
        <h2>${esc(t.title)}</h2>${meta}
      </button>${label()}</article></li>`;
  }
  if (t.status === 'doing') {
    const shot = t.photo ? `<img class="shot" src="${t.photo}" alt="รูปที่แนบกับ ${esc(t.title)}">` : '';
    return `<li><article class="box" data-state="doing"${from}>
      <div class="band" aria-hidden="true"></div>
      <div class="doing-body">${label()}<h2>${esc(t.title)}</h2>${meta}
        <div class="tools"><button type="button" class="photo" data-photo="${t.id}">${icon('camera')}${t.photo ? 'เปลี่ยนรูป' : 'แนบรูป'}</button>${shot}</div>
        <div class="track" data-id="${t.id}"><div class="fill"></div><span class="lbl">ปัดเพื่อจบงาน</span>
          <button type="button" class="thumb" aria-label="จบงาน ${esc(t.title)} (ลากไปทางขวา หรือกด Enter)">${icon('chev')}</button></div>
      </div></article></li>`;
  }
  return `<li><article class="box" data-state="done"${from}>${label(icon('check'))}
    <h2>${esc(t.title)}</h2>${meta}</article></li>`;
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
  $('#net').hidden = !(off || sentCount);
  $('#netText').textContent = off
    ? 'ไม่มีสัญญาณ งานที่อัปเดตจะบันทึกไว้ในเครื่องและส่งเมื่อมีสัญญาณ' + (queue.length ? ` · รอส่ง ${queue.length} รายการ` : '')
    : `ส่งแล้ว ${sentCount} รายการ`;
}

// move focus to where the next action is, since render() rebuilds the list
function focusAfter(id, to) {
  const el = to === 'doing' ? document.querySelector(`.track[data-id="${id}"] .thumb`)
    : to === 'done' ? $('#undo')
    : document.querySelector(`[data-photo="${id}"]`);
  if (el) el.focus();
}

function setStatus(id, to, opts = {}) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.status === to) return;
  lastChange = { id, from: t.status };
  t.status = to;
  if (!navigator.onLine && !opts.noQueue) queue.push({ id, to });
  save();
  if (to === 'done') showToast(t);
  render();
  focusAfter(id, to);
}

function showToast(t) {
  clearTimeout(toastTimer);
  $('#toastText').textContent = `จบงาน “${t.title}” แล้ว`;
  $('#undo').dataset.id = t.id;
  $('#toast').hidden = false;
  toastTimer = setTimeout(hideToast, 8000);
}
function hideToast() { $('#toast').hidden = true; }

$('#undo').addEventListener('click', (e) => {
  const id = Number(e.currentTarget.dataset.id);
  const i = queue.map((q) => q.id === id && q.to === 'done').lastIndexOf(true);
  if (i >= 0) queue.splice(i, 1);
  hideToast(); setStatus(id, 'doing', { noQueue: i >= 0 });
});

const list = $('#list');
list.addEventListener('click', (e) => {
  const start = e.target.closest('[data-start]');
  if (start) return setStatus(Number(start.dataset.start), 'doing');
  const photo = e.target.closest('[data-photo]');
  if (photo) { $('#file').dataset.id = photo.dataset.photo; $('#file').click(); }
});

$('#file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  const t = tasks.find((x) => x.id === Number(e.target.dataset.id));
  if (f && t) { t.photo = URL.createObjectURL(f); render(); focusAfter(t.id, 'photo'); }
  e.target.value = '';
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
function endDrag() {
  if (!drag) return;
  const { track, th, id, x, max } = drag;
  drag = null;
  track.classList.remove('drag');
  if (x >= max * 0.72) return setStatus(id, 'done');
  track.style.setProperty('--x', '0px');
  if (x < 6) { th.classList.add('nudge'); setTimeout(() => th.classList.remove('nudge'), 650); }
}
list.addEventListener('pointerup', endDrag);
list.addEventListener('pointercancel', endDrag);
// a click with no pointer drag (screen reader double-tap, switch or voice control) finishes the task
list.addEventListener('click', (e) => {
  const th = e.target.closest('.thumb');
  if (th && e.detail === 0) setStatus(Number(th.parentElement.dataset.id), 'done');
});
list.addEventListener('keydown', (e) => {
  const th = e.target.closest('.thumb');
  if (th && ['Enter', ' ', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    setStatus(Number(th.parentElement.dataset.id), 'done');
  }
});

$('#reset').addEventListener('click', () => { tasks = SAMPLE(); queue = []; hideToast(); save(); render(); });
$('#empty').addEventListener('click', () => { tasks = []; queue = []; hideToast(); save(); render(); });
window.addEventListener('online', () => {
  sentCount = queue.length; queue = []; save(); renderNet();
  clearTimeout(sentTimer);
  sentTimer = setTimeout(() => { sentCount = 0; renderNet(); }, 3000);
});
window.addEventListener('offline', renderNet);

load(); render();
