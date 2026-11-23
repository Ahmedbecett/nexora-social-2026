// Generate the public BECETTI pages and a dedicated sitemap.
// The catalogue is shared with the protected API and the browser; only verified products
// from shared/becetti-catalog.js appear in the pre-rendered HTML.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BECETTI_DEFAULT_CATALOG, BECETTI_LANGUAGES } from '../shared/becetti-catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = (process.env.BECETTI_SITE_URL || 'https://nexora-social-2026.vercel.app/becetti').replace(/\/+$/, '');
const updated = '2026-11-23';
const filesByPage = {
  home: 'index.html', about: 'about.html', products: 'products.html', ai: 'ai.html', game: 'game.html',
  business: 'business.html', security: 'security.html', tools: 'tools.html', contact: 'contact.html',
  privacy: 'privacy.html', terms: 'terms.html',
};
const categoryPages = { ai: 'ai', game: 'game', business: 'business', security: 'security', tools: 'tools' };
const languageDirectory = (lang) => lang === 'ar' ? '' : `${lang}/`;
const fileFor = (lang, page) => `becetti/${languageDirectory(lang)}${filesByPage[page]}`;
const urlPathFor = (lang, page) => `/becetti/${languageDirectory(lang)}${filesByPage[page]}`;
const canonicalFor = (lang, page) => `${origin}/${languageDirectory(lang)}${filesByPage[page]}`;
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
const local = (value, lang, fallback = '') => value?.[lang] || value?.en || fallback;

