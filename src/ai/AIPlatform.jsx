import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Glyph, Splash } from '../components.jsx';
import AuthFlow from '../screens/Auth.jsx';
import { api, getToken, setToken, onUnauthorized, upsertAccount } from '../api.js';
import { getLang, setLang as saveLang } from '../i18n.js';
import './AIPlatform.css';

const TOOLS = [
  { id:'chat', title:'المحادثة الذكية', sub:'اسأل واستكشف الأفكار', icon:'✦', color:'violet' },
  { id:'image', title:'توليد الصور', sub:'حوّل وصفك إلى صورة', icon:'▧', color:'purple' },
  { id:'write', title:'الكتابة والإبداع', sub:'مقالات ومنشورات', icon:'✎', color:'pink' },
  { id:'code', title:'مساعد البرمجة', sub:'اكتب وحسّن الأكواد', icon:'⌘', color:'blue' },
  { id:'translate', title:'الترجمة', sub:'ترجمة طبيعية دقيقة', icon:'文', color:'cyan' },
  { id:'summarize', title:'تلخيص النصوص', sub:'استخرج أهم النقاط', icon:'≡', color:'orange' }
];
const MODEL_NAMES = {'gemini-2.5-flash':'Gemini 2.5 Flash','gemini-2.5-pro':'Gemini 2.5 Pro'};
const keyFor = (id) => 'nx_ai_chat_' + id;

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
    chevron:<path d="m9 18 6-6-6-6"/>
  };
  return <svg {...props}>{shapes[name]||shapes.spark}</svg>;
}

