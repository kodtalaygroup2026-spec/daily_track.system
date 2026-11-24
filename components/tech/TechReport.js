'use client';
// "รายงานงานที่ทำ": the technician records what they did on today or yesterday, with photos, in two kinds:
// a part of one of their routine tasks (งานประจำ) or work they add themselves (ที่ฉันเพิ่มเอง).
// A report is created first, then its photos go up one by one: a failed photo never creates the report twice,
// it stays in the box until it is sent (or the box is closed and "เพิ่มรูป" is used later).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addDays, th, toDate, today } from '@/lib/dates';
import { COMMON, PLACES } from '@/lib/presets';
import { toJpeg } from '@/lib/image';
import { addReportPhoto, createReport, deleteReport, errText, myReports, techDay, updateReport } from '@/lib/api';
import PhotoViewer from '@/components/PhotoViewer';

const P = {
  left: 'M15 5l-7 7 7 7', check: 'M4.5 12.5l5 5 10-11', x: 'M6 6l12 12M18 6L6 18', warn: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  plus: 'M12 5v14M5 12h14', camera: 'M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3v10.5h-17zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5v.01', zoom: 'M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15 15l5.5 5.5',
};
function Ic({ d }) {
  return (
    <svg className="ic" aria-hidden="true" viewBox="0 0 24 24">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const OFFLINE = 'ต้องต่อเน็ตก่อนจึงจะส่งรายงานได้';
const MAXP = 6;
const LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const SHORT = { day: 'numeric', month: 'short' };
const KINDS = [['routine', 'งานประจำ'], ['adhoc', 'ที่ฉันเพิ่มเอง']];
const STATUS = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };
const sentAt = (iso) => new Date(iso).toTimeString().slice(0, 5);
const gone = (p) => URL.revokeObjectURL(p.url);
const FIELD = { task: 'input[name="rt"]', title: '#rp-title', place: '#rp-place', note: '#rp-note', photos: '#rp-cam' };

// downscale the picked files into photo items; whatever is not an image, cannot be decoded or does not fit the limit is counted in note
async function prep(files, room, next) {
  const take = files.slice(0, Math.max(room, 0)), out = [];
  let bad = 0;
  for (const file of take) {
    try {
      if (file.type && !file.type.startsWith('image/')) throw new Error('not an image');
      const blob = await toJpeg(file);
      if (!blob) throw new Error('not encoded');
      out.push({ id: next(), blob, url: URL.createObjectURL(blob), st: 'new' }); // st: new | ok (uploaded) | fail
    } catch (e) { bad++; }
  }
  const note = [
    bad && `ไฟล์ที่ไม่ใช่รูปหรือเปิดไม่ได้ ${bad} ไฟล์ ไม่ได้ถูกเพิ่ม`,
    files.length > take.length && `ใส่รูปได้ไม่เกิน ${MAXP} รูปต่อรายงาน${take.length ? ` · เพิ่มให้ ${take.length} รูปแรก` : ''}`,
  ].filter(Boolean).join(' · ');
  return { out, note };
}

function Card({ r, place, on }) {
  const n = r.photos.length;
  return (
    <li className="rp">
      <h3>{r.title}</h3>
      {place && <p className="quiet">{place}</p>}
      {r.place && <p><span className="k">ส่วนที่ทำ</span> {r.place}</p>}
      {r.note && <p><span className="k">หมายเหตุ</span> {r.note}</p>}
      <p className="quiet">{`ส่งเมื่อ ${sentAt(r.createdAt)} น. · ${n} รูป`}</p>
      <div className="thumbs">
        {r.photos.map((p, i) => (
          <button key={p.path} type="button" className="zoom" aria-label={`ดูรูปที่ ${i + 1} จาก ${n} ของ ${r.title}`} onClick={() => on.view(r, i)}>
            {p.url ? <img className="shot" src={p.url} alt="" /> : <span className="shot noimg">รูป</span>}
            <span className="mag" aria-hidden="true"><Ic d={P.zoom} /></span>
          </button>
        ))}
      </div>
      <div className="acts">
        {n < MAXP && <button type="button" className="tb" aria-label={`เพิ่มรูปให้ ${r.title}`} onClick={() => on.add(r)}>เพิ่มรูป</button>}
        <button type="button" className="tb" aria-label={`แก้ไข ${r.title}`} onClick={() => on.edit(r)}>แก้ไข</button>
        <button type="button" className="tb" aria-label={`ลบ ${r.title}`} onClick={() => on.del(r)}>ลบ</button>
      </div>
    </li>
  );
}

export default function TechReport() {
  const now = today();
  const [back, setBack] = useState(false); // false = today, true = yesterday
  const day = back ? addDays(now, -1) : now;
  const [tab, setTab] = useState('routine');
  const [data, setData] = useState(null); // { day, reports, tasks: routine tasks of that day | null when they could not be read }
  const [err, setErr] = useState('');
  const [again, setAgain] = useState(false); // the retry button is working
  const [online, setOnline] = useState(true);
  const [view, setView] = useState(null); // { id, i }: the photo open in the viewer
  const [f, setF] = useState(null); // the open box: { mode: 'new' | 'add' | 'edit', kind, day, report, taskId, title, place, note }
  const [errs, setErrs] = useState({}); // { task, title, place, note, photos, form }
  const [pics, setPics] = useState([]); // photos of the open box: { id, blob, url, st }
  const [made, setMade] = useState(''); // id of the report the box is sending photos to; set once it exists, so it is never created twice
  const [busy, setBusy] = useState(false);
  const [prepping, setPrepping] = useState(false);
  const [prog, setProg] = useState('');
  const [del, setDel] = useState(null);
  const [delErr, setDelErr] = useState('');
  const [toast, setToast] = useState({ text: '', show: false });
  const dlg = useRef(null), cdlg = useRef(null), camRef = useRef(null), galRef = useRef(null), head = useRef(null);
  const timer = useRef(0), seq = useRef(0), lock = useRef(false), want = useRef(''), pickFor = useRef(null), gen = useRef(0), nid = useRef(0), live = useRef([]);
  // lock: a send is running (a ref, so a second tap cannot slip in before the state updates); want: what to focus after the next draw
  // pickFor: the report a file pick is for ("เพิ่มรูป" on a card), null = the open box; gen: bumped on every open and close; live: the box's photos

  const ready = !!data && data.day === day;
  const rows = ready ? data.reports.filter((r) => r.kind === tab) : [];
  const count = (k) => (ready ? data.reports.filter((r) => r.kind === k).length : 0);

  // the newest load wins: answers for a day or a state already left behind are dropped
  const load = useCallback(async (d) => {
    const n = ++seq.current;
    try {
      const [reports, tasks] = await Promise.all([myReports(d), techDay(d).catch(() => null)]);
      if (n !== seq.current) return;
      setData({ day: d, reports, tasks: tasks && tasks.filter((t) => t.routine) });
      setErr('');
    } catch (e) {
      if (n === seq.current) setErr(errText(e)); // what is on screen stays
    }
  }, []);
  useEffect(() => {
    load(day);
    const net = () => { setOnline(navigator.onLine); if (navigator.onLine) load(day); };
    const seen = () => { if (!document.hidden) load(day); };
    setOnline(navigator.onLine);
    document.addEventListener('visibilitychange', seen);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    return () => {
      document.removeEventListener('visibilitychange', seen);
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
    };
  }, [day, load]);
  useEffect(() => { live.current = pics; });
  useEffect(() => () => { live.current.forEach(gone); clearTimeout(timer.current); }, []);
  // focus can only move once the box has been drawn
  useEffect(() => {
    if (!want.current || !f) return;
    const el = dlg.current.querySelector(want.current);
    want.current = '';
    if (el) el.focus();
  });
  const vr = view && ready && data.reports.find((r) => r.id === view.id);
  useEffect(() => { if (view && ready && !vr) setView(null); }); // the report is gone: the viewer goes with it

  async function retry() {
    if (again) return;
    setAgain(true);
    await load(day);
    if (dlg.current.open) want.current = '[data-first]'; // the retry button in the box may have been replaced by the radios
    setAgain(false);
  }
  function showToast(text) {
    clearTimeout(timer.current);
    setToast({ text, show: true });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 6000);
  }
  function pickDay(b) {
    setErr('');
    setBack(b);
  }
  function onTabKey(e) {
    const i = KINDS.findIndex(([k]) => k === tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: KINDS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const k = KINDS[(to + KINDS.length) % KINDS.length][0];
    setTab(k);
    document.getElementById(`rt-${k}`).focus();
  }

  /* ---- the box: a new report, photos for a report, edit the words ---- */
  function begin(next) {
    gen.current++;
    setF(next);
    setErrs({});
    setPics([]);
    setProg('');
    setMade(next.mode === 'add' ? next.report.id : '');
    want.current = '[data-first]';
    dlg.current.showModal();
  }
  const openNew = (taskId = '') => ready && begin({ mode: 'new', kind: taskId ? 'routine' : 'adhoc', day, taskId, title: '', place: '', note: '' }); // routine: only from a task of the day, adhoc: free
  const openEdit = (r) => begin({ mode: 'edit', kind: r.kind, day: r.day, report: r, taskId: r.taskId || '', title: r.title, place: r.place, note: r.note });
  function closed() { // the box was closed: nothing typed or taken is kept
    gen.current++;
    live.current.forEach(gone);
    setF(null); setPics([]); setMade(''); setErrs({}); setProg(''); setPrepping(false);
  }
  const close = () => { if (!busy) dlg.current.close(); };
  function end(text) {
    dlg.current.close();
    if (head.current) head.current.focus(); // the button that opened the box may be gone: the list is where to look
    showToast(text);
  }

  const set = (k, v) => {
    setF((x) => ({ ...x, [k]: v }));
    const ek = k === 'taskId' ? 'task' : k;
    if (errs[ek] || errs.form) setErrs((e) => ({ ...e, [ek]: undefined, form: undefined }));
  };
  function pick(k, v) {
    set(k, v);
    document.getElementById(`rp-${k}`).focus();
  }

  /* photos */
  function choose(input) {
    if (prepping) return;
    if (pics.length >= MAXP) return setErrs({ ...errs, photos: `ใส่รูปได้ไม่เกิน ${MAXP} รูปต่อรายงาน` });
    pickFor.current = null;
    input.current.click(); // inside the tap, so the browser lets the picker open
  }
  function askAdd(r) {
    if (!navigator.onLine) return showToast(OFFLINE);
    pickFor.current = r;
    galRef.current.click();
  }
  async function onFiles(e) {
    const files = [...e.target.files]; // copied first: clearing the input empties the live list
    e.target.value = '';
    if (!files.length) return;
    if (pickFor.current) return addTo(pickFor.current, files);
    const tok = gen.current;
    setPrepping(true);
    setProg('กำลังเตรียมรูป…');
    const { out, note } = await prep(files, MAXP - live.current.length, () => ++nid.current);
    if (tok !== gen.current) return out.forEach(gone); // the box was closed meanwhile
    setPrepping(false);
    setProg('');
    setPics((p) => [...p, ...out]);
    setErrs((x) => ({ ...x, photos: note || undefined }));
  }
  function drop(p) {
    gone(p);
    setPics((x) => x.filter((y) => y.id !== p.id));
    document.getElementById('rp-cam').focus(); // the row that had the focus is gone
  }

  // sends every photo not yet up, one by one; resolves { left: the photos that did not go, last: why }
  async function upload(id, list) {
    const todo = list.filter((p) => p.st !== 'ok'), sent = new Set();
    let last = '';
    for (let n = 0; n < todo.length; n++) {
      setProg(`กำลังอัปโหลดรูป ${n + 1}/${todo.length}`);
      try {
        await addReportPhoto(id, todo[n].blob);
        sent.add(todo[n].id);
        setPics((ps) => ps.map((p) => (p.id === todo[n].id ? { ...p, st: 'ok' } : p)));
      } catch (x) {
        last = errText(x);
        if (x.code === 'network') break; // the rest would only fail the same way
      }
    }
    const left = todo.filter((p) => !sent.has(p.id));
    setPics((ps) => ps.map((p) => (left.some((q) => q.id === p.id) ? { ...p, st: 'fail' } : p)));
    return { left, last };
  }
  async function sendPics(id, list, d, done, lead) {
    const { left, last } = await upload(id, list);
    load(d);
    if (!left.length) return end(done);
    const nums = left.map((p) => list.indexOf(p) + 1).join(', ');
    setErrs((e) => ({ ...e, form: `${lead}รูปที่ ${nums} ยังอัปโหลดไม่ได้ (${last}) กด “ลองอีกครั้ง” เพื่อส่งเฉพาะรูปที่เหลือ หรือปิดแล้วเพิ่มรูปทีหลังที่ปุ่ม “เพิ่มรูป”` }));
  }
  // "เพิ่มรูป" on a card: the box opens at once, prepares the photos and sends them
  async function addTo(r, files) {
    begin({ mode: 'add', kind: r.kind, day: r.day, report: r, taskId: '', title: '', place: '', note: '' }); // send() reads every field, also on the retry
    lock.current = true;
    setBusy(true);
    setProg('กำลังเตรียมรูป…');
    try {
      const { out, note } = await prep(files, MAXP - r.photos.length, () => ++nid.current);
      if (!out.length) return setErrs({ photos: note || 'ไม่มีรูปที่ใช้ได้' });
      setPics(out);
      await sendPics(r.id, out, r.day, note ? `เพิ่มรูปแล้ว · ${note}` : 'เพิ่มรูปแล้ว', '');
    } catch (x) {
      setErrs({ form: errText(x) });
    } finally {
      lock.current = false;
      setBusy(false);
      setProg('');
      if (dlg.current.open) want.current = '.go, .no';
    }
  }

  function check() {
    const e = {}, title = f.title.trim(), place = f.place.trim(), routine = f.kind === 'routine';
    if (f.mode === 'new' && routine && !f.taskId) e.task = 'เลือกงานประจำที่ทำก่อน';
    if (!routine) { // a routine report keeps the task's title, which the technician cannot change
      if (!title) e.title = 'ใส่ว่าทำอะไร';
      else if (title.length > 60) e.title = 'ยาวเกิน 60 ตัวอักษร';
    }
    if (routine && !place) e.place = 'ใส่ส่วนที่ทำ';
    else if (place.length > 40) e.place = 'ยาวเกิน 40 ตัวอักษร';
    if (f.note.trim().length > 300) e.note = 'หมายเหตุยาวเกิน 300 ตัวอักษร';
    if (f.mode === 'new' && !pics.length) e.photos = 'ถ่ายหรือเลือกรูปอย่างน้อย 1 รูป';
    return e;
  }
  async function send(ev) {
    ev.preventDefault();
    if (lock.current || prepping) return;
    if (!navigator.onLine) return setErrs({ ...errs, form: OFFLINE });
    if (!made) {
      const e = check(), k = Object.keys(FIELD).find((x) => e[x]);
      setErrs(e);
      if (k) {
        const el = dlg.current.querySelector(FIELD[k]); // no radio when the routine tasks could not be read
        if (el) el.focus();
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setErrs({});
    const v = { day: f.day, kind: f.kind, taskId: f.taskId, title: f.title.trim(), place: f.place.trim(), note: f.note.trim() };
    try {
      if (f.mode === 'edit') {
        await updateReport(f.report.id, { ...v, title: f.kind === 'adhoc' ? v.title : f.report.title });
        load(f.day);
        return end('บันทึกแล้ว');
      }
      let id = made;
      if (!id) {
        id = await createReport(v);
        setMade(id);
        load(f.day);
      }
      const add = f.mode === 'add';
      await sendPics(id, pics, f.day, add ? 'เพิ่มรูปแล้ว' : 'ส่งรายงานแล้ว', add ? '' : 'บันทึกรายงานแล้ว แต่');
    } catch (x) {
      setErrs({ form: errText(x) });
      if (x.code !== 'network') load(f.day); // the list may have changed
    } finally {
      lock.current = false;
      setBusy(false);
      setProg('');
      if (dlg.current.open) want.current = '.go, .no';
    }
  }

  /* ---- delete ---- */
  function askDel(r) {
    setDel(r);
    setDelErr('');
    cdlg.current.showModal();
    cdlg.current.querySelector('.no').focus(); // the safe choice, so one stray Enter cannot delete
  }
  async function delGo() {
    if (lock.current) return;
    if (!navigator.onLine) return setDelErr(OFFLINE);
    lock.current = true;
    setBusy(true);
    try {
      await deleteReport(del.id);
      cdlg.current.close();
      head.current.focus();
      showToast('ลบรายงานแล้ว');
      load(del.day);
    } catch (x) {
      setDelErr(errText(x));
      if (x.code !== 'network') load(del.day);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const word = back ? 'เมื่อวาน' : 'วันนี้';
  const kindName = KINDS.find(([k]) => k === tab)[1];
  const placeOf = (r) => {
    const t = r.kind === 'routine' && ready && data.tasks && data.tasks.find((x) => x.id === r.taskId);
    return t ? t.place : '';
  };
  const net = !online ? OFFLINE : err && ready ? 'โหลดข้อมูลใหม่ไม่ได้ กำลังแสดงข้อมูลที่โหลดไว้ล่าสุด' : '';
  const field = (k, id) => ({ id, 'aria-invalid': errs[k] ? 'true' : undefined, 'aria-describedby': errs[k] ? `${id}-e` : undefined });
  const msg = (k, id) => errs[k] && <p className="err" id={`${id}-e`} role="alert"><Ic d={P.warn} />{errs[k]}</p>;

  /* ---- the box's body ---- */
  const tasks = ready ? data.tasks : null;
  const task = f && tasks && tasks.find((t) => t.id === f.taskId);
  const placePicks = f ? [...new Set([f.kind === 'routine' && task && task.place, ...PLACES.slice(0, 4)].filter(Boolean))] : [];
  const failed = pics.some((p) => p.st === 'fail');
  const shots = (
    <ul className="shots">
      {pics.map((p, i) => (
        <li key={p.id} className="sh">
          <img className="shot" src={p.url} alt="" />
          <span className="cap">{`รูปที่ ${i + 1}`}</span>
          <span className="sw">
            {p.st === 'ok' ? <><Ic d={P.check} />ขึ้นแล้ว</> : p.st === 'fail' ? <><Ic d={P.warn} />ยังไม่ขึ้น</> : busy ? 'รอส่ง' : ''}
          </span>
          {f.mode === 'new' && !made && <button type="button" className="tb" aria-label={`เอารูปที่ ${i + 1} ออก`} onClick={() => drop(p)}><Ic d={P.x} /></button>}
        </li>
      ))}
    </ul>
  );
  const heading = !f ? '' : f.mode === 'add' ? 'เพิ่มรูป' : f.mode === 'edit' ? 'แก้ไขรายงาน' : f.kind === 'routine' ? 'รายงานงานประจำ' : 'รายงานงานที่เพิ่มเอง';

  return (
    <div className="s-tech">
      <div className="app">
        <header className="bar">
          <Link className="who back" href="/today"><Ic d={P.left} />งานวันนี้</Link>
          <h1 className="brand">รายงานงานที่ทำ</h1>
        </header>

        <p className="net" role="status" hidden={!net}>{net}</p>

        <p className="rdate">{th(toDate(day), LONG)}</p>
        <div className="seg" role="group" aria-label="เลือกวันที่จะรายงาน">
          {[[false, 'วันนี้'], [true, 'เมื่อวาน']].map(([b, w]) => (
            <button key={w} type="button" aria-pressed={back === b} onClick={() => pickDay(b)}>{back === b && <Ic d={P.check} />}{w}</button>
          ))}
        </div>

        <div className="tabs" role="tablist" aria-label="ประเภทรายงาน" onKeyDown={onTabKey}>
          {KINDS.map(([k, name]) => (
            <button key={k} type="button" role="tab" id={`rt-${k}`} className="tab" aria-selected={tab === k} aria-controls="rp-panel" tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}>
              <span>{name}</span>{ready && <span className="n">{`${count(k)} รายการ`}</span>}
            </button>
          ))}
        </div>

        <section className="panel" role="tabpanel" id="rp-panel" aria-labelledby={`rt-${tab}`} aria-busy={!ready && !err}>
          {err && !ready ? (
            <div className="empty" role="alert">
              <h2>โหลดรายงานไม่สำเร็จ</h2>
              <p>{err}</p>
              <button type="button" className="retry" aria-disabled={again} onClick={retry}>{again ? 'กำลังโหลด…' : 'ลองใหม่'}</button>
            </div>
          ) : (
            <>
              <h2 tabIndex={-1} ref={head}>{ready ? `${kindName} · ${rows.length} รายการ` : kindName}</h2>
              {tab === 'adhoc' && <button type="button" className="pri" aria-disabled={!ready} onClick={() => openNew()}><Ic d={P.plus} />เพิ่มงานที่เจอหน้างาน</button>}
              {tab === 'routine' && ready && (
                tasks === null ? (
                  <div className="empty"><p>โหลดรายการงานประจำไม่ได้</p><button type="button" className="retry" aria-disabled={again} onClick={retry}>{again ? 'กำลังโหลด…' : 'ลองใหม่'}</button></div>
                ) : !tasks.length ? (
                  <p className="quiet">{`${word}คุณไม่มีงานประจำ ถ้าเจองานอื่นหน้างาน ให้เพิ่มในแท็บ “ที่ฉันเพิ่มเอง”`}</p>
                ) : (
                  <>
                    <p className="quiet">กดงานที่ทำ แล้วบอกว่าทำส่วนไหน พร้อมรูป</p>
                    <ul className="cards tl">
                      {tasks.map((t) => (
                        <li key={t.id} className="rp">
                          <h3>{t.title}</h3>
                          <p>{`${t.time} · ${t.place}`} <span className="sx" data-s={t.status}>{STATUS[t.status]}</span></p>
                          <button type="button" className="pri" onClick={() => openNew(t.id)}><Ic d={P.plus} />รายงานงานนี้</button>
                        </li>
                      ))}
                    </ul>
                  </>
                )
              )}
              {!ready ? <p className="quiet" role="status">กำลังโหลดรายงาน…</p>
                : !rows.length ? (
                  tab === 'adhoc' && (
                    <div className="empty">
                      <p>{`ยังไม่มีงานที่คุณเพิ่มเองของ${word}`}</p>
                      <p>เจองานหน้างานที่ไม่ใช่งานประจำ บอกว่าทำอะไรที่ไหน พร้อมรูป</p>
                    </div>
                  )
                ) : (
                  <ul className="cards">
                    {rows.map((r) => <Card key={r.id} r={r} place={placeOf(r)} on={{ view: (x, i) => setView({ id: x.id, i }), add: askAdd, edit: openEdit, del: askDel }} />)}
                  </ul>
                )}
            </>
          )}
        </section>
      </div>

      {vr && vr.photos.length > 0 && (
        <PhotoViewer title={vr.title} subtitle={`${vr.place ? vr.place + ' · ' : ''}${th(toDate(vr.day), SHORT)}`} index={view.i} onClose={() => setView(null)}
          photos={vr.photos.map((p, n) => ({ key: p.path, label: String(n + 1), src: p.url, alt: `รูปที่ ${n + 1} ของ ${vr.title}`, note: 'โหลดรูปไม่ได้' }))} />
      )}

      {/* Escape and the buttons close it, never while it is sending; a click on the backdrop does not, so nothing typed or taken is lost by accident */}
      <dialog className="confirm rep" ref={dlg} aria-labelledby="rpTitle" aria-modal="true" onCancel={(e) => busy && e.preventDefault()} onClose={closed}>
        <input type="file" accept="image/*" capture="environment" hidden ref={camRef} onChange={onFiles} />
        <input type="file" accept="image/*" multiple hidden ref={galRef} onChange={onFiles} />
        {f && (
          <form className="cf-body" noValidate onSubmit={send}>
            <h2 id="rpTitle" tabIndex={-1} data-first={f.mode === 'add' || undefined}>{heading}</h2>
            {f.mode === 'new' && <p className="quiet">{th(toDate(f.day), LONG)}</p>}
            {(f.mode === 'add' || f.kind === 'routine') && <p className="cf-task">{f.report ? f.report.title : task && task.title}</p>}

            {f.mode !== 'add' && (
              <fieldset className="grp" disabled={busy || !!made}>
                {errs.task && <p className="err" role="alert"><Ic d={P.warn} />{errs.task}</p>}

                {f.kind === 'adhoc' && (
                  <div className="fld">
                    <label htmlFor="rp-title">ทำอะไร</label>
                    <input {...field('title', 'rp-title')} type="text" value={f.title} maxLength={60} autoComplete="off" data-first onChange={(e) => set('title', e.target.value)} />
                    {f.mode === 'new' && (
                      <div className="picks" role="group" aria-label="งานที่ทำบ่อย">
                        {COMMON.map((c) => <button key={c} type="button" onClick={() => pick('title', c)}>{c}</button>)}
                      </div>
                    )}
                    {msg('title', 'rp-title')}
                  </div>
                )}

                <div className="fld">
                  <label htmlFor="rp-place">{f.kind === 'routine' ? 'ส่วนที่ทำ' : 'ที่ไหน / ส่วนไหน'}</label>
                  <input {...field('place', 'rp-place')} type="text" value={f.place} maxLength={40} autoComplete="off" data-first={f.kind === 'routine' || undefined} onChange={(e) => set('place', e.target.value)} />
                  <div className="picks" role="group" aria-label="ที่ที่ใช้บ่อย">
                    {placePicks.map((p) => <button key={p} type="button" onClick={() => pick('place', p)}>{p}</button>)}
                  </div>
                  {msg('place', 'rp-place')}
                </div>

                <div className="fld">
                  <label htmlFor="rp-note">หมายเหตุ (ไม่บังคับ)</label>
                  <textarea {...field('note', 'rp-note')} rows={3} value={f.note} maxLength={300} onChange={(e) => set('note', e.target.value)} />
                  {msg('note', 'rp-note')}
                </div>

                {f.mode === 'new' && (
                  <div className="fld">
                    <span className="lab" id="rp-ph">{`รูปถ่าย (อย่างน้อย 1 รูป · ตอนนี้ ${pics.length}/${MAXP})`}</span>
                    <div className="two" role="group" aria-labelledby="rp-ph">
                      <button type="button" id="rp-cam" aria-disabled={prepping} aria-describedby={errs.photos ? 'rp-cam-e' : undefined} onClick={() => choose(camRef)}><Ic d={P.camera} />ถ่ายรูป</button>
                      <button type="button" aria-disabled={prepping} onClick={() => choose(galRef)}><Ic d={P.image} />เลือกจากเครื่อง</button>
                    </div>
                    {shots}
                    {msg('photos', 'rp-cam')}
                  </div>
                )}
              </fieldset>
            )}

            {f.mode === 'add' && pics.length > 0 && shots}
            {f.mode === 'add' && msg('photos', 'rp-cam')}
            <p className="quiet" role="status">{prog}</p>
            {errs.form && <p className="err" role="alert"><Ic d={P.warn} />{errs.form}</p>}

            {(f.mode !== 'add' || (failed && !busy)) && (
              <button type="submit" className="go" aria-disabled={busy || prepping}>
                {f.mode === 'edit' ? (busy ? 'กำลังบันทึก…' : 'บันทึก') : made ? (busy ? 'กำลังอัปโหลด…' : 'ลองอีกครั้ง') : busy ? 'กำลังส่ง…' : 'ส่งรายงาน'}
              </button>
            )}
            <button type="button" className="no" aria-disabled={busy} onClick={close}>{made ? 'ปิด' : 'ยกเลิก'}</button>
          </form>
        )}
      </dialog>

      <dialog className="confirm" ref={cdlg} aria-labelledby="rdTitle" aria-modal="true" onCancel={(e) => busy && e.preventDefault()}
        onClick={(e) => { if (e.target === e.currentTarget && !busy) cdlg.current.close(); }}>
        <div className="cf-body">
          <h2 id="rdTitle">ลบรายงานนี้ใช่ไหม?</h2>
          {del && <p className="cf-task">{`${del.title} · ${del.photos.length} รูป จะถูกลบด้วย`}</p>}
          {delErr && <p className="err" role="alert"><Ic d={P.warn} />{delErr}</p>}
          <button type="button" className="go" aria-disabled={busy} onClick={delGo}>{busy ? 'กำลังลบ…' : 'ลบรายงาน'}</button>
          <button type="button" className="no" aria-disabled={busy} onClick={() => !busy && cdlg.current.close()}>เก็บไว้</button>
        </div>
      </dialog>

      <div className={`toast${toast.show ? ' show' : ''}`} role="status" aria-live="polite">
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
