'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Link from 'next/link';
import Dropdown from '@/components/Dropdown';
import DateField from '@/components/DateField';
import { listAbsences } from '@/lib/api';
import { BRANCHES } from '@/lib/branches';
import { MAX_DAY, MIN_DAY, dur, hhmm, mins, minsSince, nowMins, today } from '@/lib/dates';
import { COMMON } from '@/lib/presets';
import { isAbsent, needsCover, techWorks } from '@/lib/roster';
import ItemsEditor from './ItemsEditor';
import { Icon, LABEL, NAMES, emptyText, fmtLate, lateMins, slot } from './ui';

// a new task today starts at the next half hour; on another day, at 09:00
const defaultTime = (date) => (date === today() ? hhmm(Math.min(Math.ceil((nowMins() + 1) / 30) * 30, 23 * 60 + 30)) : '09:00');
const KINDS = [['once', 'ครั้งเดียว'], ['routine', 'งานประจำทุกวัน']];

function Field({ id, label, err, wide, children }) {
  return (
    <div className={wide ? 'field full' : 'field'} data-err={err ? '' : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {err && <p className="err" id={`e-${id}`} role="alert">{err}</p>}
    </div>
  );
}

function SubText({ t }) {
  const late = lateMins(t);
  const el = t.beforeAt ? minsSince(t.date, t.beforeAt) : 0;
  return (
    <>
      {`${t.time} · ${t.place}${late ? ' · ' + fmtLate(late) : ''}`}
      {/* the photo times are the evidence of when work really started and ended */}
      {t.beforeAt && (
        <>
          <br />
          {t.status === 'done'
            ? `เริ่ม ${t.beforeAt}` + (t.afterAt ? ` · จบ ${t.afterAt} · ใช้เวลา ${dur(mins(t.afterAt) - mins(t.beforeAt))}` : '')
            : `เริ่ม ${t.beforeAt}` + (el >= 0 ? ` · ทำมาแล้ว ${dur(el)}` : '')}
        </>
      )}
    </>
  );
}

// The task box: a modal over the page for creating, viewing and editing one task.
// The parent keys this component by mode, selected task and a revision counter, so a remount is how the form is reset.
// onSave(payload) returns a promise and shows its own errors; the box stays as it is until the parent changes it.
const Drawer = forwardRef(function Drawer({ mode, task: t, date, branch, techs, absent, onSave, onClose, onShot }, ref) {
  const create = mode === 'create';
  const root = useRef(null);
  const refs = { title: useRef(null), branch: useRef(null), tech: useRef(null), date: useRef(null), time: useRef(null), place: useRef(null) };
  const [kind, setKind] = useState('once');
  const [busy, setBusy] = useState(false);
  const [vals, setVals] = useState(() => (t
    ? { title: t.title, branch: t.branch || '', tech: t.techId || '', date: t.date, time: t.time, place: t.place, items: t.items.map((i) => i.title) }
    : { title: '', branch: branch || '', tech: '', date, time: defaultTime(date), place: '', items: [] }));
  const [errs, setErrs] = useState({});
  const [seen, setSeen] = useState(null); // absences of the chosen date, which may lie outside the days the page has loaded
  const set = (k) => (v) => setVals((s) => ({ ...s, [k]: v }));
  // a technician belongs to one branch: choosing another branch clears a technician who is not in it
  const setBranch = (v) => setVals((s) => {
    const p = techs.find((x) => x.id === s.tech);
    return { ...s, branch: v, tech: v && p && p.branch && p.branch !== v ? '' : s.tech };
  });

  useImperativeHandle(ref, () => ({
    focusTitle: () => root.current.querySelector('h2')?.focus(),
    focusTech: () => refs.tech.current.focus(),
    setDate: (iso) => setVals((s) => ({ ...s, date: iso })),
  }), []);

  // modal: the page behind cannot be reached or scrolled while the box is open
  useEffect(() => {
    const page = document.querySelector('.s-sup .page');
    const was = document.body.style.overflow;
    if (page) page.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    return () => {
      if (page) page.removeAttribute('inert');
      document.body.style.overflow = was;
    };
  }, []);

  useEffect(() => {
    if (vals.date < MIN_DAY || vals.date > MAX_DAY) return;
    let live = true;
    const day = vals.date;
    listAbsences(day, day).then((list) => { if (live) setSeen({ day, list }); }, () => { /* the page's own list is used */ });
    return () => { live = false; };
  }, [vals.date]);

  useEffect(() => {
    const bad = ['title', 'branch', 'tech', 'date', 'time', 'place'].find((k) => errs[k]);
    if (bad) refs[bad].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per failed submit (errs is a new object each time)
  }, [errs]);

  const routine = create && kind === 'routine';
  const locked = !!t && t.status === 'done';
  const editable = create || t.status === 'todo'; // sub-tasks cannot change once the task has started

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = { title: vals.title.trim(), branch: vals.branch, tech: vals.tech, date: vals.date, time: vals.time, place: vals.place.trim() };
    const er = {};
    if (!v.title) er.title = 'กรุณาระบุชื่อภารกิจ';
    if (!v.branch) er.branch = 'กรุณาเลือกสาขา';
    if (!v.tech && !(t && t.routine && !t.techId)) er.tech = 'กรุณาเลือกช่าง'; // only an untouched unassigned routine task may stay empty
    if (!v.date) er.date = 'กรุณาเลือกวันที่';
    else if (v.date < MIN_DAY || v.date > MAX_DAY) er.date = 'วันที่ไม่ถูกต้อง เลือกปี พ.ศ. 2543 ถึง 2642';
    if (!v.time) er.time = 'กรุณาระบุเวลา';
    if (!v.place) er.place = 'กรุณาระบุสถานที่';
    if (Object.keys(er).length) { setVals((s) => ({ ...s, ...v })); setErrs(er); return; }
    setBusy(true);
    try {
      const items = vals.items.map((x) => x.trim()).filter(Boolean);
      await onSave({ routine, title: v.title, branch: v.branch, techId: v.tech || null, date: v.date, time: v.time, place: v.place, items: editable ? items : undefined });
    } finally { setBusy(false); }
  };

  const inv = (k) => ({ invalid: !!errs[k], describedBy: errs[k] ? `e-f-${k}` : undefined });
  const gone = seen && seen.day === vals.date ? seen.list : absent;
  // so the supervisor can tell who is in on the chosen date
  const off = (p) => (routine || !vals.date || techWorks(p, gone, vals.date) ? '' : isAbsent(gone, p.id, vals.date) ? ' · ไม่อยู่' : ' · หยุด');
  const branchOpts = (create ? [{ value: '', label: 'เลือกสาขา' }] : []).concat(BRANCHES);
  // only the chosen branch's technicians (a technician with no branch fits every one); the placeholder shows while none is chosen
  const techOpts = (create || !vals.tech ? [{ value: '', label: 'เลือกช่าง' }] : []).concat(
    techs.filter((p) => (p.active || p.id === vals.tech) && (!vals.branch || !p.branch || p.branch === vals.branch)).map((p) => ({ value: p.id, label: p.name + off(p) })),
  );
  const techLabel = routine ? 'ช่างประจำ' : t && t.routine ? 'ช่างผู้ทำ' : 'ช่าง';
  const dateLabel = routine ? 'เริ่มตั้งแต่' : 'วันที่';
  const ticked = t ? t.items.filter((i) => i.done).length : 0;
  const fig = (k) => {
    const s = slot(t, k);
    return (
      <div>
        <span className="lab">{NAMES[k]}{t[k + 'At'] ? ' · ' + t[k + 'At'] : ''}</span>
        {s === 'ok'
          ? <button type="button" aria-label={`ดูรูป${NAMES[k]}ใหญ่ของ ${t.title}`} onClick={() => onShot(t.id, k)}><img src={t[k]} alt={`รูป${NAMES[k]} ${t.title}`} /></button>
          : <div className={'noimg' + (s === 'miss' ? ' miss' : '')}>{emptyText(t, k)}</div>}
      </div>
    );
  };

  return (
    <div className="tm-scrim">
      <div className="tm" id="drawer" ref={root} role="dialog" aria-modal="true" aria-label={create ? 'สร้างภารกิจ' : t.title} data-open="true">
        <form id="form" noValidate onSubmit={submit}>
          <div className="tm-head dhead">
            {create
              ? <h2 tabIndex={-1}>สร้างภารกิจ</h2>
              : (
                <div>
                  <h2 tabIndex={-1}>{t.title}</h2>
                  <p className="sub" id="dsub"><SubText t={t} /></p>
                </div>
              )}
            <button type="button" className="x" aria-label="ปิด" onClick={onClose}><Icon n="close" /></button>
          </div>

          <div className="tm-body">
            {!create && <p className="stat" data-s={t.status}>{LABEL[t.status]}</p>}
            {create && (
              <fieldset className="kind">
                <legend className="sr">ประเภทภารกิจ</legend>
                {KINDS.map(([k, label]) => (
                  <label key={k}>
                    <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                    <span>{kind === k ? <Icon n="check" /> : k === 'routine' ? <Icon n="repeat" /> : null}{label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {routine && <p className="hint">งานนี้จะขึ้นให้ช่างทุกวัน ถ้าวันไหนช่างไม่อยู่ ระบบจะแจ้งให้หาคนแทน</p>}
            {t && t.routine && (
              <p className="routine-line"><Icon n="repeat" />งานประจำ · ช่างประจำ {t.owner}<Link href="/supervisor/routines">จัดการงานประจำ</Link></p>
            )}
            {t && needsCover(t, techs, absent) && (
              <p className="hint warn"><Icon n="alert" />{t.techId ? 'ช่างไม่อยู่ในวันนั้น' : 'ยังไม่มีคนทำ'} · เลือกคนแทนในช่อง “{techLabel}” (ช่างที่ไม่มีคำว่า “หยุด” หรือ “ไม่อยู่” คือคนที่มาทำงาน)</p>
            )}
            <div className="tm-grid">
              <Field id="f-title" label="ภารกิจ" err={errs.title} wide>
                <input type="text" id="f-title" name="title" ref={refs.title} value={vals.title} onChange={(e) => set('title')(e.target.value)}
                  autoComplete="off" disabled={locked} aria-invalid={errs.title ? 'true' : undefined} aria-describedby={inv('title').describedBy} />
                {create && (
                  <div className="quick" role="group" aria-label="ภารกิจที่ใช้บ่อย">
                    {COMMON.map((c) => (
                      <button type="button" key={c} onClick={() => { set('title')(c); (vals.branch ? refs.tech : refs.branch).current.focus(); }}>{c}</button>
                    ))}
                  </div>
                )}
              </Field>
              <Field id="f-branch" label="สาขา" err={errs.branch}>
                <Dropdown id="f-branch" ref={refs.branch} label="สาขา" value={vals.branch} onChange={setBranch} options={branchOpts} disabled={locked} {...inv('branch')} />
              </Field>
              <Field id="f-tech" label={techLabel} err={errs.tech}>
                <Dropdown id="f-tech" ref={refs.tech} label={techLabel} value={vals.tech} onChange={set('tech')} options={techOpts} disabled={locked || (!!t && t.routine && t.status !== 'todo')}{...inv('tech')} />
              </Field>
              <Field id="f-date" label={dateLabel} err={errs.date}>
                <DateField id="f-date" ref={refs.date} label={dateLabel} value={vals.date} onChange={set('date')} min={MIN_DAY} max={MAX_DAY} disabled={locked} {...inv('date')} />
              </Field>
              <Field id="f-time" label="เวลา" err={errs.time}>
                <input type="time" id="f-time" name="time" ref={refs.time} value={vals.time} onChange={(e) => set('time')(e.target.value)}
                  disabled={locked} aria-invalid={errs.time ? 'true' : undefined} aria-describedby={inv('time').describedBy} />
              </Field>
              <Field id="f-place" label="สถานที่" err={errs.place} wide>
                <input type="text" id="f-place" name="place" list="places" ref={refs.place} value={vals.place} onChange={(e) => set('place')(e.target.value)}
                  autoComplete="off" disabled={locked} aria-invalid={errs.place ? 'true' : undefined} aria-describedby={inv('place').describedBy} />
              </Field>
              {editable ? (
                <div className="field full">
                  <span className="lab">งานย่อย (ไม่บังคับ)</span>
                  <ItemsEditor id="f-items" value={vals.items} onChange={set('items')} />
                </div>
              ) : t.items.length > 0 && (
                <div className="field full">
                  <span className="lab">งานย่อย · ติ๊กแล้ว {ticked}/{t.items.length}</span>
                  <ul className="items-ro">
                    {t.items.map((i) => (
                      <li key={i.id}>
                        <span className="box" aria-hidden="true">{i.done && <Icon n="check" />}</span>
                        {i.title}<span className="sr">{i.done ? ' · ติ๊กแล้ว' : ' · ยังไม่ติ๊ก'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {!create && (
              <div className="photo">
                <div className="pair2">{fig('before')}{fig('after')}</div>
                {(t.before || t.after) && <small>แตะรูปเพื่อดูภาพใหญ่และซูม</small>}
              </div>
            )}
            {locked && <p className="lock">งานเสร็จแล้ว แก้ไขไม่ได้</p>}
          </div>

          <div className="tm-foot actions">
            <button type="button" className="secondary" onClick={onClose}>{create ? 'ยกเลิก' : 'ปิด'}</button>
            {/* aria-disabled, not disabled, so the focused button keeps focus while saving */}
            {!locked && <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : create ? (routine ? 'สร้างงานประจำ' : 'มอบหมาย') : 'บันทึก'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
});

export default Drawer;
