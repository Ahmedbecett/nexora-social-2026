const S = ({ children, size = 24, fill = 'none', stroke = 'currentColor', sw = 2, className, style, vb = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={vb} fill={fill} stroke={stroke} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{children}</svg>
);

export const IHome = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor" stroke="none"><path d="M22 23h-6.001a1 1 0 0 1-1-1v-5.455a2.997 2.997 0 1 0-5.993 0V22a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V11.543a1.002 1.002 0 0 1 .31-.724l10-9.543a1.001 1.001 0 0 1 1.38 0l10 9.543a1.002 1.002 0 0 1 .31.724V22a1 1 0 0 1-1 1Z" /></S>
  : <S {...p}><path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z" /></S>;
export const ISearch = ({ active, ...p }) => <S {...p} sw={active ? 3 : 2}><path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" /><path d="M16.511 16.511 22 22" /></S>;
export const IPlusSquare = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></S>;
export const IReels = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor" stroke="none"><path fillRule="evenodd" d="M8.2 1.5h7.6c3.7 0 6.7 3 6.7 6.7v7.6c0 3.7-3 6.7-6.7 6.7H8.2c-3.7 0-6.7-3-6.7-6.7V8.2c0-3.7 3-6.7 6.7-6.7Zm1.6 6.3v8.4c0 .8.9 1.3 1.6.9l6.6-4.2c.6-.4.6-1.4 0-1.8l-6.6-4.2c-.7-.4-1.6.1-1.6.9Z" /></S>
  : <S {...p}><rect x="2.5" y="2.5" width="19" height="19" rx="6" /><path d="M10 8.7v6.6a.7.7 0 0 0 1.07.6l5.2-3.3a.7.7 0 0 0 0-1.2l-5.2-3.3a.7.7 0 0 0-1.07.6Z" /></S>;
export const IUser = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor"><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c.8-4.2 4.2-6.5 8.2-6.5s7.4 2.3 8.2 6.5z" /></S>
  : <S {...p}><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21c.8-4.2 4.2-6.5 8.2-6.5s7.4 2.3 8.2 6.5" /></S>;
export const IHeart = ({ filled, ...p }) => filled
  ? <S {...p} fill="#ff3040" stroke="#ff3040" sw={1.6}><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938Z" /></S>
  : <S {...p} fill="currentColor" stroke="none"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" /></S>;
export const IComment = (p) => <S {...p}><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" /></S>;
export const ISend = ({ active, ...p }) => active
  ? <S {...p} fill="currentColor"><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" /><path d="M7.488 12.208 15.515 7.641" stroke="var(--bg, #000)" /></S>
  : <S {...p}><path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" /><path d="M7.488 12.208 15.515 7.641" /></S>;
export const IBookmark = ({ filled, ...p }) => <S {...p} fill={filled ? 'currentColor' : 'none'}><path d="M20 21 12 13.44 4 21V3h16Z" /></S>;
export const IMoreV = (p) => <S {...p} fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></S>;
export const IMoreH = (p) => <S {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></S>;
export const IBack = (p) => <S {...p} className={'flip ' + (p.className || '')}><path d="M15 4 7 12l8 8" /></S>;
export const IChevron = (p) => <S {...p} className={'flip ' + (p.className || '')}><path d="m9 5 7 7-7 7" /></S>;
export const IDown = (p) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const IClose = (p) => <S {...p}><path d="M5 5l14 14M19 5 5 19" /></S>;
export const IMenu = (p) => <S {...p}><path d="M3 4h18M3 12h18M3 20h18" /></S>;
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
export const IActivity = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 13h4l2-4 3 7 2.5-5L16 13h5" /></S>;
export const IClock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></S>;
export const IStar = ({ filled, ...p }) => <S {...p} fill={filled ? 'currentColor' : 'none'}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></S>;
export const IStarCircle = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="m12 7.2 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="currentColor" strokeWidth="1" /></S>;
export const IPaperPlane = (p) => <S {...p}><path d="M3 4.5 21 3l-7.5 18-3-7.5z" /><path d="m10.5 13.5 4-4" /></S>;
export const IAt = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></S>;
export const IRepeat = (p) => <S {...p}><path d="M17 2.5 20.5 6 17 9.5" /><path d="M4 11.5V10a4 4 0 0 1 4-4h12.5M7 21.5 3.5 18 7 14.5" /><path d="M20 12.5V14a4 4 0 0 1-4 4H3.5" /></S>;
export const IRestrict = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M7 18c1.2-2 3-3 5-3M4.5 4.5l15 15" /></S>;
export const ILimit = (p) => <S {...p}><path d="M20.7 16.2A9 9 0 1 0 17 19.9l4 1.1z" /><path d="M12 7.5v5M12 16v.01" /></S>;
export const IAa = (p) => <S {...p} sw={1.8}><path d="M2.5 19 8 5l5.5 14M4.5 14h7" /><path d="M21.5 19v-5.5a3 3 0 0 0-5.5-1.5M21.5 15.5c-1.5-.6-6-.8-6 1.8 0 2.5 4.5 2.3 6-.3" /></S>;
export const IBellOff = (p) => <S {...p}><path d="M8.7 4.1A6 6 0 0 1 18 9c0 3.4.8 5.4 1.5 6.5M6.1 7A6 6 0 0 0 6 9c0 6-2.5 7.5-2.5 7.5H16.5" /><path d="M10 20a2.2 2.2 0 0 0 4 0M3 3l18 18" /></S>;
export const ILifebuoy = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6" /></S>;
export const IShieldStar = (p) => <S {...p}><path d="M12 3 4.5 6v5.5c0 4.8 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.7 7.5-9.5V6z" /><path d="m12 8 1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="currentColor" strokeWidth="1" /></S>;
export const IPerson = (p) => <S {...p}><circle cx="12" cy="7.5" r="4" /><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5" /></S>;
export const IUsers = (p) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.5 3 5.2" /></S>;
export const IKey = (p) => <S {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2" /></S>;
export const IPhone = (p) => <S {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18.5h2" /></S>;
export const IMail = (p) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></S>;
export const IBlock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></S>;
export const ICheckCircle = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.2 9.6" /></S>;
export const IDoc = (p) => <S {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></S>;
export const IGoogle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
export const IMoon = (p) => <S {...p}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" /></S>;
export const ISun = (p) => <S {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></S>;
export const IMoreLines = (p) => <S {...p}><path d="M5 9h14M8 15h11" /></S>;
export const IPrefs = (p) => <S {...p} sw={1.8}><path d="M3 7h5.5M15.5 7H21M3 17h10M18 17h3" /><path d="M12 10.2s-3.2-1.9-3.2-4.1a1.7 1.7 0 0 1 3.2-.9 1.7 1.7 0 0 1 3.2.9c0 2.2-3.2 4.1-3.2 4.1Z" /><circle cx="15.5" cy="17" r="2.3" /></S>;
export const ITagged = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="4.5" /><circle cx="12" cy="10" r="3.2" /><path d="M6.5 20.5c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" /></S>;
export const IRepost = (p) => <S {...p}><path d="M19.5 12v1.5a4 4 0 0 1-4 4H5.5" /><path d="m8.5 20.5-3-3 3-3" /><path d="M4.5 12v-1.5a4 4 0 0 1 4-4h10" /><path d="m15.5 3.5 3 3-3 3" /></S>;
export const IGrid9 = (p) => <S {...p} fill="currentColor" stroke="none"><rect x="3" y="3" width="5" height="5" rx="1.2" /><rect x="9.5" y="3" width="5" height="5" rx="1.2" /><rect x="16" y="3" width="5" height="5" rx="1.2" /><rect x="3" y="9.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" /><rect x="16" y="9.5" width="5" height="5" rx="1.2" /><rect x="3" y="16" width="5" height="5" rx="1.2" /><rect x="9.5" y="16" width="5" height="5" rx="1.2" /><rect x="16" y="16" width="5" height="5" rx="1.2" /></S>;
export const IWhatsApp = (p) => <S {...p} sw={1.8}><path d="M3.5 20.5 4.8 16A8.5 8.5 0 1 1 8 19.3Z" /><path d="M9 8.5c0 3.3 3.2 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2Z" fill="currentColor" sw={1} /></S>;
export const IFacebook = (p) => <S {...p} sw={1.8}><circle cx="12" cy="12" r="9.5" /><path d="M13 21.4V13.5h2.6l.4-3H13V8.8c0-.9.3-1.5 1.5-1.5H16V4.7a19 19 0 0 0-2.3-.1c-2.2 0-3.7 1.4-3.7 3.9v2h-2.5v3H10v7.9" /></S>;
