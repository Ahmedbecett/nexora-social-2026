import { useEffect, useRef, useState } from 'react';
import { api, uploadMedia } from '../api.js';
import { t, errText } from '../i18n.js';
import { useApp, Avatar, TopBar, Spinner } from '../components.jsx';
import { IClose, IImage, ILocation, IMusic, IChevron, ISend, IStar } from '../icons.jsx';

/* Instagram-style photo filters, baked into the image before upload */
export const FILTERS = [
  ['Normal', ''],
  ['Clarendon', 'contrast(1.2) saturate(1.35)'],
  ['Gingham', 'brightness(1.05) hue-rotate(-10deg) contrast(0.9) sepia(0.04)'],
  ['Moon', 'grayscale(1) contrast(1.1) brightness(1.1)'],
  ['Lark', 'contrast(0.9) brightness(1.08) saturate(1.1)'],
  ['Reyes', 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)'],
  ['Juno', 'saturate(1.4) contrast(1.15) sepia(0.12) hue-rotate(-8deg)'],
  ['Slumber', 'saturate(0.66) brightness(1.05) sepia(0.15)'],
  ['Crema', 'sepia(0.25) contrast(0.9) brightness(1.05) saturate(0.9)'],
  ['Ludwig', 'contrast(1.05) saturate(1.2) brightness(1.05)'],
  ['Aden', 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)'],
  ['Perpetua', 'contrast(1.1) brightness(1.25) saturate(1.1)'],
  ['Inkwell', 'sepia(0.3) contrast(1.1) brightness(1.1) grayscale(1)'],
];
const ADJ = ['brightness', 'contrast', 'saturation', 'warmth'];
const ADJ0 = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
export function cssFilter(f) {
  if (!f) return '';
  const base = FILTERS.find((x) => x[0] === f.filter)?.[1] || '';
  const a = f.adj || ADJ0;
  const parts = [base];
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness / 200).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast / 200).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${(1 + a.saturation / 100).toFixed(3)})`);
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 250).toFixed(3)}) saturate(${(1 + a.warmth / 400).toFixed(3)})`);
  if (a.warmth < 0) parts.push(`hue-rotate(${(a.warmth * -0.18).toFixed(1)}deg) saturate(${(1 + a.warmth / 500).toFixed(3)})`);
  return parts.filter(Boolean).join(' ');
}
async function bakeFilter(f) {
  const css = cssFilter(f);
  if (f.type !== 'image' || !css) return f.file;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = f.url; });
    const scale = Math.min(1, 2160 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    if (!('filter' in ctx)) return f.file;
    ctx.filter = css;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : f.file;
  } catch { return f.file; }
}

function FilterStrip({ f, onPick, dark }) {
  return (
    <div className={`filter-strip ${dark ? 'dark' : ''}`}>
      {FILTERS.map(([name]) => (
        <button key={name} className={`filter-item ${(f.filter || 'Normal') === name ? 'on' : ''}`} onClick={() => onPick(name)}>
          <span>{name}</span>
          <img src={f.url} alt="" draggable={false} style={{ filter: cssFilter({ filter: name }) }} />
        </button>
      ))}
    </div>
  );
}

