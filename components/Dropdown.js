'use client';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { I, Icon } from './pick-utils';

// only one list is open at a time: opening another closes this one without moving focus
let closeOther = null;

const Dropdown = forwardRef(function Dropdown({ id, label, value, onChange, options, disabled, invalid, describedBy, className }, ref) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const ul = useRef(null);
  const wrap = useRef(null);
  useImperativeHandle(ref, () => btn.current, []);

  const txt = (options.find((o) => o.value === value) || { label: '' }).label;
  const items = () => [...ul.current.querySelectorAll('li')];

  const close = (refocus) => { setOpen(false); if (refocus) btn.current.focus(); };
  const choose = (v) => {
    close(true);
    if (v !== value) onChange(v);
  };

  // the Escape listener is native and lives on the list so it stops the event before any surrounding drawer (React or DOM) sees it
  useLayoutEffect(() => {
    if (!open) return;
    const list = ul.current;
    // measured with the "up" class removed, then set directly so focus below lands on the final position
    list.classList.remove('up');
    const r = list.getBoundingClientRect();
    // inside the task box the list is clipped by the box's scrolling body, not by the window
    const box = list.closest('.tm-body');
    const lo = box ? Math.max(8, box.getBoundingClientRect().top) : 8;
    const hi = box ? Math.min(innerHeight, box.getBoundingClientRect().bottom) : innerHeight;
    if (r.bottom > hi - 8 && btn.current.getBoundingClientRect().top - r.height - 8 > lo) list.classList.add('up');
    const all = items();
    (all.find((li) => li.dataset.v === value) || all[0]).focus();

    const me = () => setOpen(false);
    if (closeOther) closeOther();
    closeOther = me;
    // a click on this field's own label is forwarded to the button, which toggles the list shut: do not close it twice
    const outside = (e) => { if (!wrap.current.contains(e.target) && !(id && e.target.closest && e.target.closest(`label[for="${id}"]`))) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } };
    document.addEventListener('mousedown', outside);
    list.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      list.removeEventListener('keydown', esc);
      if (closeOther === me) closeOther = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is positioned and focused once per opening, not when the value changes
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const onListKey = (e) => {
    const li = e.target.closest('li'), all = items(), i = all.indexOf(li);
    const go = { ArrowDown: all[Math.min(i + 1, all.length - 1)], ArrowUp: all[Math.max(i - 1, 0)], Home: all[0], End: all[all.length - 1] }[e.key];
    if (go) { e.preventDefault(); go.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (li) choose(li.dataset.v); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div className={className ? `dd ${className}` : 'dd'} ref={wrap}>
      <button
        type="button" id={id} ref={btn} className="ddb"
        aria-haspopup="listbox" aria-expanded={open}
        aria-label={(label ? label + ': ' : '') + txt}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((o) => !o && !disabled)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!disabled) setOpen(true); } }}
      >
        <span className="ddv">{txt}</span>
        <Icon d={I.down} />
      </button>
      <ul className="ddl" role="listbox" hidden={!open} ref={ul} onKeyDown={onListKey}
        onClick={(e) => { const li = e.target.closest('li'); if (li) choose(li.dataset.v); }}>
        {options.map((o) => (
          <li key={o.value} role="option" tabIndex={-1} data-v={o.value} aria-selected={o.value === value}>
            <Icon d={I.tick} />
            <span>{o.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default Dropdown;
