// Public BECETTI catalogue: the only default project below is backed by this repository
// and its existing published web / Android endpoints. Add products through the protected
// admin panel; never add a listing without a verified public destination.
export const BECETTI_DEFAULT_CATALOG = {
  schemaVersion: 1,
  updatedAt: null,
  categories: [
    {
      id: 'ai',
      icon: 'spark',
      sortOrder: 1,
      name: { ar: 'BECETTI AI', en: 'BECETTI AI', fr: 'BECETTI AI' },
      description: {
        ar: 'تطبيقات ذكاء اصطناعي عملية تساعد على التفكير والإنجاز.',
        en: 'Practical AI products built to help people think and get things done.',
        fr: 'Des produits d’IA pratiques pour réfléchir et avancer.',
      },
    },
    {
      id: 'game',
      icon: 'game',
      sortOrder: 2,
      name: { ar: 'BECETTI GAME', en: 'BECETTI GAME', fr: 'BECETTI GAME' },
      description: {
        ar: 'ألعاب وتجارب ترفيهية من BECETTI.',
        en: 'Games and entertainment experiences from BECETTI.',
        fr: 'Jeux et expériences de divertissement BECETTI.',
      },
    },
    {
      id: 'business',
      icon: 'briefcase',
      sortOrder: 3,
      name: { ar: 'BECETTI BUSINESS', en: 'BECETTI BUSINESS', fr: 'BECETTI BUSINESS' },
      description: {
        ar: 'خدمات ومنصات رقمية للمشاريع والأعمال.',
        en: 'Digital services and platforms for work and business.',
        fr: 'Services et plateformes numériques pour les projets et les entreprises.',
      },
    },
    {
      id: 'security',
      icon: 'shield',
      sortOrder: 4,
      name: { ar: 'BECETTI SECURITY', en: 'BECETTI SECURITY', fr: 'BECETTI SECURITY' },
      description: {
        ar: 'حلول رقمية تركز على الحماية والأمان.',
        en: 'Digital products focused on privacy and security.',
        fr: 'Des produits numériques axés sur la protection et la sécurité.',
      },
    },
    {
      id: 'tools',
      icon: 'tools',
      sortOrder: 5,
      name: { ar: 'BECETTI TOOLS', en: 'BECETTI TOOLS', fr: 'BECETTI TOOLS' },
      description: {
        ar: 'أدوات عملية للإنتاجية والمهام اليومية.',
        en: 'Useful tools for productivity and everyday tasks.',
        fr: 'Des outils utiles pour la productivité et les tâches quotidiennes.',
      },
    },
  ],
  products: [
    {
      id: 'nexora-ai',
      name: 'NEXORA AI',
      categoryId: 'ai',
      status: 'published',
      imageUrl: '/icon-512.png',
      shortDescription: {
        ar: 'منصة ذكاء اصطناعي على الويب، مع NEXORA Studio لبناء التطبيقات.',
        en: 'A web AI platform, with NEXORA Studio for building apps.',
        fr: 'Une plateforme d’IA sur le Web, avec NEXORA Studio pour créer des applications.',
      },
      description: {
        ar: 'منصة ويب متكاملة للذكاء الاصطناعي تجمع المحادثة والكتابة والمساعدة البرمجية مع NEXORA Studio لإنشاء المشاريع واستعراضها ونشرها.',
        en: 'A web-first AI platform for chat, writing and coding help, with NEXORA Studio to create, preview and publish projects.',
        fr: 'Une plateforme d’IA axée sur le Web pour discuter, écrire et coder, avec NEXORA Studio pour créer, prévisualiser et publier des projets.',
      },
      platforms: ['android', 'windows'],
      links: {
        web: 'https://nexora-social-2026.vercel.app/',
        android: 'https://nexora-social-2026.vercel.app/download/Nexora.apk',
        windows: 'https://nexora-social-2026.vercel.app/windows/index.html',
      },
    },
  ],
};

export const BECETTI_LANGUAGES = ['ar', 'en', 'fr'];
export const BECETTI_PRODUCT_STATUSES = ['published', 'development', 'coming-soon'];
export const BECETTI_LINK_KEYS = ['web', 'android', 'windows', 'googlePlay', 'microsoftStore', 'appStore', 'other'];
