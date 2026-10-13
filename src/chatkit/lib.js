/**
 * ChatKit — client-side engines behind every icon of the new chat bar.
 *
 *   📍 Location      → searchPlaces / reverseGeocode (OpenStreetMap Nominatim)
 *                      + makeMapCard()، وهي خريطة مصغّرة تُرسم محلياً (تعمل بلا إنترنت)
 *   🖼️ AI images     → generateAiImage() (Pollinations، مجاني بلا مفتاح) مع مولّد فني محلي احتياطي
 *   ✍️ Draw          → لوحة الرسم في ChatKit.jsx تُصدّر PNG شفاف
 *   ✳️ AI assistant  → aiChat()/aiIdeas() + ترجمة مجانية (MyMemory)
 *   🎞️ GIFs/Stickers → GIPHY API عند توفّر مفتاح، وإلا الحزمة المحلية المرفقة
 *
 * كل الدوال آمنة: لا ترمي استثناءات قاتلة، وعند فشل الشبكة ترجع نسخة محلية.
 */

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h >>> 0);
}
/** مولّد أرقام شبه عشوائي ثابت (نفس المدخل = نفس الرسم). */
export function seeded(seed) {
  let s = Number(seed) || 1;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
export function fmtDur(s) { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export function vibrate(ms = 12) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } }

/* ------------------------------------------------------------------ *
 *  canvas / upload helpers
 * ------------------------------------------------------------------ */
export function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image_load_failed'));
    im.src = src;
  });
}
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
export function canvasToBlob(c, type = 'image/png', q = 0.92) {
  return new Promise((resolve) => c.toBlob((b) => resolve(b), type, q));
}
/** يرسم صورة/ملف SVG على canvas ويُرجع PNG blob (يُستعمل لإرسال الملصقات). */
export async function rasterize(src, size = 512, { bg = null, mime = 'image/png', quality = 0.92 } = {}) {
  const im = await loadImg(src);
  const c = document.createElement('canvas');
  const ratio = im.naturalWidth / im.naturalHeight || 1;
  c.width = ratio >= 1 ? size : Math.round(size * ratio);
  c.height = ratio >= 1 ? Math.round(size / ratio) : size;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(im, 0, 0, c.width, c.height);
  return { blob: await canvasToBlob(c, mime, quality), w: c.width, h: c.height };
}
/* ------------------------------------------------------------------ *
 *  📍 Location
 * ------------------------------------------------------------------ */
const PLACES_FALLBACK = [
  { name: 'ورقلة، الجزائر', lat: 31.9494, lng: 5.3255 }, { name: 'الجزائر العاصمة، الجزائر', lat: 36.7538, lng: 3.0588 },
  { name: 'حاسي مسعود، الجزائر', lat: 31.6575, lng: 6.0731 }, { name: 'تقرت، الجزائر', lat: 33.1017, lng: 6.0665 },
  { name: 'غرداية، الجزائر', lat: 32.4909, lng: 3.6735 }, { name: 'وهران، الجزائر', lat: 35.6969, lng: -0.6331 },
  { name: 'قسنطينة، الجزائر', lat: 36.365, lng: 6.6147 }, { name: 'عنابة، الجزائر', lat: 36.9, lng: 7.7667 },
  { name: 'سطيف، الجزائر', lat: 36.1906, lng: 5.4098 }, { name: 'بشار، الجزائر', lat: 31.6167, lng: -2.2167 },
  { name: 'تمنراست، الجزائر', lat: 22.785, lng: 5.5228 }, { name: 'الأغواط، الجزائر', lat: 33.8, lng: 2.865 },
  { name: 'بسكرة، الجزائر', lat: 34.8503, lng: 5.7281 }, { name: 'البليدة، الجزائر', lat: 36.4703, lng: 2.8277 },
  { name: 'تونس العاصمة، تونس', lat: 36.8065, lng: 10.1815 }, { name: 'الدار البيضاء، المغرب', lat: 33.5731, lng: -7.5898 },
  { name: 'القاهرة، مصر', lat: 30.0444, lng: 31.2357 }, { name: 'الرياض، السعودية', lat: 24.7136, lng: 46.6753 },
  { name: 'دبي، الإمارات', lat: 25.2048, lng: 55.2708 }, { name: 'مكة المكرمة، السعودية', lat: 21.3891, lng: 39.8579 },
  { name: 'باريس، فرنسا', lat: 48.8566, lng: 2.3522 }, { name: 'إستنبول، تركيا', lat: 41.0082, lng: 28.9784 },
  { name: 'نيويورك، أمريكا', lat: 40.7128, lng: -74.006 }, { name: 'لندن، بريطانيا', lat: 51.5072, lng: -0.1276 },
];
export const norm = (s) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

