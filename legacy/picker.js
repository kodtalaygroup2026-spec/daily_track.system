'use strict';
/* Calendar and dropdown that look like the rest of the app. The browser's own date picker and select list cannot be styled,
   so these replace them. The original <select> / <input type="date"> stays in the page, hidden, so forms and code that read
   .value or listen for "change" keep working.
   Pick.calendar(anchor, valueISO, onPick, {min, max, today})   Pick.selects(root)   Pick.dates(root) (inputs marked data-pick)   Pick.watch(el) */
const Pick = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const th = (d, o) => new Intl.DateTimeFormat('th-TH-u-ca-buddhist', o).format(d);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const svg = (d, w = 3) => `<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const I = { left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M6 9l6 6 6-6', tick: 'M4.5 12.5l5 5 10-11', cal: 'M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5' };
  const longDate = (s) => th(parse(s), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  // a hidden native control keeps working: reading .value, setting .value from code, and .focus() all reach the new button
  function hook(el, proto, sync, focusTarget) {
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(el, 'value', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
    el.focus = (o) => focusTarget.focus(o);
    el.classList.add('dd-native');
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
  }
  function labelText(el) {
    const lab = el.labels && el.labels[0];
    if (!lab) return '';
    const c = lab.cloneNode(true);
    c.querySelectorAll('select, input, .dd').forEach((n) => n.remove());
    return c.textContent.trim();
  }

  /* ---------------- calendar ---------------- */
  let cal = null;
  function closeCal(refocus) {
    if (!cal) return;
    const a = cal.anchor;
    cal.el.remove();
    document.removeEventListener('mousedown', cal.outside);
    removeEventListener('resize', cal.onResize);
    a.setAttribute('aria-expanded', 'false');
    cal = null;
    if (refocus) a.focus();
  }
  function drawCal() {
    const { y, m, value, min, max, todayIso } = cal;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const s = isoOf(dt);
      const cls = 'cd' + (dt.getMonth() !== m ? ' out' : '') + (s === value ? ' sel' : '') + (s === todayIso ? ' now' : '');
      cells += `<button type="button" class="${cls}" data-d="${s}" tabindex="${s === cal.focus ? 0 : -1}"${s < min || s > max ? ' disabled' : ''}`
        + `${s === value ? ' aria-pressed="true"' : ''}${s === todayIso ? ' aria-current="date"' : ''}`
        + ` aria-label="${th(dt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}">${dt.getDate()}</button>`;
    }
    cal.el.innerHTML = `<div class="ch"><button type="button" class="cn" data-m="-1" aria-label="เดือนก่อนหน้า">${svg(I.left)}</button>`
      + `<div class="ct" aria-live="polite">${th(first, { month: 'long', year: 'numeric' })}</div>`
      + `<button type="button" class="cn" data-m="1" aria-label="เดือนถัดไป">${svg(I.right)}</button></div>`
      + `<div class="cw" aria-hidden="true">${WD.map((w) => `<span>${w}</span>`).join('')}</div><div class="cg">${cells}</div>`
      + `<div class="cf"><button type="button" class="cb" data-today>วันนี้</button><button type="button" class="cb" data-close>ปิด</button></div>`;
  }
  function placeCal() {
    const r = cal.anchor.getBoundingClientRect(), c = cal.el.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + c.height > innerHeight - 8 && r.top - c.height - 8 > 8) top = r.top - c.height - 8; // not enough room below: open upward
    const left = Math.max(8, Math.min(r.right - c.width, innerWidth - c.width - 8));
    cal.el.style.left = left + scrollX + 'px';
    cal.el.style.top = top + scrollY + 'px';
  }
  function focusDay(dt) {
    const s = isoOf(dt);
    if (s < cal.min || s > cal.max) return;
    Object.assign(cal, { focus: s, y: dt.getFullYear(), m: dt.getMonth() });
    drawCal();
    cal.el.querySelector(`[data-d="${s}"]`).focus({ preventScroll: true });
  }
  function shiftMonth(dt, n) { // same day number in another month, clamped to that month's last day
    const last = new Date(dt.getFullYear(), dt.getMonth() + n + 1, 0).getDate();
    return new Date(dt.getFullYear(), dt.getMonth() + n, Math.min(dt.getDate(), last));
  }
  function pickDay(s) {
    const cb = cal.onPick;
    closeCal(true);
    cb(s);
  }
  function calendar(anchor, value, onPick, opt) {
    if (cal) { const same = cal.anchor === anchor; closeCal(); if (same) return; }
    const min = opt.min || '2000-01-01', max = opt.max || '2099-12-31';
    const v = value && value >= min && value <= max ? value : opt.today;
    const d = parse(v);
    const el = document.createElement('div');
    el.className = 'cal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'เลือกวันที่');
    document.body.appendChild(el);
    cal = { anchor, el, value: v, onPick, y: d.getFullYear(), m: d.getMonth(), focus: v, min, max, todayIso: opt.today };
    cal.outside = (e) => { if (cal && !cal.el.contains(e.target) && !cal.anchor.contains(e.target)) closeCal(); };
    document.addEventListener('mousedown', cal.outside);
    cal.onResize = () => closeCal();
    addEventListener('resize', cal.onResize);
    anchor.setAttribute('aria-expanded', 'true');
    drawCal();
    placeCal();
    el.querySelector(`[data-d="${v}"]`).focus({ preventScroll: true });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.d) return pickDay(b.dataset.d);
      if (b.dataset.m) {
        const n = Number(b.dataset.m), t = shiftMonth(parse(cal.focus), n);
        Object.assign(cal, { focus: isoOf(t), y: t.getFullYear(), m: t.getMonth() });
        drawCal();
        el.querySelector(`[data-m="${n}"]`).focus({ preventScroll: true });
      } else if ('today' in b.dataset) { if (cal.todayIso >= cal.min && cal.todayIso <= cal.max) pickDay(cal.todayIso); }
      else if ('close' in b.dataset) closeCal(true);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return closeCal(true); }
      if (!e.target.dataset.d) return;
      const f = parse(cal.focus);
      const to = { ArrowLeft: new Date(f.getFullYear(), f.getMonth(), f.getDate() - 1), ArrowRight: new Date(f.getFullYear(), f.getMonth(), f.getDate() + 1),
        ArrowUp: new Date(f.getFullYear(), f.getMonth(), f.getDate() - 7), ArrowDown: new Date(f.getFullYear(), f.getMonth(), f.getDate() + 7),
        PageUp: shiftMonth(f, -1), PageDown: shiftMonth(f, 1),
        Home: new Date(f.getFullYear(), f.getMonth(), f.getDate() - f.getDay()), End: new Date(f.getFullYear(), f.getMonth(), f.getDate() + 6 - f.getDay()) }[e.key];
      if (to) { e.preventDefault(); focusDay(to); }
    });
    // leaving the calendar with Tab closes it; redrawing it (which drops focus for a moment) must not
    el.addEventListener('focusout', () => setTimeout(() => { if (cal && !cal.el.contains(document.activeElement)) closeCal(); }, 0));
  }

  /* a date field: shows the Thai date on a button and opens the calendar */
  function dates(root) {
    root.querySelectorAll('input[type="date"][data-pick]:not([data-ok])').forEach((inp) => {
      inp.dataset.ok = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ddb';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.disabled = inp.disabled;
      if (inp.getAttribute('aria-invalid')) btn.setAttribute('aria-invalid', 'true');
      if (inp.getAttribute('aria-describedby')) btn.setAttribute('aria-describedby', inp.getAttribute('aria-describedby'));
      const lab = labelText(inp);
      const sync = () => {
        const txt = inp.value ? longDate(inp.value) : 'เลือกวันที่';
        btn.innerHTML = `<span class="ddv">${esc(txt)}</span>${svg(I.cal, 2.4)}`;
        btn.setAttribute('aria-label', (lab ? lab + ': ' : '') + txt);
      };
      inp.after(btn);
      const hadFocus = document.activeElement === inp; // code focused the field just before it was upgraded (validation error)
      hook(inp, HTMLInputElement.prototype, sync, btn);
      sync();
      if (hadFocus) btn.focus();
      btn.addEventListener('click', () => calendar(btn, inp.value, (s) => { inp.value = s; inp.dispatchEvent(new Event('change', { bubbles: true })); },
        { min: inp.min, max: inp.max, today: isoOf(new Date()) }));
    });
  }

  /* ---------------- dropdown ---------------- */
  let open = null;
  function closeDD(refocus) {
    if (!open) return;
    const { btn, ul } = open;
    ul.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    open = null;
    if (refocus) btn.focus();
  }
  document.addEventListener('mousedown', (e) => { if (open && !open.wrap.contains(e.target)) closeDD(); });

  function selects(root) {
    root.querySelectorAll('select:not([data-ok])').forEach((sel) => {
      sel.dataset.ok = '1';
      const wrap = document.createElement('div');
      wrap.className = 'dd';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ddb';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.disabled = sel.disabled;
      if (sel.getAttribute('aria-invalid')) btn.setAttribute('aria-invalid', 'true');
      if (sel.getAttribute('aria-describedby')) btn.setAttribute('aria-describedby', sel.getAttribute('aria-describedby'));
      const ul = document.createElement('ul');
      ul.className = 'ddl';
      ul.setAttribute('role', 'listbox');
      ul.hidden = true;
      const lab = labelText(sel);

      const sync = () => {
        const o = sel.options[sel.selectedIndex], txt = o ? o.textContent : '';
        btn.innerHTML = `<span class="ddv">${esc(txt)}</span>${svg(I.down)}`;
        btn.setAttribute('aria-label', (lab ? lab + ': ' : '') + txt);
        ul.querySelectorAll('li').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.v === sel.value)));
      };
      ul.innerHTML = [...sel.options].map((o) => `<li role="option" tabindex="-1" data-v="${esc(o.value)}" aria-selected="false">${svg(I.tick)}<span>${esc(o.textContent)}</span></li>`).join('');
      sel.after(wrap);
      wrap.append(btn, ul);
      const hadFocus = document.activeElement === sel; // code focused the field just before it was upgraded (validation error)
      hook(sel, HTMLSelectElement.prototype, sync, btn);
      sync();
      if (hadFocus) btn.focus();

      const items = () => [...ul.querySelectorAll('li')];
      const openList = () => {
        if (btn.disabled) return;
        closeDD();
        ul.hidden = false;
        ul.classList.remove('up');
        const r = ul.getBoundingClientRect();
        if (r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top - r.height - 8 > 8) ul.classList.add('up'); // no room below: open upward
        btn.setAttribute('aria-expanded', 'true');
        open = { btn, ul, wrap };
        (items().find((li) => li.dataset.v === sel.value) || items()[0]).focus({ preventScroll: false });
      };
      const choose = (li) => {
        const changed = sel.value !== li.dataset.v;
        sel.value = li.dataset.v;
        closeDD(true);
        if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
      };
      btn.addEventListener('click', () => (open && open.btn === btn ? closeDD() : openList()));
      btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(); } });
      ul.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) choose(li); });
      ul.addEventListener('keydown', (e) => {
        const li = e.target.closest('li'), all = items(), i = all.indexOf(li);
        const go = { ArrowDown: all[Math.min(i + 1, all.length - 1)], ArrowUp: all[Math.max(i - 1, 0)], Home: all[0], End: all[all.length - 1] }[e.key];
        if (go) { e.preventDefault(); go.focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (li) choose(li); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDD(true); }
        else if (e.key === 'Tab') closeDD();
      });
    });
  }

  // a container whose contents are rebuilt (the drawer form) gets its controls upgraded again
  function watch(el) {
    new MutationObserver(() => { selects(el); dates(el); }).observe(el, { childList: true });
    selects(el);
    dates(el);
  }
  return { calendar, selects, dates, watch };
})();
