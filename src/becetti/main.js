import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/cairo/wght.css';
import './becetti.css';
import { BECETTI_DEFAULT_CATALOG, BECETTI_LANGUAGES, BECETTI_LINK_KEYS, BECETTI_PRODUCT_STATUSES } from '../../shared/becetti-catalog.js';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const isAdminPage = document.body.dataset.page === 'admin';
const requestedLanguage = isAdminPage ? new URLSearchParams(location.search).get('lang') : '';
const lang = BECETTI_LANGUAGES.includes(requestedLanguage)
  ? requestedLanguage
  : BECETTI_LANGUAGES.includes(document.documentElement.lang) ? document.documentElement.lang : 'ar';
if (isAdminPage) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
const ROUTES = { ai: 'ai.html', game: 'game.html', business: 'business.html', security: 'security.html', tools: 'tools.html' };
const LINK_LABELS = {
  ar: { web: 'افتح الموقع', android: 'تنزيل Android APK', windows: 'صفحة Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'زيارة المشروع' },
  en: { web: 'Open website', android: 'Android APK', windows: 'Windows app page', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'Visit project' },
  fr: { web: 'Ouvrir le site', android: 'APK Android', windows: 'Page de l’application Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'Visiter le projet' },
};
const STATUS_LABELS = {
  ar: { published: 'متاح الآن', development: 'قيد التطوير', 'coming-soon': 'قريباً' },
  en: { published: 'Available now', development: 'In development', 'coming-soon': 'Coming soon' },
  fr: { published: 'Disponible', development: 'En développement', 'coming-soon': 'Bientôt' },
};
const ADMIN_TEXT = {
  ar: {
    title: 'إدارة BECETTI', subtitle: 'أضف المشاريع والأقسام وعدّل معلوماتها وروابطها الرسمية.',
    signInTitle: 'تسجيل الدخول مطلوب', signIn: 'سجّل الدخول إلى NEXORA AI بحساب المالك، ثم عد إلى هذه الصفحة.', signInButton: 'فتح NEXORA AI',
    previewTitle: 'وضع معاينة آمن', preview: 'لوحة الإدارة متصلة بخادم الإنتاج بعد النشر فقط. الحفظ والرفع معطلان في هذه المعاينة المحلية حتى لا تتغير بيانات الموقع المنشور دون موافقتك.',
    authLoading: 'جارٍ التحقق من صلاحية الحساب…', denied: 'هذا الحساب غير مخوّل لإدارة محتوى BECETTI. استخدم حساب المالك المصرح به.',
    apiDown: 'تعذر الاتصال بخدمة الإدارة. تأكد من نشر واجهة API وإعداد قاعدة البيانات والتخزين.',
    categories: 'الأقسام', projects: 'المشاريع', addCategory: '+ قسم جديد', addProduct: '+ مشروع جديد', edit: 'تعديل', delete: 'حذف',
    emptyCategories: 'لا توجد أقسام بعد.', emptyProducts: 'لا توجد مشاريع مسجلة بعد.', save: 'حفظ التغييرات', cancel: 'إلغاء', close: 'إغلاق',
    category: 'القسم', product: 'المشروع', categoryName: 'اسم القسم', categoryId: 'معرّف القسم (أحرف إنجليزية صغيرة)', categoryIcon: 'الأيقونة', categoryDescription: 'وصف القسم',
    name: 'اسم المنتج', id: 'معرّف URL', status: 'الحالة', image: 'رابط الشعار أو الصورة', upload: 'رفع الصورة', imageFile: 'اختر صورة', description: 'الوصف المختصر', longDescription: 'الوصف الكامل',
    links: 'الروابط الرسمية (رابط الموقع الإلكتروني مطلوب لكل مشروع)', platforms: 'الأنظمة المتاحة لهذا التطبيق', web: 'الموقع الإلكتروني (مطلوب)', android: 'Android APK', windows: 'صفحة تطبيق Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'Apple App Store', other: 'رابط آخر',
    langNames: { ar: 'العربية', en: 'الإنجليزية', fr: 'الفرنسية' }, saving: 'جارٍ الحفظ…', saved: 'تم حفظ التغييرات.', deleteConfirm: 'هل تريد حذف هذا العنصر؟', categoryHasProjects: 'لا يمكن حذف قسم يحتوي على مشاريع. انقل المشاريع أولاً.', badLink: 'تأكد من أن الروابط تبدأ بـ https://', validationError: 'تحقق من المعرّفات الفريدة واكتمال اللغات الثلاث وصحة الروابط.', uploadFail: 'تعذر رفع الصورة. تحقق من إعداد تخزين الصور.',
    newCategory: 'إضافة قسم', editCategory: 'تعديل القسم', newProduct: 'إضافة مشروع', editProduct: 'تعديل المشروع', iconOptions: { spark: 'ذكاء اصطناعي', game: 'ألعاب', briefcase: 'أعمال', shield: 'أمان', tools: 'أدوات', plus: 'أخرى' },
    error: 'حدث خطأ. حاول مرة أخرى.', back: 'العودة إلى الموقع', adminFooter: 'تُحفظ التغييرات في قاعدة بيانات الخادم، لا في هذا المتصفح.',
  },
  en: {
    title: 'BECETTI admin', subtitle: 'Add projects and divisions, then edit their official details and links.',
    signInTitle: 'Sign-in required', signIn: 'Sign in to NEXORA AI with the authorised owner account, then return here.', signInButton: 'Open NEXORA AI',
    previewTitle: 'Safe preview mode', preview: 'Admin writes and uploads are enabled only after deployment. Saving is disabled in this local preview so published site data cannot be changed accidentally.',
    authLoading: 'Checking account permissions…', denied: 'This account is not authorised to manage BECETTI content. Sign in with the approved owner account.',
    apiDown: 'The admin service could not be reached. Check that the API, database and image storage are configured.',
    categories: 'Divisions', projects: 'Projects', addCategory: '+ Add division', addProduct: '+ Add project', edit: 'Edit', delete: 'Delete',
    emptyCategories: 'No divisions yet.', emptyProducts: 'No projects have been added.', save: 'Save changes', cancel: 'Cancel', close: 'Close',
    category: 'Division', product: 'Project', categoryName: 'Division name', categoryId: 'Division ID (lowercase URL slug)', categoryIcon: 'Icon', categoryDescription: 'Division description',
    name: 'Product name', id: 'URL ID', status: 'Status', image: 'Logo or image URL', upload: 'Upload image', imageFile: 'Choose an image', description: 'Short description', longDescription: 'Full description',
    links: 'Official links (a website link is required for every project)', platforms: 'App platforms', web: 'Website (required)', android: 'Android APK', windows: 'Windows app page', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'Apple App Store', other: 'Other link',
    langNames: { ar: 'Arabic', en: 'English', fr: 'French' }, saving: 'Saving…', saved: 'Changes saved.', deleteConfirm: 'Delete this item?', categoryHasProjects: 'A division with projects cannot be deleted. Move the projects first.', badLink: 'Make sure links start with https://', validationError: 'Check unique IDs, complete text in all three languages and valid links.', uploadFail: 'Image upload failed. Check that image storage is configured.',
    newCategory: 'Add division', editCategory: 'Edit division', newProduct: 'Add project', editProduct: 'Edit project', iconOptions: { spark: 'AI', game: 'Games', briefcase: 'Business', shield: 'Security', tools: 'Tools', plus: 'Other' },
    error: 'Something went wrong. Please try again.', back: 'Back to site', adminFooter: 'Changes are stored on the server, not in this browser.',
  },
  fr: {
    title: 'Administration BECETTI', subtitle: 'Ajoutez des projets et divisions, puis modifiez leurs informations et liens officiels.',
    signInTitle: 'Connexion requise', signIn: 'Connectez-vous à NEXORA AI avec le compte propriétaire autorisé, puis revenez ici.', signInButton: 'Ouvrir NEXORA AI',
    previewTitle: 'Mode aperçu sécurisé', preview: 'Les modifications et téléversements sont activés uniquement après déploiement. L’enregistrement est désactivé dans cet aperçu local pour éviter toute modification accidentelle des données publiées.',
    authLoading: 'Vérification des autorisations…', denied: 'Ce compte n’est pas autorisé à gérer le contenu BECETTI. Utilisez le compte propriétaire autorisé.',
    apiDown: 'Le service d’administration est inaccessible. Vérifiez l’API, la base de données et le stockage des images.',
    categories: 'Divisions', projects: 'Projets', addCategory: '+ Ajouter une division', addProduct: '+ Ajouter un projet', edit: 'Modifier', delete: 'Supprimer',
    emptyCategories: 'Aucune division pour le moment.', emptyProducts: 'Aucun projet ajouté.', save: 'Enregistrer', cancel: 'Annuler', close: 'Fermer',
    category: 'Division', product: 'Projet', categoryName: 'Nom de la division', categoryId: 'Identifiant URL (minuscules)', categoryIcon: 'Icône', categoryDescription: 'Description de la division',
    name: 'Nom du produit', id: 'Identifiant URL', status: 'Statut', image: 'URL du logo ou de l’image', upload: 'Téléverser l’image', imageFile: 'Choisir une image', description: 'Description courte', longDescription: 'Description complète',
    links: 'Liens officiels (site Web obligatoire pour chaque projet)', platforms: 'Plateformes de l’application', web: 'Site Web (obligatoire)', android: 'APK Android', windows: 'Page de l’application Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'Apple App Store', other: 'Autre lien',
    langNames: { ar: 'Arabe', en: 'Anglais', fr: 'Français' }, saving: 'Enregistrement…', saved: 'Modifications enregistrées.', deleteConfirm: 'Supprimer cet élément ?', categoryHasProjects: 'Une division contenant des projets ne peut pas être supprimée. Déplacez-les d’abord.', badLink: 'Les liens doivent commencer par https://', validationError: 'Vérifiez les identifiants uniques, les textes dans les trois langues et les liens.', uploadFail: 'Échec du téléversement. Vérifiez le stockage des images.',
    newCategory: 'Ajouter une division', editCategory: 'Modifier la division', newProduct: 'Ajouter un projet', editProduct: 'Modifier le projet', iconOptions: { spark: 'IA', game: 'Jeux', briefcase: 'Entreprise', shield: 'Sécurité', tools: 'Outils', plus: 'Autre' },
    error: 'Une erreur est survenue. Veuillez réessayer.', back: 'Retour au site', adminFooter: 'Les modifications sont enregistrées sur le serveur, pas dans ce navigateur.',
  },
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localized = (value) => value?.[lang] || value?.en || value?.ar || '';
const categoryName = (category) => localized(category?.name) || category?.id || '';
const descriptionText = (product) => localized(product?.shortDescription) || localized(product?.description) || '';
const safeHref = (value, { image = false } = {}) => {
  const url = String(value || '').trim();
  if (image && url.startsWith('/') && !url.startsWith('//') && !url.split('/').includes('..')) return url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : ''; } catch { return ''; }
};

function iconMarkup(icon = 'plus') {
  const paths = {
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9Z"/>',
    game: '<path d="M6 8h12a4 4 0 0 1 3.8 5.3l-1.2 3.8a2.1 2.1 0 0 1-3.4 1l-2.1-1.8H8.9l-2.1 1.8a2.1 2.1 0 0 1-3.4-1l-1.2-3.8A4 4 0 0 1 6 8Z"/><path d="M7 11v4M5 13h4M16.5 12.2h.1M18.5 14.4h.1"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    tools: '<path d="M14.5 6.5a5 5 0 0 0-6.8 6.8L3 18l3 3 4.7-4.7a5 5 0 0 0 6.8-6.8l-3 3-3-3 3-3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[icon] || paths.plus}</svg>`;
}

function productCard(product, catalog) {
  const category = catalog.categories.find((entry) => entry.id === product.categoryId);
  const image = safeHref(product.imageUrl, { image: true }) || '/becetti-mark.svg';
  const buttons = BECETTI_LINK_KEYS.filter((key) => product.links?.[key] && safeHref(product.links[key]))
    .map((key) => `<a class="product-link${key === 'web' ? ' product-link-primary' : ''}" href="${escapeHtml(safeHref(product.links[key]))}" target="_blank" rel="noopener noreferrer">${escapeHtml(LINK_LABELS[lang][key])} <span aria-hidden="true">↗</span></a>`).join('');
  const status = STATUS_LABELS[lang][product.status] || STATUS_LABELS[lang].published;
  return `<article class="product-card" data-product-card data-product-id="${escapeHtml(product.id)}" data-category-id="${escapeHtml(product.categoryId)}">
    <div class="product-card-top"><div class="product-logo-wrap"><img class="product-logo" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} logo" loading="lazy" onerror="this.onerror=null;this.src='/becetti-mark.svg'" /></div><span class="status-badge status-${escapeHtml(product.status)}" data-status="${escapeHtml(product.status)}">${escapeHtml(status)}</span></div>
    <p class="product-category">${escapeHtml(categoryName(category))}</p><h3>${escapeHtml(product.name)}</h3><p class="product-description">${escapeHtml(descriptionText(product))}</p>
    <div class="product-card-footer">${buttons || `<span class="product-link-disabled">${escapeHtml(status)}</span>`}</div>
  </article>`;
}

function categoryCard(category) {
  const href = ROUTES[category.id] ? `/${lang === 'ar' ? 'becetti/' : `becetti/${lang}/`}${ROUTES[category.id]}` : `/${lang === 'ar' ? 'becetti/' : `becetti/${lang}/`}products.html?category=${encodeURIComponent(category.id)}`;
  return `<a class="category-card" href="${href}" data-category-card="${escapeHtml(category.id)}"><span class="category-icon category-icon-${escapeHtml(category.icon)}">${iconMarkup(category.icon)}</span><span class="category-card-copy"><strong>${escapeHtml(categoryName(category))}</strong><span>${escapeHtml(localized(category.description))}</span></span><span class="category-arrow" aria-hidden="true">↗</span></a>`;
}

function supportsPlatform(product, platform) {
  return !platform || Boolean(product?.platforms?.includes(platform) || product?.links?.[platform]);
}

function renderCatalog(catalog) {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const categories = Array.isArray(catalog?.categories) ? [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)) : [];
  const currentCategory = document.querySelector('[data-category-page]')?.dataset.categoryPage || '';
  const search = new URLSearchParams(location.search);
  let filter = search.get('category') || 'all';
  const mainGrid = document.querySelector('[data-category-grid]');
  if (mainGrid) mainGrid.innerHTML = categories.map(categoryCard).join('');
  const relatedGrid = document.querySelector('[data-related-categories]');
  if (relatedGrid) relatedGrid.innerHTML = categories.filter((entry) => entry.id !== currentCategory).slice(0, 3).map(categoryCard).join('');

  const filterRow = document.querySelector('[data-filter-row]');
  if (filterRow) {
    if (!categories.some((entry) => entry.id === filter)) filter = 'all';
    filterRow.innerHTML = `<button type="button" class="filter-chip${filter === 'all' ? ' is-active' : ''}" data-filter="all">${lang === 'ar' ? 'الكل' : lang === 'fr' ? 'Tout' : 'All products'}</button>${categories.map((entry) => `<button type="button" class="filter-chip${filter === entry.id ? ' is-active' : ''}" data-filter="${escapeHtml(entry.id)}">${escapeHtml(categoryName(entry))}</button>`).join('')}`;
    filterRow.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.filter;
      filterRow.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll('[data-products][data-page="products"]').forEach((grid) => {
        const shown = products.filter((product) => (filter === 'all' || product.categoryId === filter) && supportsPlatform(product, grid.dataset.platform));
        grid.innerHTML = shown.map((product) => productCard(product, catalog)).join('');
        const empty = grid.parentElement?.querySelector('[data-empty-state]');
        if (empty) empty.hidden = shown.length > 0;
      });
      const url = new URL(location.href);
      if (filter === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', filter);
      history.replaceState(null, '', url);
    }));
  }

  document.querySelectorAll('[data-products]').forEach((grid) => {
    let shown = products;
    if (grid.dataset.page === 'category') shown = products.filter((product) => product.categoryId === grid.dataset.category);
    if (grid.dataset.page === 'products') shown = products.filter((product) => (filter === 'all' || product.categoryId === filter) && supportsPlatform(product, grid.dataset.platform));
    grid.innerHTML = shown.map((product) => productCard(product, catalog)).join('');
    const empty = grid.parentElement?.querySelector('[data-empty-state]') || document.querySelector('[data-empty-state]');
    if (empty && (grid.dataset.page === 'category' || grid.dataset.page === 'products')) empty.hidden = shown.length > 0;
  });
}