const words = {
  ar: {
    nav: { home: 'الرئيسية', about: 'عن BECETTI', products: 'منتجاتنا', ai: 'BECETTI AI', game: 'BECETTI GAME', business: 'BECETTI BUSINESS', security: 'BECETTI SECURITY', tools: 'BECETTI TOOLS', contact: 'التواصل' },
    sectors: 'الأقسام', menu: 'فتح القائمة', close: 'إغلاق القائمة', tagline: 'Technology that works.', skip: 'انتقل إلى المحتوى', discover: 'اكتشف المنتجات', aboutLink: 'عن العلامة', viewAll: 'عرض جميع المنتجات', category: 'القسم', status: { published: 'متاح الآن', development: 'قيد التطوير', 'coming-soon': 'قريباً' },
    links: { web: 'افتح الموقع', android: 'تنزيل Android APK', windows: 'صفحة Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'زيارة المشروع' },
    platforms: { android: 'تطبيقات Android', windows: 'تطبيقات Windows' }, platformDescriptions: { android: 'تطبيقات أندرويد المنشورة وروابط الموقع والتنزيل الرسمية.', windows: 'تطبيقات Windows المنشورة وروابط الموقع وصفحة التطبيق الرسمية.' },
    product: 'منتج', products: 'المنتجات', emptyTitle: 'لا توجد منتجات منشورة في هذا القسم بعد', empty: 'نعرض هنا المشاريع الحقيقية فقط، بعد توفر صفحة أو رابط رسمي يمكن للزوار التحقق منه.', emptyAction: 'استكشف كل المنتجات', updated: 'آخر تحديث', footer: 'علامة تقنية مستقلة تركّز على منتجات رقمية مفيدة وواضحة.', contactEmail: 'راسل BECETTI', admin: 'إدارة المحتوى', contact: 'للتواصل والدعم الفني',
  },
  en: {
    nav: { home: 'Home', about: 'About BECETTI', products: 'Our products', ai: 'BECETTI AI', game: 'BECETTI GAME', business: 'BECETTI BUSINESS', security: 'BECETTI SECURITY', tools: 'BECETTI TOOLS', contact: 'Contact' },
    sectors: 'Explore divisions', menu: 'Open navigation', close: 'Close navigation', tagline: 'Technology that works.', skip: 'Skip to content', discover: 'Explore products', aboutLink: 'About the brand', viewAll: 'View all products', category: 'Division', status: { published: 'Available now', development: 'In development', 'coming-soon': 'Coming soon' },
    links: { web: 'Open website', android: 'Android APK', windows: 'Windows app page', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'Visit project' },
    platforms: { android: 'Android apps', windows: 'Windows apps' }, platformDescriptions: { android: 'Published Android apps, with official website and download links.', windows: 'Published Windows apps, with their official website and app pages.' },
    product: 'product', products: 'Products', emptyTitle: 'No published products in this division yet', empty: 'Only real projects with an official page or a verifiable destination are listed here.', emptyAction: 'Explore all products', updated: 'Last updated', footer: 'An independent technology brand focused on useful, clear digital products.', contactEmail: 'Email BECETTI', admin: 'Content admin', contact: 'Contact and technical support',
  },
  fr: {
    nav: { home: 'Accueil', about: 'À propos de BECETTI', products: 'Nos produits', ai: 'BECETTI AI', game: 'BECETTI GAME', business: 'BECETTI BUSINESS', security: 'BECETTI SECURITY', tools: 'BECETTI TOOLS', contact: 'Contact' },
    sectors: 'Nos divisions', menu: 'Ouvrir la navigation', close: 'Fermer la navigation', tagline: 'Technology that works.', skip: 'Aller au contenu', discover: 'Découvrir les produits', aboutLink: 'À propos de la marque', viewAll: 'Voir tous les produits', category: 'Division', status: { published: 'Disponible', development: 'En développement', 'coming-soon': 'Bientôt' },
    links: { web: 'Ouvrir le site', android: 'APK Android', windows: 'Page de l’application Windows', googlePlay: 'Google Play', microsoftStore: 'Microsoft Store', appStore: 'App Store', other: 'Visiter le projet' },
    platforms: { android: 'Applications Android', windows: 'Applications Windows' }, platformDescriptions: { android: 'Applications Android publiées, avec leurs liens officiels vers le site et le téléchargement.', windows: 'Applications Windows publiées, avec leur site officiel et leur page dédiée.' },
    product: 'produit', products: 'Produits', emptyTitle: 'Aucun produit publié dans cette division pour le moment', empty: 'Seuls les projets réels disposant d’une page officielle ou d’une destination vérifiable sont affichés ici.', emptyAction: 'Découvrir tous les produits', updated: 'Dernière mise à jour', footer: 'Une marque technologique indépendante axée sur des produits numériques utiles et clairs.', contactEmail: 'Écrire à BECETTI', admin: 'Administration du contenu', contact: 'Contact et assistance technique',
  },
};

const copy = {
  ar: {
    home: {
      title: 'BECETTI | تقنية تعمل لأجلك', description: 'المنظومة الرقمية الرسمية لعلامة BECETTI. استكشف المنتجات الحقيقية المنشورة في الذكاء الاصطناعي والألعاب والأعمال والأمان والأدوات.', eyebrow: 'منظومة رقمية واحدة · منتجات حقيقية', heading: 'تقنية تعمل لأجلك.', lead: 'علامة تقنية مستقلة تجمع منتجاتها الرقمية في مكان واحد — بهوية واضحة وروابط رسمية، دون قوائم وهمية.',
      sections: [
        ['منتجات تصنع فرقاً عملياً', 'نطوّر وننشر أدوات رقمية تساعد الناس على إنجاز المهام، واستكشاف الأفكار، وبناء تجارب أفضل. ابدأ بالمنتج المتاح اليوم، وتعرّف على الأقسام التي تتوسع مع الوقت.'],
        ['الأقسام الرئيسية', 'من الذكاء الاصطناعي إلى الألعاب والأعمال والأمان والإنتاجية — كل مشروع يظهر في قسمه الصحيح، مع حالته وروابطه الرسمية.'],
        ['وضوح قبل كل شيء', 'لا نضع تطبيقاً في القائمة لمجرد ملء المساحة. إذا لم يتوفر رابط رسمي قابل للتحقق، فلن يظهر كمشروع منشور.'],
      ],
    },
    about: {
      title: 'عن BECETTI | علامة تقنية مستقلة', description: 'تعرّف على BECETTI، علامة تقنية مستقلة أسسها ويقودها أحمد بسيتي، ورؤيتها لمنظومة رقمية موحدة.', eyebrow: 'عن العلامة', heading: 'علامة واحدة. منتجات رقمية مفيدة.', lead: 'BECETTI علامة تقنية مستقلة أنشأها ويقودها أحمد بسيتي، تجمع المشاريع المنشورة تحت هوية موحدة وقابلة للتوسع.',
      sections: [
        ['ما هي BECETTI؟', 'BECETTI هو الاسم الجامع لمجموعة من المشاريع والتطبيقات الرقمية. لكل منتج وظيفته وجمهوره، لكن جميعها تتبع مبدأ واحداً: تقنية واضحة وعملية تخدم حاجة حقيقية.'],
        ['كيف ننظّم منتجاتنا؟', 'تقسم المنظومة إلى BECETTI AI وBECETTI GAME وBECETTI BUSINESS وBECETTI SECURITY وBECETTI TOOLS. يمكن إضافة أقسام جديدة من لوحة الإدارة دون إعادة بناء الموقع.'],
        ['من يقف وراء العلامة؟', 'أنشأ أحمد بسيتي (Ahmed Becetti) هذه المشاريع ويطوّرها. تتحدث هذه الصفحة عن العلامة والمنتجات الرقمية، ولا تدّعي صفة قانونية أو تجارية غير موثقة.'],
        ['معيار الإدراج', 'نضيف المنتجات المنشورة مع روابط يمكن التحقق منها فقط. أما الأقسام التي لا تحتوي على منتج منشور، فنوضح ذلك بدلاً من عرض مشاريع تجريبية أو مختلقة.'],
      ],
    },
    products: {
      title: 'منتجات BECETTI | التطبيقات والمنصات', description: 'تصفح تطبيقات BECETTI في قسمين منفصلين لـ Android وWindows، مع رابط الموقع الرسمي لكل مشروع.', eyebrow: 'دليل المنتجات', heading: 'منتجاتنا', lead: 'كل ما هو منشور فعلاً تحت علامة BECETTI، مع حالة المنتج وروابطه الأصلية.',
      sections: [['تصفح حسب القسم والنظام', 'تظهر تطبيقات Android وWindows في مجموعتين منفصلتين. اختر قسماً لتصفية القائمتين، وافتح رابط الموقع الرسمي لكل مشروع. لا ندرج رابط متجر غير منشور.']],
    },
    ai: {
      title: 'BECETTI AI | منتجات الذكاء الاصطناعي', description: 'استكشف منتجات الذكاء الاصطناعي من BECETTI، بما في ذلك NEXORA AI وروابطه الرسمية للويب وأندرويد.', eyebrow: 'قسم الذكاء الاصطناعي', heading: 'BECETTI AI', lead: 'تطبيقات الذكاء الاصطناعي التي تساعد على التفكير والإنجاز. المنتج المنشور حالياً في هذا القسم هو NEXORA AI.', sections: [['NEXORA AI', 'منصة ويب متكاملة للذكاء الاصطناعي مع NEXORA Studio لبناء التطبيقات، ومساعدة في المحادثة والكتابة والبرمجة. افتح المنصة على الويب أو نزّل ملف Android APK من الرابط الرسمي. لا يوجد رابط Google Play منشور في هذا الدليل حالياً.']],
    },
    game: {
      title: 'BECETTI GAME | الألعاب والترفيه', description: 'قسم الألعاب والترفيه من BECETTI. لا تظهر هنا ألعاب غير منشورة أو روابط تجريبية.', eyebrow: 'قسم الألعاب والترفيه', heading: 'BECETTI GAME', lead: 'ألعاب وتجارب ترفيهية من BECETTI، تُضاف عند توفر إصدار أو صفحة رسمية قابلة للتحقق.', sections: [['الألعاب المنشورة', 'لا توجد ألعاب منشورة مدرجة حالياً. سنعرض اللعبة هنا عندما يتوفر رابط رسمي، ولن نستخدم بيانات أو صوراً لمشاريع غير موجودة.']],
    },
    business: {
      title: 'BECETTI BUSINESS | الخدمات والمنصات', description: 'قسم الخدمات والمنصات التجارية من BECETTI. تصفح المشاريع المنشورة وروابطها الرسمية.', eyebrow: 'قسم الأعمال', heading: 'BECETTI BUSINESS', lead: 'خدمات ومنصات رقمية للمشاريع والأعمال، مع تعريف واضح بكل منتج ورابطه الرسمي.', sections: [['منصات الأعمال', 'لا توجد منصة أعمال منشورة مدرجة حالياً. سيظهر أي مشروع عند اعتماده وإضافة معلوماته وروابطه الرسمية من لوحة الإدارة.']],
    },
    security: {
      title: 'BECETTI SECURITY | الحماية والأمان', description: 'قسم الحماية والأمان من BECETTI. لا نعرض أدوات أمنية قبل نشرها والتحقق من مصدرها.', eyebrow: 'قسم الحماية', heading: 'BECETTI SECURITY', lead: 'منتجات رقمية تركز على الحماية والأمان، مع معلومات وروابط يمكن التحقق منها.', sections: [['منتجات الأمان', 'لا توجد تطبيقات أمنية منشورة مدرجة حالياً. لن نضع ادعاءات أو وعوداً أمنية لمنتج غير متاح.']],
    },
    tools: {
      title: 'BECETTI TOOLS | الأدوات الإنتاجية', description: 'قسم الأدوات الإنتاجية من BECETTI. اعثر على الأدوات الرقمية المنشورة وروابطها الرسمية.', eyebrow: 'قسم الأدوات', heading: 'BECETTI TOOLS', lead: 'أدوات عملية للإنتاجية والمهام اليومية — سهلة الوصول، وواضحة الوظيفة.', sections: [['أدوات متاحة', 'لا توجد أدوات منشورة مدرجة حالياً. ستظهر الأدوات الحقيقية هنا عند إطلاقها رسمياً.']],
    },
    contact: {
      title: 'التواصل مع BECETTI | الدعم الفني', description: 'تواصل مع أحمد بسيتي وفريق BECETTI للاستفسارات العامة والدعم الفني عبر البريد الرسمي.', eyebrow: 'نحن هنا للمساعدة', heading: 'تواصل معنا', lead: 'للاستفسارات العامة، الدعم الفني أو الإبلاغ عن مشكلة في أحد المنتجات، تواصل معنا عبر البريد الإلكتروني.', sections: [['البريد الإلكتروني', 'اكتب لنا على البريد الرسمي. لتسريع المساعدة، اذكر اسم المنتج والجهاز ونظام التشغيل، ولا ترسل كلمات مرور أو مفاتيح API.'], ['روابط المنتجات', 'للدعم الخاص بتطبيق معيّن، أضف اسم التطبيق ورقم الإصدار في عنوان الرسالة. لكل منتج شروط وخصوصية منفصلة عند انطباقها.']],
    },
    privacy: {
      title: 'سياسة الخصوصية | موقع BECETTI الرسمي', description: 'سياسة خصوصية موقع BECETTI: المعلومات التي يعالجها الموقع، التواصل عبر البريد، روابط المنتجات، وحقوق المستخدم.', eyebrow: 'معلومات واضحة', heading: 'سياسة الخصوصية', lead: 'تشرح هذه السياسة ما يحدث عند تصفح موقع BECETTI الرسمي والتواصل معنا. آخر تحديث: 23 نوفمبر 2026.', sections: [
        ['نطاق هذه السياسة', 'تنطبق هذه السياسة على صفحات منظومة BECETTI العامة ضمن هذا الموقع، ولا تحل محل سياسة الخصوصية الخاصة بمنتج مستقل. يستخدم NEXORA AI، على سبيل المثال، سياسة الخصوصية المنشورة على موقعه.'],
        ['البيانات التي يطلبها الموقع', 'لا يحتوي الموقع العام على إنشاء حساب أو نموذج يجمع بياناتك. يُستخدم طلب عام إلى واجهة الكتالوج لعرض قائمة المنتجات وروابطها؛ لا يرسل هذا الطلب اسمك أو عنوان بريدك أو رمز دخولك.'],
        ['السجلات التقنية والاستضافة', 'قد تعالج خدمة الاستضافة وواجهة API بيانات الطلب التقنية اللازمة للتشغيل والحماية، وفق إعداداتها وشروطها. لا نتحكم في سجلات مزود الاستضافة أو فترات احتفاظه بها؛ راجع معلومات المزود عند الحاجة.'],
        ['البريد والروابط الخارجية', 'عند مراسلتنا، يعالج مزود البريد الذي تستخدمه رسالتك وعنوانك. الروابط إلى مواقع المتاجر والمنتجات والخدمات الخارجية تخضع لسياسات الجهات المشغلة لها. لا ترسل كلمات مرور أو رموز تحقق أو مفاتيح سرية بالبريد.'],
        ['التتبع وملفات تعريف الارتباط', 'لا تضيف صفحات BECETTI العامة أدوات إعلانات أو تحليلات أو ملفات تعريف ارتباط للتتبع. قد يستخدم المتصفح أو مزود الاستضافة تقنيات لازمة لتقديم الخدمة أو الحماية.'],
        ['الأطفال والتحديثات', 'الموقع دليل عام للمنتجات وليس خدمة موجهة لجمع بيانات الأطفال. قد نحدّث هذه السياسة عند تغيير وظائف الموقع؛ وسيظهر تاريخ التحديث أعلى الصفحة.'],
        ['التواصل بشأن الخصوصية', 'لأي سؤال أو طلب متعلق بخصوصية موقع BECETTI، تواصل معنا عبر البريد الإلكتروني المذكور في صفحة التواصل.'],
      ],
    },
    terms: {
      title: 'شروط الاستخدام | موقع BECETTI الرسمي', description: 'شروط استخدام موقع BECETTI الرسمي ودليل المنتجات والروابط إلى التطبيقات والمنصات الخارجية.', eyebrow: 'قبل استخدام الموقع', heading: 'شروط الاستخدام', lead: 'توضح هذه الشروط قواعد استخدام موقع BECETTI العام. آخر تحديث: 23 نوفمبر 2026.', sections: [
        ['طبيعة الموقع', 'هذا الموقع دليل معلوماتي لعلامة BECETTI وبعض منتجاتها المنشورة. BECETTI اسم علامة تقنية؛ ولا يقصد بهذه الصفحة وحدها إثبات شكل قانوني أو تسجيل تجاري.'],
        ['المعلومات والروابط', 'نبذل جهداً معقولاً لإظهار معلومات دقيقة وروابط رسمية، لكن توافر المنتجات أو خصائصها أو شروط متاجر التطبيقات قد يتغير. تحقّق من التفاصيل على الموقع الرسمي للمنتج أو المتجر قبل التنزيل أو الاستخدام.'],
        ['الاستخدام المقبول', 'استخدم الموقع لأغراض مشروعة، ولا تحاول تعطيله أو الوصول غير المصرح به إلى لوحة الإدارة أو الخدمات الخلفية.'],
        ['حقوق الملكية', 'ما لم يُذكر خلاف ذلك، تعود أسماء العلامات والشعارات والمحتوى المنشور إلى مالكيها. لا تنسخ أو تعِد استخدام الأصول بطريقة توحي بوجود علاقة أو تأييد دون إذن.'],
        ['الخدمات الخارجية والمنتجات', 'عند الانتقال إلى رابط خارجي، تسري شروط الجهة المستقبلة وسياسة الخصوصية الخاصة بها. قد تخضع المنتجات المستقلة لشروط إضافية خاصة بها، ولا تعد هذه الصفحة بديلاً عنها.'],
        ['التوفر وحدود المسؤولية', 'يُقدّم هذا الدليل كما هو، وقد تتوقف صفحة أو رابط مؤقتاً أو يتغير. إلى الحد الذي يسمح به القانون، لا يضمن الموقع خلو المعلومات من كل خطأ أو استمرار توفر كل رابط.'],
        ['التغييرات والتواصل', 'قد نحدّث هذه الشروط عند تطوير الموقع. استمرار استخدام الموقع بعد نشر تحديث يعني الاطلاع على الصيغة الحالية. للاستفسارات، استخدم صفحة التواصل الرسمية.'],
      ],
    },
  },
  en: {
    home: {
      title: 'BECETTI | A digital ecosystem for useful products', description: 'The official digital ecosystem for BECETTI. Discover verified products across AI, games, business, security and tools.', eyebrow: 'One digital ecosystem · Real products', heading: 'Technology that works.', lead: 'An independent technology brand bringing its digital products together — with a clear identity and official links, never filler listings.',
      sections: [
        ['Products with a practical purpose', 'We build and publish digital tools that help people get work done, explore ideas and create better experiences. Start with what is available today and discover divisions that can grow over time.'],
        ['Clear divisions, one brand', 'From AI to games, business, security and productivity, each project belongs to the right division and shows its real status and official destinations.'],
        ['Clarity comes first', 'A product is not listed just to fill space. If there is no official, verifiable destination, it will not be presented as a published project.'],
      ],
    },
    about: {
      title: 'About BECETTI | Independent technology brand', description: 'Learn about BECETTI, an independent technology brand created and led by Ahmed Becetti, and its growing digital ecosystem.', eyebrow: 'About the brand', heading: 'One brand. Useful digital products.', lead: 'BECETTI is an independent technology brand created and led by Ahmed Becetti, bringing published projects together under one expandable identity.',
      sections: [
        ['What is BECETTI?', 'BECETTI is the umbrella name for a collection of digital projects and applications. Each product has its own purpose and audience, connected by one principle: clear, practical technology that meets a real need.'],
        ['How are products organised?', 'The ecosystem starts with BECETTI AI, BECETTI GAME, BECETTI BUSINESS, BECETTI SECURITY and BECETTI TOOLS. New divisions can be added through the admin panel without rebuilding the site.'],
        ['Who is behind the brand?', 'Ahmed Becetti creates and develops these projects. This page describes a technology brand and its digital products; it does not claim an unverified legal or corporate status.'],
        ['A real-listings standard', 'Published products are listed with destinations that visitors can verify. Where a division has no published product, we say so rather than showing mock projects.'],
      ],
    },
    products: {
      title: 'BECETTI Products | Apps and platforms', description: 'Browse BECETTI’s published apps in separate Android and Windows sections, with a verified website link for every project.', eyebrow: 'Product directory', heading: 'Our products', lead: 'Everything currently published under the BECETTI brand, with its actual status and original links.', sections: [['Browse by platform and division', 'Android and Windows apps appear in separate sections. Choose a division to filter both lists, and open the official website for every project. No unpublished store links are included.']],
    },
    ai: {
      title: 'BECETTI AI | Artificial intelligence products', description: 'Explore BECETTI AI products, including NEXORA AI and its official web and Android links.', eyebrow: 'Artificial intelligence', heading: 'BECETTI AI', lead: 'AI products made to help people think and get things done. NEXORA AI is currently the published product in this division.', sections: [['NEXORA AI', 'A web AI platform with NEXORA Studio for app building and tools for chat, writing and coding. Open the web platform or download the Android APK from its official link. No Google Play listing is published in this directory at this time.']],
    },
    game: {
      title: 'BECETTI GAME | Games and entertainment', description: 'Games and entertainment from BECETTI. No unpublished games or placeholder links are listed.', eyebrow: 'Games and entertainment', heading: 'BECETTI GAME', lead: 'Games and entertainment experiences from BECETTI, added when an official release or destination is available.', sections: [['Published games', 'There are no published games listed here yet. A game will appear when there is an official destination to verify; we do not use mock project data or images.']],
    },
    business: {
      title: 'BECETTI BUSINESS | Services and platforms', description: 'Digital business services and platforms from BECETTI. Browse real projects and their official links.', eyebrow: 'Business', heading: 'BECETTI BUSINESS', lead: 'Digital services and platforms for work and business, with clear information and an official destination for each product.', sections: [['Business platforms', 'There are no published business platforms listed yet. A project will appear when it is approved and its real information and official links are added in the admin panel.']],
    },
    security: {
      title: 'BECETTI SECURITY | Protection and safety', description: 'Security-focused products from BECETTI. We do not list security tools before release and verification.', eyebrow: 'Protection and security', heading: 'BECETTI SECURITY', lead: 'Digital products focused on protection and security, with information and destinations that can be verified.', sections: [['Security products', 'There are no published security apps listed yet. We will not make security claims or promises about a product that is not available.']],
    },
    tools: {
      title: 'BECETTI TOOLS | Productivity tools', description: 'Productivity tools from BECETTI. Find published digital tools and their official destinations.', eyebrow: 'Productivity tools', heading: 'BECETTI TOOLS', lead: 'Useful tools for productivity and everyday tasks — with a clear purpose and an official destination.', sections: [['Available tools', 'There are no published tools listed yet. Real tools will appear here when they are officially released.']],
    },
    contact: {
      title: 'Contact BECETTI | Technical support', description: 'Contact Ahmed Becetti and BECETTI for general enquiries and product support by email.', eyebrow: 'We are here to help', heading: 'Get in touch', lead: 'For general enquiries, technical support or to report a product issue, contact us by email.', sections: [['Email', 'Write to the official email address. To help us respond, include the product name, device and operating system. Never send passwords or API keys.'], ['Product support', 'For help with a specific app, add its name and version to the subject line. Individual products may have separate terms and privacy notices.']],
    },
    privacy: {
      title: 'Privacy Policy | Official BECETTI website', description: 'BECETTI website privacy: information processed by the site, email contact, product links and user choices.', eyebrow: 'Plain-language information', heading: 'Privacy policy', lead: 'This policy explains what happens when you browse the public BECETTI site or contact us. Last updated: 23 November 2026.', sections: [
        ['Scope', 'This policy covers the public pages of the BECETTI ecosystem on this site. It does not replace the privacy policy of a separate product. For example, NEXORA AI has its own privacy policy on its product site.'],
        ['Information requested by this site', 'The public site does not offer account registration or a form that collects your details. It may make a public catalogue request to display products and their links; that request does not send your name, email address or sign-in token.'],
        ['Technical logs and hosting', 'The hosting service and API may process technical request information needed to operate and protect the site, subject to their configurations and terms. We do not control the hosting provider’s logs or retention periods; consult the provider for details.'],
        ['Email and external links', 'If you email us, your email provider processes your message and address. Links to stores, products and other services are governed by their operators’ policies. Do not send passwords, verification codes or secret keys by email.'],
        ['Tracking and cookies', 'The public BECETTI pages do not add advertising, analytics or tracking cookies. Your browser or hosting provider may use technologies needed to deliver or protect the service.'],
        ['Children and updates', 'This site is a public product directory, not a service designed to collect children’s information. We may update this policy when site functions change; the update date appears above.'],
        ['Privacy enquiries', 'For questions or requests about privacy on the BECETTI site, contact us using the email on the Contact page.'],
      ],
    },
    terms: {
      title: 'Terms of Service | Official BECETTI website', description: 'Terms for using the BECETTI website, product directory and links to external apps and platforms.', eyebrow: 'Before using this site', heading: 'Terms of service', lead: 'These terms explain how to use the public BECETTI website. Last updated: 23 November 2026.', sections: [
        ['What this site is', 'This website is an informational directory for the BECETTI brand and some of its published products. BECETTI is a technology brand; this page alone does not assert a particular legal or registered corporate status.'],
        ['Information and links', 'We take reasonable care to show accurate information and official links, but product availability, features and app-store terms can change. Check the product or store’s official page before downloading or using a product.'],
        ['Acceptable use', 'Use this site lawfully. Do not attempt to disrupt it or gain unauthorised access to the admin panel or backend services.'],
        ['Intellectual property', 'Unless noted otherwise, brand names, logos and published content belong to their respective owners. Do not copy or reuse assets in a way that implies a relationship or endorsement without permission.'],
        ['Third-party services and products', 'When you follow an external link, the destination’s terms and privacy policy apply. Separate products may have additional terms of their own; these site terms do not replace them.'],
        ['Availability and limits', 'This directory is provided as is. A page or link may be temporarily unavailable or may change. To the extent permitted by law, the site does not guarantee that every item is error-free or that every link will remain available.'],
        ['Changes and contact', 'We may update these terms as the site develops. Continued use after an update means you have seen the current version. For questions, use the official Contact page.'],
      ],
    },
  },
  fr: {
    home: {
      title: 'BECETTI | Un écosystème numérique de produits utiles', description: 'L’écosystème numérique officiel de BECETTI. Découvrez des produits vérifiés en IA, jeux, entreprise, sécurité et outils.', eyebrow: 'Un écosystème numérique · Des produits réels', heading: 'La technologie qui vous sert.', lead: 'Une marque technologique indépendante qui réunit ses produits numériques sous une identité claire et des liens officiels — sans fausses fiches.',
      sections: [
        ['Des produits utiles au quotidien', 'Nous concevons et publions des outils numériques pour accomplir des tâches, explorer des idées et créer de meilleures expériences. Découvrez le produit disponible aujourd’hui et les divisions qui pourront évoluer.'],
        ['Des divisions claires, une marque', 'IA, jeux, entreprise, sécurité et productivité : chaque projet figure dans la bonne division, avec son statut réel et ses liens officiels.'],
        ['La clarté avant tout', 'Un produit n’est pas ajouté pour remplir l’espace. Sans destination officielle vérifiable, il n’est pas présenté comme un projet publié.'],
      ],
    },
    about: {
      title: 'À propos de BECETTI | Marque technologique indépendante', description: 'Découvrez BECETTI, une marque technologique indépendante créée et dirigée par Ahmed Becetti, et son écosystème numérique.', eyebrow: 'À propos de la marque', heading: 'Une marque. Des produits numériques utiles.', lead: 'BECETTI est une marque technologique indépendante créée et dirigée par Ahmed Becetti, qui rassemble ses projets publiés sous une identité extensible.',
      sections: [
        ['Qu’est-ce que BECETTI ?', 'BECETTI est le nom fédérateur d’un ensemble de projets et d’applications numériques. Chaque produit a son propre objectif et son public, autour d’un même principe : une technologie claire et pratique qui répond à un vrai besoin.'],
        ['Comment les produits sont-ils organisés ?', 'L’écosystème commence avec BECETTI AI, BECETTI GAME, BECETTI BUSINESS, BECETTI SECURITY et BECETTI TOOLS. De nouvelles divisions peuvent être ajoutées depuis l’administration sans reconstruire le site.'],
        ['Qui est à l’origine de la marque ?', 'Ahmed Becetti crée et développe ces projets. Cette page présente une marque technologique et ses produits numériques ; elle ne revendique aucun statut juridique ou commercial non vérifié.'],
        ['Un critère simple', 'Les produits publiés sont accompagnés de destinations que les visiteurs peuvent vérifier. Lorsqu’une division n’a pas encore de produit publié, nous le précisons au lieu d’afficher des projets fictifs.'],
      ],
    },
    products: {
      title: 'Produits BECETTI | Applications et plateformes', description: 'Parcourez les applications BECETTI dans des sections Android et Windows distinctes, avec un lien Web vérifié pour chaque projet.', eyebrow: 'Répertoire des produits', heading: 'Nos produits', lead: 'Tous les produits actuellement publiés sous la marque BECETTI, avec leur statut réel et leurs liens d’origine.', sections: [['Par plateforme et division', 'Les applications Android et Windows sont affichées dans deux sections distinctes. Choisissez une division pour filtrer les deux listes et ouvrez le site officiel de chaque projet. Aucun lien de boutique non publié n’est ajouté.']],
    },
    ai: {
      title: 'BECETTI AI | Produits d’intelligence artificielle', description: 'Découvrez les produits d’IA de BECETTI, dont NEXORA AI et ses liens officiels Web et Android.', eyebrow: 'Intelligence artificielle', heading: 'BECETTI AI', lead: 'Des produits d’IA pour réfléchir et avancer. NEXORA AI est actuellement le produit publié dans cette division.', sections: [['NEXORA AI', 'Une plateforme d’IA sur le Web avec NEXORA Studio pour créer des applications, et des outils de conversation, d’écriture et de programmation. Ouvrez la plateforme Web ou téléchargez l’APK Android depuis son lien officiel. Aucune fiche Google Play n’est publiée dans ce répertoire pour le moment.']],
    },
    game: {
      title: 'BECETTI GAME | Jeux et divertissement', description: 'Jeux et divertissement BECETTI. Aucun jeu non publié ni lien provisoire n’est affiché.', eyebrow: 'Jeux et divertissement', heading: 'BECETTI GAME', lead: 'Des jeux et expériences de divertissement BECETTI, ajoutés lorsqu’une version ou une destination officielle est disponible.', sections: [['Jeux publiés', 'Aucun jeu publié n’est répertorié pour le moment. Un jeu apparaîtra lorsqu’une destination officielle sera vérifiable ; aucun projet ni visuel fictif ne sera utilisé.']],
    },
    business: {
      title: 'BECETTI BUSINESS | Services et plateformes', description: 'Services et plateformes numériques BECETTI pour les entreprises. Découvrez les projets réels et leurs liens officiels.', eyebrow: 'Entreprise', heading: 'BECETTI BUSINESS', lead: 'Des services et plateformes numériques pour les projets et les entreprises, avec des informations claires et une destination officielle pour chaque produit.', sections: [['Plateformes professionnelles', 'Aucune plateforme professionnelle publiée n’est répertoriée pour le moment. Un projet sera affiché après validation et ajout de ses informations et liens officiels dans l’administration.']],
    },
    security: {
      title: 'BECETTI SECURITY | Protection et sécurité', description: 'Produits de sécurité BECETTI. Aucun outil n’est présenté avant sa publication et la vérification de sa source.', eyebrow: 'Protection et sécurité', heading: 'BECETTI SECURITY', lead: 'Des produits numériques axés sur la protection et la sécurité, avec des informations et des destinations vérifiables.', sections: [['Produits de sécurité', 'Aucune application de sécurité publiée n’est répertoriée pour le moment. Nous ne faisons aucune promesse de sécurité au sujet d’un produit indisponible.']],
    },
    tools: {
      title: 'BECETTI TOOLS | Outils de productivité', description: 'Outils de productivité BECETTI. Retrouvez les outils publiés et leurs destinations officielles.', eyebrow: 'Outils de productivité', heading: 'BECETTI TOOLS', lead: 'Des outils pratiques pour la productivité et les tâches quotidiennes, avec un objectif clair et une destination officielle.', sections: [['Outils disponibles', 'Aucun outil publié n’est répertorié pour le moment. Les outils réels apparaîtront ici après leur lancement officiel.']],
    },
    contact: {
      title: 'Contacter BECETTI | Assistance technique', description: 'Contactez Ahmed Becetti et BECETTI pour vos questions générales et l’assistance produit par e-mail.', eyebrow: 'Nous sommes là pour vous aider', heading: 'Contactez-nous', lead: 'Pour toute question générale, assistance technique ou signalement d’un problème produit, contactez-nous par e-mail.', sections: [['E-mail', 'Écrivez à l’adresse officielle. Pour faciliter la réponse, indiquez le produit, l’appareil et le système d’exploitation. N’envoyez jamais de mot de passe ni de clé API.'], ['Assistance produit', 'Pour une demande concernant une application précise, indiquez son nom et sa version dans l’objet. Chaque produit peut avoir ses propres conditions et politique de confidentialité.']],
    },
    privacy: {
      title: 'Politique de confidentialité | Site officiel BECETTI', description: 'Confidentialité du site BECETTI : données traitées, contact par e-mail, liens de produits et choix des visiteurs.', eyebrow: 'Des informations claires', heading: 'Politique de confidentialité', lead: 'Cette politique décrit ce qui se passe lorsque vous consultez le site public BECETTI ou nous contactez. Dernière mise à jour : 23 novembre 2026.', sections: [
        ['Champ d’application', 'Cette politique couvre les pages publiques de l’écosystème BECETTI sur ce site. Elle ne remplace pas la politique de confidentialité d’un produit indépendant. NEXORA AI, par exemple, dispose de sa propre politique sur son site produit.'],
        ['Informations demandées par le site', 'Le site public ne propose ni création de compte ni formulaire de collecte de données personnelles. Il peut effectuer une requête publique au catalogue pour afficher les produits et leurs liens ; cette requête n’envoie ni votre nom, ni votre adresse e-mail, ni votre jeton de connexion.'],
        ['Journaux techniques et hébergement', 'L’hébergeur et l’API peuvent traiter les informations techniques nécessaires au fonctionnement et à la sécurité du site, selon leurs configurations et conditions. Nous ne contrôlons pas les journaux ni les durées de conservation du fournisseur d’hébergement ; consultez-le pour en savoir plus.'],
        ['E-mail et liens externes', 'Si vous nous écrivez, votre fournisseur de messagerie traite votre message et votre adresse. Les liens vers des boutiques, produits et autres services relèvent des politiques de leurs exploitants. N’envoyez pas de mots de passe, codes de vérification ou clés secrètes par e-mail.'],
        ['Suivi et cookies', 'Les pages publiques BECETTI n’ajoutent aucun outil publicitaire, analytique ou cookie de suivi. Votre navigateur ou l’hébergeur peut utiliser des technologies nécessaires à la fourniture ou à la protection du service.'],
        ['Enfants et mises à jour', 'Ce site est un répertoire public de produits, et non un service destiné à collecter des informations sur des enfants. Nous pouvons actualiser cette politique si les fonctions du site évoluent ; la date de mise à jour est indiquée ci-dessus.'],
        ['Questions de confidentialité', 'Pour toute question ou demande concernant la confidentialité du site BECETTI, utilisez l’adresse e-mail indiquée sur la page Contact.'],
      ],
    },
    terms: {
      title: 'Conditions d’utilisation | Site officiel BECETTI', description: 'Conditions d’utilisation du site BECETTI, de son répertoire et de ses liens vers des applications et services externes.', eyebrow: 'Avant d’utiliser ce site', heading: 'Conditions d’utilisation', lead: 'Ces conditions expliquent l’utilisation du site public BECETTI. Dernière mise à jour : 23 novembre 2026.', sections: [
        ['Nature du site', 'Ce site est un répertoire informatif de la marque BECETTI et de certains de ses produits publiés. BECETTI est une marque technologique ; cette page ne revendique pas à elle seule un statut juridique ou commercial enregistré particulier.'],
        ['Informations et liens', 'Nous prenons soin de présenter des informations et liens officiels, mais la disponibilité des produits, leurs fonctions et les conditions des boutiques peuvent évoluer. Vérifiez les détails sur la page officielle du produit ou de la boutique avant tout téléchargement ou utilisation.'],
        ['Utilisation acceptable', 'Utilisez ce site conformément à la loi. N’essayez pas de le perturber ni d’accéder sans autorisation à l’administration ou aux services backend.'],
        ['Propriété intellectuelle', 'Sauf indication contraire, les noms de marque, logos et contenus publiés appartiennent à leurs propriétaires respectifs. Ne copiez pas les éléments et ne les réutilisez pas de façon à laisser croire à une relation ou approbation sans autorisation.'],
        ['Services et produits tiers', 'Lorsque vous suivez un lien externe, les conditions et la politique de confidentialité du service destinataire s’appliquent. Les produits indépendants peuvent avoir leurs propres conditions, que cette page ne remplace pas.'],
        ['Disponibilité et limites', 'Ce répertoire est fourni en l’état. Une page ou un lien peut être temporairement indisponible ou changer. Dans la limite permise par la loi, le site ne garantit ni l’absence de toute erreur ni la disponibilité permanente de chaque lien.'],
        ['Modifications et contact', 'Nous pouvons actualiser ces conditions au fil du développement du site. La poursuite de la navigation après une mise à jour vaut prise de connaissance de la version en vigueur. Pour toute question, utilisez la page Contact officielle.'],
      ],
    },
  },
};

const pageName = (page, lang) => words[lang].nav[page] || (page === 'privacy' ? copy[lang].privacy.heading : page === 'terms' ? copy[lang].terms.heading : 'BECETTI');
const categoryIcon = (name) => {
  const shapes = {
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9Z"/>',
    game: '<path d="M6 8h12a4 4 0 0 1 3.8 5.3l-1.2 3.8a2.1 2.1 0 0 1-3.4 1l-2.1-1.8H8.9l-2.1 1.8a2.1 2.1 0 0 1-3.4-1l-1.2-3.8A4 4 0 0 1 6 8Z"/><path d="M7 11v4M5 13h4M16.5 12.2h.1M18.5 14.4h.1"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    tools: '<path d="M14.5 6.5a5 5 0 0 0-6.8 6.8L3 18l3 3 4.7-4.7a5 5 0 0 0 6.8-6.8l-3 3-3-3 3-3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${shapes[name] || shapes.plus}</svg>`;
};

function productCard(product, lang, categories) {
  const strings = words[lang];
  const category = categories.find((item) => item.id === product.categoryId);
  const description = local(product.shortDescription, lang, local(product.description, lang));
  const imageUrl = product.imageUrl || '/becetti-mark.svg';
  const links = Object.entries(product.links || {}).filter(([, url]) => typeof url === 'string' && url.startsWith('https://'));
  const linkMarkup = links.map(([key, url]) => `<a class="product-link${key === 'web' ? ' product-link-primary' : ''}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(strings.links[key] || strings.links.other)} — ${esc(product.name)}">${esc(strings.links[key] || strings.links.other)} <span aria-hidden="true">↗</span></a>`).join('');
  return `<article class="product-card" data-product-card data-product-id="${esc(product.id)}" data-category-id="${esc(product.categoryId)}">
    <div class="product-card-top"><div class="product-logo-wrap"><img class="product-logo" src="${esc(imageUrl)}" alt="${esc(product.name)} logo" loading="lazy" onerror="this.onerror=null;this.src='/becetti-mark.svg'" /></div><span class="status-badge status-${esc(product.status)}" data-status="${esc(product.status)}">${esc(strings.status[product.status] || strings.status.published)}</span></div>
    <p class="product-category">${esc(local(category?.name, lang, 'BECETTI'))}</p>
    <h3>${esc(product.name)}</h3><p class="product-description">${esc(description)}</p>
    <div class="product-card-footer">${linkMarkup || `<span class="product-link-disabled">${esc(strings.status[product.status] || strings.status.published)}</span>`}</div>
  </article>`;
}

function platformSection(lang, platform, categories) {
  const strings = words[lang];
  const products = BECETTI_DEFAULT_CATALOG.products.filter((product) => product.platforms?.includes(platform));
  return `<section class="section platform-directory container" id="${platform}-apps" aria-labelledby="${platform}-apps-heading" data-platform-directory="${platform}">
    <div class="section-heading section-heading-compact"><div><p class="eyebrow eyebrow-dark">${esc(strings.platforms[platform])}</p><h2 id="${platform}-apps-heading">${esc(strings.platforms[platform])}</h2><p>${esc(strings.platformDescriptions[platform])}</p></div></div>
    <div class="product-grid" data-products data-page="products" data-platform="${platform}">${products.map((product) => productCard(product, lang, categories)).join('')}</div>
    <div class="empty-state" data-empty-state${products.length ? ' hidden' : ''}><span class="empty-symbol">B</span><h2>${esc(strings.emptyTitle)}</h2><p>${esc(strings.empty)}</p></div>
  </section>`;
}

function categoryCard(category, lang) {
  const href = categoryPages[category.id]
    ? urlPathFor(lang, category.id)
    : `${urlPathFor(lang, 'products')}?category=${encodeURIComponent(category.id)}`;
  return `<a class="category-card" href="${href}" data-category-card="${esc(category.id)}">
    <span class="category-icon category-icon-${esc(category.icon)}">${categoryIcon(category.icon)}</span>
    <span class="category-card-copy"><strong>${esc(local(category.name, lang, 'BECETTI'))}</strong><span>${esc(local(category.description, lang))}</span></span>
    <span class="category-arrow" aria-hidden="true">↗</span>
  </a>`;
}

function routeFor(lang, page) { return urlPathFor(lang, page); }
function renderNav(lang, current) {
  const t = words[lang];
  const primary = ['home', 'about', 'products', 'contact'];
  const navLinks = primary.map((key) => `<a href="${routeFor(lang, key)}"${current === key ? ' aria-current="page"' : ''}>${esc(t.nav[key])}</a>`).join('');
  const divisions = ['ai', 'game', 'business', 'security', 'tools'].map((key) => `<a href="${routeFor(lang, key)}"${current === key ? ' aria-current="page"' : ''}>${esc(t.nav[key])}</a>`).join('');
  return `<nav class="main-nav" id="main-nav" aria-label="${lang === 'ar' ? 'القائمة الرئيسية' : lang === 'fr' ? 'Navigation principale' : 'Main navigation'}">
    ${navLinks}<details class="nav-divisions"><summary>${esc(t.sectors)} <span aria-hidden="true">⌄</span></summary><div class="nav-dropdown">${divisions}</div></details>
    <a class="nav-contact" href="${routeFor(lang, 'contact')}"${current === 'contact' ? ' aria-current="page"' : ''}>${esc(t.nav.contact)}</a>
  </nav>`;
}

function renderHeader(lang, current, page) {
  const langLinks = BECETTI_LANGUAGES.filter((id) => id !== lang).map((id) => `<a href="${routeFor(id, page)}" lang="${id}" hreflang="${id}" data-becetti-language="${id}">${id.toUpperCase()}</a>`).join('');
  return `<a class="skip-link" href="#main">${esc(words[lang].skip)}</a>
<header class="site-header"><div class="header-inner">
  <a class="brand-lockup" href="${routeFor(lang, 'home')}" aria-label="BECETTI — ${esc(words[lang].nav.home)}"><img src="/becetti-mark.svg" width="42" height="42" alt=""/><span class="brand-copy"><strong>BECETTI</strong><small>${esc(words[lang].tagline)}</small></span></a>
  ${renderNav(lang, current)}
  <div class="header-actions"><details class="language-switch"><summary aria-label="Language">${lang.toUpperCase()} <span aria-hidden="true">⌄</span></summary><div class="language-menu">${langLinks}</div></details><button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="${esc(words[lang].menu)}"><span></span><span></span></button></div>
</div></header>`;
}

function renderFooter(lang) {
  const t = words[lang];
  const categories = ['ai', 'game', 'business', 'security', 'tools'].map((id) => `<a href="${routeFor(lang, id)}">${esc(t.nav[id])}</a>`).join('');
  return `<footer class="site-footer"><div class="footer-main"><div class="footer-brand"><a class="brand-lockup" href="${routeFor(lang, 'home')}"><img src="/becetti-mark.svg" width="42" height="42" alt=""/><span class="brand-copy"><strong>BECETTI</strong><small>${esc(t.tagline)}</small></span></a><p>${esc(t.footer)}</p></div><div class="footer-column"><h2>${esc(t.nav.products)}</h2>${categories}</div><div class="footer-column"><h2>${esc(t.contact)}</h2><a href="mailto:ahmedbecetti35@gmail.com">ahmedbecetti35@gmail.com</a><a href="${routeFor(lang, 'contact')}">${esc(t.nav.contact)}</a></div><div class="footer-column"><h2>${lang === 'ar' ? 'معلومات قانونية' : lang === 'fr' ? 'Informations légales' : 'Information'}</h2><a href="${routeFor(lang, 'privacy')}">${esc(copy[lang].privacy.heading)}</a><a href="${routeFor(lang, 'terms')}">${esc(copy[lang].terms.heading)}</a><a href="/becetti/admin.html?lang=${lang}" rel="nofollow">${esc(t.admin)}</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} BECETTI</span><span>${esc(t.tagline)}</span></div></footer>`;
}

function sectionCopy(data, lang) {
  return (data.sections || []).map(([heading, paragraph], index) => `<section class="content-section${index === 0 ? ' content-section-first' : ''}"><div class="section-marker"><span>0${index + 1}</span><span aria-hidden="true">/</span></div><div><h2>${esc(heading)}</h2><p>${esc(paragraph)}</p></div></section>`).join('\n');
}

function renderBody(page, lang, data) {
  const t = words[lang];
  const categories = [...BECETTI_DEFAULT_CATALOG.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const products = BECETTI_DEFAULT_CATALOG.products;
  if (page === 'home') {
    const featured = products[0];
    const headline = lang === 'ar' ? ['تقنية تعمل', 'لأجلك.'] : lang === 'fr' ? ['La technologie', 'à votre service.'] : ['Technology', 'that works.'];
    return `<main id="main" class="page-main home-main">
<section class="hero"><div class="hero-grid"></div><div class="hero-inner container"><div class="hero-copy"><p class="eyebrow"><span class="eyebrow-line"></span>${esc(data.eyebrow)}</p><h1>${esc(headline[0])}<span>${esc(headline[1])}</span></h1><p class="hero-lead">${esc(data.lead)}</p><div class="hero-actions"><a class="button button-light" href="${routeFor(lang, 'products')}">${esc(t.discover)} <span aria-hidden="true">↗</span></a><a class="button button-ghost" href="${routeFor(lang, 'about')}">${esc(t.aboutLink)}</a></div><p class="hero-footnote"><span class="live-dot"></span>${lang === 'ar' ? 'مشاريع موثقة فقط · لا بيانات وهمية' : lang === 'fr' ? 'Projets vérifiés uniquement · aucune donnée fictive' : 'Verified projects only · no mock listings'}</p></div>
<div class="hero-visual"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-spark hero-spark-a"></div><div class="hero-spark hero-spark-b"></div><article class="hero-product-card"><div class="hero-product-top"><span>${lang === 'ar' ? 'منتج منشور' : lang === 'fr' ? 'Produit publié' : 'Published product'}</span><span class="hero-product-count">01</span></div><div class="hero-product-main"><img src="/icon-512.png" width="78" height="78" alt="NEXORA AI"/><div><span class="hero-product-label">BECETTI AI</span><strong>NEXORA AI</strong><small>${esc(local(featured.shortDescription, lang))}</small></div></div><div class="hero-product-bottom"><span class="status-badge status-published">${esc(t.status.published)}</span><a href="${routeFor(lang, 'ai')}">${lang === 'ar' ? 'التفاصيل' : lang === 'fr' ? 'Détails' : 'Details'} <span aria-hidden="true">↗</span></a></div></article><div class="hero-float hero-float-left"><span class="float-icon">B</span><span>BECETTI<br/><small>${lang === 'ar' ? 'منظومة واحدة' : lang === 'fr' ? 'Un écosystème' : 'One ecosystem'}</small></span></div><div class="hero-float hero-float-right"><span class="float-dot"></span>${lang === 'ar' ? 'روابط رسمية' : lang === 'fr' ? 'Liens officiels' : 'Official links'}</div></div></div><div class="hero-bottom-line"></div></section>
<section class="section section-categories container"><div class="section-heading"><div><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'مصممة للتوسع' : lang === 'fr' ? 'Conçu pour évoluer' : 'Built to expand'}</p><h2>${data.sections[1][0]}</h2><p>${data.sections[1][1]}</p></div><a class="text-link" href="${routeFor(lang, 'products')}">${esc(t.viewAll)} <span aria-hidden="true">↗</span></a></div><div class="category-grid" data-category-grid>${categories.map((item) => categoryCard(item, lang)).join('')}</div></section>
<section class="section section-featured"><div class="container featured-layout"><div class="featured-intro"><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'منتج متاح الآن' : lang === 'fr' ? 'Disponible maintenant' : 'Available now'}</p><h2>${lang === 'ar' ? 'ابدأ من NEXORA AI.' : lang === 'fr' ? 'Commencez avec NEXORA AI.' : 'Start with NEXORA AI.'}</h2><p>${data.sections[0][1]}</p><a class="text-link" href="${routeFor(lang, 'ai')}">${lang === 'ar' ? 'استكشف BECETTI AI' : lang === 'fr' ? 'Explorer BECETTI AI' : 'Explore BECETTI AI'} <span aria-hidden="true">↗</span></a></div><div class="featured-product-list" data-products data-page="home">${products.map((item) => productCard(item, lang, categories)).join('')}</div></div></section>
<section class="section section-principles container"><div class="principle-title"><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'طريقة العمل' : lang === 'fr' ? 'Notre approche' : 'Our approach'}</p><h2>${data.sections[2][0]}</h2></div><div class="principle-copy"><p>${data.sections[2][1]}</p><a href="${routeFor(lang, 'about')}">${t.aboutLink} <span aria-hidden="true">↗</span></a></div></section>
<section class="closing-cta"><div class="container closing-inner"><div><p class="eyebrow">${lang === 'ar' ? 'ابدأ الاستكشاف' : lang === 'fr' ? 'À découvrir' : 'Take a look'}</p><h2>${lang === 'ar' ? 'منتج حقيقي. رابط مباشر.' : lang === 'fr' ? 'Un vrai produit. Un lien direct.' : 'A real product. One direct link.'}</h2></div><a class="button button-light" href="${routeFor(lang, 'products')}">${esc(t.discover)} <span aria-hidden="true">↗</span></a></div></section>
</main>`;
  }

  if (page === 'products') {
    const divisionFilters = `<button type="button" class="filter-chip is-active" data-filter="all">${lang === 'ar' ? 'الكل' : lang === 'fr' ? 'Tout' : 'All products'}</button>${categories.map((item) => `<button type="button" class="filter-chip" data-filter="${esc(item.id)}">${esc(local(item.name, lang))}</button>`).join('')}`;
    return `<main id="main" class="page-main"><section class="page-hero container"><p class="eyebrow eyebrow-dark">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="page-lead">${esc(data.lead)}</p></section><section class="section product-directory container"><div class="section-heading section-heading-compact"><div><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'تصفح حسب القسم والنظام' : lang === 'fr' ? 'Par plateforme et division' : 'Browse by platform and division'}</p><h2>${data.sections[0][0]}</h2><p>${data.sections[0][1]}</p></div></div><div class="filter-row" data-filter-row>${divisionFilters}</div></section>${platformSection(lang, 'android', categories)}${platformSection(lang, 'windows', categories)}<section class="section directory-categories container"><div class="section-heading"><div><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'أقسام BECETTI' : lang === 'fr' ? 'Divisions BECETTI' : 'BECETTI divisions'}</p><h2>${t.sectors}</h2></div></div><div class="category-grid" data-category-grid>${categories.map((item) => categoryCard(item, lang)).join('')}</div></section></main>`;
  }

  if (categoryPages[page]) {
    const category = categories.find((item) => item.id === page);
    const staticProducts = products.filter((product) => product.categoryId === page);
    const noProducts = staticProducts.length === 0;
    return `<main id="main" class="page-main category-page" data-category-page="${page}"><section class="department-hero"><div class="container department-inner"><div class="department-icon">${categoryIcon(category?.icon)}</div><p class="eyebrow eyebrow-dark">${esc(data.eyebrow)}</p><h1>${esc(local(category?.name, lang, data.heading))}</h1><p class="page-lead">${esc(data.lead)}</p></div></section><section class="section container department-products"><div class="section-heading"><div><p class="eyebrow eyebrow-dark">${esc(t.products)}</p><h2>${esc(data.sections[0][0])}</h2><p>${esc(data.sections[0][1])}</p></div></div><div class="product-grid" data-products data-page="category" data-category="${page}">${staticProducts.map((item) => productCard(item, lang, categories)).join('')}</div><div class="empty-state" data-empty-state${noProducts ? '' : ' hidden'}><span class="empty-symbol">B</span><h2>${esc(t.emptyTitle)}</h2><p>${esc(t.empty)}</p><a class="text-link" href="${routeFor(lang, 'products')}">${esc(t.emptyAction)} <span aria-hidden="true">↗</span></a></div></section><section class="section section-department-links container"><a class="text-link" href="${routeFor(lang, 'products')}">← ${esc(t.viewAll)}</a><div class="category-grid" data-related-categories>${categories.filter((item) => item.id !== page).slice(0, 3).map((item) => categoryCard(item, lang)).join('')}</div></section></main>`;
  }

  if (page === 'about') {
    return `<main id="main" class="page-main"><section class="page-hero about-hero container"><p class="eyebrow eyebrow-dark">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="page-lead">${esc(data.lead)}</p><div class="about-brand-stamp"><img src="/becetti-mark.svg" width="74" height="74" alt="BECETTI"/><span>BECETTI<br/><small>${esc(t.tagline)}</small></span></div></section><section class="section editorial-section container">${sectionCopy(data, lang)}</section><section class="section section-about-cta container"><div><p class="eyebrow eyebrow-dark">${lang === 'ar' ? 'المنتجات المنشورة' : lang === 'fr' ? 'Produits publiés' : 'Published products'}</p><h2>${lang === 'ar' ? 'اكتشف ما هو متاح فعلاً.' : lang === 'fr' ? 'Découvrez ce qui est disponible.' : 'See what is actually available.'}</h2></div><a class="button button-dark" href="${routeFor(lang, 'products')}">${esc(t.viewAll)} <span aria-hidden="true">↗</span></a></section></main>`;
  }

  if (page === 'contact') {
    return `<main id="main" class="page-main"><section class="contact-hero container"><div><p class="eyebrow eyebrow-dark">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="page-lead">${esc(data.lead)}</p></div><a class="contact-email-card" href="mailto:ahmedbecetti35@gmail.com"><span class="contact-icon" aria-hidden="true">↗</span><small>${lang === 'ar' ? 'البريد الرسمي' : lang === 'fr' ? 'E-mail officiel' : 'Official email'}</small><strong>ahmedbecetti35@gmail.com</strong></a></section><section class="section editorial-section container">${sectionCopy(data, lang)}</section><section class="section contact-safety container"><span class="safety-icon" aria-hidden="true">i</span><p>${lang === 'ar' ? 'لحمايتك، لا ترسل كلمة مرور أو رمز تحقق أو مفتاح API بالبريد الإلكتروني.' : lang === 'fr' ? 'Pour votre sécurité, n’envoyez aucun mot de passe, code de vérification ou clé API par e-mail.' : 'For your safety, never send passwords, verification codes or API keys by email.'}</p></section></main>`;
  }

  if (page === 'privacy' || page === 'terms') {
    const tocTitle = lang === 'ar' ? 'في هذه الصفحة' : lang === 'fr' ? 'Sommaire' : 'On this page';
    const effectiveDate = lang === 'ar' ? '23 نوفمبر 2026' : lang === 'fr' ? '23 novembre 2026' : '23 November 2026';
    const legalToc = data.sections.map(([heading], index) => `<li><a href="#legal-${index + 1}">${esc(heading)}</a></li>`).join('');
    const legalSections = data.sections.map(([heading, paragraph], index) => {
      const headingText = String(heading);
      const needsContact = page === 'privacy'
        ? headingText.includes('التواصل') || headingText.includes('Privacy enquiries') || headingText.includes('Questions de confidentialité')
        : headingText.includes('تغييرات') || headingText.includes('Changes and contact') || headingText.includes('Modifications et contact');
      const contactLink = needsContact ? ` <a href="${routeFor(lang, 'contact')}">${esc(t.nav.contact)}</a>.` : '';
      return `<section id="legal-${index + 1}"><span class="legal-index">${String(index + 1).padStart(2, '0')}</span><div><h2>${esc(heading)}</h2><p>${esc(paragraph)}${contactLink}</p></div></section>`;
    }).join('');
    return `<main id="main" class="page-main legal-main"><section class="page-hero legal-hero container"><p class="eyebrow eyebrow-dark">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="page-lead">${esc(data.lead)}</p><p class="legal-date">${lang === 'ar' ? 'تاريخ السريان' : lang === 'fr' ? 'Date d’effet' : 'Effective date'} · <time datetime="${updated}">${effectiveDate}</time></p></section><div class="legal-layout container"><nav class="legal-toc" aria-label="${esc(tocTitle)}"><strong>${esc(tocTitle)}</strong><ol>${legalToc}</ol></nav><article class="legal-content">${legalSections}</article></div></main>`;
  }
  return `<main id="main" class="page-main container"><section class="page-hero"><h1>${esc(data.heading)}</h1><p class="page-lead">${esc(data.lead)}</p></section></main>`;
}

function structuredData(lang, page, data) {
  const orgId = `${origin}/#organization`;
  const siteId = `${origin}/#website`;
  const canonical = canonicalFor(lang, page);
  const graph = [
    { '@type': 'Organization', '@id': orgId, name: 'BECETTI', alternateName: 'BECETTI digital ecosystem', url: `${origin}/`, logo: { '@type': 'ImageObject', url: 'https://nexora-social-2026.vercel.app/becetti-mark.svg' }, founder: { '@type': 'Person', name: 'Ahmed Becetti' }, email: 'ahmedbecetti35@gmail.com', contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'ahmedbecetti35@gmail.com', availableLanguage: ['Arabic', 'English', 'French'] } },
    { '@type': 'WebSite', '@id': siteId, name: 'BECETTI', url: `${origin}/`, inLanguage: BECETTI_LANGUAGES, publisher: { '@id': orgId } },
    { '@type': page === 'about' ? 'AboutPage' : page === 'contact' ? 'ContactPage' : page === 'products' ? 'CollectionPage' : 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: data.title, description: data.description, inLanguage: lang, dateModified: updated, isPartOf: { '@id': siteId }, publisher: { '@id': orgId }, breadcrumb: { '@id': `${canonical}#breadcrumb` } },
    { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [{ '@type': 'ListItem', position: 1, name: words[lang].nav.home, item: canonicalFor(lang, 'home') }, ...(page === 'home' ? [] : [{ '@type': 'ListItem', position: 2, name: pageName(page, lang), item: canonical }])] },
  ];
  if (['home', 'products', 'ai'].includes(page)) graph.push({ '@type': 'SoftwareApplication', '@id': `${orgId}#nexora-ai`, name: 'NEXORA AI', applicationCategory: 'ProductivityApplication', operatingSystem: 'Web, Android, Windows', url: BECETTI_DEFAULT_CATALOG.products[0].links.web, image: 'https://nexora-social-2026.vercel.app/icon-512.png', description: local(BECETTI_DEFAULT_CATALOG.products[0].description, lang), author: { '@type': 'Person', name: 'Ahmed Becetti' }, publisher: { '@id': orgId } });
  return { '@context': 'https://schema.org', '@graph': graph };
}

function renderPage(lang, page) {
  const data = copy[lang]?.[page];
  if (!data) throw new Error(`Missing BECETTI copy: ${lang}/${page}`);
  const file = fileFor(lang, page);
  const canonical = canonicalFor(lang, page);
  const alternate = BECETTI_LANGUAGES.map((id) => `<link rel="alternate" hreflang="${id}" href="${esc(canonicalFor(id, page))}" />`).join('\n');
  const schema = structuredData(lang, page, data);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const langAlt = BECETTI_LANGUAGES.filter((id) => id !== lang).map((id) => `<a href="${routeFor(id, page)}" lang="${id}" hreflang="${id}">${id.toUpperCase()}</a>`).join('');
  const deviceLanguageRedirect = lang === 'ar'
    ? `<script data-becetti-language-redirect>(function(){var p=location.pathname;if(p==='/becetti')p+='/';if(p.indexOf('/becetti/')!==0)return;var page=p.slice('/becetti/'.length)||'index.html';if(page.indexOf('/')!==-1)return;try{var choice=sessionStorage.getItem('becetti-language-choice');if(choice==='ar')return;if(choice==='en'||choice==='fr'){location.replace('/becetti/'+choice+'/'+page+location.search+location.hash);return;}}catch(e){}var choices=Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language||''];for(var i=0;i<choices.length;i++){var code=String(choices[i]||'').toLowerCase().split(/[-_]/,1)[0];if(code==='ar')return;if(code==='en'||code==='fr'){location.replace('/becetti/'+code+'/'+page+location.search+location.hash);return;}}})();</script>`
    : '';
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0a1d36" />
${deviceLanguageRedirect ? `  ${deviceLanguageRedirect}\n` : ''}  <title>${esc(data.title)}</title>
  <meta name="description" content="${esc(data.description)}" />
  <meta name="author" content="Ahmed Becetti" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${esc(canonical)}" />
  ${alternate}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="BECETTI" />
  <meta property="og:locale" content="${lang === 'ar' ? 'ar_DZ' : lang === 'fr' ? 'fr_FR' : 'en_US'}" />
  <meta property="og:title" content="${esc(data.title)}" />
  <meta property="og:description" content="${esc(data.description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="https://nexora-social-2026.vercel.app/becetti-og.svg" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(data.title)}" />
  <meta name="twitter:description" content="${esc(data.description)}" />
  <meta name="twitter:image" content="https://nexora-social-2026.vercel.app/becetti-og.svg" />
  <link rel="icon" type="image/svg+xml" href="/becetti-mark.svg" />
  <link rel="preload" as="image" href="/becetti-mark.svg" />
  <script type="application/ld+json">${json(schema)}</script>
</head>
<body class="becetti" data-page="${page}">
  ${renderHeader(lang, page, page)}
  ${renderBody(page, lang, data)}
  ${renderFooter(lang)}
  <script type="module" src="/src/becetti/main.js"></script>
</body>
</html>
`;
}

const generated = new Map();
for (const lang of BECETTI_LANGUAGES) {
  for (const page of Object.keys(filesByPage)) generated.set(fileFor(lang, page), renderPage(lang, page));
}

const sitemapUrls = BECETTI_LANGUAGES.flatMap((lang) => Object.keys(filesByPage).map((page) => {
  const links = BECETTI_LANGUAGES.map((id) => `<xhtml:link rel="alternate" hreflang="${id}" href="${esc(canonicalFor(id, page))}" />`).join('');
  return `  <url><loc>${esc(canonicalFor(lang, page))}</loc><lastmod>${updated}</lastmod>${links}</url>`;
})).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapUrls}\n</urlset>\n`;
generated.set('public/becetti-sitemap.xml', sitemap);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    for (const [relative, contents] of generated) {
      const target = resolve(root, relative);
      if (!existsSync(target) || readFileSync(target, 'utf8') !== contents) throw new Error(`Outdated ${relative}: run npm run generate:becetti`);
    }
    console.log(`BECETTI pages are current (${generated.size - 1} localized pages and sitemap).`);
  } else {
    for (const [relative, contents] of generated) {
      const target = resolve(root, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    console.log(`Generated ${generated.size - 1} BECETTI pages and sitemap for ${BECETTI_LANGUAGES.length} languages.`);
  }
}