function EditStep({ files, setFiles, title, onBack, onNext }) {
  const [idx, setIdx] = useState(() => Math.max(0, files.findIndex((f) => f.type === 'image')));
  const [tab, setTab] = useState('filter');
  const [adjKey, setAdjKey] = useState(null);
  const f = files[idx];
  const update = (patch) => setFiles((list) => list.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const adj = f.adj || ADJ0;
  return (
    <div className="screen create edit-step">
      <TopBar title={title} onBack={onBack} right={<button className="text-link strong" onClick={onNext}>{t('next')}</button>} />
      <div className="edit-preview">
        {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted />
          : <img src={f.url} alt="" draggable={false} style={{ filter: cssFilter(f) }} />}
      </div>
      {files.length > 1 && (
        <div className="edit-thumbs">
          {files.map((x, i) => (
            <button key={i} className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setAdjKey(null); }}>
              {x.type === 'video' ? <video disableRemotePlayback src={x.url} muted playsInline /> : <img src={x.url} alt="" style={{ filter: cssFilter(x) }} />}
            </button>
          ))}
        </div>
      )}
      <div className="edit-tools">
        {f.type !== 'image' ? <div className="edit-novideo muted">{t('filtersPhotosOnly')}</div>
          : tab === 'filter' ? <FilterStrip f={f} onPick={(name) => update({ filter: name })} />
            : adjKey ? (
              <div className="adj-slider">
                <div className="adj-head"><b>{t('adj_' + adjKey)}</b><span>{adj[adjKey] > 0 ? '+' : ''}{adj[adjKey]}</span></div>
                <input type="range" min={-100} max={100} step={1} value={adj[adjKey]}
                  onChange={(e) => update({ adj: { ...adj, [adjKey]: Number(e.target.value) } })} />
                <div className="adj-btns">
                  <button onClick={() => update({ adj: { ...adj, [adjKey]: 0 } })}>{t('reset')}</button>
                  <button className="strong" onClick={() => setAdjKey(null)}>{t('done')}</button>
                </div>
              </div>
            ) : (
              <div className="adj-list">
                {ADJ.map((k) => (
                  <button key={k} onClick={() => setAdjKey(k)} className={adj[k] ? 'set' : ''}>
                    <span className="adj-ico">{{ brightness: '☀', contrast: '◐', saturation: '◉', warmth: '🌡' }[k]}</span>
                    <span>{t('adj_' + k)}</span>
                    {adj[k] ? <small>{adj[k] > 0 ? '+' : ''}{adj[k]}</small> : null}
                  </button>
                ))}
              </div>
            )}
      </div>
      {f.type === 'image' && (
        <div className="edit-tabs">
          <button className={tab === 'filter' ? 'on' : ''} onClick={() => { setTab('filter'); setAdjKey(null); }}>{t('filterTab')}</button>
          <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>{t('editTab')}</button>
        </div>
      )}
    </div>
  );
}