function setupNavigation() {
  document.querySelectorAll('[data-becetti-language]').forEach((link) => link.addEventListener('click', () => {
    try { sessionStorage.setItem('becetti-language-choice', link.dataset.becettiLanguage); } catch { /* Language detection still works without session storage. */ }
  }));
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (!button || !nav) return;
  const label = button.getAttribute('aria-label') || '';
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? (lang === 'ar' ? 'إغلاق القائمة' : lang === 'fr' ? 'Fermer la navigation' : 'Close navigation') : label);
    nav.classList.toggle('is-open', open);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false');
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { nav.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); }
  });
}

async function loadPublicCatalog() {
  if (import.meta.env.DEV) return;
  try {
    const response = await fetch(`${API_BASE}/api/becetti/catalog`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (data.catalog && Array.isArray(data.catalog.categories) && Array.isArray(data.catalog.products)) renderCatalog(data.catalog);
  } catch { /* The static, source-verified catalogue remains available without the API. */ }
}

const ui = ADMIN_TEXT[lang];
const token = () => {
  try { return localStorage.getItem('nx_token') || ''; } catch { return ''; }
};
let adminCatalog = null;
let adminPreview = false;
let statusNode = null;
let dialogNode = null;

async function adminRequest(path, options = {}) {
  const accessToken = token();
  if (!accessToken) throw Object.assign(new Error('unauthorized'), { status: 401, code: 'unauthorized' });
  const response = await fetch(`${API_BASE}/api/${path}`, {
    method: options.method || 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.detail || data.error || 'request_failed'), { status: response.status, code: data.error || 'request_failed' });
  return data;
}

function setAdminStatus(text, type = '') {
  if (!statusNode) return;
  statusNode.className = `admin-status${type ? ` is-${type}` : ''}`;
  statusNode.textContent = text;
}
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.textContent = message;
  document.body.append(toast); setTimeout(() => toast.remove(), 3000);
}
function adminRoot() { return document.querySelector('[data-admin-root]'); }
function showAdminGate(title, body, buttonHref = '', buttonLabel = '') {
  const root = adminRoot();
  if (!root) return;
  root.innerHTML = `<section class="admin-auth-card"><img src="/becetti-mark.svg" width="52" height="52" alt="" style="margin:0 auto 14px"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>${buttonHref ? `<a class="button button-dark" href="${escapeHtml(buttonHref)}">${escapeHtml(buttonLabel)}</a>` : ''}</section>`;
}
function adminHomeLink() { return `/?nx_action=studio&return_to=${encodeURIComponent(`/becetti/admin.html?lang=${lang}`)}`; }
function ensureDialog() {
  if (dialogNode) return dialogNode;
  dialogNode = document.createElement('dialog'); dialogNode.className = 'admin-dialog'; dialogNode.setAttribute('aria-label', ui.title);
  document.body.append(dialogNode);
  dialogNode.addEventListener('click', (event) => { if (event.target === dialogNode) dialogNode.close(); });
  dialogNode.addEventListener('close', () => { dialogNode.innerHTML = ''; });
  return dialogNode;
}
function formField(label, name, value = '', { type = 'text', full = false, required = false, placeholder = '', autocomplete = '' } = {}) {
  return `<div class="admin-field${full ? ' admin-field-full' : ''}"><label for="${escapeHtml(name)}">${escapeHtml(label)}</label><input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}"${required ? ' required' : ''}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}${autocomplete ? ` autocomplete="${escapeHtml(autocomplete)}"` : ''}></div>`;
}
function localeHeading(code) { return `<h3 class="admin-locale-heading">${escapeHtml(ui.langNames[code])}</h3>`; }
function categoryOptions(selected = '') {
  return (adminCatalog?.categories || []).map((category) => `<option value="${escapeHtml(category.id)}"${category.id === selected ? ' selected' : ''}>${escapeHtml(categoryName(category))}</option>`).join('');
}
function statusOptions(selected = 'published') {
  const labels = STATUS_LABELS[lang];
  return BECETTI_PRODUCT_STATUSES.map((status) => `<option value="${status}"${status === selected ? ' selected' : ''}>${escapeHtml(labels[status])}</option>`).join('');
}
function renderAdminLists() {
  const root = adminRoot();
  if (!root || !adminCatalog) return;
  const categories = [...adminCatalog.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const products = adminCatalog.products;
  root.innerHTML = `<div class="admin-hero"><div><h1>${escapeHtml(ui.title)}</h1><p>${escapeHtml(ui.subtitle)}</p></div><div class="admin-toolbar"><button class="admin-btn" type="button" data-add-category>${escapeHtml(ui.addCategory)}</button><button class="admin-btn admin-btn-primary" type="button" data-add-product>${escapeHtml(ui.addProduct)}</button></div></div><div class="admin-status" data-admin-status role="status"></div>
  <section class="admin-panel"><div class="admin-panel-head"><h2>${escapeHtml(ui.categories)}</h2><span class="admin-count">${categories.length}</span></div><div class="admin-list">${categories.length ? categories.map((category) => `<article class="admin-item" data-item-id="${escapeHtml(category.id)}"><span class="admin-item-icon">${iconMarkup(category.icon)}</span><span class="admin-item-copy"><strong>${escapeHtml(categoryName(category))}</strong><small>${escapeHtml(category.id)} · ${escapeHtml(localized(category.description))}</small></span><span class="admin-item-actions"><button type="button" data-action="edit-category" data-id="${escapeHtml(category.id)}">${escapeHtml(ui.edit)}</button><button type="button" data-action="delete-category" data-id="${escapeHtml(category.id)}">${escapeHtml(ui.delete)}</button></span></article>`).join('') : `<div class="admin-empty">${escapeHtml(ui.emptyCategories)}</div>`}</div></section>
  <section class="admin-panel"><div class="admin-panel-head"><h2>${escapeHtml(ui.projects)}</h2><span class="admin-count">${products.length}</span></div><div class="admin-list">${products.length ? products.map((product) => { const category = categories.find((item) => item.id === product.categoryId); const image = safeHref(product.imageUrl, { image: true }) || '/becetti-mark.svg'; return `<article class="admin-item" data-item-id="${escapeHtml(product.id)}"><span class="admin-item-icon"><img src="${escapeHtml(image)}" alt="" onerror="this.onerror=null;this.src='/becetti-mark.svg'"></span><span class="admin-item-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(categoryName(category))} · ${escapeHtml(STATUS_LABELS[lang][product.status])} · ${escapeHtml(localized(product.shortDescription))}</small></span><span class="admin-item-actions"><button type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}">${escapeHtml(ui.edit)}</button><button type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}">${escapeHtml(ui.delete)}</button></span></article>`; }).join('') : `<div class="admin-empty">${escapeHtml(ui.emptyProducts)}</div>`}</div></section>
  <div class="admin-footer"><span>${escapeHtml(ui.adminFooter)}</span><a href="/becetti/${lang === 'ar' ? '' : `${lang}/`}index.html">${escapeHtml(ui.back)}</a></div>`;
  if (adminPreview) {
    root.querySelector('.admin-toolbar')?.remove();
    root.querySelectorAll('.admin-item-actions').forEach((node) => node.remove());
  }
  statusNode = root.querySelector('[data-admin-status]');
  statusNode.className = adminPreview ? 'preview-notice' : 'admin-status';
  statusNode.textContent = adminPreview ? ui.preview : ui.adminFooter;
  if (!adminPreview) {
    root.querySelector('[data-add-category]')?.addEventListener('click', () => openCategoryForm());
    root.querySelector('[data-add-product]')?.addEventListener('click', () => openProductForm());
    root.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAdminAction(button.dataset.action, button.dataset.id)));
  }
}

function openCategoryForm(category = null) {
  const existing = category || { id: '', icon: 'plus', sortOrder: adminCatalog.categories.length + 1, name: { ar: '', en: '', fr: '' }, description: { ar: '', en: '', fr: '' } };
  const dialog = ensureDialog();
  const iconOptions = Object.entries(ui.iconOptions).map(([key, label]) => `<option value="${key}"${key === existing.icon ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
  let fields = `<div class="admin-form-grid">${formField(ui.categoryId, 'id', existing.id, { required: true, placeholder: 'e.g. ai-tools' })}<div class="admin-field"><label for="category-icon">${escapeHtml(ui.categoryIcon)}</label><select id="category-icon" name="icon">${iconOptions}</select></div>`;
  for (const code of BECETTI_LANGUAGES) {
    fields += localeHeading(code) + formField(`${ui.categoryName} · ${ui.langNames[code]}`, `name_${code}`, existing.name?.[code] || '', { required: true, full: true });
    fields += formField(`${ui.categoryDescription} · ${ui.langNames[code]}`, `description_${code}`, existing.description?.[code] || '', { full: true });
  }
  fields += `</div>`;
  dialog.innerHTML = `<form class="admin-form" id="category-form"><div class="admin-form-head"><h2>${escapeHtml(category ? ui.editCategory : ui.newCategory)}</h2><button class="admin-close" type="button" aria-label="${escapeHtml(ui.close)}">×</button></div>${fields}<p class="admin-dialog-error" data-form-error hidden></p><div class="admin-form-actions"><button class="admin-btn" type="button" data-cancel>${escapeHtml(ui.cancel)}</button><button class="admin-btn admin-btn-primary" type="submit">${escapeHtml(ui.save)}</button></div></form>`;
  dialog.querySelector('.admin-close')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-cancel]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('#category-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { id: String(form.get('id') || '').trim().toLowerCase(), icon: form.get('icon'), sortOrder: existing.sortOrder, name: {}, description: {} };
    for (const code of BECETTI_LANGUAGES) { next.name[code] = String(form.get(`name_${code}`) || '').trim(); next.description[code] = String(form.get(`description_${code}`) || '').trim(); }
    const categories = [...adminCatalog.categories];
    const products = [...adminCatalog.products];
    if (category) {
      const index = categories.findIndex((item) => item.id === category.id);
      if (index >= 0) categories[index] = next;
      if (category.id !== next.id) {
        for (let i = 0; i < products.length; i++) {
          if (products[i].categoryId === category.id) products[i] = { ...products[i], categoryId: next.id };
        }
      }
    } else categories.push(next);
    await persistCatalog({ ...adminCatalog, categories, products }, dialog.querySelector('[data-form-error]'));
  });
  dialog.showModal();
}

