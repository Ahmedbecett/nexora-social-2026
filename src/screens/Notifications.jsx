import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { t, timeAgo, errText } from '../i18n.js';
import { useApp, Avatar, TopBar, Tabs, Loading, Empty, ErrorBox, FollowButton, useAsync } from '../components.jsx';
import { IHeart } from '../icons.jsx';

const FILTERS = {
  all: () => true,
  follows: (n) => ['follow', 'follow_request', 'follow_accepted'].includes(n.type),
  likes: (n) => n.type === 'like',
  comments: (n) => ['comment', 'mention'].includes(n.type),
};

export default function Notifications() {
  const { nav, toast, refreshBadges, setBadges } = useApp();
  const [tab, setTab] = useState('all');
  const { loading, data, error, reload, setData } = useAsync(() => api('notifications'), []);
  useEffect(() => {
    api('notifications/read', { method: 'POST' }).then(() => { setBadges((b) => ({ ...b, notifications: 0 })); refreshBadges(); }).catch(() => {});
  }, []); // eslint-disable-line

  const respond = async (n, action) => {
    try {
      await api(`follow-requests/${n.actor.id}/${action}`, { method: 'POST' });
      setData((d) => ({ notifications: action === 'accept' ? d.notifications.map((x) => x.id === n.id ? { ...x, type: 'follow' } : x) : d.notifications.filter((x) => x.id !== n.id) }));
    } catch (e) { toast(errText(e.code)); }
  };

  const list = (data?.notifications || []).filter(FILTERS[tab]);
  const requests = list.filter((n) => n.type === 'follow_request');
  const rest = list.filter((n) => n.type !== 'follow_request');
  const day = 86400000;
  const groups = [
    [t('today'), rest.filter((n) => Date.now() - new Date(n.createdAt) < day)],
    [t('thisWeek'), rest.filter((n) => { const d = Date.now() - new Date(n.createdAt); return d >= day && d < 7 * day; })],
    [t('earlier'), rest.filter((n) => Date.now() - new Date(n.createdAt) >= 7 * day)],
  ].filter(([, l]) => l.length);

  const text = (n) => {
    switch (n.type) {
      case 'like': return t('nLike');
      case 'comment': return t('nComment', { t: n.text });
      case 'mention': return t('nMention', { t: n.text });
      case 'follow': return t('nFollow');
      case 'follow_request': return t('nRequest');
      case 'follow_accepted': return t('nAccepted');
      default: return '';
    }
  };

  const Row = ({ n }) => (
    <div className={`notif ${n.read ? '' : 'unread'}`} onClick={() => n.postId ? nav.push('post', { id: n.postId }) : nav.profile(n.actor.username)}>
      <Avatar src={n.actor.avatarUrl} name={n.actor.username} size={46} onClick={(e) => { e.stopPropagation(); nav.profile(n.actor.username); }} />
      <div className="notif-text">
        <b>{n.actor.username}</b> <span>{text(n)}</span> <span className="muted">{timeAgo(n.createdAt)}</span>
      </div>
      {n.type === 'follow_request' ? (
        <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-primary btn-sm" onClick={() => respond(n, 'accept')}>{t('confirm')}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => respond(n, 'decline')}>{t('delete')}</button>
        </div>
      ) : ['follow', 'follow_accepted'].includes(n.type) ? (
        <FollowButton user={n.actor} status={n.followStatus} small />
      ) : n.postThumb ? (
        n.postThumbType === 'video' ? <video disableRemotePlayback className="notif-thumb" src={n.postThumb + '#t=0.3'} muted /> : <img className="notif-thumb" src={n.postThumb} alt="" />
      ) : null}
    </div>
  );

  return (
    <div className="screen">
      <TopBar title={t('notifications')} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'all', label: t('all') }, { id: 'follows', label: t('follows') },
        { id: 'likes', label: t('likesTab') }, { id: 'comments', label: t('commentsTab') },
      ]} />
      <div className="scroll">
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : list.length === 0 ? (
          <Empty icon={<IHeart size={40} />} title={t('noNotifications')} sub={t('noNotificationsSub')} />
        ) : (
          <>
            {requests.length > 0 && <><div className="section-head pad"><b>{t('followRequests')}</b></div>{requests.map((n) => <Row key={n.id} n={n} />)}</>}
            {groups.map(([label, l]) => (
              <div key={label}><div className="section-head pad"><b>{label}</b></div>{l.map((n) => <Row key={n.id} n={n} />)}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
