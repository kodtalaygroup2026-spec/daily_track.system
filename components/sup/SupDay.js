'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Dropdown from '@/components/Dropdown';
import CalendarTrigger from '@/components/CalendarTrigger';
import { logout } from '@/lib/auth';
import { BRANCHES, TECH_BRANCH, branchLabel } from '@/lib/branches';
import { MAX_DAY, MIN_DAY, addDays, dayNum, hhmm, mins, nowMins, th, toDate, today } from '@/lib/dates';
import { PLACES, TECHS, loadSup, newTask, photoURI, sampleSup, saveSup } from '@/lib/sup-store';
import Drawer from './Drawer';
import Lightbox from './Lightbox';
import { Icon, LABEL, NAMES, Sprite, fmtLate, issue, lateMins, relLabel, slot } from './ui';

const FILTERS = [['all', 'ทั้งหมด'], ['todo', 'รอทำ'], ['doing', 'กำลังทำ'], ['done', 'เสร็จ'], ['photo', 'รูปไม่ครบ']];
const HEADS = [['status', 'สถานะ', 'c-s'], ['time', 'เวลา', 'c-t'], ['title', 'ภารกิจ', undefined], ['tech', 'ช่าง', 'c-h']];
const ORDER = { todo: 0, doing: 1, done: 2 };
const MENU_KEY = 'dailytrack.menu.v1', MENU_W = 240, RAIL_W = 72; // widened menu and the icon rail, in px (15rem, 4.5rem)
const isDocked = () => window.innerWidth >= 1280;
const savedMenu = () => { try { return localStorage.getItem(MENU_KEY) !== 'closed'; } catch (e) { return true; } };
const dayTitle = (iso) => th(toDate(iso), { weekday: 'long' }) + ' ' + th(toDate(iso), { day: 'numeric', month: 'short', year: 'numeric' });
// "9–11 พ.ย. 2569"; across months "28 ต.ค. – 3 พ.ย. 2569"
const rangeTitle = (a, b) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(toDate(a), toDate(b));
const BRANCH_OPTIONS = [{ value: '', label: 'ทุกสาขา' }, ...BRANCHES];
const techOptions = (branch) => [{ value: '', label: 'ช่างทุกคน' }, ...TECHS.filter((n) => !branch || TECH_BRANCH[n] === branch).map((n) => ({ value: n, label: n }))];

// date = first shown day, to = last shown day ('' = just the one day)
const FRESH = { date: '', to: '', filter: 'all', branch: '', tech: '', sort: { key: 'time', dir: 1 }, sel: null, mode: null, rev: 0 };

