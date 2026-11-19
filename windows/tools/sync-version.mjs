#!/usr/bin/env node
/* يزامن نسخة MSIX الرباعية مع package.json (المصدر الوحيد للإصدار).
   الاستخدام:
     node windows/tools/sync-version.mjs           # يكتب
     node windows/tools/sync-version.mjs --check   # يتحقق فقط (CI/الاختبارات)
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { toMsixVersion } from './msix.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkgPath = resolve(root, 'package.json');
const identityPath = resolve(root, 'windows/package-identity.json');
const args = process.argv.slice(2);
const check = args.includes('--check');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
const expected = toMsixVersion(pkg.version);

if (check) {
  if (identity.version !== expected) {
    console.error(`MSIX version mismatch: package.json ${pkg.version} → ${expected}, identity has ${identity.version}`);
    process.exit(1);
  }
  console.log(`MSIX version OK: ${expected}`);
  process.exit(0);
}

identity.version = expected;
writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`NEXORA AI ${pkg.version} → MSIX ${expected}`);
