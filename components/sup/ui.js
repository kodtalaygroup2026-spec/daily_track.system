import { dayNum, fmtLate, minsSince, today } from '@/lib/dates';

export const LABEL = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };
export const NAMES = { before: 'ก่อนเริ่ม', after: 'หลังเสร็จ' };

// before is due once the task has started, after once it is done; a due photo that is absent is "missing"
const need = (t, k) => (k === 'before' ? t.status !== 'todo' : t.status === 'done');
export const slot = (t, k) => (t[k] ? 'ok' : need(t, k) ? 'miss' : 'due');
export const issue = (t) => slot(t, 'before') === 'miss' || slot(t, 'after') === 'miss';
export const emptyText = (t, k) => (slot(t, k) === 'miss' ? 'ยังไม่ได้รับรูป' : t.status === 'todo' ? 'ยังไม่เริ่มงาน' : 'รอช่างจบงาน');

export const lateMins = (t) => (t.status === 'done' ? 0 : Math.max(0, minsSince(t.date, t.time)));
export { fmtLate };

export function relLabel(date) {
  const diff = dayNum(date) - dayNum(today());
  return diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : diff === -1 ? 'เมื่อวาน' : diff > 1 ? `อีก ${diff} วัน` : `ย้อนหลัง ${-diff} วัน`;
}

export function Icon({ n }) {
  return <svg className="ic" aria-hidden="true"><use href={`#i-${n}`} /></svg>;
}

const SYMBOLS = {
  check: ['M4.5 12.5l5 5 10-11', 3], close: ['M5 5l14 14M19 5L5 19', 3], up: ['M6 15l6-6 6 6', 3], down: ['M6 9l6 6 6-6', 3],
  plus: ['M12 5v14M5 12h14', 3], left: ['M15 5l-7 7 7 7', 3], right: ['M9 5l7 7-7 7', 3],
  cal: ['M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5', 2.4], menu: ['M4 7h16M4 12h16M4 17h16', 3],
};
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      {Object.entries(SYMBOLS).map(([n, [d, w]]) => (
        <symbol key={n} id={`i-${n}`} viewBox="0 0 24 24">
          <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      ))}
    </svg>
  );
}
