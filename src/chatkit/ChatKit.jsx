/**
 * ChatKit — واجهة الدردشة الجديدة (نسخة مطابقة لتصميم الصور المرفقة)
 *   • شريط الكتابة: كاميرا + حقل + ميكروفون + صور + ملصقات + زر (+ / ✕)
 *   • لوحة الملصقات/الصور المتحركة/التأثيرات (ChatDrawer) بلون داكن وأيقونات GIPHY
 *   • قائمة الذكاء الاصطناعي المنبثقة (AiMenu): الموقع، صور AI، رسم، نيكسورا AI
 *   • أدوات: قصاصات، موسيقى، تأثيرات، مفاتيح الخدمات
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, getLang } from '../i18n.js';
import { Spinner } from '../components.jsx';
import { IClose, IPlus, IMic, IImage, ITrash, IArrowUp, ICheck, IMusic, ILocation, ILink, ISearch } from '../icons.jsx';
import { ICameraSolid, IEffectsFace, IStickerPeel, IGifBox, IAiImage, IDrawSquiggle, IAiFlower, IScissors, IWand, IUndo, IEraser, INearMe, IGear, ISpark } from './icons2.jsx';
import * as K from './lib.js';
import './kit.css';

/* ================================================================== *
 *  الحزمة المحلية: ملصقات SVG + صور متحركة GIF
 * ================================================================== */
const tagify = (ar, en, fr) => `${ar} ${en} ${fr}`.toLowerCase();
export const STICKERS = [
  { id: 'smile', tags: tagify('ضحك ابتسامة سعيد فرح', 'smile happy laugh', 'sourire heureux') },
  { id: 'heart-eyes', tags: tagify('قلوب حب اعجاب', 'heart eyes love', 'yeux coeur amour') },
  { id: 'cool', tags: tagify('نظارات كول رائع', 'cool sunglasses', 'cool lunettes') },
  { id: 'cry', tags: tagify('بكاء حزن دموع', 'cry sad tears', 'pleure triste') },
  { id: 'angry', tags: tagify('غاضب زعل', 'angry mad', 'colere faché') },
  { id: 'kiss', tags: tagify('قبلة بوسة', 'kiss love', 'bisou') },
  { id: 'laugh', tags: tagify('قهقهة ضحك قوي', 'laugh lol', 'rire') },
  { id: 'wink', tags: tagify('غمزة مزح', 'wink funny', 'clin oeil') },
  { id: 'frog', tags: tagify('ضفدع اخضر', 'frog green', 'grenouille') },
  { id: 'ghost', tags: tagify('شبح خوف', 'ghost boo', 'fantome') },
  { id: 'fire', tags: tagify('نار لهب حماس', 'fire flame lit', 'feu flamme') },
  { id: 'heart', tags: tagify('قلب حب', 'heart love', 'coeur amour') },
  { id: 'star', tags: tagify('نجمة', 'star', 'etoile') },
  { id: 'party', tags: tagify('حفلة احتفال', 'party celebrate', 'fete') },
  { id: 'monster', tags: tagify('وحش وحيد قرن', 'monster', 'monstre') },
  { id: 'thumbs', tags: tagify('موافق ممتاز', 'thumbs up ok', 'pouce ok') },
  { id: 'rose', tags: tagify('وردة حب', 'rose flower', 'rose fleur') },
  { id: 'hundred', tags: tagify('مية مئة نقطة', 'hundred 100', 'cent') },
].map((s) => ({ ...s, url: `/stickers/${s.id}.svg`, kind: 'sticker' }));

export const GIFS = [
  { id: 'heart-pulse', tags: tagify('قلب ينبض حب', 'heart pulse love', 'coeur battement') },
  { id: 'star-spin', tags: tagify('نجمة تدور', 'star spin', 'etoile tourne') },
  { id: 'smiley-bounce', tags: tagify('وجه يقفز مرح', 'smiley bounce happy', 'sourire saute') },
  { id: 'gg', tags: tagify('جي جي ابرا', 'gg gaming win', 'gg') },
  { id: 'confetti', tags: tagify('احتفال قصاصات ورق', 'confetti party', 'confettis fete') },
  { id: 'thinking', tags: tagify('تفكير كتابة', 'thinking typing', 'reflechis') },
  { id: 'flame', tags: tagify('لهب نار', 'flame fire', 'flamme feu') },
  { id: 'sparkle', tags: tagify('بريق لمعان نجوم', 'sparkle shine', 'etincelle') },
  { id: 'thumbs-wobble', tags: tagify('ممتاز موافق', 'thumbs up ok', 'pouce ok') },
  { id: 'wow', tags: tagify('اندهاش عجب', 'wow mind blown', 'wow') },
].map((g) => ({ ...g, url: `/gifs/${g.id}.gif`, kind: 'gif' }));

const QUICK = ['heart', 'heart-eyes', 'frog', 'kiss', 'fire', 'monster', 'star'];
const matchTag = (list, q) => {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return list;
  return list.filter((x) => x.tags.includes(s) || x.id.includes(s));
};

/* ================================================================== *
 *  أدوات مساعدة
 * ================================================================== */
/** ضغط مطوّل مع كتم النقرة (يُستعمل للسحب والإفلات) */
function useLongPress(fn, { ms = 420 } = {}) {
  const st = useRef({});
  const cancel = () => { clearTimeout(st.current.timer); st.current.fired = false; };
  const onPointerDown = (e) => {
    if (e.button) return;
    st.current = { x: e.clientX, y: e.clientY, fired: false, el: e.currentTarget, id: e.pointerId };
    st.current.timer = setTimeout(() => {
      st.current.fired = true;
      try { st.current.el?.setPointerCapture?.(st.current.id); } catch { /* ignore */ }
      fn(e);
    }, ms);
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (!s.x || s.fired) return;
    if (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10) cancel();
  };
  const onPointerUp = (e) => {
    const s = st.current;
    const fired = s.fired;
    cancel();
    if (fired) { e.preventDefault?.(); }
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onPointerLeave: cancel };
}

