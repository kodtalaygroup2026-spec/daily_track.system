'use client';
// /supervisor/routines: the daily (routine) tasks. Modal, Failed and useToast are also used by Roster.js.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import DateField from '@/components/DateField';
import { MAX_DAY, MIN_DAY, th, toDate, today } from '@/lib/dates';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { deleteTemplate, errText, getRoster, listTemplates, saveTemplate } from '@/lib/api';
import Shell from './Shell';
import ItemsEditor from './ItemsEditor';
import { Icon } from './ui';

const QUICK = ['ตรวจปั๊มน้ำ', 'ตรวจสายไฟ', 'ตรวจระบบแอร์', 'ตรวจหลอดไฟ', 'ตรวจความสะอาด'];

export function useToast() {
  const [t, setT] = useState({ text: '', show: false });
  useEffect(() => {
    if (!t.show) return;
    const id = setTimeout(() => setT((s) => ({ ...s, show: false })), 4500);
    return () => clearTimeout(id);
  }, [t]);
  return [(text) => setT({ text, show: true }), <div key="toast" className={'toast' + (t.show ? ' show' : '')} role="status" aria-live="polite">{t.text}</div>];
}

// A modal box: the page behind is inert and cannot scroll, focus goes into the box and back to the opener, Escape closes.
// With onSubmit the contents sit in a form. Children are the .tm-body and .tm-foot.
export function Modal({ title, sub, small, onClose, onSubmit, children }) {
  const box = useRef(null);
  const id = useId();
  useEffect(() => {
    const page = document.querySelector('.s-sup .page');
    const opener = document.activeElement;
    const was = document.body.style.overflow;
    page.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    box.current.querySelector('h2').focus();
    return () => {
      page.removeAttribute('inert');
      document.body.style.overflow = was;
      (opener && opener.isConnected ? opener : document.querySelector('.s-sup h1'))?.focus(); // the opener may be gone (an empty-state button)
    };
  }, []);
  const inner = (
    <>
      <div className="tm-head dhead">
        <div>
          <h2 id={id} tabIndex={-1}>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        <button type="button" className="x" aria-label="ปิด" onClick={onClose}><Icon n="close" /></button>
      </div>
      {children}
    </>
  );
  return (
    <div className="tm-scrim" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className={small ? 'tm tm-sm' : 'tm'} ref={box} role="dialog" aria-modal="true" aria-labelledby={id}>
        {onSubmit ? <form noValidate onSubmit={onSubmit}>{inner}</form> : inner}
      </div>
    </div>
  );
}

export function Failed({ text, onRetry }) {
  return (
    <div className="empty" role="alert">
      <h2>โหลดข้อมูลไม่ได้</h2>
      <p>{text}</p>
      <button type="button" className="secondary" onClick={onRetry}>ลองใหม่</button>
    </div>
  );
}

