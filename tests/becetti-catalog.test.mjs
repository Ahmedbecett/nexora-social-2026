import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BECETTI_DEFAULT_CATALOG,
  BECETTI_LANGUAGES,
  BECETTI_LINK_KEYS,
  BECETTI_PRODUCT_STATUSES,
} from '../shared/becetti-catalog.js';
import { CatalogValidationError, normalizeBecettiCatalog } from '../api/_lib/becetti-catalog.js';

const read = (path) => readFileSync(path, 'utf8');

test('default BECETTI catalogue contains only the source-verified NEXORA AI product', () => {
  assert.deepEqual(BECETTI_DEFAULT_CATALOG.products.map((product) => product.id), ['nexora-ai']);
  const product = BECETTI_DEFAULT_CATALOG.products[0];
  assert.equal(product.categoryId, 'ai');
  assert.equal(product.status, 'published');
  assert.equal(product.links.web, 'https://nexora-social-2026.vercel.app/');
  assert.equal(product.links.android, 'https://nexora-social-2026.vercel.app/download/Nexora.apk');
  assert.equal(product.links.windows, 'https://nexora-social-2026.vercel.app/windows/index.html');
  assert.deepEqual(product.platforms, ['android', 'windows']);
  assert.equal(product.links.googlePlay, undefined);
  assert.equal(product.links.microsoftStore, undefined);
  assert.deepEqual(BECETTI_DEFAULT_CATALOG.categories.map((category) => category.id), ['ai', 'game', 'business', 'security', 'tools']);
});

test('normalisation preserves supported fields, sorts divisions and limits URLs to HTTPS', () => {
  const catalogue = normalizeBecettiCatalog(BECETTI_DEFAULT_CATALOG);
  assert.deepEqual(catalogue.categories.map((category) => category.id), ['ai', 'game', 'business', 'security', 'tools']);
  assert.deepEqual(BECETTI_LANGUAGES, ['ar', 'en', 'fr']);
  assert.deepEqual(BECETTI_PRODUCT_STATUSES, ['published', 'development', 'coming-soon']);
  assert.deepEqual(BECETTI_LINK_KEYS, ['web', 'android', 'windows', 'googlePlay', 'microsoftStore', 'appStore', 'other']);
  assert.equal(catalogue.products[0].name, 'NEXORA AI');
});

test('every project needs an official website and platform assignments need matching app links', () => {
  const missingWebsite = structuredClone(BECETTI_DEFAULT_CATALOG);
  delete missingWebsite.products[0].links.web;
  assert.throws(() => normalizeBecettiCatalog(missingWebsite), /official web link/);

  const missingWindowsPage = structuredClone(BECETTI_DEFAULT_CATALOG);
  delete missingWindowsPage.products[0].links.windows;
  assert.throws(() => normalizeBecettiCatalog(missingWindowsPage), /official windows link/);

  const inferredPlatforms = structuredClone(BECETTI_DEFAULT_CATALOG);
  delete inferredPlatforms.products[0].platforms;
  assert.deepEqual(normalizeBecettiCatalog(inferredPlatforms).products[0].platforms, ['android', 'windows']);

  const noAppPlatforms = structuredClone(BECETTI_DEFAULT_CATALOG);
  noAppPlatforms.products[0].platforms = [];
  assert.deepEqual(normalizeBecettiCatalog(noAppPlatforms).products[0].platforms, []);
});

test('catalogue rejects unknown divisions, malformed slugs and duplicate project IDs', () => {
  const unknownDivision = structuredClone(BECETTI_DEFAULT_CATALOG);
  unknownDivision.products[0].categoryId = 'imaginary';
  assert.throws(() => normalizeBecettiCatalog(unknownDivision), CatalogValidationError);

  const malformed = structuredClone(BECETTI_DEFAULT_CATALOG);
  malformed.categories[0].id = '../admin';
  assert.throws(() => normalizeBecettiCatalog(malformed), CatalogValidationError);

  const duplicate = structuredClone(BECETTI_DEFAULT_CATALOG);
  duplicate.products.push({ ...duplicate.products[0] });
  assert.throws(() => normalizeBecettiCatalog(duplicate), /unique/);
});

test('catalogue rejects unsafe links, non-HTTPS links and unsafe remote image URLs', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', '//example.com/path']) {
    const catalogue = structuredClone(BECETTI_DEFAULT_CATALOG);
    catalogue.products[0].links.other = url;
    assert.throws(() => normalizeBecettiCatalog(catalogue), CatalogValidationError, url);
  }
  const badImage = structuredClone(BECETTI_DEFAULT_CATALOG);
  badImage.products[0].imageUrl = 'data:image/svg+xml,<svg/>';
  assert.throws(() => normalizeBecettiCatalog(badImage), CatalogValidationError);
  const traversal = structuredClone(BECETTI_DEFAULT_CATALOG);
  traversal.products[0].imageUrl = '/images/../private.png';
  assert.throws(() => normalizeBecettiCatalog(traversal), CatalogValidationError);
});

test('catalogue requires all three category names and accepts all explicit publication states', () => {
  const missingLocale = structuredClone(BECETTI_DEFAULT_CATALOG);
  delete missingLocale.categories[0].name.fr;
  assert.throws(() => normalizeBecettiCatalog(missingLocale), /Arabic, English and French/);

  for (const status of BECETTI_PRODUCT_STATUSES) {
    const catalogue = structuredClone(BECETTI_DEFAULT_CATALOG);
    catalogue.products[0].status = status;
    assert.equal(normalizeBecettiCatalog(catalogue).products[0].status, status);
  }

  const badStatus = structuredClone(BECETTI_DEFAULT_CATALOG);
  badStatus.products[0].status = 'fake';
  assert.throws(() => normalizeBecettiCatalog(badStatus), /unsupported status/);
});

test('admin API is guarded on the server and image upload never sends a storage secret to the browser', () => {
  const handlers = read('api/_lib/handlers.js');
  assert.match(handlers, /route\('GET', 'becetti\/admin',[\s\S]*?adminGuard\(req\)/);
  assert.match(handlers, /route\('PUT', 'becetti\/catalog',[\s\S]*?adminGuard\(req\)/);
  assert.match(handlers, /route\('POST', 'becetti\/image-token',[\s\S]*?adminGuard\(req\)/);
  assert.match(handlers, /token: process\.env\.BLOB_READ_WRITE_TOKEN|token,/);
  const client = read('src/becetti/main.js');
  assert.doesNotMatch(client, /BLOB_READ_WRITE_TOKEN|DATABASE_URL|JWT_SECRET/);
});
