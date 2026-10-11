import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, uploadMedia } from '../api.js';
import { t, timeAgo, errText, getLang } from '../i18n.js';
import { useApp, Avatar, UserName, TopBar, Loading, Empty, ErrorBox, Sheet, Spinner, Confirm, useAsync } from '../components.jsx';
import { IEdit, ISend, IImage, IComment, IReply, ICopy, IPin, IUnsend, ITrash, IPlus, IClose } from '../icons.jsx';
import { tapHaptic } from '../theme.js';

export function Inbox({ isTab = false, active = true }) {
  const { me, nav, refreshBadges } = useApp();
  const { loading, data, error, reload } = useAsync(() => api('conversations'), []);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const iv = setInterval(() => { if (document.visibilityState === 'visible') reload(true); }, 15000);
    return () => clearInterval(iv);
  }, [active]); // eslint-disable-line
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
      <TopBar left={isTab ? <span /> : undefined} className={isTab ? 'start-title' : ''} title={<b>{me.username}</b>} right={<button className="icon-btn" onClick={() => setNewOpen(true)}><IEdit size={24} /></button>} />
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
      <UserPicker open={newOpen} onClose={() => setNewOpen(false)} title={t('newMessage')} onPick={(u) => nav.push('chat', { user: u })} />
    </div>
  );
}