export default function Create({ mode: initialMode = 'post' }) {
  const { me, nav, toast } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [files, setFiles] = useState([]); // {file, url, type}
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [audio, setAudio] = useState('');
  const [alsoStory, setAlsoStory] = useState(false);
  const [busy, setBusy] = useState(false);
  const audienceRef = useRef('all');
  const [progress, setProgress] = useState(0);
  const [locOpen, setLocOpen] = useState(false);
  const inputRef = useRef();
  const [step, setStep] = useState('edit');

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []); // eslint-disable-line

  const accept = mode === 'reel' ? 'video/*' : 'image/*,video/*';
  const onPick = (e) => {
    const list = [...(e.target.files || [])];
    e.target.value = '';
    if (!list.length) return;
    let chosen = list.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (mode === 'reel') chosen = chosen.filter((f) => f.type.startsWith('video/')).slice(0, 1);
    if (mode === 'story') chosen = chosen.slice(0, 1);
    if (mode === 'post') chosen = chosen.slice(0, 10);
    if (!chosen.length) { toast(mode === 'reel' ? t('reelNeedsVideo') : errText('unsupported_type')); return; }
    const big = chosen.find((f) => f.size > (f.type.startsWith('video/') ? 100 : 15) * 1024 * 1024);
    if (big) { toast('Max: 100MB video / 15MB image'); return; }
    setFiles(chosen.map((file) => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image', filter: 'Normal', adj: ADJ0 })));
    setStep('edit');
  };

  const share = async () => {
    if (!files.length || busy) return;
    setBusy(true); setProgress(0);
    try {
      const media = [];
      for (let i = 0; i < files.length; i++) {
        const file = await bakeFilter(files[i]);
        const m = await uploadMedia(file, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
        media.push(m);
      }
      if (mode === 'story') {
        await api('stories', { method: 'POST', body: { url: media[0].url, type: media[0].type, audience: audienceRef.current } });
      } else {
        await api('posts', { method: 'POST', body: { kind: mode === 'reel' ? 'reel' : 'post', media, caption, location, audio, alsoStory } });
      }
      toast(t('posted'));
      window.dispatchEvent(new Event('nx-posted'));
      nav.pop();
    } catch (e) {
      toast(errText(e.code || 'server_error'));
    }
    setBusy(false);
  };

  const switchMode = (m) => { if (busy) return; setMode(m); setFiles([]); };
  const title = mode === 'story' ? t('newStory') : mode === 'reel' ? t('newReel') : t('newPost');

  const modeBar = (
    <div className="mode-bar">
      {['post', 'story', 'reel'].map((m) => (
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>{t(m + 'Tab')}</button>
      ))}
    </div>
  );

  if (!files.length) {
    return (
      <div className="screen create">
        <TopBar title={title} left={<button className="icon-btn" onClick={nav.pop}><IClose size={26} /></button>} />
        <div className="picker" onClick={() => inputRef.current?.click()}>
          <div className="picker-icon"><IImage size={64} sw={1.3} /></div>
          <h3>{t('selectMedia')}</h3>
          <button className="btn btn-primary">{t('selectFromGallery')}</button>
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple={mode === 'post'} hidden onChange={onPick} />
        {modeBar}
      </div>
    );
  }

  if (mode === 'story') {
    const f = files[0];
    return (
      <div className="screen story-compose">
        <div className="story-preview">{f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" style={{ filter: cssFilter(f) }} />}</div>
        {f.type === 'image' && !busy && <FilterStrip dark f={f} onPick={(name) => setFiles([{ ...f, filter: name }])} />}
        <button className="icon-btn light story-x" onClick={() => setFiles([])}><IClose size={28} /></button>
        <div className="story-share-bar">
          <button className="story-share-btn" onClick={() => { audienceRef.current = 'all'; share(); }} disabled={busy}>
            <Avatar src={me.avatarUrl} name={me.username} size={26} /><span>{t('yourStory')}</span>
          </button>
          <button className="story-share-btn close" onClick={() => { audienceRef.current = 'close'; share(); }} disabled={busy}>
            <span className="cf-star"><IStar size={14} filled /></span><span>{t('closeFriends')}</span>
          </button>
          <button className="story-send" onClick={() => { audienceRef.current = 'all'; share(); }} disabled={busy}>{busy ? <Spinner size={20} /> : <ISend size={20} />}</button>
        </div>
        {busy && <UploadOverlay progress={progress} />}
      </div>
    );
  }

  if (step === 'edit' && files.some((x) => x.type === 'image')) {
    return <EditStep files={files} setFiles={setFiles} title={title} onBack={() => setFiles([])} onNext={() => setStep('details')} />;
  }

  return (
    <div className="screen create">
      <TopBar title={title} onBack={() => (files.some((x) => x.type === 'image') ? setStep('edit') : setFiles([]))}
        right={busy ? <Spinner size={20} /> : <button className="text-link strong" onClick={share}>{t('share')}</button>} />
      <div className="scroll">
        <div className="compose-preview">
          {files.map((f, i) => (
            <div className={`compose-item ${mode === 'reel' ? 'reel' : ''}`} key={i}>
              {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" style={{ filter: cssFilter(f) }} />}
            </div>
          ))}
          {mode === 'post' && files.length < 10 && (
            <button className="compose-add" onClick={() => inputRef.current?.click()}>+</button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple={mode === 'post'} hidden
          onChange={(e) => { const prev = files; onPick(e); if (mode === 'post') setFiles((nf) => nf === prev ? nf : [...prev, ...nf].slice(0, 10)); }} />
        <div className="compose-caption">
          <Avatar src={me.avatarUrl} name={me.username} size={36} />
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('writeCaption')} rows={4} dir="auto" maxLength={2200} />
        </div>
        <div className="option-list">
          <button className="option" onClick={() => setLocOpen(!locOpen)}>
            <ILocation size={22} /><span className="flex1">{location || t('addLocation')}</span><IChevron size={18} />
          </button>
          {locOpen && (
            <div className="option-input">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('addLocation')} dir="auto" maxLength={80} autoFocus />
              <div className="chips">
                {['Algiers, Algeria', 'Oran, Algeria', 'Constantine, Algeria', 'Tipaza, Algeria', 'Djanet, Algeria'].map((l) => <button key={l} onClick={() => { setLocation(l); setLocOpen(false); }}>{l}</button>)}
              </div>
            </div>
          )}
          {mode === 'reel' && (
            <div className="option">
              <IMusic size={22} /><input className="flex1 bare" value={audio} onChange={(e) => setAudio(e.target.value)} placeholder={t('addAudio')} dir="auto" maxLength={80} />
            </div>
          )}
          <div className="option-head">{t('alsoPostTo')}</div>
          <label className="option">
            <span className="flex1">{t('story')}</span>
            <span className={`switch ${alsoStory ? 'on' : ''}`}><input type="checkbox" checked={alsoStory} onChange={(e) => setAlsoStory(e.target.checked)} /></span>
          </label>
        </div>
        <div className="pad"><button className="btn btn-primary btn-lg btn-block" onClick={share} disabled={busy}>{busy ? <Spinner size={22} light /> : t('share')}</button></div>
      </div>
      {busy && <UploadOverlay progress={progress} />}
    </div>
  );
}

function UploadOverlay({ progress }) {
  return (
    <div className="upload-overlay">
      <div className="upload-card">
        <Spinner />
        <span>{t('uploading')} {progress > 0 ? `${progress}%` : ''}</span>
        <div className="upload-bar"><span style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  );
}
