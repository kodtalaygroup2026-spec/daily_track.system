'use client';
// /supervisor/roster: the chosen week with absences and covers (รายสัปดาห์), who works which weekday or rotation (ตารางประจำ),
// and the leave requests the technicians send (คำขอลา).
// The cell box and the reject box live in Shell's overlay (the page is inert while one is open), so their state is kept here.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Dropdown from '@/components/Dropdown';
import DateField from '@/components/DateField';
import { MAX_DAY, MIN_DAY, addDays, dayNum, dur, isoOf, th, toDate, today } from '@/lib/dates';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { assignCover, decideLeave, errText, getRoster, listLeaves, setAbsent, setRoster, setRotation, setStaff, supDay, updateTask } from '@/lib/api';
import { ROTATIONS, WEEKDAYS, dowOf, needsCover, onRoster, techWorks, weekOf } from '@/lib/roster';
import Shell from './Shell';
import { Failed, Modal, useToast } from './Routines';
import { Icon } from './ui';

const TABS = [{ k: 'week', t: 'รายสัปดาห์' }, { k: 'pattern', t: 'ตารางประจำ' }, { k: 'leaves', t: 'คำขอลา' }];
const LV = { approved: ['check', 'อนุมัติแล้ว'], rejected: ['close', 'ไม่อนุมัติ'], cancelled: ['', 'ช่างยกเลิกแล้ว'] };
const MON_SAT = [1, 2, 3, 4, 5, 6];
const GONE = ['decided', 'not_found']; // the request is no longer waiting: reload, do not retry
const ST = { works: ['check', 'ทำงาน'], off: ['', 'หยุดประจำ'], absent: ['close', 'ไม่อยู่'] };
const dash = <span aria-hidden="true">–</span>;
const longDay = (iso, o) => th(toDate(iso), { weekday: 'long', day: 'numeric', month: 'long', ...o });

const stateOf = (d, tech, iso) => (d.absent.some((a) => a.techId === tech.id && a.day === iso) ? 'absent' : onRoster(tech, iso) ? 'works' : 'off');

// "13 พ.ย. 2569" / "13–15 พ.ย. 2569 · 3 วัน" / "30 พ.ย. – 2 ธ.ค. 2569 · 3 วัน"
function leaveText({ from, to }) {
  const n = dayNum(to) - dayNum(from) + 1;
  const dm = (iso, o) => th(toDate(iso), { day: 'numeric', month: 'short', ...o });
  if (n === 1) return dm(from, { year: 'numeric' });
  const a = toDate(from), b = toDate(to);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  const left = sameMonth ? String(a.getDate()) : dm(from, sameYear ? {} : { year: 'numeric' });
  return `${left}${sameMonth ? '–' : ' – '}${dm(to, { year: 'numeric' })} · ${n} วัน`;
}
const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'ส่งเมื่อสักครู่' : `ส่งเมื่อ ${dur(m)} ที่แล้ว`;
};
// the todo tasks of a day that this technician owns and someone else holds (or nobody), plus their own that they cannot do
const affected = (d, tech, iso) => d.tasks.filter((t) => t.date === iso && t.status === 'todo'
  && (t.techId === tech.id ? needsCover(t, d.techs, d.absent) : t.routine && t.ownerId === tech.id));

function Tabs({ tab, onTab, pending }) {
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
          aria-controls="rs-panel" tabIndex={tab === x.k ? 0 : -1} onClick={() => onTab(x.k)} onKeyDown={(e) => key(e, i)}>
          {x.t}
          {x.k === 'leaves' && pending > 0 && <><span className="rs-badge" aria-hidden="true">{pending}</span><span className="sr"> (รออนุมัติ {pending})</span></>}
        </button>
      ))}
    </div>
  );
}

