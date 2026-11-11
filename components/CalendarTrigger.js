'use client';
import { forwardRef, useState } from 'react';
import Calendar from './Calendar';

// range: choose a first and a last day (value and onPick use { from, to }); extra props (aria-label, disabled, ...) go straight to the button
const CalendarTrigger = forwardRef(function CalendarTrigger({ value, onPick, min, max, today, range, children, ...rest }, ref) {
  const [anchor, setAnchor] = useState(null); // the button while the calendar is open
  return (
    <>
      <button type="button" ref={ref} aria-haspopup="dialog" aria-expanded={!!anchor} {...rest}
        onClick={(e) => { const b = e.currentTarget; setAnchor((a) => (a ? null : b)); }}>
        {children}
      </button>
      {anchor && <Calendar anchor={anchor} value={value} onPick={onPick} onClose={() => setAnchor(null)} min={min} max={max} today={today} range={range} />}
    </>
  );
});

export default CalendarTrigger;
