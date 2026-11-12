'use client';
// /supervisor/staff: every login (technician or supervisor) in one table, with the boxes to add, edit, reset a password
// and switch a login off. A password is typed or generated here, shown once in the box that made it, and lives only in
// that box's state: nothing stores, logs or sends it anywhere but the one call that sets it.
import { useCallback, useEffect, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import { dayNum, isoOf, th } from '@/lib/dates';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { rename } from '@/lib/auth';
import { createStaff, deleteStaff, errText, listStaff, recodeStaff, resetPassword, updateStaff } from '@/lib/api';
import Shell from './Shell';
import { Failed, Modal, useToast } from './Routines';
import { Icon } from './ui';

const ROLES = [{ value: 'tech', label: 'ช่าง' }, { value: 'sup', label: 'หัวหน้า' }];
const roleLabel = (r) => (r === 'sup' ? 'หัวหน้า' : 'ช่าง');
// a technician with no branch only exists on old data; a supervisor with none sees every branch
const branchOf = (s) => branchLabel(s.branch) || (s.role === 'sup' ? 'ทุกสาขา' : 'ยังไม่ระบุ');
const branchOpts = (role) => [{ value: '', label: role === 'sup' ? 'ทุกสาขา' : 'เลือกสาขา' }, ...BRANCHES];
const ALL = { value: '', label: 'ทั้งหมด' };
const NO_FILTER = { role: '', branch: '', active: '' };
const COLS = [{ k: 'code', t: 'รหัสพนักงาน' }, { k: 'name', t: 'ชื่อที่แสดง' }, { k: 'role', t: 'บทบาท' }, { k: 'branch', t: 'สาขา' }, { k: 'active', t: 'สถานะ' }, { k: 'last', t: 'เข้าใช้ล่าสุด' }];
const SORT = { code: (s) => s.code, name: (s) => s.name, role: (s) => s.role, branch: branchOf, active: (s) => (s.active ? 0 : 1), last: (s) => s.lastSignIn || '' };
const cmp = (a, b) => (typeof a === 'number' ? a - b : a.localeCompare(b, 'th', { numeric: true }));

const CODE_RE = /^[A-Z0-9]{2,12}$/;
const CODE_ERR = 'รหัสพนักงานใช้ได้เฉพาะตัวอักษร A-Z และตัวเลข 2–12 ตัว';
const PW_ERR = 'รหัสผ่านต้องยาว 8–72 ตัวอักษร (อักษรไทยนับตัวละ 3)';
// the login service limits a password to 72 bytes, and a Thai letter is 3 of them
const goodPw = (p) => p.length >= 8 && new TextEncoder().encode(p).length <= 72;
const FIELD_OF = { code_taken: 'code', bad_code: 'code', bad_password: 'password', branch_required: 'branch' }; // server refusals that belong to one field

// no I, O, l, 0 or 1: a password read aloud or copied by hand cannot be mistaken
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LIMIT = 256 - (256 % ABC.length); // bytes above this are skipped so every character is equally likely
function randomPassword() {
  let out = '';
  while (out.length < 10) for (const b of crypto.getRandomValues(new Uint8Array(16))) if (b < LIMIT && out.length < 10) out += ABC[b % ABC.length];
  return out;
}

async function copy(text, what, toast) {
  if (!text) { toast('ยังไม่มีรหัสผ่านให้คัดลอก'); return; }
  try { await navigator.clipboard.writeText(text); toast(`คัดลอก${what}แล้ว`); } catch (e) { toast('คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกเอง'); }
}

// "วันนี้ 08:12", "เมื่อวาน 17:40", "3 วันก่อน", a date after a month; undefined = the list call could not tell
function seenText(iso) {
  if (iso === undefined) return null;
  if (!iso) return 'ยังไม่เคยเข้า';
  const d = new Date(iso);
  const days = dayNum(isoOf(new Date())) - dayNum(isoOf(d));
  const at = d.toTimeString().slice(0, 5);
  if (days <= 0) return `วันนี้ ${at}`;
  if (days === 1) return `เมื่อวาน ${at}`;
  return days < 30 ? `${days} วันก่อน` : th(d, { day: 'numeric', month: 'short', year: 'numeric' });
}

// icons the shared sprite does not have
const GLYPH = {
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff: 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9M6.5 7.6A16.7 16.7 0 002 12s4 6 10 6c1.5 0 2.8-.3 4-.9',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  dice: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  pause: 'M8 5v14M16 5v14',
  power: 'M12 3v8M6.4 6.6a8 8 0 1011.2 0',
};
function Glyph({ n }) {
  return <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={GLYPH[n]} /></svg>;
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
// props for an input that may carry an error and a hint (id of the hint: h-<id>)
const aria = (id, err, hint) => ({ 'aria-invalid': err ? 'true' : undefined, 'aria-describedby': [hint && `h-${id}`, err && `e-${id}`].filter(Boolean).join(' ') || undefined });
const dd = (id, err) => ({ invalid: !!err, describedBy: err ? `e-${id}` : undefined });

function FormError({ text }) {
  return text ? <p className="err st-form-err" role="alert"><Icon n="alert" />{text}</p> : null;
}

// the new-password field with its helpers: show/hide, random, copy
function PasswordField({ id, label, value, onChange, err, inputRef, toast }) {
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label} err={err} wide after={<p className="hint" id={`h-${id}`}>อย่างน้อย 8 ตัวอักษร</p>}>
      <input type={show ? 'text' : 'password'} id={id} ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password" autoCapitalize="off" spellCheck={false} {...aria(id, err, true)} />
      <div className="st-pw">
        <button type="button" className="ghost" onClick={() => setShow(!show)}><Glyph n={show ? 'eyeoff' : 'eye'} />{show ? 'ซ่อนรหัส' : 'แสดงรหัส'}</button>
        <button type="button" className="ghost" onClick={() => { onChange(randomPassword()); setShow(true); }}><Glyph n="dice" />สุ่มรหัสผ่านให้</button>
        <button type="button" className="ghost" onClick={() => copy(value, 'รหัสผ่าน', toast)}><Glyph n="copy" />คัดลอก</button>
      </div>
    </Field>
  );
}