function Field({ id, label, err, wide, after, children }) {
  return (
    <div className={wide ? 'field full' : 'field'} data-err={err ? '' : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {err && <p className="err" id={`e-${id}`} role="alert">{err}</p>}
      {after}
    </div>
  );
}

const crewOf = (techs, branch) => techs.filter((x) => x.active && x.branch === branch);

// t = the routine being edited, or null to create one
function RoutineForm({ t, techs, branch, onClose, onSaved, toast }) {
  const refs = { title: useRef(null), branch: useRef(null), owner: useRef(null), time: useRef(null), date: useRef(null), place: useRef(null) };
  const [v, setV] = useState(() => (t
    ? { title: t.title, branch: t.branch, ownerId: crewOf(techs, t.branch).some((x) => x.id === t.ownerId) ? t.ownerId : '', time: t.time, place: t.place, startsOn: t.startsOn, items: t.items }
    : { title: '', branch, ownerId: '', time: '08:00', place: '', startsOn: today(), items: [] }));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(null); // { k }: the field to focus after a failed submit (a new object each time)
  const clear = (...ks) => setErrs((e) => (ks.some((k) => e[k]) ? { ...e, ...Object.fromEntries(ks.map((k) => [k, undefined])) } : e));
  const set = (k, ek = k) => (val) => { setV((s) => ({ ...s, [k]: val })); clear(ek); };
  // a technician belongs to one branch: another branch clears a technician who is not in it
  const setBranch = (b) => { setV((s) => ({ ...s, branch: b, ownerId: crewOf(techs, b).some((x) => x.id === s.ownerId) ? s.ownerId : '' })); clear('branch', 'owner'); };

  useEffect(() => {
    if (miss) refs[miss.k].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs holds stable ref objects
  }, [miss]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const f = { ...v, title: v.title.trim(), place: v.place.trim(), items: v.items.map((s) => s.trim()).filter(Boolean) };
    const er = {};
    if (!f.title) er.title = 'กรุณาระบุชื่อภารกิจ';
    if (!f.branch) er.branch = 'กรุณาเลือกสาขา';
    if (!f.ownerId) er.owner = f.branch && !crewOf(techs, f.branch).length ? 'สาขานี้ยังไม่มีช่างที่ใช้งานอยู่' : 'กรุณาเลือกช่างประจำ';
    if (!f.time) er.time = 'กรุณาระบุเวลา';
    if (!f.place) er.place = 'กรุณาระบุสถานที่';
    if (!t) {
      if (!f.startsOn) er.date = 'กรุณาเลือกวันที่เริ่ม';
      else if (f.startsOn < MIN_DAY || f.startsOn > MAX_DAY) er.date = 'วันที่ไม่ถูกต้อง เลือกปี พ.ศ. 2543 ถึง 2642';
    }
    setV(f);
    setErrs(er);
    const bad = ['title', 'branch', 'owner', 'time', 'date', 'place'].find((k) => er[k]);
    if (bad) { setMiss({ k: bad }); return; }
    setBusy(true);
    try {
      await saveTemplate({ ...f, id: t && t.id, active: t ? t.active : true }); // saving without active would switch a paused routine on
      onSaved(t ? `บันทึก “${f.title}” แล้ว` : `สร้างงานประจำ “${f.title}” แล้ว`);
    } catch (x) {
      if (x.code === 'bad_tech') { setErrs({ owner: errText(x) }); setMiss({ k: 'owner' }); } else toast(errText(x));
      setBusy(false);
    }
  }

  const crew = crewOf(techs, v.branch);
  const ownerOpts = [{ value: '', label: !v.branch ? 'เลือกสาขาก่อน' : crew.length ? 'เลือกช่างประจำ' : 'ไม่มีช่างในสาขานี้' }].concat(crew.map((x) => ({ value: x.id, label: x.name })));
  const inv = (k, id) => ({ invalid: !!errs[k], describedBy: errs[k] ? `e-${id}` : undefined });

  return (
    <Modal title={t ? 'แก้ไขงานประจำ' : 'สร้างงานประจำ'} sub="ทำซ้ำทุกวัน · การแก้ไขมีผลกับงานที่ยังไม่เริ่มตั้งแต่วันนี้เป็นต้นไป" onClose={onClose} onSubmit={submit}>
      <div className="tm-body">
        <div className="tm-grid">
          <Field id="r-title" label="ภารกิจ" err={errs.title} wide after={!t && (
            <div className="quick" role="group" aria-label="ภารกิจที่ใช้บ่อย">
              {QUICK.map((c) => (
                <button type="button" key={c} onClick={() => { set('title')(c); (v.branch ? refs.owner : refs.branch).current.focus(); }}>{c}</button>
              ))}
            </div>
          )}>
            <input type="text" id="r-title" ref={refs.title} value={v.title} onChange={(e) => set('title')(e.target.value)} autoComplete="off"
              aria-invalid={errs.title ? 'true' : undefined} aria-describedby={inv('title', 'r-title').describedBy} />
          </Field>
          <Field id="r-branch" label="สาขา" err={errs.branch}>
            <Dropdown id="r-branch" ref={refs.branch} label="สาขา" value={v.branch} onChange={setBranch}
              options={[{ value: '', label: 'เลือกสาขา' }, ...BRANCHES]} {...inv('branch', 'r-branch')} />
          </Field>
          <Field id="r-owner" label="ช่างประจำ" err={errs.owner}>
            <Dropdown id="r-owner" ref={refs.owner} label="ช่างประจำ" value={v.ownerId} onChange={set('ownerId', 'owner')} options={ownerOpts}
              disabled={!v.branch} {...inv('owner', 'r-owner')} />
          </Field>
          <Field id="r-time" label="เวลา" err={errs.time}>
            <input type="time" id="r-time" ref={refs.time} value={v.time} onChange={(e) => set('time')(e.target.value)}
              aria-invalid={errs.time ? 'true' : undefined} aria-describedby={inv('time', 'r-time').describedBy} />
          </Field>
          {t ? (
            <div className="field">
              <span className="lab">เริ่มตั้งแต่</span>
              <p>{th(toDate(t.startsOn), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          ) : (
            <Field id="r-date" label="เริ่มตั้งแต่" err={errs.date}>
              <DateField id="r-date" ref={refs.date} label="เริ่มตั้งแต่" value={v.startsOn} onChange={set('startsOn', 'date')} min={MIN_DAY} max={MAX_DAY} {...inv('date', 'r-date')} />
            </Field>
          )}
          <Field id="r-place" label="สถานที่" err={errs.place} wide>
            <input type="text" id="r-place" ref={refs.place} value={v.place} onChange={(e) => set('place')(e.target.value)} autoComplete="off"
              aria-invalid={errs.place ? 'true' : undefined} aria-describedby={inv('place', 'r-place').describedBy} />
          </Field>
          <div className="field full">
            <span className="lab">งานย่อย</span>
            <ItemsEditor id="r-items" value={v.items} onChange={set('items')} />
          </div>
        </div>
      </div>
      <div className="tm-foot actions">
        <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : t ? 'บันทึก' : 'สร้างงานประจำ'}</button>
      </div>
    </Modal>
  );
}

function DeleteBox({ t, onClose, onDeleted, toast }) {
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await deleteTemplate(t.id); onDeleted(`ลบ “${t.title}” แล้ว`); } catch (x) { toast(errText(x)); setBusy(false); }
  }
  return (
    <Modal small title="ลบงานประจำนี้?" sub={t.title} onClose={onClose} onSubmit={go}>
      <div className="tm-body">
        <p className="pl-warn">งานที่ยังไม่เริ่มตั้งแต่วันนี้จะถูกลบ งานที่ทำไปแล้วยังอยู่</p>
        <p className="lock">ถ้าแค่อยากหยุดชั่วคราว ใช้ “พักงานนี้” แทน แล้วเปิดใช้อีกครั้งได้</p>
      </div>
      <div className="tm-foot actions">
        <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังลบ…' : 'ลบงานประจำ'}</button>
      </div>
    </Modal>
  );
}

