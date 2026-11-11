// Calendar days are ISO strings "YYYY-MM-DD" in the device's own time zone; times are "HH:MM"; clock values are minutes since midnight.
export const MIN_DAY = '2000-01-01';
export const MAX_DAY = '2099-12-31'; // a typed two-digit year would otherwise land in 19xx

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoOf(new Date());
export const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
export const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return isoOf(d); };

export const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
export const clockNow = () => new Date().toTimeString().slice(0, 5); // "HH:MM" right now

// minutes from a scheduled moment until now (negative while it is still ahead)
export const minsSince = (date, time) => (dayNum(today()) - dayNum(date)) * 1440 + nowMins() - mins(time);

export function dur(m) {
  m = Math.max(0, m);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), n = m % 60;
  if (d) return `${d} วัน${h ? ' ' + h + ' ชม.' : ''}`;
  return h ? `${h} ชม.${n ? ' ' + n + ' น.' : ''}` : `${m} น.`;
}
export const fmtLate = (m) => 'เลย ' + dur(m);

// Thai Buddhist-era formatting, e.g. th(new Date(), { day: 'numeric', month: 'short', year: 'numeric' }) gives "11 พ.ย. 2569"
export const th = (d, o) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', o).format(d);