// one value shown once, with its copy button
function Cred({ label, value, toast }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className="st-val">{value}</span>
        <button type="button" className="ghost" aria-label={`คัดลอก${label}`} onClick={() => copy(value, label, toast)}><Glyph n="copy" />คัดลอก</button>
      </dd>
    </div>
  );
}

const Foot = ({ children }) => <div className="tm-foot actions">{children}</div>;

// a box that holds a password cannot be closed while its request is out: the answer would be lost with it
const guard = (busy, onClose) => () => { if (!busy) onClose(); };

function AddBox({ onClose, onCreated, toast }) {
  const refs = { code: useRef(null), name: useRef(null), branch: useRef(null), password: useRef(null) };
  const [v, setV] = useState({ code: '', name: '', role: 'tech', branch: '', password: '' });
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(null); // { k }: the field to focus after a failed submit (a new object each time)
  const [made, setMade] = useState(null); // { code, password } once the login exists
  const clear = (...ks) => setErrs((e) => (ks.some((k) => e[k]) ? { ...e, ...Object.fromEntries(ks.map((k) => [k, undefined])) } : e));
  const set = (k) => (val) => { setV((s) => ({ ...s, [k]: val })); clear(k); };

  useEffect(() => {
    if (miss) refs[miss.k].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs holds stable ref objects
  }, [miss]);
  useEffect(() => { if (made) document.querySelector('.tm h2').focus(); }, [made]);

  async function submit(e) {
    e.preventDefault();
    if (busy || made) return;
    const f = { ...v, code: v.code.trim().toUpperCase(), name: v.name.trim() };
    const er = {};
    if (!CODE_RE.test(f.code)) er.code = CODE_ERR;
    if (!f.name) er.name = 'กรุณาระบุชื่อที่แสดง';
    else if (f.name.length > 40) er.name = 'ชื่อที่แสดงยาวเกินไป (สูงสุด 40 ตัวอักษร)';
    if (f.role === 'tech' && !f.branch) er.branch = 'ช่างต้องเลือกสาขา';
    if (!goodPw(f.password)) er.password = PW_ERR;
    setV(f);
    setErrs(er);
    setFormErr('');
    const bad = ['code', 'name', 'branch', 'password'].find((k) => er[k]);
    if (bad) { setMiss({ k: bad }); return; }
    setBusy(true);
    try {
      const r = await createStaff(f);
      setMade({ code: (r && r.code) || f.code, password: f.password });
      setV((s) => ({ ...s, password: '' }));
      onCreated(r && r.id);
    } catch (x) {
      const k = FIELD_OF[x.code];
      if (k) { setErrs({ [k]: errText(x) }); setMiss({ k }); } else setFormErr(errText(x));
    }
    setBusy(false);
  }

  const close = guard(busy, onClose);
  if (made) {
    return (
      <Modal small title={`สร้างบัญชี ${made.code} แล้ว`} sub="ปิดกล่องนี้แล้วจะดูรหัสผ่านอีกไม่ได้" onClose={close} onSubmit={submit}>
        <div className="tm-body">
          <p className="hint">บันทึกแล้ว · จดหรือคัดลอกรหัสนี้ก่อนปิด แล้วส่งให้พนักงานใช้เข้าสู่ระบบ</p>
          <dl className="st-cred">
            <Cred label="รหัสพนักงาน" value={made.code} toast={toast} />
            <Cred label="รหัสผ่าน" value={made.password} toast={toast} />
          </dl>
        </div>
        <Foot><button type="button" className="primary" onClick={onClose}>เสร็จสิ้น</button></Foot>
      </Modal>
    );
  }
  return (
    <Modal title="เพิ่มพนักงาน" sub="สร้างรหัสสำหรับเข้าสู่ระบบ ช่างต้องเลือกสาขา" onClose={close} onSubmit={submit}>
      <div className="tm-body">
        <div className="tm-grid">
          <Field id="a-code" label="รหัสพนักงาน" err={errs.code} after={<p className="hint" id="h-a-code">พนักงานพิมพ์รหัสนี้เพื่อเข้าสู่ระบบ</p>}>
            <input type="text" id="a-code" ref={refs.code} value={v.code} onChange={(e) => set('code')(e.target.value.toUpperCase())}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} {...aria('a-code', errs.code, true)} />
          </Field>
          <Field id="a-name" label="ชื่อที่แสดง" err={errs.name}>
            <input type="text" id="a-name" ref={refs.name} value={v.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" {...aria('a-name', errs.name)} />
          </Field>
          <Field id="a-role" label="บทบาท">
            <Dropdown id="a-role" label="บทบาท" value={v.role} onChange={(r) => { set('role')(r); clear('branch'); }} options={ROLES} />
          </Field>
          <Field id="a-branch" label="สาขา" err={errs.branch}>
            <Dropdown id="a-branch" ref={refs.branch} label="สาขา" value={v.branch} onChange={set('branch')} options={branchOpts(v.role)} {...dd('a-branch', errs.branch)} />
          </Field>
          <PasswordField id="a-password" label="รหัสผ่านเริ่มต้น" value={v.password} onChange={set('password')} err={errs.password} inputRef={refs.password} toast={toast} />
        </div>
        <FormError text={formErr} />
      </div>
      <Foot>
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังสร้าง…' : 'สร้างบัญชี'}</button>
      </Foot>
    </Modal>
  );
}

