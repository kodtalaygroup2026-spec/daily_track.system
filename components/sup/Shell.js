'use client';
// The supervisor frame shared by every supervisor page: side menu (docked from 1280px, a panel over the page below),
// top bar, and an overlay slot outside .page (it is made inert while a modal box is open, so modals must live outside it).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { hhmm, nowMins } from '@/lib/dates';
import { Icon, Sprite } from './ui';

const MENU_KEY = 'dailytrack.menu.v1';
const isDocked = () => window.innerWidth >= 1280;
const savedMenu = () => { try { return localStorage.getItem(MENU_KEY) !== 'closed'; } catch (e) { return true; } };

// active: 'day' | 'routines' | 'roster'. actions: buttons placed in the top bar before the profile link. overlay: modal boxes, toast.
export default function Shell({ user, active, actions, overlay, children }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState(() => hhmm(nowMins()));
  const menuRef = useRef(null);
  const menuBtn = useRef(null);
  const wasDocked = useRef(false);
  const focusMenu = useRef(false);

  function setMenu(open) {
    setMenuOpen(open);
    if (isDocked()) { try { localStorage.setItem(MENU_KEY, open ? 'open' : 'closed'); } catch (e) { /* not remembered */ } }
  }

  useEffect(() => {
    wasDocked.current = isDocked();
    setMenuOpen(wasDocked.current ? savedMenu() : false);
    const onResize = () => {
      if (isDocked() !== wasDocked.current) { wasDocked.current = isDocked(); setMenuOpen(wasDocked.current ? savedMenu() : false); } // crossing 1280px: panel closes, docked menu comes back
    };
    window.addEventListener('resize', onResize);
    const iv = setInterval(() => setClock(hhmm(nowMins())), 15000);
    return () => { window.removeEventListener('resize', onResize); clearInterval(iv); };
  }, []);

  useEffect(() => { // a panel over the page takes focus; a docked menu leaves it on the button
    if (focusMenu.current && menuOpen) menuRef.current.querySelector('a').focus();
    focusMenu.current = false;
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && menuOpen && !isDocked()) { setMenu(false); menuBtn.current.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const here = (k) => (active === k ? 'page' : undefined);
  const logOut = () => { logout(); router.replace('/login'); };

  return (
    <div className={'s-sup' + (menuOpen ? ' menu-open' : '')}>
      <Sprite />
      <div className="page">
        <nav id="menu" ref={menuRef} className="menu" aria-label="เมนูหัวหน้า">
          <div className="mhead">
            {/* the toggle lives in the side rail, which stays on screen when the menu is narrowed to icons */}
            <button type="button" id="menuBtn" ref={menuBtn} className="mtoggle" aria-controls="menu" aria-expanded={menuOpen}
              aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              onClick={() => {
                const o = !menuOpen;
                if (o && !isDocked()) focusMenu.current = true;
                setMenu(o);
              }}><Icon n={menuOpen ? 'left' : 'menu'} /></button>
            <span className="brand">เมนู</span>
          </div>
          <p className="mgroup"><span>งานประจำวัน</span></p>
          <ul>
            <li><Link href="/supervisor" className="mitem" aria-current={here('day')}><Icon n="list" /><span className="mtxt">ภารกิจรายวัน</span></Link></li>
            <li><Link href="/supervisor/routines" className="mitem" aria-current={here('routines')}><Icon n="repeat" /><span className="mtxt">งานประจำ</span></Link></li>
            <li><Link href="/supervisor/roster" className="mitem" aria-current={here('roster')}><Icon n="week" /><span className="mtxt">ตารางช่างประจำสัปดาห์</span></Link></li>
            <li><span className="mitem soon" aria-disabled="true"><Icon n="doc" /><span className="mtxt">รายงานประจำวัน<small>เร็วๆ นี้</small></span></span></li>
          </ul>
          <p className="mgroup"><span>ตั้งค่า</span></p>
          <ul>
            <li><span className="mitem soon" aria-disabled="true"><Icon n="users" /><span className="mtxt">พนักงานและรหัสพนักงาน<small>เร็วๆ นี้</small></span></span></li>
            <li><span className="mitem soon" aria-disabled="true"><Icon n="key" /><span className="mtxt">สิทธิ์การใช้งาน<small>เร็วๆ นี้</small></span></span></li>
            <li><span className="mitem soon" aria-disabled="true"><Icon n="sliders" /><span className="mtxt">ตั้งค่าอื่นๆ<small>เร็วๆ นี้</small></span></span></li>
          </ul>
          <p className="mgroup"><span>บัญชีของฉัน</span></p>
          <ul>
            <li><Link href="/profile" className="mitem"><Icon n="user" /><span className="mtxt">โปรไฟล์</span></Link></li>
          </ul>
        </nav>
        <div className="scrim" id="scrim" onClick={() => { setMenu(false); menuBtn.current.focus(); }}></div>
        <div className="content">
          <header className="bar">
            <span className="brand">Daily Track</span>
            <p className="clock">เวลาตอนนี้ <b id="clock">{clock}</b></p>
            {actions}
            <Link className="ghost" href="/profile" title="โปรไฟล์ของฉัน"><span id="whoName">{user.name}</span></Link>
            <button type="button" id="logout" className="ghost" onClick={logOut}>ออกจากระบบ</button>
          </header>
          {children}
        </div>
      </div>
      {overlay}
    </div>
  );
}
