/** أيقونات إضافية لشريط الدردشة الجديد (نفس أسلوب icons.jsx: خطوط 2px، حواف دائرية). */
const S = ({ children, size = 24, fill = 'none', stroke = 'currentColor', sw = 2, className, style, vb = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={vb} fill={fill} stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{children}</svg>
);

/** كاميرا ممتلئة (زر الكاميرا الأزرق في شريط الكتابة) */
export const ICameraSolid = ({ size = 22, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M9.2 3h5.6c.6 0 1.1.3 1.4.9l.7 1.3h2.6A3.5 3.5 0 0 1 23 8.7v8.8a3.5 3.5 0 0 1-3.5 3.5h-15A3.5 3.5 0 0 1 1 17.5V8.7a3.5 3.5 0 0 1 3.5-3.5h2.6l.7-1.3c.3-.6.8-.9 1.4-.9Zm2.8 5a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2Zm0 2.6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
  </svg>
);

/** تبويب التأثيرات: وجه مع قلوب */
export const IEffectsFace = (p) => <S {...p}>
  <circle cx="12" cy="12" r="9" />
  <path d="M7.6 9.2c-.9-1.3-2.7-.7-2.7.8 0 1.3 1.6 2.4 2.7 3.3" opacity=".9" fill="currentColor" stroke="none" />
  <path d="M16.4 9.2c.9-1.3 2.7-.7 2.7.8 0 1.3-1.6 2.4-2.7 3.3" opacity=".9" fill="currentColor" stroke="none" />
  <path d="M8.5 14.6a4.4 4.4 0 0 0 7 0" />
</S>;

/** تبويب الملصقات: وجه ناقص (sticker peel) */
export const IStickerPeel = (p) => <S {...p}>
  <path d="M20.6 12a8.6 8.6 0 1 1-8.6-8.6" />
  <path d="M20.6 12h-5a3.6 3.6 0 0 0-3.6 3.6v5" />
  <path d="M9 9.6h.01M15 9.6h.01" sw={2.6} />
  <path d="M9.4 14.6a3.6 3.6 0 0 0 5.2 0" />
</S>;

/** تبويب الصور المتحركة: GIF */
export const IGifBox = ({ size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="800" fontFamily="system-ui, Arial, sans-serif" fill="currentColor">GIF</text>
  </svg>
);

/** صور AI: صورة + بريق */
export const IAiImage = (p) => <S {...p}>
  <rect x="2.6" y="4.6" width="14.8" height="14.8" rx="3.4" />
  <circle cx="7.4" cy="9.2" r="1.5" fill="currentColor" stroke="none" />
  <path d="m17.4 19.4-4.5-4.6-5.6 5.5" />
  <path d="M19.6 2.2v4.4M17.4 4.4h4.4" sw={1.9} />
</S>;

/** رسم: خط متعرج */
export const IDrawSquiggle = (p) => <S {...p}>
  <path d="M3 15.5c2-6.5 4.6-9 6.4-7 1.7 2-.6 7 1.5 8.4 2 1.4 3.6-3.2 5-5.2 1.3-1.9 3.4-1.6 4.1.6" />
  <path d="M4.5 19.6h15" opacity=".55" />
</S>;

/** نيكسورا AI: زهرة/نجمة */
export const IAiFlower = (p) => <S {...p} sw={1.9}>
  <path d="M12 3.2c1.9 0 3.4 1.5 3.4 3.4 0 .8-.3 1.6-.8 2.2 1.4-.5 3 .2 3.7 1.6.9 1.7.3 3.8-1.4 4.7-.7.4-1.5.5-2.3.3.9 1.1.9 2.8-.1 3.9-1.2 1.4-3.3 1.6-4.7.4-.7-.6-1.1-1.4-1.2-2.3-.6 1.3-2.1 2-3.6 1.6-1.9-.5-3-2.4-2.5-4.2.2-.8.7-1.4 1.4-1.9-1.5-.1-2.7-1.3-2.7-2.9 0-1.9 1.5-3.4 3.4-3.4.8 0 1.6.3 2.2.8-.5-1.4.2-3 1.6-3.7" />
  <circle cx="12" cy="12" r="2.6" />
</S>;

/** مقص (قصاصات) */
export const IScissors = (p) => <S {...p}>
  <circle cx="6.5" cy="7" r="2.6" /><circle cx="6.5" cy="17" r="2.6" />
  <path d="M8.8 8.4 20 17M8.8 15.6 20 7" />
</S>;

/** عصا سحرية (تأثيرات) */
export const IWand = (p) => <S {...p}>
  <path d="m4 20 11.4-11.4" />
  <path d="M17.2 8.6 15 6.4l2.3-2.3 2.2 2.2z" />
  <path d="M19.6 13.4v3M18.1 14.9h3M9.4 4.2v2.6M8.1 5.5h2.6" sw={1.8} />
</S>;

/** تراجع */
export const IUndo = (p) => <S {...p}>
  <path d="M4 8.5h9.5a5.5 5.5 0 0 1 0 11H8" />
  <path d="M7.5 4.5 3.5 8.5l4 4" />
</S>;

/** ممحاة */
export const IEraser = (p) => <S {...p}>
  <path d="M8.6 20.5H20" />
  <path d="M14.4 3.9 4.6 13.7a2 2 0 0 0 0 2.8l3 3a2 2 0 0 0 2.8 0l9.8-9.8a2 2 0 0 0 0-2.8l-3-3a2 2 0 0 0-2.8 0Z" />
  <path d="m11 7.3 5.7 5.7" />
</S>;

/** لوحة ألوان */
export const IPalette = (p) => <S {...p}>
  <path d="M12 3a9 9 0 0 0 0 18h1.6a2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H19a2.6 2.6 0 0 0 2.6-2.6A8.9 8.9 0 0 0 12 3Z" />
  <path d="M7.8 9.2h.01M10.9 6.6h.01M15.2 7.4h.01" sw={2.6} />
</S>;

/** سهم موقعي */
export const INearMe = (p) => <S {...p}>
  <circle cx="12" cy="12" r="3" />
  <path d="M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22" />
  <path d="M19.8 4.2 13.6 10.4M4.2 4.2l6.2 6.2M19.8 19.8l-6.2-6.2M4.2 19.8l6.2-6.2" opacity=".5" />
</S>;

/** ترس (إعدادات المفاتيح) */
export const IGear = (p) => <S {...p}>
  <circle cx="12" cy="12" r="3.2" />
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 1.9 1.9 0 1 1-3.8 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1A1.7 1.7 0 0 0 3 15a1.9 1.9 0 1 1 0-3.8 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.7 1.7 0 0 0 2.9-1.2 1.9 1.9 0 1 1 3.8 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.7 1.7 0 0 0 1.2 2.9 1.9 1.9 0 1 1 0 3.8Z" opacity=".85" />
</S>;

/** نجمة بريق صغيرة (شارة AI على الرسائل) */
export const ISpark = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z" />
  </svg>
);

/** قائمة سفلية: خطوط + مقبض */
export const IDragHandle = (p) => <S {...p}><path d="M5 9h14M5 15h14" /></S>;

/** سماعة الهاتف (شريط المحادثة) — بنفس شكل إنستغرام */
export const IHandset = ({ size = 24, ...p }) => <S size={size} sw={1.8} {...p}>
  <path d="M6.4 3.6h2.5c.5 0 .9.3 1 .8l.7 2.3c.1.3.3.6.6.7.9.5 1.7 1.3 2.2 2.2.1.3.4.5.7.6l2.3.7c.5.1.8.5.8 1v2.5c0 .7-.6 1.2-1.3 1.2C8.6 15.6 3.7 10.7 3.7 4.9c0-.7.5-1.3 1.2-1.3Z" />
</S>;

/** كاميرا الفيديو (شريط المحادثة) — بنفس شكل إنستغرام */
export const ICamcorder = ({ size = 24, ...p }) => <S size={size} sw={1.8} {...p}>
  <rect x="3" y="7" width="12.4" height="10" rx="3.2" />
  <path d="M15.4 11.1 21 8.1v7.8l-5.6-3z" />
</S>;
