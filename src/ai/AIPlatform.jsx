import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Glyph, Splash } from '../components.jsx';
import AuthFlow from '../screens/Auth.jsx';
import { api, API_BASE, getToken, setToken, onUnauthorized, upsertAccount, getAccounts, forgetAccount, dropAccountToken } from '../api.js';
import { getLang, setLang as saveLang } from '../i18n.js';
import AdSlot from './AdSlot.jsx';
import Markdown from './Markdown.jsx';
import Subscriptions from './Subscriptions.jsx';
import AdminRevenue from './AdminRevenue.jsx';
import './AIPlatform.css';

const TOOLS = [
  { id:'chat', title:'المحادثة الذكية', sub:'اسأل واستكشف الأفكار', icon:'✦', color:'violet' },
  { id:'image', title:'توليد الصور', sub:'حوّل وصفك إلى صورة', icon:'▧', color:'purple' },
  { id:'write', title:'الكتابة والإبداع', sub:'مقالات ومنشورات', icon:'✎', color:'pink' },
  { id:'code', title:'مساعد البرمجة', sub:'اكتب وحسّن الأكواد', icon:'⌘', color:'blue' },
  { id:'translate', title:'الترجمة', sub:'ترجمة طبيعية دقيقة', icon:'文', color:'cyan' },
  { id:'summarize', title:'تلخيص النصوص', sub:'استخرج أهم النقاط', icon:'≡', color:'orange' }
];
const MODEL_NAMES = {'gpt-5.1':'GPT-5.1','gpt-5-mini':'GPT-5 mini','gpt-5-nano':'GPT-5 nano'};
const keyFor = (id) => 'nx_ai_chat_' + id;
/** SHA-256 للرمز المحلي — لا يُخزَّن الرمز نفسه أبدًا. */
async function pinHash(pin){
  const data=new TextEncoder().encode('nexora-ai-pin:'+String(pin||''));
  if(typeof crypto!=='undefined'&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  let h=0;for(const c of String(pin||''))h=(h*31+c.charCodeAt(0))>>>0;return 'f'+h.toString(16);
}

function Icon({ name, size=19 }) {
  const props={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
  const shapes={
    chat:<><path d="M20 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-4-.9L3 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M8 10h8M8 13.5h5"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    image:<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    send:<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    logout:<><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/></>,
    menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
    spark:<><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9Z"/></>,
    chevron:<path d="m9 18 6-6-6-6"/>,
    mic:<><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M8 21h8"/></>,
    speaker:<><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/></>,
    speakerOff:<><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m17 9 4 6M21 9l-4 6"/></>,
    wallet:<><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><circle cx="17" cy="14" r="1.2"/></>,
    user:<><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></>,
    lock:<><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></>,
    tune:<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>
  };
  return <svg {...props}>{shapes[name]||shapes.spark}</svg>;
}

/* تصغير الصور الكبيرة قبل الرفع (حفاظًا على حد الرفع وباقة الهاتف) */
async function shrinkImage(file){
  try{
    const img=await createImageBitmap(file);
    const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));
    if(scale===1&&file.size<900*1024)return file;
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.86));
    return blob&&blob.size?blob:file;
  }catch{ return file }
}

