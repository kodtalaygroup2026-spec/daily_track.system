'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { th, toDate, today } from '@/lib/dates';
import { branchLabel } from '@/lib/branches';
import { myBranch, myReports } from '@/lib/api';
import '@/app/styles/tech-calendar.css';
import '@/app/styles/tech-report.css';
import '@/app/styles/tech-branch.css';
import { createDay } from './day';
import PhotoViewer from '@/components/PhotoViewer';
import TaskBox, { Icon, Sprite } from './TaskBox';

export default function TechDay({ user }) {
  const [, redraw] = useReducer((n) => n + 1, 0);
  const ref = useRef(null);
  const [view, setView] = useState(null); // { id, kind }: the photo open in the viewer
  const [sent, setSent] = useState(null); // reports sent today; null = not known (the count stays hidden, the button stays)
  const [at, setAt] = useState(null); // { day, branch }: where the technician works on that day; null = not known, the home branch shows
  if (!ref.current) ref.current = createDay(redraw);
  const d = ref.current;

  useEffect(() => d.start(), [d]);
  useEffect(() => { d.afterCommit(); });
  useEffect(() => {
    let n = 0;
    const get = () => { const k = ++n; myReports(today()).then((r) => k === n && setSent(r.length), () => k === n && setSent(null)); };
    const seen = () => { if (!document.hidden) get(); };
    get();
    document.addEventListener('visibilitychange', seen);
    return () => { n++; document.removeEventListener('visibilitychange', seen); };
  }, []);
  // the branch of the day on screen; a failed read keeps what is known, and an answer for another day is never shown (see `here`)
  useEffect(() => {
    let n = 0;
    const get = () => { const k = ++n, day = d.day; myBranch(day).then((b) => k === n && setAt({ day, branch: typeof b === 'string' ? b : '' }), () => {}); };
    const seen = () => { if (!document.hidden) get(); };
    get();
    document.addEventListener('visibilitychange', seen);
    return () => { n++; document.removeEventListener('visibilitychange', seen); };
  }, [d.day, d]);

  const { tasks, toast } = d;
  const vt = view && tasks.find((t) => t.id === view.id);
  useEffect(() => { if (view && !vt) setView(null); }); // the task is gone from the day: the viewer goes with it
  const done = tasks.filter((t) => t.status === 'done').length;
  const doing = tasks.some((t) => t.status === 'doing');
  const todo = tasks.some((t) => t.status === 'todo');
  const day = toDate(d.day);
  const offline = !navigator.onLine;
  const here = (at && at.day === d.day && at.branch) || user.branch; // the branch of the day on screen
  const away = here && user.branch && here !== user.branch; // sent to a branch other than the home one
  const net = d.busy ? 'กำลังบันทึก รอสักครู่…' : offline ? 'ไม่มีสัญญาณ ต้องต่อเน็ตก่อนจึงจะบันทึกได้'
    : d.error && d.loaded ? 'โหลดข้อมูลใหม่ไม่ได้ กำลังแสดงข้อมูลที่โหลดไว้ล่าสุด' : '';

  return (
    <div className="s-tech">
      <Sprite />
      <div className="app">
        <header className="bar">
          <span className="brand">{here ? `Daily Track · ${branchLabel(here)}` : 'Daily Track'}</span>
          <span className="nav">
            <Link className="who cal-link" href="/calendar" title="ปฏิทินและขอลา">
              <svg className="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>ปฏิทิน
            </Link>
            <Link className="who" href="/profile" title="โปรไฟล์ของฉัน"><span id="whoName">{user.name}</span><Icon n="chev" /></Link>
          </span>
        </header>

        <p className="net" id="net" role="status" hidden={!net}>
          {offline && <Icon n="offline" />}
          <span id="netText">{net}</span>
        </p>

        {away && (
          <p className="tb-at">
            <svg className="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 7.5v5M9.5 10h5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{`${d.day === today() ? 'วันนี้' : th(day, { weekday: 'long' })}คุณอยู่สาขา ${branchLabel(here)}`}<small>{`สาขาหลักของคุณคือ ${branchLabel(user.branch)}`}</small></span>
          </p>
        )}

        <section className="day" aria-label="สรุปวันนี้">
          <div className="date">
            <h1 id="date" aria-label={th(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>{th(day, { day: 'numeric', month: 'short' })}</h1>
            <p id="weekday">{th(day, { weekday: 'long' })}</p>
          </div>
          {d.loaded && tasks.length > 0 && (
            <div className="prog" id="prog" role="img" aria-label={`เสร็จ ${done} จาก ${tasks.length} งาน`}>
              {tasks.map((t) => <i key={t.id} data-s={t.status}></i>)}
            </div>
          )}
          <p className="count" id="count">{tasks.length ? `เสร็จ ${done} จาก ${tasks.length}` : ''}</p>
          <p className="hint" id="hint" hidden={!(todo && !doing)}>แตะกล่องที่รอทำ ถ่ายรูปก่อนแล้วเริ่มงาน</p>
        </section>

        {!d.loaded ? (
          d.error ? (
            <div className="empty" role="alert">
              <h2>โหลดงานวันนี้ไม่สำเร็จ</h2>
              <p>{d.error}</p>
              <button type="button" className="retry" onClick={d.retry}>ลองใหม่</button>
            </div>
          ) : <div className="empty" role="status"><p>กำลังโหลดงานวันนี้…</p></div>
        ) : (
          <ul className="list" id="list" aria-busy={d.busy ? 'true' : undefined}
            onClick={d.onClick} onPointerDown={d.onPointerDown} onPointerMove={d.onPointerMove}
            onPointerUp={d.endDrag} onPointerCancel={d.endDrag} onKeyDown={d.onKeyDown}>
            {!tasks.length ? (
              <li className="empty"><h2>วันนี้ยังไม่มีงาน</h2><p>เมื่อหัวหน้ามอบหมายงานหรือมีงานประจำ กล่องงานจะขึ้นที่นี่</p></li>
            ) : (
              <>
                {done === tasks.length && <li className="alldone"><h2>{`เสร็จครบทั้ง ${tasks.length} งาน`}</h2></li>}
                {tasks.map((t) => <TaskBox key={t.id} t={t} rev={d.rev[t.id] || 0} from={d.from[t.id]} onZoom={(id, kind) => setView({ id, kind })} />)}
              </>
            )}
          </ul>
        )}

        <section className="rep-entry" aria-label="รายงานงานที่ทำ">
          <Link className="pri" href="/report">
            <svg className="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4.5h8v3H8zM6 6H4.5v14.5h15V6H18M8 13l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>รายงานงานที่ทำ
          </Link>
          {sent !== null && <p className="quiet">{`วันนี้ส่งแล้ว ${sent} รายการ`}</p>}
        </section>
      </div>

      {vt && <PhotoViewer title={vt.title} subtitle={`${vt.place} · ${vt.time}`} index={view.kind === 'after' ? 1 : 0} onClose={() => setView(null)}
        photos={['before', 'after'].map((k) => ({ key: k, label: (k === 'before' ? 'ก่อนเริ่ม' : 'หลังเสร็จ') + (vt[k + 'At'] ? ' · ' + vt[k + 'At'] : ''), src: vt[k], alt: `รูป${k === 'before' ? 'ก่อนเริ่ม' : 'หลังเสร็จ'} ${vt.title}`, note: 'ยังไม่ได้ถ่าย' }))} />}

      <input type="file" id="file" accept="image/*" capture="environment" hidden ref={d.fileRef} onChange={d.onChange} />

      <dialog className="confirm" ref={d.dialogRef} aria-labelledby="cfTitle" onClose={d.onDialogClose} onClick={d.onDialogClick}>
        <div className="cf-body">
          <h2 id="cfTitle">จบงานนี้ใช่ไหม?</h2>
          <p className="cf-task">{(tasks.find((t) => d.confirm && t.id === d.confirm.id) || {}).title}</p>
          <p>ต้องถ่ายรูปหลังก่อนจึงจะจบงาน</p>
          <button type="button" className="go" onClick={d.confirmGo}><Icon n="camera" />ถ่ายรูปหลังและจบงาน</button>
          <button type="button" className="no" onClick={(e) => e.currentTarget.closest('dialog').close()}>ยังไม่จบ</button>
        </div>
      </dialog>

      <div className={`toast${toast.show ? ' show' : ''}`} id="toast" role="status" aria-live="polite">
        <span id="toastText">{toast.text}</span>
        <button type="button" id="undo" hidden={!toast.undoId} onClick={d.undo}>เลิกทำ</button>
      </div>
    </div>
  );
}
