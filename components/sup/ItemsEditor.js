'use client';
import '../../app/styles/sup-shared.css';
import { useEffect, useRef } from 'react';
import { Icon } from './ui';

// The sub-task (งานย่อย) list of a task or routine: a column of text rows the supervisor can add to and remove from.
// value: string[]; onChange(next: string[]). Enter adds a row after the current one, Backspace on an empty row removes it.
// Blank rows are dropped by the server, so the parent never has to filter them.
export default function ItemsEditor({ id, value, onChange, disabled, max = 30 }) {
  const refs = useRef([]);
  const focusAt = useRef(null);

  useEffect(() => { // after the list has re-rendered, focus the row that was asked for
    if (focusAt.current != null && refs.current[focusAt.current]) refs.current[focusAt.current].focus();
    focusAt.current = null;
  });

  const set = (i, v) => onChange(value.map((x, k) => (k === i ? v : x)));
  const addAfter = (i) => {
    if (value.length >= max) return;
    const next = [...value];
    next.splice(i + 1, 0, '');
    focusAt.current = i + 1;
    onChange(next);
  };
  const remove = (i) => {
    focusAt.current = Math.max(0, i - 1);
    onChange(value.filter((_, k) => k !== i));
  };

  return (
    <div className="items" id={id} role="group" aria-label="งานย่อย">
      {value.length === 0 && <p className="items-empty">ยังไม่มีงานย่อย · ช่างจะติ๊กทีละข้อก่อนจบงาน</p>}
      {value.map((v, i) => (
        <div className="items-row" key={i}>
          <span className="items-n" aria-hidden="true">{i + 1}</span>
          <input type="text" ref={(el) => { refs.current[i] = el; }} value={v} maxLength={60} autoComplete="off" disabled={disabled}
            aria-label={`งานย่อยข้อ ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addAfter(i); }
              else if (e.key === 'Backspace' && !v) { e.preventDefault(); remove(i); }
            }} />
          {!disabled && <button type="button" className="items-x" aria-label={`ลบงานย่อยข้อ ${i + 1}`} onClick={() => remove(i)}><Icon n="trash" /></button>}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="items-add" disabled={value.length >= max} onClick={() => addAfter(value.length - 1)}>
          <Icon n="plus" />{value.length >= max ? `ครบ ${max} ข้อแล้ว` : 'เพิ่มงานย่อย'}
        </button>
      )}
    </div>
  );
}
