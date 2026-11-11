import { th, toDate } from '../lib/dates';

export const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const I = { left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M6 9l6 6 6-6', tick: 'M4.5 12.5l5 5 10-11', cal: 'M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5' };

export const longDate = (iso) => th(toDate(iso), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

export function Icon({ d, w = 3 }) {
  return (
    <svg className="ic" aria-hidden="true" viewBox="0 0 24 24">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
