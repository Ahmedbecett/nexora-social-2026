p='/home/user/repo/src/screens/Post.jsx'; s=open(p).read()
i=s.index('/* ---------------- comments ---------------- */'); j=s.index('/* ---------------- share to DM ---------------- */')
new=r'''/* ---------------- comments ---------------- */
function CommentRow({ c, post, me, onReply, onLike, onDelete, onTag, onUser }) {
  const lastTap = useRef(0);
  const tap = () => { const n = Date.now(); if (n - lastTap.current < 300) { if (!c.liked) onLike(c); lastTap.current = 0; } else lastTap.current = n; };
  const small = !!c.parentId;
  return (
    <div className={`comment ${small ? 'reply' : ''}`} onClick={tap}>
      <Avatar src={c.user.avatarUrl} name={c.user.username} size={small ? 26 : 34} onClick={(e) => { e.stopPropagation(); onUser(c.user.username); }} />
      <div className="comment-body">
        <div className="comment-meta"><UserName user={c.user} /> <span className="muted">{timeAgo(c.createdAt)}</span>
          {c.user.id === post.user.id && <span className="muted">· {t('author')}</span>}</div>
        <div className="comment-text"><RichText text={c.text} onTag={onTag} onMention={onUser} /></div>
        <div className="comment-actions">
          <button onClick={(e) => { e.stopPropagation(); onReply(c); }}>{t('reply')}</button>
          {c.ownerLiked && c.user.id !== post.user.id && <span className="by-author"><IHeart size={11} filled /> {t('byAuthor')}</span>}
          {(c.user.id === me.id || post.user.id === me.id) && <button onClick={(e) => { e.stopPropagation(); onDelete(c); }}>{t('delete')}</button>}
        </div>
      </div>
      <button className={`comment-like ${c.liked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onLike(c); }} aria-label="like">
        <IHeart size={14} filled={c.liked} />{c.likeCount > 0 && <span>{fmtNum(c.likeCount)}</span>}
      </button>
    </div>
  );
}

export function CommentsSheet({ open, post, onClose, onCount }) {
  const { me, nav, toast } = useApp();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [expanded, setExpanded] = useState({});
  const inputRef = useRef();
  useEffect(() => {
    if (!open) return;
    setList(null); setReplyTo(null); setExpanded({});
    api(`posts/${post.id}/comments`).then((r) => setList(r.comments)).catch(() => setList([]));
  }, [open, post.id]);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api(`posts/${post.id}/comments`, { method: 'POST', body: { text, parentId: replyTo?.id || undefined } });
      const nl = [...(list || []), r.comment];
      setList(nl); onCount?.(nl.length); setText(''); setReplyTo(null);
      if (r.comment.parentId) setExpanded((x) => ({ ...x, [r.comment.parentId]: true }));
    } catch (e) { toast(errText(e.code)); }
    setBusy(false);
  };
  const startReply = (c) => {
    setReplyTo(c);
    setText(c.user.id === me.id ? '' : `@${c.user.username} `);
    setTimeout(() => inputRef.current?.focus(), 30);
  };
  const like = async (c) => {
    const on = !c.liked;
    tapHaptic();
    const upd = (liked, likeCount) => setList((l) => l.map((x) => (x.id === c.id ? { ...x, liked, likeCount, ownerLiked: me.id === post.user.id ? liked : x.ownerLiked } : x)));
    upd(on, Math.max(0, (c.likeCount || 0) + (on ? 1 : -1)));
    try { const r = await api(`comments/${c.id}/like`, { method: on ? 'POST' : 'DELETE' }); upd(r.liked, r.likeCount); }
    catch (e) { upd(c.liked, c.likeCount); toast(errText(e.code)); }
  };
  const del = async (c) => {
    try {
      await api(`comments/${c.id}`, { method: 'DELETE' });
      const nl = list.filter((x) => x.id !== c.id && x.parentId !== c.id);
      setList(nl); onCount?.(nl.length);
      if (replyTo && (replyTo.id === c.id || replyTo.parentId === c.id)) setReplyTo(null);
    } catch (e) { toast(errText(e.code)); }
  };
  const rowProps = {
    post, me, onReply: startReply, onLike: like, onDelete: del,
    onTag: (tg) => { onClose(); nav.push('tag', { tag: tg }); },
    onUser: (u) => { onClose(); nav.profile(u); },
  };
  const tops = (list || []).filter((c) => !c.parentId);
  return (
    <Sheet open={open} onClose={onClose} title={t('comments')} full>
      <div className="comments">
        {list === null ? <div className="center-pad"><Spinner /></div>
          : list.length === 0 ? <div className="empty small"><h3>{t('noComments')}</h3><p>{t('startConversation')}</p></div>
            : tops.map((c) => {
              const reps = list.filter((x) => x.parentId === c.id);
              return (
                <div key={c.id}>
                  <CommentRow c={c} {...rowProps} />
                  {reps.length > 0 && (
                    <div className="replies">
                      {expanded[c.id] && reps.map((r) => <CommentRow key={r.id} c={r} {...rowProps} />)}
                      <button className="view-replies" onClick={() => setExpanded((x) => ({ ...x, [c.id]: !x[c.id] }))}>
                        <i />{expanded[c.id] ? t('hideReplies') : reps.length === 1 ? t('viewReply') : t('viewReplies', { n: reps.length })}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
      </div>
      {replyTo && (
        <div className="replying-bar">
          <span>{t('replyingTo', { u: replyTo.user.username })}</span>
          <button className="icon-btn" onClick={() => { setReplyTo(null); setText(''); }} aria-label="close">✕</button>
        </div>
      )}
      <div className="quick-emojis">
        {['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map((e) => <button key={e} onClick={() => { setText((x) => x + e); inputRef.current?.focus(); }}>{e}</button>)}
      </div>
      <div className="composer">
        <Avatar src={me?.avatarUrl} name={me?.username} size={34} />
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? t('replyingTo', { u: replyTo.user.username }) : t('addComment')} dir="auto"
          onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="text-link strong" disabled={!text.trim() || busy} onClick={send}>{t('post')}</button>
      </div>
    </Sheet>
  );
}

'''
s=s[:i]+new+s[j:]
open(p,'w').write(s)