export default function AIPlatform() {
  const [token,setTok]=useState(getToken());
  const [me,setMe]=useState(()=>{try{return JSON.parse(localStorage.getItem('nx_me')||'null')}catch{return null}});
  const [lang,setLangState]=useState(getLang());
  const [booting,setBooting]=useState(!!getToken()&&!localStorage.getItem('nx_me'));
  const [mode,setMode]=useState('chat');
  const [model,setModel]=useState('gpt-5-mini');
  const [messages,setMessages]=useState([]);
  const [historyOwner,setHistoryOwner]=useState(null);
  const [input,setInput]=useState('');
  const [convs,setConvs]=useState([]);
  const [convId,setConvId]=useState(null);
  const [convQ,setConvQ]=useState('');
  const [searchOn,setSearchOn]=useState(()=>localStorage.getItem('nx_ai_search')==='1');
  const [attach,setAttach]=useState([]);
  const [fileBusy,setFileBusy]=useState(false);
  const [ttsBusy,setTtsBusy]=useState(false);
  const [themeTick,setThemeTick]=useState(0);
  const abortRef=useRef(null);
  const fileInput=useRef(null);
  const [busy,setBusy]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const bottom=useRef(null);
  const field=useRef(null);
  const [toastMsg,setToastMsg]=useState('');
  const [style,setStyle]=useState(()=>localStorage.getItem('nx_ai_style')||'auto');
  const [voiceOut,setVoiceOut]=useState(()=>localStorage.getItem('nx_ai_tts')==='1');
  const [recording,setRecording]=useState(false);
  const [voiceBusy,setVoiceBusy]=useState(false);
  const [credits,setCredits]=useState(null);
  const [sheet,setSheet]=useState(null);
  const [plans,setPlans]=useState(null);
  const [anchorPin,setAnchorPin]=useState(()=>localStorage.getItem('nx_ai_pin')||'');
  const [pinOpen,setPinOpen]=useState(()=>!!localStorage.getItem('nx_ai_pin') && sessionStorage.getItem('nx_ai_unlocked')!=='1');
  const [pinInput,setPinInput]=useState('');
  const [accounts,setAccounts]=useState(()=>getAccounts());
  const [addingAccount,setAddingAccount]=useState(false);
  const recRef=useRef(null);
  const runRef=useRef(null);
  const toast=useCallback((msg)=>{setToastMsg(msg);window.setTimeout(()=>setToastMsg(''),2800)},[]);
  const updateMe=useCallback((u)=>{setMe(u);localStorage.setItem('nx_me',JSON.stringify(u));upsertAccount(u)},[]);
  const login=useCallback((tk,u)=>{setToken(tk);setTok(tk);setMe(u);localStorage.setItem('nx_me',JSON.stringify(u));upsertAccount(u,tk);setAccounts(getAccounts());setAddingAccount(false)},[]);
  const logout=useCallback(()=>{if(me)upsertAccount(me,getToken());setToken(null);setTok(null);setMe(null);localStorage.removeItem('nx_me');setMessages([])},[me]);
  const setLang=useCallback(async(l)=>{await saveLang(l);setLangState(l)},[]);

  /* ---------- رصيد المستخدم (نقاط الاستخدام) ---------- */
  const loadCredits=useCallback(()=>{ if(!getToken())return; api('me/credits').then(r=>{setCredits(r);setPlans(r.plans||[]) }).catch(()=>{}) },[]);

  /* ---------- تحويل النص إلى كلام ---------- */
  const speak=useCallback((text)=>{
    const clean=String(text||'').replace(/```[\s\S]*?```/g,' ').replace(/[*_#>`]/g,'').replace(/\s+/g,' ').trim().slice(0,600);
    if(!clean)return;
    const l=(lang||'ar').slice(0,2);
    try{
      if(window.NexoraNative&&typeof window.NexoraNative.speak==='function'){ window.NexoraNative.speak(clean,l); return; }
      if(typeof speechSynthesis==='undefined')return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(clean);
      u.lang=l==='ar'?'ar-DZ':(l==='fr'?'fr-FR':l==='en'?'en-US':l);
      const v=(speechSynthesis.getVoices()||[]).find(x=>x.lang&&x.lang.toLowerCase().startsWith(l));
      if(v)u.voice=v;
      speechSynthesis.speak(u);
    }catch{/* الصوت ميزة إضافية — لا تُفشل الواجهة */}
  },[]);

  /* ---------- رسالة صوتية: جسر التطبيق → تعرّف المتصفح → تسجيل يُفرَّغ على الخادم ---------- */
  const voiceBusyRef=useRef(false);
  const handleVoiceText=useCallback((text)=>{
    voiceBusyRef.current=false;setVoiceBusy(false);
    const clean=String(text||'').trim();
    if(clean)runRef.current&&runRef.current(clean);
    else toast('لم أسمع كلامًا واضحًا، أعد المحاولة.');
  },[toast]);
  useEffect(()=>{
    window.NexoraVoiceResult=(t)=>handleVoiceText(t);
    window.NexoraVoiceError=(m)=>{voiceBusyRef.current=false;setVoiceBusy(false);toast(m||'تعذر التعرف على الصوت');};
    return()=>{delete window.NexoraVoiceResult;delete window.NexoraVoiceError;};
  },[handleVoiceText,toast]);

  const startRecorder=async()=>{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus'
      :MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'audio/webm';
    const rec=new MediaRecorder(stream,{mimeType:mime});
    const chunks=[];
    rec.ondataavailable=(e)=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.onstop=async()=>{
      stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(chunks,{type:mime.split(';')[0]});
      setRecording(false);
      if(blob.size<1200){toast('التسجيل قصير جدًا.');return}
      setVoiceBusy(true);
      try{
        const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
        const r=await api('ai/voice',{method:'POST',body:{audio:b64,mime:mime.split(';')[0],mode,style,lang}});
        setMessages(old=>[...old,{role:'user',text:r.transcript?('🎙️ '+r.transcript):'🎙️ رسالة صوتية'},{role:'model',text:r.answer,provider:r.provider,providerLabel:r.providerLabel,model:r.model}]);
        if(r.credits!==undefined)setCredits(c=>({...c,balance:r.credits}));
        if(voiceOut)speak(r.answer);
      }catch(err){
        const code=err?.code;
        if(code==='insufficient_credits'){setSheet('credits');toast('نفد رصيدك — اشترِ نقاطًا للمتابعة.');}
        else toast(code==='voice_unavailable'?'التفريغ الصوتي غير متاح الآن، جرّب الكتابة.':('تعذر إرسال الرسالة الصوتية ('+(code||'خطأ')+')'));
      }
      setVoiceBusy(false);
    };
    recRef.current={rec,stream};
    rec.start();
    setRecording(true);
    window.setTimeout(()=>{ if(recRef.current&&recRef.current.rec.state==='recording')recRef.current.rec.stop() },60000);
  };
  const stopRecorder=()=>{ try{recRef.current?.rec?.state==='recording'&&recRef.current.rec.stop()}catch{} };

  const voiceInput=async()=>{
    if(busy||voiceBusyRef.current)return;
    if(recording){stopRecorder();return}
    if(window.NexoraNative&&typeof window.NexoraNative.startVoice==='function'){
      voiceBusyRef.current=true;setVoiceBusy(true);
      try{window.NexoraNative.startVoice((lang||'ar').slice(0,2))}catch{voiceBusyRef.current=false;setVoiceBusy(false)}
      return;
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){
      try{
        const r=new SR();
        r.lang=(lang||'ar').slice(0,2)==='ar'?'ar-DZ':(lang||'en');
        r.interimResults=false;r.maxAlternatives=1;
        voiceBusyRef.current=true;setVoiceBusy(true);setRecording(true);
        r.onresult=(e)=>{const t=e.results?.[0]?.[0]?.transcript||'';setRecording(false);handleVoiceText(t)};
        r.onerror=()=>{setRecording(false);voiceBusyRef.current=false;setVoiceBusy(false);toast('تعذر التعرف على الصوت، جرّب التسجيل.');};
        r.onend=()=>setRecording(false);
        r.start();
        window.setTimeout(()=>{try{r.stop()}catch{}},30000);
        return;
      }catch{/* fall through to recorder */}
    }
    try{ await startRecorder(); }
    catch{ toast('الميكروفون غير متاح في هذا المتصفح.'); }
  };
  const ctx=useMemo(()=>({me,updateMe,login,logout,switchAccount:login,addAccount:()=>{},nav:{push:()=>{},pop:()=>{},replace:()=>{},reset:()=>{},tab:()=>{},profile:()=>{}},toast,lang,setLang,badges:{},refreshBadges:()=>{},setBadges:()=>{},tab:'ai',refreshKey:0}),[me,updateMe,login,logout,toast,lang,setLang]);

  useEffect(()=>onUnauthorized(()=>{setToken(null);setTok(null);setMe(null);localStorage.removeItem('nx_me');setMessages([]);toast('انتهت الجلسة، سجّل الدخول مجددًا.') }),[toast]);
  useEffect(()=>{
    if(!token){setBooting(false);return}
    let live=true;
    api('me').then(r=>{if(live){updateMe(r.user);setBooting(false)}}).catch(()=>{if(live)setBooting(false)});
    return()=>{live=false};
  },[token,updateMe]);
  useEffect(()=>{if(me?.id)loadCredits()},[me?.id,loadCredits]);

  /* ---------- المحادثات المحفوظة في PostgreSQL ---------- */
  const loadConvs=useCallback(async(q)=>{ if(!getToken())return; try{ const r=await api(q?('conversations/search?q='+encodeURIComponent(q)):'conversations'); setConvs(r.conversations||[]) }catch{/* تبقى القائمة كما هي */} },[]);
  useEffect(()=>{ if(me?.id)loadConvs(); else { setConvs([]); setConvId(null) } },[me?.id,loadConvs]);
  useEffect(()=>{ if(!me?.id)return; const t=setTimeout(()=>loadConvs(convQ.trim()),convQ.trim()?400:0); return()=>clearTimeout(t) },[convQ,me?.id,loadConvs]);

  const openConv=useCallback(async(id)=>{
    try{
      const r=await api('conversations/'+id);
      setConvId(Number(id));
      setMode(r.conversation.mode||'chat');
      setMessages((r.messages||[]).map(m=>({role:(m.role==='model'?'model':m.role),text:m.text,provider:m.provider,providerLabel:m.provider,model:m.model,sources:(m.meta&&m.meta.sources)||null})));
      setSidebarOpen(false);
    }catch{ toast('تعذر فتح المحادثة') }
  },[toast]);

  const renameConv=useCallback(async(c)=>{
    const t=window.prompt('اسم المحادثة الجديد:',c.title||'');
    if(t===null)return;
    try{ await api('conversations/'+c.id,{method:'PATCH',body:{title:t}}); loadConvs(convQ.trim()) }catch{ toast('تعذر تغيير الاسم') }
  },[convQ,loadConvs,toast]);

  const deleteConv=useCallback(async(c)=>{
    if(!window.confirm('حذف هذه المحادثة نهائيًا مع رسائلها؟'))return;
    try{
      await api('conversations/'+c.id,{method:'DELETE'});
      if(Number(convId)===Number(c.id)){setConvId(null);setMessages([])}
      loadConvs(convQ.trim());
    }catch{ toast('تعذر الحذف') }
  },[convId,convQ,loadConvs,toast]);

  /* ---------- مرفقات حقيقية: رفع إلى التخزين ثم تحليلها عند الإرسال ---------- */
  const pickFiles=()=>{ if(fileBusy)return; fileInput.current&&fileInput.current.click() };
  const onFiles=async(e)=>{
    const files=[...(e.target.files||[])]; e.target.value='';
    if(!files.length)return;
    setFileBusy(true);
    try{
      for(const f of files){
        if(attach.length>=3){ toast('3 مرفقات كحد أقصى في الرسالة'); break }
        let blob=f,name=f.name,mime=f.type||'application/octet-stream';
        if(mime.startsWith('image/')){ blob=await shrinkImage(f); if(blob!==f){ name=f.name.replace(/\.[^.]+$/,'')+'.jpg'; mime='image/jpeg' } }
        if(blob.size>3*1024*1024){ toast('الحد الأقصى للملف 3 ميجابايت'); continue }
        const data=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
        const r=await api('ai/files',{method:'POST',body:{name,mime,data}});
        setAttach(a=>[...a,{id:r.file.id,name:r.file.name,kind:r.file.kind}]);
      }
    }catch(err){
      const c=err&&err.code;
      toast(c==='file_too_large'?'الملف أكبر من الحد المسموح':c==='unsupported_type'?'نوع الملف غير مدعوم (صور · PDF · DOCX · TXT · CSV)':('تعذر رفع الملف ('+(c||'خطأ')+')'));
    }
    setFileBusy(false);
  };

  const copyText=useCallback(async(t)=>{ try{ await navigator.clipboard.writeText(String(t||'')); toast('تم نسخ الإجابة') }catch{ toast('تعذر النسخ في هذا المتصفح') } },[toast]);

  /* صوت سحابي حقيقي (Gemini TTS) — بخلاف صوت الجهاز المجاني */
  const serverTts=useCallback(async(t)=>{
    if(ttsBusy)return;
    setTtsBusy(true);
    try{
      const r=await api('ai/tts',{method:'POST',body:{text:String(t||'').slice(0,600)}});
      if(r.credits!==undefined)setCredits(c=>({...c,balance:r.credits}));
      const a=new Audio(r.audio); a.play().catch(()=>{});
      toast('صوت Gemini ('+r.model+')');
    }catch(err){
      const c=err&&err.code;
      toast(c==='insufficient_credits'?'نفد الرصيد — الصوت السحابي يخصم نقطة':c==='tts_unavailable'?'الصوت السحابي غير متاح الآن (مفتاح Gemini)':('تعذر الصوت السحابي ('+(c||'خطأ')+')'));
    }
    setTtsBusy(false);
  },[ttsBusy,toast]);

  const stopGen=()=>{ try{ abortRef.current&&abortRef.current.abort() }catch{/* لا شيء */} };
  useEffect(()=>{if(!me?.id){setHistoryOwner(null);setMessages([]);return}let saved=[];try{saved=JSON.parse(localStorage.getItem(keyFor(me.id))||'[]')}catch{saved=[]}setMessages(saved);setHistoryOwner(me.id)},[me?.id]);
  useEffect(()=>{if(me?.id&&historyOwner===me.id)localStorage.setItem(keyFor(me.id),JSON.stringify(messages.slice(-80)));bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,me?.id,historyOwner,busy]);
  const newChat=()=>{setMessages([]);setInput('');setMode('chat');setSidebarOpen(false);setConvId(null);setAttach([]);field.current?.focus()};
  const lastUserBefore=(i)=>{for(let j=i-1;j>=0;j--){const m=messages[j];if(m&&m.role==='user'&&m.text)return m.text}return null};
  const runPrompt=async(prompt,opts)=> {
    opts=opts||{};
    prompt=String(prompt||'').trim();if(!prompt||busy)return;
    const prior=convId?undefined:messages.filter(m=>['user','model'].includes(m.role)&&m.text).slice(-10).map(m=>({role:m.role,text:m.text}));
    const attIds=opts.regenerate?[]:attach.map(a=>a.id);
    const attNames=opts.regenerate?[]:attach.map(a=>a.name);
    setMessages(old=>[...old,{role:'user',text:prompt,attachments:attNames.length?attNames:undefined},{role:'model',text:'',streaming:true}]);
    setAttach([]);setBusy(true);
    const patchLast=(patch)=>setMessages(old=>{const n=old.length;return old.map((m,i)=>i===n-1?{...m,...patch}:m)});
    const ctrl=new AbortController();abortRef.current=ctrl;
    try {
      if(mode==='image'){
        const r=await api('ai/image',{method:'POST',body:{prompt}});
        if(r.credits!==undefined)setCredits(c=>({...c,balance:r.credits}));
        patchLast({text:'تم إرسال طلب الصورة إلى مزوّد التوليد.',image:r.url,provider:r.provider,providerLabel:r.providerLabel,streaming:false});
      }else{
        const body={message:prompt,model,mode,style,lang,conversationId:convId||undefined,search:searchOn,attachments:attIds.length?attIds:undefined,regenerate:opts.regenerate===true,history:prior};
        let res=null;
        try{
          res=await fetch((API_BASE||'')+'/api/ai/stream',{
            method:'POST',signal:ctrl.signal,
            headers:{'Content-Type':'application/json',...(getToken()?{Authorization:'Bearer '+getToken()}:{})},
            body:JSON.stringify(body)
          });
        }catch(e){ if(e&&e.name==='AbortError')throw e; res=null }
        const isSse=res&&res.ok&&String(res.headers.get('content-type')||'').includes('text/event-stream');
        if(!isSse){
          const r=await api('ai/chat',{method:'POST',body,signal:ctrl.signal});
          if(r.credits!==undefined)setCredits(c=>({...c,balance:r.credits}));
          if(r.conversationId)setConvId(r.conversationId);
          patchLast({text:r.answer,provider:r.provider,providerLabel:r.providerLabel,model:r.model,sources:r.sources||null,streaming:false,trace:(r.fallbacks||[]).join(' | ')});
          loadConvs(convQ.trim());
          if(voiceOut)speak(r.answer);
        }else{
          const reader=res.body.getReader();const dec=new TextDecoder();let buf='';
          for(;;){
            const rd=await reader.read();if(rd.done)break;
            buf+=dec.decode(rd.value,{stream:true});
            const parts=buf.split('\n\n');buf=parts.pop()||'';
            for(const part of parts){
              const line=part.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;
              let ev;try{ev=JSON.parse(line.slice(6))}catch{continue}
              if(ev.type==='delta')patchLast({text:ev.text,streaming:true});
              else if(ev.type==='start'){if(ev.conversationId)setConvId(ev.conversationId)}
              else if(ev.type==='done'){
                patchLast({text:ev.answer||undefined,provider:ev.provider,providerLabel:ev.providerLabel,model:ev.model,sources:ev.sources||null,streaming:false});
                if(ev.credits!==undefined)setCredits(c=>({...c,balance:ev.credits}));
                if(ev.conversationId)setConvId(ev.conversationId);
                loadConvs(convQ.trim());
                if(voiceOut)speak(ev.answer);
              }else if(ev.type==='error'){
                throw Object.assign(new Error(ev.code||'server_error'),{code:ev.code,detail:ev.detail});
              }
            }
          }
          patchLast({streaming:false});
        }
      }
    }catch(err){
      if(err&&err.name==='AbortError'){patchLast({streaming:false,stopped:true})}
      else{
        const code=err?.code;
        const base = ({
        ai_not_configured: 'لا يوجد أي مزوّد ذكاء اصطناعي مضبوط على الخادم. أضف مفتاحًا (OpenAI أو Gemini أو OpenRouter) في Vercel ثم أعد النشر.',
        ai_key_invalid: 'رُفضت مفاتيح المزوّدين (مفتاح غير صالح أو ملغى). حدّث المفاتيح من لوحة Vercel أو من صفحة إدارة المفاتيح.',
        ai_billing_required: 'رفض المزوّد الطلب بسبب الرصيد أو الفوترة. المزوّدون المجانيون (OpenRouter · Pollinations) يحاولون تلقائيًا — أعد المحاولة أو جدّد المفتاح.',
        ai_model_unavailable: 'النموذج المحدد غير متاح لهذا المفتاح. اختر GPT-5 mini أو أعد المحاولة ليُستخدم مزوّد بديل.',
        provider_rate_limited: 'وصلت إلى حد الطلبات مؤقتًا لدى المزوّدين. انتظر دقيقة ثم حاول مجددًا.',
        rate_limited: 'وصلت إلى حد الاستخدام المؤقت؛ حاول بعد دقيقة.',
        insufficient_credits: 'نفد رصيد نقاطك. افتح «الرصيد» لشراء نقاط أو تجديد الاشتراك ثم تابع.',
        voice_unavailable: 'التفريغ الصوتي غير متاح مؤقتًا (مزوّد الصوت). اكتب رسالتك أو حاول بعد قليل.',
        audio_too_large: 'التسجيل طويل جدًا — اجعله أقل من دقيقة.',
        unknown_plan: 'الخطة المطلوبة غير معروفة.',
        order_not_found: 'لم يُعثر على الطلب.',
        ai_provider_error: 'رفضت خدمة OpenAI الطلب. تحقق من صلاحيات المشروع وحالة API.',
        ai_unavailable: 'تعذّر الاتصال بخدمة OpenAI. حاول مجددًا، وإذا استمرت المشكلة افحص Runtime Logs في Vercel.',
        ai_empty_response: 'لم تُرجع OpenAI إجابة. أعد المحاولة.',
        ai_all_providers_failed: 'تعذّر الوصول إلى كل مزوّدي الذكاء الاصطناعي (OpenAI ثم البديل المجاني). حاول بعد قليل.',
        ai_provider_overloaded: 'مزوّدو الذكاء الاصطناعي مشغولون الآن (خطأ مؤقت من جهتهم). أعد المحاولة بعد لحظات.',
        unauthorized: 'انتهت جلسة الدخول. سجّل الخروج ثم ادخل مجددًا.',
        network: 'تعذّر الاتصال بخادم NEXORA. تحقق من الإنترنت وحاول مجددًا.',
        server_error: 'حدث خطأ داخل خادم NEXORA. افتح Runtime Logs في Vercel لمعرفة السبب.'
      })[code] || ('تعذّر تنفيذ الطلب (' + (code || 'unknown_error') + '). افتح Runtime Logs في Vercel إذا تكررت المشكلة.');
        let text = err?.detail ? base + ' — رمز الدعم: ' + err.detail : base;
        try {
          if (code !== 'unauthorized' && code !== 'network') {
            api('client-errors',{method:'POST',body:{path:'ai',code:code||'unknown',detail:String(err?.detail||'').slice(0,300)}}).catch(()=>{});
            const cfg=await api('ai/config');
            const g=cfg.gemini||[];
            const gTxt = g.length ? (g.some(x=>x.ok) ? 'يعمل' : 'مفتاح مرفوض (' + (g.find(x=>!x.ok)?.kind || 'auth') + ')') : 'غير مضبوط';
            const o=cfg.openrouter||[];
            const oTxt = o.length ? (o.some(x=>x.ok) ? ('يعمل' + (o.find(x=>x.ok)?.chatOk ? ' ✓' : '')) : ('مرفوض (' + (o[0]?.kind || 'auth') + ')')) : 'غير مضبوط';
            text += '\n' + 'حالة المزوّدين — OpenAI: ' + ((cfg.openai||[]).length ? 'مُهيّأ' : 'غير مضبوط') + ' · Gemini: ' + gTxt + ' · OpenRouter: ' + oTxt + ' · البديلان المجانيان: جاهزان';
          }
        } catch { /* diagnostics are best-effort */ }
        patchLast({role:'error',text,retry:prompt,streaming:false});
      }
    }finally{setBusy(false);abortRef.current=null}
  };
  runRef.current=runPrompt;
  const send=(e)=>{e?.preventDefault();const prompt=input.trim();if(!prompt||busy)return;setInput('');runPrompt(prompt)};
  if(booting)return <Splash/>;
  if(pinOpen&&anchorPin)return <div className="nx-ai-pinlock" dir={lang==='ar'?'rtl':'ltr'}>
    <div className="card"><img src="/mascot-avatar.png" alt="NEXORA AI" width={72} height={72}/><h2>NEXORA AI مقفل</h2><p>أدخل رمز PIN للمتابعة</p>
      <input autoFocus value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" dir="ltr" placeholder="••••" onKeyDown={async(e)=>{if(e.key==='Enter'){const h=await pinHash(pinInput);if(h===anchorPin){sessionStorage.setItem('nx_ai_unlocked','1');setPinOpen(false);setPinInput('')}else{toast('رمز غير صحيح');setPinInput('')}}}}/>
      <button onClick={async()=>{const h=await pinHash(pinInput);if(h===anchorPin){sessionStorage.setItem('nx_ai_unlocked','1');setPinOpen(false);setPinInput('')}else{toast('رمز غير صحيح');setPinInput('')}}}>فتح</button>
      <small>NEXORA AI · نسخة Ahmed Becetti</small></div>
    {toastMsg&&<div className="nx-ai-toast">{toastMsg}</div>}
  </div>;
  if(addingAccount)return <AppCtx.Provider value={ctx}><div className="nx-ai-auth"><div className="nx-ai-auth-brand"><Glyph size={45}/><strong>إضافة حساب</strong><p>سجّل الدخول بحساب آخر — تبقى حساباتك محفوظة للتبديل السريع</p></div><AuthFlow onCancel={()=>setAddingAccount(false)}/><button className="nx-ai-wide" onClick={()=>setAddingAccount(false)}>رجوع</button></div></AppCtx.Provider>;
  if(!token||!me)return <AppCtx.Provider value={ctx}><div className="nx-ai-auth"><div className="nx-ai-auth-brand"><Glyph size={45}/><strong>NEXORA <b>AI</b></strong><p>مساحتك للإبداع والمعرفة</p><em className="nx-ai-credit auth">AI BECETTI</em></div><AuthFlow/></div></AppCtx.Provider>;
  const active=TOOLS.find(t=>t.id===mode)||TOOLS[0];
  const welcomePrompts=[
    {label:'اكتب منشورًا جذابًا',mode:'write',text:'اكتب منشورًا جذابًا عن فكرة جديدة لمشاركتها على مواقع التواصل.'},
    {label:'ساعدني في البرمجة',mode:'code',text:'ساعدني في بناء صفحة ويب حديثة مع مثال كود واضح.'},
    {label:'ترجم نصًا',mode:'translate',text:'ترجم النص التالي إلى العربية والفرنسية مع الحفاظ على المعنى: '},
    {label:'ابتكر صورة',mode:'image',text:'مدينة مستقبلية ليلًا، إضاءة بنفسجية وزرقاء، مشهد سينمائي مليء بالتفاصيل.'}
  ];
  return <AppCtx.Provider value={ctx}>
    <div className="nx-ai-shell" dir={lang==='ar'?'rtl':'ltr'}>
      <aside className={'nx-ai-sidebar '+(sidebarOpen?'open':'')}>
        <div className="nx-ai-brand"><Glyph size={38}/><span>NEXORA <b>AI</b><i className="nx-ai-credit">AI BECETTI</i></span></div>
        <button className="nx-ai-new" onClick={newChat}><Icon name="plus"/> محادثة جديدة</button>
        <div className="nx-ai-side-label">مساحة العمل</div>
        <button className={'nx-ai-nav '+(mode==='chat'?'active':'')} onClick={()=>{setMode('chat');setSidebarOpen(false)}}><Icon name="chat"/> المحادثة الذكية</button>
        <button className={'nx-ai-nav '+(mode==='image'?'active':'')} onClick={()=>{setMode('image');setSidebarOpen(false)}}><Icon name="image"/> توليد الصور <small>AI</small></button>
        <div className="nx-ai-side-label">أدوات ذكية</div>
        {TOOLS.slice(2).map(t=><button key={t.id} className={'nx-ai-nav '+(mode===t.id?'active':'')} onClick={()=>{setMode(t.id);setSidebarOpen(false)}}><span className={'nx-ai-nav-icon '+t.color}>{t.icon}</span>{t.title}</button>)}
        <div className="nx-ai-side-label">المحادثات المحفوظة</div>
        <input className="nx-ai-conv-search" value={convQ} onChange={e=>setConvQ(e.target.value)} placeholder="ابحث في المحادثات…" aria-label="بحث في المحادثات"/>
        <div className="nx-ai-conv-list">
          {convs.map(c=><div key={c.id} className={'nx-ai-conv'+(Number(convId)===Number(c.id)?' active':'')}>
            <button type="button" className="nx-ai-conv-open" onClick={()=>openConv(c.id)} title={c.title}>
              <b>{c.title}</b><small>{(c.messages||0)+' رسالة'}</small>
            </button>
            <span className="nx-ai-conv-tools">
              <button type="button" title="إعادة تسمية" onClick={()=>renameConv(c)}>✎</button>
              <button type="button" title="حذف" onClick={()=>deleteConv(c)}>✕</button>
            </span>
          </div>)}
          {!convs.length&&<div className="nx-ai-conv-empty">لا محادثات بعد — ابدأ واحدة وستُحفظ تلقائيًا.</div>}
        </div>
        <div className="nx-ai-spacer"/>
        <button type="button" className="nx-ai-upgrade" onClick={()=>setSheet('credits')}><Icon name="wallet" size={16}/> الرصيد والاشتراك <b>{credits?credits.balance:'—'}</b></button><button type="button" className="nx-ai-upgrade nx-ai-plans-btn" onClick={()=>setSheet('subscribe')}><Icon name="spark" size={16}/> الاشتراكات</button>{(me&&(me.username==='official.nexora'||me.id===12))&&<button type="button" className="nx-ai-upgrade nx-ai-admin-btn" onClick={()=>setSheet('revenue')}>الإيرادات</button>}
        <AdSlot name="sidebar" className="side"/>
        <div className="nx-ai-account"><span className="nx-ai-avatar">{(me.fullName||me.username||'N').slice(0,1).toUpperCase()}</span><span className="nx-ai-account-name"><b>{me.fullName||me.username}</b><small>@{me.username}</small></span>
          <button onClick={()=>setSheet('account')} title="الحساب والأمان"><Icon name="user"/></button>
          <button onClick={logout} title="تسجيل الخروج"><Icon name="logout"/></button></div>
        <div className="nx-ai-version">NEXORA AI · نسخة <b>Ahmed Becetti</b> · v4.1</div>
      </aside>
      {sidebarOpen&&<button className="nx-ai-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="إغلاق القائمة"/>}
      <main className="nx-ai-main">
        <header className="nx-ai-topbar"><button className="nx-ai-mobile-menu" onClick={()=>setSidebarOpen(true)} aria-label="القائمة"><Icon name="menu"/></button><div className="nx-ai-top-title"><i/> مساحة الذكاء الاصطناعي</div><div className="nx-ai-top-actions">
            <button type="button" className="nx-ai-chip" onClick={()=>setSheet('credits')} title="رصيد النقاط"><Icon name="wallet" size={15}/><b>{credits?credits.balance:'—'}</b></button>
            <button type="button" className={'nx-ai-icon-button'+(voiceOut?' on':'')} onClick={()=>{const v=!voiceOut;setVoiceOut(v);localStorage.setItem('nx_ai_tts',v?'1':'0');if(!v&&typeof speechSynthesis!=='undefined')speechSynthesis.cancel()}} title={voiceOut?'إيقاف قراءة الردود':'قراءة الردود صوتيًا'}><Icon name={voiceOut?'speaker':'speakerOff'}/></button>
            <label className="nx-ai-mini" title="أسلوب الرد"><Icon name="tune" size={15}/><select value={style} onChange={e=>{setStyle(e.target.value);localStorage.setItem('nx_ai_style',e.target.value)}} aria-label="أسلوب الرد">
              <option value="auto">تلقائي</option><option value="short">مختصر</option><option value="detailed">مفصّل</option>
              <option value="simple">مبسّط</option><option value="creative">إبداعي</option><option value="formal">رسمي</option><option value="friendly">ودّي</option>
            </select></label>
            <label className="nx-ai-mini" title="اللغة"><Icon name="globe" size={15}/><select value={lang} onChange={e=>setLang(e.target.value)} aria-label="لغة الواجهة">
              <option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option>
              <option value="es">Español</option><option value="tr">Türkçe</option><option value="ru">Русский</option><option value="de">Deutsch</option>
            </select></label>
            <label className="nx-ai-model"><Icon name="spark" size={16}/><select value={model} onChange={e=>setModel(e.target.value)} aria-label="النموذج"><option value="gpt-5-mini">تلقائي · أفضل مزوّد متاح</option><option value="gpt-5.1">GPT-5.1 (OpenAI)</option><option value="gpt-5-nano">GPT-5 nano (OpenAI)</option></select></label><button type="button" className="nx-ai-icon-button" onClick={()=>{const cur=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=cur;localStorage.setItem('nx_theme',cur);setThemeTick(t=>t+1)}} title="الوضع الفاتح/الداكن" aria-label="تبديل السمة">{document.documentElement.dataset.theme==='light'?'☾':'☀'}</button><span className="nx-ai-avatar top-avatar">{(me.fullName||me.username||'N').slice(0,1).toUpperCase()}</span></div></header>
        <section className={'nx-ai-content '+(messages.length?'has-messages':'')}>
          {!messages.length?<div className="nx-ai-welcome">
            <div className="nx-ai-hero-art"><img src="/mascot.png" alt="NEXORA AI" width={176} height={176}/><i className="orb-star one">✦</i><i className="orb-star two">✧</i><i className="orb-star three">✳</i></div>
            <div className="nx-ai-eyebrow"><Icon name="spark" size={14}/> الجيل الجديد من الذكاء الاصطناعي</div>
            <h1>أهلاً بك في <span>NEXORA AI</span></h1><p className="nx-ai-subtitle">ماذا تريد أن تصنع اليوم؟<br/>أفكارك تبدأ من هنا.</p>
            <div className="nx-ai-tools">{TOOLS.map(t=><button key={t.id} className={'nx-ai-tool '+t.color} onClick={()=>{setMode(t.id);field.current?.focus()}}><span className="nx-ai-tool-icon">{t.icon}</span><b>{t.title}</b><small>{t.sub}</small><span className="nx-ai-arrow"><Icon name="chevron" size={15}/></span></button>)}</div>
            <div className="nx-ai-prompt-title">ابدأ بفكرة</div><div className="nx-ai-prompts">{welcomePrompts.map(p=><button key={p.label} onClick={()=>{setMode(p.mode);setInput(p.text);field.current?.focus()}}><span>✧</span>{p.label}<Icon name="chevron" size={14}/></button>)}</div>
            <AdSlot name="home"/>
          </div>:<div className="nx-ai-conversation">
            <div className="nx-ai-conversation-head"><div><span className={'nx-ai-mode-icon '+active.color}>{active.icon}</span><div><b>{active.title}</b><small>{MODEL_NAMES[model]} · محادثة خاصة</small></div></div><button className="nx-ai-icon-button" onClick={newChat} title="محادثة جديدة"><Icon name="plus"/></button></div>
            <AdSlot name="chat" className="chat"/>
            {messages.map((m,i)=><div key={i} className={'nx-ai-message '+(m.role==='user'?'user':m.role==='error'?'error':'assistant')}>{m.role!=='user'&&<span className="nx-ai-message-avatar"><img className="nx-ai-mascot" src="/mascot-avatar.png" alt="NEXORA AI"/></span>}<div className="nx-ai-message-body">{m.role!=='user'&&<b className="nx-ai-message-label">{m.role==='error'?'تنبيه':'NEXORA AI'}{m.role==='model'&&m.provider&&<small className={'nx-ai-provider-badge'+(m.provider==='openai'?' openai':'')}>{m.providerLabel||m.provider}{m.provider!=='openai'?' · بديل':''}</small>}</b>}{m.trace&&<p className="nx-ai-trace" dir="ltr">trace: {m.trace}</p>}{m.text&&(m.role==='user'?<p dir="auto">{m.text}</p>:<Markdown text={m.text}/>)}
              {m.role==='model'&&m.streaming&&<span className="nx-ai-cursor" aria-label="يكتب"/>}
              {m.attachments&&m.attachments.length>0&&<span className="nx-ai-attach-chips">{m.attachments.map((n,ix)=><i key={ix}>📎 {n}</i>)}</span>}
              {m.role==='model'&&m.text&&!m.streaming&&<div className="nx-ai-msg-actions">
                <button type="button" onClick={()=>copyText(m.text)} title="نسخ الإجابة">نسخ</button>
                <button type="button" onClick={()=>{try{speak(m.text)}catch(e){/* لا صوت */}}} title="قراءة بصوت الجهاز (مجاني)">🔊 نطق</button>
                <button type="button" disabled={ttsBusy} onClick={()=>serverTts(m.text)} title="صوت Gemini السحابي الحقيقي (نقطة واحدة)">صوت سحابي</button>
                <button type="button" disabled={busy} onClick={()=>{const lp=lastUserBefore(i);if(lp)runPrompt(lp,{regenerate:true})}} title="إعادة توليد الرد">إعادة توليد</button>
              </div>}
              {m.sources&&m.sources.length>0&&<div className="nx-ai-sources"><b>المصادر ({m.sources.length})</b>{m.sources.map((sc,si)=><a key={si} href={sc.url} target="_blank" rel="noopener noreferrer" className={sc.ok===false?'dead':''}>{si+1}. {sc.title||sc.url}{sc.ok===false?' — تعذر التحقق من الرابط':''}</a>)}</div>}
              {m.stopped&&<span className="nx-ai-stopped">تم إيقاف التوليد — ما ظهر أعلاه هو ما وصل قبل الإيقاف.</span>}{m.role==='error'&&m.retry&&<button type="button" className="nx-ai-retry" disabled={busy} onClick={()=>runPrompt(m.retry)}><Icon name="spark" size={13}/> أعد المحاولة</button>}{m.image&&<img className="nx-ai-generated-image" src={m.image} alt="الصورة المولدة" loading="lazy" onError={e=>{e.currentTarget.alt='تعذر تحميل الصورة من مزود التوليد'}}/>}</div></div>)}
            {busy&&!messages.some(m=>m.streaming)&&<div className="nx-ai-message assistant"><span className="nx-ai-message-avatar"><img className="nx-ai-mascot" src="/mascot-avatar.png" alt="NEXORA AI"/></span><div className="nx-ai-message-body"><b className="nx-ai-message-label">NEXORA AI</b><div className="nx-ai-typing"><i/><i/><i/><span>{mode==='image'?'يجري إنشاء الصورة…':'يفكر الآن…'}</span></div></div></div>}<div ref={bottom}/>
          </div>}
        </section>
        <footer className="nx-ai-composer-wrap"><form className="nx-ai-composer" onSubmit={send}><textarea ref={field} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e)}}} placeholder={mode==='image'?'صف الصورة التي تريد إنشاءها…':'اكتب رسالتك إلى NEXORA AI…'} rows={1} maxLength={4000} dir="auto" aria-label="رسالتك"/>{attach.length>0&&<div className="nx-ai-attach-row">{attach.map(a=><span key={a.id} className={'nx-ai-attach-chip '+(a.kind==='image'?'img':'doc')}>{a.kind==='image'?'🖼️':'📄'} {a.name}<button type="button" onClick={()=>setAttach(x=>x.filter(y=>y.id!==a.id))} aria-label="إزالة">✕</button></span>)}{fileBusy&&<span className="nx-ai-attach-chip loading">جارٍ الرفع…</span>}</div>}