/** بحث أماكن: Nominatim أولاً ثم قائمة محلية عند انقطاع الشبكة. */
export async function searchPlaces(q) {
  const query = String(q || '').trim();
  if (!query) return PLACES_FALLBACK.slice(0, 8).map((p) => ({ ...p, source: 'local' }));
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ar,en&q=${encodeURIComponent(query)}`, {
      signal: ctl.signal, headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    const j = await r.json();
    const list = (Array.isArray(j) ? j : []).map((x) => ({
      name: String(x.display_name || '').split(',').slice(0, 3).join(', ') || query,
      lat: Number(x.lat), lng: Number(x.lon), source: 'osm',
    })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
    if (list.length) return list;
  } catch { /* offline → fallback */ }
  return PLACES_FALLBACK.filter((p) => norm(p.name).includes(norm(query))).slice(0, 8)
    .map((p) => ({ ...p, source: 'local' }));
}

/** اسم المكان من الإحداثيات (reverse geocoding) — يرجع '' عند الفشل. */
export async function reverseGeocode(lat, lng) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ar,en&lat=${lat}&lon=${lng}`, {
      signal: ctl.signal, headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    const j = await r.json();
    const a = j?.address || {};
    const parts = [j?.name || a.road || a.suburb, a.city || a.town || a.village || a.state, a.country].filter(Boolean);
    return [...new Set(parts)].slice(0, 2).join('، ');
  } catch { return ''; }
}

