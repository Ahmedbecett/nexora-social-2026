p='/home/user/repo/src/screens/Create.jsx'; s=open(p).read()
def rep(old,new):
    global s
    assert old in s, old[:90]
    s=s.replace(old,new,1)
rep("""export default function Create({ mode: initialMode = 'post' }) {""",r"""/* Instagram-style photo filters, baked into the image before upload */
export const FILTERS = [
  ['Normal', ''],
  ['Clarendon', 'contrast(1.2) saturate(1.35)'],
  ['Gingham', 'brightness(1.05) hue-rotate(-10deg) contrast(0.9) sepia(0.04)'],
  ['Moon', 'grayscale(1) contrast(1.1) brightness(1.1)'],
  ['Lark', 'contrast(0.9) brightness(1.08) saturate(1.1)'],
  ['Reyes', 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)'],
  ['Juno', 'saturate(1.4) contrast(1.15) sepia(0.12) hue-rotate(-8deg)'],
  ['Slumber', 'saturate(0.66) brightness(1.05) sepia(0.15)'],
  ['Crema', 'sepia(0.25) contrast(0.9) brightness(1.05) saturate(0.9)'],
  ['Ludwig', 'contrast(1.05) saturate(1.2) brightness(1.05)'],
  ['Aden', 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)'],
  ['Perpetua', 'contrast(1.1) brightness(1.25) saturate(1.1)'],
  ['Inkwell', 'sepia(0.3) contrast(1.1) brightness(1.1) grayscale(1)'],
];
const ADJ = ['brightness', 'contrast', 'saturation', 'warmth'];
const ADJ0 = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
export function cssFilter(f) {
  if (!f) return '';
  const base = FILTERS.find((x) => x[0] === f.filter)?.[1] || '';
  const a = f.adj || ADJ0;
  const parts = [base];
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness / 200).toFixed(3)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast / 200).toFixed(3)})`);
  if (a.saturation) parts.push(`saturate(${(1 + a.saturation / 100).toFixed(3)})`);
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth / 250).toFixed(3)}) saturate(${(1 + a.warmth / 400).toFixed(3)})`);
  if (a.warmth < 0) parts.push(`hue-rotate(${(a.warmth * -0.18).toFixed(1)}deg) saturate(${(1 + a.warmth / 500).toFixed(3)})`);
  return parts.filter(Boolean).join(' ');
}
async function bakeFilter(f) {
  const css = cssFilter(f);
  if (f.type !== 'image' || !css) return f.file;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = f.url; });
    const scale = Math.min(1, 2160 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    if (!('filter' in ctx)) return f.file;
    ctx.filter = css;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : f.file;
  } catch { return f.file; }
}

function FilterStrip({ f, onPick, dark }) {
  return (
    <div className={`filter-strip ${dark ? 'dark' : ''}`}>
      {FILTERS.map(([name]) => (
        <button key={name} className={`filter-item ${(f.filter || 'Normal') === name ? 'on' : ''}`} onClick={() => onPick(name)}>
          <span>{name}</span>
          <img src={f.url} alt="" draggable={false} style={{ filter: cssFilter({ filter: name }) }} />
        </button>
      ))}
    </div>
  );
}

function EditStep({ files, setFiles, title, onBack, onNext }) {
  const [idx, setIdx] = useState(() => Math.max(0, files.findIndex((f) => f.type === 'image')));
  const [tab, setTab] = useState('filter');
  const [adjKey, setAdjKey] = useState(null);
  const f = files[idx];
  const update = (patch) => setFiles((list) => list.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const adj = f.adj || ADJ0;
  return (
    <div className="screen create edit-step">
      <TopBar title={title} onBack={onBack} right={<button className="text-link strong" onClick={onNext}>{t('next')}</button>} />
      <div className="edit-preview">
        {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted />
          : <img src={f.url} alt="" draggable={false} style={{ filter: cssFilter(f) }} />}
      </div>
      {files.length > 1 && (
        <div className="edit-thumbs">
          {files.map((x, i) => (
            <button key={i} className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setAdjKey(null); }}>
              {x.type === 'video' ? <video disableRemotePlayback src={x.url} muted playsInline /> : <img src={x.url} alt="" style={{ filter: cssFilter(x) }} />}
            </button>
          ))}
        </div>
      )}
      <div className="edit-tools">
        {f.type !== 'image' ? <div className="edit-novideo muted">{t('filtersPhotosOnly')}</div>
          : tab === 'filter' ? <FilterStrip f={f} onPick={(name) => update({ filter: name })} />
            : adjKey ? (
              <div className="adj-slider">
                <div className="adj-head"><b>{t('adj_' + adjKey)}</b><span>{adj[adjKey] > 0 ? '+' : ''}{adj[adjKey]}</span></div>
                <input type="range" min={-100} max={100} step={1} value={adj[adjKey]}
                  onChange={(e) => update({ adj: { ...adj, [adjKey]: Number(e.target.value) } })} />
                <div className="adj-btns">
                  <button onClick={() => update({ adj: { ...adj, [adjKey]: 0 } })}>{t('reset')}</button>
                  <button className="strong" onClick={() => setAdjKey(null)}>{t('done')}</button>
                </div>
              </div>
            ) : (
              <div className="adj-list">
                {ADJ.map((k) => (
                  <button key={k} onClick={() => setAdjKey(k)} className={adj[k] ? 'set' : ''}>
                    <span className="adj-ico">{{ brightness: '☀', contrast: '◐', saturation: '◉', warmth: '🌡' }[k]}</span>
                    <span>{t('adj_' + k)}</span>
                    {adj[k] ? <small>{adj[k] > 0 ? '+' : ''}{adj[k]}</small> : null}
                  </button>
                ))}
              </div>
            )}
      </div>
      {f.type === 'image' && (
        <div className="edit-tabs">
          <button className={tab === 'filter' ? 'on' : ''} onClick={() => { setTab('filter'); setAdjKey(null); }}>{t('filterTab')}</button>
          <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>{t('editTab')}</button>
        </div>
      )}
    </div>
  );
}

export default function Create({ mode: initialMode = 'post' }) {""")
rep("""  const inputRef = useRef();
""","""  const inputRef = useRef();
  const [step, setStep] = useState('edit');
""")
rep("""    setFiles(chosen.map((file) => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image' })));""",
"""    setFiles(chosen.map((file) => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image', filter: 'Normal', adj: ADJ0 })));
    setStep('edit');""")
