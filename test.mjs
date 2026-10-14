import http from 'node:http';
const results = [];
const check = (name, ok, extra = '') => results.push([ok ? 'PASS' : 'FAIL', name, extra]);

// mock upstreams
const mock = http.createServer(async (req, res) => {
  if (req.url.startsWith('/openai/v1/audio/transcriptions')) {
    let n = 0; for await (const c of req) n += c.length;
    if (req.headers.authorization !== 'Bearer gk_test') { res.writeHead(401); return res.end('{}'); }
    res.writeHead(200, {'content-type':'application/json'});
    return res.end(JSON.stringify({ text: 'مرحبا كيف حالك', segments: [
      { text: ' مرحبا', no_speech_prob: 0.01 }, { text: ' كيف حالك', no_speech_prob: 0.05 }, { text: ' thank you for watching', no_speech_prob: 0.9 } ] }));
  }
  if (req.url === '/cognitiveservices/v1') {
    let body = ''; for await (const c of req) body += c;
    if (req.headers['ocp-apim-subscription-key'] !== 'az_test') { res.writeHead(401); return res.end(); }
    res.writeHead(200, {'content-type':'audio/mpeg'});
    return res.end(Buffer.from('ID3fakemp3:' + body.length));
  }
  res.writeHead(404); res.end();
}).listen(18081);
await new Promise(r => mock.on('listening', r));

const env = { ...process.env, PORT: '18082', GATEWAY_SECRET: 'sec_test', GROQ_API_KEY: 'gk_test', AZURE_SPEECH_KEY: 'az_test',
  AZURE_SPEECH_REGION: 'uaenorth', GROQ_BASE: 'http://127.0.0.1:18081/openai/v1', AZURE_BASE: 'http://127.0.0.1:18081' };
Object.assign(process.env, env);
const { createServer } = await import('./server.mjs');
const gw = createServer().listen(18082);
await new Promise(r => gw.on('listening', r));
const B = 'http://127.0.0.1:18082';
const H = { 'content-type': 'application/json', 'x-gateway-secret': 'sec_test' };

let r = await fetch(B + '/health'); let j = await r.json();
check('health ok no secrets', r.status === 200 && j.ok && !JSON.stringify(j).includes('gk_test'));
r = await fetch(B + '/v1/stt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
check('stt without secret → 401', r.status === 401);
r = await fetch(B + '/v1/stt', { method: 'POST', headers: { ...H, 'x-gateway-secret': 'wrong' }, body: '{}' });
check('stt wrong secret → 401', r.status === 401);
r = await fetch(B + '/v1/stt', { method: 'POST', headers: H, body: JSON.stringify({ audio: Buffer.from('abc').toString('base64'), mime: 'audio/webm;codecs=opus' }) });
j = await r.json();
check('stt filters hallucinated segment', r.status === 200 && j.text === 'مرحبا كيف حالك', JSON.stringify(j));
r = await fetch(B + '/v1/stt', { method: 'POST', headers: H, body: JSON.stringify({ audio: '', mime: 'audio/wav' }) });
check('stt empty audio → 400', r.status === 400);
r = await fetch(B + '/v1/tts', { method: 'POST', headers: H, body: JSON.stringify({ text: '**مرحبا** <b>x</b>', voice: 'ar-DZ-AminaNeural' }) });
j = await r.json();
check('tts returns mp3 base64', r.status === 200 && j.mime === 'audio/mpeg' && Buffer.from(j.audioB64, 'base64').toString().startsWith('ID3'), j.voice);
r = await fetch(B + '/v1/tts', { method: 'POST', headers: H, body: JSON.stringify({ text: 'hi', voice: 'evil-voice' }) });
j = await r.json();
check('tts unknown voice falls back to default', r.status === 200 && j.voice === 'ar-DZ-AminaNeural');
r = await fetch(B + '/v1/tts', { method: 'POST', headers: H, body: JSON.stringify({ text: '   ' }) });
check('tts empty text → 400', r.status === 400);
r = await fetch(B + '/v1/nope', { method: 'POST', headers: H, body: '{}' });
check('unknown route → 404', r.status === 404);
r = await fetch(B + '/v1/stt', { method: 'POST', headers: H, body: 'x'.repeat(5 * 1024 * 1024) }).catch(e => ({ status: 'err' }));
check('oversized body rejected', r.status === 413 || r.status === 'err' || r.status === 500, String(r.status));

for (const [s, n, e] of results) console.log(s, n, e);
console.log(results.every(x => x[0] === 'PASS') ? 'ALL PASS' : 'SOME FAILED');
gw.close(); mock.close();
process.exit(0);
