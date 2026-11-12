// Who works when. A technician { id, active, days } works on a day when they are active, the weekday is on their weekly
// roster (days: 0 = Sunday ... 6 = Saturday, the same numbers as Date.getDay) and they are not marked absent that day.
// This mirrors the database function tech_works, which hands routine tasks to the regular technician or to nobody.
import { toDate } from './dates';

// Monday first, as the week is read in Thai workplaces
export const WEEKDAYS = [
  { dow: 1, short: 'จ.', long: 'จันทร์' }, { dow: 2, short: 'อ.', long: 'อังคาร' }, { dow: 3, short: 'พ.', long: 'พุธ' },
  { dow: 4, short: 'พฤ.', long: 'พฤหัสบดี' }, { dow: 5, short: 'ศ.', long: 'ศุกร์' }, { dow: 6, short: 'ส.', long: 'เสาร์' },
  { dow: 0, short: 'อา.', long: 'อาทิตย์' },
];

export const dowOf = (iso) => toDate(iso).getDay();
export const isAbsent = (absent, techId, day) => absent.some((a) => a.techId === techId && a.day === day);
export const techWorks = (tech, absent, day) => !!tech && tech.active && tech.days.includes(dowOf(day)) && !isAbsent(absent, tech.id, day);

// a task still waiting to start whose technician is missing or off that day: the supervisor must call someone in
export const needsCover = (t, techs, absent) => t.status === 'todo' && (!t.techId || !techWorks(techs.find((x) => x.id === t.techId), absent, t.date));

// the Monday (a Date) of the week that holds this ISO day; use isoOf / addDays from dates.js to go on from there
export function weekOf(iso) {
  const d = toDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