export function getPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no_geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(e), { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

/** خريطة مصغّرة مرسومة محلياً (شارات طرق + حدائق + بحيرة + دبوس) — تعمل بلا إنترنت. */
export async function makeMapCard({ lat, lng, place = '', label = '', w = 720, h = 480, theme = 'dark' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const rndm = seeded(Math.round((lat || 0) * 1e5) ^ Math.round((lng || 0) * 1e5));
  const dark = theme === 'dark';
  x.fillStyle = dark ? '#141a20' : '#eaf0f6';
  x.fillRect(0, 0, w, h);

  // blocks / built-up areas
  for (let i = 0; i < 90; i++) {
    const bw = rnd(30, 130), bh = rnd(24, 110), bx = rnd(-20, w), by = rnd(-20, h);
    x.fillStyle = dark ? (rndm() > .5 ? '#1b232b' : '#1f2831') : (rndm() > .5 ? '#dde7ef' : '#e3ecf3');
    x.fillRect(bx, by, bw, bh);
  }
  // parks + water
  for (let i = 0; i < 3; i++) {
    const px = rnd(0, w), py = rnd(0, h), r = rnd(46, 120);
    x.fillStyle = dark ? 'rgba(38,74,52,.75)' : '#cfe9d2';
    x.beginPath(); x.ellipse(px, py, r, r * rnd(.6, .95), rnd(0, 3), 0, Math.PI * 2); x.fill();
  }
  const wx = rnd(0, w);
  x.strokeStyle = dark ? 'rgba(46,92,142,.8)' : '#bcdcf7';
  x.lineWidth = rnd(16, 30); x.beginPath();
  x.moveTo(wx, -20); x.bezierCurveTo(wx + 70, h * .3, wx - 80, h * .7, wx + 40, h + 20); x.stroke();

  // roads: a few long arteries + a grid
  const road = (width, color, fn) => { x.strokeStyle = color; x.lineWidth = width; x.beginPath(); fn(); x.stroke(); };
  const roadCol = dark ? '#2c3641' : '#ffffff';
  const roadMain = dark ? '#3b4855' : '#ffffff';
  for (let i = 0; i < 5; i++) {
    const y0 = rnd(0, h);
    road(rnd(22, 34), roadMain, () => { x.moveTo(-20, y0); x.bezierCurveTo(w * .3, y0 + rnd(-70, 70), w * .7, y0 + rnd(-70, 70), w + 20, y0 + rnd(-60, 60)); });
  }
  for (let i = 0; i < 4; i++) {
    const x0 = rnd(0, w);
    road(rnd(16, 26), roadCol, () => { x.moveTo(x0, -20); x.bezierCurveTo(x0 + rnd(-60, 60), h * .33, x0 + rnd(-60, 60), h * .66, x0 + rnd(-50, 50), h + 20); });
  }
  for (let i = 0; i < 22; i++) {
    const y0 = rnd(0, h);
    road(rnd(6, 11), dark ? '#242d36' : '#f2f6fa', () => { x.moveTo(-10, y0); x.lineTo(w + 10, y0 + rnd(-16, 16)); });
  }
  // highway accent
  x.strokeStyle = dark ? 'rgba(255,196,0,.5)' : 'rgba(255,170,0,.55)';
  x.lineWidth = 9; x.beginPath(); x.moveTo(-10, rnd(0, h)); x.bezierCurveTo(w * .35, rnd(0, h), w * .65, rnd(0, h), w + 10, rnd(0, h)); x.stroke();

  // vignette
  const g = x.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * .85);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, dark ? 'rgba(0,0,0,.45)' : 'rgba(30,50,70,.12)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  // pin
  const cx = w / 2, cy = h / 2, s = Math.min(w, h) / 480;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 26 * s; x.shadowOffsetY = 12 * s;
  x.fillStyle = '#ff2d55';
  x.beginPath();
  x.moveTo(cx, cy + 30 * s); x.lineTo(cx - 40 * s, cy - 34 * s);
  x.quadraticCurveTo(cx - 46 * s, cy - 74 * s, cx, cy - 78 * s);
  x.quadraticCurveTo(cx + 46 * s, cy - 74 * s, cx + 40 * s, cy - 34 * s);
  x.closePath(); x.fill();
  x.restore();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy - 46 * s, 17 * s, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ff2d55'; x.beginPath(); x.arc(cx, cy - 46 * s, 8 * s, 0, Math.PI * 2); x.fill();

  // labels
  const pad = 22;
  x.fillStyle = dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.86)';
  x.beginPath(); x.roundRect(pad, h - 104, w - pad * 2, 80, 20); x.fill();
  x.fillStyle = dark ? '#fff' : '#0d1b26';
  let title = (place || label || '').trim();
  if (!title) title = (lat >= 0 ? 'N' : 'S') + Math.abs(lat).toFixed(3) + '°, ' + (lng >= 0 ? 'E' : 'W') + Math.abs(lng).toFixed(3) + '°';
  x.font = '700 29px system-ui, Roboto, sans-serif'; x.textBaseline = 'middle';
  while (title.length > 4 && x.measureText(title).width > w - pad * 2 - 40) title = title.slice(0, -2);
  x.fillText(title, pad + 20, h - 66);
  x.fillStyle = dark ? '#a9b6c2' : '#54697a';
  x.font = '400 22px system-ui, Roboto, sans-serif';
  const coord = `${Math.abs(lat ?? 0).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng ?? 0).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`;
  x.fillText(coord, pad + 20, h - 36);
  x.fillStyle = '#4cb5f9'; x.font = '700 20px system-ui, Roboto, sans-serif';
  x.fillText('© OpenStreetMap', pad + 20, 34);

  return { blob: await canvasToBlob(c, 'image/jpeg', 0.86), w, h };
}
export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/* ------------------------------------------------------------------ *
 *  🖼️ AI images
 * ------------------------------------------------------------------ */
