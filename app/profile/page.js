'use client';
import '../styles/auth.css';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { branchLabel } from '../../lib/branches';
import { homeFor, logout, rename, useSession } from '../../lib/auth';

export default function Page() {
  const user = useSession('any');
  const router = useRouter();
  const name = useRef(null);
  const [msg, setMsg] = useState({ text: '', bad: false });

  if (!user) return null;

  function say(text, bad) { setMsg({ text, bad: !!bad }); }

  function submit(e) {
    e.preventDefault();
    const v = name.current.value.trim().replace(/\s+/g, ' ');
    if (!v) { say('กรอกชื่อที่แสดง', true); return name.current.focus(); }
    if (!rename(v)) { say('เบราว์เซอร์ไม่ให้บันทึกชื่อ ลองปิดโหมดส่วนตัว', true); return name.current.focus(); }
    name.current.value = v;
    say('บันทึกชื่อแล้ว');
  }

  function signOut() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="s-auth">
      <main className="wrap">
        <Link className="back" id="back" href={homeFor()}>← กลับ</Link>
        <h1>โปรไฟล์</h1>

        <form id="f" noValidate onSubmit={submit} data-err={msg.bad ? '1' : undefined}>
          <div className="field">
            <label htmlFor="name">ชื่อที่แสดง</label>
            <input id="name" ref={name} type="text" maxLength={40} autoComplete="name" aria-describedby="msg" defaultValue={user.name} />
          </div>
          <dl className="info">
            <div><dt>รหัสพนักงาน</dt><dd id="code">{user.code}</dd></div>
            <div><dt>สาขา</dt><dd id="branch">{branchLabel(user.branch) || 'ทุกสาขา'}</dd></div>
            <div><dt>บทบาท</dt><dd id="role">{user.role === 'tech' ? 'ช่าง' : 'หัวหน้า'}</dd></div>
          </dl>
          <p className={'msg' + (msg.bad ? ' bad' : '')} id="msg" role="status">{msg.text}</p>
          <button type="submit" className="primary">บันทึกชื่อ</button>
        </form>

        <button type="button" id="logout" className="secondary" onClick={signOut}>ออกจากระบบ</button>
        <p className="note">ข้อมูลตัวอย่าง · ชื่อใหม่ใช้กับหน้านี้และหัวข้อของแอป ยังไม่เปลี่ยนในรายการของหัวหน้า</p>
      </main>
    </div>
  );
}
