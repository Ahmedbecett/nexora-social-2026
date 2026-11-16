// One Native Banner container per active web view; the guarded first-party
// /adsterra-web.js bootstrap loads the owner-supplied script beside this node.
// الإيقاع يُدار داخل الـ bootstrap: ظهور واحد كل 30 دقيقة (بوابة nx_web_ad_last
// المشتركة مع AdSense) ثم يُخفى تلقائيًا — لذا الحاوية تبقى مرکوبة دائمًا.
export default function AdsterraBanner() {
  return <div className="nx-adsterra-placement" role="complementary" aria-label="مساحة إعلانية">
    <div id="container-5641403c5558334d50a26de1c90fe61d" />
  </div>;
}
