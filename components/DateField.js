'use client';
import { forwardRef } from 'react';
import CalendarTrigger from './CalendarTrigger';
import { I, Icon, longDate } from './pick-utils';

const DateField = forwardRef(function DateField({ id, label, value, onChange, min, max, disabled, invalid, describedBy }, ref) {
  const txt = value ? longDate(value) : 'เลือกวันที่';
  return (
    <CalendarTrigger ref={ref} id={id} className="ddb" value={value} onPick={onChange} min={min} max={max} disabled={disabled}
      aria-label={(label ? label + ': ' : '') + txt} aria-invalid={invalid ? 'true' : undefined} aria-describedby={describedBy}>
      <span className="ddv">{txt}</span>
      <Icon d={I.cal} w={2.4} />
    </CalendarTrigger>
  );
});

export default DateField;