export const aiImageCfg = () => ({
  endpoint: localStorage.getItem('nx_ai_img_endpoint') || 'https://image.pollinations.ai/prompt',
  model: localStorage.getItem('nx_ai_img_model') || 'turbo',
});
export function aiImageUrl(prompt, { w = 1024, h = 1024, seed = 0, style = '', model: modelOverride = '' } = {}) {
  const cfg = aiImageCfg();
  const endpoint = cfg.endpoint;
  const model = modelOverride || cfg.model;
  const full = [String(prompt || '').trim(), style].filter(Boolean).join(', ');
  const qs = new URLSearchParams({ width: String(w), height: String(h), nologo: 'true', model, seed: String(seed || Math.floor(Math.random() * 1e6)) });
  return `${endpoint}/${encodeURIComponent(full)}?${qs}`;
}
/** يرسم لوحة فنية إجرائية من نص الوصف (احتياطي بلا إنترنت + معاينة فورية). */
export async function proceduralArt(prompt, { w = 1024, h = 1024 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const r = seeded(hashStr(prompt) || 7);
  const hue = Math.floor(r() * 360);
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue} 85% 22%)`); g.addColorStop(.5, `hsl(${(hue + 40) % 360} 80% 42%)`); g.addColorStop(1, `hsl(${(hue + 110) % 360} 85% 18%)`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    x.globalAlpha = 0.12 + r() * 0.35;
    x.fillStyle = `hsl(${(hue + r() * 200) % 360} 90% ${40 + r() * 50}%)`;
    const rr = (0.06 + r() * 0.4) * h;
    x.beginPath(); x.ellipse(r() * w, r() * h, rr, rr * (0.4 + r()), r() * 3, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 9; i++) {
    x.strokeStyle = `hsla(${(hue + r() * 240) % 360} 100% 85% / ${0.1 + r() * .3})`;
    x.lineWidth = 1 + r() * 12;
    x.beginPath(); x.moveTo(r() * w, r() * h);
    x.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); x.stroke();
  }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, h - 92, w, 92);
  x.fillStyle = '#fff'; x.font = '600 30px system-ui, sans-serif';
  const txt = String(prompt || '').slice(0, 46);
  x.fillText(txt, 28, h - 36);
  return { blob: await canvasToBlob(c, 'image/jpeg', 0.9), w, h, procedural: true };
}
/** يحمّل صورة من الشبكة عبر عنصر <img> (أسرع وأكثر تحمّلاً من fetch، ويعمل مع أي مضيف). */
export function loadImageUrl(url, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; im.src = ''; reject(new Error('timeout')); } }, timeout);
    im.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(im); } };
    im.onerror = () => { if (!done) { done = true; clearTimeout(t); reject(new Error('load_failed')); } };
    im.src = url;
  });
}
/**
 * يولّد صورة بالذكاء الاصطناعي: نُحمّل الناتج مباشرة كصورة ونُرسل رابطها (بلا رفع)،
 * وإن تعذّر الاتصال نرجع مولّداً محلياً (blob) حتى لا تتعطّل الميزة.
 */
export async function generateAiImage(prompt, { w = 1024, h = 1024, style = '', seed = 0, timeout = 90000, onStage } = {}) {
  onStage?.('generating');
  const chosen = aiImageCfg().model;
  const attempts = [
    { model: chosen, seed: seed || Math.floor(Math.random() * 1e6) },
    { model: chosen === 'turbo' ? 'flux' : 'turbo', seed: Math.floor(Math.random() * 1e6) },
  ];
  for (const at of attempts) {
    const url = aiImageUrl(prompt, { w, h, style, seed: at.seed, model: at.model });
    try {
      const im = await loadImageUrl(url, timeout);
      if (im.naturalWidth > 8 && im.naturalHeight > 8) {
        onStage?.('done');
        return { url, w: im.naturalWidth, h: im.naturalHeight, remote: true, model: at.model };
      }
    } catch { /* المحاولة التالية */ }
  }
  onStage?.('offline');
  const art = await proceduralArt(prompt, { w: 768, h: 768 });
  art.url = URL.createObjectURL(art.blob);
  return art;
}
export const AI_STYLES = [
  { id: 'none', label: 'بلا نمط', en: 'No style', suffix: '' },
  { id: 'photo', label: 'صورة واقعية', en: 'Photo', suffix: 'photorealistic, 50mm, natural light, highly detailed' },
  { id: 'anime', label: 'أنمي', en: 'Anime', suffix: 'anime style, cel shading, vibrant colors, studio quality' },
  { id: '3d', label: 'ثلاثي الأبعاد', en: '3D', suffix: '3d render, octane, soft studio lighting, pixar style' },
  { id: 'neon', label: 'نيون', en: 'Neon', suffix: 'neon lights, cyberpunk, glowing, night, cinematic' },
  { id: 'watercolor', label: 'ألوان مائية', en: 'Watercolor', suffix: 'watercolor painting, paper texture, soft washes' },
  { id: 'sticker', label: 'ملصق', en: 'Sticker', suffix: 'die cut sticker, thick white outline, flat colors, centered, plain background' },
  { id: 'minimal', label: 'بسيط', en: 'Minimal', suffix: 'minimalist, flat design, few colors, clean composition' },
];
export const AI_PROMPT_IDEAS = [
  'قطة تشرب قهوة في مقهى في وهران', 'صحراء ورقلة عند الغروب', 'رائد فضاء يرسم على القمر',
  'قلعة قديمة وسط الضباب', 'سمكة ذهبية تسبح في سحابة', 'مدينة جزائرية قديمة بألوان مائية',
  'روبوت لطيف يزرع شجرة', 'غروب الشمس فوق البحر الأبيض المتوسط',
];

/* ------------------------------------------------------------------ *
 *  ✳️ Nexora AI (assistant) — يعمل محلياً + مزوّد متوافق مع OpenAI اختياري
 * ------------------------------------------------------------------ */
export const aiCfg = () => ({
  key: localStorage.getItem('nx_ai_key') || '',
  base: localStorage.getItem('nx_ai_base') || 'https://api.openai.com/v1',
  model: localStorage.getItem('nx_ai_model') || 'gpt-4o-mini',
});
export const aiConfigured = () => !!aiCfg().key;
export function setAiCfg({ key, base, model }) {
  if (key !== undefined) key ? localStorage.setItem('nx_ai_key', key.trim()) : localStorage.removeItem('nx_ai_key');
  if (base) localStorage.setItem('nx_ai_base', base.trim().replace(/\/$/, ''));
  if (model) localStorage.setItem('nx_ai_model', model.trim());
}

/** مولّد ردود محلي: يقترح 3 ردود قصيرة مناسبة بناءً على آخر رسائل الطرف الآخر. */
export function localReplies(lastMessages = []) {
  const last = [...lastMessages].reverse().find((m) => !m.mine) || lastMessages[lastMessages.length - 1] || {};
  const txt = String(last.text || '').trim();
  const t = norm(txt);
  const out = [];
  if (/[?؟]/.test(txt)) out.push('نعم بالتأكيد 👍', 'خليني نفكر ونرجعلك', 'لا، للأسف ماشي ممكن دابا');
  if (/سلام|صباح|مسا|مرحبا|اهلا|hello|hi/.test(t)) out.push('وعليكم السلام 🌟', 'مرحبا، كيف حالك؟', 'أهلاً بيك 😄');
  if (/شكرا|merci|thanks/.test(t)) out.push('العفو 🙏', 'بلا مزية 😊', 'على الرحب والسعة');
  if (/وين|فين|where/.test(t)) out.push('راني في الدار', 'راني خارج، نرجع بعد شوية', 'قريب منك 😉');
  if (/كي راك|كيف حالك|كيفك|labas|ça va/.test(t)) out.push('الحمد لله، وانت؟', 'بخير، شكراً على السؤال 😊', 'لاباس، ربي يخليك');
  if (/وقت|متى|when/.test(t)) out.push('نشوف ونقولك 📅', 'غدوة إن شاء الله', 'الليلة إن شاء الله');
  if (last.mediaType === 'audio') out.push('سمعت الصوت 🔊', 'مليح، شكراً على الرسالة الصوتية', 'راني نسمع فيه درك');
  if (last.mediaType === 'image' || last.mediaUrl) out.push('تبارك الله، صورة زوينة 😍', 'مليحة بزاف 👌', 'وين هذي؟ 😯');
  out.push('مليح 👌', 'ماشي مشكل', 'نشوف ونقولك', 'شكراً على الرسالة 🌟', 'ههههه 😂', 'راني هنا إذا احتجتني');
  return [...new Set(out)].slice(0, 6);
}
/** تلخيص محلي بسيط للمحادثة. */
export function localSummary(messages = []) {
  const mine = messages.filter((m) => m.mine).length;
  const last = messages[messages.length - 1];
  const parts = [];
  parts.push(`المحادثة فيها ${messages.length} رسالة (${mine} منك، ${messages.length - mine} من الطرف الآخر).`);
  const media = messages.filter((m) => m.mediaUrl).length;
  if (media) parts.push(`فيها ${media} مرفق (صور/صوت/فيديو).`);
  if (last) {
    const who = last.mine ? 'آخر رسالة منك' : 'آخر رسالة منهم';
    parts.push(`${who}: «${String(last.text || 'مرفق').slice(0, 80)}».`);
  }
  const words = {}; 
  for (const m of messages) for (const w of String(m.text || '').split(/\s+/)) if (w.length > 3) words[w] = (words[w] || 0) + 1;
  const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  if (top.length) parts.push(`الكلمات الأكثر تكراراً: ${top.join('، ')}.`);
  return parts.join(' ');
}
/** دردشة مع الوكيل: يستعمل مزوّداً حقيقياً إن وُجد مفتاح، وإلا يجيب محلياً. */
export async function aiChat({ messages = [], system = '', onLocal } = {}) {
  const cfg = aiCfg();
  if (cfg.key) {
    try {
      const r = await fetch(`${cfg.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model: cfg.model, temperature: 0.8, messages: [{ role: 'system', content: system }, ...messages] }),
      });
      const j = await r.json();
      const txt = j?.choices?.[0]?.message?.content;
      if (txt) return { text: txt.trim(), remote: true };
      throw new Error(j?.error?.message || 'ai_failed');
    } catch (e) { /* يتابع محلياً */ }
  }
  return { text: onLocal?.() || 'أنا نيكسورا AI، اكتب سؤالك وسنجاوبك 🙌', local: true };
}
/** ترجمة مجانية (MyMemory) مع احتياطي محلي. */
export async function translateText(text, to = 'en', from = '') {
  const src = String(text || '').trim();
  if (!src) return '';
  try {
    const pair = `${from || 'auto'}|${to}`;
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(src.slice(0, 480))}&langpair=${encodeURIComponent(pair)}`);
    const j = await r.json();
    const out = j?.responseData?.translatedText;
    if (out && !/MYMEMORY WARNING|INVALID/i.test(out)) return out;
  } catch { /* ignore */ }
  return '';
}

/* ------------------------------------------------------------------ *
 *  🎞️ GIPHY (مفتاح اختياري) + الحزمة المحلية
 * ------------------------------------------------------------------ */
export const giphyKey = () => localStorage.getItem('nx_giphy_key') || import.meta.env.VITE_GIPHY_KEY || '';
export const setGiphyKey = (k) => { k ? localStorage.setItem('nx_giphy_key', k.trim()) : localStorage.removeItem('nx_giphy_key'); };
export async function giphySearch(q, kind = 'gifs', limit = 24) {
  const key = giphyKey();
  if (!key) return null;
  const base = kind === 'stickers' ? 'stickers' : 'gifs';
  const path = q ? `${base}/search?q=${encodeURIComponent(q)}` : `${base}/trending?`;
  try {
    const r = await fetch(`https://api.giphy.com/v1/${path}${q ? '&' : ''}limit=${limit}&rating=pg-13&lang=ar&api_key=${key}`);
    const j = await r.json();
    if (!Array.isArray(j?.data)) return null;
    return j.data.map((g) => ({
      id: g.id, url: g.images?.fixed_height?.url || g.images?.original?.url,
      preview: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
      w: Number(g.images?.fixed_height?.width) || 200, h: Number(g.images?.fixed_height?.height) || 200,
      title: g.title || '', source: 'giphy',
    })).filter((g) => g.url);
  } catch { return null; }
}

