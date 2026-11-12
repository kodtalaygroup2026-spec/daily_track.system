'use client';
// /supervisor/roster: who works which weekday (ตารางประจำ), and the chosen week with absences and covers (สัปดาห์นี้).
// The cell box lives in Shell's overlay (the page is inert while it is open), so the week's state is kept here.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Dropdown from '@/components/Dropdown';
import { addDays, isoOf, th, toDate, today } from '@/lib/dates';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { assignCover, errText, getRoster, setAbsent, setRoster, setStaff, supDay, updateTask } from '@/lib/api';
import { WEEKDAYS, dowOf, needsCover, techWorks, weekOf } from '@/lib/roster';
import Shell from './Shell';
import { Failed, Modal, useToast } from './Routines';
import { Icon } from './ui';

const TABS = [{ k: 'week', t: 'รายสัปดาห์' }, { k: 'pattern', t: 'ตารางประจำ' }];
const ST = { works: ['check', 'ทำงาน'], off: ['', 'หยุดประจำ'], absent: ['close', 'ไม่อยู่'] };
const dash = <span aria-hidden="true">–</span>;
const longDay = (iso, o) => th(toDate(iso), { weekday: 'long', day: 'numeric', month: 'long', ...o });

const stateOf = (d, tech, iso) => (d.absent.some((a) => a.techId === tech.id && a.day === iso) ? 'absent' : tech.days.includes(dowOf(iso)) ? 'works' : 'off');
// the todo tasks of a day that this technician owns and someone else holds (or nobody), plus their own that they cannot do
const affected = (d, tech, iso) => d.tasks.filter((t) => t.date === iso && t.status === 'todo'
  && (t.techId === tech.id ? needsCover(t, d.techs, d.absent) : t.routine && t.ownerId === tech.id));

function Tabs({ tab, onTab }) {
  const refs = useRef([]);
  function key(e, i) {
    const go = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (go === undefined) return;
    e.preventDefault();
    const n = (go + TABS.length) % TABS.length;
    onTab(TABS[n].k);
    refs.current[n].focus();
  }
  return (
    <div className="seg rs-tabs" role="tablist" aria-label="มุมมองตารางช่าง">
      {TABS.map((x, i) => (
        <button type="button" role="tab" key={x.k} id={`tab-${x.k}`} ref={(el) => { refs.current[i] = el; }} aria-selected={tab === x.k}
          aria-controls="rs-panel" tabIndex={tab === x.k ? 0 : -1} onClick={() => onTab(x.k)} onKeyDown={(e) => key(e, i)}>{x.t}</button>
      ))}
    </div>
  );
}