function EditBox({ s, me, onClose, onSaved, onChanged, onDeleted, toast }) {
  const refs = { code: useRef(null), name: useRef(null), branch: useRef(null) };
  const delBtn = useRef(null);
  const back = useRef(false); // true while the delete confirm is open, so closing it returns focus to the button that opened it
  const [saved, setSaved] = useState(s.code); // the code as stored: moves when a recode succeeds but the next step fails
  const [v, setV] = useState({ code: s.code, name: s.name, role: s.role, branch: s.branch, active: s.active });
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(null);
  const [del, setDel] = useState(false);
  const clear = (...ks) => setErrs((e) => (ks.some((k) => e[k]) ? { ...e, ...Object.fromEntries(ks.map((k) => [k, undefined])) } : e));
  const set = (k) => (val) => { setV((x) => ({ ...x, [k]: val })); clear(k); };

  useEffect(() => {
    if (miss) refs[miss.k].current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs holds stable ref objects
  }, [miss]);
  useEffect(() => { if (!del && back.current) delBtn.current?.focus(); back.current = del; }, [del]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    // the input already upper-cases, so an untouched code is kept exactly as stored (an old login may not fit the pattern)
    const f = { ...v, code: v.code.trim(), name: v.name.trim() };
    const er = {};
    if (f.code !== saved && !CODE_RE.test(f.code)) er.code = CODE_ERR;
    if (!f.name) er.name = 'กรุณาระบุชื่อที่แสดง';
    else if (f.name.length > 40) er.name = 'ชื่อที่แสดงยาวเกินไป (สูงสุด 40 ตัวอักษร)';
    if (f.role === 'tech' && !f.branch) er.branch = 'ช่างต้องเลือกสาขา';
    setV(f);
    setErrs(er);
    setFormErr('');
    const bad = ['code', 'name', 'branch'].find((k) => er[k]);
    if (bad) { setMiss({ k: bad }); return; }
    const recode = f.code !== saved;
    const edit = ['name', 'role', 'branch', 'active'].some((k) => f[k] !== s[k]);
    if (!recode && !edit) { onSaved('ไม่มีการเปลี่ยนแปลง'); return; }
    setBusy(true);
    let recoded = false;
    try {
      if (recode) { await recodeStaff(s.id, f.code); recoded = true; setSaved(f.code); }
      if (edit) await updateStaff(s.id, f);
      onSaved(edit ? `บันทึก “${f.name}” แล้ว${recode ? ` · รหัสพนักงานใหม่ ${f.code}` : ''}` : `เปลี่ยนรหัสพนักงานเป็น ${f.code} แล้ว`, edit ? f.name : undefined);
    } catch (x) {
      const k = FIELD_OF[x.code];
      if (recoded) setFormErr(`เปลี่ยนรหัสพนักงานเป็น ${f.code} แล้ว แต่ยังไม่ได้บันทึกข้อมูลอื่น: ${errText(x)}`);
      else if (k === 'code' || k === 'branch') { setErrs({ [k]: errText(x) }); setMiss({ k }); } else setFormErr(errText(x));
      // the list must show the new code; a lost answer may still have changed it on the server (a retry is safe)
      if (recoded || (recode && x.code === 'network')) onChanged();
      setBusy(false);
    }
  }

  const close = guard(busy, onClose);
  if (del) {
    return <DeleteBox s={s} code={saved} onBack={() => setDel(false)} onDeleted={() => onDeleted(saved)} onOff={() => onSaved(`ปิดใช้งาน “${s.name}” แล้ว`)} />;
  }
  const recoding = v.code.trim() !== saved;
  return (
    <Modal title="แก้ไขพนักงาน" sub={`รหัสพนักงาน ${saved}`} onClose={close} onSubmit={submit}>
      <div className="tm-body">
        <div className="tm-grid">
          <Field id="e-code" label="รหัสพนักงาน" err={errs.code} after={(
            <div id="h-e-code">
              <p className="hint">ใช้เป็นชื่อเข้าสู่ระบบ ถ้าเปลี่ยน พนักงานต้องเข้าสู่ระบบด้วยรหัสใหม่</p>
              {me && recoding && <p className="hint warn"><Icon n="alert" />นี่คือบัญชีของคุณ ครั้งหน้าต้องเข้าสู่ระบบด้วยรหัสใหม่</p>}
            </div>
          )}>
            <input type="text" id="e-code" ref={refs.code} value={v.code} onChange={(e) => set('code')(e.target.value.toUpperCase())}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} {...aria('e-code', errs.code, true)} />
          </Field>
          <Field id="e-name" label="ชื่อที่แสดง" err={errs.name}>
            <input type="text" id="e-name" ref={refs.name} value={v.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" {...aria('e-name', errs.name)} />
          </Field>
          <Field id="e-role" label="บทบาท">
            <Dropdown id="e-role" label="บทบาท" value={v.role} onChange={(r) => { set('role')(r); clear('branch'); }} options={ROLES} disabled={me} />
          </Field>
          <Field id="e-branch" label="สาขา" err={errs.branch}>
            <Dropdown id="e-branch" ref={refs.branch} label="สาขา" value={v.branch} onChange={set('branch')} options={branchOpts(v.role)} {...dd('e-branch', errs.branch)} />
          </Field>
          <div className="field full">
            <span className="lab">สถานะ</span>
            <button type="button" role="switch" aria-checked={v.active} className="rs-sw" aria-disabled={me} aria-describedby={me ? 'h-e-active' : undefined}
              onClick={() => { if (!me) set('active')(!v.active); }}>
              <i aria-hidden="true" />ใช้งานอยู่
            </button>
            {!v.active && <p className="hint">ปิดใช้งาน · พนักงานจะเข้าสู่ระบบไม่ได้</p>}
            {me && <p className="hint" id="h-e-active">นี่คือบัญชีของคุณ เปลี่ยนบทบาท ปิดใช้งาน หรือลบไม่ได้</p>}
          </div>
        </div>
        <FormError text={formErr} />
      </div>
      <Foot>
        <button type="button" className="secondary st-del" ref={delBtn} aria-disabled={me || busy} aria-describedby={me ? 'h-e-active' : undefined}
          onClick={() => { if (me) toast('ลบบัญชีของตัวเองไม่ได้'); else if (!busy) setDel(true); }}><Icon n="trash" />ลบพนักงาน</button>
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </Foot>
    </Modal>
  );
}