export default function SupDay({ user }) {
  const router = useRouter();
  const [data, setData] = useState(null); // { nextId, tasks }; null until storage has been read (never during the first render)
  const [ui, setUi] = useState(FRESH);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vw, setVw] = useState(0);
  const [live, setLive] = useState('');
  const [toastState, setToastState] = useState({ text: '', show: false });
  const [lb, setLb] = useState(null); // task id shown in the lightbox
  const [, redraw] = useReducer((n) => n + 1, 0);

  const drawerRef = useRef(null);
  const menuRef = useRef(null);
  const menuBtn = useRef(null);
  const createBtn = useRef(null);
  const firstSeg = useRef(null);
  const after = useRef(null); // runs once after the next commit, for focus that needs the new DOM
  const last = useRef({ m: 0, d: '' });
  const wasDocked = useRef(false);
  const timers = useRef({ show: 0, hide: 0 });
  const tickRef = useRef(null);

  const patch = (p) => setUi((u) => ({ ...u, ...p }));
  const commit = (next) => { setData(next); saveSup(next); };

  /* ---- left menu: docked beside the page from 1280px, a panel over it below. The docked choice is remembered. ---- */
  const docked = vw >= 1280;
  // the rail always takes its width; only a widened docked menu takes more. Below that the drawer is a panel over the table.
  const narrow = vw - (docked && menuOpen ? MENU_W : RAIL_W) < 1280;
  function setMenu(open) {
    setMenuOpen(open);
    if (isDocked()) { try { localStorage.setItem(MENU_KEY, open ? 'open' : 'closed'); } catch (e) { /* not remembered */ } }
  }

  useEffect(() => {
    setData(loadSup());
    patch({ date: today() });
    setVw(window.innerWidth);
    wasDocked.current = isDocked();
    setMenu(wasDocked.current ? savedMenu() : false);
    last.current = { m: nowMins(), d: today() };
    const onResize = () => {
      setVw(window.innerWidth);
      if (isDocked() !== wasDocked.current) { wasDocked.current = isDocked(); setMenu(wasDocked.current ? savedMenu() : false); } // crossing 1280px: panel closes, docked menu comes back
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { // runs after every commit
    tickRef.current = tick;
    if (after.current) { const f = after.current; after.current = null; f(); }
  });

  // the clock is real: once a minute, refresh the late times (React only touches the cells whose text changed, so focus and scroll stay)
  function tick() {
    const m = nowMins(), d = today();
    if (m === last.current.m && d === last.current.d) return;
    const rolled = d !== last.current.d;
    if (rolled && ui.date === last.current.d && !ui.to) { // midnight: a page left on "today" follows the new day
      patch(ui.mode !== 'create' ? { date: d, sel: null, mode: null } : { date: d });
    }
    if (rolled && ui.mode !== 'create') patch({ rev: ui.rev + 1 }); // the original redrew the drawer on a new day
    last.current = { m, d };
    redraw();
  }
  useEffect(() => {
    const run = () => tickRef.current && tickRef.current();
    const iv = setInterval(run, 15000);
    const vis = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => () => { clearTimeout(timers.current.show); clearTimeout(timers.current.hide); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menuOpen && !isDocked()) { setMenu(false); menuBtn.current.focus(); return; }
      if (ui.mode && lb == null) closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!data) return null;

  const date = ui.date || today();
  const to = ui.to && ui.to > date ? ui.to : date;
  const isRange = to !== date;
  const span = dayNum(to) - dayNum(date) + 1; // days shown
  const tasksIn = (a, b) => data.tasks.filter((t) => t.date >= a && t.date <= b);
  const dayList = tasksIn(date, to);
  const pool = dayList.filter((t) => (!ui.branch || t.branch === ui.branch) && (!ui.tech || t.tech === ui.tech));
  const rows = (() => {
    const { key, dir } = ui.sort;
    const when = (a, b) => a.date.localeCompare(b.date) || mins(a.time) - mins(b.time); // days first, then the hour
    const cmp = {
      time: (a, b) => when(a, b) || a.id - b.id,
      status: (a, b) => ORDER[a.status] - ORDER[b.status] || when(a, b),
      title: (a, b) => a.title.localeCompare(b.title, 'th'),
      tech: (a, b) => a.tech.localeCompare(b.tech, 'th') || when(a, b),
    }[key];
    return pool.filter((t) => ui.filter === 'all' || (ui.filter === 'photo' ? issue(t) : t.status === ui.filter)).sort((a, b) => cmp(a, b) * dir);
  })();
  const selTask = data.tasks.find((x) => x.id === ui.sel);

  /* ---- actions ---- */
  function toast(msg) {
    clearTimeout(timers.current.show); clearTimeout(timers.current.hide);
    setToastState((s) => ({ ...s, show: false }));
    // the live region keeps its node and changes text after a beat, so screen readers announce it
    timers.current.show = setTimeout(() => setToastState({ text: msg, show: true }), 50);
    timers.current.hide = setTimeout(() => setToastState((s) => ({ ...s, show: false })), 4500);
  }

  function open(id, from) {
    if (ui.mode === 'view' && ui.sel === id && !from) return; // re-clicking the open row must not wipe unsaved edits
    patch({ sel: id, mode: 'view', rev: ui.rev + 1 });
    // keyboard opens (and any open on a narrow screen) move focus into the drawer; closing returns it to the row
    if (narrow || from === 'row') after.current = () => drawerRef.current && drawerRef.current.focusTitle();
  }
  function startCreate() {
    patch({ sel: null, mode: 'create', rev: ui.rev + 1 });
    after.current = () => document.getElementById('f-title').focus();
  }
  function closeDrawer() {
    const id = ui.sel;
    patch({ sel: null, mode: null });
    const back = id && document.querySelector(`[data-open="${id}"]`);
    (back || createBtn.current).focus();
  }

  function save(vals) {
    let toastText, next;
    const fresh = { sel: null, branch: ui.branch, tech: ui.tech, filter: ui.filter };
    if (ui.mode === 'create') {
      const t = newTask(data.nextId, vals.time, vals.title, vals.tech, vals.place, 'todo', { date: vals.date, branch: vals.branch });
      next = { ...data, nextId: data.nextId + 1, tasks: [...data.tasks, t] };
      fresh.sel = t.id;
      if (ui.filter !== 'all' && ui.filter !== 'todo') fresh.filter = 'all';
      toastText = `มอบหมาย “${t.title}” ให้ ${t.tech} แล้ว`;
    } else {
      const t = selTask;
      const moved = t.tech !== vals.tech, rescheduled = t.date !== vals.date;
      next = { ...data, tasks: data.tasks.map((x) => (x.id === t.id ? { ...x, ...vals } : x)) };
      fresh.sel = t.id;
      toastText = rescheduled ? `ย้าย “${vals.title}” ไปที่ ${relLabel(vals.date) === 'วันนี้' ? 'วันนี้' : dayTitle(vals.date)} แล้ว`
        : moved ? `ย้าย “${vals.title}” ไปให้ ${vals.tech} แล้ว` : `บันทึก “${vals.title}” แล้ว`;
    }
    if (fresh.branch && fresh.branch !== vals.branch) fresh.branch = '';
    if (fresh.tech && fresh.tech !== vals.tech) fresh.tech = ''; // keep the new or moved row on screen
    commit(next);
    const inView = vals.date >= date && vals.date <= to; // a task moved outside the shown days: follow it to its day
    patch({ ...fresh, ...(inView ? {} : { date: vals.date, to: '' }), mode: 'view', rev: ui.rev + 1 });
    after.current = () => drawerRef.current && drawerRef.current.focusTitle();
    toast(toastText);
  }

  /* ---- day navigation: arrows, calendar, "today" ---- */
  function setRange(a, b = a) {
    if (!a || a < MIN_DAY || b > MAX_DAY || (a === date && b === to)) return;
    const one = a === b;
    if (ui.mode === 'create') { // a half-typed new task survives browsing; it just follows the first day
      patch({ date: a, to: one ? '' : b });
      drawerRef.current && drawerRef.current.setDate(a);
    } else patch({ date: a, to: one ? '' : b, sel: null, mode: null }); // the open task belongs to the old days
    setLive(`${one ? dayTitle(a) : rangeTitle(a, b)} · ${tasksIn(a, b).length} ภารกิจ`);
  }
  const setDay = (iso) => setRange(iso, iso);
  const step = (dir) => setRange(addDays(date, dir * span), addDays(to, dir * span)); // the arrows move the whole range

  function restart() {
    commit(sampleSup());
    setUi({ ...FRESH, date: today(), rev: ui.rev + 1 });
  }

  const sortBy = (k) => patch({ sort: ui.sort.key === k ? { key: k, dir: -ui.sort.dir } : { key: k, dir: 1 } });
  const logOut = () => { logout(); router.replace('/login'); };
  const dayNone = !dayList.length;
  const isToday = date === today() && !isRange;
  const cls = 's-sup' + (menuOpen ? ' menu-open' : '');

  // when the technician took the before and the after photo: a todo task has neither, a doing task only the start
  const stamps = (t) => (t.status === 'todo'
    ? <><span className="sr">ยังไม่เริ่มงาน</span>—</>
    : <><span>เริ่ม {t.beforeAt || '—'}</span>{t.status === 'done' && <span>เสร็จ {t.afterAt || '—'}</span>}</>);

  const cell = (t, k) => {
    const s = slot(t, k);
    if (s === 'ok') {
      return (
        <button type="button" className="shot" aria-label={`ดูรูป${NAMES[k]}ของ ${t.title}`} onClick={(e) => { e.stopPropagation(); setLb(t.id); }}>
          <img src={photoURI(t[k])} alt="" />
        </button>
      );
    }
    if (s === 'miss') {
      return <button type="button" className="slot miss" aria-label={`รอรูป${NAMES[k]}ของ ${t.title}`} onClick={(e) => { e.stopPropagation(); setLb(t.id); }}>รอรูป</button>;
    }
    return <span className="slot due"><span className="sr">ยังไม่ถึงขั้นตอนถ่ายรูป{NAMES[k]}</span>—</span>;
  };

  return (
    <div className={cls} data-narrow={narrow ? '1' : ''}>
      <Sprite />
      <div className="page">
        <nav id="menu" ref={menuRef} className="menu" aria-label="เมนูหัวหน้า">
          <div className="mhead">
            {/* the toggle lives in the side rail, which stays on screen when the menu is narrowed to icons */}
            <button type="button" id="menuBtn" ref={menuBtn} className="mtoggle" aria-controls="menu" aria-expanded={menuOpen}
              aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              onClick={() => {
                const o = !menuOpen;
                setMenu(o);
                if (o && !isDocked()) after.current = () => menuRef.current.querySelector('a').focus(); // a panel over the page takes focus; a docked menu leaves it on the button
              }}><Icon n={menuOpen ? 'left' : 'menu'} /></button>
            <span className="brand">เมนู</span>
          </div>
          <p className="mgroup"><span>งานประจำวัน</span></p>
          <ul>
            <li><Link href="/supervisor" className="mitem" aria-current="page"><Icon n="list" /><span className="mtxt">ภารกิจรายวัน</span></Link></li>
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
            <p className="clock">เวลาตอนนี้ <b id="clock">{hhmm(nowMins())}</b></p>
            <button type="button" id="create" ref={createBtn} className="primary" onClick={startCreate}><Icon n="plus" />สร้างภารกิจ</button>
            <Link className="ghost" href="/profile" title="โปรไฟล์ของฉัน"><span id="whoName">{user.name}</span></Link>
            <button type="button" id="logout" className="ghost" onClick={logOut}>ออกจากระบบ</button>
          </header>

          <div className="layout">
            <main>
              <div className="daybar">
                <div>
                  <h1 id="date">{isRange ? rangeTitle(date, to) : dayTitle(date)}</h1>
                  <p className="rel" id="rel">{isRange ? `ช่วง ${span} วัน` : relLabel(date)}</p>
                </div>
                <div className="daynav" role="group" aria-label="เลือกวันที่">
                  <button type="button" className="ghost icon" id="prev" aria-label={isRange ? 'ช่วงก่อนหน้า' : 'วันก่อนหน้า'} onClick={() => step(-1)}><Icon n="left" /></button>
                  <span className="pickwrap">
                    <CalendarTrigger id="pick" className="ghost" range value={{ from: date, to }} onPick={({ from, to: end }) => setRange(from, end)} min={MIN_DAY} max={MAX_DAY} today={today()}><Icon n="cal" />เลือกจากปฏิทิน</CalendarTrigger>
                  </span>
                  <button type="button" className="ghost icon" id="next" aria-label={isRange ? 'ช่วงถัดไป' : 'วันถัดไป'} onClick={() => step(1)}><Icon n="right" /></button>
                  {/* aria-disabled, not disabled, so a focused button keeps focus */}
                  <button type="button" className="ghost" id="today" aria-disabled={isToday} onClick={() => setDay(today())}>วันนี้</button>
                </div>
                <p className="sr" id="dayLive" role="status" aria-live="polite">{live}</p>
              </div>

              <div className="tools">
                <div className="seg" id="seg" role="group" aria-label="กรองตามสถานะ">
                  {FILTERS.map(([k, label], i) => {
                    const n = k === 'all' ? pool.length : k === 'photo' ? pool.filter(issue).length : pool.filter((t) => t.status === k).length;
                    return <button type="button" key={k} ref={i === 0 ? firstSeg : undefined} aria-pressed={ui.filter === k} onClick={() => patch({ filter: k })}>{`${label} ${n}`}</button>;
                  })}
                </div>
                {/* a div, not a label: a label around the dropdown would forward list clicks back to its button */}
                <div className="sel">
                  <span>สาขา</span>
                  <Dropdown id="branch" label="สาขา" value={ui.branch}
                    onChange={(v) => patch({ branch: v, tech: v && ui.tech && TECH_BRANCH[ui.tech] !== v ? '' : ui.tech })} options={BRANCH_OPTIONS} />
                </div>
                <div className="sel">
                  <span>ช่าง</span>
                  <Dropdown id="tech" label="ช่าง" value={ui.tech} onChange={(v) => patch({ tech: v })} options={techOptions(ui.branch)} />
                </div>
              </div>

              <div className="tablewrap">
                <table id="table" hidden={!rows.length}>
                  <thead>
                    <tr>
                      {HEADS.map(([k, label, c]) => {
                        const on = ui.sort.key === k;
                        return (
                          <th key={k} scope="col" className={c} aria-sort={on ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                            <button type="button" onClick={() => sortBy(k)}>{label}<span className="dir">{on && <Icon n={ui.sort.dir > 0 ? 'up' : 'down'} />}</span></button>
                          </th>
                        );
                      })}
                      <th scope="col" className="c-w">เริ่ม / เสร็จ</th>
                      <th scope="col" className="c-p">รูปก่อน · หลัง</th>
                    </tr>
                  </thead>
                  <tbody id="rows">
                    {rows.map((t) => {
                      const late = lateMins(t);
                      return (
                        <tr key={t.id} data-id={t.id} data-sel={String(ui.sel === t.id)} className={t.status === 'done' ? 'is-done' : ''} onClick={() => open(t.id, null)}>
                          <td className="s" data-s={t.status}><span>{t.status === 'done' && <Icon n="check" />}{LABEL[t.status]}</span></td>
                          <td className={late ? 'late' : undefined}>{isRange && <span className="tdate">{th(toDate(t.date), { day: 'numeric', month: 'short' })}</span>}{t.time}{late ? <small>{fmtLate(late)}</small> : null}</td>
                          <td className="task">
                            <button type="button" className="open" data-open={t.id} aria-current={ui.sel === t.id ? 'true' : undefined}
                              onClick={(e) => { e.stopPropagation(); open(t.id, 'row'); }}>{t.title}</button>
                            <p>{t.place}</p>
                          </td>
                          <td className="c-h">{t.tech}<p>สาขา {branchLabel(t.branch)}</p></td>
                          <td className="c-w">{stamps(t)}</td>
                          <td className="c-p"><div className="pair">{cell(t, 'before')}{cell(t, 'after')}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="empty" id="empty" hidden={!!rows.length}>
                  {dayNone ? (
                    <>
                      <h2>{isRange ? 'ช่วงวันที่นี้' : isToday ? 'วันนี้' : 'วันที่นี้'}ยังไม่มีภารกิจ</h2>
                      <p>กด “สร้างภารกิจ” เพื่อมอบหมายงานให้ช่าง หรือเลือกวันอื่นจากปฏิทิน</p>
                      <button type="button" className="primary" onClick={startCreate}><Icon n="plus" />สร้างภารกิจ</button>
                    </>
                  ) : (
                    <>
                      <h2>ไม่พบภารกิจตามตัวกรอง</h2>
                      <p>ลองเลือกสถานะ สาขา หรือช่างอื่น</p>
                      <button type="button" className="secondary" onClick={() => { patch({ filter: 'all', branch: '', tech: '' }); firstSeg.current.focus(); }}>ล้างตัวกรอง</button>
                    </>
                  )}
                </div>
              </div>

              <p className="note">
                ข้อมูลตัวอย่าง · ยังไม่เชื่อมกับมือถือช่าง
                <button type="button" id="reset" onClick={restart}>เริ่มตัวอย่างใหม่</button>
              </p>
            </main>

            <Drawer key={`${ui.mode}:${ui.sel}:${ui.rev}`} ref={drawerRef} mode={ui.mode} task={selTask} date={date} branch={ui.branch}
              onSave={save} onClose={closeDrawer} onCreate={startCreate} onShot={setLb} />
          </div>
        </div>
      </div>

      {lb != null && data.tasks.some((t) => t.id === lb) && <Lightbox task={data.tasks.find((t) => t.id === lb)} onClose={() => setLb(null)} />}

      <div className={'toast' + (toastState.show ? ' show' : '')} id="toast" role="status" aria-live="polite">{toastState.text}</div>

      <datalist id="places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );
}
