// The technician's day: tasks, offline queue, camera gate, swipe and toast.
// Kept as plain mutable state plus redraw() (a direct port of the static app.js) because the camera, change and pointer
// flow must read the latest values synchronously, and the file input has to be clicked inside the user gesture.
// Photos are the gate: a task starts only with a BEFORE photo and finishes only with an AFTER photo.
import { clockNow } from '@/lib/dates';
import { loadDay, saveDay } from '@/lib/tech-store';

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
const q = (s) => document.querySelector(s);

export function createDay(redraw) {
  const d = {
    ready: false, tasks: [], queue: [], photosOk: true, sentCount: 0, busy: false,
    lastChange: null, // { id, from } for the unwipe animation, read by the render that follows a status change
    rev: {}, // per task: bumped on every status change so the box remounts and its animation replays
    toast: { text: '', undoId: 0, show: false },
  };
  let fileEl = null, pending = null, focus = null, drag = null, toastTimer = 0, sentTimer = 0;
  // pending = the photo the open camera is for

  const save = () => { d.photosOk = saveDay(d.tasks, d.queue); };

  // move focus to where the next action is, since the list is rebuilt; runs after the commit (afterCommit)
  function focusAfter(id, to) { focus = { id, to }; redraw(); }
  function runFocus() {
    if (!focus) return;
    const { id, to } = focus;
    focus = null;
    const el = to === 'doing' ? q(`.track[data-id="${id}"] .thumb`) || q(`[data-photo="${id}"]`)
      // after a finish, focus the next thing to do (the 8 s undo button would vanish under the user's focus)
      : to === 'done' ? q('[data-start]') || q('.thumb') || q('#undo')
      : to === 'todo' ? q(`[data-start="${id}"]`)
      : q(`[data-photo="${id}"]`);
    if (el) el.focus();
  }

  function queuePhoto(id, ph) {
    if (!navigator.onLine && !d.queue.some((x) => x.id === id && x.ph === ph)) d.queue.push({ id, ph });
  }

  function setStatus(id, to, opts = {}) {
    const t = d.tasks.find((x) => x.id === id);
    if (!t || t.status === to) return;
    // the gate: the photo must already be on the task, whichever control got here
    if ((to === 'doing' && t.status === 'todo' && !t.before) || (to === 'done' && !(t.before && t.after))) return;
    d.lastChange = { id, from: t.status };
    d.rev[id] = (d.rev[id] || 0) + 1;
    t.status = to;
    if (!navigator.onLine && !opts.noQueue) { d.queue.push({ id, to }); if (opts.ph) queuePhoto(id, opts.ph); }
    save();
    if (to === 'done') showToast(`จบงาน “${t.title}” แล้ว`, t.id);
    focusAfter(id, to);
  }

  // undoId set: the toast carries "เลิกทำ" for 8 s; otherwise it is a plain 4 s message that never replaces a live undo
  // force: a failure the technician must hear about may replace a live undo toast
  function showToast(text, undoId, force) {
    const live = d.toast.show && d.toast.undoId;
    if (!undoId && !force && live) return;
    clearTimeout(toastTimer);
    d.toast = { text, undoId: undoId || 0, show: true }; // always rendered, so the live region announces the text
    toastTimer = setTimeout(hideToast, undoId ? 8000 : 4000);
    redraw();
  }
  function hideToast() { d.toast = { ...d.toast, show: false }; redraw(); }

  function undo() {
    const id = d.toast.undoId;
    const t = d.tasks.find((x) => x.id === id);
    const i = d.queue.map((x) => x.id === id && x.to === 'done').lastIndexOf(true);
    if (i >= 0) d.queue.splice(i, 1);
    d.queue = d.queue.filter((x) => !(x.id === id && x.ph === 'after'));
    if (t) { t.after = null; t.afterAt = null; } // the finish is undone, so its photo goes with it
    hideToast(); setStatus(id, 'doing', { noQueue: i >= 0 });
    showToast('เลิกทำแล้ว · ลบรูปหลังแล้ว ต้องถ่ายใหม่ตอนจบงาน');
  }

  /* ---- camera: every start and finish goes through here ---- */
  function openCamera(id, kind) {
    if (d.busy) return;
    pending = { id, kind }; // overwritten, never blocking: a cancelled camera must not leave the app stuck
    fileEl.value = ''; fileEl.click();
  }

  function release(p) {
    pending = null;
    if (!p) return;
    const t = d.tasks.find((x) => x.id === p.id);
    showToast(p.kind === 'after' ? 'ยังไม่จบงาน · ต้องถ่ายรูปหลังก่อน'
      : t && t.status === 'todo' ? 'ยังไม่ได้เริ่มงาน · ต้องถ่ายรูปก่อน'
      : t && !t.before ? 'ยังไม่มีรูปก่อน · ต้องถ่ายก่อนจึงจะจบงานได้' : 'ไม่ได้ถ่ายใหม่ · ใช้รูปเดิมต่อ');
    focusAfter(p.id, p.kind === 'after' ? 'doing' : t && t.status === 'todo' ? 'todo' : 'photo');
  }

  async function onChange(e) {
    const f = e.target.files[0], p = pending;
    if (!p) return;
    if (!f) return release(p);
    pending = null; d.busy = true; redraw();
    try {
      const t = d.tasks.find((x) => x.id === p.id);
      if (!t || !allowed(t, p.kind)) return; // the day was reset while the camera was open
      t[p.kind] = await toJpeg(f);
      t[p.kind + 'At'] = clockNow();
      if (p.kind === 'before' && t.status === 'todo') setStatus(t.id, 'doing', { ph: 'before' });
      else if (p.kind === 'after' && t.status === 'doing') setStatus(t.id, 'done', { ph: 'after' });
      else { queuePhoto(t.id, p.kind); save(); focusAfter(t.id, 'photo'); }
      if (!d.photosOk) showToast('พื้นที่ในเครื่องเต็ม · รูปจะหายถ้าปิดหน้านี้', null, true);
    } catch (err) {
      showToast('เปิดรูปนี้ไม่ได้ · ลองถ่ายใหม่', null, true);
      focusAfter(p.id, p.kind === 'after' ? 'doing' : 'photo');
    } finally {
      d.busy = false; redraw();
    }
  }

  // the cancel event does not bubble, so React cannot delegate it: bind it when the input mounts
  function fileRef(el) {
    fileEl = el;
    if (!el) return;
    const onCancel = () => release(pending);
    el.addEventListener('cancel', onCancel);
    return () => { el.removeEventListener('cancel', onCancel); fileEl = null; };
  }

  /* ---- list events (delegated, as in the static page) ---- */
  function onClick(e) {
    const start = e.target.closest('[data-start]');
    if (start) return openCamera(Number(start.dataset.start), 'before');
    const photo = e.target.closest('[data-photo]');
    if (photo) return openCamera(Number(photo.dataset.photo), 'before');
    // a click with no pointer drag (screen reader double-tap, switch or voice control) opens the camera for the after photo
    const th = e.target.closest('.thumb');
    if (th && e.detail === 0) openCamera(Number(th.parentElement.dataset.id), 'after');
  }

  // swipe to finish: a forgiving drag on a dedicated track, never on the whole card.
  // The thumb is moved through the DOM on purpose: re-rendering the list on every pointermove would be wasteful.
  function onPointerDown(e) {
    const th = e.target.closest('.thumb');
    if (!th) return;
    const track = th.parentElement;
    drag = { th, track, id: Number(track.dataset.id), startX: e.clientX, x: 0, max: track.clientWidth - th.offsetWidth - 8 };
    th.setPointerCapture(e.pointerId);
    track.classList.add('drag');
  }
  function onPointerMove(e) {
    if (!drag) return;
    drag.x = Math.min(Math.max(e.clientX - drag.startX, 0), drag.max);
    drag.track.style.setProperty('--x', drag.x + 'px');
  }
  function endDrag(e) {
    if (!drag) return;
    const { track, th, id, x, max } = drag;
    drag = null;
    track.classList.remove('drag');
    track.style.setProperty('--x', '0px'); // the thumb always eases back: nothing can leave it stuck while the camera is open
    if (e.type === 'pointerup' && x >= max * 0.72) return openCamera(id, 'after'); // a pointercancel is not a user gesture, never opens the camera
    if (x < 6) { th.classList.add('nudge'); setTimeout(() => th.classList.remove('nudge'), 650); }
  }
  function onKeyDown(e) {
    const th = e.target.closest('.thumb');
    if (th && ['Enter', ' ', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      openCamera(Number(th.parentElement.dataset.id), 'after');
    }
  }

  // mount: read storage (never during the first render) and listen for connectivity; returns the cleanup
  function start() {
    Object.assign(d, loadDay(), { ready: true });
    const onOnline = () => {
      d.sentCount = d.queue.length; d.queue = []; save(); redraw();
      clearTimeout(sentTimer);
      sentTimer = setTimeout(() => { d.sentCount = 0; redraw(); }, 3000);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', redraw);
    redraw();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', redraw);
      clearTimeout(toastTimer); clearTimeout(sentTimer);
    };
  }

  // after every commit: the animation hint is spent, and focus can move into the new DOM
  // lastChange stays until the next status change: clearing it on an unrelated redraw (a toast timer, a connectivity event)
  // would drop data-from and cut the wipe animation short. The box remounts per status change, so it cannot replay.
  function afterCommit() { runFocus(); }

  return Object.assign(d, { start, afterCommit, undo, onChange, fileRef, onClick, onPointerDown, onPointerMove, endDrag, onKeyDown });
}