/* ------------------------------------------------------------------ *
 *  🎵 Music cards
 * ------------------------------------------------------------------ */
export const MUSIC_LIBRARY = [
  { id: 'm1', title: 'Sahara Nights', artist: 'Nexora Sounds', emoji: '🌙', color: ['#7b3fe4', '#ff2d55'] },
  { id: 'm2', title: 'Ouargla Sunset', artist: 'DZ Beats', emoji: '🌅', color: ['#ff9d00', '#e1003c'] },
  { id: 'm3', title: 'Casbah Groove', artist: 'Algiers Funk', emoji: '🎷', color: ['#0095f6', '#7b3fe4'] },
  { id: 'm4', title: 'Neon Medina', artist: 'Night Riders', emoji: '✨', color: ['#00c2a8', '#0064d1'] },
  { id: 'm5', title: 'Atlas Dreams', artist: 'Kabyle Waves', emoji: '⛰️', color: ['#e8432a', '#ff9d00'] },
  { id: 'm6', title: 'Coffee & Rain', artist: 'Lo-Fi Dz', emoji: '☔', color: ['#4b6cb7', '#182848'] },
];
/** بطاقة أغنية (غلاف مربع + العنوان) تُرسل كصورة مع رابط. */
export async function makeMusicCard(track, size = 640) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, track.color?.[0] || '#7b3fe4'); g.addColorStop(1, track.color?.[1] || '#ff2d55');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  x.globalAlpha = .18; x.fillStyle = '#fff';
  for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(rnd(0, size), rnd(0, size), rnd(40, 170), 0, Math.PI * 2); x.fill(); }
  x.globalAlpha = 1;
  // disc
  const cx = size / 2, cy = size * .42, r = size * .22;
  x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2;
  for (let i = 1; i < 4; i++) { x.beginPath(); x.arc(cx, cy, r * (0.35 + i * 0.16), 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, r * .22, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.92)';
  x.font = `700 ${size * .072}px system-ui, Roboto, sans-serif`; x.textAlign = 'center';
  x.fillText(String(track.title).slice(0, 22), size / 2, size * .80);
  x.font = `400 ${size * .05}px system-ui, Roboto, sans-serif`;
  x.fillStyle = 'rgba(255,255,255,.78)';
  x.fillText(String(track.artist || '').slice(0, 26), size / 2, size * .87);
  x.font = `400 ${size * .038}px system-ui, Roboto, sans-serif`;
  x.fillStyle = 'rgba(255,255,255,.6)';
  x.fillText('Nexora Music', size / 2, size * .95);
  return { blob: await canvasToBlob(c, 'image/jpeg', 0.9), w: size, h: size };
}

