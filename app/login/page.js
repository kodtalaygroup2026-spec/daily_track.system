'use client';
import '../styles/auth.css';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, session, useSession } from '../../lib/auth';

export default function Page() {
  const user = useSession('login');
  const router = useRouter();
  const code = useRef(null);
  const pw = useRef(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // useSession('login') yields null both for a visitor who may see the form and for one being redirected; a stored session tells them apart
  if (user === undefined || (session() && !busy)) return null;

  function fail(msg, field) {
    setErr(msg);
    field.current.focus();
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (!code.current.value.trim()) return fail('กรอกรหัสพนักงาน', code);
    if (!pw.current.value) return fail('กรอกรหัสผ่าน', pw);
    setBusy(true);
    let to;
    try {
      to = await login(code.current.value, pw.current.value);
    } catch (x) {
      setBusy(false);
      return fail(x.message === 'config' ? 'ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่', code);
    }
    if (to) return router.replace(to); // the page keeps "busy" until it has changed
    setBusy(false);
    if (to === false) return fail('เบราว์เซอร์ไม่ให้บันทึกการเข้าสู่ระบบ ลองปิดโหมดส่วนตัว', code);
    pw.current.value = '';
    fail('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง ลองอีกครั้ง', pw);
  }

  return (
    <div className="s-auth">
      <main className="wrap">
        <p className="brand">Daily Track</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="lead">ช่างและหัวหน้าใช้ช่องเดียวกัน ระบบพาไปหน้าของคุณเอง</p>

        <form id="f" noValidate onSubmit={submit} data-err={err ? '1' : undefined}>
          <div className="field">
            <label htmlFor="code">รหัสพนักงาน</label>
            <input id="code" ref={code} type="text" autoComplete="username" autoCapitalize="characters" spellCheck={false} aria-describedby="err" />
          </div>
          <div className="field">
            <label htmlFor="pw">รหัสผ่าน</label>
            <input id="pw" ref={pw} type="password" autoComplete="current-password" aria-describedby="err" />
          </div>
          <p className="err" id="err" role="alert">{err}</p>
          <button type="submit" className="primary" aria-disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        </form>      </main>
    </div>
  );
}