/** زر مع ضغط مطوّل (ضغط قصير = onPress، مطوّل = onLong) */
function Press({ onPress, onLong, longMs = 420, className = '', children, ...rest }) {
  const hold = useRef({ timer: null, fired: false });
  const cancel = () => { clearTimeout(hold.current.timer); hold.current.timer = null; };
  return (
    <button
      type="button" className={className} {...rest}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => {
        hold.current.fired = false;
        cancel();
        hold.current.timer = setTimeout(() => { hold.current.fired = true; onLong?.(); }, longMs);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onPointerMove={(e) => { if (hold.current.timer && e.movementX === 0 && e.movementY === 0) return; if (!hold.current.fired) cancel(); }}
      onClick={(e) => {
        if (hold.current.fired) { hold.current.fired = false; e.preventDefault(); e.stopPropagation(); return; }
        onPress?.(e);
      }}
    >{children}</button>
  );
}

/* ================================================================== *
 *  Sheet عام للأدوات
 * ================================================================== */
export function KitSheet({ open, onClose, title, icon, children, footer, tall = false }) {
  const [show, setShow] = useState(open);
  useEffect(() => { if (open) setShow(true); else { const tm = setTimeout(() => setShow(false), 200); return () => clearTimeout(tm); } }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const h = () => onClose?.();
    document.addEventListener('nx-close-overlay', h);
    return () => document.removeEventListener('nx-close-overlay', h);
  }, [open, onClose]);
  if (!show) return null;
  return createPortal(
    <div className={`ck-sheet-wrap ${open ? 'open' : 'closing'}`} onClick={onClose}>
      <div className={`ck-sheet ${tall ? 'tall' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ck-sheet-head">
          <span className="ck-sheet-title">{icon}{title}</span>
          <button className="ck-sheet-x" onClick={onClose} aria-label="close"><IClose size={20} /></button>
        </div>
        <div className="ck-sheet-body">{children}</div>
        {footer && <div className="ck-sheet-foot">{footer}</div>}
      </div>
    </div>, document.body,
  );
}

/* ================================================================== *
 *  شريط الكتابة
 * ================================================================== */
export function ChatComposer({
  text, setText, onSend, sending, editing, onCancelEdit,
  onPickMedia, onCamera, onOpenStickers, onToggleDrawer, onOpenAi, onTyping,
  recording, recTime, recLevels, onStartRec, onStopRec, drawerOpen, inputRef, rootRef,
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className={`chat-composer ck ${recording ? 'recording' : ''}`} ref={rootRef}>
      {recording ? (
        <>
          <button className="rec-cancel" onClick={() => onStopRec(false)} aria-label="cancel"><ITrash size={20} /></button>
          <span className="rec-dot" /><span className="rec-time">{K.fmtDur(recTime / 1000)}</span>
          <div className="rec-wave" dir="ltr">{recLevels.map((v, i) => <i key={i} style={{ height: `${12 + v * 88}%` }} />)}</div>
          <button className="rec-send" onClick={() => onStopRec(true)} aria-label="send"><IArrowUp size={20} /></button>
        </>
      ) : (
        <>
          <button className="ck-cam" onClick={onCamera} aria-label={t('ckCamera')}><ICameraSolid size={22} /></button>
          <input
            ref={inputRef} value={text} dir="auto" placeholder={t('typeMessage')}
            onChange={(e) => { setText(e.target.value); onTyping?.(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() && !e.shiftKey) { e.preventDefault(); onSend(text); } }}
          />
          {editing ? (
            <>
              <button className="ck-ic" onClick={onCancelEdit} aria-label={t('cancel')}><IClose size={22} /></button>
              <button className="ck-send" onClick={() => onSend(text)} aria-label={t('done')}><ICheck size={20} /></button>
            </>
          ) : text.trim() ? (
            <button className="ck-send" onClick={() => onSend(text)} aria-label={t('send')}>
              {sending ? <Spinner size={18} light /> : <IArrowUp size={20} />}
            </button>
          ) : (
            <>
              <button className="ck-ic" onClick={onStartRec} aria-label={t('msgVoice')}><IMic size={24} /></button>
              <button className="ck-ic" onClick={onPickMedia} aria-label={t('msgPhoto')}><IImage size={24} /></button>
              <button className="ck-ic" onClick={onOpenStickers} aria-label={t('ckStickers')}><IStickerPeel size={24} /></button>
              <Press
                className={`ck-plus ${drawerOpen ? 'open' : ''}`}
                aria-label={drawerOpen ? t('close') : t('ckMore')}
                onPress={onToggleDrawer} onLong={onOpenAi}
              >
                {drawerOpen ? <IClose size={20} /> : <IPlus size={22} />}
              </Press>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================== *
 *  لوحة الملصقات (ChatDrawer)
 * ================================================================== */
export function ChatDrawer({
  open, tab, setTab, onClose, onSendSticker, onSendGif, onEffect, onTool, onOpenAi, onDrag, giphyList,
}) {
  const [q, setQ] = useState('');
  const [tip, setTip] = useState(() => localStorage.getItem('nx_ck_tip') !== '0');
  const [remote, setRemote] = useState(null);
  const scrollRef = useRef();
  const stickers = useMemo(() => (remote?.length && tab === 'stickers' ? remote : matchTag(STICKERS, q)), [q, remote, tab]);
  const gifs = useMemo(() => (giphyList?.length ? giphyList : remote?.length && tab === 'gifs' ? remote : matchTag(GIFS, q)), [q, giphyList, remote, tab]);

  // نتائج GIPHY الحقيقية عند وجود مفتاح (وإلا الحزمة المحلية)
  useEffect(() => {
    if (!open || !q.trim() || !K.giphyKey()) { setRemote(null); return undefined; }
    let dead = false;
    const tm = setTimeout(async () => {
      const r = await K.giphySearch(q, tab === 'stickers' ? 'stickers' : 'gifs');
      if (!dead) setRemote(r ? r.map((x) => ({ ...x, kind: tab === 'stickers' ? 'sticker' : 'gif', preview: x.preview || x.url })) : null);
    }, 420);
    return () => { dead = true; clearTimeout(tm); };
  }, [q, open, tab]);

  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [tab]);

  const Dismiss = () => { setTip(false); localStorage.setItem('nx_ck_tip', '0'); };
  const dragHandlers = (item) => ({
    onPointerDown: (e) => {
      const t0 = setTimeout(() => onDrag?.({ phase: 'start', item, x: e.clientX, y: e.clientY }), 380);
      const move = (ev) => onDrag?.({ phase: 'move', item, x: ev.clientX, y: ev.clientY });
      const up = (ev) => {
        clearTimeout(t0);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        onDrag?.({ phase: 'end', item, x: ev.clientX, y: ev.clientY });
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
  });

  return (
    <div className={`ck-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="ck-handle" />
      <div className="ck-search">
        <ISearch size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={t('ckSearchStickers')} />
        {q && <button onClick={() => setQ('')} aria-label="clear"><IClose size={16} /></button>}
      </div>
      <div className="ck-scroll" ref={scrollRef}>
        <div className="ck-quick">
          <button className="ck-addtile" onClick={onOpenAi} aria-label={t('ckMore')}><IPlus size={22} /></button>
          {stickers.slice(0, 12).map((s) => (
            <button key={s.id} className="ck-stick-tile" {...dragHandlers(s)} onClick={() => onSendSticker(s)}>
              <img src={s.url} alt={s.id} draggable={false} />
            </button>
          ))}
          {!stickers.length && <span className="ck-none">{t('noResults')}</span>}
        </div>

        {tip && (
          <div className="ck-tip">
            <div className="ck-tip-text">
              <b>{t('ckTipTitle')}</b>
              <span>{t('ckTipBody')}</span>
            </div>
            <img className="ck-tip-art" src="/stickers/heart-eyes.svg" alt="" draggable={false} />
            <button className="ck-tip-x" onClick={Dismiss} aria-label="close"><IClose size={16} /></button>
          </div>
        )}

        <div className="ck-tools">
          <button className="ck-tool" onClick={() => onTool('cutouts')}>
            <span className="ck-toolicon"><IScissors size={24} /></span>
            <span className="ck-tool-label">{t('ckCutouts')}</span>
          </button>
          <button className="ck-tool" onClick={() => onTool('music')}>
            <span className="ck-toolicon">
              <IMusic size={24} />
              <i className="ck-new">{t('ckNew')}</i>
            </span>
            <span className="ck-tool-label">{t('ckMusic')}</span>
          </button>
          <button className="ck-tool" onClick={() => onTool('aiimage')}>
            <span className="ck-toolicon"><IAiImage size={24} /></span>
            <span className="ck-tool-label">{t('ckAiImages')}</span>
          </button>
          <button className="ck-tool" onClick={() => onTool('draw')}>
            <span className="ck-toolicon"><IDrawSquiggle size={24} /></span>
            <span className="ck-tool-label">{t('ckDraw')}</span>
          </button>
        </div>

        <div className="ck-giphy-head">
          <b className="ck-giphy-brand">GIPHY</b>
          <button className="ck-gear" onClick={() => onTool('settings')} aria-label={t('settings')}><IGear size={17} /></button>
        </div>

        {tab === 'effects' && (
          <div className="ck-fx-grid">
            {K.EFFECTS.map((e) => (
              <button key={e.id} className="ck-fx" onClick={() => onEffect(e.id)}>
                <span className={`ck-fx-art fx-${e.id}`}>{e.badge || <IWand size={22} />}</span>
                <span className="ck-fx-label">{getLang().startsWith('ar') ? e.label : e.en}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'stickers' && (
          <div className="ck-grid">
            {stickers.map((s) => (
              <button key={s.id} className="ck-cell" {...dragHandlers(s)} onClick={() => onSendSticker(s)}>
                <img src={s.url} alt={s.id} loading="lazy" draggable={false} />
              </button>
            ))}
            {!stickers.length && <div className="ck-empty">{t('noResults')}</div>}
          </div>
        )}

        {tab === 'gifs' && (
          <div className="ck-grid gifs">
            {gifs.map((g) => (
              <button key={g.id} className="ck-cell gif" onClick={() => onSendGif(g)}>
                <img src={g.preview || g.url} alt={g.id || g.title} loading="lazy" draggable={false} />
              </button>
            ))}
            {!gifs.length && <div className="ck-empty">{t('noResults')}</div>}
          </div>
        )}

        <div className="ck-foot">{t('ckPoweredBy')} GIPHY</div>
      </div>

      <div className="ck-tabs">
        <button className={tab === 'effects' ? 'on' : ''} onClick={() => setTab('effects')} aria-label={t('ckEffects')}><IEffectsFace size={27} /></button>
        <button className={tab === 'stickers' ? 'on' : ''} onClick={() => setTab('stickers')} aria-label={t('ckStickers')}><IStickerPeel size={27} /></button>
        <button className={tab === 'gifs' ? 'on' : ''} onClick={() => setTab('gifs')} aria-label={t('ckGifs')}><IGifBox size={27} /></button>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  قائمة الذكاء الاصطناعي المنبثقة (AiMenu)
 * ================================================================== */
export const AI_ITEMS = [
  { id: 'location', labelKey: 'ckLocation', Icon: ILocation },
  { id: 'aiimage', labelKey: 'ckAiImages', Icon: IAiImage },
  { id: 'draw', labelKey: 'ckDraw', Icon: IDrawSquiggle },
  { id: 'ai', labelKey: 'ckAi', Icon: IAiFlower },
];
export function AiMenu({ open, onClose, onPick, anchorRef }) {
  const [pos, setPos] = useState(null);
  const boxRef = useRef();
  useLayoutEffect(() => {
    if (!open) return;
    const r = anchorRef?.current?.getBoundingClientRect?.();
    const h = boxRef.current?.offsetHeight || 300;
    const bottom = r ? window.innerHeight - r.top + 10 : 90;
    setPos({ bottom: Math.min(bottom, window.innerHeight - h - 12), end: 14 });
  }, [open, anchorRef]);
  useEffect(() => {
    if (!open) return undefined;
    const h = () => onClose?.();
    document.addEventListener('nx-close-overlay', h);
    return () => document.removeEventListener('nx-close-overlay', h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="ck-aimenu-wrap" onClick={onClose}>
      <div ref={boxRef} className="ck-aimenu" style={pos ? { bottom: pos.bottom, insetInlineEnd: pos.end, visibility: 'visible' } : { visibility: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {AI_ITEMS.map(({ id, labelKey, Icon }) => (
          <button key={id} className={`ck-aimenu-row ${id === 'ai' ? 'ai' : ''}`} onClick={() => { onClose?.(); onPick(id); }}>
            <span className="ck-aimenu-icon"><Icon size={26} /></span>
            <span className="ck-aimenu-label">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </div>, document.body,
  );
}

/* ================================================================== *
 *  📍 مشاركة الموقع
 * ================================================================== */
export function LocationSheet({ open, onClose, onSend, toast }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let dead = false;
    setQ(''); setList([]); setPicked(null); setPreview(null);
    (async () => { const r = await K.searchPlaces(''); if (!dead) setList(r); })();
    return () => { dead = true; };
  }, [open]);

  useEffect(() => {
    if (!q.trim()) return undefined;
    const tm = setTimeout(async () => { const r = await K.searchPlaces(q); setList(r); }, 350);
    return () => clearTimeout(tm);
  }, [q]);

  useEffect(() => {
    if (!picked) { setPreview(null); return undefined; }
    let dead = false; setBusy(true);
    (async () => {
      const { blob } = await K.makeMapCard({ ...picked, place: picked.name, label: t('ckMyLocation') });
      if (dead) return;
      setPreview({ url: URL.createObjectURL(blob), blob, ...picked });
      setBusy(false);
    })();
    return () => { dead = true; };
  }, [picked]);

  const useMine = async () => {
    setBusy(true);
    try {
      const p = await K.getPosition();
      const name = await K.reverseGeocode(p.lat, p.lng);
      setPicked({ lat: p.lat, lng: p.lng, name: name || t('ckMyLocation'), source: 'gps' });
    } catch {
      toast?.(t('ckLocDenied'));
      setBusy(false);
    }
  };
  const send = async () => {
    if (!preview || sending) return;
    setSending(true);
    await onSend({
      blob: preview.blob, mime: 'image/jpeg', w: preview.w, h: preview.h,
      text: preview.name, meta: { kind: 'location', lat: preview.lat, lng: preview.lng, place: preview.name },
    });
    setSending(false); onClose();
  };

  return (
    <KitSheet open={open} onClose={onClose} title={t('ckLocation')} icon={<ILocation size={20} />} tall
      footer={
        <button className="ck-btn primary" disabled={!preview || sending} onClick={send}>
          {sending ? <Spinner size={18} light /> : t('ckSendLocation')}
        </button>
      }>
      <button className="ck-row-btn" onClick={useMine}><INearMe size={20} />{t('ckUseMyLocation')}</button>
      <div className="ck-search inner">
        <ISearch size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={t('ckSearchPlace')} />
      </div>
      {preview ? (
        <div className="ck-map">
          <img src={preview.url} alt="" draggable={false} />
          <div className="ck-map-info">
            <b>{preview.name}</b>
            <span className="muted small" dir="ltr">{Math.abs(preview.lat).toFixed(4)}° {preview.lat >= 0 ? 'N' : 'S'}, {Math.abs(preview.lng).toFixed(4)}° {preview.lng >= 0 ? 'E' : 'W'}</span>
            <a className="text-link strong" href={K.mapsLink(preview.lat, preview.lng)} target="_blank" rel="noreferrer">{t('ckOpenMaps')}</a>
          </div>
        </div>
      ) : busy ? <div className="center-pad"><Spinner /></div> : (
        <div className="ck-list">
          {list.map((p, i) => (
            <button key={i} className="ck-list-row" onClick={() => setPicked(p)}>
              <ILocation size={20} />
              <span className="ellipsis">{p.name}</span>
            </button>
          ))}
          {!list.length && <div className="ck-empty">{t('noResults')}</div>}
        </div>
      )}
    </KitSheet>
  );
}

/* ================================================================== *
 *  🖼️ توليد الصور بالذكاء الاصطناعي
 * ================================================================== */
export function AiImageSheet({ open, onClose, onSend, toast, initialPrompt = '' }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState('photo');
  const [ratio, setRatio] = useState('1:1');
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [, setModelTick] = useState(0);

  useEffect(() => { if (open) { setPrompt(initialPrompt || ''); setItems([]); setNote(''); } }, [open, initialPrompt]);
  const dims = ratio === '1:1' ? { w: 1024, h: 1024 } : ratio === '4:5' ? { w: 896, h: 1120 } : { w: 1216, h: 684 };
  const st = K.AI_STYLES.find((s) => s.id === style) || K.AI_STYLES[0];

  const generate = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true); setNote('');
    try {
      const r = await K.generateAiImage(p, { ...dims, style: st.suffix, onStage: (s) => setNote(s === 'offline' ? t('ckAiOffline') : t('ckGenerating')) });
      setItems((list) => [{ ...r, prompt: p }, ...list].slice(0, 6));
      setSel(0);
      if (r.procedural) setNote(t('ckAiOffline'));
    } catch (e) { toast?.(t('ckAiFailed')); }
    setBusy(false);
  };
  const send = async () => {
    const it = items[sel];
    if (!it) return;
    onClose();
    await onSend({
      blob: it.blob, url: it.remote ? it.url : undefined,
      mime: it.blob?.type || 'image/jpeg', w: it.w, h: it.h,
      meta: { kind: 'ai', prompt: it.prompt },
    });
  };

  return (
    <KitSheet open={open} onClose={onClose} title={t('ckAiImages')} icon={<IAiImage size={20} />} tall
      footer={<div className="ck-two"><button className="ck-btn" onClick={generate} disabled={busy || !prompt.trim()}>{busy ? <Spinner size={18} /> : t('ckGenerate')}</button><button className="ck-btn primary" disabled={!items.length} onClick={send}>{t('send')}</button></div>}>
      <textarea className="ck-textarea" value={prompt} dir="auto" placeholder={t('ckAiPlaceholder')} onChange={(e) => setPrompt(e.target.value)} rows={3} />
      <div className="ck-ideas">
        {K.AI_PROMPT_IDEAS.slice(0, 4).map((p) => <button key={p} className="ck-chip" onClick={() => setPrompt(p)} dir="auto">{p}</button>)}
      </div>
      <div className="ck-label">{t('ckStyle')}</div>
      <div className="ck-chips">
        {K.AI_STYLES.map((s) => <button key={s.id} className={`ck-chip ${style === s.id ? 'on' : ''}`} onClick={() => setStyle(s.id)}>{getLang().startsWith('ar') ? s.label : s.en}</button>)}
      </div>
      <div className="ck-label">{t('ckRatio')}</div>
      <div className="ck-chips">
        {['1:1', '4:5', '16:9'].map((r) => <button key={r} className={`ck-chip ${ratio === r ? 'on' : ''}`} onClick={() => setRatio(r)}>{r}</button>)}
      </div>
      {note && <div className="ck-note">{note}</div>}
      <div className="ck-label">{t('ckModel')}</div>
      <div className="ck-chips">
        {[['turbo', t('ckModelFast')], ['flux', t('ckModelHQ')]].map(([m, l]) => (
          <button key={m} className={`ck-chip ${(K.aiImageCfg().model === m) ? 'on' : ''}`} onClick={() => { localStorage.setItem('nx_ai_img_model', m); setModelTick((n) => n + 1); }}>{l}</button>
        ))}
      </div>
      {busy && <div className="ck-ai-loading"><Spinner /><span>{t('ckGenerating')}</span><small>{t('ckGeneratingNote')}</small></div>}
      {items.length > 0 && (
        <div className="ck-results">
          {items.map((it, i) => (
            <button key={i} className={`ck-result ${sel === i ? 'on' : ''}`} onClick={() => setSel(i)}>
              <img src={it.url} alt="" draggable={false} loading="lazy" />
              {sel === i && <span className="ck-result-check"><ICheck size={16} /></span>}
            </button>
          ))}
        </div>
      )}
      <div className="ck-note small">{t('ckAiHint')}</div>
    </KitSheet>
  );
}

/* ================================================================== *
 *  ✍️ لوحة الرسم
 * ================================================================== */
const PEN_COLORS = ['#ffffff', '#000000', '#ff2d55', '#ff9d00', '#ffd166', '#3ddc97', '#0095f6', '#7b3fe4', '#ff6bcb', '#8b5a2b'];
export function DrawSheet({ open, onClose, onSend }) {
  const canvasRef = useRef();
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(6);
  const [eraser, setEraser] = useState(false);
  const [bg, setBg] = useState('none');
  const st = useRef({ drawing: false, last: null, undo: [] });

  const prep = useCallback(() => {
    const c = canvasRef.current; if (!c) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      const snap = c.width ? c.toDataURL() : null;
      c.width = w * dpr; c.height = h * dpr;
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      x.lineCap = 'round'; x.lineJoin = 'round';
      if (snap) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, w, h); im.src = snap; }
    }
    return c.getContext('2d');
  }, []);

  useEffect(() => { if (open) setTimeout(prep, 60); }, [open, prep]);

  const pushUndo = () => {
    const c = canvasRef.current;
    try { st.current.undo.push(c.toDataURL()); if (st.current.undo.length > 10) st.current.undo.shift(); } catch { /* ignore */ }
  };
  const clear = () => { pushUndo(); const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); };
  const undo = () => {
    const c = canvasRef.current; const url = st.current.undo.pop();
    if (!url || !c) return;
    const x = c.getContext('2d');
    const im = new Image(); im.onload = () => { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); x.restore(); }; im.src = url;
  };
  const at = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e) => { const x = prep(); if (!x) return; pushUndo(); st.current.drawing = true; st.current.last = at(e); try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
  const move = (e) => {
    if (!st.current.drawing) return;
    const ctx = prep(); if (!ctx) return;
    const p = at(e);
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color; ctx.lineWidth = eraser ? size * 2.4 : size;
    ctx.beginPath(); ctx.moveTo(st.current.last.x, st.current.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    st.current.last = p;
  };
  const up = () => { st.current.drawing = false; };
  const send = async () => {
    const c = canvasRef.current;
    const out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    const x = out.getContext('2d');
    if (bg !== 'none') { x.fillStyle = bg === 'white' ? '#ffffff' : '#0c1014'; x.fillRect(0, 0, out.width, out.height); }
    x.drawImage(c, 0, 0);
    const blob = await K.canvasToBlob(out, 'image/png');
    onClose();
    await onSend({ blob, mime: 'image/png', w: out.width, h: out.height, meta: { kind: 'draw' } });
  };
  return (
    <KitSheet open={open} onClose={onClose} title={t('ckDraw')} icon={<IDrawSquiggle size={20} />} tall
      footer={<button className="ck-btn primary" onClick={send}>{t('send')}</button>}>
      <div className={`ck-draw-stage bg-${bg}`}>
        <canvas
          ref={canvasRef} className="ck-canvas"
          style={{ touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        />
      </div>
      <div className="ck-draw-tools">
        <div className="ck-colors">
          {PEN_COLORS.map((c) => (
            <button key={c} className={`ck-color ${color === c && !eraser ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setEraser(false); }} aria-label={c} />
          ))}
        </div>
        <div className="ck-sizes">
          {[3, 6, 12, 22].map((s) => (
            <button key={s} className={`ck-size ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}><i style={{ width: s + 2, height: s + 2 }} /></button>
          ))}
          <button className={`ck-ic2 ${eraser ? 'on' : ''}`} onClick={() => setEraser((v) => !v)} aria-label="eraser"><IEraser size={20} /></button>
          <button className="ck-ic2" onClick={undo} aria-label="undo"><IUndo size={20} /></button>
          <button className="ck-ic2" onClick={clear} aria-label="clear"><ITrash size={20} /></button>
        </div>
        <div className="ck-chips">
          {[['none', '🚫'], ['white', '⬜'], ['dark', '⬛']].map(([v, l]) => (
            <button key={v} className={`ck-chip ${bg === v ? 'on' : ''}`} onClick={() => setBg(v)}>{l} {v === 'none' ? t('ckTransparent') : v === 'white' ? t('ckWhite') : t('ckDark')}</button>
          ))}
        </div>
      </div>
    </KitSheet>
  );
}

/* ================================================================== *
 *  ✳️ نيكسورا AI — مساعد المحادثة
 * ================================================================== */
export function AiChatSheet({ open, onClose, onSendText, messages = [], toast, onUsePrompt }) {
  const [log, setLog] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef();

  useEffect(() => { if (open) { setLog([]); setQ(''); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [log, busy]);

  const push = (who, text, extra = {}) => setLog((l) => [...l, { who, text, ...extra }]);
  const ask = async (text, kind = 'chat') => {
    const s = text.trim();
    if (!s && kind === 'chat') return;
    if (s) push('me', s);
    setBusy(true);
    try {
      if (kind === 'replies') {
        const r = K.localReplies(messages);
        push('ai', t('ckAiReplies'), { replies: r });
      } else if (kind === 'summary') {
        push('ai', K.localSummary(messages) || t('ckAiNoSummary'));
      } else if (kind === 'translate') {
        const last = [...messages].reverse().find((m) => m.text)?.text || '';
        const to = (localStorage.getItem('nx_lang') || 'ar') === 'ar' ? 'en' : 'ar';
        const out = await K.translateText(last, to);
        push('ai', out ? `${t('ckAiTranslated')}:\n${out}` : t('ckAiTranslateFail'), { sendable: out });
      } else if (kind === 'ideas') {
        const ideas = K.AI_PROMPT_IDEAS.slice(0, 3);
        push('ai', t('ckAiIdeas'), { ideas });
      } else {
        const r = await K.aiChat({
          system: `أنت مساعد داخل تطبيق نيكسورا. أجب بإيجاز وبالعامية العربية المبسطة. ${aiCtxText(messages)}`,
          messages: [{ role: 'user', content: s }],
          onLocal: () => localAnswer(s, messages),
        });
        push('ai', r.text, { local: r.local });
      }
    } catch { push('ai', t('ckAiFailed')); }
    setBusy(false);
  };

  const localAnswer = (s, msgs) => {
    if (/لخّص|ملخص|summary/i.test(s)) return K.localSummary(msgs) || t('ckAiNoSummary');
    if (/رد|اجب|reply/i.test(s)) return `${t('ckAiReplies')}:\n• ${K.localReplies(msgs).slice(0, 3).join('\n• ')}`;
    if (/ترجم|translate/i.test(s)) return t('ckAiTranslateHint');
    if (/صورة|ارسم|image/i.test(s)) return `${t('ckAiIdeas')}:\n• ${K.AI_PROMPT_IDEAS.slice(0, 3).join('\n• ')}`;
    return t('ckAiLocalNote');
  };

  return (
    <KitSheet open={open} onClose={onClose} title={t('ckAi')} icon={<IAiFlower size={20} />} tall
      footer={
        <div className="ck-ai-input">
          <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" placeholder={t('ckAiAsk')} onKeyDown={(e) => e.key === 'Enter' && (ask(q), setQ(''))} />
          <button className="ck-btn primary sm" onClick={() => { ask(q); setQ(''); }}>{t('send')}</button>
        </div>
      }>
      <div className="ck-ai-actions">
        <button className="ck-chip" onClick={() => ask('', 'replies')}>💬 {t('ckAiSuggestReplies')}</button>
        <button className="ck-chip" onClick={() => ask('', 'summary')}>📝 {t('ckAiSummarize')}</button>
        <button className="ck-chip" onClick={() => ask('', 'translate')}>🌐 {t('ckAiTranslate')}</button>
        <button className="ck-chip" onClick={() => ask('', 'ideas')}>🎨 {t('ckAiImageIdeas')}</button>
      </div>
      <div className="ck-ai-log">
        {!log.length && !busy && <div className="ck-ai-hello"><IAiFlower size={34} /><b>{t('ckAiHello')}</b><span>{t('ckAiHelloSub')}</span></div>}
        {log.map((m, i) => (
          <div key={i} className={`ck-ai-msg ${m.who}`}>
            <div className="ck-ai-bubble" dir="auto">{m.text}</div>
            {m.replies && (
              <div className="ck-ai-replies">
                {m.replies.map((r) => (
                  <button key={r} className="ck-chip send" onClick={() => { onSendText?.(r); onClose(); }}>{r} <ISpark size={12} /></button>
                ))}
              </div>
            )}
            {m.ideas && (
              <div className="ck-ai-replies">
                {m.ideas.map((r) => (
                  <button key={r} className="ck-chip send" onClick={() => { onUsePrompt?.(r); onClose(); }} dir="auto">{r} <IAiImage size={13} /></button>
                ))}
              </div>
            )}
            {m.who === 'ai' && m.sendable && <button className="ck-chip send" onClick={() => { onSendText?.(m.sendable); onClose(); }}>{t('send')} <ISpark size={12} /></button>}
          </div>
        ))}
        {busy && <div className="ck-ai-msg ai"><div className="ck-ai-bubble typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>
      {!K.aiConfigured() && <div className="ck-note small">{t('ckAiKeyHint')}</div>}
    </KitSheet>
  );
}
const aiCtxText = (msgs = []) => msgs.slice(-6).map((m) => `${m.mine ? 'أنا' : 'هو'}: ${m.text || '[مرفق]'}`).join('\n');

/* ================================================================== *
 *  ✂️ القصاصات (Cutouts)
 * ================================================================== */
export function CutoutSheet({ open, onClose, onSend, toast }) {
  const [src, setSrc] = useState(null);
  const [tol, setTol] = useState(34);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  useEffect(() => { if (!open) { setSrc(null); setOut(null); } }, [open]);
  useEffect(() => {
    if (!src) { setOut(null); return undefined; }
    let dead = false; setBusy(true);
    (async () => {
      const r = await K.makeCutout(src, { tolerance: tol });
      if (dead) return;
      setOut({ url: URL.createObjectURL(r.blob), blob: r.blob, w: r.w, h: r.h });
      setBusy(false);
    })();
    return () => { dead = true; };
  }, [src, tol]);

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const url = await K.readFile(f);
    setSrc(url);
  };
  const send = async () => {
    if (!out) return;
    onClose();
    await onSend({ blob: out.blob, mime: 'image/png', w: out.w, h: out.h, meta: { kind: 'cutout' } });
  };

  return (
    <KitSheet open={open} onClose={onClose} title={t('ckCutouts')} icon={<IScissors size={20} />} tall
      footer={<div className="ck-two"><button className="ck-btn" onClick={() => fileRef.current?.click()}>{t('ckPickPhoto')}</button><button className="ck-btn primary" disabled={!out} onClick={send}>{t('send')}</button></div>}>
      {!src && (
        <div className="ck-empty-big">
          <IScissors size={40} />
          <b>{t('ckCutoutTitle')}</b>
          <span className="muted small">{t('ckCutoutSub')}</span>
          <button className="ck-btn primary" onClick={() => fileRef.current?.click()}>{t('ckPickPhoto')}</button>
        </div>
      )}
      {src && (
        <div className="ck-cutout">
          <div className="ck-cutout-stage">{out ? <img src={out.url} alt="" draggable={false} /> : <div className="center-pad"><Spinner /></div>}</div>
          <div className="ck-label">{t('ckEdge')}</div>
          <input className="ck-range" type="range" min="6" max="90" value={tol} onChange={(e) => setTol(Number(e.target.value))} />
          <div className="ck-two">
            <button className="ck-btn" onClick={() => setSrc(null)}>{t('ckAnother')}</button>
            <button className="ck-btn" onClick={() => { const s = src; setSrc(null); setTimeout(() => setSrc(s), 30); }}>{t('retry')}</button>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
    </KitSheet>
  );
}

/* ================================================================== *
 *  🎵 الموسيقى
 * ================================================================== */
export function MusicSheet({ open, onClose, onSend, onSendText }) {
  const [sel, setSel] = useState(null);
  const [card, setCard] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => { if (!open) { setSel(null); setCard(null); setTitle(''); setArtist(''); setLink(''); } }, [open]);
  useEffect(() => {
    if (!sel) { setCard(null); return undefined; }
    let dead = false;
    (async () => {
      const r = await K.makeMusicCard(sel);
      if (dead) return;
      setCard({ url: URL.createObjectURL(r.blob), blob: r.blob, w: r.w, h: r.h });
    })();
    return () => { dead = true; };
  }, [sel]);

  const custom = async () => {
    if (!title.trim()) return;
    const track = { title: title.trim(), artist: artist.trim() || 'Nexora Music', color: ['#7b3fe4', '#ff2d55'], emoji: '🎵' };
    setSel(track);
  };
  const send = async () => {
    if (!card || !sel) return;
    onClose();
    await onSend({
      blob: card.blob, mime: 'image/jpeg', w: card.w, h: card.h,
      text: link.trim() ? `🎵 ${sel.title} — ${sel.artist}\n${link.trim()}` : `🎵 ${sel.title} — ${sel.artist}`,
      meta: { kind: 'music', title: sel.title, artist: sel.artist, link: link.trim() },
    });
  };

  return (
    <KitSheet open={open} onClose={onClose} title={t('ckMusic')} icon={<IMusic size={20} />} tall
      footer={<button className="ck-btn primary" disabled={!card} onClick={send}>{t('send')}</button>}>
      {card ? (
        <div className="ck-music-preview">
          <img src={card.url} alt="" draggable={false} />
          <div className="ck-two">
            <button className="ck-btn" onClick={() => setSel(null)}>{t('ckBack')}</button>
            {link.trim() && <button className="ck-btn" onClick={() => { onSendText?.(link.trim()); onClose(); }}>{t('ckSendLinkOnly')}</button>}
          </div>
        </div>
      ) : (
        <>
          <div className="ck-music-grid">
            {K.MUSIC_LIBRARY.map((m) => (
              <button key={m.id} className="ck-music-card" onClick={() => setSel(m)} style={{ background: `linear-gradient(135deg, ${m.color[0]}, ${m.color[1]})` }}>
                <span className="ck-music-emoji">{m.emoji}</span>
                <b>{m.title}</b>
                <small>{m.artist}</small>
              </button>
            ))}
          </div>
          <div className="ck-label">{t('ckCustomTrack')}</div>
          <input className="ck-input" value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" placeholder={t('ckTrackTitle')} />
          <input className="ck-input" value={artist} onChange={(e) => setArtist(e.target.value)} dir="auto" placeholder={t('ckTrackArtist')} />
          <input className="ck-input" value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" placeholder="https://..." />
          <button className="ck-btn" disabled={!title.trim()} onClick={custom}>{t('ckMakeCard')}</button>
          <div className="ck-note small">{t('ckMusicNote')}</div>
        </>
      )}
    </KitSheet>
  );
}

/* ================================================================== *
 *  🎨 التأثيرات على الصور
 * ================================================================== */
export function EffectSheet({ open, onClose, onSend, src, effect, setEffect }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !src) return undefined;
    let dead = false; setBusy(true);
    (async () => {
      const eff = K.EFFECTS.find((e) => e.id === effect) || K.EFFECTS[0];
      const im = await K.loadImg(src);
      const c = document.createElement('canvas');
      const scale = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
      c.width = Math.round(im.naturalWidth * scale); c.height = Math.round(im.naturalHeight * scale);
      const x = c.getContext('2d');
      x.filter = eff.filter; x.drawImage(im, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.75);
      if (!dead) { setPreview(url); setBusy(false); }
    })();
    return () => { dead = true; };
  }, [open, src, effect]);

  const send = async () => {
    const r = await K.applyEffect(src, effect);
    onClose();
    await onSend({ blob: r.blob, mime: 'image/jpeg', w: r.w, h: r.h, meta: { kind: 'effect' } });
  };
  return (
    <KitSheet open={open} onClose={onClose} title={t('ckEffects')} icon={<IWand size={20} />} tall
      footer={<button className="ck-btn primary" disabled={!preview} onClick={send}>{t('send')}</button>}>
      <div className="ck-fx-preview">{preview ? <img src={preview} alt="" draggable={false} /> : <div className="center-pad"><Spinner /></div>}</div>
      <div className="ck-fx-row">
        {K.EFFECTS.map((e) => (
          <button key={e.id} className={`ck-fx-chip ${effect === e.id ? 'on' : ''}`} onClick={() => setEffect(e.id)}>{getLang().startsWith('ar') ? e.label : e.en}</button>
        ))}
      </div>
    </KitSheet>
  );
}

/* ================================================================== *
 *  ⚙️ مفاتيح الخدمات
 * ================================================================== */
export function KitSettingsSheet({ open, onClose, onChange }) {
  const [giphy, setGiphy] = useState(K.giphyKey());
  const [imgEnd, setImgEnd] = useState(K.aiImageCfg().endpoint);
  const [imgModel, setImgModel] = useState(K.aiImageCfg().model);
  const cfg = K.aiCfg();
  const [aiKey, setAiKey] = useState(cfg.key);
  const [aiBase, setAiBase] = useState(cfg.base);
  const [aiModel, setAiModel] = useState(cfg.model);

  useEffect(() => { if (open) { setGiphy(K.giphyKey()); const c = K.aiCfg(); setAiKey(c.key); setAiBase(c.base); setAiModel(c.model); const i = K.aiImageCfg(); setImgEnd(i.endpoint); setImgModel(i.model); } }, [open]);
  const save = () => {
    K.setGiphyKey(giphy);
    localStorage.setItem('nx_ai_img_endpoint', imgEnd.trim());
    localStorage.setItem('nx_ai_img_model', imgModel.trim());
    K.setAiCfg({ key: aiKey, base: aiBase, model: aiModel });
    onChange?.();
    onClose();
  };
  return (
    <KitSheet open={open} onClose={onClose} title={t('ckServices')} icon={<IGear size={20} />} tall
      footer={<button className="ck-btn primary" onClick={save}>{t('save')}</button>}>
      <div className="ck-label">GIPHY API key</div>
      <input className="ck-input" value={giphy} onChange={(e) => setGiphy(e.target.value)} dir="ltr" placeholder="dc6zaTOxFJmzC" />
      <div className="ck-note small">{t('ckGiphyNote')}</div>
      <div className="ck-label">{t('ckAiImages')}</div>
      <input className="ck-input" value={imgEnd} onChange={(e) => setImgEnd(e.target.value)} dir="ltr" placeholder="https://image.pollinations.ai/prompt" />
      <input className="ck-input" value={imgModel} onChange={(e) => setImgModel(e.target.value)} dir="ltr" placeholder="flux" />
      <div className="ck-label">{t('ckAi')}</div>
      <input className="ck-input" value={aiKey} onChange={(e) => setAiKey(e.target.value)} dir="ltr" placeholder="sk-..." />
      <input className="ck-input" value={aiBase} onChange={(e) => setAiBase(e.target.value)} dir="ltr" placeholder="https://api.openai.com/v1" />
      <input className="ck-input" value={aiModel} onChange={(e) => setAiModel(e.target.value)} dir="ltr" placeholder="gpt-4o-mini" />
      <div className="ck-note small">{t('ckAiKeyNote')}</div>
      <button className="ck-btn" onClick={() => { localStorage.removeItem('nx_ck_tip'); localStorage.removeItem('nx_ai_key'); localStorage.removeItem('nx_giphy_key'); onClose(); }}>{t('clearAll')}</button>
    </KitSheet>
  );
}

/* ================================================================== *
 *  سحب الملصق وإفلاته
 * ================================================================== */
export function DragLayer({ drag }) {
  if (!drag?.item || drag.phase !== 'move') return null;
  return createPortal(
    <div className="ck-drag" style={{ left: drag.x, top: drag.y }}>
      <img src={drag.item.url} alt="" draggable={false} />
      {drag.over && <span className="ck-drag-hint">{t('ckDropHere')}</span>}
    </div>, document.body,
  );
}

/* ================================================================== *
 *  عناصر عرض الرسائل الجديدة
 * ================================================================== */
export function StickerBubble({ m, onOpen, big }) {
  return <img className={`ck-bubble-sticker ${big ? 'big' : ''}`} src={m.mediaUrl} alt="" draggable={false} onClick={() => onOpen?.({ type: 'image', url: m.mediaUrl })} />;
}
export function GifBubble({ m, onOpen }) {
  return (
    <div className="ck-bubble-gif" onClick={() => onOpen?.({ url: m.mediaUrl })}>
      <img src={m.mediaUrl} alt="" draggable={false} />
      <span className="ck-gif-badge">GIF</span>
    </div>
  );
}
export function LocationBubble({ m }) {
  const lat = m.mediaMeta?.lat, lng = m.mediaMeta?.lng, place = m.mediaMeta?.place || m.text || '';
  return (
    <div className="ck-bubble-loc">
      <img src={m.mediaUrl} alt="" draggable={false} />
      <div className="ck-bubble-loc-info">
        <b className="ellipsis" dir="auto">{place || t('ckLocation')}</b>
        {Number.isFinite(lat) && <span className="muted small" dir="ltr">{Math.abs(lat).toFixed(4)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(4)}° {lng >= 0 ? 'E' : 'W'}</span>}
        {Number.isFinite(lat) && <a className="ck-loc-open" href={K.mapsLink(lat, lng)} target="_blank" rel="noreferrer">{t('ckOpenMaps')}</a>}
      </div>
    </div>
  );
}
export function MusicBubble({ m }) {
  return (
    <div className="ck-bubble-music">
      <img src={m.mediaUrl} alt="" draggable={false} />
      <div className="ck-bubble-music-info">
        <b className="ellipsis" dir="auto">{m.mediaMeta?.title || t('ckMusic')}</b>
        <span className="muted small ellipsis" dir="auto">{m.mediaMeta?.artist || ''}</span>
        {m.mediaMeta?.link && <a className="ck-loc-open" href={m.mediaMeta.link} target="_blank" rel="noreferrer"><ILink size={14} /> {t('ckOpenLink')}</a>}
      </div>
    </div>
  );
}