/* ------------------------------------------------------------------ *
 *  ✂️ Cutouts (إزالة الخلفية) + 🎨 Effects
 * ------------------------------------------------------------------ */
export const EFFECTS = [
  { id: 'none', label: 'الأصلي', en: 'Original', filter: 'none', badge: '✨' },
  { id: 'vivid', label: 'حيوي', en: 'Vivid', filter: 'saturate(1.5) contrast(1.12)' },
  { id: 'mono', label: 'أبيض وأسود', en: 'B&W', filter: 'grayscale(1) contrast(1.08)' },
  { id: 'sepia', label: 'عتيق', en: 'Vintage', filter: 'sepia(.65) contrast(1.05) brightness(1.03)' },
  { id: 'cool', label: 'بارد', en: 'Cool', filter: 'hue-rotate(-18deg) saturate(1.25)' },
  { id: 'warm', label: 'دافئ', en: 'Warm', filter: 'sepia(.25) saturate(1.35) brightness(1.05)' },
  { id: 'neon', label: 'نيون', en: 'Neon', filter: 'saturate(1.9) contrast(1.25) hue-rotate(18deg)' },
  { id: 'fade', label: 'باهت', en: 'Fade', filter: 'contrast(.88) brightness(1.08) saturate(.85)' },
  { id: 'drama', label: 'درامي', en: 'Drama', filter: 'contrast(1.4) brightness(.95) saturate(1.1)' },
  { id: 'dream', label: 'حلم', en: 'Dream', filter: 'blur(.4px) brightness(1.1) saturate(1.2) hue-rotate(-8deg)' },
];
/** يطبّق فلتراً على صورة ويرجع PNG/JPEG. */
export async function applyEffect(src, effectId, max = 1440) {
  const eff = EFFECTS.find((e) => e.id === effectId) || EFFECTS[0];
  const im = await loadImg(src);
  const scale = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * scale), h = Math.round(im.naturalHeight * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.filter = eff.filter === 'none' ? 'none' : eff.filter;
  x.drawImage(im, 0, 0, w, h);
  x.filter = 'none';
  return { blob: await canvasToBlob(c, 'image/jpeg', 0.9), w, h };
}
/**
 * قصاصة: إزالة الخلفية بمطابقة لون الزوايا (flood-lite) + تنعيم الحواف.
 * بسيطة لكن تعمل بلا إنترنت وبدون أي خدمة خارجية.
 */
