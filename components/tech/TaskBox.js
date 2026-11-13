const LABEL = { todo: 'รอทำ', doing: 'กำลังทำ', done: 'เสร็จ' };

export function Icon({ n }) {
  return <svg className="ic" aria-hidden="true"><use href={`#i-${n}`} /></svg>;
}

// the shared icon symbols, referenced by <use>
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-camera" viewBox="0 0 24 24"><path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3v10.5h-17z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="12" cy="13.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></symbol>
      <symbol id="i-offline" viewBox="0 0 24 24"><path d="M3 9a14 14 0 0 1 4-2.4M21 9a14 14 0 0 0-8-3.9M6.5 12.8a9 9 0 0 1 3-1.8M17.5 12.8a9 9 0 0 0-1.6-1.2M10 16.5a4 4 0 0 1 4 0M4 4l16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></symbol>
      <symbol id="i-repeat" viewBox="0 0 24 24"><path d="M4 11V9a3 3 0 0 1 3-3h11M15 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H6M9 21l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-zoom" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M15 15l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></symbol>
      <symbol id="i-swap" viewBox="0 0 24 24"><path d="M7 4v13M3.5 13.5L7 17l3.5-3.5M17 20V7M13.5 10.5L17 7l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
    </svg>
  );
}

// the checklist: ticked only while the task is doing, read-only before (hint) and after
function Items({ t }) {
  const n = t.items.length, live = t.status === 'doing';
  return (
    <div className="items">
      <p className="items-h">{`งานย่อย ${n - t.items.filter((i) => !i.done).length}/${n}`}</p>
      {t.status !== 'done' && <ul>
        {t.items.map((i) => {
          const row = <><span className="cb">{i.done && <Icon n="check" />}</span><span className="it">{i.title}</span><span className="sw">{i.done ? 'ทำแล้ว' : 'ยังไม่ทำ'}</span></>;
          const cls = i.done ? 'row on' : 'row';
          return (
            <li key={i.id}>
              {live ? <button type="button" role="checkbox" aria-checked={i.done} aria-label={i.title} className={cls} data-item={i.id} data-task={t.id}>{row}</button>
                : <div className={cls}>{row}</div>}
            </li>
          );
        })}
      </ul>}
      {t.status === 'todo' && <p className="needtxt">เริ่มงาน (ถ่ายรูปก่อน) จึงจะติ๊กได้</p>}
    </div>
  );
}

// the photo as a button that opens the viewer; the badge says it can be enlarged
function Zoom({ t, kind, onZoom }) {
  return (
    <button type="button" className="zoom" aria-label={`ดูรูป${kind === 'before' ? 'ก่อนเริ่ม' : 'หลังเสร็จ'}ของ ${t.title} ขยาย`} onClick={() => onZoom(t.id, kind)}>
      <img className="shot" src={t[kind]} alt="" /><span className="mag" aria-hidden="true"><Icon n="zoom" /></span>
    </button>
  );
}

// from: the status the box just left (drives the unwipe animation); rev changes on every status change so the box remounts
export default function TaskBox({ t, from, rev, onZoom }) {
  const meta = <p className="meta">{`${t.time} · ${t.place}`}</p>;
  // a routine task, and a task given to someone covering for the regular technician
  const chips = (t.routine || t.coverFor) && (
    <span className="chips">
      {t.coverFor && <span className="chip cover"><Icon n="swap" />{`ทำแทน ${t.coverFor}`}</span>}
      {t.routine && <span className="chip"><Icon n="repeat" />งานประจำ</span>}
    </span>
  );
  // the times of the before and after photos; a missing part is left out
  const times = [t.beforeAt && `เริ่ม ${t.beforeAt}`, t.status === 'done' && t.afterAt && `เสร็จ ${t.afterAt}`].filter(Boolean).join(' · ');
  const clock = times && <p className="meta times">{times}</p>;
  const label = (ic) => <span className="st">{ic}{LABEL[t.status]}</span>;
  const items = t.items.length > 0 && <Items t={t} />;

  if (t.status === 'todo') {
    return (
      <li><article key={rev} className="box" data-state="todo" data-from={from}>
        <button type="button" className="main" data-start={t.id}>
          <h2>{t.title}</h2>{meta}{chips}<span className="cue"><Icon n="camera" />ถ่ายรูปก่อนเริ่ม</span>
        </button>{items}{label()}</article></li>
    );
  }
  if (t.status === 'doing') {
    // the finish track waits for every sub-task: a message takes its place, so no input can open the finish dialog early
    const left = t.items.filter((i) => !i.done).length;
    const fin = left ? <p className="gate">{`ติ๊กงานย่อยให้ครบก่อน · เหลือ ${left} ข้อ`}</p> : (
      <div className="track" data-id={t.id}><div className="fill"></div><span className="lbl">ปัดเพื่อถ่ายรูปหลัง</span>
        <button type="button" className="thumb" aria-label={`ถ่ายรูปหลังแล้วจบงาน ${t.title} (ลากไปทางขวา หรือกด Enter)`}><Icon n="chev" /></button></div>
    );
    // no before photo (its link could not be loaded): repair it here, and the finish track stays out of the way
    const body = t.before ? (
      <>
        <div className="tools"><Zoom t={t} kind="before" onZoom={onZoom} /><button type="button" className="photo" data-photo={t.id}><Icon n="camera" />ถ่ายรูปก่อนใหม่</button></div>
        {items}
        <div className="fin" aria-live="polite">{fin}</div>
      </>
    ) : (
      <>
        <div className="tools"><button type="button" className="photo need" data-photo={t.id}><Icon n="camera" />ถ่ายรูปก่อน</button></div>
        <p className="needtxt">ต้องมีรูปก่อนจึงจะจบงานได้</p>
        {items}
      </>
    );
    return (
      <li><article key={rev} className="box" data-state="doing" data-from={from}>
        <div className="band" aria-hidden="true"></div>
        <div className="doing-body">{label()}<h2>{t.title}</h2>{meta}{chips}{clock}{body}</div></article></li>
    );
  }
  return (
    <li><article key={rev} className="box" data-state="done" data-from={from}>{label(<Icon n="check" />)}
      <h2>{t.title}</h2>{meta}{chips}{clock}{items}{(t.before || t.after) && (
        <div className="pics">
          {[['before', 'ก่อน'], ['after', 'หลัง']].filter(([k]) => t[k]).map(([k, w]) => (
            <span key={k} className="pic"><Zoom t={t} kind={k} onZoom={onZoom} /><span className="cap">{w}<br />{t[k + 'At']}</span></span>
          ))}
        </div>
      )}{t.before && t.after && <span className="cue"><Icon n="camera" />รูปก่อน-หลังครบ</span>}</article></li>
  );
}
