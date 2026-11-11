'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_DAY, MIN_DAY, isoOf, th, toDate, today as todayIso } from '../lib/dates';
import { I, Icon, WD } from './pick-utils';

// only one calendar is open at a time: a newly opened one closes the previous without moving focus
let current = null;

// same day number in another month, clamped to that month's last day
function shiftMonth(dt, n) {
  const last = new Date(dt.getFullYear(), dt.getMonth() + n + 1, 0).getDate();
  return new Date(dt.getFullYear(), dt.getMonth() + n, Math.min(dt.getDate(), last));
}

export default function Calendar({ anchor, value, onPick, onClose, min = MIN_DAY, max = MAX_DAY, today }) {
  const el = useRef(null);
  const pending = useRef(null); // selector of the element to focus after the next render
  const placed = useRef(false);
  const now = today || todayIso();
  const v = value && value >= min && value <= max ? value : now;
  const [view, setView] = useState(() => {
    const d = toDate(v);
    return { y: d.getFullYear(), m: d.getMonth(), focus: v };
  });

  const close = (refocus) => { onClose(); if (refocus) anchor.focus(); };
  const pickDay = (s) => { close(true); onPick(s); };
  const focusDay = (dt) => {
    const s = isoOf(dt);
    if (s < min || s > max) return;
    setView({ y: dt.getFullYear(), m: dt.getMonth(), focus: s });
    pending.current = `[data-d="${s}"]`;
  };

  // runs after every render: places the popover on opening, and moves focus once the redrawn grid exists
  useLayoutEffect(() => {
    const box = el.current;
    if (!placed.current) {
      placed.current = true;
      pending.current = `[data-d="${v}"]`;
      const r = anchor.getBoundingClientRect(), c = box.getBoundingClientRect();
      let top = r.bottom + 8;
      if (top + c.height > innerHeight - 8 && r.top - c.height - 8 > 8) top = r.top - c.height - 8; // not enough room below: open upward
      const left = Math.max(8, Math.min(r.right - c.width, innerWidth - c.width - 8));
      box.style.left = left + scrollX + 'px';
      box.style.top = top + scrollY + 'px';
    }
    if (pending.current) {
      const t = box.querySelector(pending.current);
      pending.current = null;
      if (t) t.focus({ preventScroll: true });
    }
  });

  useLayoutEffect(() => {
    const me = { close: onClose };
    if (current) current.close();
    current = me;
    const outside = (e) => { if (!el.current.contains(e.target) && !anchor.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', outside);
    addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', outside);
      removeEventListener('resize', onClose);
      if (current === me) current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered once for the life of this popover
  }, []);

  const { y, m, focus } = view;
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const s = isoOf(dt);
    const cls = 'cd' + (dt.getMonth() !== m ? ' out' : '') + (s === v ? ' sel' : '') + (s === now ? ' now' : '');
    cells.push(
      <button key={i} type="button" className={cls} data-d={s} tabIndex={s === focus ? 0 : -1} disabled={s < min || s > max}
        aria-pressed={s === v ? 'true' : undefined} aria-current={s === now ? 'date' : undefined}
        aria-label={th(dt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>{dt.getDate()}</button>,
    );
  }

  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.d) return pickDay(b.dataset.d);
    if (b.dataset.m) {
      const n = Number(b.dataset.m), t = shiftMonth(toDate(focus), n);
      setView({ y: t.getFullYear(), m: t.getMonth(), focus: isoOf(t) });
      pending.current = `[data-m="${n}"]`;
    } else if ('today' in b.dataset) { if (now >= min && now <= max) pickDay(now); }
    else if ('close' in b.dataset) close(true);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (!e.target.dataset.d) return;
    const f = toDate(focus), Y = f.getFullYear(), M = f.getMonth(), D = f.getDate(), W = f.getDay();
    const to = { ArrowLeft: () => new Date(Y, M, D - 1), ArrowRight: () => new Date(Y, M, D + 1), ArrowUp: () => new Date(Y, M, D - 7), ArrowDown: () => new Date(Y, M, D + 7),
      PageUp: () => shiftMonth(f, -1), PageDown: () => shiftMonth(f, 1), Home: () => new Date(Y, M, D - W), End: () => new Date(Y, M, D + 6 - W) }[e.key];
    if (to) { e.preventDefault(); focusDay(to()); }
  };

  // leaving the calendar with Tab closes it; redrawing it (which can drop focus for a moment) must not.
  // Focus landing on the trigger is its own click about to toggle the calendar shut.
  const onBlur = () => setTimeout(() => {
    const a = document.activeElement;
    if (el.current && !el.current.contains(a) && a !== anchor) onClose();
  }, 0);

  return createPortal(
    <div className="cal" role="dialog" aria-label="เลือกวันที่" ref={el} onClick={onClick} onKeyDown={onKeyDown} onBlur={onBlur}>
      <div className="ch">
        <button type="button" className="cn" data-m="-1" aria-label="เดือนก่อนหน้า"><Icon d={I.left} /></button>
        <div className="ct" aria-live="polite">{th(first, { month: 'long', year: 'numeric' })}</div>
        <button type="button" className="cn" data-m="1" aria-label="เดือนถัดไป"><Icon d={I.right} /></button>
      </div>
      <div className="cw" aria-hidden="true">{WD.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cg">{cells}</div>
      <div className="cf">
        <button type="button" className="cb" data-today="">วันนี้</button>
        <button type="button" className="cb" data-close="">ปิด</button>
      </div>
    </div>,
    anchor.closest('.s-sup') || document.body,
  );
}