rep("""        const m = await uploadMedia(files[i].file, (p) =>""","""        const file = await bakeFilter(files[i]);
        const m = await uploadMedia(file, (p) =>""")
rep("""        <div className="story-preview">{f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" />}</div>""",
"""        <div className="story-preview">{f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" style={{ filter: cssFilter(f) }} />}</div>
        {f.type === 'image' && !busy && <FilterStrip dark f={f} onPick={(name) => setFiles([{ ...f, filter: name }])} />}""")
rep("""  return (
    <div className="screen create">
      <TopBar title={title} onBack={() => setFiles([])}""","""  if (step === 'edit' && files.some((x) => x.type === 'image')) {
    return <EditStep files={files} setFiles={setFiles} title={title} onBack={() => setFiles([])} onNext={() => setStep('details')} />;
  }

  return (
    <div className="screen create">
      <TopBar title={title} onBack={() => (files.some((x) => x.type === 'image') ? setStep('edit') : setFiles([]))}""")
rep("""              {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" />}
            </div>""","""              {f.type === 'video' ? <video disableRemotePlayback src={f.url} autoPlay loop playsInline muted /> : <img src={f.url} alt="" style={{ filter: cssFilter(f) }} />}
            </div>""")
open(p,'w').write(s)

p='/home/user/repo/src/styles.css'; s=open(p).read()
if '.filter-strip' not in s:
    s+='''.edit-step { background: var(--bg); }
.edit-preview { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }
.edit-preview img, .edit-preview video { max-width: 100%; max-height: 100%; object-fit: contain; }
.edit-thumbs { flex: none; display: flex; gap: 6px; padding: 8px 12px; overflow-x: auto; scrollbar-width: none; }
.edit-thumbs button { flex: none; width: 46px; height: 46px; border-radius: 6px; overflow: hidden; opacity: .55; border: 2px solid transparent; }
.edit-thumbs button.on { opacity: 1; border-color: var(--text); }
.edit-thumbs img, .edit-thumbs video { width: 100%; height: 100%; object-fit: cover; }
.edit-tools { flex: none; min-height: 150px; display: flex; align-items: center; }
.edit-novideo { width: 100%; text-align: center; font-size: 14px; }
.filter-strip { display: flex; gap: 10px; overflow-x: auto; padding: 12px; scrollbar-width: none; width: 100%; }
.filter-strip::-webkit-scrollbar { display: none; }
.filter-item { flex: none; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.filter-item img { width: 84px; height: 84px; object-fit: cover; border-radius: 4px; }
.filter-item.on { color: var(--text); font-weight: 700; }
.filter-item.on img { outline: 2px solid var(--text); outline-offset: 1px; }
.filter-strip.dark { position: absolute; left: 0; right: 0; bottom: calc(var(--safe-bottom) + 74px); z-index: 2; padding: 8px 12px; }
.filter-strip.dark .filter-item { color: rgba(255,255,255,.75); text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.filter-strip.dark .filter-item img { width: 56px; height: 56px; border-radius: 50%; }
.filter-strip.dark .filter-item.on { color: #fff; }
.filter-strip.dark .filter-item.on img { outline-color: #fff; }
.edit-tabs { flex: none; display: flex; border-top: 1px solid var(--sep); padding-bottom: var(--safe-bottom); }
.edit-tabs button { flex: 1; height: 50px; font-size: 15px; font-weight: 600; color: var(--muted); }
.edit-tabs button.on { color: var(--text); }
.adj-list { display: flex; gap: 8px; overflow-x: auto; padding: 12px; width: 100%; justify-content: space-around; }
.adj-list button { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 70px; }
.adj-list button.set { color: var(--text); font-weight: 600; }
.adj-ico { width: 58px; height: 58px; border-radius: 50%; border: 1.5px solid var(--sep); display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--text); }
.adj-list small { font-size: 11px; color: var(--blue); }
.adj-slider { width: 100%; padding: 8px 24px; }
.adj-head { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px; }
.adj-slider input[type=range] { width: 100%; accent-color: var(--text); }
.adj-btns { display: flex; justify-content: space-between; margin-top: 12px; }
.adj-btns button { font-size: 15px; padding: 6px 4px; }
.adj-btns .strong { font-weight: 700; }
'''
    open(p,'w').write(s)