export default function AIPlatform() {
  const [token,setTok]=useState(getToken());
  const [me,setMe]=useState(()=>{try{return JSON.parse(localStorage.getItem('nx_me')||'null')}catch{return null}});
  const [lang,setLangState]=useState(getLang());
  const [booting,setBooting]=useState(!!getToken()&&!localStorage.getItem('nx_me'));
  const [mode,setMode]=useState('chat');
  const [model,setModel]=useState('gemini-2.5-flash');
  const [messages,setMessages]=useState([]);
  const [historyOwner,setHistoryOwner]=useState(null);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const bottom=useRef(null);
  const field=useRef(null);
  const [toastMsg,setToastMsg]=useState('');
  const toast=useCallback((msg)=>{setToastMsg(msg);window.setTimeout(()=>setToastMsg(''),2800)},[]);
  const updateMe=useCallback((u)=>{setMe(u);localStorage.setItem('nx_me',JSON.stringify(u));upsertAccount(u)},[]);
  const login=useCallback((tk,u)=>{setToken(tk);setTok(tk);setMe(u);localStorage.setItem('nx_me',JSON.stringify(u));upsertAccount(u,tk)},[]);
  const logout=useCallback(()=>{if(me)upsertAccount(me,getToken());setToken(null);setTok(null);setMe(null);localStorage.removeItem('nx_me');setMessages([])},[me]);
  const setLang=useCallback(async(l)=>{await saveLang(l);setLangState(l)},[]);
  const ctx=useMemo(()=>({me,updateMe,login,logout,switchAccount:login,addAccount:()=>{},nav:{push:()=>{},pop:()=>{},replace:()=>{},reset:()=>{},tab:()=>{},profile:()=>{}},toast,lang,setLang,badges:{},refreshBadges:()=>{},setBadges:()=>{},tab:'ai',refreshKey:0}),[me,updateMe,login,logout,toast,lang,setLang]);

  useEffect(()=>onUnauthorized(()=>{setToken(null);setTok(null);setMe(null);localStorage.removeItem('nx_me');setMessages([]);toast('انتهت الجلسة، سجّل الدخول مجددًا.') }),[toast]);
  useEffect(()=>{
    if(!token){setBooting(false);return}
    let live=true;
    api('me').then(r=>{if(live){updateMe(r.user);setBooting(false)}}).catch(()=>{if(live)setBooting(false)});
    return()=>{live=false};
  },[token,updateMe]);
  useEffect(()=>{if(!me?.id){setHistoryOwner(null);setMessages([]);return}let saved=[];try{saved=JSON.parse(localStorage.getItem(keyFor(me.id))||'[]')}catch{saved=[]}setMessages(saved);setHistoryOwner(me.id)},[me?.id]);
  useEffect(()=>{if(me?.id&&historyOwner===me.id)localStorage.setItem(keyFor(me.id),JSON.stringify(messages.slice(-80)));bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,me?.id,historyOwner,busy]);
  const newChat=()=>{setMessages([]);setInput('');setMode('chat');setSidebarOpen(false);field.current?.focus()};
  const send=async(e)=> {
    e?.preventDefault();
    const prompt=input.trim();if(!prompt||busy)return;
    setMessages(old=>[...old,{role:'user',text:prompt}]);setInput('');setBusy(true);
    try {
      if(mode==='image'){
        const r=await api('ai/image',{method:'POST',body:{prompt}});
        setMessages(old=>[...old,{role:'model',text:'تم إرسال طلب الصورة إلى مزوّد التوليد.',image:r.url}]);
      }else{
        const history=messages.filter(m=>['user','model'].includes(m.role)&&m.text).slice(-10).map(m=>({role:m.role,text:m.text}));
        const r=await api('ai/chat',{method:'POST',body:{message:prompt,history,model,mode}});
        setMessages(old=>[...old,{role:'model',text:r.answer,model:r.model}]);
      }
    }catch(err){
      const code=err?.code;
      const text=code==='ai_not_configured'?'المساعد غير مفعّل بعد. أضف GEMINI_API_KEY في متغيرات بيئة Vercel.':code==='rate_limited'?'وصلت إلى حد الاستخدام المؤقت؛ حاول بعد دقيقة.':'تعذّر تنفيذ الطلب. تحقق من إعدادات الخدمة وحاول مجددًا.';
      setMessages(old=>[...old,{role:'error',text}]);
    }finally{setBusy(false)}
  };
  if(booting)return <Splash/>;
  if(!token||!me)return <AppCtx.Provider value={ctx}><div className="nx-ai-auth"><div className="nx-ai-auth-brand"><Glyph size={45}/><strong>NEXORA <b>AI</b></strong><p>مساحتك للإبداع والمعرفة</p></div><AuthFlow/></div></AppCtx.Provider>;
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
        <div className="nx-ai-brand"><Glyph size={38}/><span>NEXORA <b>AI</b></span></div>
        <button className="nx-ai-new" onClick={newChat}><Icon name="plus"/> محادثة جديدة</button>
        <div className="nx-ai-side-label">مساحة العمل</div>
        <button className={'nx-ai-nav '+(mode==='chat'?'active':'')} onClick={()=>{setMode('chat');setSidebarOpen(false)}}><Icon name="chat"/> المحادثة الذكية</button>
        <button className={'nx-ai-nav '+(mode==='image'?'active':'')} onClick={()=>{setMode('image');setSidebarOpen(false)}}><Icon name="image"/> توليد الصور <small>AI</small></button>
        <div className="nx-ai-side-label">أدوات ذكية</div>
        {TOOLS.slice(2).map(t=><button key={t.id} className={'nx-ai-nav '+(mode===t.id?'active':'')} onClick={()=>{setMode(t.id);setSidebarOpen(false)}}><span className={'nx-ai-nav-icon '+t.color}>{t.icon}</span>{t.title}</button>)}
        <div className="nx-ai-spacer"/>
        <div className="nx-ai-account"><span className="nx-ai-avatar">{(me.fullName||me.username||'N').slice(0,1).toUpperCase()}</span><span className="nx-ai-account-name"><b>{me.fullName||me.username}</b><small>@{me.username}</small></span><button onClick={logout} title="تسجيل الخروج"><Icon name="logout"/></button></div>
      </aside>
      {sidebarOpen&&<button className="nx-ai-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="إغلاق القائمة"/>}
      <main className="nx-ai-main">
        <header className="nx-ai-topbar"><button className="nx-ai-mobile-menu" onClick={()=>setSidebarOpen(true)} aria-label="القائمة"><Icon name="menu"/></button><div className="nx-ai-top-title"><i/> مساحة الذكاء الاصطناعي</div><div className="nx-ai-top-actions"><label className="nx-ai-model"><Icon name="spark" size={16}/><select value={model} onChange={e=>setModel(e.target.value)} aria-label="النموذج"><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-pro">Gemini 2.5 Pro</option></select></label><span className="nx-ai-avatar top-avatar">{(me.fullName||me.username||'N').slice(0,1).toUpperCase()}</span></div></header>
        <section className={'nx-ai-content '+(messages.length?'has-messages':'')}>
          {!messages.length?<div className="nx-ai-welcome">
            <div className="nx-ai-orb-wrap"><div className="nx-ai-orb"><span/></div><i className="orb-star one">✦</i><i className="orb-star two">✧</i><i className="orb-star three">✳</i></div>
            <div className="nx-ai-eyebrow"><Icon name="spark" size={14}/> الجيل الجديد من الذكاء الاصطناعي</div>
            <h1>أهلاً بك في <span>NEXORA AI</span></h1><p className="nx-ai-subtitle">ماذا تريد أن تصنع اليوم؟<br/>أفكارك تبدأ من هنا.</p>
            <div className="nx-ai-tools">{TOOLS.map(t=><button key={t.id} className={'nx-ai-tool '+t.color} onClick={()=>{setMode(t.id);field.current?.focus()}}><span className="nx-ai-tool-icon">{t.icon}</span><b>{t.title}</b><small>{t.sub}</small><span className="nx-ai-arrow"><Icon name="chevron" size={15}/></span></button>)}</div>
            <div className="nx-ai-prompt-title">ابدأ بفكرة</div><div className="nx-ai-prompts">{welcomePrompts.map(p=><button key={p.label} onClick={()=>{setMode(p.mode);setInput(p.text);field.current?.focus()}}><span>✧</span>{p.label}<Icon name="chevron" size={14}/></button>)}</div>
          </div>:<div className="nx-ai-conversation">
            <div className="nx-ai-conversation-head"><div><span className={'nx-ai-mode-icon '+active.color}>{active.icon}</span><div><b>{active.title}</b><small>{MODEL_NAMES[model]} · محادثة خاصة</small></div></div><button className="nx-ai-icon-button" onClick={newChat} title="محادثة جديدة"><Icon name="plus"/></button></div>
            {messages.map((m,i)=><div key={i} className={'nx-ai-message '+(m.role==='user'?'user':m.role==='error'?'error':'assistant')}>{m.role!=='user'&&<span className="nx-ai-message-avatar"><Glyph size={24}/></span>}<div className="nx-ai-message-body">{m.role!=='user'&&<b className="nx-ai-message-label">{m.role==='error'?'تنبيه':'NEXORA AI'}</b>}{m.text&&<p dir="auto">{m.text}</p>}{m.image&&<img className="nx-ai-generated-image" src={m.image} alt="الصورة المولدة" loading="lazy" onError={e=>{e.currentTarget.alt='تعذر تحميل الصورة من مزود التوليد'}}/>}</div></div>)}
            {busy&&<div className="nx-ai-message assistant"><span className="nx-ai-message-avatar"><Glyph size={24}/></span><div className="nx-ai-message-body"><b className="nx-ai-message-label">NEXORA AI</b><div className="nx-ai-typing"><i/><i/><i/><span>{mode==='image'?'يجري إنشاء الصورة…':'يفكر الآن…'}</span></div></div></div>}<div ref={bottom}/>
          </div>}
        </section>
        <footer className="nx-ai-composer-wrap"><form className="nx-ai-composer" onSubmit={send}><textarea ref={field} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e)}}} placeholder={mode==='image'?'صف الصورة التي تريد إنشاءها…':'اكتب رسالتك إلى NEXORA AI…'} rows={1} maxLength={4000} dir="auto" aria-label="رسالتك"/><div className="nx-ai-composer-bottom"><span><Icon name="spark" size={14}/>{mode==='image'?'اكتب وصفًا واضحًا للصورة':'راجع المعلومات المهمة قبل الاعتماد عليها'}</span><button type="submit" disabled={!input.trim()||busy} aria-label="إرسال"><Icon name="send"/></button></div></form><div className="nx-ai-disclaimer">NEXORA AI · لا تشارك كلمات المرور أو المعلومات الحساسة</div></footer>
        {toastMsg&&<div className="nx-ai-toast">{toastMsg}</div>}
      </main>
    </div>
  </AppCtx.Provider>;
}
