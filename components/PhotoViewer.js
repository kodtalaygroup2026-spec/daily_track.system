'use client';
import { useEffect, useId, useRef, useState } from 'react';
import '@/app/styles/photo-viewer.css';

// Shared full-screen photo viewer (technician page and supervisor check).
// photos: [{ key, label, src | null, alt, note }]; a null src shows its note in the pane instead of an image.
// The picture is fitted by CSS (object-fit: contain); zoom and pan are one transform kept in a ref, so a drag never re-renders.
const MAX = 6, STEP = 1.5, DOUBLE = 2.5;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function Ic({ d }) {
  return <svg className="pv-ic" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function PhotoViewer({ photos, index = 0, title, subtitle, onClose }) {
  const [i, setI] = useState(index);
  const [pct, setPct] = useState(100);
  const [said, setSaid] = useState('100%'); // the screen-reader copy of pct, settled so a pinch does not read out every step
  const [failed, setFailed] = useState(''); // src that could not load
  const dlg = useRef(null), closeBtn = useRef(null), stage = useRef(null), img = useRef(null);
  const v = useRef({ s: 1, x: 0, y: 0 }); // x, y: translation from the centred, fitted picture
  const ptrs = useRef(new Map()); // pointer id -> { x, y, sx, sy }, coordinates from the stage centre
  const grip = useRef(null); // what the pointers are doing now: a pan or a pinch, anchored at the moment the pointer count last changed
  const tapOk = useRef(false), lastTap = useRef(null), saidTimer = useRef(0);
  const titleId = useId();
  const cur = photos[Math.min(i, photos.length - 1)];
  const shown = !!cur.src && failed !== cur.src;

  // the fitted picture's size sets how far it may be dragged; before it has decoded the stage stands in
  function set(s, x, y) {
    const el = img.current, w = stage.current.clientWidth, h = stage.current.clientHeight;
    const k = el && el.naturalWidth ? Math.min(w / el.naturalWidth, h / el.naturalHeight) : 0;
    const fw = k ? el.naturalWidth * k : w, fh = k ? el.naturalHeight * k : h;
    s = clamp(s, 1, MAX);
    const mx = Math.max(0, (fw * s - w) / 2), my = Math.max(0, (fh * s - h) / 2); // never any empty margin once zoomed
    v.current = { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
    if (el) el.style.transform = `translate(${v.current.x}px, ${v.current.y}px) scale(${s})`;
    const p = Math.round(s * 100);
    setPct(p);
    clearTimeout(saidTimer.current);
    saidTimer.current = setTimeout(() => setSaid(p + '%'), 400);
  }
  // zoom to s keeping the picture point under (cx, cy) fixed; the point is measured from the stage centre
  function zoomTo(s, cx = 0, cy = 0) {
    if (!img.current) return;
    const { s: s0, x, y } = v.current, r = clamp(s, 1, MAX) / s0;
    set(s, cx - (cx - x) * r, cy - (cy - y) * r);
  }
  const rel = (e) => {
    const r = stage.current.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  // re-anchor whenever the number of pointers changes, so two fingers becoming one carries on as a pan without a jump
  function rebase() {
    const [a, b] = [...ptrs.current.values()], { s, x, y } = v.current;
    if (!a) grip.current = null;
    else if (!b) grip.current = { x0: a.x, y0: a.y, x, y };
    else grip.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: s, px: ((a.x + b.x) / 2 - x) / s, py: ((a.y + b.y) / 2 - y) / s };
  }
  function down(e) {
    if (!img.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try { stage.current.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    const p = rel(e);
    ptrs.current.set(e.pointerId, { ...p, sx: p.x, sy: p.y });
    tapOk.current = ptrs.current.size === 1;
    stage.current.dataset.live = '1'; // no easing while a finger or the mouse is driving
    rebase();
  }
  function move(e) {
    const p = ptrs.current.get(e.pointerId), a = grip.current;
    if (!p || !a) return;
    Object.assign(p, rel(e));
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) tapOk.current = false;
    if (a.d0 === undefined) return set(v.current.s, a.x + p.x - a.x0, a.y + p.y - a.y0);
    const [p1, p2] = [...ptrs.current.values()];
    const s = clamp((a.s0 * Math.hypot(p1.x - p2.x, p1.y - p2.y)) / a.d0, 1, MAX);
    set(s, (p1.x + p2.x) / 2 - a.px * s, (p1.y + p2.y) / 2 - a.py * s);
  }
  // pointerup, pointercancel and a lost capture all end here; only a real pointerup can be a tap
  function up(e) {
    const p = ptrs.current.get(e.pointerId);
    if (!p) return;
    ptrs.current.delete(e.pointerId);
    if (e.type === 'pointerup' && tapOk.current && !ptrs.current.size) {
      const now = Date.now(), l = lastTap.current;
      if (l && now - l.t < 350 && Math.hypot(p.x - l.x, p.y - l.y) < 30) { // second tap: fit <-> 2.5x around the point
        lastTap.current = null;
        zoomTo(v.current.s > 1.05 ? 1 : DOUBLE, p.x, p.y);
      } else lastTap.current = { t: now, x: p.x, y: p.y };
    }
    if (!ptrs.current.size) delete stage.current.dataset.live;
    rebase();
  }
  function wheel(e) {
    if (!img.current) return;
    e.preventDefault(); // added natively below: React's wheel listener is passive and could not stop the page
    const p = rel(e);
    zoomTo(v.current.s * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  }
  function key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !img.current) return;
    const { s, x, y } = v.current, d = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[e.key];
    if (e.key === '+' || e.key === '=') zoomTo(s * STEP);
    else if (e.key === '-' || e.key === '_') zoomTo(s / STEP);
    else if (e.key === '0') zoomTo(1);
    else if (d && s > 1) set(s, x + d[0], y + d[1]); // arrows scroll the view, like a page
    else return;
    e.preventDefault();
  }

  useEffect(() => { if (!dlg.current.open) dlg.current.showModal(); closeBtn.current.focus(); }, []);
  // a new photo or a resized stage starts again at fit
  useEffect(() => { set(1, 0, 0); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps -- set only uses refs and setters
  useEffect(() => {
    const el = stage.current, ro = new ResizeObserver(() => set(1, 0, 0));
    ro.observe(el);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); clearTimeout(saidTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the handlers only use refs and setters

  const zbtn = (label, icon, off, run) => (
    <button type="button" className="pv-btn" aria-disabled={off || !shown} onClick={run}><Ic d={icon} />{label}</button>
  ); // aria-disabled, not disabled: a disabled button would drop the keyboard focus

  return (
    <dialog ref={dlg} className="pv" aria-labelledby={titleId} onKeyDown={key} onClose={() => { ptrs.current.clear(); onClose(); }}>
      <header className="pv-head">
        <div className="pv-ttl"><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button ref={closeBtn} type="button" className="pv-btn" onClick={() => dlg.current.close()}><Ic d="M5 5l14 14M19 5L5 19" />ปิด</button>
      </header>
      {photos.length > 1 && (
        <div className="pv-seg" role="group" aria-label="เลือกรูป">
          {photos.map((p, n) => (
            <button key={p.key} type="button" className="pv-btn" aria-pressed={n === i} onClick={() => setI(n)}>
              {n === i && <Ic d="M4.5 12.5l5 5 10-11" />}{p.label}
            </button>
          ))}
        </div>
      )}
      <div className="pv-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
        {shown
          ? <img key={cur.key} ref={img} className="pv-img" src={cur.src} alt={cur.alt} draggable={false} onError={() => setFailed(cur.src)} />
          : <p className="pv-note">{cur.src ? 'โหลดรูปไม่ได้ ลองปิดแล้วเปิดใหม่' : cur.note || 'ไม่มีรูป'}</p>}
        {shown && <output className="pv-pct" aria-hidden="true">{pct}%</output>}
      </div>
      <div className="pv-bar" role="group" aria-label="ซูมรูป">
        {zbtn('ซูมออก', 'M5 12h14', pct <= 100, () => zoomTo(v.current.s / STEP))}
        {zbtn('ซูมเข้า', 'M12 5v14M5 12h14', pct >= MAX * 100, () => zoomTo(v.current.s * STEP))}
        {zbtn('พอดีจอ', 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', pct === 100, () => zoomTo(1))}
        <span className="pv-sr" role="status" aria-live="polite">{`ซูม ${said}`}</span>
      </div>
    </dialog>
  );
}