/* ---- tab: the weekly pattern or a rotation ---- */
// One technician. An unsaved rotation is a draft kept here, so it never leaks to another card; the mode follows from
// the draft or the saved rotation, so a reload after a failed write puts it right.
function Card({ t, save, patch }) {
  const [draft, setDraft] = useState(null); // { start, mask } not saved yet
  const [last, setLast] = useState(null); // the weekly days to go back to
  const [lastRot, setLastRot] = useState(null); // the rotation the weekly pattern replaced, offered again (unsaved) on the way back
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cur = draft || t.rotation;
  const dirty = !!draft && !(t.rotation && t.rotation.start === draft.start && t.rotation.mask === draft.mask);
  const works = !!cur && cur.mask.includes('1');
  const can = dirty && works && !busy;
  const edit = (p) => { setErr(''); setDraft({ ...cur, ...p }); };

  function setMode(m) {
    if (busy) return;
    setErr('');
    if (m === 'rot') { setLast(t.days); setDraft(lastRot || { start: today(), mask: '10' }); return; }
    if (cur) setLastRot(cur);
    setDraft(null);
    if (!t.rotation) return;
    const days = [last, t.days].find((d) => d && d.length) || MON_SAT;
    save(t, { days, rotation: null }, () => setRoster(t.id, days),
      `${t.name} กลับเป็นตารางประจำทุกสัปดาห์ ทำงานวัน ${WEEKDAYS.filter((w) => days.includes(w.dow)).map((w) => w.short).join(' ')}`);
  }
  async function saveRot() {
    if (!can) return;
    const { start, mask } = draft;
    setBusy(true);
    setErr('');
    const good = await save(t, {}, () => setRotation(t.id, start, mask), `${t.name}: บันทึกรอบ ${mask.length} วันแล้ว`, setErr);
    if (good) {
      patch(t.id, { rotation: { start, mask } });
      setDraft((d) => (d && d.start === start && d.mask === mask ? null : d)); // edits made while saving stay
    }
    setBusy(false);
  }

  const n = cur ? cur.mask.length : 0;
  const resize = (d) => { if (n + d >= 2 && n + d <= 28) edit({ mask: d > 0 ? cur.mask + '1' : cur.mask.slice(0, -1) }); };
  const flip = (i) => edit({ mask: cur.mask.slice(0, i) + (cur.mask[i] === '1' ? '0' : '1') + cur.mask.slice(i + 1) });
  const next14 = cur ? Array.from({ length: 14 }, (_, i) => addDays(today(), i)) : [];
  const why = `rs-why-${t.id}`;

  return (
    <li className="rs-card" data-off={t.active ? undefined : ''}>
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

      <div className="rs-mode">
        <p className="rs-lab" id={`md-${t.id}`}>รูปแบบการทำงาน</p>
        <div className="kind" role="radiogroup" aria-labelledby={`md-${t.id}`}>
          {[['weekly', 'ประจำทุกสัปดาห์'], ['rot', 'สลับรอบวัน']].map(([k, label]) => {
            const on = (k === 'rot') === !!cur;
            return (
              <label key={k}>
                <input type="radio" name={`mode-${t.id}`} value={k} checked={on} onChange={() => setMode(k)} />
                <span>{on && <Icon n="check" />}{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {!cur && (
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
      )}

      {cur && (
        <div className="rs-rot">
          <div className="rs-presets" role="group" aria-label={`รอบสำเร็จรูปของ ${t.name}`}>
            {ROTATIONS.map(([label, m]) => (
              <button type="button" key={m} className="rs-chip" aria-pressed={cur.mask === m} onClick={() => edit({ mask: m })}>
                {cur.mask === m && <Icon n="check" />}{label}
              </button>
            ))}
          </div>
          <div className="rs-len" role="group" aria-label={`ความยาวรอบของ ${t.name}`}>
            <span className="rs-lab">ความยาวรอบ</span>
            <button type="button" className="rs-chip" aria-label="ลดความยาวรอบ" aria-disabled={n <= 2} onClick={() => resize(-1)}><span aria-hidden="true">−</span></button>
            <b className="rs-lenv" aria-live="polite">{n} วัน</b>
            <button type="button" className="rs-chip" aria-label="เพิ่มความยาวรอบ" aria-disabled={n >= 28} onClick={() => resize(1)}><Icon n="plus" /></button>
          </div>
          <div className="rs-cyc" role="group" aria-label={`วันทำงานและวันหยุดในรอบของ ${t.name}`}>
            {[...cur.mask].map((c, i) => (
              <button type="button" key={i} className="rs-day" aria-pressed={c === '1'} onClick={() => flip(i)}>
                <b>วัน {i + 1}</b>
                <span>{c === '1' ? <Icon n="check" /> : dash}{c === '1' ? 'ทำ' : 'หยุด'}</span>
              </button>
            ))}
          </div>
          <div className="field rs-start">
            <label htmlFor={`rs-start-${t.id}`}>เริ่มนับรอบวันที่</label>
            <DateField id={`rs-start-${t.id}`} label="เริ่มนับรอบวันที่" value={cur.start} onChange={(v) => edit({ start: v })} min={MIN_DAY} max={MAX_DAY} describedBy={`rs-sh-${t.id}`} />
            <p className="rs-hint" id={`rs-sh-${t.id}`}>วันที่เลือกคือ วัน 1 ของรอบ</p>
          </div>
          <div className="rs-prev">
            <p className="rs-lab" id={`pv-${t.id}`}>14 วันข้างหน้า</p>
            <ul className="rs-pv" aria-labelledby={`pv-${t.id}`}>
              {next14.map((d) => {
                const on = onRoster({ ...t, active: true, rotation: cur }, d);
                return (
                  <li key={d} data-on={on ? '' : undefined}>
                    <span className="sr">{longDay(d)}: </span>
                    <small aria-hidden="true">{WEEKDAYS.find((w) => w.dow === dowOf(d)).short}</small>
                    <b aria-hidden="true">{toDate(d).getDate()}</b>
                    <span>{on ? <Icon n="check" /> : dash}{on ? 'ทำ' : 'หยุด'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rs-save">
            <button type="button" className="primary" aria-disabled={!can} aria-describedby={works ? undefined : why} onClick={saveRot}>{busy ? 'กำลังบันทึก…' : 'บันทึกรอบ'}</button>
            <p className="rs-state" data-dirty={dirty ? '' : undefined}>{dirty ? <><Icon n="alert" />ยังไม่ได้บันทึก</> : <><Icon n="check" />บันทึกแล้ว</>}</p>
          </div>
          {!works && <p className="err rs-err" id={why}><Icon n="alert" />ต้องมีอย่างน้อย 1 วันที่ทำงาน จึงจะบันทึกได้</p>}
          {err && <p className="err rs-err" role="alert"><Icon n="alert" />{err}</p>}
        </div>
      )}
    </li>
  );
}

function Pattern({ toast }) {
  const [techs, setTechs] = useState(null);
  const [fail, setFail] = useState('');
  const load = useCallback(async () => {
    try { setTechs(await getRoster()); setFail(''); } catch (e) { setFail(errText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = (id, p) => setTechs((ts) => ts && ts.map((x) => (x.id === id ? { ...x, ...p } : x)));
  // Every tap shows at once and its write is queued behind the earlier ones, so the last tap wins and none is dropped.
  // Each call carries the values the screen showed when it was tapped. After a failed write, reload once the queue is empty.
  // The promise says whether the write worked; a failure goes to the toast, or to inline(text) when the caller shows it by its field.
  const queue = useRef({ chain: Promise.resolve(), n: 0, failed: false });
  function save(t, p, call, ok, inline) {
    const q = queue.current;
    patch(t.id, p);
    q.n++;
    const run = q.chain.then(async () => {
      try { await call(); toast(ok); return true; } catch (e) { q.failed = true; (inline || toast)(errText(e)); return false; }
    });
    q.chain = run.then(() => { if (--q.n === 0 && q.failed) { q.failed = false; load(); } });
    return run;
  }

  if (fail) return <Failed text={fail} onRetry={load} />;
  if (!techs) return <p role="status">กำลังโหลด…</p>;
  if (!techs.length) return <div className="empty"><h2>ยังไม่มีช่างในระบบ</h2></div>;
  return (
    <>
      <p className="rs-intro">เลือกว่าช่างทำงานตามวันในสัปดาห์ หรือสลับเป็นรอบวัน เช่น วันเว้นวัน · ในวันที่ช่างหยุด งานประจำของช่างคนนั้นจะยังไม่มีคนทำ จนกว่าจะเลือกคนแทน</p>
      <ul className="rs-list">
        {techs.map((t) => <Card key={t.id} t={t} save={save} patch={patch} />)}
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

/* ---- tab: leave requests ---- */
function Leaves({ list, fail, onRetry, busy, notice, onWeek, onApprove, onReject, focus, focusKey }) {
  const [filter, setFilter] = useState('pending');
  const head = useRef(null);
  // after a request leaves the waiting list the button that had focus is gone: focus goes to the next waiting request, else the heading
  useEffect(() => {
    const w = focus.current;
    if (!w) return;
    focus.current = null;
    const el = w.id && document.querySelector(`[data-lv="${w.id}"] .lv-yes`);
    (el || head.current).focus();
  }, [focusKey, focus]);

  const all = list || [];
  const pend = all.filter((l) => l.status === 'pending');
  const shown = filter === 'pending' ? pend : [...pend, ...all.filter((l) => l.status !== 'pending')];
  const nextOf = (id) => { const i = pend.findIndex((l) => l.id === id); return (pend[i + 1] || pend[i - 1] || {}).id || null; };

  return (
    <>
      <div className="lv-head">
        <h2 tabIndex={-1} ref={head}>คำขอลาของช่าง</h2>
        {!fail && all.length > 0 && (
          <div className="seg" role="group" aria-label="กรองคำขอลา">
            {[['pending', `รออนุมัติ ${pend.length}`], ['all', `ทั้งหมด ${all.length}`]].map(([k, t]) => (
              <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
        )}
      </div>
      <p className="rs-intro">ช่างส่งคำขอลาจากหน้าปฏิทินของตัวเอง เมื่ออนุมัติ ช่างจะถูกบันทึกว่าไม่อยู่ทุกวันที่ขอ แล้วเลือกคนแทนในแท็บรายสัปดาห์</p>
      {notice && (
        <div className="lv-notice">
          <p>เลือกคนแทน {notice.tech} ได้ในแท็บรายสัปดาห์</p>
          <button type="button" className="secondary" onClick={() => onWeek(notice.day)}>ไปที่สัปดาห์ของวันลา</button>
        </div>
      )}
      {fail && <Failed text={fail} onRetry={onRetry} />}
      {!fail && !list && <p role="status">กำลังโหลด…</p>}
      {!fail && list && !all.length && (
        <div className="empty">
          <h2>ยังไม่มีคำขอลา</h2>
          <p>เมื่อช่างขอลา คำขอจะมาอยู่ที่นี่</p>
        </div>
      )}
      {!fail && all.length > 0 && !shown.length && (
        <div className="empty">
          <h2>ไม่มีคำขอลาที่รออนุมัติ</h2>
          <p>ดูคำขอที่ตัดสินแล้วได้ที่ตัวกรอง ทั้งหมด</p>
        </div>
      )}
      {!fail && shown.length > 0 && (
        <ul className="lv-list">
          {shown.map((l) => {
            const waiting = l.status === 'pending';
            const [ic, word] = LV[l.status] || ['', l.status];
            return (
              <li key={l.id} className="lv" data-lv={l.id} data-done={waiting ? undefined : ''}>
                <div className="lv-main">
                  <p className="lv-who"><b>{l.tech}</b> <span>{l.code}</span></p>
                  <p className="lv-range">{leaveText(l)}</p>
                  {l.reason && <p className="lv-reason"><span className="sr">เหตุผล: </span>{l.reason}</p>}
                  <p className="lv-ago">{ago(l.createdAt)}</p>
                  {!waiting && (
                    <>
                      <p className="lv-st">{ic ? <Icon n={ic} /> : dash}{word}</p>
                      {l.note && <p className="lv-ago">ข้อความถึงช่าง: {l.note}</p>}
                    </>
                  )}
                </div>
                {waiting && (
                  <div className="lv-acts">
                    <button type="button" className="primary lv-yes" aria-disabled={busy} aria-label={`อนุมัติคำขอลาของ ${l.tech} ${leaveText(l)}`}
                      onClick={() => onApprove(l, nextOf(l.id))}>อนุมัติ</button>
                    <button type="button" className="secondary" aria-disabled={busy} aria-label={`ไม่อนุมัติคำขอลาของ ${l.tech} ${leaveText(l)}`}
                      onClick={() => onReject(l, nextOf(l.id))}>ไม่อนุมัติ</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// onDecide(note) answers null when the request is settled (the box then closes) or the error to show here
function RejectBox({ l, onClose, onDecide }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    const bad = await onDecide(note.trim());
    if (bad) { setErr(errText(bad)); setBusy(false); }
  }
  const close = () => { if (!busy) onClose(); }; // the answer would be lost with the box
  return (
    <Modal small title="ไม่อนุมัติคำขอลา" sub={`${l.tech} · ${leaveText(l)}`} onClose={close} onSubmit={go}>
      <div className="tm-body">
        <div className="field" data-err={err ? '' : undefined}>
          <label htmlFor="lv-note">ข้อความถึงช่าง (ไม่บังคับ)</label>
          <input type="text" id="lv-note" value={note} maxLength={200} autoComplete="off" aria-describedby={err ? 'lv-err' : 'lv-help'} onChange={(e) => setNote(e.target.value)} />
          <p className="rs-hint" id="lv-help">ช่างจะเห็นข้อความนี้ในปฏิทินของตัวเอง · {note.length}/200</p>
          {err && <p className="err rs-err" id="lv-err" role="alert"><Icon n="alert" />{err}</p>}
        </div>
      </div>
      <div className="tm-foot actions">
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ไม่อนุมัติ'}</button>
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
  const [leaves, setLeaves] = useState(null);
  const [lfail, setLfail] = useState('');
  const [rej, setRej] = useState(null); // { l, next }: the request being rejected
  const [deciding, setDeciding] = useState(false);
  const [notice, setNotice] = useState(null); // { tech, day } after an approval
  const [focusKey, setFocusKey] = useState(0);
  const [toast, toastNode] = useToast();
  const seq = useRef(0); // a slow answer for a week the user already left is dropped
  const lseq = useRef(0); // the same for the leave list
  const focus = useRef(null); // { id }: where Leaves puts focus after a decision
  const weekFocus = useRef(false);

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

  // the list is capped at the newest 200 rows, so the waiting ones are asked for by themselves: none can fall off the end
  // quiet: a failed background refresh keeps the list on screen
  const loadLeaves = useCallback(async (quiet) => {
    const n = ++lseq.current;
    try {
      const [p, all] = await Promise.all([listLeaves('pending'), listLeaves()]);
      if (n === lseq.current) { setLeaves([...p, ...all.filter((l) => l.status !== 'pending')]); setLfail(''); }
    } catch (e) {
      if (n === lseq.current && quiet !== true) setLfail(errText(e));
    }
  }, []);
  useEffect(() => { loadLeaves(); }, [tab, loadLeaves]); // on every tab change too, so the count on the tab stays fresh
  useEffect(() => { // new requests show up while the list is open, as on the menu count
    if (tab !== 'leaves') return;
    const poll = () => { if (document.visibilityState === 'visible') loadLeaves(true); };
    const iv = setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', poll); };
  }, [tab, loadLeaves]);

  const tabNow = useRef('week'); // approve() answers later: it must know whether the list is still on screen

  const pick = (k) => { tabNow.current = k; setTab(k); setNotice(null); };
  function goWeek(day) {
    weekFocus.current = true;
    setMonday(isoOf(weekOf(day)));
    setFail('');
    pick('week');
  }
  useEffect(() => {
    if (weekFocus.current && tab === 'week') { weekFocus.current = false; document.getElementById('tab-week').focus(); }
  }, [tab]);

  // the answer is always followed by a reload: whatever the server said, the list then shows the truth
  async function decide(l, yes, note) {
    setDeciding(true);
    let err = null;
    try { await decideLeave(l.id, yes, note); } catch (e) { err = e; }
    await loadLeaves();
    window.dispatchEvent(new Event('dt:leaves')); // Shell refreshes the count on the menu
    setDeciding(false);
    return err;
  }
  const settled = (err) => !err || GONE.includes(err.code);
  async function approve(l, next) {
    if (deciding) return;
    const err = await decide(l, true, '');
    const here = tabNow.current === 'leaves';
    if (err) toast(errText(err));
    else {
      toast(`อนุมัติแล้ว · ${l.tech} ไม่อยู่ ${leaveText(l)} · เลือกคนแทนในแท็บรายสัปดาห์`);
      if (here) setNotice({ tech: l.tech, day: l.from });
    }
    if (here && settled(err)) { focus.current = { id: next }; setFocusKey((k) => k + 1); }
  }
  async function reject(note) {
    const { l, next } = rej;
    const err = await decide(l, false, note);
    if (!settled(err)) return err;
    toast(err ? errText(err) : `ไม่อนุมัติคำขอลาของ ${l.tech} แล้ว`);
    focus.current = { id: next };
    setRej(null);
    setFocusKey((k) => k + 1);
    return null;
  }

  const ready = data && data.monday === monday ? data : null;
  const pending = leaves ? leaves.filter((l) => l.status === 'pending').length : 0;
  return (
    <Shell user={user} active="roster" overlay={(
      <>
        {box && ready && <CellBox data={ready} techId={box.techId} day={box.day} onClose={() => setBox(null)} reload={load} toast={toast} />}
        {rej && <RejectBox l={rej.l} onClose={() => setRej(null)} onDecide={reject} />}
        {toastNode}
      </>
    )}>
      <main className="layout plan">
        <header className="pl-head">
          <div>
            <h1 tabIndex={-1}>ตารางช่าง</h1>
            <p className="rel">ดูว่าช่างแต่ละคนทำงานวันไหน เรียกช่างอีกคนมาแทนเมื่อมีคนไม่อยู่ และตอบคำขอลา</p>
          </div>
        </header>
        <Tabs tab={tab} onTab={pick} pending={pending} />
        <div id="rs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="rs-panel">
          {tab === 'week' && <Week monday={monday} setMonday={(m) => { setMonday(m); setFail(''); }} data={ready} fail={fail} onRetry={load} onTab={pick} onOpen={(techId, day) => setBox({ techId, day })} />}
          {/* kept mounted: an unsaved rotation draft and a write still in flight survive a visit to another tab */}
          <div className="rs-panel" hidden={tab !== 'pattern'}><Pattern toast={toast} /></div>
          {tab === 'leaves' && (
            <Leaves list={leaves} fail={lfail} onRetry={loadLeaves} busy={deciding} notice={notice} onWeek={goWeek}
              onApprove={approve} onReject={(l, next) => { if (!deciding) setRej({ l, next }); }} focus={focus} focusKey={focusKey} />
          )}
        </div>
      </main>
    </Shell>
  );
}
