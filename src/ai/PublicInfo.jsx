// Real public information stays visible after React replaces index.html's HTML fallback.
// Only mounted for signed-out web visitors; the Android app keeps its existing auth view.
// NOTE: this block is the rendered twin of index.html's no-JS landing — keep the facts,
// the section order and the internal links in the two files in sync, because Google
// indexes the rendered DOM and drops the pre-hydration HTML.
export default function PublicInfo() {
  return <main id="discover" className="nx-ai-public" lang="ar" dir="rtl">
    <nav className="nx-ai-public-nav" aria-label="صفحات NEXORA AI العامة">
      <a href="/about.html">حول NEXORA</a><a href="/features.html">الميزات</a>
      <a href="/download.html">التحميل</a><a href="/faq.html">الأسئلة الشائعة</a>
      <a href="/privacy.html">الخصوصية</a>
      <a href="/en.html" lang="en" hreflang="en">English</a>
    </nav>
    <section className="nx-ai-public-hero">
      <p className="nx-ai-public-eyebrow">منصة ذكاء اصطناعي متكاملة على الويب — مثل Arena AI</p>
      <h1>NEXORA AI — منصة ويب ذكية لأفكارك ومهامك</h1>
      <p>منصة كاملة في المتصفح: محادثة، كتابة، برمجة، ترجمة، تلخيص وتوليد صور — بدون تثبيت. سجّل الدخول أعلاه لبدء محادثة حقيقية وحفظ سجلها؛ هذه الصفحة تشرح المنصة ولا تُحاكيها.</p>
    </section>
    <section aria-labelledby="nx-public-tools">
      <h2 id="nx-public-tools">ماذا تفعل داخل NEXORA AI؟</h2>
      <div className="nx-ai-public-grid">
        <article><h3>اسأل وواصل الحوار</h3><p>اطرح سؤالاً بالعربية أو الإنجليزية، واطلب توضيحاً أو متابعة للإجابة، وتابع المحادثة المحفوظة في حسابك. قد تتوفر روابط مصادر عند تشغيل البحث على الويب.</p></article>
        <article><h3>اكتب وترجم ولخّص</h3><p>ابدأ بمسودة، غيّر أسلوب نص، ترجم فقرة أو استخرج أفكارها الرئيسية. راجع النتائج قبل استخدامها أو نشرها.</p></article>
        <article><h3>برمج وأنشئ صوراً</h3><p>اطلب شرحاً للكود أو وصفاً لصورة مولّدة، وأرفق PDF أو DOCX لتحليله. يعتمد توفر بعض الأدوات على المزوّد وحدود الاستخدام.</p></article>
      </div>
      <p><a href="/features.html">اقرأ شرح الميزات بالتفصيل</a></p>
    </section>
    <section aria-labelledby="nx-public-studio">
      <h2 id="nx-public-studio">NEXORA Studio — ابنِ التطبيق لا الكود فقط</h2>
      <p>صف تطبيقاً بلغتك، فيخطّط Studio الملفات ويكتبها فعلياً، ثم تعدّلها في محرر أكواد، وتشغّل الأوامر في طرفية حقيقية، وتشاهد معاينة حيّة، وتحفظ نقاط استعادة، ثم تنشر على GitHub أو Vercel من الشاشة نفسها — كل ذلك داخل NEXORA وبنفس الحساب.</p>
    </section>
    <section aria-labelledby="nx-public-get-started">
      <h2 id="nx-public-get-started">ويب أولًا — لا حاجة لتحميل</h2>
      <p>مثل Arena AI، تعمل NEXORA كاملة في المتصفح — افتح المنصة وابدأ فوراً. يتوفر <a href="/download.html">APK اختياري</a> لمن يفضّل التطبيق (أندرويد 6.0+)، لكنه ليس مطلوباً. اقرأ <a href="/faq.html">الأسئلة الشائعة</a> لمعرفة المزيد. المنصة ليست شبكة اجتماعية للمنشورات أو الرسائل.</p>
    </section>
    <section aria-labelledby="nx-public-lang">
      <h2 id="nx-public-lang">بأي لغة تعمل؟</h2>
      <p>الواجهة بالعربية والإنجليزية بالكامل مع اتجاه صحيح لكل لغة (RTL/LTR)، ويمكنك كتابة طلباتك بعدة لغات يدعمها المزوّد. تختلف جودة الردود بحسب اللغة والنموذج المتاح.</p>
    </section>
    <section aria-labelledby="nx-public-privacy">
      <h2 id="nx-public-privacy">هل بياناتي ومحادثاتي خاصة؟</h2>
      <p>محادثاتك ومشاريعك مرتبطة بحسابك ولا تُعرض لمستخدمين آخرين، ولا نبيعها ولا نستخدمها لتدريب النماذج. تعرّف على البيانات التي نجمعها ومن يعالجها وحقوقك في <a href="/privacy.html">سياسة الخصوصية وملفات تعريف الارتباط</a>.</p>
    </section>
    <section aria-labelledby="nx-public-quick">
      <h2 id="nx-public-quick">أسئلة سريعة</h2>
      <p><strong>هل أحتاج إلى حساب؟</strong> يمكنك قراءة هذه الصفحات دون حساب؛ ولإرسال طلبات إلى المساعد وحفظ محادثاتك سجّل الدخول.</p>
      <p><strong>هل الاستخدام مجاني؟</strong> هناك نقطة بداية مجانية على الويب، وقد تنطبق حدود استخدام على بعض الميزات، ويعتمد توفر النماذج على المزوّد.</p>
      <p><strong>كيف أحذف حسابي؟</strong> من الحساب والأمان ← منطقة الخطر ← «حذف حسابي وكل بياناتي نهائيًا»، وتفاصيل ذلك في سياسة الخصوصية.</p>
    </section>
    <footer><a href="/about.html">حول المشروع</a><span aria-hidden="true">·</span><a href="/privacy.html">سياسة الخصوصية</a><span aria-hidden="true">·</span><a href="/en.html" lang="en" hreflang="en">English</a></footer>
  </main>;
}
