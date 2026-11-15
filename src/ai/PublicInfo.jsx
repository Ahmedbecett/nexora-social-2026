// Real public information stays visible after React replaces index.html's HTML fallback.
// Only mounted for signed-out web visitors; the Android app keeps its existing auth view.
export default function PublicInfo() {
  return <main id="discover" className="nx-ai-public" lang="ar" dir="rtl">
    <nav className="nx-ai-public-nav" aria-label="صفحات NEXORA AI العامة">
      <a href="/about.html">حول NEXORA</a><a href="/features.html">الميزات</a>
      <a href="/download.html">التحميل</a><a href="/faq.html">الأسئلة الشائعة</a>
      <a href="/en.html" lang="en" hreflang="en">English</a>
    </nav>
    <section className="nx-ai-public-hero">
      <p className="nx-ai-public-eyebrow">منصة ذكاء اصطناعي متكاملة على الويب — مثل Arena AI</p>
      <h1>NEXORA AI — منصة ويب ذكية لأفكارك ومهامك</h1>
      <p>منصة كاملة في المتصفح: محادثة، كتابة، برمجة، ترجمة، تلخيص وتوليد صور — بدون تثبيت. سجّل الدخول أعلاه لبدء محادثة حقيقية وحفظ سجلها؛ هذه الصفحة تشرح المنصة ولا تُحاكيها.</p>
    </section>
    <section aria-labelledby="nx-public-tools">
      <h2 id="nx-public-tools">ماذا يمكنك أن تفعل مع NEXORA AI؟</h2>
      <div className="nx-ai-public-grid">
        <article><h3>اسأل وواصل الحوار</h3><p>اطرح سؤالاً بالعربية أو الإنجليزية، واطلب توضيحاً أو متابعة للإجابة. قد تتوفر روابط مصادر عند تشغيل البحث على الويب.</p></article>
        <article><h3>اكتب وترجم ولخّص</h3><p>ابدأ بمسودة، غيّر أسلوب نص، ترجم فقرة أو استخرج أفكارها الرئيسية. راجع النتائج قبل استخدامها أو نشرها.</p></article>
        <article><h3>برمج وأنشئ صوراً</h3><p>اطلب شرحاً للكود أو وصفاً لصورة مولّدة. يعتمد توفر بعض الأدوات على المزوّد وحدود الاستخدام.</p></article>
      </div>
      <p><a href="/features.html">اقرأ شرح الميزات بالتفصيل</a></p>
    </section>
    <section aria-labelledby="nx-public-get-started">
      <h2 id="nx-public-get-started">منصة ويب — بدون تحميل</h2>
      <p>مثل Arena AI، تعمل NEXORA كاملة في المتصفح — افتح المنصة وابدأ فوراً. يتوفر <a href="/download.html">APK اختياري</a> لمن يفضّل التطبيق، لكنه ليس مطلوباً. اقرأ <a href="/faq.html">الأسئلة الشائعة</a> لمعرفة المزيد. المنصة ليست شبكة اجتماعية للمنشورات أو الرسائل.</p>
    </section>
    <footer><a href="/about.html">حول المشروع</a><span aria-hidden="true">·</span><a href="/privacy.html">سياسة الخصوصية</a><span aria-hidden="true">·</span><a href="/en.html" lang="en" hreflang="en">English</a></footer>
  </main>;
}
