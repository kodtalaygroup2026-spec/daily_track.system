'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import CalendarTrigger from '@/components/CalendarTrigger';
import { assignCover, createTask, errText, saveTemplate, supDay, updateTask } from '@/lib/api';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { MAX_DAY, MIN_DAY, addDays, dayNum, isoOf, mins, nowMins, th, toDate, today } from '@/lib/dates';
import { PLACES } from '@/lib/presets';
import { needsCover } from '@/lib/roster';
import Drawer from './Drawer';
import Lightbox from './Lightbox';
import Shell from './Shell';
import { Icon, LABEL, NAMES, fmtLate, issue, lateMins, relLabel, slot } from './ui';

const FILTERS = [['all', 'ทั้งหมด'], ['todo', 'รอทำ'], ['doing', 'กำลังทำ'], ['done', 'เสร็จ'], ['photo', 'รูปไม่ครบ']];
const HEADS = [['status', 'สถานะ', 'c-s'], ['time', 'เวลา', 'c-t'], ['title', 'ภารกิจ', undefined], ['tech', 'ช่าง', 'c-h']];
const ORDER = { todo: 0, doing: 1, done: 2 };
const POLL = 20000;
const dayTitle = (iso) => th(toDate(iso), { weekday: 'long' }) + ' ' + th(toDate(iso), { day: 'numeric', month: 'short', year: 'numeric' });
// "9–11 พ.ย. 2569"; across months "28 ต.ค. – 3 พ.ย. 2569"
const rangeTitle = (a, b) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(toDate(a), toDate(b));
const BRANCH_OPTIONS = [{ value: '', label: 'ทุกสาขา' }, ...BRANCHES];
const inBranch = (p, branch) => !branch || !p.branch || p.branch === branch; // a technician with no branch shows under every branch
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= MIN_DAY && s <= MAX_DAY && isoOf(toDate(s)) === s;

// date = first shown day, to = last shown day ('' = just the one day)
const FRESH = { date: '', to: '', filter: 'all', branch: '', tech: '', sort: { key: 'time', dir: 1 }, sel: null, mode: null, rev: 0 };
// a..b is the range the data was fetched for
const NONE = { tasks: [], absent: [], techs: [], a: '', b: '' };