/** Pick a user (new message / forward). */
function UserPicker({ open, onClose, title, onPick }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => {
    if (!open) return;
    setQ(''); setUsers(null);
    Promise.all([api('conversations').catch(() => ({ conversations: [] })), api('suggestions').catch(() => ({ users: [] }))])
      .then(([c, s]) => {
        const seen = new Set(); const list = [];
        for (const u of [...(c.conversations || []).map((x) => x.user), ...(s.users || [])]) if (!seen.has(u.id)) { seen.add(u.id); list.push(u); }
        setUsers(list);
      });
  }, [open]);
  useEffect(() => {
    if (!q.trim()) return undefined;
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q]);
  return (
    <Sheet open={open} onClose={onClose} title={title} full>
      <div className="search-box sheet-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      <div className="user-list">
        {users === null ? <Loading /> : users.map((u) => (
          <div className="user-row" key={u.id} onClick={() => { onClose(); onPick(u); }}>
            <Avatar src={u.avatarUrl} name={u.username} size={48} />
            <div className="user-row-text"><span className="conv-name">{u.fullName || u.username}</span><UserName user={u} className="muted" /></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- chat ---------------- */
const QUICK = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const MORE = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '👏', '🙏', '😍', '🥰', '😘', '😁', '😅', '🤣', '😊',
  '😎', '🤔', '🙄', '😴', '🥺', '😭', '😤', '🤯', '🥳', '😇', '🤗', '🤝', '👌', '✌️', '💪', '👀',
  '💯', '✨', '🎉', '💔', '💙', '💚', '💛', '🖤', '🤍', '💜', '🌹', '⭐', '☀️', '🌙', '⚽', '🎶'];
const isEmojiOnly = (s) => !!s && s.length <= 16 && /\p{Extended_Pictographic}/u.test(s)
  && /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]+$/u.test(s) && !/[0-9#*]/.test(s);
const preview = (m) => (m.text ? m.text : m.media || m.mediaUrl ? `📷 ${t('msgPhoto')}` : m.post ? t('msgPost') : '');
const menuTime = (d) => {
  const dt = new Date(d);
  const recent = Date.now() - dt < 6 * 864e5;
  try {
    return dt.toLocaleString(getLang(), recent ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).toUpperCase();
  } catch { return dt.toLocaleString(); }
};
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

function MsgBody({ m, onPost }) {
  return (
    <>
      {m.post && (
        <div className="bubble-post" onClick={onPost}>
          {m.post.username && <div className="bubble-post-head">{m.post.username}</div>}
          {m.post.thumb && (m.post.type === 'video' ? <video disableRemotePlayback src={m.post.thumb + '#t=0.3'} muted /> : <img src={m.post.thumb} alt="" draggable={false} />)}
        </div>
      )}
      {m.mediaUrl && <img className="bubble-img" src={m.mediaUrl} alt="" draggable={false} />}
      {m.text && <div className={`bubble ${isEmojiOnly(m.text) ? 'emoji' : ''}`} dir="auto">{m.text}</div>}
    </>
  );
}

function MessageRow({ m, user, showAvatar, flash, onMenu, onDoubleTap, onSwipeReply, onReactions, onJump, nav }) {
  const bodyRef = useRef();
  const st = useRef({});
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const setOffset = (v) => { dxRef.current = v; setDx(v); };
  const reset = () => { const s = st.current; clearTimeout(s.timer); s.x = null; s.swiping = false; s.buzzed = false; setOffset(0); };

  const onPointerDown = (e) => {
    if (e.button) return;
    const s = st.current;
    s.x = e.clientX; s.y = e.clientY; s.moved = false; s.swiping = false; s.fired = false; s.buzzed = false;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { s.fired = true; tapHaptic(); onMenu(m, bodyRef.current); }, 420);
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (s.x == null) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (!s.swiping) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      clearTimeout(s.timer); s.moved = true;
      if (!s.fired && Math.abs(ddx) > Math.abs(ddy) * 1.3) s.swiping = true;
      else { s.x = null; return; }
    }
    const v = Math.max(-76, Math.min(76, ddx));
    setOffset(v);
    if (Math.abs(v) >= 56 && !s.buzzed) { s.buzzed = true; tapHaptic(); }
  };
  const onPointerUp = () => {
    const s = st.current;
    clearTimeout(s.timer);
    if (s.swiping && Math.abs(dxRef.current) >= 56) onSwipeReply(m);
    else if (s.x != null && !s.moved && !s.fired) {
      const now = Date.now();
      if (now - (s.lastTap || 0) < 300) { s.lastTap = 0; onDoubleTap(m); } else s.lastTap = now;
    }
    reset();
  };
  const onClickCapture = (e) => { if (st.current.fired) { e.stopPropagation(); e.preventDefault(); st.current.fired = false; } };

  const reacts = m.reactions || [];
  const uniq = [...new Set(reacts.map((r) => r.emoji))].slice(0, 3);
  let replyLabel = '';
  if (m.reply) {
    const u = user.username;
    replyLabel = m.mine ? (m.reply.mine ? t('msgYouReplied') : t('msgYouRepliedTo', { u })) : (m.reply.mine ? t('msgRepliedToYou', { u }) : t('msgRepliedToSelf', { u }));
  }
  return (
    <div className={`bubble-row ${m.mine ? 'mine' : ''} ${reacts.length ? 'has-reacts' : ''} ${flash ? 'flash' : ''}`} id={`msg-${m.id}`}>
      {!m.mine && (showAvatar ? <Avatar src={user.avatarUrl} name={user.username} size={28} /> : <span className="avatar-gap" />)}
      <div className="bubble-col">
        {m.reply && (
          <div className="reply-ref" onClick={() => !m.reply.gone && onJump(m.reply.id)}>
            <span className="reply-label"><IReply size={12} /> {replyLabel}</span>
            <div className="reply-quote" dir="auto">{m.reply.gone ? t('msgUnavailable') : preview(m.reply)}</div>
          </div>
        )}
        <div ref={bodyRef} className={`bubble-body ${dx ? 'dragging' : ''}`} style={dx ? { transform: `translateX(${dx}px)` } : undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={reset} onPointerLeave={() => st.current.swiping || reset()}
          onClickCapture={onClickCapture} onContextMenu={(e) => e.preventDefault()}>
          <MsgBody m={m} onPost={() => nav.push('post', { id: m.post.id })} />
          {reacts.length > 0 && (
            <button className="msg-reacts" onClick={(e) => { e.stopPropagation(); onReactions(m); }}>
              {uniq.map((e) => <span key={e}>{e}</span>)}{reacts.length > 1 && <b>{reacts.length}</b>}
            </button>
          )}
        </div>
      </div>
      {dx !== 0 && <span className={`swipe-reply ${Math.abs(dx) >= 56 ? 'ready' : ''}`} style={{ opacity: Math.min(1, Math.abs(dx) / 56) }}><IReply size={18} /></span>}
    </div>
  );
}

function MessageMenu({ m, rect, onClose, onReact, onAction }) {
  const [more, setMore] = useState(false);
  const [top, setTop] = useState(null);
  const boxRef = useRef();
  useLayoutEffect(() => {
    const h = boxRef.current?.offsetHeight || 0;
    const vh = window.innerHeight;
    setTop(Math.max(16, Math.min(rect.top - 70, vh - h - 16)));
  }, [more, rect.top]);
  const mine = m.reactions?.find((r) => r.mine)?.emoji;
  const items = [
    { k: 'reply', icon: <IReply size={24} />, label: t('msgReply') },
    { k: 'forward', icon: <ISend size={24} />, label: t('msgForward') },
    m.text && { k: 'copy', icon: <ICopy size={24} />, label: t('msgCopy') },
    { k: m.pinned ? 'unpin' : 'pin', icon: <IPin size={24} />, label: t(m.pinned ? 'msgUnpin' : 'msgPin') },
    { k: 'hide', icon: <ITrash size={24} />, label: t('msgDeleteForYou') },
    m.mine && { k: 'unsend', icon: <IUnsend size={24} />, label: t('msgUnsend'), danger: true },
  ].filter(Boolean);
  return createPortal(
    <div className="msg-menu-wrap" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div ref={boxRef} className={`msg-menu-box ${m.mine ? 'mine' : ''}`} style={{ top: top ?? rect.top, visibility: top == null ? 'hidden' : 'visible' }} onClick={(e) => e.stopPropagation()}>
        <div className="react-bar">
          {QUICK.map((e) => <button key={e} className={mine === e ? 'on' : ''} onClick={() => onReact(m, e)}>{e}</button>)}
          <button className={`react-more ${more ? 'on' : ''}`} onClick={() => setMore((v) => !v)} aria-label="more"><IPlus size={26} /></button>
        </div>
        {more && <div className="react-grid">{MORE.map((e) => <button key={e} className={mine === e ? 'on' : ''} onClick={() => onReact(m, e)}>{e}</button>)}</div>}
        <div className="msg-menu-clone"><MsgBody m={m} /></div>
        <div className="msg-menu-card">
          <div className="msg-menu-time">{menuTime(m.createdAt)}</div>
          {items.map((it) => (
            <button key={it.k} className={`msg-menu-item ${it.danger ? 'danger' : ''}`} onClick={() => onAction(it.k, m)}>{it.icon}<span>{it.label}</span></button>
          ))}
        </div>
      </div>
    </div>, document.body,
  );
}

export function Chat({ user, onBack, active }) {
  const { me, nav, toast, refreshBadges } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [menu, setMenu] = useState(null);       // { m, rect }
  const [reactSheet, setReactSheet] = useState(null);
  const [forward, setForward] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, m }
  const [flashId, setFlashId] = useState(0);
  const lastId = useRef(0);
  const since = useRef(null);
  const endRef = useRef();
  const fileRef = useRef();
  const inputRef = useRef();
  const lastRendered = useRef(0);
  const removed = useRef(new Set()); // ids unsent / deleted here: never let a stale poll bring them back

  const merge = (list, incoming) => {
    const map = new Map((list || []).map((x) => [x.id, x]));
    for (const x of incoming) { if (x.gone || removed.current.has(x.id)) map.delete(x.id); else map.set(x.id, x); }
    return [...map.values()].sort((a, b) => a.id - b.id);
  };
  const fetchNew = async (initial) => {
    try {
      const qs = initial ? 'after=0' : `after=${lastId.current}${since.current ? `&since=${encodeURIComponent(since.current)}` : ''}`;
      const r = await api(`messages/${user.id}?${qs}`);
      if (r.serverTime) since.current = new Date(new Date(r.serverTime).getTime() - 2000).toISOString();
      for (const x of r.messages) if (!x.gone && x.id > lastId.current) lastId.current = x.id;
      if (initial) setMsgs(r.messages.filter((x) => !x.gone && !removed.current.has(x.id)));
      else if (r.messages.length) setMsgs((m) => merge(m, r.messages));
    } catch (e) { if (initial) setMsgs([]); }
  };
  useEffect(() => {
    fetchNew(true).then(() => refreshBadges());
    const iv = setInterval(() => { if (document.visibilityState === 'visible') fetchNew(false); }, 3000);
    return () => { clearInterval(iv); onBack?.(); window.dispatchEvent(new Event('nx-msg')); };
  }, [user.id]); // eslint-disable-line
  useEffect(() => {
    const last = msgs?.[msgs.length - 1]?.id || 0;
    if (last > lastRendered.current) { endRef.current?.scrollIntoView({ block: 'end' }); lastRendered.current = last; }
  }, [msgs]);
  useEffect(() => {
    const h = () => setMenu(null);
    document.addEventListener('nx-close-overlay', h);
    return () => document.removeEventListener('nx-close-overlay', h);
  }, []);

  const patch = (id, fn) => setMsgs((list) => (list || []).map((x) => (x.id === id ? fn(x) : x)));
  const drop = (id) => { removed.current.add(id); setMsgs((list) => (list || []).filter((x) => x.id !== id)); if (replyTo?.id === id) setReplyTo(null); };

  const send = async (payload) => {
    if (sending) return;
    setSending(true);
    try {
      const r = await api(`messages/${user.id}`, { method: 'POST', body: { ...payload, replyTo: replyTo?.id } });
      lastId.current = Math.max(lastId.current, r.message.id);
      setMsgs((m) => merge(m, [r.message]));
      setText(''); setReplyTo(null);
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

  const react = async (m, emoji) => {
    setMenu(null);
    const cur = m.reactions?.find((r) => r.mine)?.emoji;
    const remove = cur === emoji;
    patch(m.id, (x) => ({ ...x, reactions: [...(x.reactions || []).filter((r) => !r.mine), ...(remove ? [] : [{ emoji, mine: true }])] }));
    try {
      if (remove) await api(`message/${m.id}/react`, { method: 'DELETE' });
      else await api(`message/${m.id}/react`, { method: 'POST', body: { emoji } });
    } catch (e) { toast(errText(e.code)); fetchNew(false); }
  };
  const startReply = (m) => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 60); };
  const jump = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashId(id); setTimeout(() => setFlashId(0), 1300);
  };
  const action = async (k, m) => {
    setMenu(null);
    try {
      if (k === 'reply') startReply(m);
      else if (k === 'forward') setForward(m);
      else if (k === 'copy') { if (await copyText(m.text)) toast(t('msgCopied')); }
      else if (k === 'pin') { patch(m.id, (x) => ({ ...x, pinned: true })); await api(`message/${m.id}/pin`, { method: 'POST' }); }
      else if (k === 'unpin') { patch(m.id, (x) => ({ ...x, pinned: false })); await api(`message/${m.id}/pin`, { method: 'DELETE' }); }
      else if (k === 'hide') setConfirm({ kind: 'hide', m });
      else if (k === 'unsend') setConfirm({ kind: 'unsend', m });
    } catch (e) { toast(errText(e.code)); fetchNew(false); }
  };
  const doConfirm = async () => {
    const { kind, m } = confirm;
    drop(m.id);
    try {
      if (kind === 'unsend') await api(`message/${m.id}`, { method: 'DELETE' });
      else await api(`message/${m.id}/hide`, { method: 'POST' });
    } catch (e) { removed.current.delete(m.id); toast(errText(e.code)); fetchNew(true); }
  };
  const doForward = async (to) => {
    const m = forward; setForward(null);
    try {
      await api(`messages/${to.id}`, { method: 'POST', body: { text: m.text || '', mediaUrl: m.mediaUrl || undefined, postId: m.post?.id || undefined } });
      toast(t('msgSent'));
    } catch (e) { toast(errText(e.code)); }
  };

  const pinned = msgs ? [...msgs].reverse().find((x) => x.pinned) : null;
  const meName = me?.username;
  return (
    <div className="screen chat">
      <TopBar title={
        <div className="chat-title" onClick={() => nav.profile(user.username)}>
          <Avatar src={user.avatarUrl} name={user.username} size={32} />
          <div><b>{user.fullName || user.username}</b><span>{user.username}</span></div>
        </div>
      } />
      {pinned && (
        <button className="pinned-bar" onClick={() => jump(pinned.id)}>
          <IPin size={18} />
          <div><b>{t('msgPinned')}</b><span className="ellipsis" dir="auto">{preview(pinned)}</span></div>
        </button>
      )}
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
              const next = msgs[i + 1];
              const showAvatar = !m.mine && (!next || next.mine || new Date(next.createdAt) - new Date(m.createdAt) > 30 * 60000);
              return (
                <div key={m.id}>
                  {showTime && <div className="chat-time">{new Date(m.createdAt).toLocaleString(getLang(), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>}
                  <MessageRow m={m} user={user} showAvatar={showAvatar} flash={flashId === m.id} nav={nav}
                    onMenu={(mm, el) => setMenu({ m: mm, rect: el.getBoundingClientRect() })}
                    onDoubleTap={(mm) => react(mm, '❤️')}
                    onSwipeReply={startReply}
                    onReactions={setReactSheet}
                    onJump={jump} />
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>
      {replyTo && (
        <div className="reply-bar">
          <div>
            <b>{replyTo.mine ? t('msgReplyingYourself') : t('msgReplyingTo', { u: user.username })}</b>
            <span className="ellipsis" dir="auto">{preview(replyTo)}</span>
          </div>
          <button className="icon-btn" onClick={() => setReplyTo(null)} aria-label="close"><IClose size={18} /></button>
        </div>
      )}
      <div className="chat-composer">
        <button className="chat-cam" onClick={() => fileRef.current?.click()}>{sending ? <Spinner size={18} light /> : <IImage size={20} />}</button>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeMessage')} dir="auto"
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && send({ text })} />
        {text.trim() ? <button className="text-link strong" onClick={() => send({ text })}>{t('send')}</button>
          : <button className="icon-btn" onClick={() => send({ text: '❤️' })}>❤️</button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendPhoto} />
      </div>

      {menu && <MessageMenu m={menu.m} rect={menu.rect} onClose={() => setMenu(null)} onReact={react} onAction={action} />}
      <Sheet open={!!reactSheet} onClose={() => setReactSheet(null)} title={t('msgReactions')}>
        <div className="user-list">
          {(reactSheet?.reactions || []).map((r) => (
            <div className="user-row" key={r.mine ? 'me' : 'them'} onClick={() => { if (r.mine) { const m = reactSheet; setReactSheet(null); react(m, r.emoji); } }}>
              <Avatar src={r.mine ? me?.avatarUrl : user.avatarUrl} name={r.mine ? meName : user.username} size={44} />
              <div className="user-row-text">
                <span className="conv-name">{r.mine ? meName : (user.fullName || user.username)}</span>
                {r.mine && <span className="muted">{t('msgTapToRemove')}</span>}
              </div>
              <span className="react-emoji">{r.emoji}</span>
            </div>
          ))}
        </div>
      </Sheet>
      <UserPicker open={!!forward} onClose={() => setForward(null)} title={t('msgForwardTo')} onPick={doForward} />
      <Confirm open={!!confirm} danger
        title={confirm?.kind === 'unsend' ? t('msgUnsendQ') : t('msgDeleteQ')}
        text={confirm?.kind === 'unsend' ? t('msgUnsendDesc') : t('msgDeleteDesc')}
        okLabel={confirm?.kind === 'unsend' ? t('msgUnsend') : t('delete')}
        onOk={doConfirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
