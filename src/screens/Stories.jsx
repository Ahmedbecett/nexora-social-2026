import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { t, timeAgo, errText } from '../i18n.js';
import { useApp, Avatar, UserName, Sheet, Spinner } from '../components.jsx';
import { IClose, ISend, IHeart, IMoreH, ITrash, IEye } from '../icons.jsx';

const IMAGE_MS = 5500;

export default function StoryViewer({ tray, index = 0, onSeen, highlight }) {
  const { me, nav, toast } = useApp();
  const [g, setG] = useState(index);
  const [s, setS] = useState(() => {
    const st = tray[index]?.stories || [];
    const firstUnseen = st.findIndex((x) => !x.seen);
    return firstUnseen > 0 ? firstUnseen : 0;
  });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState({});
  const [viewers, setViewers] = useState(null);
  const [menu, setMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef();
  const raf = useRef();
  const holdTimer = useRef();
  const group = tray[g];
  const story = group?.stories[s];
  const mine = group?.user.id === me.id;

  // mark seen
  useEffect(() => {
    if (!story || highlight || !story.id) return;
    if (!story.seen) api(`stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
    story.seen = true;
    if (s === group.stories.length - 1) onSeen?.(group.user.id);
  }, [g, s]); // eslint-disable-line

  useEffect(() => { setLoaded(false); setProgress(0); }, [g, s]);

  // progress timer
  useEffect(() => {
    if (!story || paused || !loaded) return;
    let start = performance.now() - progress * IMAGE_MS;
    const tick = (now) => {
      let p;
      if (story.type === 'video' && videoRef.current) {
        const v = videoRef.current;
        p = v.duration ? v.currentTime / v.duration : 0;
      } else p = (now - start) / IMAGE_MS;
      setProgress(Math.min(1, p));
      if (p >= 1) next(); else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [g, s, paused, loaded]); // eslint-disable-line

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => {});
  }, [paused, g, s]);

  const close = () => nav.pop();
  const next = () => {
    if (s < group.stories.length - 1) setS(s + 1);
    else if (g < tray.length - 1) { setG(g + 1); setS(0); }
    else close();
  };
  const prev = () => {
    if (s > 0) setS(s - 1);
    else if (g > 0) { setG(g - 1); setS(0); }
    else { setProgress(0); setLoaded(false); setTimeout(() => setLoaded(true), 10); }
  };
  const onTap = (e) => {
    if (e.target.closest('.story-ui')) return;
    const x = e.clientX / window.innerWidth;
    const rtl = document.documentElement.dir === 'rtl';
    const forward = rtl ? x < 0.3 : x > 0.3;
    if (forward) next(); else prev();
  };
  const sendReply = async () => {
    if (!reply.trim()) return;
    try {
      await api(`messages/${group.user.id}`, { method: 'POST', body: { text: reply, mediaUrl: story.type === 'image' ? story.url : null, storyReply: true } });
      setReply(''); toast(t('sent')); setPaused(false);
    } catch (e) { toast(errText(e.code)); }
  };
  const like = async () => {
    setLiked((l) => ({ ...l, [story.url]: true }));
    try { await api(`messages/${group.user.id}`, { method: 'POST', body: { text: '❤️', mediaUrl: story.type === 'image' ? story.url : null, storyReply: true } }); } catch { /* ignore */ }
  };
  const openViewers = async () => {
    setPaused(true); setViewers([]);
    try { const r = await api(`stories/${story.id}/viewers`); setViewers(r.users); } catch { setViewers([]); }
  };
  const del = async () => {
    try {
      await api(`stories/${story.id}`, { method: 'DELETE' });
      group.stories.splice(s, 1);
      if (!group.stories.length) close(); else { setS(Math.min(s, group.stories.length - 1)); setPaused(false); }
    } catch (e) { toast(errText(e.code)); }
  };

  if (!story) return null;
  return (
    <div className="story-viewer" onClick={onTap}
      onPointerDown={() => { holdTimer.current = setTimeout(() => setPaused(true), 180); }}
      onPointerUp={() => { clearTimeout(holdTimer.current); if (!viewers && !menu && document.activeElement?.tagName !== 'INPUT') setPaused(false); }}>
      <div className="story-media">
        {!loaded && <div className="story-loading"><Spinner light /></div>}
        {story.type === 'video'
          ? <video disableRemotePlayback key={story.url} ref={videoRef} src={story.url} autoPlay playsInline onLoadedData={() => setLoaded(true)} />
          : <img key={story.url} src={story.url} alt="" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />}
      </div>
      <div className="story-top story-ui-pass">
        <div className="story-bars">
          {group.stories.map((_, i) => (
            <span key={i} className="bar"><span style={{ width: `${(i < s ? 1 : i === s ? progress : 0) * 100}%` }} /></span>
          ))}
        </div>
        <div className="story-head">
          <div className="story-user story-ui" onClick={() => { nav.pop(); nav.profile(group.user.username); }}>
            <Avatar src={group.user.avatarUrl} name={group.user.username} size={34} />
            <UserName user={group.user} />
            {highlight ? <span className="story-time">{highlight}</span> : story.createdAt && <span className="story-time">{timeAgo(story.createdAt)}</span>}
          </div>
          <div className="story-ui story-head-actions">
            {mine && story.id && <button className="icon-btn light" onClick={() => { setPaused(true); setMenu(true); }}><IMoreH size={24} /></button>}
            <button className="icon-btn light" onClick={close}><IClose size={28} /></button>
          </div>
        </div>
      </div>
      <div className="story-bottom story-ui">
        {mine ? (
          story.id && <button className="story-viewers" onClick={openViewers}><IEye size={20} /> {t('seenBy', { n: '' }).replace(/\s*$/, '')}</button>
        ) : !highlight && (
          <div className="story-reply">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('replyStory', { u: group.user.username })} dir="auto"
              onFocus={() => setPaused(true)} onBlur={() => !reply && setPaused(false)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} />
            {reply ? <button className="icon-btn light" onClick={sendReply}><ISend size={26} /></button>
              : <button className="icon-btn light" onClick={like}><IHeart filled={liked[story.url]} size={28} /></button>}
          </div>
        )}
      </div>
      <Sheet open={viewers !== null} onClose={() => { setViewers(null); setPaused(false); }} title={t('seenBy', { n: viewers?.length ?? '' })}>
        <div className="user-list">
          {(viewers || []).map((u) => (
            <div className="user-row" key={u.id}><Avatar src={u.avatarUrl} name={u.username} size={44} /><div className="user-row-text"><UserName user={u} /><span>{u.fullName}</span></div></div>
          ))}
        </div>
      </Sheet>
      <Sheet open={menu} onClose={() => { setMenu(false); setPaused(false); }}>
        <div className="actions"><button className="action danger" onClick={() => { setMenu(false); del(); }}><ITrash size={22} /><span>{t('deleteStory')}</span></button></div>
      </Sheet>
    </div>
  );
}
