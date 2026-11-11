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
    </svg>
  );
}

// from: the status the box just left (drives the unwipe animation); rev changes on every status change so the box remounts
export default function TaskBox({ t, from, rev }) {
  const meta = <p className="meta">{`${t.time} · ${t.place}`}</p>;
  const label = (ic) => <span className="st">{ic}{LABEL[t.status]}</span>;

  if (t.status === 'todo') {
    return (
      <li><article key={rev} className="box" data-state="todo" data-from={from}>
        <button type="button" className="main" data-start={t.id}>
          <h2>{t.title}</h2>{meta}<span className="cue"><Icon n="camera" />ถ่ายรูปก่อนเริ่ม</span>
        </button>{label()}</article></li>
    );
  }
  if (t.status === 'doing') {
    // no before photo (lost from storage): repair it here, and the finish track stays out of the way
    const body = t.before ? (
      <>
        <div className="tools"><img className="shot" src={t.before} alt={`รูปก่อนเริ่ม ${t.title}`} /><button type="button" className="photo" data-photo={t.id}><Icon n="camera" />ถ่ายรูปก่อนใหม่</button></div>
        <div className="track" data-id={t.id}><div className="fill"></div><span className="lbl">ปัดเพื่อถ่ายรูปหลัง</span>
          <button type="button" className="thumb" aria-label={`ถ่ายรูปหลังแล้วจบงาน ${t.title} (ลากไปทางขวา หรือกด Enter)`}><Icon n="chev" /></button></div>
      </>
    ) : (
      <>
        <div className="tools"><button type="button" className="photo need" data-photo={t.id}><Icon n="camera" />ถ่ายรูปก่อน</button></div>
        <p className="needtxt">ต้องมีรูปก่อนจึงจะจบงานได้</p>
      </>
    );
    return (
      <li><article key={rev} className="box" data-state="doing" data-from={from}>
        <div className="band" aria-hidden="true"></div>
        <div className="doing-body">{label()}<h2>{t.title}</h2>{meta}{body}</div></article></li>
    );
  }
  return (
    <li><article key={rev} className="box" data-state="done" data-from={from}>{label(<Icon n="check" />)}
      <h2>{t.title}</h2>{meta}{t.before && t.after && <span className="cue"><Icon n="camera" />รูปก่อน-หลังครบ</span>}</article></li>
  );
}
