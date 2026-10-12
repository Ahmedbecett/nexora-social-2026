// Regenerates native/app/src/main/assets/i18n/*.json from the web dictionaries (same keys as the web app).
import fs from 'fs';
const root = new URL('../', import.meta.url);
const src = fs.readFileSync(new URL('src/i18n.js', root), 'utf8');
const grab = (name) => { const s = src.indexOf(`const ${name} = {`); const e = src.indexOf('\n};', s) + 3; return new Function(src.slice(s, e) + `\nreturn ${name};`)(); };
const { extraEn, extraAr } = await import(new URL('src/locales/extra.js', root));
const merge = (a, b) => Object.assign({}, a, b, { errors: { ...(a.errors || {}), ...(b.errors || {}) } });
const cts = fs.readFileSync(new URL('src/chatkit/callText.js', root), 'utf8');
const grabCt = (name) => { const s = cts.indexOf(`const ${name} = {`); const e = cts.indexOf('\n};', s) + 3; return new Function(cts.slice(s, e) + `\nreturn ${name};`)(); };
const out = new URL('native/app/src/main/assets/i18n/', root);
fs.writeFileSync(new URL('en.json', out), JSON.stringify({ ...merge(grab('en'), extraEn), ...grabCt('en') }));
fs.writeFileSync(new URL('ar.json', out), JSON.stringify({ ...merge(grab('ar'), extraAr), ...grabCt('ar') }));
const frCt = grabCt('fr');
for (const f of fs.readdirSync(new URL('src/locales/', root))) if (f.endsWith('.json')) {
  const d = JSON.parse(fs.readFileSync(new URL(`src/locales/${f}`, root), 'utf8'));
  if (f === 'fr.json') Object.assign(d, frCt);
  fs.writeFileSync(new URL(f, out), JSON.stringify(d));
}
// Native-only keys (added only when missing).
const nativeExtra = {
  en: { appVersion: 'Version', audioTab: 'Audio', settingsTitle: 'Settings and activity', termsShort: 'By signing up, you agree to our Terms of Use.', addWordPh: "Add a word or phrase", hiddenWordsDesc: "Hide comments and message requests that contain offensive words, plus the custom words you add below.", moveToSpam: "Move to Spam", movedToRequests: "Moved to Requests", movedToSpam: "Moved to Spam", msgRequestsHint: "Open a chat to see more information. They won't know you've seen it until you reply.", msgRequestsTitle: "Message requests", noMsgRequestsSub: "Messages from people you don't follow will appear here.", noMsgRequestsYet: "No message requests", noSpam: "No spam", noSpamSub: "Requests you move to Spam appear here.", notSpam: "Not spam", noteProfilePh: "Note...", oneChat: "1 chat", oneNotification: "1 notification", spam: "Spam", spamBannerTitle: "Unwanted message requests?", spamBannerText: "Long-press a request to move it to Spam, delete it or block the sender." },
  ar: { appVersion: 'الإصدار', audioTab: 'الصوتيات', settingsTitle: 'الإعدادات والنشاط', termsShort: 'بالتسجيل، أنت توافق على شروط الاستخدام.', addWordPh: "أضف كلمة أو عبارة", hiddenWordsDesc: "إخفاء التعليقات وطلبات الرسائل التي تحتوي على كلمات مسيئة، بالإضافة إلى الكلمات المخصصة التي تضيفها أدناه.", moveToSpam: "نقل إلى البريد المزعج", movedToRequests: "تم النقل إلى الطلبات", movedToSpam: "تم النقل إلى البريد المزعج", msgRequestsHint: "افتح المحادثة لرؤية المزيد من المعلومات. لن يعرفوا أنك شاهدتها حتى ترد.", msgRequestsTitle: "طلبات الرسائل", noMsgRequestsSub: "ستظهر هنا الرسائل من الأشخاص الذين لا تتابعهم.", noMsgRequestsYet: "لا توجد طلبات رسائل", noSpam: "لا يوجد بريد مزعج", noSpamSub: "تظهر هنا الطلبات التي تنقلها إلى البريد المزعج.", notSpam: "ليس مزعجًا", noteProfilePh: "ملاحظة...", oneChat: "محادثة واحدة", oneNotification: "إشعار واحد", spam: "البريد المزعج", spamBannerTitle: "طلبات رسائل غير مرغوب فيها؟", spamBannerText: "اضغط مطولاً على أي طلب لنقله إلى البريد المزعج أو حذفه أو حظر المرسل." },
  fr: { appVersion: 'Version', audioTab: 'Audio', settingsTitle: 'Paramètres et activité', termsShort: "En vous inscrivant, vous acceptez nos conditions d'utilisation.", addWordPh: "Ajouter un mot ou une expression", hiddenWordsDesc: "Masquez les commentaires et demandes de messages contenant des mots offensants, ainsi que vos mots personnalisés.", moveToSpam: "Déplacer vers Spam", movedToRequests: "Déplacé vers Demandes", movedToSpam: "Déplacé vers Spam", msgRequestsHint: "Ouvrez une discussion pour plus d'informations. Ils ne sauront pas que vous l'avez vue avant votre réponse.", msgRequestsTitle: "Demandes de messages", noMsgRequestsSub: "Les messages des personnes que vous ne suivez pas apparaîtront ici.", noMsgRequestsYet: "Aucune demande de message", noSpam: "Aucun spam", noSpamSub: "Les demandes déplacées vers Spam apparaissent ici.", notSpam: "Pas un spam", noteProfilePh: "Note...", oneChat: "1 discussion", oneNotification: "1 notification", spam: "Spam", spamBannerTitle: "Demandes de messages indésirables ?", spamBannerText: "Appuyez longuement sur une demande pour la déplacer vers Spam, la supprimer ou bloquer l’expéditeur." },
};
for (const [l, keys] of Object.entries(nativeExtra)) {
  const f = new URL(`${l}.json`, out);
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(keys)) if (d[k] == null) d[k] = v;
  fs.writeFileSync(f, JSON.stringify(d));
}
const langs = src.slice(src.indexOf('export const LANGUAGES = ['), src.indexOf('];', src.indexOf('export const LANGUAGES')) + 2).replace('export const LANGUAGES =', 'return');
fs.writeFileSync(new URL('languages.json', out), JSON.stringify(new Function(langs)()));
console.log(fs.readdirSync(out).length, 'files');
