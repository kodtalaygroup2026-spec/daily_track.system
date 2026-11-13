'use client';
// The technician's calendar: a month of days (works / off / on leave, tasks), the leave request box and "my requests".
// Leave is only a request: the supervisor approves it, and the approved days then show as "ลา" after the next load.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addDays, dayNum, isoOf, th, toDate, today } from '@/lib/dates';
import { WEEKDAYS, weekOf } from '@/lib/roster';
import { cancelLeave, errText, myLeaves, requestLeave, techCalendar } from '@/lib/api';

const P = {
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', check: 'M4.5 12.5l5 5 10-11', x: 'M6 6l12 12M18 6L6 18',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', bag: 'M4 8h16v11H4zM9 8V5h6v3',
  clock: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7v5l3 2', warn: 'M12 4l9 16H3zM12 10v4M12 17v.5',
};
function Ic({ d }) {
  return (
    <svg className="ic" aria-hidden="true" viewBox="0 0 24 24">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const KIND = { work: ['ทำงาน', P.check], off: ['หยุด', P.moon], leave: ['ลา', P.bag] };
const kindOf = (d) => (d.absent ? 'leave' : d.onRoster ? 'work' : 'off');
const taskText = (d) => (d.tasks ? (d.done ? `เสร็จ ${d.done}/${d.tasks}` : `${d.tasks} งาน`) : '');
const STATUS = { pending: ['รออนุมัติ', P.clock, ''], approved: ['อนุมัติแล้ว', P.check, 'ok'], rejected: ['ไม่อนุมัติ', P.x, 'no'] };
const REASONS = ['ป่วย', 'ธุระส่วนตัว', 'ธุระครอบครัว', 'อุบัติเหตุ', 'อื่นๆ'];
const LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const SHORT = { day: 'numeric', month: 'short' };
const NAME = { from: 'lv-from', to: 'lv-to', reason: 'lv-reason' };

const range = (l) => {
  const n = dayNum(l.to) - dayNum(l.from) + 1;
  const a = th(toDate(l.from), l.from === l.to ? { ...SHORT, year: 'numeric' } : SHORT);
  return l.from === l.to ? `${a} · 1 วัน` : `${a} – ${th(toDate(l.to), { ...SHORT, year: 'numeric' })} · ${n} วัน`;
};

export default function TechCalendar() {
  const now = today();
  const thisMonth = now.slice(0, 8) + '01';
  const [month, setMonth] = useState(thisMonth); // first day of the month on screen
  const [sel, setSel] = useState(now);
  const [cal, setCal] = useState(null); // { start, days: { 'YYYY-MM-DD': day } } for the window that was loaded
  const [leaves, setLeaves] = useState(null);
  const [err, setErr] = useState('');
  const [again, setAgain] = useState(false); // the retry button is working
  const [form, setForm] = useState({ from: now, to: now, reason: '' });
  const [errs, setErrs] = useState({}); // { from, to, reason, form }
  const [busy, setBusy] = useState(false);
  const [cancelFor, setCancelFor] = useState(null);
  const [cancelErr, setCancelErr] = useState('');
  const [toast, setToast] = useState({ text: '', show: false });
  const dlg = useRef(null), cdlg = useRef(null), head = useRef(null), timer = useRef(0), seq = useRef(0), key = useRef(false);

  const start = isoOf(weekOf(month)); // Monday of the first visible week; the grid is always 6 weeks = 42 days
  const end = addDays(start, 41);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const ready = !!cal && cal.start === start;
  const maxDay = addDays(now, 90);

  // the newest load wins: answers of a month already left behind are dropped
  const load = useCallback(async (from) => {
    const n = ++seq.current;
    try {
      const [c, l] = await Promise.all([techCalendar(from, addDays(from, 41)), myLeaves()]);
      if (n !== seq.current) return;
      setCal({ start: from, days: Object.fromEntries(c.days.map((d) => [d.day, d])) });
      setLeaves(l.filter((x) => x.status !== 'cancelled'));
      setErr('');
    } catch (e) {
      if (n === seq.current) setErr(errText(e)); // what is on screen stays
    }
  }, []);
  useEffect(() => {
    load(start);
    const seen = () => { if (!document.hidden) load(start); };
    document.addEventListener('visibilitychange', seen);
    return () => document.removeEventListener('visibilitychange', seen);
  }, [start, load]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // arrow keys move the selected day; focus follows it once the grid is redrawn
  useEffect(() => {
    if (!key.current) return;
    key.current = false;
    const b = document.querySelector(`.s-tech .dc[data-d="${sel}"]`);
    if (b) b.focus();
  }, [sel]);

  async function retry() {
    if (again) return;
    setAgain(true);
    await load(start);
    setAgain(false);
  }
  function showToast(text) {
    clearTimeout(timer.current);
    setToast({ text, show: true });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  }

  const go = (m) => { setErr(''); setMonth(m); setSel(m === thisMonth ? now : m); };
  const step = (n) => { const d = toDate(month); d.setMonth(d.getMonth() + n); go(isoOf(d)); };
  function onKey(e) {
    const by = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!by) return;
    e.preventDefault();
    const to = addDays(sel, by);
    if (to < start || to > end) return;
    key.current = true;
    setSel(to);
  }

  /* ---- the request box ---- */
  function openLeave(day) {
    setForm({ from: day, to: day, reason: '' });
    setErrs({});
    dlg.current.showModal();
  }
  // the last day follows the first: never before it, never more than 31 days long
  const setFrom = (from) => setForm((f) => {
    let to = f.to;
    if (from && (!to || to < from)) to = from;
    if (from && to > addDays(from, 30)) to = addDays(from, 30);
    return { ...f, from, to };
  });
  function pick(r) {
    setForm((f) => ({ ...f, reason: r }));
    document.getElementById(NAME.reason).focus();
  }
  function check() {
    const e = {}, { from, to } = form, reason = form.reason.trim();
    if (!from) e.from = 'เลือกวันที่เริ่มลา';
    else if (from < now) e.from = 'เริ่มลาได้ตั้งแต่วันนี้เป็นต้นไป';
    else if (from > maxDay) e.from = 'ลาล่วงหน้าได้ไม่เกิน 90 วัน';
    if (!to) e.to = 'เลือกวันสุดท้ายที่ลา';
    else if (from && to < from) e.to = 'วันสุดท้ายต้องไม่ก่อนวันเริ่มลา';
    else if (from && to > addDays(from, 30)) e.to = 'ลาได้ครั้งละไม่เกิน 31 วัน';
    else if (to > maxDay) e.to = 'ลาล่วงหน้าได้ไม่เกิน 90 วัน';
    if (!reason) e.reason = 'ใส่เหตุผลการลา';
    else if (reason.length > 200) e.reason = 'เหตุผลยาวเกิน 200 ตัวอักษร';
    return e;
  }
  async function send(ev) {
    ev.preventDefault();
    if (busy) return;
    const e = check();
    setErrs(e);
    const first = ['from', 'to', 'reason'].find((k) => e[k]);
    if (first) return document.getElementById(NAME[first]).focus();
    setBusy(true);
    try {
      await requestLeave({ from: form.from, to: form.to, reason: form.reason.trim() });
      dlg.current.close();
      head.current.focus(); // the button that opened the box may be gone now: the new request is where to look
      showToast('ส่งคำขอลาแล้ว · รอหัวหน้าอนุมัติ');
      load(start);
    } catch (x) {
      setErrs({ form: errText(x) });
      if (x.code !== 'network') load(start); // the list may have changed (another request, a decision)
    } finally {
      setBusy(false);
    }
  }

  /* ---- cancel a pending request ---- */
  function askCancel(l) {
    setCancelFor(l);
    setCancelErr('');
    cdlg.current.showModal();
  }
  async function cancelGo() {
    if (busy) return;
    setBusy(true);
    try {
      await cancelLeave(cancelFor.id);
      cdlg.current.close();
      head.current.focus();
      showToast('ยกเลิกคำขอลาแล้ว');
      load(start);
    } catch (x) {
      setCancelErr(errText(x));
      if (x.code !== 'network') load(start);
    } finally {
      setBusy(false);
    }
  }

  const d = ready ? cal.days[sel] : null;
  const covered = !!leaves && leaves.some((l) => (l.status === 'pending' || l.status === 'approved') && l.from <= sel && sel <= l.to);
  const canAsk = sel >= now && sel <= maxDay && !(d && d.absent) && !covered;
  const tab = sel >= start && sel <= end ? sel : month; // the one day the Tab key stops at
  const fail = err && !ready;
  const field = (k, id) => ({ id, 'aria-invalid': errs[k] ? 'true' : undefined, 'aria-describedby': errs[k] ? `${id}-e` : undefined });
  const msg = (k, id) => errs[k] && <p className="err" id={`${id}-e`} role="alert"><Ic d={P.warn} />{errs[k]}</p>;

  return (
    <div className="s-tech">
      <div className="app">
        <header className="bar">
          <Link className="who back" href="/today"><Ic d={P.left} />งานวันนี้</Link>
          <h1 className="brand">ปฏิทินของฉัน</h1>
        </header>

        <p className="net" role="status" hidden={!(err && ready)}>โหลดข้อมูลใหม่ไม่ได้ กำลังแสดงข้อมูลที่โหลดไว้ล่าสุด</p>

        <button type="button" className="pri" onClick={() => openLeave(now)}><Ic d={P.bag} />ขอลา</button>

        <div className="mnav">
          <button type="button" className="tb" aria-label="เดือนก่อนหน้า" onClick={() => step(-1)}><Ic d={P.left} /></button>
          <h2 aria-live="polite">{th(toDate(month), { month: 'long', year: 'numeric' })}</h2>
          <button type="button" className="tb" aria-label="เดือนถัดไป" onClick={() => step(1)}><Ic d={P.right} /></button>
        </div>
        <button type="button" className="tb wide" onClick={() => go(thisMonth)}>เดือนนี้</button>

        {fail ? (
          <div className="empty" role="alert">
            <h2>โหลดปฏิทินไม่สำเร็จ</h2>
            <p>{err}</p>
            <button type="button" className="retry" aria-disabled={again} onClick={retry}>{again ? 'กำลังโหลด…' : 'ลองใหม่'}</button>
          </div>
        ) : (
          <>
            {!ready && <p className="quiet" role="status">กำลังโหลดปฏิทิน…</p>}
            <div className="wk" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w.dow}>{w.short}</span>)}</div>
            <div className="mg" aria-busy={!ready} onKeyDown={onKey}>
              {days.map((s) => {
                const dt = toDate(s), x = ready ? cal.days[s] : null, k = x ? kindOf(x) : '';
                const tasks = x ? taskText(x) : '';
                const label = `${th(dt, LONG)}${s === now ? ' วันนี้' : ''}${x ? ` · ${KIND[k][0]}${x.absent && x.note ? ` (${x.note})` : ''}${tasks ? ` · ${tasks}` : ''}` : ''}`;
                return (
                  <button key={s} type="button" data-d={s} data-k={k || undefined} aria-label={label} aria-pressed={s === sel}
                    aria-current={s === now ? 'date' : undefined} tabIndex={s === tab ? 0 : -1}
                    className={`dc${dt.getMonth() !== toDate(month).getMonth() ? ' out' : ''}${s === now ? ' now' : ''}`} onClick={() => setSel(s)}>
                    <span className="dn">{k && <Ic d={KIND[k][1]} />}{dt.getDate()}</span>
                    {x && <span className="w">{KIND[k][0]}</span>}
                    {tasks && <span>{tasks}</span>}
                  </button>
                );
              })}
            </div>

            <section className="dd" aria-label="รายละเอียดวันที่เลือก">
              <h2>{th(toDate(sel), LONG)}{sel === now ? ' (วันนี้)' : ''}</h2>
              {d ? (
                <>
                  <p className="stw"><Ic d={KIND[kindOf(d)][1]} />{KIND[kindOf(d)][0]}</p>
                  {d.absent && d.note && <p>{`หมายเหตุ: ${d.note}`}</p>}
                  <p>{d.tasks ? `มี ${d.tasks} งาน · เสร็จ ${d.done}` : 'ไม่มีงาน'}</p>
                </>
              ) : <p className="quiet">{ready ? 'ไม่มีข้อมูลของวันนี้' : 'กำลังโหลด…'}</p>}
              {covered && sel >= now && !(d && d.absent) && <p>มีคำขอลาครอบคลุมวันที่เลือกแล้ว</p>}
              {canAsk && (
                <button type="button" className="pri" onClick={() => openLeave(sel)}>
                  <Ic d={P.bag} />{sel === now ? 'ขอลาวันนี้' : `ขอลาวันที่ ${th(toDate(sel), SHORT)}`}
                </button>
              )}
            </section>
          </>
        )}

        <section className="lvs" aria-labelledby="lvh">
          <h2 id="lvh" tabIndex={-1} ref={head}>คำขอลาของฉัน</h2>
          {leaves === null ? (!err && <p className="quiet" role="status">กำลังโหลด…</p>)
            : !leaves.length ? <p className="quiet">ยังไม่มีคำขอลา เมื่อไม่สบายหรือมีธุระ กดปุ่ม “ขอลา” ด้านบน</p>
            : (
              <ul>
                {leaves.map((l) => {
                  const [word, ic, cls] = STATUS[l.status] || STATUS.pending;
                  return (
                    <li key={l.id} className="lv">
                      <p className="rg">{range(l)}</p>
                      <p>{l.reason}</p>
                      <span className={`chip ${cls}`}><Ic d={ic} />{word}</span>
                      {l.note && <p>{`หัวหน้า: ${l.note}`}</p>}
                      {l.status === 'pending' && <button type="button" className="tb" onClick={() => askCancel(l)}>ยกเลิกคำขอ</button>}
                    </li>
                  );
                })}
              </ul>
            )}
        </section>
      </div>

      {/* Escape and the buttons close it; a click on the backdrop does not, so a typed reason is not lost by accident */}
      <dialog className="confirm leave" ref={dlg} aria-labelledby="lvTitle" aria-modal="true" onCancel={(e) => busy && e.preventDefault()}>
        <form className="cf-body" noValidate onSubmit={send} onChange={() => errs.form && setErrs({ ...errs, form: undefined })}>
          <h2 id="lvTitle">ขอลา</h2>
          <div className="fld">
            <label htmlFor={NAME.from}>ลาตั้งแต่</label>
            <input {...field('from', NAME.from)} type="date" value={form.from} min={now} max={maxDay} onChange={(e) => setFrom(e.target.value)} />
            {form.from && <span className="quiet">{th(toDate(form.from), LONG)}</span>}
            {msg('from', NAME.from)}
          </div>
          <div className="fld">
            <label htmlFor={NAME.to}>ถึง</label>
            <input {...field('to', NAME.to)} type="date" value={form.to} min={form.from || now}
              max={form.from && addDays(form.from, 30) < maxDay ? addDays(form.from, 30) : maxDay} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            {form.to && <span className="quiet">{th(toDate(form.to), LONG)}</span>}
            {msg('to', NAME.to)}
          </div>
          <div className="fld">
            <label htmlFor={NAME.reason}>เหตุผล</label>
            <input {...field('reason', NAME.reason)} type="text" value={form.reason} maxLength={200} autoComplete="off" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <div className="picks" role="group" aria-label="เหตุผลที่พบบ่อย">
              {REASONS.map((r) => <button key={r} type="button" onClick={() => pick(r)}>{r}</button>)}
            </div>
            {msg('reason', NAME.reason)}
          </div>
          {errs.form && <p className="err" role="alert"><Ic d={P.warn} />{errs.form}</p>}
          <button type="submit" className="go" aria-disabled={busy}>{busy ? 'กำลังส่ง…' : 'ส่งคำขอลา'}</button>
          <button type="button" className="no" aria-disabled={busy} onClick={() => !busy && dlg.current.close()}>ปิด</button>
        </form>
      </dialog>

      <dialog className="confirm" ref={cdlg} aria-labelledby="cnTitle" aria-modal="true" onCancel={(e) => busy && e.preventDefault()}
        onClick={(e) => { if (e.target === e.currentTarget && !busy) cdlg.current.close(); }}>
        <div className="cf-body">
          <h2 id="cnTitle">ยกเลิกคำขอลานี้ใช่ไหม?</h2>
          {cancelFor && <p className="cf-task">{`${range(cancelFor)} · ${cancelFor.reason}`}</p>}
          {cancelErr && <p className="err" role="alert"><Ic d={P.warn} />{cancelErr}</p>}
          <button type="button" className="go" aria-disabled={busy} onClick={cancelGo}>{busy ? 'กำลังยกเลิก…' : 'ยกเลิกคำขอ'}</button>
          <button type="button" className="no" aria-disabled={busy} onClick={() => !busy && cdlg.current.close()}>เก็บไว้</button>
        </div>
      </dialog>

      <div className={`toast${toast.show ? ' show' : ''}`} role="status" aria-live="polite">
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
