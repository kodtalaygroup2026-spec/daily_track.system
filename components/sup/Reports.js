'use client';
// /supervisor/reports: what the technicians say they did, with photos, for one day or a range of up to 31 days.
// A single day (today or earlier) also lists the technicians who work that day and have sent nothing.
import { useEffect, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import CalendarTrigger from '@/components/CalendarTrigger';
import PhotoViewer from '@/components/PhotoViewer';
import { errText, getRoster, supDay, supReports } from '@/lib/api';
import { BRANCHES, branchLabel } from '@/lib/branches';
import { MAX_DAY, MIN_DAY, addDays, dayNum, isoOf, th, toDate, today } from '@/lib/dates';
import { branchOn, techWorks } from '@/lib/roster';
import Shell from './Shell';
import { Icon, relLabel } from './ui';

const POLL = 60000;
const CAP = 500; // supReports returns at most this many, newest days first
const KINDS = [['all', 'ทั้งหมด'], ['routine', 'งานประจำ'], ['adhoc', 'ที่ช่างเพิ่มเอง']];
const BRANCH_OPTIONS = [{ value: '', label: 'ทุกสาขา' }, ...BRANCHES];
const NONE = { reports: [], techs: [], absent: null, a: '', b: '' }; // a..b is the range the data was fetched for; absent null = not asked for
const dm = (d) => th(d, { day: 'numeric', month: 'short' });
const dayTitle = (iso) => th(toDate(iso), { weekday: 'long' }) + ' ' + th(toDate(iso), { day: 'numeric', month: 'short', year: 'numeric' });
// "9–11 พ.ย. 2569"; across months "28 ต.ค. – 3 พ.ย. 2569"
const rangeTitle = (a, b) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(toDate(a), toDate(b));
// a technician fits a branch when they are there on at least one of the days a..b; with no branch set they fit every branch
const inBranch = (p, branch, a, b) => {
  if (!branch) return true;
  for (let d = a; d <= b; d = addDays(d, 1)) { const x = branchOn(p, d); if (!x || x === branch) return true; }
  return false;
};
// a report for yesterday can be sent today: then the sending date is spelled out
const sentText = (r) => {
  const d = new Date(r.createdAt);
  return `ส่ง ${isoOf(d) === r.day ? '' : dm(d) + ' '}${d.toTimeString().slice(0, 5)}`;
};

// one photo button; a photo whose link is missing or no longer loads is a quiet dashed box with the words
function Thumb({ p, n, total, title, onOpen }) {
  const [bad, setBad] = useState(''); // the url that failed
  const dead = !p.url || bad === p.url;
  return (
    <button type="button" className="rp-shot" data-bad={dead ? '' : undefined} onClick={() => onOpen(n - 1)}
      aria-label={`ดูรูปที่ ${n} จาก ${total} ของ ${title}${dead ? ' (โหลดรูปไม่ได้)' : ''}`}>
      {dead ? 'โหลดรูปไม่ได้' : <img src={p.url} alt="" loading="lazy" onError={() => setBad(p.url)} />}
    </button>
  );
}

// one CSV cell; a cell that starts with = + - @ would run as a formula in Excel, so it gets a leading apostrophe
const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// the rows on screen as a file Excel opens with Thai text intact (the BOM tells it the file is UTF-8); photos are counted, not linked, as their links expire
function download(rows, branchOf, a, b) {
  const head = ['วันที่ทำงาน', 'สาขา', 'รหัสช่าง', 'ชื่อช่าง', 'ประเภท', 'งาน', 'ส่วนที่ทำ', 'หมายเหตุ', 'ส่งเมื่อ', 'จำนวนรูป'];
  const sorted = [...rows].sort((x, y) => x.day.localeCompare(y.day) || x.tech.localeCompare(y.tech, 'th') || x.createdAt.localeCompare(y.createdAt));
  const lines = [head, ...sorted.map((r) => {
    const d = new Date(r.createdAt);
    return [r.day, branchLabel(branchOf(r)), r.code, r.tech, r.kind === 'routine' ? 'งานประจำ' : 'เพิ่มเอง', r.title, r.place, r.note, `${isoOf(d)} ${d.toTimeString().slice(0, 5)}`, r.photos.length];
  })].map((l) => l.map(cell).join(','));
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const el = document.createElement('a');
  el.href = url;
  el.download = `daily-track-reports_${a}${b !== a ? '_to_' + b : ''}.csv`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Card({ r, range, onOpen }) {
  const routine = r.kind === 'routine';
  return (
    <li className="rp-card">
      <div className="rp-top">
        <span className="rp-kind"><Icon n={routine ? 'repeat' : 'plus'} />{routine ? 'งานประจำ' : 'เพิ่มเอง'}</span>
        <p className="rp-meta">{[range && `งานวันที่ ${dm(toDate(r.day))}`, sentText(r)].filter(Boolean).join(' · ')}</p>
      </div>
      <h3>{r.title}</h3>
      {r.place && <p><span className="rp-lab">ส่วนที่ทำ</span> {r.place}</p>}
      {r.note && <p className="rp-note">{r.note}</p>}
      {r.photos.length > 0 && (
        <div className="rp-shots">
          {r.photos.map((p, i) => <Thumb key={p.path} p={p} n={i + 1} total={r.photos.length} title={r.title} onOpen={(k) => onOpen(r, k)} />)}
        </div>
      )}
    </li>
  );
}

export default function Reports({ user }) {
  const [date, setDate] = useState(today);
  const [to, setTo] = useState(date); // last shown day; the same as date for one day
  const [ui, setUi] = useState({ branch: '', tech: '', kind: 'all' });
  const [data, setData] = useState(NONE);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null); // the open viewer, a snapshot: a refresh must not change or close it
  const seq = useRef(0); // only the newest request may fill the screen
  const on = useRef({ a: date, b: to }); // the days on screen, for the timer
  const firstSeg = useRef(null);

  async function load(a, b) {
    const n = ++seq.current;
    try {
      // who is expected only matters for one day that has begun; supDay would also create routine tasks of a future day, so it is not asked then
      // the days that have begun come from supDay, whose hand-chosen branch dates cover exactly those days (getRoster only looks back a week); days after today come from getRoster
      const t = today();
      const [reports, sd, ro] = await Promise.all([
        supReports(a, b),
        a <= t ? supDay(a, b < t ? b : t) : null,
        a > t || b > t ? getRoster() : null,
      ]);
      if (n !== seq.current) return;
      const techs = sd ? sd.techs.map((p) => { const r = ro && ro.find((x) => x.id === p.id); return r ? { ...p, branchDates: { ...r.branchDates, ...p.branchDates } } : p; }) : ro;
      setData({ reports, techs, absent: a === b && sd ? sd.absent : null, a, b });
      setErr('');
    } catch (e) {
      if (n === seq.current) setErr(`${errText(e)} · ข้อมูลที่เห็นอาจไม่ใช่ล่าสุด`);
    }
  }
  const refresh = () => load(on.current.a, on.current.b);

  useEffect(() => { on.current = { a: date, b: to }; load(date, to); }, [date, to]); // eslint-disable-line react-hooks/exhaustive-deps -- load only uses refs and setters
  useEffect(() => {
    const poll = () => { if (!document.hidden) refresh(); };
    const iv = setInterval(poll, POLL);
    document.addEventListener('visibilitychange', poll);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', poll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- refresh only uses refs and setters

  const isRange = to !== date;
  const size = dayNum(to) - dayNum(date) + 1;
  const isToday = date === today() && !isRange;
  const fresh = data.a === date && data.b === to; // the data on screen belongs to the days on screen
  const dayWord = isRange ? 'ช่วงวันที่นี้' : isToday ? 'วันนี้' : 'วันที่นี้';

  function setRange(a, b = a) {
    if (!a || a < MIN_DAY || b > MAX_DAY) return;
    if (dayNum(b) - dayNum(a) > 30) b = addDays(a, 30); // sup_day refuses longer ranges
    setDate(a);
    setTo(b);
  }
  const step = (dir) => setRange(addDays(date, dir * size), addDays(to, dir * size)); // the arrows move the whole range

  const all = fresh ? data.reports : []; // nothing of another day shows while this one loads
  // a report belongs to the branch its technician worked at on the report's day (the home branch when the technician is not in the list)
  const branchOf = (r) => branchOn(data.techs.find((p) => p.id === r.techId), r.day) || r.branch;
  const pool = all.filter((r) => (!ui.branch || !branchOf(r) || branchOf(r) === ui.branch) && (!ui.tech || r.techId === ui.tech));
  const rows = pool.filter((r) => ui.kind === 'all' || r.kind === ui.kind);
  // one heading per technician and branch: a technician who worked at two branches in the range appears under each, with that branch's reports
  const groups = [];
  rows.forEach((r) => {
    const b = branchOf(r);
    let g = groups.find((x) => x.id === r.techId && x.branch === b);
    if (!g) groups.push(g = { key: `${r.techId}-${b}`, id: r.techId, name: r.tech, code: r.code, branch: b, list: [] });
    g.list.push(r);
  });
  groups.sort((x, y) => x.name.localeCompare(y.name, 'th') || branchLabel(x.branch).localeCompare(branchLabel(y.branch)));
  const photoN = (list) => list.reduce((n, r) => n + r.photos.length, 0);
  const routineN = rows.filter((r) => r.kind === 'routine').length;
  const techOptions = [{ value: '', label: 'ช่างทุกคน' }, ...data.techs.filter((p) => inBranch(p, ui.branch, date, to)).map((p) => ({ value: p.id, label: p.name + (p.active ? '' : ' · ไม่ใช้งาน') }))];

  // everyone who works that day and sent nothing (any kind, whatever the type filter says)
  const miss = fresh && data.absent && (() => {
    const sent = new Set(all.map((r) => r.techId));
    const works = data.techs.filter((p) => techWorks(p, data.absent, date) && inBranch(p, ui.branch, date, date) && (!ui.tech || p.id === ui.tech));
    return { works: works.length, list: works.filter((p) => !sent.has(p.id)) };
  })();

  const open = (r, index) => setView({
    index, title: r.title, subtitle: `${r.tech} · ${sentText(r)}`,
    photos: r.photos.map((p, i) => ({ key: p.path, label: String(i + 1), src: p.url, alt: `รูปที่ ${i + 1} ของ ${r.title}`, note: 'โหลดรูปไม่ได้ ลองรีเฟรชหน้านี้' })),
  });

  return (
    <Shell user={user} active="reports" overlay={view && <PhotoViewer {...view} onClose={() => setView(null)} />}>
      <main className="layout plan">
        <header className="pl-head">
          <div>
            <h1 tabIndex={-1}>รายงานงานที่ทำ</h1>
            <p className="rel">{isRange ? `${rangeTitle(date, to)} · ช่วง ${size} วัน` : `${dayTitle(date)} · ${relLabel(date)}`}</p>
          </div>
          <div className="daynav" role="group" aria-label="เลือกวันที่">
            <button type="button" className="ghost icon" aria-label={isRange ? 'ช่วงก่อนหน้า' : 'วันก่อนหน้า'} onClick={() => step(-1)}><Icon n="left" /></button>
            <span className="pickwrap">
              <CalendarTrigger className="ghost" range value={{ from: date, to }} onPick={({ from, to: end }) => setRange(from, end)} min={MIN_DAY} max={MAX_DAY} today={today()}><Icon n="cal" />เลือกจากปฏิทิน</CalendarTrigger>
            </span>
            <button type="button" className="ghost icon" aria-label={isRange ? 'ช่วงถัดไป' : 'วันถัดไป'} onClick={() => step(1)}><Icon n="right" /></button>
            {/* aria-disabled, not disabled, so a focused button keeps focus */}
            <button type="button" className="ghost" aria-disabled={isToday} onClick={() => setRange(today())}>วันนี้</button>
          </div>
        </header>

        <div className="rp-tools">
          <div className="seg" role="group" aria-label="ประเภทงาน">
            {KINDS.map(([k, label], i) => (
              <button type="button" key={k} ref={i === 0 ? firstSeg : undefined} aria-pressed={ui.kind === k} onClick={() => setUi({ ...ui, kind: k })}>{label}</button>
            ))}
          </div>
          <div className="rp-tool">
            <span>สาขา</span>
            <Dropdown id="rp-branch" label="สาขา" value={ui.branch} options={BRANCH_OPTIONS}
              onChange={(v) => setUi({ ...ui, branch: v, tech: ui.tech && !inBranch(data.techs.find((p) => p.id === ui.tech) || {}, v, date, to) ? '' : ui.tech })} />
          </div>
          <div className="rp-tool">
            <span>ช่าง</span>
            <Dropdown id="rp-tech" label="ช่าง" value={ui.tech} options={techOptions} onChange={(v) => setUi({ ...ui, tech: v })} />
          </div>
          {/* aria-disabled, not disabled, so a focused button keeps focus; it saves exactly what the filters show */}
          <button type="button" className="secondary rp-export" aria-disabled={!rows.length}
            title="บันทึกรายการที่เห็นอยู่เป็นไฟล์ .csv เปิดต่อใน Excel หรือ Google Sheets ได้"
            onClick={() => rows.length && download(rows, branchOf, date, to)}>
            <Icon n="download" />ดาวน์โหลดเป็นไฟล์ Excel (.csv)
          </button>
        </div>

        <p className="rp-sum" role="status">
          {fresh ? `${rows.length} รายการ · ${new Set(groups.map((g) => g.id)).size} คน · งานประจำ ${routineN} · เพิ่มเอง ${rows.length - routineN} · รูป ${photoN(rows)}` : !err && 'กำลังโหลด…'}
        </p>
        {err && (
          <div className="loaderr" role="alert">
            <p><Icon n="alert" />{err}</p>
            <button type="button" className="ghost" onClick={refresh}>ลองใหม่</button>
          </div>
        )}
        {all.length >= CAP && <p className="rp-cap"><Icon n="alert" />แสดงได้สูงสุด {CAP} รายการ เริ่มจากวันล่าสุด เลือกช่วงวันที่สั้นลงเพื่อดูให้ครบ</p>}

        {miss && (
          <section className="rp-miss" aria-labelledby="rp-miss-h">
            <h2 id="rp-miss-h">ยังไม่ส่งรายงาน{miss.list.length > 0 && ` ${miss.list.length} คน`}</h2>
            {miss.list.length > 0 ? (
              <ul>
                {miss.list.map((p) => (
                  <li key={p.id}><b>{p.name}</b><span>{p.code}{branchOn(p, date) && ` · สาขา ${branchLabel(branchOn(p, date))}`}</span></li>
                ))}
              </ul>
            ) : (
              <p className="rp-ok"><Icon n="check" />{miss.works ? `ช่างที่ทำงาน${dayWord}ส่งรายงานครบทุกคนแล้ว` : `ไม่มีช่างที่ต้องทำงาน${dayWord}`}</p>
            )}
          </section>
        )}

        {groups.map((g) => (
          <section className="rp-group" key={g.key} aria-labelledby={`rp-g-${g.key}`}>
            <div className="rp-ghead">
              <h2 id={`rp-g-${g.key}`}>{g.name}{' '}<span>{g.code}{g.branch && ` · สาขา ${branchLabel(g.branch)}`}</span></h2>
              <p>{g.list.length} รายการ · รูป {photoN(g.list)}</p>
            </div>
            <ul className="rp-list">{g.list.map((r) => <Card key={r.id} r={r} range={isRange} onOpen={open} />)}</ul>
          </section>
        ))}

        {fresh && !rows.length && (
          <div className="empty">
            {all.length ? (
              <>
                <h2>ไม่พบรายงานตามตัวกรอง</h2>
                <p>ลองเลือกประเภท สาขา หรือช่างอื่น</p>
                <button type="button" className="secondary" onClick={() => { setUi({ branch: '', tech: '', kind: 'all' }); firstSeg.current.focus(); }}>ล้างตัวกรอง</button>
              </>
            ) : (
              <>
                <h2>ยังไม่มีรายงานใน{dayWord}</h2>
                <p>เมื่อช่างส่งรายงานงานที่ทำ จะแสดงที่นี่ · เลือกวันอื่นจากปฏิทินได้</p>
              </>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}