export default function SupDay({ user }) {
  const [data, setData] = useState(NONE);
  const [loadErr, setLoadErr] = useState('');
  const [ui, setUi] = useState(FRESH);
  const [live, setLive] = useState('');
  const [toastState, setToastState] = useState({ text: '', show: false });
  const [lb, setLb] = useState(null); // { id, kind }: the task and the photo shown in the viewer
  const [, redraw] = useReducer((n) => n + 1, 0);

  const drawerRef = useRef(null);
  const createBtn = useRef(null);
  const firstSeg = useRef(null);
  const after = useRef(null); // runs once after the next commit, for focus that needs the new DOM
  const last = useRef({ m: 0, d: '' });
  const timers = useRef({ show: 0, hide: 0 });
  const tickRef = useRef(null);
  const view = useRef({ a: '', b: '' }); // the days on screen, for the timer and for refreshes after a change
  const seq = useRef(0); // only the newest request may fill the screen
  const box = useRef(0); // counts box openings and closings, so a slow save knows whether its box is still the one on screen
  const announce = useRef(false);

  const patch = (p) => setUi((u) => ({ ...u, ...p }));
  const date = ui.date || today();
  const to = ui.to && ui.to > date ? ui.to : date;

  /* ---- data: the days on screen, fetched on every change of days, every 20 s while the tab is visible, and after every change ---- */
  async function load(a, b) {
    const n = ++seq.current;
    try {
      const d = await supDay(a, b);
      if (n !== seq.current) return;
      setData({ ...d, a, b });
      setLoadErr('');
      if (announce.current) { announce.current = false; setLive(`${a === b ? dayTitle(a) : rangeTitle(a, b)} · ${d.tasks.length} ภารกิจ`); }
    } catch (e) {
      if (n === seq.current) setLoadErr(`${errText(e)} · ข้อมูลที่เห็นอาจไม่ใช่ล่าสุด`);
    }
  }
  const refresh = () => (view.current.a ? load(view.current.a, view.current.b) : undefined);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('date'); // the roster page links to a day
    patch({ date: q && validDay(q) ? q : today() });
    last.current = { m: nowMins(), d: today() };
  }, []);

  useEffect(() => { // runs after every commit
    tickRef.current = tick;
    view.current = { a: ui.date ? date : '', b: to };
    if (after.current) { const f = after.current; after.current = null; f(); }
  });

  useEffect(() => { if (ui.date) load(date, to); }, [ui.date, date, to]); // eslint-disable-line react-hooks/exhaustive-deps -- load only uses refs and setters

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
    const run = () => { if (tickRef.current) tickRef.current(); };
    const poll = () => { if (!document.hidden) refresh(); };
    const iv = setInterval(run, 15000);
    const pv = setInterval(poll, POLL);
    const vis = () => { if (!document.hidden) { run(); refresh(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); clearInterval(pv); document.removeEventListener('visibilitychange', vis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- refresh only uses refs and setters

  useEffect(() => () => { clearTimeout(timers.current.show); clearTimeout(timers.current.hide); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && ui.mode && !lbTask) closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const { techs, absent } = data;
  const isRange = to !== date;
  const span = dayNum(to) - dayNum(date) + 1; // days shown
  const fresh = data.a === date && data.b === to; // the data on screen belongs to the days on screen
  const isCover = (t) => needsCover(t, techs, absent);
  const dayList = data.tasks.filter((t) => t.date >= date && t.date <= to);
  const pool = dayList.filter((t) => (!ui.branch || t.branch === ui.branch) && (!ui.tech || t.techId === ui.tech));
  const coverAll = dayList.filter(isCover).length;
  const coverN = pool.filter(isCover).length;
  const filter = ui.filter === 'cover' && !coverN ? 'all' : ui.filter; // the chip is gone when nothing needs cover
  const filters = coverN ? [...FILTERS, ['cover', 'ต้องหาคนแทน']] : FILTERS;
  const test = (k) => (t) => k === 'all' || (k === 'photo' ? issue(t) : k === 'cover' ? isCover(t) : t.status === k);
  const rows = (() => {
    const { key, dir } = ui.sort;
    const when = (a, b) => a.date.localeCompare(b.date) || mins(a.time) - mins(b.time); // days first, then the hour
    const cmp = {
      time: (a, b) => when(a, b) || a.id.localeCompare(b.id),
      status: (a, b) => ORDER[a.status] - ORDER[b.status] || when(a, b),
      title: (a, b) => a.title.localeCompare(b.title, 'th'),
      tech: (a, b) => (a.tech || '').localeCompare(b.tech || '', 'th') || when(a, b),
    }[key];
    return pool.filter(test(filter)).sort((a, b) => cmp(a, b) * dir);
  })();
  const selTask = data.tasks.find((x) => x.id === ui.sel);
  const lbTask = lb && data.tasks.find((x) => x.id === lb.id);
  const techOptions = [{ value: '', label: 'ช่างทุกคน' }, ...techs.filter((p) => inBranch(p, ui.branch)).map((p) => ({ value: p.id, label: p.name }))];
  const techName = (id) => (techs.find((p) => p.id === id) || { name: '' }).name;

  /* ---- actions ---- */
  function toast(msg) {
    clearTimeout(timers.current.show); clearTimeout(timers.current.hide);
    setToastState((s) => ({ ...s, show: false }));
    // the live region keeps its node and changes text after a beat, so screen readers announce it
    timers.current.show = setTimeout(() => setToastState({ text: msg, show: true }), 50);
    timers.current.hide = setTimeout(() => setToastState((s) => ({ ...s, show: false })), 4500);
  }

  // focus = which field the box puts the cursor in: the title, or the technician when a cover is being found
  function open(id, from, focus = 'focusTitle') {
    if (ui.mode === 'view' && ui.sel === id && !from) return; // re-clicking the open row must not wipe unsaved edits
    box.current++;
    patch({ sel: id, mode: 'view', rev: ui.rev + 1 });
    // the task opens in a modal box: focus moves into it; closing returns it to the row
    after.current = () => drawerRef.current && drawerRef.current[focus]();
  }
  function startCreate() {
    box.current++;
    patch({ sel: null, mode: 'create', rev: ui.rev + 1 });
    after.current = () => document.getElementById('f-title').focus();
  }
  function closeDrawer() {
    const id = ui.sel;
    box.current++;
    patch({ sel: null, mode: null });
    // after the box is gone and the page is live again (an inert element cannot take focus)
    after.current = () => { const back = id && document.querySelector(`[data-open="${id}"]`); (back || createBtn.current).focus(); };
  }

  // v comes from the box: { routine, title, place, branch, date, time, techId, items (undefined = not editable) }.
  // Resolves when done; a failure is shown in the toast and the box stays open with its input.
  async function save(v) {
    const mine = box.current;
    const t = ui.mode === 'create' ? null : selTask;
    try {
      let text, id = t && t.id;
      if (!t && v.routine) {
        await saveTemplate({ title: v.title, place: v.place, branch: v.branch, time: v.time, ownerId: v.techId, startsOn: v.date, active: true, items: v.items });
        if (mine === box.current) closeDrawer();
        toast(`สร้างงานประจำ “${v.title}” แล้ว · ทำซ้ำทุกวัน`);
        await refresh();
        return;
      }
      if (!t) {
        id = await createTask(v);
        text = `มอบหมาย “${v.title}” ให้ ${techName(v.techId)} แล้ว`;
      } else {
        const moved = t.techId !== v.techId;
        const cover = t.routine && moved; // another technician takes one day of a routine: the owner stays, only this task changes hands
        const same = ['title', 'place', 'branch', 'date', 'time'].every((k) => v[k] === t[k]) && (v.items === undefined || v.items.join('\n') === t.items.map((i) => i.title).join('\n'));
        if (!(cover && same)) await updateTask(t.id, { ...v, techId: cover ? t.techId : v.techId });
        if (cover) await assignCover(t.id, v.techId);
        text = cover ? (v.techId === t.ownerId ? `คืน “${v.title}” ให้ ${t.owner} แล้ว` : `ให้ ${techName(v.techId)} แทน ${t.owner} แล้ว`)
          : t.date !== v.date ? `ย้าย “${v.title}” ไปที่ ${relLabel(v.date) === 'วันนี้' ? 'วันนี้' : dayTitle(v.date)} แล้ว`
            : moved ? `ย้าย “${v.title}” ไปให้ ${techName(v.techId)} แล้ว` : `บันทึก “${v.title}” แล้ว`;
      }
      const inView = v.date >= date && v.date <= to; // a task moved outside the shown days: follow it to its day
      const [a, b] = inView ? [date, to] : [v.date, v.date];
      await load(a, b);
      if (mine !== box.current) { toast(text); if (!inView) refresh(); return; } // the box was closed meanwhile: leave the page where it is
      // keep the new or moved row on screen
      const keep = { branch: ui.branch && ui.branch !== v.branch ? '' : ui.branch, tech: ui.tech && ui.tech !== v.techId ? '' : ui.tech, filter: !t && ui.filter !== 'all' && ui.filter !== 'todo' ? 'all' : ui.filter };
      patch({ ...keep, ...(inView ? {} : { date: a, to: '' }), sel: id, mode: 'view', rev: ui.rev + 1 });
      after.current = () => drawerRef.current && drawerRef.current.focusTitle();
      toast(text);
    } catch (e) {
      refresh();
      toast(errText(e));
    }
  }

  /* ---- day navigation: arrows, calendar, "today" ---- */
  function setRange(a, b = a) {
    if (!a || a < MIN_DAY || b > MAX_DAY) return;
    if (dayNum(b) - dayNum(a) > 30) { b = addDays(a, 30); toast('แสดงได้ไม่เกิน 31 วัน'); } // sup_day refuses longer ranges
    if (a === date && b === to) return;
    const one = a === b;
    announce.current = true;
    if (ui.mode === 'create') { // a half-typed new task survives browsing; it just follows the first day
      patch({ date: a, to: one ? '' : b });
      drawerRef.current && drawerRef.current.setDate(a);
    } else { box.current++; patch({ date: a, to: one ? '' : b, sel: null, mode: null }); } // the open task belongs to the old days
  }
  const setDay = (iso) => setRange(iso, iso);
  const step = (dir) => setRange(addDays(date, dir * span), addDays(to, dir * span)); // the arrows move the whole range

  const sortBy = (k) => patch({ sort: ui.sort.key === k ? { key: k, dir: -ui.sort.dir } : { key: k, dir: 1 } });
  const dayNone = !dayList.length;
  const isToday = date === today() && !isRange;

  // when the technician took the before and the after photo: a todo task has neither, a doing task only the start
  const stamps = (t) => (t.status === 'todo'
    ? <><span className="sr">ยังไม่เริ่มงาน</span>—</>
    : <><span>เริ่ม {t.beforeAt || '—'}</span>{t.status === 'done' && <span>เสร็จ {t.afterAt || '—'}</span>}</>);

  const cell = (t, k) => {
    const s = slot(t, k);
    if (s === 'ok') {
      return (
        <button type="button" className="shot" aria-label={`ดูรูป${NAMES[k]}ของ ${t.title}`} onClick={(e) => { e.stopPropagation(); setLb({ id: t.id, kind: k }); }}>
          <img src={t[k]} alt="" />
        </button>
      );
    }
    if (s === 'miss') {
      return <button type="button" className="slot miss" aria-label={`รอรูป${NAMES[k]}ของ ${t.title}`} onClick={(e) => { e.stopPropagation(); setLb({ id: t.id, kind: k }); }}>รอรูป</button>;
    }
    return <span className="slot due"><span className="sr">ยังไม่ถึงขั้นตอนถ่ายรูป{NAMES[k]}</span>—</span>;
  };

  const overlay = (
    <>
      {/* outside .page, which is made inert while the box is open */}
      {ui.mode && (ui.mode === 'create' || selTask) && (
        <Drawer key={`${ui.mode}:${ui.sel}:${ui.rev}`} ref={drawerRef} mode={ui.mode} task={selTask} date={date} branch={ui.branch}
          techs={techs} absent={absent} onSave={save} onClose={closeDrawer} onShot={(id, kind) => setLb({ id, kind })} />
      )}

      {lbTask && <Lightbox task={lbTask} kind={lb.kind} onClose={() => setLb(null)} />}

      <div className={'toast' + (toastState.show ? ' show' : '')} id="toast" role="status" aria-live="polite">{toastState.text}</div>

      <datalist id="places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist>
    </>
  );

  return (
    <Shell user={user} active="day" overlay={overlay}
      actions={<button type="button" id="create" ref={createBtn} className="primary" onClick={startCreate}><Icon n="plus" />สร้างภารกิจ</button>}>
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
              {filters.map(([k, label], i) => (
                <button type="button" key={k} ref={i === 0 ? firstSeg : undefined} aria-pressed={filter === k} onClick={() => patch({ filter: k })}>{`${label} ${pool.filter(test(k)).length}`}</button>
              ))}
            </div>
            {/* a div, not a label: a label around the dropdown would forward list clicks back to its button */}
            <div className="sel">
              <span>สาขา</span>
              <Dropdown id="branch" label="สาขา" value={ui.branch}
                onChange={(v) => patch({ branch: v, tech: ui.tech && !inBranch(techs.find((p) => p.id === ui.tech) || {}, v) ? '' : ui.tech })} options={BRANCH_OPTIONS} />
            </div>
            <div className="sel">
              <span>ช่าง</span>
              <Dropdown id="tech" label="ช่าง" value={ui.tech} onChange={(v) => patch({ tech: v })} options={techOptions} />
            </div>
          </div>

          <div role="status">{!fresh && !loadErr && <p className="loading">กำลังโหลด…</p>}</div>
          {loadErr && (
            <div className="loaderr" role="alert">
              <p><Icon n="alert" />{loadErr}</p>
              <button type="button" className="ghost" onClick={refresh}>ลองใหม่</button>
            </div>
          )}
          {coverAll > 0 && filter !== 'cover' && (
            <div className="coverbar">
              <p><Icon n="alert" />{`มี ${coverAll} งานยังไม่มีคนทำหรือช่างไม่อยู่ · เลือกคนแทน`}</p>
              <button type="button" className="ghost" onClick={() => { patch({ filter: 'cover', branch: '', tech: '' }); after.current = () => document.querySelector('#seg button[aria-pressed="true"]')?.focus(); }}>ดูงานที่ต้องหาคนแทน</button>
            </div>
          )}

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
                  const cv = isCover(t);
                  return (
                    <tr key={t.id} data-id={t.id} data-sel={String(ui.sel === t.id)} className={t.status === 'done' ? 'is-done' : ''} onClick={() => open(t.id, null)}>
                      <td className="s" data-s={t.status}><span>{t.status === 'done' && <Icon n="check" />}{LABEL[t.status]}</span></td>
                      <td className={late ? 'late' : undefined}>{isRange && <span className="tdate">{th(toDate(t.date), { day: 'numeric', month: 'short' })}</span>}{t.time}{late ? <small>{fmtLate(late)}</small> : null}</td>
                      <td className="task">
                        <button type="button" className="open" data-open={t.id} aria-current={ui.sel === t.id ? 'true' : undefined}
                          onClick={(e) => { e.stopPropagation(); open(t.id, 'row'); }}>{t.title}</button>
                        <p>{t.place}{t.routine && <span className="tag"><Icon n="repeat" />ประจำ</span>}</p>
                      </td>
                      <td className="c-h">
                        {cv ? (
                          <>
                            <span className="warn"><Icon n="alert" />{t.techId ? `${t.tech} · ไม่อยู่` : 'ยังไม่มีคนทำ'}</span>
                            <button type="button" className="find" aria-label={`หาคนแทนสำหรับ ${t.title}`}
                              onClick={(e) => { e.stopPropagation(); open(t.id, 'row', 'focusTech'); }}>หาคนแทน</button>
                          </>
                        ) : t.tech}
                        {t.techId && t.ownerId && t.techId !== t.ownerId && <p className="swap"><Icon n="swap" />แทน {t.owner}</p>}
                        {t.branch && <p>สาขา {branchLabel(t.branch)}</p>}
                      </td>
                      <td className="c-w">{stamps(t)}</td>
                      <td className="c-p"><div className="pair">{cell(t, 'before')}{cell(t, 'after')}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="empty" id="empty" hidden={!!rows.length || !fresh}>
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
        </main>
      </div>
    </Shell>
  );
}