function openProductForm(product = null) {
  if (!adminCatalog.categories.length) { setAdminStatus(ui.emptyCategories, 'error'); return; }
  const existing = product || { id: `product-${Date.now().toString(36)}`, name: '', categoryId: adminCatalog.categories[0].id, status: 'published', platforms: [], imageUrl: '', shortDescription: { ar: '', en: '', fr: '' }, description: { ar: '', en: '', fr: '' }, links: {} };
  const dialog = ensureDialog();
  let fields = `<div class="admin-form-grid">${formField(ui.id, 'id', existing.id, { required: true })}${formField(ui.name, 'name', existing.name, { required: true })}
  <div class="admin-field"><label for="product-category">${escapeHtml(ui.category)}</label><select id="product-category" name="categoryId" required>${categoryOptions(existing.categoryId)}</select></div>
  <div class="admin-field"><label for="product-status">${escapeHtml(ui.status)}</label><select id="product-status" name="status">${statusOptions(existing.status)}</select></div>
  ${formField(ui.image, 'imageUrl', existing.imageUrl || '', { full: true, type: 'url', placeholder: 'https://… or /local-image.png' })}
  <div class="admin-field admin-field-full"><label for="image-file">${escapeHtml(ui.imageFile)}</label><div class="upload-row"><input id="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button class="admin-btn" type="button" data-upload>${escapeHtml(ui.upload)}</button></div></div>`;
  for (const code of BECETTI_LANGUAGES) {
    fields += localeHeading(code) + `<div class="admin-field admin-field-full"><label for="short_${code}">${escapeHtml(ui.description)} · ${escapeHtml(ui.langNames[code])}</label><textarea id="short_${code}" name="short_${code}" maxlength="300">${escapeHtml(existing.shortDescription?.[code] || '')}</textarea></div>`;
    fields += `<div class="admin-field admin-field-full"><label for="long_${code}">${escapeHtml(ui.longDescription)} · ${escapeHtml(ui.langNames[code])}</label><textarea id="long_${code}" name="long_${code}" maxlength="2400">${escapeHtml(existing.description?.[code] || '')}</textarea></div>`;
  }
  fields += `<fieldset class="admin-platforms admin-field-full"><legend>${escapeHtml(ui.platforms)}</legend>${['android', 'windows'].map((platform) => {
    const checked = Array.isArray(existing.platforms) ? existing.platforms.includes(platform) : Boolean(existing.links?.[platform]);
    return `<label><input type="checkbox" name="platforms" value="${platform}"${checked ? ' checked' : ''}><span>${escapeHtml(ui[platform])}</span></label>`;
  }).join('')}</fieldset><h3 class="admin-locale-heading">${escapeHtml(ui.links)}</h3>`;
  for (const key of BECETTI_LINK_KEYS) fields += formField(ui[key] || ui.other, `link_${key}`, existing.links?.[key] || '', { type: 'url', full: true, required: key === 'web', placeholder: 'https://…' });
  fields += `</div>`;
  dialog.innerHTML = `<form class="admin-form" id="product-form"><div class="admin-form-head"><h2>${escapeHtml(product ? ui.editProduct : ui.newProduct)}</h2><button class="admin-close" type="button" aria-label="${escapeHtml(ui.close)}">×</button></div>${fields}<p class="admin-dialog-error" data-form-error hidden></p><div class="admin-form-actions"><button class="admin-btn" type="button" data-cancel>${escapeHtml(ui.cancel)}</button><button class="admin-btn admin-btn-primary" type="submit">${escapeHtml(ui.save)}</button></div></form>`;
  dialog.querySelector('.admin-close')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-cancel]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-upload]')?.addEventListener('click', async () => {
    const file = dialog.querySelector('#image-file')?.files?.[0];
    const error = dialog.querySelector('[data-form-error]');
    if (!file) { error.hidden = false; error.textContent = ui.uploadFail; return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      error.hidden = false; error.textContent = lang === 'ar' ? 'اختر صورة PNG أو JPEG أو WebP أو GIF لا تتجاوز 5 MB.' : 'Choose a PNG, JPEG, WebP or GIF image no larger than 5 MB.'; return;
    }
    const button = dialog.querySelector('[data-upload]'); button.disabled = true; button.textContent = ui.saving;
    try {
      const tokenResponse = await adminRequest('becetti/image-token', { method: 'POST', body: { contentType: file.type } });
      const { put } = await import('@vercel/blob/client');
      const uploaded = await put(tokenResponse.pathname, file, { access: 'public', token: tokenResponse.clientToken, contentType: file.type });
      dialog.querySelector('#imageUrl').value = uploaded.url;
      error.hidden = true;
      showToast(lang === 'ar' ? 'تم رفع الصورة.' : lang === 'fr' ? 'Image téléversée.' : 'Image uploaded.');
    } catch {
      error.hidden = false; error.textContent = ui.uploadFail;
    } finally { button.disabled = false; button.textContent = ui.upload; }
  });
  dialog.querySelector('#product-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const links = {};
    for (const key of BECETTI_LINK_KEYS) { const value = String(form.get(`link_${key}`) || '').trim(); if (value) links[key] = value; }
    const next = {
      id: String(form.get('id') || '').trim().toLowerCase(), name: String(form.get('name') || '').trim(), categoryId: form.get('categoryId'), status: form.get('status'),
      platforms: form.getAll('platforms').map((platform) => String(platform)),
      imageUrl: String(form.get('imageUrl') || '').trim(), shortDescription: {}, description: {}, links,
    };
    for (const code of BECETTI_LANGUAGES) { next.shortDescription[code] = String(form.get(`short_${code}`) || '').trim(); next.description[code] = String(form.get(`long_${code}`) || '').trim(); }
    const products = [...adminCatalog.products];
    if (product) {
      const index = products.findIndex((item) => item.id === product.id);
      if (index >= 0) products[index] = next;
    } else products.push(next);
    await persistCatalog({ ...adminCatalog, products }, dialog.querySelector('[data-form-error]'));
  });
  dialog.showModal();
}

