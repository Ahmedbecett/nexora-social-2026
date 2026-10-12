// Regenerates native/app/src/main/assets/i18n/*.json from the web dictionaries (same keys as the web app).
import fs from 'fs';
const root = new URL('../', import.meta.url);
const src = fs.readFileSync(new URL('src/i18n.js', root), 'utf8');
const grab = (name) => { const s = src.indexOf(`const ${name} = {`); const e = src.indexOf('\n};', s) + 3; return new Function(src.slice(s, e) + `\nreturn ${name};`)(); };
const { extraEn, extraAr } = await import(new URL('src/locales/extra.js', root));
const merge = (a, b) => Object.assign({}, a, b, { errors: { ...(a.errors || {}), ...(b.errors || {}) } });
const cts = fs.readFileSync(new URL('src/chatkit/callText.js', root), 'utf8');
const grabCt = (name) => { const s = cts.indexOf(`const ${name} = {`); const e = cts.indexOf('\n};', s) + 3; return new Function(cts.slice(s, e) + `\nreturn ${name};`)(); };
const out = new URL('native/app/src/main/assets/i18n/', root);
fs.writeFileSync(new URL('en.json', out), JSON.stringify({ ...merge(grab('en'), extraEn), ...grabCt('en') }));
fs.writeFileSync(new URL('ar.json', out), JSON.stringify({ ...merge(grab('ar'), extraAr), ...grabCt('ar') }));
const frCt = grabCt('fr');
for (const f of fs.readdirSync(new URL('src/locales/', root))) if (f.endsWith('.json')) {
  const d = JSON.parse(fs.readFileSync(new URL(`src/locales/${f}`, root), 'utf8'));
  if (f === 'fr.json') Object.assign(d, frCt);
  fs.writeFileSync(new URL(f, out), JSON.stringify(d));
}
// Native-only keys (added only when missing).
const nativeExtra = {
  en: { appVersion: 'Version', audioTab: 'Audio', settingsTitle: 'Settings and activity', termsShort: 'By signing up, you agree to our Terms of Use.' },
  ar: { appVersion: 'الإصدار', audioTab: 'الصوتيات', settingsTitle: 'الإعدادات والنشاط', termsShort: 'بالتسجيل، أنت توافق على شروط الاستخدام.' },
  fr: { appVersion: 'Version', audioTab: 'Audio', settingsTitle: 'Paramètres et activité', termsShort: "En vous inscrivant, vous acceptez nos conditions d'utilisation." },
};
for (const [l, keys] of Object.entries(nativeExtra)) {
  const f = new URL(`${l}.json`, out);
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(keys)) if (d[k] == null) d[k] = v;
  fs.writeFileSync(f, JSON.stringify(d));
}
const langs = src.slice(src.indexOf('export const LANGUAGES = ['), src.indexOf('];', src.indexOf('export const LANGUAGES')) + 2).replace('export const LANGUAGES =', 'return');
fs.writeFileSync(new URL('languages.json', out), JSON.stringify(new Function(langs)()));
console.log(fs.readdirSync(out).length, 'files');
