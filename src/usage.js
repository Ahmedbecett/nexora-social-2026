// Local, on-device screen-time tracking for "Time management".
const KEY = 'nx_usage';
const LIMIT_KEY = 'nx_daily_limit';
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }

/** Add `seconds` of foreground time to today. Returns today's total minutes. */
export function addUsage(seconds) {
  const u = read();
  const k = dayKey();
  u[k] = (u[k] || 0) + seconds;
  // keep 30 days
  const keys = Object.keys(u);
  if (keys.length > 30) keys.slice(0, keys.length - 30).forEach((x) => delete u[x]);
  localStorage.setItem(KEY, JSON.stringify(u));
  return Math.floor(u[k] / 60);
}
export function usageDays(n = 7) {
  const u = read();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d), today: i === 0, minutes: Math.floor((u[dayKey(d)] || 0) / 60),
      label: d.toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'narrow' }),
    });
  }
  return out;
}
export const getDailyLimit = () => Number(localStorage.getItem(LIMIT_KEY)) || 0;
export const setDailyLimit = (m) => localStorage.setItem(LIMIT_KEY, String(m || 0));
export function limitReminderDue(todayMinutes) {
  const limit = getDailyLimit();
  if (!limit || todayMinutes < limit) return false;
  const k = `nx_limit_shown_${dayKey()}`;
  if (localStorage.getItem(k)) return false;
  localStorage.setItem(k, '1');
  return true;
}
