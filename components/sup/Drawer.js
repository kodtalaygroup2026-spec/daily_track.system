'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import DateField from '@/components/DateField';
import { MAX_DAY, MIN_DAY, dur, hhmm, mins, minsSince, nowMins, today } from '@/lib/dates';
import { BRANCHES, TECH_BRANCH } from '@/lib/branches';
import { COMMON, TECHS, photoURI } from '@/lib/sup-store';
import { Icon, LABEL, NAMES, emptyText, fmtLate, lateMins, slot } from './ui';

// a new task today starts at the next half hour; on another day, at 09:00
const defaultTime = (date) => (date === today() ? hhmm(Math.min(Math.ceil((nowMins() + 1) / 30) * 30, 23 * 60 + 30)) : '09:00');

function Field({ id, label, err, children }) {
  return (
    <div className="field" data-err={err ? '' : undefined}>
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

// The parent keys this component by mode, selected task and a revision counter, so a remount is how the form is reset.
const Drawer = forwardRef(function Drawer({ mode, task, date, branch, onSave, onClose, onCreate, onShot }, ref) {
  const root = useRef(null);
  const refs = { title: useRef(null), branch: useRef(null), tech: useRef(null), date: useRef(null), time: useRef(null), place: useRef(null) };
  const [vals, setVals] = useState(() => (task && mode === 'view'
    ? { title: task.title, branch: task.branch || '', tech: task.tech, date: task.date, time: task.time, place: task.place }
    : { title: '', branch: branch || '', tech: '', date, time: defaultTime(date), place: '' }));
  const [errs, setErrs] = useState({});
  const set = (k) => (v) => setVals((s) => ({ ...s, [k]: v }));
  // a technician belongs to one branch: choosing another branch clears a technician who is not in it
  const setBranch = (v) => setVals((s) => ({ ...s, branch: v, tech: v && s.tech && TECH_BRANCH[s.tech] !== v ? '' : s.tech }));

  useImperativeHandle(ref, () => ({
    focusTitle: () => root.current.querySelector('h2')?.focus(),
    setDate: (iso) => setVals((s) => ({ ...s, date: iso })), // a half-typed new task follows the day being browsed
  }), []);

  useEffect(() => {
    const bad = ['title', 'branch', 'tech', 'date', 'time', 'place'].find((k) => errs[k]);
    if (bad) refs[bad].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per failed submit (errs is a new object each time)
  }, [errs]);

  const submit = (e) => {
    e.preventDefault();
    const v = { title: vals.title.trim(), branch: vals.branch, tech: vals.tech, date: vals.date, time: vals.time, place: vals.place.trim() };
    const er = {};
    if (!v.title) er.title = 'กรุณาระบุชื่อภารกิจ';
    if (!v.branch) er.branch = 'กรุณาเลือกสาขา';
    if (!v.tech) er.tech = 'กรุณาเลือกช่าง';
    if (!v.date) er.date = 'กรุณาเลือกวันที่';
    else if (v.date < MIN_DAY || v.date > MAX_DAY) er.date = 'วันที่ไม่ถูกต้อง เลือกปี พ.ศ. 2543 ถึง 2642';
    if (!v.time) er.time = 'กรุณาระบุเวลา';
    if (!v.place) er.place = 'กรุณาระบุสถานที่';
    if (Object.keys(er).length) { setVals(v); setErrs(er); return; }
    onSave(v);
  };

  const create = mode === 'create';
  const t = create ? null : task;
  const locked = !!t && t.status === 'done';
  const inv = (k) => ({ invalid: !!errs[k], describedBy: errs[k] ? `e-f-${k}` : undefined });
  const closeBtn = <button type="button" className="x" aria-label="ปิด" onClick={onClose}><Icon n="close" /></button>;

  let body;
  if (!create && !t) {
    body = (
      <div className="prompt">
        <h2>เลือกภารกิจ</h2>
        <p className="sub">แตะแถวในตารางเพื่อดูรายละเอียด แก้ไข หรือย้ายไปให้ช่างคนอื่น</p>
        <button type="button" className="primary" onClick={onCreate}><Icon n="plus" />สร้างภารกิจ</button>
      </div>
    );
  } else {
    const branchOpts = (create ? [{ value: '', label: 'เลือกสาขา' }] : []).concat(BRANCHES);
    // only the chosen branch's technicians; the placeholder shows while none is chosen (a new task, or the branch just changed)
    const techOpts = (create || !vals.tech ? [{ value: '', label: 'เลือกช่าง' }] : []).concat(TECHS.filter((n) => !vals.branch || TECH_BRANCH[n] === vals.branch).map((n) => ({ value: n, label: n })));
    const fig = (k) => {
      const s = slot(t, k);
      return (
        <div>
          <span className="lab">{NAMES[k]}{t[k + 'At'] ? ' · ' + t[k + 'At'] : ''}</span>
          {s === 'ok'
            ? <button type="button" aria-label={`ดูรูป${NAMES[k]}ใหญ่ของ ${t.title}`} onClick={() => onShot(t.id)}><img src={photoURI(t[k])} alt={`รูปตัวอย่าง${NAMES[k]} ${t.title}`} /></button>
            : <div className={'noimg' + (s === 'miss' ? ' miss' : '')}>{emptyText(t, k)}</div>}
        </div>
      );
    };
    body = (
      <form id="form" noValidate onSubmit={submit}>
        <div className="dhead">
          {create
            ? <h2 tabIndex={-1}>สร้างภารกิจ</h2>
            : <div><h2 tabIndex={-1}>{t.title}</h2><p className="sub" id="dsub"><SubText t={t} /></p></div>}
          {closeBtn}
        </div>
        {!create && <p className="stat" data-s={t.status}>{LABEL[t.status]}</p>}

        <Field id="f-title" label="ภารกิจ" err={errs.title}>
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
        <Field id="f-tech" label="ช่าง" err={errs.tech}>
          <Dropdown id="f-tech" ref={refs.tech} label="ช่าง" value={vals.tech} onChange={set('tech')} options={techOpts} disabled={locked} {...inv('tech')} />
        </Field>
        <Field id="f-date" label="วันที่" err={errs.date}>
          <DateField id="f-date" ref={refs.date} label="วันที่" value={vals.date} onChange={set('date')} min={MIN_DAY} max={MAX_DAY} disabled={locked} {...inv('date')} />
        </Field>
        <Field id="f-time" label="เวลา" err={errs.time}>
          <input type="time" id="f-time" name="time" ref={refs.time} value={vals.time} onChange={(e) => set('time')(e.target.value)}
            disabled={locked} aria-invalid={errs.time ? 'true' : undefined} aria-describedby={inv('time').describedBy} />
        </Field>
        <Field id="f-place" label="สถานที่" err={errs.place}>
          <input type="text" id="f-place" name="place" list="places" ref={refs.place} value={vals.place} onChange={(e) => set('place')(e.target.value)}
            autoComplete="off" disabled={locked} aria-invalid={errs.place ? 'true' : undefined} aria-describedby={inv('place').describedBy} />
        </Field>

        {!create && (
          <div className="photo">
            <div className="pair2">{fig('before')}{fig('after')}</div>
            {(t.before || t.after) && <small>รูปตัวอย่าง · แตะเพื่อดูรูปก่อนและหลังคู่กัน</small>}
          </div>
        )}
        {locked && <p className="lock">งานเสร็จแล้ว แก้ไขไม่ได้</p>}
        <div className="actions">
          {!locked && <button type="submit" className="primary">{create ? 'มอบหมาย' : 'บันทึก'}</button>}
          <button type="button" className="secondary" onClick={onClose}>{create ? 'ยกเลิก' : 'ปิด'}</button>
        </div>
      </form>
    );
  }

  return (
    <aside id="drawer" className="drawer" ref={root} data-open={String(!!mode)} aria-label="รายละเอียดภารกิจ">{body}</aside>
  );
});

export default Drawer;
