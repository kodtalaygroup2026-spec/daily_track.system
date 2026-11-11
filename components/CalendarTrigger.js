'use client';
import { forwardRef, useState } from 'react';
import Calendar from './Calendar';

// extra props (aria-label, disabled, ...) go straight to the button
const CalendarTrigger = forwardRef(function CalendarTrigger({ value, onPick, min, max, today, children, ...rest }, ref) {
  const [anchor, setAnchor] = useState(null); // the button while the calendar is open
  return (
    <>
      <button type="button" ref={ref} aria-haspopup="dialog" aria-expanded={!!anchor} {...rest}
        onClick={(e) => { const b = e.currentTarget; setAnchor((a) => (a ? null : b)); }}>
        {children}
      </button>
      {anchor && <Calendar anchor={anchor} value={value} onPick={onPick} onClose={() => setAnchor(null)} min={min} max={max} today={today} />}
    </>
  );
});

export default CalendarTrigger;