export async function makeCutout(src, { tolerance = 34, feather = 1.4, max = 900 } = {}) {
  const im = await loadImg(src);
  const scale = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(2, Math.round(im.naturalWidth * scale)), h = Math.max(2, Math.round(im.naturalHeight * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h);
  const d = data.data;
  const at = (px, py) => { const i = (py * w + px) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)];
  const bg = corners.reduce((a, c2) => [a[0] + c2[0] / 4, a[1] + c2[1] / 4, a[2] + c2[2] / 4], [0, 0, 0]);
  const dist = (i) => Math.sqrt((d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2);
  const soft = tolerance * feather;
  for (let i = 0; i < d.length; i += 4) {
    const dd = dist(i);
    if (dd <= tolerance) d[i + 3] = 0;
    else if (dd < soft) d[i + 3] = Math.round(d[i + 3] * ((dd - tolerance) / (soft - tolerance)));
  }
  // trim transparent border
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (d[(py * w + px) * 4 + 3] > 12) { if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
  }
  x.putImageData(data, 0, 0);
  if (maxX > minX && maxY > minY) {
    const pad = 8;
    const cw = Math.min(w, maxX - minX + pad * 2), ch = Math.min(h, maxY - minY + pad * 2);
    const out = document.createElement('canvas'); out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(c, Math.max(0, minX - pad), Math.max(0, minY - pad), cw, ch, 0, 0, cw, ch);
    return { blob: await canvasToBlob(out, 'image/png'), w: cw, h: ch };
  }
  return { blob: await canvasToBlob(c, 'image/png'), w, h };
}
