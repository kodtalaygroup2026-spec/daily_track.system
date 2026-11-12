// The technician's day: tasks from the database, camera gate, sub-task ticks, swipe and toast.
// Kept as plain mutable state plus redraw() because the camera, change and pointer flow must read the latest values
// synchronously, and the file input has to be clicked inside the user gesture.
// Photos are the gate (a swipe first asks "finish?" in a dialog): a task starts only with a BEFORE photo and finishes only
// with an AFTER photo, and only once every sub-task is ticked. Every change is saved first, then the day is read again.
import { today } from '@/lib/dates';
import { errText, techDay, techFinish, techSetItem, techSetPhoto, techStart, techUndo, uploadPhoto } from '@/lib/api';

const OFFLINE = 'ต้องต่อเน็ตก่อนจึงจะบันทึกได้';

// downscaled JPEG, longest side 1280 px; the storage limit is 2 MB and this lands far below it
async function toJpeg(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.72));
}

const q = (s) => document.querySelector(s);
const ticked = (t) => t.items.every((i) => i.done);
const allowed = (t, kind) => kind === 'before' || (t.status === 'doing' && !!t.before && ticked(t));

export function createDay(redraw) {
  const d = {
    day: today(), loaded: false, error: '', tasks: [], busy: false,
    from: {}, // per task: the status it just left, for the unwipe animation
    rev: {}, // per task: bumped on every status change so the box remounts and its animation replays
    toast: { text: '', undoId: '', show: false },
    confirm: null, // { id } of the task the finish dialog is about
  };
  let fileEl = null, dlgEl = null, pending = null, focus = null, drag = null, toastTimer = 0, retryTimer = 0, seq = 0;
  // pending = the photo the open camera is for; seq = the newest load, older answers are dropped
  const ticks = new Set(); // sub-task ids being saved
  const find = (id) => d.tasks.find((x) => x.id === id);

  /* ---- reading the day ---- */
  // true when the screen shows what the server has (a superseded load counts: the newer one answers)
  async function load() {
    const n = ++seq, day = today();
    try {
      const rows = await techDay(day);
      if (n !== seq || ticks.size) return true; // a tick in flight is shown ahead of the server; its own reload follows
      for (const t of rows) {
        const was = find(t.id);
        if (was && was.status !== t.status) { d.from[t.id] = was.status; d.rev[t.id] = (d.rev[t.id] || 0) + 1; }
      }
      Object.assign(d, { day, tasks: rows, loaded: true, error: '' });
      redraw();
      return true;
    } catch (err) {
      if (n !== seq) return true;
      d.error = errText(err); // the last data stays on screen
      redraw();
      return false;
    }
  }
  // read the day again after a saved change; on a stale list say so instead of the success text, and try once more soon
  async function reload(text, undoId) {
    if (await load()) return text && showToast(text, undoId, !undoId);
    showToast('บันทึกแล้ว แต่โหลดรายการใหม่ไม่ได้ · กำลังลองอีกครั้ง', 0, true);
    retryTimer = setTimeout(load, 3000);
  }
  // the timed and tab-return reload never interrupts a drag, the dialog, the camera or a save
  function refresh() {
    const camera = pending && Date.now() - pending.at < 120000; // a camera that never answered must not block for good
    if (d.busy || ticks.size || drag || camera || (dlgEl && dlgEl.open)) return;
    load();
  }
  async function retry() {
    d.error = ''; redraw();
    await load();
    if (d.error) focusAfter(null, 'retry');
  }

  // move focus to where the next action is, since the list is rebuilt; runs after the commit (afterCommit)
  function focusAfter(id, to) { focus = { id, to }; redraw(); }
  function runFocus() {
    if (!focus) return;
    const { id, to } = focus;
    focus = null;
    const el = to === 'retry' ? q('.retry')
      : to === 'doing' ? q(`.track[data-id="${id}"] .thumb`) || q(`[data-task="${id}"]`) || q(`[data-photo="${id}"]`)
      // after a finish, focus the next thing to do (the 8 s undo button would vanish under the user's focus)
      : to === 'done' ? q('[data-start]') || q('.thumb') || q('[data-item]') || q('#undo')
      : to === 'todo' ? q(`[data-start="${id}"]`)
      : q(`[data-photo="${id}"]`);
    if (el) el.focus();
  }
  // where focus returns when the camera for p did not lead to a change
  const focusFor = (p) => (p.kind === 'after' ? 'doing' : (find(p.id) || {}).status === 'todo' ? 'todo' : 'photo');

  // undoId set: the toast carries "เลิกทำ" for 8 s; otherwise it is a plain 4 s message that never replaces a live undo
  // force: a failure the technician must hear about may replace a live undo toast
  function showToast(text, undoId, force) {
    const live = d.toast.show && d.toast.undoId;
    if (!undoId && !force && live) return;
    clearTimeout(toastTimer);
    d.toast = { text, undoId: undoId || '', show: true }; // always rendered, so the live region announces the text
    toastTimer = setTimeout(hideToast, undoId || force ? 8000 : 4000);
    redraw();
  }
  function hideToast() { d.toast = { ...d.toast, show: false }; redraw(); }
  function offline() {
    if (navigator.onLine) return false;
    showToast(OFFLINE, 0, true);
    return true;
  }

  async function undo() {
    const id = d.toast.undoId;
    if (!id || d.busy || offline()) return;
    d.busy = true; redraw();
    try {
      await techUndo(id);
      await reload('เลิกทำแล้ว · กลับเป็นกำลังทำ ต้องถ่ายรูปหลังใหม่ตอนจบงาน');
      focusAfter(id, 'doing');
    } catch (err) {
      showToast(errText(err), 0, true);
      if (err.code !== 'network') load();
    } finally {
      d.busy = false; redraw();
    }
  }

  /* ---- sub-tasks: ticked only while the task is doing; shown at once, put back if the save fails ---- */
  async function toggleItem(taskId, itemId) {
    const t = find(taskId), it = t && t.status === 'doing' && t.items.find((i) => i.id === itemId);
    if (!it || d.busy || ticks.has(itemId) || offline()) return;
    ticks.add(itemId);
    it.done = !it.done; redraw();
    try {
      await techSetItem(itemId, it.done);
      ticks.delete(itemId);
      load();
    } catch (err) {
      it.done = !it.done;
      ticks.delete(itemId);
      showToast(errText(err), 0, true);
      redraw();
      if (err.code !== 'network') load();
    }
  }

  /* ---- camera: every start and finish goes through here ---- */
  function openCamera(id, kind) {
    if (d.busy) return;
    if (offline()) return focusAfter(id, focusFor({ id, kind }));
    pending = { id, kind, at: Date.now() }; // overwritten, never blocking: a cancelled camera must not leave the app stuck
    fileEl.value = ''; fileEl.click();
  }

  /* ---- confirm before finishing: the swipe only asks; the camera opens from the dialog's own button ---- */
  function askFinish(id) {
    const t = find(id);
    if (d.busy || !dlgEl || dlgEl.open || !t || !allowed(t, 'after')) return;
    d.confirm = { id };
    dlgEl.returnValue = '';
    dlgEl.showModal();
    dlgEl.querySelector('.go').focus();
    redraw();
  }
  function confirmGo() {
    const { id } = d.confirm;
    dlgEl.close('go');
    openCamera(id, 'after'); // still inside the click, so the browser lets the camera open
  }
  // Escape, "ยังไม่จบ" and a click on the backdrop all land here: nothing changes, focus goes back to the thumb
  function onDialogClose() { if (dlgEl.returnValue !== 'go') focusAfter(d.confirm.id, 'doing'); }
  function onDialogClick(e) { if (e.target === e.currentTarget) dlgEl.close(); }
  const dialogRef = (el) => { dlgEl = el; };

  function release(p) {
    pending = null;
    if (!p) return;
    const t = find(p.id);
    showToast(p.kind === 'after' ? 'ยังไม่จบงาน · ต้องถ่ายรูปหลังก่อน'
      : t && t.status === 'todo' ? 'ยังไม่ได้เริ่มงาน · ต้องถ่ายรูปก่อน'
      : t && !t.before ? 'ยังไม่มีรูปก่อน · ต้องถ่ายก่อนจึงจะจบงานได้' : 'ไม่ได้ถ่ายใหม่ · ใช้รูปเดิมต่อ');
    focusAfter(p.id, focusFor(p));
  }

  async function onChange(e) {
    const f = e.target.files[0], p = pending;
    if (!p) return;
    if (!f) return release(p);
    pending = null;
    const t = find(p.id);
    if (!t || !allowed(t, p.kind)) { // the day changed while the camera was open
      showToast('งานเปลี่ยนไปแล้ว รูปที่ถ่ายไม่ได้บันทึก · ดูรายการใหม่อีกครั้ง', 0, true);
      load();
      return focusAfter(p.id, 'done');
    }
    if (offline()) return focusAfter(p.id, focusFor(p));
    const was = t.status, to = focusFor(p);
    d.busy = true; redraw();
    try {
      const blob = await toJpeg(f).catch(() => null);
      if (!blob) { showToast('เปิดรูปนี้ไม่ได้ · ลองถ่ายใหม่', 0, true); return focusAfter(p.id, to); }
      const path = await uploadPhoto(t.id, p.kind, blob);
      if (p.kind === 'after') await techFinish(t.id, path);
      else if (was === 'todo') await techStart(t.id, path);
      else await techSetPhoto(t.id, p.kind, path);
      await reload(p.kind === 'after' && `จบงาน “${t.title}” แล้ว`, t.id);
      focusAfter(t.id, p.kind === 'after' ? 'done' : was === 'todo' ? 'doing' : 'photo');
    } catch (err) {
      showToast(`บันทึกไม่สำเร็จ · ${errText(err)}`, 0, true); // the task is unchanged, its camera button is still there
      focusAfter(p.id, to);
      if (err.code !== 'network') load();
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
    if (start) return openCamera(start.dataset.start, 'before');
    const photo = e.target.closest('[data-photo]');
    if (photo) return openCamera(photo.dataset.photo, 'before');
    const item = e.target.closest('[data-item]');
    if (item) return toggleItem(item.dataset.task, item.dataset.item);
    // a click with no pointer drag (screen reader double-tap, switch or voice control) asks to finish
    const th = e.target.closest('.thumb');
    if (th && e.detail === 0) askFinish(th.parentElement.dataset.id);
  }

  // swipe to finish: a forgiving drag on a dedicated track, never on the whole card.
  // The thumb is moved through the DOM on purpose: re-rendering the list on every pointermove would be wasteful.
  function onPointerDown(e) {
    const th = e.target.closest('.thumb');
    if (!th) return;
    const track = th.parentElement;
    drag = { th, track, id: track.dataset.id, startX: e.clientX, x: 0, max: track.clientWidth - th.offsetWidth - 8 };
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
    if (e.type === 'pointerup' && x >= max * 0.72) return askFinish(id); // a pointercancel is not a user gesture, never asks
    if (x < 6) { th.classList.add('nudge'); setTimeout(() => th.classList.remove('nudge'), 650); }
  }
  function onKeyDown(e) {
    const th = e.target.closest('.thumb');
    if (th && ['Enter', ' ', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      askFinish(th.parentElement.dataset.id);
    }
  }

  // mount: read the day, then keep it fresh (also rolls over at midnight, because load() asks for today's date)
  function start() {
    load();
    const seen = () => { if (!document.hidden) refresh(); };
    const back = () => { redraw(); refresh(); };
    const timer = setInterval(seen, 60000);
    document.addEventListener('visibilitychange', seen);
    window.addEventListener('online', back);
    window.addEventListener('offline', redraw);
    return () => {
      clearInterval(timer); clearTimeout(toastTimer); clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', seen);
      window.removeEventListener('online', back);
      window.removeEventListener('offline', redraw);
    };
  }

  // after every commit: focus can move into the new DOM
  // d.from stays until the next status change: clearing it on an unrelated redraw (a toast timer, a connectivity event)
  // would drop data-from and cut the wipe animation short. The box remounts per status change, so it cannot replay.
  function afterCommit() { runFocus(); }

  return Object.assign(d, { start, afterCommit, undo, retry, onChange, fileRef, dialogRef, confirmGo, onDialogClose, onDialogClick, onClick, onPointerDown, onPointerMove, endDrag, onKeyDown });
}