// the confirm for removing a login for good. Only has_history offers the alternative: switching the account off.
function DeleteBox({ s, code, onBack, onDeleted, onOff }) {
  const [busy, setBusy] = useState(''); // 'del' | 'off' while a request is out
  const [err, setErr] = useState(null); // { text, code }
  const [hist, setHist] = useState(false); // stays true after has_history, so a later error does not take the alternative away
  async function run(kind, call, then) {
    if (busy) return;
    setBusy(kind);
    setErr(null);
    try {
      await call();
      then();
    } catch (x) {
      setErr({ text: errText(x), code: x.code });
      if (x.code === 'has_history') setHist(true);
      setBusy('');
    }
  }
  const go = (e) => { e.preventDefault(); run('del', () => deleteStaff(s.id), onDeleted); };
  const off = () => run('off', () => updateStaff(s.id, { name: s.name, role: s.role, branch: s.branch, active: false }), onOff);
  const close = guard(!!busy, onBack);
  return (
    <Modal small title={`ลบ ${code} · ${s.name} ถาวร?`} sub="ลบแล้วกู้คืนไม่ได้" onClose={close} onSubmit={go}>
      <div className="tm-body">
        <p className="pl-warn">ล็อกอินนี้จะใช้ไม่ได้และกู้คืนไม่ได้</p>
        <p className="pl-warn">งานที่ยังไม่เริ่มของคนนี้จะกลายเป็นยังไม่มีคนทำ</p>
        <FormError text={err && err.text} />
      </div>
      <Foot>
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        {hist && s.active && (
          <button type="button" className="secondary" aria-disabled={!!busy} onClick={off}><Glyph n="power" />{busy === 'off' ? 'กำลังบันทึก…' : 'ปิดใช้งานแทน'}</button>
        )}
        <button type="submit" className="primary" aria-disabled={!!busy}>{busy === 'del' ? 'กำลังลบ…' : 'ลบถาวร'}</button>
      </Foot>
    </Modal>
  );
}