/* ---- tab: the weekly pattern ---- */
function Pattern({ toast }) {
  const [techs, setTechs] = useState(null);
  const [fail, setFail] = useState('');
  const load = useCallback(async () => {
    try { setTechs(await getRoster()); setFail(''); } catch (e) { setFail(errText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Every tap shows at once and its write is queued behind the earlier ones, so the last tap wins and none is dropped.
  // Each call carries the values the screen showed when it was tapped. After a failed write, reload once the queue is empty.
  const queue = useRef({ chain: Promise.resolve(), n: 0, failed: false });
  function save(t, patch, call, ok) {
    const q = queue.current;
    setTechs((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    q.n++;
    q.chain = q.chain.then(async () => {
      try { await call(); toast(ok); } catch (e) { q.failed = true; toast(errText(e)); }
      if (--q.n === 0 && q.failed) { q.failed = false; load(); }
    });
  }

  if (fail) return <Failed text={fail} onRetry={load} />;
  if (!techs) return <p role="status">กำลังโหลด…</p>;
  if (!techs.length) return <div className="empty"><h2>ยังไม่มีช่างในระบบ</h2></div>;
  return (
    <>
      <p className="rs-intro">วันที่ช่างหยุด งานประจำของช่างคนนั้นจะยังไม่มีคนทำ จนกว่าจะเลือกคนแทน</p>
      <ul className="rs-list">
        {techs.map((t) => (
          <li key={t.id} className="rs-card" data-off={t.active ? undefined : ''}>
            <div className="rs-top">
              <div className="rs-who">
                <b>{t.name}</b>
                <span>{t.code}{!t.active && ' · ไม่ใช้งาน'}</span>
              </div>
              <Dropdown id={`br-${t.id}`} label={`สาขาของ ${t.name}`} value={t.branch || ''}
                options={t.branch ? BRANCHES : [{ value: '', label: 'ยังไม่ระบุสาขา' }, ...BRANCHES]}
                onChange={(b) => save(t, { branch: b }, () => setStaff(t.id, { name: t.name, branch: b, active: t.active }), `${t.name} อยู่สาขา ${branchLabel(b)} แล้ว`)} />
              <button type="button" role="switch" aria-checked={t.active} className="rs-sw" aria-label={`ใช้งานอยู่ ${t.name}`}
                onClick={() => save(t, { active: !t.active }, () => setStaff(t.id, { name: t.name, branch: t.branch, active: !t.active }), t.active ? `${t.name} ไม่ใช้งานแล้ว` : `${t.name} ใช้งานอีกครั้งแล้ว`)}>
                <i aria-hidden="true" />ใช้งานอยู่
              </button>
            </div>
            <div className="rs-days" role="group" aria-label={`วันทำงานของ ${t.name}`}>
              {WEEKDAYS.map((w) => {
                const on = t.days.includes(w.dow);
                const days = on ? t.days.filter((d) => d !== w.dow) : [...t.days, w.dow].sort();
                return (
                  <button type="button" key={w.dow} className="rs-day" aria-pressed={on}
                    aria-label={`${t.name} วัน${w.long} ${on ? 'ทำงาน' : 'หยุด'}`}
                    onClick={() => save(t, { days }, () => setRoster(t.id, days), `${t.name} วัน${w.long}: ${on ? 'หยุด' : 'ทำงาน'}`)}>
                    <b>{w.short}</b>
                    <span>{on ? <Icon n="check" /> : dash}{on ? 'ทำ' : 'หยุด'}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---- tab: the chosen week ---- */
function Week({ monday, setMonday, data, fail, onRetry, onOpen, onTab }) {
  const days = WEEKDAYS.map((w, i) => ({ ...w, iso: addDays(monday, i) }));
  const thisWeek = isoOf(weekOf(today()));
  const range = `${th(toDate(monday), { day: 'numeric', month: 'short' })} – ${th(toDate(days[6].iso), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const techs = data ? data.techs.filter((x) => x.active) : [];
  const need = (iso) => (data ? data.tasks.filter((t) => t.date === iso && needsCover(t, data.techs, data.absent)).length : 0);
  const nav = (m) => () => setMonday(m);

  return (
    <>
      <div className="rs-nav">
        <button type="button" className="ghost icon" aria-label="สัปดาห์ก่อนหน้า" onClick={nav(addDays(monday, -7))}><Icon n="left" /></button>
        <p className="rs-range" aria-live="polite">{range}</p>
        <button type="button" className="ghost icon" aria-label="สัปดาห์ถัดไป" onClick={nav(addDays(monday, 7))}><Icon n="right" /></button>
        <button type="button" className="ghost" aria-disabled={monday === thisWeek} onClick={() => { if (monday !== thisWeek) setMonday(thisWeek); }}>กลับมาสัปดาห์นี้</button>
      </div>

      {fail && <Failed text={fail} onRetry={onRetry} />}
      {!fail && !data && <p role="status">กำลังโหลด…</p>}
      {data && !techs.length && (
        <div className="empty">
          <h2>ยังไม่มีช่างที่ใช้งานอยู่</h2>
          <p>เปิดใช้งานช่างได้ที่แท็บ ตารางประจำ</p>
          <button type="button" className="secondary" onClick={() => onTab('pattern')}>ไปที่ตารางประจำ</button>
        </div>
      )}
      {data && techs.length > 0 && (
        <div className="rs-wrap" role="region" aria-label="ตารางช่างรายสัปดาห์" tabIndex={0}>
          <table className="rs-grid">
            <caption className="sr">ช่างแต่ละคนทำงานหรือหยุดในแต่ละวัน และจำนวนงานที่ต้องหาคนแทน</caption>
            <thead>
              <tr>
                <th scope="col">ช่าง</th>
                {days.map((d) => (
                  <th scope="col" key={d.iso} className="rs-dh">
                    <span>{d.short}</span><b>{toDate(d.iso).getDate()}</b>{d.iso === today() && <small>วันนี้</small>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="rs-tot">
                <th scope="row">ต้องหาคนแทน</th>
                {days.map((d) => {
                  const n = need(d.iso);
                  return (
                    <td key={d.iso}>
                      {n > 0
                        ? <Link href={`/supervisor?date=${d.iso}`}><Icon n="alert" />ต้องหาคนแทน {n}</Link>
                        : <span className="rs-ok"><Icon n="check" />ไม่มี</span>}
                    </td>
                  );
                })}
              </tr>
              {techs.map((x) => (
                <tr key={x.id}>
                  <th scope="row"><b>{x.name}</b><small>{x.code} · {branchLabel(x.branch)}</small></th>
                  {days.map((d) => {
                    const st = stateOf(data, x, d.iso);
                    const abs = data.absent.find((a) => a.techId === x.id && a.day === d.iso);
                    const n = data.tasks.filter((t) => t.date === d.iso && t.techId === x.id).length;
                    const open = affected(data, x, d.iso).filter((t) => needsCover(t, data.techs, data.absent)).length;
                    return (
                      <td key={d.iso}>
                        <button type="button" className="rs-cell" data-st={st} onClick={() => onOpen(x.id, d.iso)}>
                          <span className="sr">{x.name} {longDay(d.iso)}: </span>
                          <span className="rs-st">{ST[st][0] ? <Icon n={ST[st][0]} /> : dash}{ST[st][1]}</span>
                          {abs && abs.note && <span className="rs-memo">{abs.note}</span>}
                          <span className="rs-n">{n ? `${n} งาน` : 'ไม่มีงาน'}</span>
                          {open > 0 && <span className="rs-need"><Icon n="alert" />รอคนแทน {open}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---- the box of one technician on one day: absence and covers ---- */
function CellBox({ data, techId, day, onClose, reload, toast }) {
  const tech = data.techs.find((x) => x.id === techId);
  const abs = data.absent.find((a) => a.techId === techId && a.day === day);
  const [note, setNote] = useState((abs && abs.note) || '');
  const [busy, setBusy] = useState(false);
  if (!tech) return null;

  async function act(call, ok) {
    if (busy) return;
    setBusy(true);
    try {
      await call();
      await reload();
      toast(ok);
    } catch (e) {
      toast(errText(e));
      reload();
    }
    setBusy(false);
  }

  const st = stateOf(data, tech, day);
  const list = affected(data, tech, day);
  const total = data.tasks.filter((t) => t.date === day && (t.techId === techId || (t.routine && t.ownerId === techId))).length;
  const crew = data.techs.filter((x) => x.id !== techId && techWorks(x, data.absent, day));
  const nameOf = (id) => (data.techs.find((x) => x.id === id) || { name: '' }).name;
  const opts = (t) => {
    const b = t.branch || tech.branch; // same branch first
    const o = [...crew.filter((x) => x.branch === b), ...crew.filter((x) => x.branch !== b)]
      .map((x) => ({ value: x.id, label: x.branch === b ? x.name : `${x.name} · ${branchLabel(x.branch)}` }));
    if (t.techId && !crew.some((x) => x.id === t.techId)) o.unshift({ value: t.techId, label: `${t.tech} (ไม่ได้ทำงานวันนั้น)` });
    return t.routine ? [{ value: '', label: 'ยังไม่มีคนทำ' }, ...o] : o; // only a routine task can wait with nobody
  };
  // a routine's owner stays and the task changes hands; a one-off task is simply given to someone else
  const give = (t, v) => (t.routine ? assignCover(t.id, v || null)
    : updateTask(t.id, { title: t.title, place: t.place, branch: t.branch, date: t.date, time: t.time, techId: v }));
  const tagOf = (t) => {
    if (!t.techId) return 'ยังไม่มีคนทำ';
    if (crew.some((x) => x.id === t.techId)) return `แทนโดย ${t.tech}`;
    return t.techId === techId ? `ยังเป็นของ ${t.tech} ซึ่งไม่ได้ทำงาน` : `แทนโดย ${t.tech} (ไม่ได้ทำงาน)`;
  };

  return (
    <Modal title={`${tech.name} · ${longDay(day, { year: 'numeric' })}`} sub={ST[st][1]} onClose={onClose}>
      <div className="tm-body">
        <button type="button" role="switch" aria-checked={!!abs} className="rs-sw rs-abs" aria-disabled={busy}
          onClick={() => act(() => setAbsent(techId, day, !abs, abs ? '' : note.trim()), abs ? `${tech.name} กลับมาทำงานวันนั้นแล้ว` : `บันทึกว่า ${tech.name} ไม่อยู่แล้ว`)}>
          <i aria-hidden="true" />ไม่อยู่ (ลา/ป่วย)
        </button>
        {abs && (
          <form className="rs-note" onSubmit={(e) => { e.preventDefault(); act(() => setAbsent(techId, day, true, note.trim()), 'บันทึกหมายเหตุแล้ว'); }}>
            <div className="field">
              <label htmlFor="rs-note">หมายเหตุ (ไม่บังคับ)</label>
              <input type="text" id="rs-note" value={note} maxLength={100} autoComplete="off" onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="submit" className="secondary" aria-disabled={busy}>บันทึกหมายเหตุ</button>
          </form>
        )}

        <h3>งานที่ต้องหาคนแทน</h3>
        {list.length === 0 && <p className="lock">{total === 0 ? 'ช่างคนนี้ไม่มีงานวันนั้น' : 'ไม่มีงานที่ต้องหาคนแทน'}</p>}
        {list.length > 0 && crew.length === 0 && <p className="rs-none"><Icon n="alert" />ไม่มีช่างที่ทำงานวันนั้น</p>}
        {list.length > 0 && (
          <ul className="rs-cv">
            {list.map((t) => (
              <li key={t.id}>
                <div>
                  <b>{t.title}</b>
                  <p>{t.time} · {t.place}</p>
                  <p className="rs-tag"><Icon n={t.techId && crew.some((x) => x.id === t.techId) ? 'swap' : 'alert'} />{tagOf(t)}</p>
                </div>
                <div className="field">
                  <label htmlFor={`cv-${t.id}`}>เลือกคนแทน</label>
                  <Dropdown id={`cv-${t.id}`} label={`เลือกคนแทน ${t.title}`} value={t.techId || ''} options={opts(t)}
                    onChange={(v) => act(() => give(t, v), v ? `${t.title}: ${nameOf(v)} ทำแทนแล้ว` : `${t.title}: ยังไม่มีคนทำ`)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tm-foot actions">
        <button type="button" className="secondary" onClick={onClose}>ปิด</button>
      </div>
    </Modal>
  );
}

export default function Roster({ user }) {
  const [tab, setTab] = useState('week');
  const [monday, setMonday] = useState(() => isoOf(weekOf(today())));
  const [data, setData] = useState(null); // the week it holds is data.monday
  const [fail, setFail] = useState('');
  const [box, setBox] = useState(null); // { techId, day }
  const [toast, toastNode] = useToast();
  const seq = useRef(0); // a slow answer for a week the user already left is dropped

  const load = useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await supDay(monday, addDays(monday, 6));
      if (n === seq.current) { setData({ ...r, monday }); setFail(''); }
    } catch (e) {
      if (n === seq.current) setFail(errText(e));
    }
  }, [monday]);
  useEffect(() => { if (tab === 'week') load(); }, [tab, load]);

  const ready = data && data.monday === monday ? data : null;
  return (
    <Shell user={user} active="roster" overlay={(
      <>
        {box && ready && <CellBox data={ready} techId={box.techId} day={box.day} onClose={() => setBox(null)} reload={load} toast={toast} />}
        {toastNode}
      </>
    )}>
      <main className="layout plan">
        <header className="pl-head">
          <div>
            <h1 tabIndex={-1}>ตารางช่าง</h1>
            <p className="rel">ดูว่าช่างแต่ละคนทำงานวันไหน และเรียกช่างอีกคนมาแทนเมื่อมีคนไม่อยู่</p>
          </div>
        </header>
        <Tabs tab={tab} onTab={setTab} />
        <div id="rs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="rs-panel">
          {tab === 'week'
            ? <Week monday={monday} setMonday={(m) => { setMonday(m); setFail(''); }} data={ready} fail={fail} onRetry={load} onTab={setTab} onOpen={(techId, day) => setBox({ techId, day })} />
            : <Pattern toast={toast} />}
        </div>
      </main>
    </Shell>
  );
}
