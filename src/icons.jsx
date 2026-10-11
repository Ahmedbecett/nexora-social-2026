const S = ({ children, size = 24, fill = 'none', stroke = 'currentColor', sw = 2, className, style, vb = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={vb} fill={fill} stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{children}</svg>
);

export const IHome = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor" stroke="currentColor"><path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1z" /></S>
  : <S {...p}><path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1z" /></S>;
export const ISearch = ({ active, ...p }) => <S {...p} sw={active ? 2.8 : 2}><circle cx="10.8" cy="10.8" r="7.3" /><path d="m16.3 16.3 4.7 4.7" /></S>;
export const IPlusSquare = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></S>;
export const IReels = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor" stroke="none"><path d="M7 2h10a5 5 0 0 1 5 5v1H2V7a5 5 0 0 1 5-5Zm-.4 1.6L9 7.2h2.3L8.9 3.6Zm5 0L14 7.2h2.3l-2.4-3.6ZM2 9.5h20V17a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5Zm7.6 3v6.2l5.5-3.1Z" fillRule="evenodd" /></S>
  : <S {...p}><rect x="2.5" y="2.5" width="19" height="19" rx="5" /><path d="M2.5 8h19M8.5 2.6 11 8M14 2.6 16.5 8" /><path d="M10 12v6l5-3z" /></S>;
export const IUser = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor"><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c.8-4.2 4.2-6.5 8.2-6.5s7.4 2.3 8.2 6.5z" /></S>
  : <S {...p}><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c.8-4.2 4.2-6.5 8.2-6.5s7.4 2.3 8.2 6.5" /></S>;
export const IHeart = ({ filled, ...p }) => (
  <S {...p} fill={filled ? '#ff3040' : 'none'} stroke={filled ? '#ff3040' : 'currentColor'}>
    <path d="M12 20.5s-8.5-5-8.5-11.1A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.5 2.8c0 6.1-8.5 11.1-8.5 11.1Z" />
  </S>
);
export const IComment = (p) => <S {...p}><path d="M20.7 16.2A9 9 0 1 0 17 19.9l4 1.1z" /></S>;
export const ISend = (p) => <S {...p}><path d="M21.5 3 10.2 13.8M21.5 3 15 21l-4.8-7.2L3 9.6z" /></S>;
export const IBookmark = ({ filled, ...p }) => <S {...p} fill={filled ? 'currentColor' : 'none'}><path d="M19 21 12 15.6 5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z" /></S>;
export const IMoreV = (p) => <S {...p} fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></S>;
export const IMoreH = (p) => <S {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></S>;
export const IBack = (p) => <S {...p} className={'flip ' + (p.className || '')}><path d="M15 4 7 12l8 8" /></S>;
export const IChevron = (p) => <S {...p} className={'flip ' + (p.className || '')}><path d="m9 5 7 7-7 7" /></S>;
export const IDown = (p) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const IClose = (p) => <S {...p}><path d="M5 5l14 14M19 5 5 19" /></S>;
export const IMenu = (p) => <S {...p}><path d="M3.5 6h17M3.5 12h17M3.5 18h17" /></S>;
export const IGrid = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></S>;
export const ITag = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="12" cy="10" r="3" /><path d="M6.5 21c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6" /></S>;
export const ICamera = (p) => <S {...p}><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.5-2h6.4l1.5 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><circle cx="12" cy="12.8" r="3.8" /></S>;
export const IEye = (p) => <S {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></S>;
export const IEyeOff = (p) => <S {...p}><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.4 6.5C3.6 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.3-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></S>;
export const ILocation = (p) => <S {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></S>;
export const IMusic = (p) => <S {...p}><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></S>;
export const IUserPlus = (p) => <S {...p}><circle cx="9.5" cy="8" r="4" /><path d="M2.5 20.5c.7-3.8 3.6-5.8 7-5.8s6.3 2 7 5.8M19 8v6M16 11h6" /></S>;
export const IBell = (p) => <S {...p}><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></S>;
export const ILock = (p) => <S {...p}><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></S>;
export const IShield = (p) => <S {...p}><path d="M12 3 4.5 6v5.5c0 4.8 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.7 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></S>;
export const IAccount = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.6 18.4c1.2-2.1 3-3.2 5.4-3.2s4.2 1.1 5.4 3.2" /></S>;
export const IHelp = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" /></S>;
export const IInfo = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></S>;
export const ILogout = (p) => <S {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h11" /></S>;
export const IGlobe = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></S>;
export const IArchive = (p) => <S {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></S>;
export const IVolume = ({ muted, ...p }) => <S {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{muted ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}</S>;
export const IPlay = (p) => <S {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z" /></S>;
export const IImage = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></S>;
export const IEdit = (p) => <S {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></S>;
export const ITrash = (p) => <S {...p}><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3" /></S>;
export const ILink = (p) => <S {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></S>;
export const IFlag = (p) => <S {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></S>;
export const IPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const ICheck = (p) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const IVerified = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-label="verified" style={{ flex: 'none' }}>
    <path fill="#0095f6" d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.6 2.9 1.3 2.7-2.1 2.1-.2 3-2.9.6-1.7 2.5-2.8-1-2.8 1-1.7-2.5-2.9-.6-.2-3-2.1-2.1 1.3-2.7-.6-2.9L5.6 6l1-2.8 3 .2z" />
    <path d="m8 12.3 2.6 2.6L16.2 9.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IFacebook = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path fill="#fff" d="M15.1 12.8h-2.2V20h-3v-7.2H8.3v-2.6h1.6V8.6c0-2.2 1-3.6 3.6-3.6h2v2.6h-1.3c-1 0-1.3.4-1.3 1.2v1.4h2.6z" />
  </svg>
);
