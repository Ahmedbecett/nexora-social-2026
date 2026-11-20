#!/usr/bin/env node
/* يقرأ نتيجة windows/scripts/Test-MsixInstall.ps1 ويحوّلها إلى بوابة CI.
   يمرّ فقط إذا نجحت الفحوص الحرجة على جهاز Windows حقيقي:
   التثبيت، التسجيل، الهوية، Publisher، الإصدار، الصلاحيات، سطح الإنتاج.
   فحوص الواجهة الرسومية (Start / تشغيل Edge) قد تُعلَّم INFO على runner بلا جلسة
   تفاعلية؛ تبقى مسجّلة لكنها لا تُفشل البناء إذا مُرّر --allow-headless.
   الاستخدام:
     node windows/tools/assert-install-test.mjs dist/windows/install-test.json [--allow-headless]
*/

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const allowHeadless = args.includes('--allow-headless');

if (!file) {
  console.error('usage: node windows/tools/assert-install-test.mjs <install-test.json> [--allow-headless]');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`cannot read install test report ${file}: ${error.message}`);
  process.exit(2);
}

const checks = Array.isArray(report.checks) ? report.checks : [];
const headlessTolerant = ['launch-edge-host', 'start-menu-entry', 'activation-event-log'];
const hardFailures = [];
const tolerated = [];
const missing = [];

const required = [
  'add-appxpackage',
  'package-registered',
  'identity-name',
  'identity-publisher',
  'identity-version',
  'package-family-name',
  'package-status',
  'declared-capabilities',
  'application-entry',
  'edge-pwa-host',
  'production-surface',
  'uninstall',
];

const byName = new Map(checks.map((c) => [c.check, c]));
for (const name of required) {
  const check = byName.get(name);
  if (!check) missing.push(name);
  else if (check.status !== 'PASS') hardFailures.push(`${name}: ${check.status} — ${check.detail}`);
}
for (const check of checks) {
  if (check.status !== 'FAIL') continue;
  if (headlessTolerant.includes(check.check)) {
    if (allowHeadless) tolerated.push(`${check.check}: ${check.detail}`);
    else hardFailures.push(`${check.check}: ${check.detail}`);
  } else if (!required.includes(check.check)) {
    hardFailures.push(`${check.check}: ${check.detail}`);
  }
}

console.log(`install test report: ${file}`);
console.log(`  package: ${report.package} · ${report.identityName} ${report.version}`);
console.log(`  machine: ${report.machine}`);
console.log(`  ${report.passed} passed / ${report.failed} failed / ${checks.length} checks`);
for (const check of checks) console.log(`  [${check.status}] ${check.check} — ${check.detail}`);

if (missing.length) console.error(`\nmissing checks: ${missing.join(', ')}`);
if (tolerated.length) {
  console.warn('\ntolerated on a headless runner (still recorded, not verified here):');
  for (const t of tolerated) console.warn(`  ${t}`);
}
if (hardFailures.length) {
  console.error('\nblocking failures:');
  for (const f of hardFailures) console.error(`  ${f}`);
  process.exit(1);
}
if (missing.length) process.exit(1);
console.log('\nOK — the Windows package installed, registered and passed the permission/identity checks.');
