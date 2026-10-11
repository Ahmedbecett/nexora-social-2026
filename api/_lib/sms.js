// Free SMS delivery through the owner's own Android phone (SIM plan) instead of paid Firebase SMS.
// Providers:
//   smsgate  – "SMS Gateway for Android" (https://sms-gate.app), cloud mode, Basic auth
//              SMSGATE_USER, SMSGATE_PASS [, SMSGATE_URL]
//   textbee  – https://textbee.dev   TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID
export function smsProvider() {
  const p = (process.env.SMS_PROVIDER || '').toLowerCase();
  if ((p === 'smsgate' || !p) && process.env.SMSGATE_USER && process.env.SMSGATE_PASS) return 'smsgate';
  if ((p === 'textbee' || !p) && process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID) return 'textbee';
  return null;
}

export async function sendSms(phone, text) {
  const provider = smsProvider();
  const ctrl = AbortSignal.timeout(12000);
  if (provider === 'smsgate') {
    const url = process.env.SMSGATE_URL || 'https://api.sms-gate.app/3rdparty/v1/messages';
    const auth = Buffer.from(`${process.env.SMSGATE_USER}:${process.env.SMSGATE_PASS}`).toString('base64');
    const r = await fetch(url, {
      method: 'POST', signal: ctrl,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [phone], ttl: 600 }),
    });
    if (!r.ok) throw new Error(`smsgate ${r.status} ${(await r.text()).slice(0, 200)}`);
    return (await r.json().catch(() => ({})))?.id || true;
  }
  if (provider === 'textbee') {
    const r = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${process.env.TEXTBEE_DEVICE_ID}/send-sms`, {
      method: 'POST', signal: ctrl,
      headers: { 'x-api-key': process.env.TEXTBEE_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: [phone], message: text }),
    });
    if (!r.ok) throw new Error(`textbee ${r.status} ${(await r.text()).slice(0, 200)}`);
    return true;
  }
  throw new Error('sms_not_configured');
}
