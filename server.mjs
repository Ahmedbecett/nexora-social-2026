/* NEXORA voice gateway — خدمة صغيرة على سيرفرنا الخاص.
   تستقبل الصوت من تطبيق/صفحة Nexora عبر Vercel، وتوزّع التفريغ والنطق على مزوّدين
   بدل مزوّد واحد. لا تُكشف المفاتيح للمتصفح أبدًا؛ فقط الخادم يحملها.

   المسارات:
     GET  /health          — حالة الخدمة (بدون أسرار)
     POST /v1/stt          — { audio: base64, mime } → { text, provider }
     POST /v1/tts          — { text, voice? }        → { audioB64, mime, provider }

   المصادقة: ترويسة x-gateway-secret تساوي GATEWAY_SECRET (مقارنة ثابتة الزمن).
   المتغيرات: GATEWAY_SECRET, GROQ_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION,
              PORT (افتراضي 8080), GROQ_BASE/AZURE_BASE (للاختبار فقط).
*/
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.GATEWAY_SECRET || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const AZ_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZ_REGION = process.env.AZURE_SPEECH_REGION || '';
const GROQ_BASE = process.env.GROQ_BASE || 'https://api.groq.com/openai/v1';
const AZURE_BASE = process.env.AZURE_BASE || (AZ_REGION ? `https://${AZ_REGION}.tts.speech.microsoft.com` : '');
const MAX_BODY = 4 * 1024 * 1024;           // ~3 MB صوت بعد الترميز
const STT_TIMEOUT = 12000, TTS_TIMEOUT = 12000;
const DEFAULT_VOICE = 'ar-DZ-AminaNeural';   // صوت جزائري (يُتحقق منه قبل الإنتاج)
const ALLOWED_VOICES = new Set(['ar-DZ-AminaNeural', 'ar-DZ-IsmaelNeural', 'fr-FR-DeniseNeural', 'en-US-JennyNeural']);
const MAX_TTS_CHARS = 900;

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

function authorized(req) {
  if (!SECRET) return false;
  const got = String(req.headers['x-gateway-secret'] || '');
  const a = Buffer.from(got), b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('body_too_large'), { status: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('bad_json'), { status: 400 }); }
}

/* ---------- STT: Groq Whisper (واجهة متوافقة مع OpenAI) ---------- */
const EXT = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/flac': 'flac', 'audio/aac': 'm4a' };
export async function transcribe({ audio, mime }) {
  if (!GROQ_KEY) throw Object.assign(new Error('stt_not_configured'), { status: 503 });
  const type = String(mime || 'audio/webm').split(';')[0].toLowerCase();
  const ext = EXT[type] || 'webm';
  const buf = Buffer.from(String(audio || ""), "base64");
  if (!buf.length) throw Object.assign(new Error('audio_required'), { status: 400 });
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), 'voice.' + ext);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  const r = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + GROQ_KEY }, body: form,
    signal: AbortSignal.timeout(STT_TIMEOUT),
  });
  if (!r.ok) throw Object.assign(new Error('stt_upstream_' + r.status), { status: 502 });
  const d = await r.json();
  // Whisper يهلوس على الصمت: نُسقط المقاطع ذات احتمال "لا كلام" المرتفع
  const segs = Array.isArray(d.segments) ? d.segments : [];
  const speech = segs.filter((s) => (s.no_speech_prob ?? 0) < 0.6);
  const text = (segs.length ? speech.map((s) => String(s.text || '').trim()).filter(Boolean).join(' ') : String(d.text || '')).trim();
  return { text, provider: 'groq-whisper-large-v3-turbo' };
}

/* ---------- TTS: Azure Speech (REST) ---------- */
const esc = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export async function synthesize({ text, voice }) {
  const v = ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE;
  const clean = String(text || '').replace(/[*_#>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS);
  if (!clean) throw Object.assign(new Error('text_required'), { status: 400 });
  if (AZ_KEY && AZURE_BASE) return synthesizeAzure(clean, v);
  return synthesizeEdge(clean, v);
}

/* ---------- TTS بديل مجاني: خدمة قراءة Edge (بلا مفتاح). غير رسمية وقد تتغيّر دون إشعار ---------- */
async function synthesizeEdge(clean, v) {
  const tts = new MsEdgeTTS();
  const work = (async () => {
    await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(clean);
    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on('data', (c) => chunks.push(c));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });
    return Buffer.concat(chunks);
  })();
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('tts_timeout'), { status: 504 })), TTS_TIMEOUT); });
  try {
    const audio = await Promise.race([work, limit]);
    if (!audio.length) throw Object.assign(new Error('tts_empty'), { status: 502 });
    return { audioB64: audio.toString('base64'), mime: 'audio/mpeg', provider: 'edge-tts', voice: v };
  } catch (e) {
    throw e.status ? e : Object.assign(new Error('tts_upstream_failed'), { status: 502 });
  } finally {
    clearTimeout(timer);
    try { tts.close(); } catch {}
  }
}

async function synthesizeAzure(clean, v) {
  const lang = v.slice(0, 5);
  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${v}">${esc(clean)}</voice></speak>`;
  const r = await fetch(`${AZURE_BASE}/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZ_KEY, 'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'nexora-gateway' },
    body: ssml, signal: AbortSignal.timeout(TTS_TIMEOUT),
  });
  if (!r.ok) throw Object.assign(new Error('tts_upstream_' + r.status), { status: 502 });
  const audio = Buffer.from(await r.arrayBuffer());
  return { audioB64: audio.toString('base64'), mime: 'audio/mpeg', provider: 'azure-speech', voice: v };
}

/* ---------- الخادم ---------- */
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, stt: !!GROQ_KEY, tts: true, ttsProvider: AZ_KEY && AZURE_BASE ? 'azure' : 'edge', time: new Date().toISOString() });
      }
      if (req.method !== 'POST' || !['/v1/stt', '/v1/tts'].includes(url.pathname)) return json(res, 404, { error: 'not_found' });
      if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
      const body = await readJson(req);
      if (url.pathname === "/v1/stt") return json(res, 200, await transcribe(body));
      return json(res, 200, await synthesize(body));
    } catch (e) {
      const status = e.status || (e.name === 'TimeoutError' ? 504 : 500);
      return json(res, status, { error: e.message || 'server_error' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!SECRET) { console.error('GATEWAY_SECRET is required'); process.exit(1); }
  createServer().listen(PORT, '0.0.0.0', () => console.log('nexora-gateway listening on ' + PORT));
}