export default function Routines({ user }) {
  const [data, setData] = useState(null); // { rows, techs }
  const [fail, setFail] = useState('');
  const [branch, setBranch] = useState('');
  const [box, setBox] = useState(null); // { kind: 'form' | 'del', t: routine or null }
  const [busy, setBusy] = useState(null); // id of the routine being paused or resumed
  const [toast, toastNode] = useToast();
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    try {
      const [rows, techs] = await Promise.all([listTemplates(), getRoster()]);
      if (n === seq.current) { setData({ rows, techs }); setFail(''); }
    } catch (e) {
      if (n === seq.current) setFail(errText(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function flip(t) {
    if (busy) return;
    setBusy(t.id);
    try {
      await saveTemplate({ ...t, active: !t.active });
      toast(t.active ? `พัก “${t.title}” แล้ว` : `เปิดใช้ “${t.title}” อีกครั้งแล้ว`);
      await load();
    } catch (e) {
      toast(errText(e));
    }
    setBusy(null);
  }
  // close once the list is fresh: a deleted card or the empty-state button is gone by then, so focus falls back to the h1
  const done = async (text) => { toast(text); await load(); setBox(null); };

  const shown = data ? data.rows.filter((r) => !branch || r.branch === branch) : [];
  const create = <button type="button" className="primary" disabled={!data} onClick={() => setBox({ kind: 'form', t: null })}><Icon n="plus" />สร้างงานประจำ</button>;

  return (
    <Shell user={user} active="routines" overlay={(
      <>
        {box && box.kind === 'form' && <RoutineForm t={box.t} techs={data.techs} branch={branch} onClose={() => setBox(null)} onSaved={done} toast={toast} />}
        {box && box.kind === 'del' && <DeleteBox t={box.t} onClose={() => setBox(null)} onDeleted={done} toast={toast} />}
        {toastNode}
      </>
    )}>
      <main className="layout plan">
        <header className="pl-head">
          <div>
            <h1 tabIndex={-1}>งานประจำ</h1>
            <p className="rel">งานที่ต้องทำทุกวัน ระบบสร้างให้ช่างประจำทุกเช้า</p>
          </div>
          {create}
        </header>

        {fail && <Failed text={fail} onRetry={load} />}
        {!fail && !data && <p role="status">กำลังโหลด…</p>}
        {data && data.rows.length === 0 && (
          <div className="empty">
            <h2>ยังไม่มีงานประจำ</h2>
            <p>สร้างงานที่ต้องทำทุกวัน แล้วระบบจะสร้างให้ช่างประจำทุกเช้า</p>
            {create}
          </div>
        )}
        {data && data.rows.length > 0 && (
          <>
            <div className="pl-tools">
              <label htmlFor="r-filter">สาขา</label>
              <Dropdown id="r-filter" label="สาขา" value={branch} onChange={setBranch} options={[{ value: '', label: 'ทุกสาขา' }, ...BRANCHES]} />
              <p className="pl-count" role="status">{shown.length} งานประจำ</p>
            </div>
            {shown.length === 0 && (
              <div className="empty">
                <h2>ไม่มีงานประจำในสาขานี้</h2>
                <button type="button" className="secondary" onClick={() => setBranch('')}>ดูทุกสาขา</button>
              </div>
            )}
            <ul className="pl-list">
              {shown.map((r) => (
                <li key={r.id} className="pl-card" data-off={r.active ? undefined : ''}>
                  <div className="pl-top">
                    <h2>{r.title}</h2>
                    <span className="pl-pill" data-on={r.active ? '' : undefined}>
                      {r.active ? <Icon n="check" /> : <span aria-hidden="true">–</span>}{r.active ? 'ใช้งานอยู่' : 'พักไว้'}
                    </span>
                  </div>
                  <p>{r.time} · {r.place}</p>
                  <p>สาขา {branchLabel(r.branch)} · ช่างประจำ {r.owner || '-'}</p>
                  <p className="pl-steps"><Icon n="steps" />{r.items.length ? `${r.items.length} งานย่อย` : 'ไม่มีงานย่อย'}</p>
                  <div className="pl-acts">
                    <button type="button" className="ghost" aria-label={`แก้ไข ${r.title}`} onClick={() => setBox({ kind: 'form', t: r })}><Icon n="pencil" />แก้ไข</button>
                    <button type="button" className="ghost" aria-label={`${r.active ? 'พักงานนี้' : 'เปิดใช้อีกครั้ง'} ${r.title}`} aria-disabled={busy === r.id} onClick={() => flip(r)}>
                      {r.active ? 'พักงานนี้' : 'เปิดใช้อีกครั้ง'}
                    </button>
                    <button type="button" className="ghost" aria-label={`ลบ ${r.title}`} onClick={() => setBox({ kind: 'del', t: r })}><Icon n="trash" />ลบ</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </Shell>
  );
}
