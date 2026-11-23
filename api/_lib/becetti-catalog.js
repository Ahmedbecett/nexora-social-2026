import {
  BECETTI_DEFAULT_CATALOG,
  BECETTI_LANGUAGES,
  BECETTI_LINK_KEYS,
  BECETTI_PRODUCT_STATUSES,
} from '../../shared/becetti-catalog.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ICONS = new Set(['spark', 'game', 'briefcase', 'shield', 'tools', 'plus']);
const MAX_CATEGORIES = 40;
const MAX_PRODUCTS = 300;
const APP_PLATFORMS = new Set(['android', 'windows']);

export class CatalogValidationError extends Error {
  constructor(message) { super(message); this.name = 'CatalogValidationError'; }
}

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

function localized(value, max, { required = false } = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = Object.fromEntries(BECETTI_LANGUAGES.map((lang) => [lang, text(input[lang], max)]));
  if (required && BECETTI_LANGUAGES.some((lang) => !out[lang])) {
    throw new CatalogValidationError('Complete the Arabic, English and French text fields.');
  }
  return out;
}

function validLink(value) {
  const url = text(value, 2048);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function validImage(value) {
  const image = text(value, 2048);
  if (!image) return '';
  if (image.startsWith('/') && !image.startsWith('//') && !image.split('/').includes('..')) return image;
  return validLink(image);
}

export function normalizeBecettiCatalog(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CatalogValidationError('A catalogue object is required.');
  }
  if (!Array.isArray(input.categories) || input.categories.length < 1 || input.categories.length > MAX_CATEGORIES) {
    throw new CatalogValidationError(`The catalogue must contain 1–${MAX_CATEGORIES} categories.`);
  }
  if (!Array.isArray(input.products) || input.products.length > MAX_PRODUCTS) {
    throw new CatalogValidationError(`The catalogue can contain up to ${MAX_PRODUCTS} products.`);
  }

  const categoryIds = new Set();
  const categories = input.categories.map((item, index) => {
    const id = text(item?.id, 48).toLowerCase();
    if (!SLUG.test(id) || id === 'admin' || categoryIds.has(id)) {
      throw new CatalogValidationError('Category IDs must be unique, lowercase URL slugs.');
    }
    categoryIds.add(id);
    const icon = ICONS.has(item?.icon) ? item.icon : 'plus';
    const order = Number(item?.sortOrder);
    return {
      id,
      icon,
      sortOrder: Number.isFinite(order) ? Math.max(0, Math.min(999, Math.trunc(order))) : index + 1,
      name: localized(item?.name, 80, { required: true }),
      description: localized(item?.description, 600),
    };
  });

  const productIds = new Set();
  const products = input.products.map((item) => {
    const id = text(item?.id, 64).toLowerCase();
    if (!SLUG.test(id) || productIds.has(id)) {
      throw new CatalogValidationError('Product IDs must be unique, lowercase URL slugs.');
    }
    productIds.add(id);
    const categoryId = text(item?.categoryId, 48).toLowerCase();
    if (!categoryIds.has(categoryId)) throw new CatalogValidationError(`Product “${id}” has an unknown category.`);
    const status = BECETTI_PRODUCT_STATUSES.includes(item?.status) ? item.status : null;
    if (!status) throw new CatalogValidationError(`Product “${id}” has an unsupported status.`);
    const imageUrl = validImage(item?.imageUrl);
    if (imageUrl === null) throw new CatalogValidationError(`Product “${id}” image must use HTTPS or a local site path.`);
    const hasExplicitPlatforms = Array.isArray(item?.platforms);
    const rawPlatforms = hasExplicitPlatforms ? [...new Set(item.platforms.filter((platform) => APP_PLATFORMS.has(platform)))] : [];
    const inputLinks = item?.links && typeof item.links === 'object' && !Array.isArray(item.links) ? item.links : {};
    const links = {};
    for (const key of BECETTI_LINK_KEYS) {
      const url = validLink(inputLinks[key]);
      if (url === null) throw new CatalogValidationError(`Product “${id}” has an invalid ${key} link. Use HTTPS.`);
      if (url) links[key] = url;
    }
    if (!links.web) throw new CatalogValidationError(`Product “${id}” needs an official web link.`);
    const platforms = hasExplicitPlatforms ? rawPlatforms : ['android', 'windows'].filter((platform) => links[platform]);
    for (const platform of platforms) {
      if (!links[platform]) throw new CatalogValidationError(`Product “${id}” needs an official ${platform} link.`);
    }
    return {
      id,
      name: text(item?.name, 100),
      categoryId,
      status,
      platforms,
      imageUrl,
      shortDescription: localized(item?.shortDescription, 300),
      description: localized(item?.description, 2400),
      links,
    };
  });

  if (products.some((product) => !product.name)) throw new CatalogValidationError('Every product needs a name.');
  return {
    schemaVersion: 1,
    updatedAt: typeof input.updatedAt === 'string' ? text(input.updatedAt, 64) : null,
    categories: categories.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    products,
  };
}

export const getDefaultBecettiCatalog = () => normalizeBecettiCatalog(BECETTI_DEFAULT_CATALOG);
export const BECETTI_CATALOG_LIMITS = Object.freeze({ categories: MAX_CATEGORIES, products: MAX_PRODUCTS });
