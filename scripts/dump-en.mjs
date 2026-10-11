// prints merged English dictionary as JSON (used by scripts/translate.py)
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const start = src.indexOf('const en = {');
const end = src.indexOf('\n};', start) + 3;
const en = new Function(src.slice(start, end) + '\nreturn en;')();
const { extraEn } = await import('../src/locales/extra.js');
Object.assign(en, extraEn, { errors: { ...en.errors, ...extraEn.errors } });
process.stdout.write(JSON.stringify(en));
