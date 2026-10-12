cd /home/user/repo
sed -i 's/versionCode 12/versionCode 13/; s/versionName "2.4.5"/versionName "2.4.6"/' android/app/build.gradle
sed -i "s/APP_VERSION = '2.4.5'/APP_VERSION = '2.4.6'/" src/screens/Settings.jsx
sed -i 's/"softwareVersion":"2.4.5"/"softwareVersion":"2.4.6"/' index.html
sed -i 's/"version": "2.4.5"/"version": "2.4.6"/' package.json
sed -i 's/الإصدار 2.4.5\*\*/الإصدار 2.4.6**/' README.md
grep -q "جديد في 2.4.6" README.md || python3 - <<'PY'
p='/home/user/repo/README.md'; s=open(p).read()
old='- **جديد في 2.4.5:**'
s=s.replace(old,'- **جديد في 2.4.6:** فلاتر صور مثل إنستغرام (Clarendon وJuno وLark وMoon وغيرها) وأدوات تعديل (السطوع والتباين والتشبع والدفء) قبل النشر وفي القصص، والرد على التعليقات مع «عرض الردود»، والإعجاب بالتعليقات (زر قلب وعدّاد ونقر مزدوج وعلامة «من الناشر»)، وإشعارات للردود والإعجابات بالتعليقات.\n'+old,1)
open(p,'w').write(s)
PY
