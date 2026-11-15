#!/usr/bin/env node
/* ============================================================================
   NEXORA Studio — preview vendor assets
   ----------------------------------------------------------------------------
   Copies the esbuild wasm compiler and builds ESM copies of React so a
   generated app runs in the live preview without any framework CDN.

   The generated files must expose the SAME named exports the packages do
   (`import { useState } from 'react'`), otherwise a browser import map resolves
   the specifier to a module that only has a default export and the preview dies
   with "does not provide an export named …". React ships CommonJS only, so the
   named surface is introspected here and written out explicitly.

   Dependency graph in the browser (all through the import map):
     app bundle → vendor/react.js
     vendor/react-dom.js        → vendor/react.js
     vendor/react-dom-client.js → vendor/react-dom.js → vendor/react.js
   One React instance, always.
   ============================================================================ */

import { build } from 'esbuild';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const outDir = join(root, 'public', 'studio');
const vendorDir = join(outDir, 'vendor');

/* Exact-match externals: esbuild's `external` treats strings as prefixes, which
   would turn `react-dom/client` into a bare re-export of itself. */
const exactExternal = (names) => ({
  name: 'exact-external',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => (names.includes(args.path) ? { path: args.path, external: true } : null));
  },
});

const isIdentifier = (name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && name !== 'default' && name !== '__esModule';

/** Reads the real export surface of an installed package (CommonJS in React 18). */
function surface(specifier) {
  const mod = require(specifier);
  const names = Object.keys(mod).filter(isIdentifier).sort();
  return names;
}

/**
 * CommonJS packages call `require('react')` from inside lazy initializers, which
 * esbuild cannot hoist into an ESM import. In a browser there is no `require`,
 * so the emitted stub throws "Dynamic require of react is not supported".
 * This banner gives the bundle a module-scope `require` that resolves the few
 * peer dependencies through real ESM imports (and therefore through the page's
 * import map, keeping exactly one React instance).
 */
function requireBanner(peers) {
  const lines = peers.map((p, i) => `import * as __peer${i} from ${JSON.stringify(p)};`);
  const cases = peers.map((p, i) => `if (id === ${JSON.stringify(p)}) return __peer${i};`).join(' ');
  lines.push(`const require = ((id) => { ${cases} throw new Error('cannot require ' + id); });`);
  return lines.join('\n');
}

/** Builds a facade that re-exports the package, keeping its bare imports intact. */
function facade({ specifier, extraImports = [], externals = [], banner = null }) {
  const names = surface(specifier);
  const lines = [
    ...extraImports,
    `import __vendor from ${JSON.stringify(specifier)};`,
    'export default __vendor;',
  ];
  for (const name of names) lines.push(`export const ${name} = __vendor.${name};`);
  return { code: lines.join('\n') + '\n', externals, banner, count: names.length };
}

const ENTRIES = [
  { name: 'react', ...facade({ specifier: 'react' }) },
  {
    name: 'react-dom',
    ...facade({ specifier: 'react-dom', extraImports: ["import 'react';"], externals: ['react'], banner: requireBanner(['react']) }),
  },
  {
    name: 'react-dom-client',
    ...facade({
      specifier: 'react-dom/client',
      extraImports: ["import 'react';", "import 'react-dom';"],
      externals: ['react', 'react-dom'],
      banner: requireBanner(['react', 'react-dom']),
    }),
  },
  {
    name: 'jsx-runtime',
    ...facade({ specifier: 'react/jsx-runtime', extraImports: ["import 'react';"], externals: ['react'], banner: requireBanner(['react']) }),
  },
];

/* Packages a generated app imports by name and that the import map must serve. */
const REQUIRED_EXPORTS = {
  react: ['useState', 'useEffect', 'useMemo', 'useRef', 'createElement', 'Fragment'],
  'react-dom': ['createPortal', 'flushSync'],
  'react-dom-client': ['createRoot', 'hydrateRoot'],
  'jsx-runtime': ['jsx', 'jsxs', 'Fragment'],
};

async function main() {
  await mkdir(vendorDir, { recursive: true });

  const wasmSrc = require.resolve('esbuild-wasm/esbuild.wasm');
  await copyFile(wasmSrc, join(outDir, 'esbuild.wasm'));

  for (const entry of ENTRIES) {
    if (!entry.count) throw new Error(`${entry.name}: no exports found`);
    const outfile = join(vendorDir, `${entry.name}.js`);
    const result = await build({
      stdin: { contents: entry.code, resolveDir: root, loader: 'js' },
      bundle: true,
      format: 'esm',
      outfile,
      platform: 'browser',
      target: ['es2020'],
      plugins: entry.externals.length ? [exactExternal(entry.externals)] : [],
      define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
      banner: entry.banner ? { js: entry.banner } : undefined,
      legalComments: 'none',
      minify: true,
      logLevel: 'error',
      metafile: true,
    });
    const bytes = Object.values(result.metafile.outputs)[0]?.bytes || 0;
    console.log(`  studio: built vendor/${entry.name}.js · ${entry.count} exports · ${(bytes / 1024).toFixed(1)} kB`);
  }

  await writeFile(join(outDir, 'README.txt'),
    'Generated by scripts/studio-vendor.mjs — esbuild wasm + React ESM builds used by the live preview.\n');

  /* Fail the build now rather than letting a broken preview reach the browser. */
  for (const [name, required] of Object.entries(REQUIRED_EXPORTS)) {
    const mod = await import(`${join(vendorDir, name + '.js')}?t=${Date.now()}`);
    const missing = required.filter((key) => !(key in mod));
    if (missing.length) throw new Error(`vendor/${name}.js is missing ${missing.join(', ')}`);
    if (name === 'react' && !('default' in mod)) throw new Error('vendor/react.js has no default export');
  }
  console.log('  studio: vendor exports verified');
}

main().catch((e) => {
  console.error('studio vendor failed:', e.message);
  process.exit(1);
});