p='/home/user/repo/src/locales/extra.js'; s=open(p).read()
if 'viewReplies' not in s:
    s+='''
// 2.4.6 — comment replies / likes, photo filters
Object.assign(extraEn, {
  reply: 'Reply', author: 'Author', byAuthor: 'by author', hideReplies: 'Hide replies', viewReply: 'View 1 more reply', viewReplies: 'View {n} more replies',
  replyingTo: 'Replying to {u}', nReply: 'replied to your comment: {t}', nCommentLike: 'liked your comment: {t}',
  filterTab: 'Filter', editTab: 'Edit', adj_brightness: 'Brightness', adj_contrast: 'Contrast', adj_saturation: 'Saturation', adj_warmth: 'Warmth',
  reset: 'Reset', filtersPhotosOnly: 'Filters are available for photos.',
});
Object.assign(extraEn.errors, { comment_not_found: 'This comment is no longer available.' });
Object.assign(extraAr, {
  reply: 'رد', author: 'الناشر', byAuthor: 'من الناشر', hideReplies: 'إخفاء الردود', viewReply: 'عرض رد واحد', viewReplies: 'عرض {n} ردود أخرى',
  replyingTo: 'الرد على {u}', nReply: 'ردّ على تعليقك: {t}', nCommentLike: 'أعجب بتعليقك: {t}',
  filterTab: 'فلتر', editTab: 'تعديل', adj_brightness: 'السطوع', adj_contrast: 'التباين', adj_saturation: 'التشبع', adj_warmth: 'الدفء',
  reset: 'إعادة تعيين', filtersPhotosOnly: 'الفلاتر متاحة للصور.',
});
Object.assign(extraAr.errors, { comment_not_found: 'هذا التعليق لم يعد متاحاً.' });
'''
    open(p,'w').write(s)

p='/home/user/repo/android/app/src/main/AndroidManifest.xml'; s=open(p).read()
if 'android.hardware.microphone' not in s:
    old='    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'
    assert old in s
    s=s.replace(old, old+'\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />',1)
    open(p,'w').write(s)
print('filters ok')
