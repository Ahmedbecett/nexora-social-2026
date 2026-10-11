import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { t, timeAgo, errText } from '../i18n.js';
import { useApp, Avatar, TopBar, Loading, Empty, ErrorBox, FollowButton, useAsync, UserName } from '../components.jsx';
import { IHeart, IChevron, ICheck } from '../icons.jsx';

function sectionOf(date) {
  const d = new Date(date);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const diffDays = (start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000;
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'last7';
  if (diffDays < 30) return 'last30';
  return 'older';
}
const SECTION_ORDER = ['today', 'yesterday', 'last7', 'last30', 'older'];

/** Merge likes on the same post (within a section) into one row: "a and b liked your post". */
function aggregate(list) {
  const out = [];
  const likeIdx = new Map();
  for (const n of list) {
    if (n.type === 'like' && n.postId) {
      const k = n.postId;
      if (likeIdx.has(k)) { const g = out[likeIdx.get(k)]; if (!g.actors.some((a) => a.id === n.actor.id)) g.actors.push(n.actor); g.read = g.read && n.read; continue; }
      likeIdx.set(k, out.length);
    }
    out.push({ ...n, actors: [n.actor] });
  }
  return out;
}

function StackedAvatars({ users, size = 44 }) {
  if (users.length < 2) return <Avatar src={users[0]?.avatarUrl} name={users[0]?.username} size={size} />;
  return (
    <span className="stacked-av" style={{ width: size, height: size }}>
      <Avatar src={users[1].avatarUrl} name={users[1].username} size={size * 0.72} />
      <Avatar src={users[0].avatarUrl} name={users[0].username} size={size * 0.72} />
    </span>
  );
}

export default function Notifications() {
  const { nav, toast, refreshBadges, setBadges } = useApp();
  const { loading, data, error, reload, setData } = useAsync(() => Promise.all([api('notifications'), api('follow-requests')]).then(([n, r]) => ({ ...n, requests: r.users })), []);
  useEffect(() => {
    api('notifications/read', { method: 'POST' }).then(() => { setBadges((b) => ({ ...b, notifications: 0 })); refreshBadges(); }).catch(() => {});
  }, []); // eslint-disable-line

  const respond = async (actorId, action) => {
    try {
      await api(`follow-requests/${actorId}/${action}`, { method: 'POST' });
      setData((d) => ({
        ...d,
        requests: d.requests.filter((u) => u.id !== actorId),
        notifications: action === 'accept'
          ? d.notifications.map((x) => (x.actor.id === actorId && x.type === 'follow_request' ? { ...x, type: 'follow' } : x))
          : d.notifications.filter((x) => !(x.actor.id === actorId && x.type === 'follow_request')),
      }));
      refreshBadges();
    } catch (e) { toast(errText(e.code)); }
  };

  const text = (n) => {
    const others = n.actors.length - 1;
    switch (n.type) {
      case 'like': return others === 0 ? t('nLike') : others === 1 ? t('nLike2', { u: n.actors[1].username }) : t('nLikeMany', { n: others });
      case 'comment': return t('nComment', { t: n.text });
      case 'mention': return t('nMention', { t: n.text });
      case 'follow': return t('nFollow');
      case 'follow_request': return t('nRequest');
      case 'follow_accepted': return t('nAccepted');
      case 'repost': return t('nRepost');
      default: return '';
    }
  };

  const Row = ({ n }) => (
    <div className={`notif ${n.read ? '' : 'unread'}`} onClick={() => (n.postId ? nav.push('post', { id: n.postId }) : nav.profile(n.actor.username))}>
      <span onClick={(e) => { e.stopPropagation(); nav.profile(n.actor.username); }}><StackedAvatars users={n.actors} size={46} /></span>
      <div className="notif-text">
        <b><bdi>{n.actor.username}</bdi></b> <span dir="auto">{text(n)}</span> <span className="muted">{timeAgo(n.createdAt)}</span>
      </div>
      {n.type === 'follow_request' ? (
        <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-primary btn-sm" onClick={() => respond(n.actor.id, 'accept')}>{t('confirm')}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => respond(n.actor.id, 'decline')}>{t('delete')}</button>
        </div>
      ) : ['follow', 'follow_accepted'].includes(n.type) ? (
        <span onClick={(e) => e.stopPropagation()}><FollowButton user={n.actor} status={n.followStatus} small /></span>
      ) : n.postThumb ? (
        n.postThumbType === 'video' ? <video disableRemotePlayback className="notif-thumb" src={n.postThumb + '#t=0.3'} muted /> : <img className="notif-thumb" src={n.postThumb} alt="" />
      ) : null}
    </div>
  );

  const all = data?.notifications || [];
  const requests = data?.requests || [];
  const bySection = SECTION_ORDER.map((k) => [k, aggregate(all.filter((n) => sectionOf(n.createdAt) === k))]).filter(([, l]) => l.length);
  const hasUnread = all.some((n) => !n.read);
  const labels = { today: t('today'), yesterday: t('yesterday'), last7: t('last7days'), last30: t('last30days'), older: t('earlier') };

  return (
    <div className="screen">
      <TopBar title={t('notifications')} className="start-title" />
      <div className="scroll">
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
          <>
            {requests.length > 0 && (
              <button className="req-row" onClick={() => nav.push('followRequests', { onChange: reload })}>
                <StackedAvatars users={requests} size={50} />
                <span className="flex1 req-text">
                  <b>{t('followRequests')}</b>
                  <span className="muted"><bdi>{requests[0].username}</bdi>{requests.length > 1 ? ` ${t('plusOthers', { n: requests.length - 1 })}` : ''}</span>
                </span>
                <i className="blue-dot" /><IChevron size={20} className="muted" />
              </button>
            )}
            {all.length === 0 && requests.length === 0 && <Empty icon={<IHeart size={40} />} title={t('noNotifications')} sub={t('noNotificationsSub')} />}
            {bySection.map(([k, l], i) => (
              <div key={k}>
                <div className="notif-section">{labels[k]}</div>
                {l.map((n) => <Row key={n.id} n={n} />)}
                {i === 0 && hasUnread && (
                  <div className="caught-row">
                    <span className="caught-circle"><ICheck size={26} /></span>
                    <span className="flex1"><b>{t('caughtUp')}</b><small className="muted">{t('caughtUpNotif')}</small></span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function FollowRequests({ onChange }) {
  const { nav, toast, refreshBadges } = useApp();
  const [users, setUsers] = useState(null);
  const [done, setDone] = useState({});
  useEffect(() => { api('follow-requests').then((r) => setUsers(r.users)).catch(() => setUsers([])); }, []);
  useEffect(() => () => { onChange?.(); refreshBadges(); }, []); // eslint-disable-line
  const respond = async (u, action) => {
    try { await api(`follow-requests/${u.id}/${action}`, { method: 'POST' }); setDone((d) => ({ ...d, [u.id]: action })); }
    catch (e) { toast(errText(e.code)); }
  };
  return (
    <div className="screen">
      <TopBar title={t('followRequests')} className="start-title" />
      <div className="scroll">
        {users === null ? <Loading /> : users.length === 0 ? <Empty sub={t('noRequests')} /> : (
          <div className="user-list">
            {users.map((u) => (
              <div key={u.id} className="user-row">
                <Avatar src={u.avatarUrl} name={u.username} size={50} onClick={() => nav.profile(u.username)} />
                <div className="user-row-text" onClick={() => nav.profile(u.username)}><UserName user={u} /><span className="muted">{u.fullName} · {timeAgo(u.requestedAt)}</span></div>
                {done[u.id] ? (
                  done[u.id] === 'accept' ? <FollowButton user={u} status="none" small /> : <span className="muted small">{t('removed')}</span>
                ) : (
                  <div className="notif-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => respond(u, 'accept')}>{t('confirm')}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => respond(u, 'decline')}>{t('delete')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
