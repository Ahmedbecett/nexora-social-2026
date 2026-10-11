import { useEffect, useRef, useState } from 'react';
import { api, uploadMedia } from '../api.js';
import { t, timeAgo, errText } from '../i18n.js';
import { useApp, Avatar, UserName, TopBar, Loading, Empty, ErrorBox, Sheet, Spinner, useAsync } from '../components.jsx';
import { IEdit, ISend, IImage, IComment } from '../icons.jsx';

export function Inbox() {
  const { me, nav, refreshBadges } = useApp();
  const { loading, data, error, reload } = useAsync(() => api('conversations'), []);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => api('conversations').then(() => {}).catch(() => {}), 15000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { const h = () => reload(); window.addEventListener('nx-msg', h); return () => window.removeEventListener('nx-msg', h); }); // eslint-disable-line
  const convs = (data?.conversations || []).filter((c) => !q || c.user.username.includes(q.toLowerCase()) || (c.user.fullName || '').toLowerCase().includes(q.toLowerCase()));
  const preview = (c) => {
    const prefix = c.last.mine ? `${t('you')}: ` : '';
    if (c.last.post) return prefix + t('sentPost');
    if (c.last.media && !c.last.text) return prefix + t('sentPhoto');
    return prefix + c.last.text;
  };
  return (
    <div className="screen">
      <TopBar title={<b>{me.username}</b>} right={<button className="icon-btn" onClick={() => setNewOpen(true)}><IEdit size={24} /></button>} />
      <div className="scroll">
        <div className="search-box pad"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
        <div className="section-head pad"><b>{t('messages')}</b></div>
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : convs.length === 0 ? (
          <Empty icon={<IComment size={40} />} title={t('noMessages')} sub={t('noMessagesSub')}
            action={<button className="btn btn-primary" onClick={() => setNewOpen(true)}>{t('newMessage')}</button>} />
        ) : (
          <div className="user-list">
            {convs.map((c) => (
              <div className={`user-row conv ${c.unread ? 'unread' : ''}`} key={c.user.id} onClick={() => { nav.push('chat', { user: c.user, onBack: () => { reload(); refreshBadges(); } }); }}>
                <Avatar src={c.user.avatarUrl} name={c.user.username} size={56} />
                <div className="user-row-text">
                  <span className="conv-name">{c.user.fullName || c.user.username}</span>
                  <span className="conv-last"><span className="ellipsis">{preview(c)}</span> · {timeAgo(c.last.createdAt)}</span>
                </div>
                {c.unread > 0 && <span className="unread-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
      <NewMessage open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function NewMessage({ open, onClose }) {
  const { nav } = useApp();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => { if (open) { setQ(''); api('suggestions').then((r) => setUsers(r.users)).catch(() => setUsers([])); } }, [open]);
  useEffect(() => {
    if (!q.trim()) return;
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q]);
  return (
    <Sheet open={open} onClose={onClose} title={t('newMessage')} full>
      <div className="search-box sheet-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" autoFocus /></div>
      <div className="user-list">
        {users === null ? <Loading /> : users.map((u) => (
          <div className="user-row" key={u.id} onClick={() => { onClose(); nav.push('chat', { user: u }); }}>
            <Avatar src={u.avatarUrl} name={u.username} size={48} />
            <div className="user-row-text"><span className="conv-name">{u.fullName}</span><UserName user={u} className="muted" /></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function Chat({ user, onBack, active }) {
  const { nav, toast, refreshBadges } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const endRef = useRef();
  const fileRef = useRef();

  const fetchNew = async (initial) => {
    try {
      const r = await api(`messages/${user.id}?after=${initial ? 0 : lastId.current}`);
      if (r.messages.length) {
        lastId.current = r.messages[r.messages.length - 1].id;
        setMsgs((m) => initial ? r.messages : [...(m || []), ...r.messages.filter((x) => !(m || []).some((y) => y.id === x.id))]);
      } else if (initial) setMsgs([]);
    } catch (e) { if (initial) setMsgs([]); }
  };
  useEffect(() => {
    fetchNew(true).then(() => refreshBadges());
    const iv = setInterval(() => fetchNew(false), 3000);
    return () => { clearInterval(iv); onBack?.(); window.dispatchEvent(new Event('nx-msg')); };
  }, [user.id]); // eslint-disable-line
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  const send = async (payload) => {
    if (sending) return;
    setSending(true);
    try {
      const r = await api(`messages/${user.id}`, { method: 'POST', body: payload });
      lastId.current = Math.max(lastId.current, r.message.id);
      setMsgs((m) => [...(m || []), r.message]);
      setText('');
    } catch (e) { toast(errText(e.code)); }
    setSending(false);
  };
  const sendPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setSending(true);
    try { const m = await uploadMedia(f); setSending(false); await send({ mediaUrl: m.url }); }
    catch (err) { toast(errText(err.code || 'server_error')); setSending(false); }
  };

  return (
    <div className="screen chat">
      <TopBar title={
        <div className="chat-title" onClick={() => nav.profile(user.username)}>
          <Avatar src={user.avatarUrl} name={user.username} size={32} />
          <div><b>{user.fullName || user.username}</b><span>{user.username}</span></div>
        </div>
      } />
      <div className="scroll chat-scroll">
        {msgs === null ? <Loading /> : (
          <>
            <div className="chat-intro">
              <Avatar src={user.avatarUrl} name={user.username} size={88} />
              <h3>{user.fullName || user.username}</h3>
              <span className="muted">{user.username} · {t('activeNow')}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => nav.profile(user.username)}>{t('viewProfile')}</button>
            </div>
            {msgs.map((m, i) => {
              const showTime = i === 0 || new Date(m.createdAt) - new Date(msgs[i - 1].createdAt) > 30 * 60000;
              return (
                <div key={m.id}>
                  {showTime && <div className="chat-time">{new Date(m.createdAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>}
                  <div className={`bubble-row ${m.mine ? 'mine' : ''}`}>
                    {!m.mine && <Avatar src={user.avatarUrl} name={user.username} size={26} />}
                    <div className="bubble-col">
                      {m.post && (
                        <div className="bubble-post" onClick={() => nav.push('post', { id: m.post.id })}>
                          {m.post.username && <div className="bubble-post-head">{m.post.username}</div>}
                          {m.post.thumb && (m.post.type === 'video' ? <video disableRemotePlayback src={m.post.thumb + '#t=0.3'} muted /> : <img src={m.post.thumb} alt="" />)}
                        </div>
                      )}
                      {m.mediaUrl && <img className="bubble-img" src={m.mediaUrl} alt="" />}
                      {m.text && <div className={`bubble ${/^\p{Extended_Pictographic}+$/u.test(m.text) && m.text.length <= 8 ? 'emoji' : ''}`} dir="auto">{m.text}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>
      <div className="chat-composer">
        <button className="chat-cam" onClick={() => fileRef.current?.click()}>{sending ? <Spinner size={18} light /> : <IImage size={20} />}</button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeMessage')} dir="auto"
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && send({ text })} />
        {text.trim() ? <button className="text-link strong" onClick={() => send({ text })}>{t('send')}</button>
          : <button className="icon-btn" onClick={() => send({ text: '❤️' })}>❤️</button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendPhoto} />
      </div>
    </div>
  );
}