function ResetBox({ s, onClose, onReset, toast }) {
  const input = useRef(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // the saved password, shown once
  useEffect(() => { if (done) document.querySelector('.tm h2').focus(); }, [done]);

  async function submit(e) {
    e.preventDefault();
    if (busy || done) return;
    setFormErr('');
    if (!goodPw(pw)) { setErr(PW_ERR); input.current.focus(); return; }
    setBusy(true);
    try {
      await resetPassword(s.id, pw);
      setDone(pw);
      setPw('');
      onReset();
    } catch (x) {
      if (x.code === 'bad_password') { setErr(errText(x)); input.current.focus(); } else setFormErr(errText(x));
    }
    setBusy(false);
  }

  const close = guard(busy, onClose);
  if (done) {
    return (
      <Modal small title="รีเซ็ตรหัสผ่านแล้ว" sub={`${s.name} · ${s.code}`} onClose={close} onSubmit={submit}>
        <div className="tm-body">
          <p className="hint">บันทึกแล้ว · จดหรือคัดลอกรหัสนี้ก่อนปิด ปิดกล่องนี้แล้วจะดูรหัสผ่านอีกไม่ได้</p>
          <dl className="st-cred"><Cred label="รหัสผ่านใหม่" value={done} toast={toast} /></dl>
        </div>
        <Foot><button type="button" className="primary" onClick={onClose}>เสร็จสิ้น</button></Foot>
      </Modal>
    );
  }
  return (
    <Modal small title="รีเซ็ตรหัสผ่าน" sub={`${s.name} · ${s.code}`} onClose={close} onSubmit={submit}>
      <div className="tm-body">
        <div className="tm-grid">
          <PasswordField id="r-password" label="รหัสผ่านใหม่" value={pw} onChange={(x) => { setPw(x); setErr(''); }} err={err} inputRef={input} toast={toast} />
        </div>
        <FormError text={formErr} />
      </div>
      <Foot>
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}</button>
      </Foot>
    </Modal>
  );
}