<div className="nx-ai-composer-bottom"><span><Icon name="spark" size={14}/>{recording?'يسجّل الآن… اضغط للإيقاف':voiceBusy?'يفرّغ صوتك…':mode==='image'?'اكتب وصفًا واضحًا للصورة':(searchOn?'بحث الويب مفعّل · سأذكر المصادر':'راجع المعلومات المهمة قبل الاعتماد عليها')}</span>
            <div className="nx-ai-composer-actions">
              <button type="button" className={'nx-ai-icon-button'+(searchOn?' on':'')} onClick={()=>{const v=!searchOn;setSearchOn(v);localStorage.setItem('nx_ai_search',v?'1':'0');if(v)toast('بحث الويب مفعّل — سأبحث فعليًا وأعرض المصادر')}} title="بحث الويب الحقيقي" aria-label="بحث الويب"><Icon name="globe" size={16}/></button>
              <button type="button" className="nx-ai-icon-button" onClick={pickFiles} disabled={fileBusy||attach.length>=3} title="إرفاق صورة أو ملف (مستند يُقرأ فعليًا)" aria-label="إرفاق"><Icon name="plus" size={16}/></button>
              <input ref={fileInput} type="file" multiple accept="image/*,.pdf,.txt,.csv,.md,.doc,.docx" style={{display:'none'}} onChange={onFiles}/>
              <button type="button" className={'nx-ai-mic'+(recording?' rec':'')} onClick={voiceInput} disabled={busy||voiceBusy} aria-label="رسالة صوتية" title="تحدّث وسأكتب وأجيب"><Icon name={recording?'speakerOff':'mic'}/></button>
              {busy?<button type="button" className="nx-ai-stop" onClick={stopGen} aria-label="إيقاف التوليد" title="إيقاف التوليد"><Icon name="speakerOff" size={16}/></button>
                   :<button type="submit" disabled={!input.trim()} aria-label="إرسال"><Icon name="send"/></button>}
            </div></div></form><div className="nx-ai-disclaimer">NEXORA AI · لا تشارك كلمات المرور أو المعلومات الحساسة</div></footer>
        {sheet&&<div className="nx-ai-sheetwrap" onClick={()=>setSheet(null)}>
          <div className="nx-ai-sheet" onClick={e=>e.stopPropagation()}>
            <div className="nx-ai-sheet-head"><b>{sheet==='credits'?'الرصيد والاشتراك':sheet==='subscribe'?'خطط الاشتراك والدفع':sheet==='revenue'?'لوحة الإيرادات (المالك)':'الحساب والأمان'}</b><button onClick={()=>setSheet(null)} aria-label="إغلاق">✕</button></div>
            {sheet==='subscribe'&&<div className="nx-ai-sheet-body"><Subscriptions onClose={()=>setSheet(null)} toast={toast} onBalanceChange={()=>api('me/credits').then(setCredits).catch(()=>{})}/></div>}
            {sheet==='revenue'&&<div className="nx-ai-sheet-body"><AdminRevenue onClose={()=>setSheet(null)} toast={toast}/></div>}
            {sheet==='credits'&&<div className="nx-ai-sheet-body">
              <div className="nx-ai-balance"><span>رصيدك الحالي</span><b>{credits?credits.balance:'—'}</b><small>نقطة · كل رسالة = {(credits&&credits.costs&&credits.costs.chat)||1} · كل صورة = {(credits&&credits.costs&&credits.costs.image)||5} · كل رسالة صوتية = {(credits&&credits.costs&&credits.costs.voice)||2}</small></div>
              <div className="nx-ai-plans">{(plans||[]).map(pl=><button key={pl.id} className="nx-ai-plan" onClick={async()=>{
                  try{ const r=await api('credits/order',{method:'POST',body:{plan:pl.id}});
                    setCredits(c=>({...c,orders:[r.order,...((c&&c.orders)||[])]}));
                    toast('تم إنشاء طلب الشراء ' + r.order.reference);
                  }catch(e){toast(e?.code==='unknown_plan'?'الخطة غير متاحة':('تعذر إنشاء الطلب ('+(e?.code||'خطأ')+')'))}
                }}><b>{pl.label}</b><span>{pl.credits} نقطة</span></button>)}
              </div>
              {credits&&credits.orders&&credits.orders.length>0&&<div className="nx-ai-orders">
                <h4>طلباتك</h4>
                {credits.orders.slice(0,5).map(o=><div key={o.id||o.reference} className="nx-ai-order"><code>{o.reference}</code><span>{o.credits} نقطة</span><i className={'st '+o.status}>{o.status==='pending'?'بانتظار التحقق':o.status==='confirmed'?'مُفعّل':'مرفوض'}</i></div>)}
              </div>}
              <div className="nx-ai-pay">
                <h4>طريقة الدفع</h4>
                {credits&&credits.wallet&&credits.wallet.number
                  ? <p>حوّل المبلغ عبر تطبيق <b>{credits.wallet.app}</b> إلى الرقم <b dir="ltr">{credits.wallet.number}</b> باسم {credits.wallet.holder}، ثم أرسل رمز الطلب إلى <a href={'mailto:'+((credits&&credits.contact)||'')}>{credits&&credits.contact}</a> ليُفعَّل الرصيد.</p>
                  : <p>أنشئ الطلب من الأعلى ثم أرسل <b>رمز الطلب</b> إلى <a href={'mailto:'+((credits&&credits.contact)||'')}>{credits&&credits.contact}</a> وسيُفعَّل رصيدك بعد التحقق. <small>(رقم المحفظة يُضاف من إعدادات الخادم PAYMENT_WALLET_NUMBER لظهوره هنا تلقائيًا.)</small></p>}
                <small className="mut">لا تُخصم أي نقاط عند فشل الردود — الخصم يتم عند نجاح الإجابة فقط.</small>
              </div>
            </div>}
            {sheet==='account'&&<div className="nx-ai-sheet-body">
              <div className="nx-ai-acc-list">
                {(accounts.length?accounts:[me&&{id:me.id,username:me.username,fullName:me.fullName,token:getToken()}]).filter(Boolean).map(a=><button key={a.id} className={'nx-ai-acc'+(a.id===me?.id?' here':'')} onClick={async()=>{
                    if(a.id===me?.id){setSheet(null);return}
                    if(!a.token){toast('أدخل كلمة المرور لهذا الحساب مرة أخرى.');setAddingAccount(true);setSheet(null);return}
                    try{ setToken(a.token); const r=await api('me',{token:a.token}); setTok(a.token); setMe(r.user); localStorage.setItem('nx_me',JSON.stringify(r.user)); toast('تم التبديل إلى @'+r.user.username); setSheet(null) }
                    catch{ dropAccountToken(a.id); setAccounts(getAccounts()); toast('انتهت جلسة هذا الحساب — سجّل الدخول مجددًا.'); setAddingAccount(true); setSheet(null) }
                  }}><span className="nx-ai-avatar sm">{(a.fullName||a.username||'?').slice(0,1).toUpperCase()}</span><span><b>{a.fullName||a.username}</b><small>@{a.username}{a.id===me?.id?' · الحالي':''}</small></span>{a.id===me?.id&&<Icon name="chevron"/>}</button>)}
              </div>
              <button className="nx-ai-wide" onClick={()=>{setAddingAccount(true);setSheet(null)}}><Icon name="plus" size={16}/> إضافة حساب آخر</button>
              <button className="nx-ai-wide" onClick={async()=>{try{await api('me/logout-all',{method:'POST'});toast('تم إنهاء الجلسات على كل الأجهزة')}catch{toast('تعذر تنفيذ الطلب')}}}><Icon name="logout" size={16}/> إنهاء الجلسات على كل الأجهزة</button>
              <div className="nx-ai-pin">
                <h4><Icon name="lock" size={15}/> قفل سريع برمز PIN</h4>
                {anchorPin
                  ? <div className="row"><button className="nx-ai-wide" onClick={()=>{sessionStorage.setItem('nx_ai_unlocked','0');setPinOpen(true)}}>اقفل الآن</button><button className="nx-ai-wide danger" onClick={()=>{localStorage.removeItem('nx_ai_pin');setAnchorPin('')}}>إلغاء الرمز</button></div>
                  : <div className="nx-ai-pin-set"><input value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="رمز من 4–6 أرقام" inputMode="numeric" dir="ltr"/><button onClick={async()=>{ if(pinInput.length<4){toast('الرمز قصير');return} const h=await pinHash(pinInput);localStorage.setItem('nx_ai_pin',h);setAnchorPin(h);setPinInput('');sessionStorage.setItem('nx_ai_unlocked','1');toast('تم تفعيل القفل')}}>تفعيل</button></div>}
                <small className="mut">القفل يحمي التطبيق على هذا الجهاز. حماية الحساب نفسها تأتي من كلمة المرور والجلسة المشفَّرة على الخادم.</small>
              </div>
            </div>}
          </div>
        </div>}
        {toastMsg&&<div className="nx-ai-toast">{toastMsg}</div>}
      </main>
    </div>
  </AppCtx.Provider>;
}
