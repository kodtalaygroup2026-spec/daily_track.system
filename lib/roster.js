// Who works when. A technician { id, active, days } works on a day when they are active, the weekday is on their weekly
// roster (days: 0 = Sunday ... 6 = Saturday, the same numbers as Date.getDay) and they are not marked absent that day.
// This mirrors the database function tech_works, which hands routine tasks to the regular technician or to nobody.
import { dayNum, toDate } from './dates';

// Monday first, as the week is read in Thai workplaces
export const WEEKDAYS = [
  { dow: 1, short: 'จ.', long: 'จันทร์' }, { dow: 2, short: 'อ.', long: 'อังคาร' }, { dow: 3, short: 'พ.', long: 'พุธ' },
  { dow: 4, short: 'พฤ.', long: 'พฤหัสบดี' }, { dow: 5, short: 'ศ.', long: 'ศุกร์' }, { dow: 6, short: 'ส.', long: 'เสาร์' },
  { dow: 0, short: 'อา.', long: 'อาทิตย์' },
];

export const dowOf = (iso) => toDate(iso).getDay();
export const isAbsent = (absent, techId, day) => absent.some((a) => a.techId === techId && a.day === day);
// tech.rotation = { start: 'YYYY-MM-DD', mask: '110' } repeats a cycle of 1 (works) / 0 (off) days from start; without one the weekly days apply
export const onRoster = (tech, day) => {
  if (!tech || !tech.active) return false;
  if (!tech.rotation) return tech.days.includes(dowOf(day));
  const n = tech.rotation.mask.length;
  return tech.rotation.mask[(((dayNum(day) - dayNum(tech.rotation.start)) % n) + n) % n] === '1';
};
export const techWorks = (tech, absent, day) => onRoster(tech, day) && !isAbsent(absent, tech.id, day);

// ready-made rotations for the roster page: [label, mask]
export const ROTATIONS = [['วันเว้นวัน', '10'], ['ทำ 2 หยุด 1', '110'], ['ทำ 3 หยุด 1', '1110'], ['ทำ 4 หยุด 2', '111100']];

// a task still waiting to start whose technician is missing or off that day: the supervisor must call someone in
export const needsCover = (t, techs, absent) => t.status === 'todo' && (!t.techId || !techWorks(techs.find((x) => x.id === t.techId), absent, t.date));

// the Monday (a Date) of the week that holds this ISO day; use isoOf / addDays from dates.js to go on from there
export function weekOf(iso) {
  const d = toDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