function OffBox({ s, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  async function go(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormErr('');
    try {
      await updateStaff(s.id, { name: s.name, role: s.role, branch: s.branch, active: false });
      onSaved(`ปิดใช้งาน “${s.name}” แล้ว`);
    } catch (x) {
      setFormErr(errText(x));
      setBusy(false);
    }
  }
  const close = guard(busy, onClose);
  return (
    <Modal small title="ปิดใช้งานพนักงานนี้?" sub={`${s.name} · ${s.code}`} onClose={close} onSubmit={go}>
      <div className="tm-body">
        <p className="pl-warn">พนักงานจะเข้าสู่ระบบไม่ได้{s.role === 'tech' && ' และงานประจำของวันนี้เป็นต้นไปที่ยังไม่เริ่มจะกลับเป็นยังไม่มีคนทำ'}</p>
        <p className="lock">เปิดใช้งานอีกครั้งได้ภายหลัง</p>
        <FormError text={formErr} />
      </div>
      <Foot>
        <button type="button" className="secondary" onClick={close}>ยกเลิก</button>
        <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังบันทึก…' : 'ปิดใช้งาน'}</button>
      </Foot>
    </Modal>
  );
}

export default function Staff({ user }) {
  const [data, setData] = useState(null);
  const [fail, setFail] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(NO_FILTER);
  const [sort, setSort] = useState({ k: 'code', dir: 1 });
  const [box, setBox] = useState(null); // { kind: 'add' | 'edit' | 'pw' | 'off', s }
  const [busy, setBusy] = useState(null); // id of the person being switched on
  const [fresh, setFresh] = useState(null); // id of the login just made
  const [self, setSelf] = useState(user); // the signed-in supervisor, renamed here when they edit their own row
  const [toast, toastNode] = useToast();
  const seq = useRef(0);
  const search = useRef(null);
  const reveal = useRef(null); // id of a row to scroll to once the list holds it

  const load = useCallback(async () => {
    const n = ++seq.current;
    try {
      const rows = await listStaff();
      if (n === seq.current) { setData(rows); setFail(''); }
    } catch (e) {
      if (n === seq.current) setFail(errText(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const row = reveal.current && data && document.getElementById(`st-${reveal.current}`);
    if (row) { row.scrollIntoView({ block: 'nearest' }); reveal.current = null; }
  }, [data]);

  const open = (kind, s) => { setFresh(null); setBox({ kind, s }); };
  // reload without holding the box open: a slow list call must not trap a saved box. If the row leaves the list (a
  // filter) and takes the focused button with it, focus goes to the heading instead of the top of the page.
  const reload = async (toRow) => {
    await load();
    if (document.activeElement === document.body) ((toRow && document.querySelector('.st-acts button')) || document.querySelector('.s-sup h1'))?.focus();
  };
  const done = (text, name) => {
    if (name && box.s.id === user.id) { setSelf((u) => ({ ...u, name })); rename(name); } // the top bar and the cached session
    toast(text);
    setBox(null);
    reload();
  };
  // the row is gone, so focus goes to the first action left in the table, or the heading
  const deleted = (code) => { toast(`ลบ ${code} แล้ว`); setBox(null); reload(true); };
  const created = (id) => { reveal.current = id; setFresh(id); setQ(''); setFilter(NO_FILTER); load(); };

  async function turnOn(s) {
    if (busy) return;
    setBusy(s.id);
    try {
      await updateStaff(s.id, { name: s.name, role: s.role, branch: s.branch, active: true });
      toast(`เปิดใช้งาน “${s.name}” แล้ว`);
      await reload();
    } catch (e) {
      toast(errText(e));
    }
    setBusy(null);
  }

  const needle = q.trim().toLowerCase();
  const key = SORT[sort.k];
  const shown = data ? data
    .filter((s) => (!needle || s.code.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle))
      && (!filter.role || s.role === filter.role) && (!filter.branch || s.branch === filter.branch) && (!filter.active || String(s.active) === filter.active))
    .sort((a, b) => sort.dir * cmp(key(a), key(b)) || cmp(a.code, b.code)) : [];
  const flip = (k) => setSort((o) => (o.k === k ? { k, dir: -o.dir } : { k, dir: k === 'last' ? -1 : 1 }));
  const pick = (k) => (v) => setFilter((f) => ({ ...f, [k]: v }));
  const idle = !data;

  return (
    <Shell user={self} active="staff" overlay={(
      <>
        {box && box.kind === 'add' && <AddBox onClose={() => setBox(null)} onCreated={created} toast={toast} />}
        {box && box.kind === 'edit' && <EditBox s={box.s} me={box.s.id === user.id} onClose={() => setBox(null)} onSaved={done} onChanged={load} onDeleted={deleted} toast={toast} />}
        {box && box.kind === 'pw' && <ResetBox s={box.s} onClose={() => setBox(null)} onReset={load} toast={toast} />}
        {box && box.kind === 'off' && <OffBox s={box.s} onClose={() => setBox(null)} onSaved={done} />}
        {toastNode}
      </>
    )}>
      <main className="layout plan">
        <header className="pl-head">
          <div>
            <h1 tabIndex={-1}>พนักงานและรหัสพนักงาน</h1>
            <p className="rel">ดูและจัดการบัญชีเข้าสู่ระบบของช่างและหัวหน้า รหัสพนักงานคือสิ่งที่พิมพ์ตอนเข้าสู่ระบบ</p>
          </div>
        </header>

        <div className="st-tools" role="group" aria-label="ค้นหาและกรองรายชื่อ">
          <div className="st-tool">
            <label htmlFor="st-q">ค้นหารหัสหรือชื่อ</label>
            <div className="st-search">
              <input type="text" id="st-q" ref={search} value={q} onChange={(e) => setQ(e.target.value)} disabled={idle} autoComplete="off" />
              {q && <button type="button" className="x" aria-label="ล้างคำค้นหา" onClick={() => { setQ(''); search.current.focus(); }}><Icon n="close" /></button>}
            </div>
          </div>
          <div className="st-tool">
            <label htmlFor="st-role">บทบาท</label>
            <Dropdown id="st-role" label="บทบาท" value={filter.role} onChange={pick('role')} options={[ALL, ...ROLES]} disabled={idle} />
          </div>
          <div className="st-tool">
            <label htmlFor="st-branch">สาขา</label>
            <Dropdown id="st-branch" label="สาขา" value={filter.branch} onChange={pick('branch')} options={[ALL, ...BRANCHES]} disabled={idle} />
          </div>
          <div className="st-tool">
            <label htmlFor="st-active">สถานะ</label>
            <Dropdown id="st-active" label="สถานะ" value={filter.active} onChange={pick('active')}
              options={[ALL, { value: 'true', label: 'ใช้งานอยู่' }, { value: 'false', label: 'ปิดใช้งาน' }]} disabled={idle} />
          </div>
          <button type="button" className="primary st-add" onClick={() => open('add', null)}><Icon n="plus" />เพิ่มพนักงาน</button>
        </div>

        {fail && <Failed text={fail} onRetry={load} />}
        {!fail && !data && <p role="status">กำลังโหลด…</p>}
        {data && <p className="pl-count" role="status">แสดง {shown.length} จาก {data.length} คน · ใช้งานอยู่ {data.filter((s) => s.active).length}</p>}
        {data && data.length === 0 && (
          <div className="empty">
            <h2>ยังไม่มีพนักงาน</h2>
            <p>กด “เพิ่มพนักงาน” เพื่อสร้างบัญชีแรก</p>
          </div>
        )}
        {data && data.length > 0 && shown.length === 0 && (
          <div className="empty">
            <h2>ไม่พบพนักงานที่ตรงกับที่ค้นหา</h2>
            <button type="button" className="secondary" onClick={() => { setQ(''); setFilter(NO_FILTER); }}>ล้างการค้นหาและตัวกรอง</button>
          </div>
        )}
        {shown.length > 0 && (
          <div className="tablewrap" role="region" aria-label="ตารางพนักงาน" tabIndex={0}>
            <table className="st-table">
              <caption className="sr">รายชื่อพนักงาน เรียงตามหัวตารางที่เลือก</caption>
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th scope="col" key={c.k} aria-sort={sort.k === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => flip(c.k)}>{c.t}{sort.k === c.k && <Icon n={sort.dir > 0 ? 'up' : 'down'} />}</button>
                    </th>
                  ))}
                  <th scope="col" className="st-plain">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const me = s.id === user.id;
                  const seen = seenText(s.lastSignIn);
                  return (
                    <tr key={s.id} id={`st-${s.id}`} data-off={s.active ? undefined : ''} data-new={s.id === fresh ? '' : undefined}>
                      <th scope="row">{s.code}</th>
                      <td className="st-name">{s.name}{me && <span className="tag">คุณ</span>}{s.id === fresh && <span className="tag">ใหม่</span>}</td>
                      <td>{roleLabel(s.role)}</td>
                      <td>{branchOf(s)}</td>
                      <td><span className="st-state">{s.active ? <Icon n="check" /> : <Glyph n="pause" />}{s.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</span></td>
                      <td className="st-nowrap">{seen || <><span aria-hidden="true">—</span><span className="sr">ไม่ทราบ</span></>}</td>
                      <td>
                        <div className="st-acts">
                          <button type="button" className="ghost" aria-label={`แก้ไข ${s.name}`} onClick={() => open('edit', s)}><Icon n="pencil" />แก้ไข</button>
                          <button type="button" className="ghost" aria-label={`รีเซ็ตรหัสผ่าน ${s.name}`} onClick={() => open('pw', s)}><Icon n="key" />รีเซ็ตรหัสผ่าน</button>
                          {s.active ? (
                            <button type="button" className="ghost" aria-disabled={me} aria-label={me ? `ปิดใช้งาน ${s.name} ไม่ได้ เพราะเป็นบัญชีของคุณ` : `ปิดใช้งาน ${s.name}`}
                              onClick={() => { if (me) toast('ปิดใช้งานบัญชีของตัวเองไม่ได้'); else open('off', s); }}><Glyph n="power" />ปิดใช้งาน</button>
                          ) : (
                            <button type="button" className="ghost" aria-disabled={busy === s.id} aria-label={`เปิดใช้งาน ${s.name}`}
                              onClick={() => turnOn(s)}><Glyph n="power" />เปิดใช้งาน</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
