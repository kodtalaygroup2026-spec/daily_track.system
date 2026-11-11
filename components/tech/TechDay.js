'use client';
import { useEffect, useReducer, useRef } from 'react';
import Link from 'next/link';
import { th } from '@/lib/dates';
import { createDay } from './day';
import TaskBox, { Icon, Sprite } from './TaskBox';

function netText(d) {
  const msgs = [];
  if (!d.photosOk) msgs.push('เก็บรูปในเครื่องไม่ได้ พื้นที่เต็ม รูปจะหายถ้าปิดหน้านี้');
  if (!navigator.onLine) {
    const shots = d.queue.filter((x) => x.ph).length;
    msgs.push('ไม่มีสัญญาณ งานและรูปที่ถ่ายจะบันทึกไว้ในเครื่องและส่งเมื่อมีสัญญาณ'
      + (d.queue.length ? ` · รอส่ง ${d.queue.length - shots} รายการ` + (shots ? ` · รูป ${shots} ใบ` : '') : ''));
  } else if (d.sentCount) msgs.push(`ส่งแล้ว ${d.sentCount} รายการ`);
  return msgs.join(' · ');
}

export default function TechDay({ user }) {
  const [, redraw] = useReducer((n) => n + 1, 0);
  const ref = useRef(null);
  if (!ref.current) ref.current = createDay(redraw);
  const d = ref.current;

  useEffect(() => d.start(), [d]); // storage and navigator are read here, never in the first render
  useEffect(() => { d.afterCommit(); });

  const { tasks, toast } = d;
  const done = tasks.filter((t) => t.status === 'done').length;
  const doing = tasks.some((t) => t.status === 'doing');
  const todo = tasks.some((t) => t.status === 'todo');
  const now = new Date();
  const net = d.ready ? netText(d) : '';

  return (
    <div className="s-tech">
      {d.ready && (
        <>
          <Sprite />
          <div className="app">
            <header className="bar">
              <span className="brand">Daily Track</span>
              <Link className="who" href="/profile" title="โปรไฟล์ของฉัน"><span id="whoName">{user.name}</span><Icon n="chev" /></Link>
            </header>

            <p className="net" id="net" role="status" hidden={!net}>
              <Icon n="offline" />
              <span id="netText">{net}</span>
            </p>

            <section className="day" aria-label="สรุปวันนี้">
              <div className="date">
                <h1 id="date" aria-label={th(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>{th(now, { day: 'numeric', month: 'short' })}</h1>
                <p id="weekday">{th(now, { weekday: 'long' })}</p>
              </div>
              <div className="prog" id="prog" role="img" aria-label={`เสร็จ ${done} จาก ${tasks.length} ภารกิจ`}>
                {tasks.map((t) => <i key={t.id} data-s={t.status}></i>)}
              </div>
              <p className="count" id="count">{tasks.length ? `เสร็จ ${done} จาก ${tasks.length}` : ''}</p>
              <p className="hint" id="hint" hidden={!(todo && !doing)}>แตะกล่องที่รอทำ ถ่ายรูปก่อนแล้วเริ่มงาน</p>
            </section>

            <ul className="list" id="list" aria-busy={d.busy ? 'true' : undefined}
              onClick={d.onClick} onPointerDown={d.onPointerDown} onPointerMove={d.onPointerMove}
              onPointerUp={d.endDrag} onPointerCancel={d.endDrag} onKeyDown={d.onKeyDown}>
              {!tasks.length ? (
                <li className="empty"><h2>วันนี้ยังไม่มีภารกิจ</h2><p>เมื่อหัวหน้ามอบหมายงาน กล่องภารกิจจะขึ้นที่นี่</p></li>
              ) : (
                <>
                  {done === tasks.length && <li className="alldone"><h2>{`เสร็จครบทั้ง ${tasks.length} ภารกิจ`}</h2></li>}
                  {tasks.map((t) => (
                    <TaskBox key={t.id} t={t} rev={d.rev[t.id] || 0} from={d.lastChange && d.lastChange.id === t.id ? d.lastChange.from : undefined} />
                  ))}
                </>
              )}
            </ul>
          </div>
        </>
      )}

      <input type="file" id="file" accept="image/*" capture="environment" hidden ref={d.fileRef} onChange={d.onChange} />

      <div className={`toast${toast.show ? ' show' : ''}`} id="toast" role="status" aria-live="polite">
        <span id="toastText">{toast.text}</span>
        <button type="button" id="undo" hidden={!toast.undoId} onClick={d.undo}>เลิกทำ</button>
      </div>
    </div>
  );
}