p='/home/user/repo/src/screens/Notifications.jsx'; s=open(p).read()
old="      case 'comment': return t('nComment', { t: n.text });"
assert old in s
s=s.replace(old, old+"\n      case 'reply': return t('nReply', { t: n.text });\n      case 'comment_like': return t('nCommentLike', { t: n.text });",1)
open(p,'w').write(s)

p='/home/user/repo/src/styles.css'; s=open(p).read()
if '2.4.6' not in s:
    s+='''
/* 2.4.6 — comment replies / likes, photo filters */
.comment { position: relative; }
.comment.reply { padding-inline-start: 62px; padding-top: 6px; padding-bottom: 6px; }
.comment-actions { display: flex; align-items: center; gap: 14px; margin-top: 4px; font-size: 12px; color: var(--muted); font-weight: 600; }
.comment-actions button { color: inherit; font: inherit; padding: 2px 0; }
.by-author { display: inline-flex; align-items: center; gap: 3px; color: var(--muted); font-weight: 500; }
.by-author svg { color: #ed4956; }
.comment-like { flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px 0; min-width: 24px; color: var(--muted); font-size: 11px; }
.comment-like.on { color: #ed4956; }
.comment-like.on svg { animation: likePop .3s ease; }
@keyframes likePop { 50% { transform: scale(1.35); } }
.view-replies { display: flex; align-items: center; gap: 12px; margin: 2px 0 8px; padding: 4px 16px 4px 62px; font-size: 12px; font-weight: 600; color: var(--muted); }
.view-replies i { width: 24px; height: 1px; background: var(--muted); opacity: .6; }
.replying-bar { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px 6px 16px; background: var(--chip); font-size: 13px; color: var(--muted); }
.replying-bar .icon-btn { width: 32px; height: 32px; font-size: 14px; }
'''
    open(p,'w').write(s)
print('comments ok')
