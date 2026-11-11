'use client';
import { useEffect, useRef } from 'react';
import { photoURI } from '@/lib/sup-store';
import { NAMES, emptyText, slot } from './ui';

// mounted only while open; the native dialog supplies the modal focus trap and Escape
export default function Lightbox({ task: t, onClose }) {
  const dlg = useRef(null);
  useEffect(() => { if (!dlg.current.open) dlg.current.showModal(); }, []);
  const fig = (k) => {
    const s = slot(t, k);
    return (
      <figure>
        <figcaption>{NAMES[k]}{t[k + 'At'] ? ' · ' + t[k + 'At'] : ''}</figcaption>
        {s === 'ok'
          ? <img src={photoURI(t[k])} alt={`รูปตัวอย่าง${NAMES[k]} ${t.title}`} />
          : <div className={'noimg' + (s === 'miss' ? ' miss' : '')}>{emptyText(t, k)}</div>}
      </figure>
    );
  };
  return (
    <dialog id="lightbox" ref={dlg} aria-labelledby="lbCap" onClose={onClose}>
      <p id="lbCap">{`รูปตัวอย่าง · ${t.title} · ${t.tech}`}</p>
      <div id="lbBody"><div className="pair-lb">{fig('before')}{fig('after')}</div></div>
      <button type="button" id="lbClose" className="primary" onClick={() => dlg.current.close()}>ปิด</button>
    </dialog>
  );
}