async function persistCatalog(next, errorNode = null) {
  try {
    if (import.meta.env.DEV) throw Object.assign(new Error('preview_disabled'), { code: 'preview_disabled' });
    setAdminStatus(ui.saving);
    const result = await adminRequest('becetti/catalog', { method: 'PUT', body: { catalog: next } });
    adminCatalog = result.catalog;
    const wasDialogOpen = dialogNode?.open;
    if (wasDialogOpen) dialogNode.close();
    renderAdminLists();
    setAdminStatus(ui.saved, 'success');
    showToast(ui.saved);
  } catch (error) {
    const message = error.code === 'invalid_catalog' ? ui.validationError : error.status === 400 ? ui.badLink : error.code === 'preview_disabled' ? ui.preview : ui.error;
    if (errorNode) { errorNode.hidden = false; errorNode.textContent = message; }
    else setAdminStatus(message, 'error');
  }
}

async function handleAdminAction(action, id) {
  if (action === 'edit-category') return openCategoryForm(adminCatalog.categories.find((item) => item.id === id));
  if (action === 'edit-product') return openProductForm(adminCatalog.products.find((item) => item.id === id));
  if (!window.confirm(ui.deleteConfirm)) return;
  if (action === 'delete-category') {
    if (adminCatalog.products.some((item) => item.categoryId === id)) { setAdminStatus(ui.categoryHasProjects, 'error'); return; }
    await persistCatalog({ ...adminCatalog, categories: adminCatalog.categories.filter((item) => item.id !== id) });
  }
  if (action === 'delete-product') await persistCatalog({ ...adminCatalog, products: adminCatalog.products.filter((item) => item.id !== id) });
}

async function startAdmin() {
  const root = adminRoot();
  if (!root) return;
  if (import.meta.env.DEV) {
    adminPreview = true;
    adminCatalog = structuredClone(BECETTI_DEFAULT_CATALOG);
    renderAdminLists();
    setAdminStatus(ui.preview);
    return;
  }
  if (!token()) {
    showAdminGate(ui.signInTitle, ui.signIn, adminHomeLink(), ui.signInButton);
    return;
  }
  showAdminGate(ui.title, ui.authLoading);
  try {
    await adminRequest('becetti/admin');
    const result = await adminRequest('becetti/catalog');
    adminCatalog = result.catalog;
    renderAdminLists();
  } catch (error) {
    if (error.status === 401) showAdminGate(ui.signInTitle, ui.signIn, adminHomeLink(), ui.signInButton);
    else if (error.status === 403) showAdminGate(ui.title, ui.denied, '/becetti/index.html', ui.back);
    else showAdminGate(ui.title, ui.apiDown, '/becetti/index.html', ui.back);
  }
}

if (isAdminPage) startAdmin();
else { setupNavigation(); loadPublicCatalog(); }
