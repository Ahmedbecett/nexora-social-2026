import { useEffect, useRef, useState } from 'react';
import { api, uploadMedia } from '../api.js';
import { t, errText } from '../i18n.js';
import { useApp, Avatar, TopBar, Spinner } from '../components.jsx';
import { IClose, IImage, ILocation, IMusic, IChevron, ISend } from '../icons.jsx';

export default function Create({ mode: initialMode = 'post' }) {
  const { me, nav, toast } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [files, setFiles] = useState([]); // {file, url, type}
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [audio, setAudio] = useState('');
  const [alsoStory, setAlsoStory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [locOpen, setLocOpen] = useState(false);
  const inputRef = useRef();

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
    setFiles(chosen.map((file) => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image' })));
  };

  const share = async () => {
    if (!files.length || busy) return;
    setBusy(true); setProgress(0);
    try {
      const media = [];
      for (let i = 0; i < files.length; i++) {
        const m = await uploadMedia(files[i].file, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
        media.push(m);
      }
      if (mode === 'story') {
        await api('stories', { method: 'POST', body: { url: media[0].url, type: media[0].type } });
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
        <div className="story-preview">{f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" />}</div>
        <button className="icon-btn light story-x" onClick={() => setFiles([])}><IClose size={28} /></button>
        <div className="story-share-bar">
          <button className="story-share-btn" onClick={share} disabled={busy}>
            <Avatar src={me.avatarUrl} name={me.username} size={26} /><span>{t('yourStory')}</span>
          </button>
          <button className="story-send" onClick={share} disabled={busy}>{busy ? <Spinner size={20} /> : <ISend size={20} />}</button>
        </div>
        {busy && <UploadOverlay progress={progress} />}
      </div>
    );
  }

  return (
    <div className="screen create">
      <TopBar title={title} onBack={() => setFiles([])}
        right={busy ? <Spinner size={20} /> : <button className="text-link strong" onClick={share}>{t('share')}</button>} />
      <div className="scroll">
        <div className="compose-preview">
          {files.map((f, i) => (
            <div className={`compose-item ${mode === 'reel' ? 'reel' : ''}`} key={i}>
              {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" />}
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
