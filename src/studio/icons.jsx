/* Minimal stroke icon set used across the Studio (no icon dependency). */
const S = ({ size = 16, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconSearch = (p) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>;
export const IconSpark = (p) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" /></S>;
export const IconSend = (p) => <S {...p}><path d="M4 12 20 4l-4 16-4-7-8-1Z" /></S>;
export const IconStop = (p) => <S {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></S>;
export const IconFolder = (p) => <S {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></S>;
export const IconChevron = (p) => <S {...p}><path d="m9 6 6 6-6 6" /></S>;
export const IconCode = (p) => <S {...p}><path d="m8 8-4 4 4 4M16 8l4 4-4 4" /></S>;
export const IconEye = (p) => <S {...p}><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></S>;
export const IconTerminal = (p) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3M13 15h4" /></S>;
export const IconRocket = (p) => <S {...p}><path d="M5 15c-1 2-1 4-1 4s2 0 4-1M14 4c3 0 6 3 6 6 0 5-5 9-9 11l-4-4C9 14 14 9 14 4Z" /><circle cx="15" cy="9" r="1.4" /></S>;
export const IconGear = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" /></S>;
export const IconTrash = (p) => <S {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></S>;
export const IconSave = (p) => <S {...p}><path d="M5 3h11l3 3v15H5V3Z" /><path d="M8 3v6h7V3M8 21v-7h8v7" /></S>;
export const IconRefresh = (p) => <S {...p}><path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" /></S>;
export const IconExternal = (p) => <S {...p}><path d="M14 4h6v6M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></S>;
export const IconPlay = (p) => <S {...p}><path d="M7 4l13 8-13 8V4Z" /></S>;
export const IconSquare = (p) => <S {...p}><rect x="5" y="5" width="14" height="14" rx="2" /></S>;
export const IconPlug = (p) => <S {...p}><path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v4" /></S>;
export const IconCheck = (p) => <S {...p}><path d="m4 12 5 5L20 6" /></S>;
export const IconX = (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const IconFile = (p) => <S {...p}><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M13 3v6h6" /></S>;
export const IconMonitor = (p) => <S {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></S>;
export const IconTablet = (p) => <S {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></S>;
export const IconPhone = (p) => <S {...p}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></S>;
export const IconDownload = (p) => <S {...p}><path d="M12 4v10M8 11l4 4 4-4M5 19h14" /></S>;
export const IconGit = (p) => <S {...p}><circle cx="7" cy="6" r="2.5" /><circle cx="7" cy="18" r="2.5" /><circle cx="17" cy="9" r="2.5" /><path d="M7 8.5v7M17 11.5c0 3-3 3-6 3.2" /></S>;
export const IconHistory = (p) => <S {...p}><path d="M4 12a8 8 0 1 1 3 6.2M4 6v5h5" /><path d="M12 8v4l3 2" /></S>;
export const IconCommand = (p) => <S {...p}><path d="M9 3a3 3 0 0 1 3 3v12a3 3 0 1 1-3-3h6a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3H9a3 3 0 1 1 3-3" /></S>;
export const IconLayers = (p) => <S {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></S>;
export const IconWarn = (p) => <S {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v5M12 17h.01" /></S>;
export const IconCopy = (p) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></S>;
export const IconMenu = (p) => <S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>;
export const IconLaptop = IconMonitor;
export const IconPencil = (p) => <S {...p}><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m14 6 4 4" /></S>;

/* Arena-grade agent workspace icons */
export const IconSidebar = (p) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></S>;
export const IconFiles = (p) => <S {...p}><path d="M4 6.5A2 2 0 0 1 6 4.5h4.2l1.8 2H18a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11Z" /><path d="M8 12.5h8M8 15.5h5" /></S>;
export const IconArrowUp = (p) => <S {...p} strokeWidth="2.1"><path d="M12 19V5M6 11l6-6 6 6" /></S>;
export const IconArrowLeft = (p) => <S {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></S>;
export const IconTrophy = (p) => <S {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1M12 14v4M8 20h8" /></S>;
export const IconChat = (p) => <S {...p}><path d="M20 12a7.5 7.5 0 0 1-7.8 7.5 8.6 8.6 0 0 1-3.8-.85L4 20l1.3-3.8A7.5 7.5 0 1 1 20 12Z" /></S>;
export const IconNewChat = (p) => <S {...p}><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /><path d="M18.4 3.6a1.8 1.8 0 0 1 2.5 2.5L13 14l-3.5.9.9-3.5 8-7.8Z" /></S>;
export const IconArchive = (p) => <S {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" /></S>;
export const IconUnarchive = (p) => <S {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M12 16v-5M9.5 13.5 12 11l2.5 2.5" /></S>;
export const IconMore = (p) => <S {...p}><circle cx="5.5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" /></S>;
export const IconUser = (p) => <S {...p}><circle cx="12" cy="8.2" r="3.4" /><path d="M5 19.5a7 7 0 0 1 14 0" /></S>;
export const IconDiff = (p) => <S {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M9 9.5h6M12 6.5v6M9 16.5h6" /></S>;
export const IconShieldCheck = (p) => <S {...p}><path d="M12 3 5 6v5.5c0 4.6 3 7.9 7 9.5 4-1.6 7-4.9 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></S>;
export const IconImage = (p) => <S {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="9.5" r="1.4" /><path d="m20.5 15.5-4.8-4.5L7 19.5" /></S>;
export const IconPaperclip = (p) => <S {...p}><path d="m15.5 7.5-6.8 6.8a2.1 2.1 0 1 0 3 3l7.3-7.3a4.2 4.2 0 1 0-6-6L5.5 11.5a6.3 6.3 0 0 0 8.9 8.9l5.6-5.6" /></S>;
export const IconDoc = (p) => <S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M8.5 12h7M8.5 15.5h5" /></S>;
export const IconDrive = (p) => <S {...p}><path d="M9 4h6l6 10.5-3 5.5H6L3 14.5 9 4Z" /><path d="M3 14.5h18M9 4l6 10.5M15 4 9 14.5" /></S>;
export const IconGitHub = ({ size = 16, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);
export const IconVercel = ({ size = 14, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M12 4 22 20H2L12 4Z" />
  </svg>
);
export const IconThumbUp = (p) => <S {...p}><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 3 2v4h4.5a2 2 0 0 1 2 2.4l-1.1 6A2 2 0 0 1 17.4 20H7" /></S>;
export const IconThumbDown = (p) => <S {...p}><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-3-2v-4H5.5a2 2 0 0 1-2-2.4l1.1-6A2 2 0 0 1 6.6 4H17" /></S>;
export const IconSun = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></S>;
export const IconMoon = (p) => <S {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></S>;
export const IconChevronDown = (p) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const IconSliders = (p) => <S {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></S>;
export const IconLogout = (p) => <S {...p}><path d="M10 17l5-5-5-5M15 12H3M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /></S>;

/* Independent NEXORA architectural brand emblem */
export const NexoraLogo = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
    <rect x="2" y="2" width="24" height="24" rx="7" fill="currentColor" />
    <path
      d="M8.5 19.5V8.5L19.5 19.5V8.5"
      stroke="var(--nxs-logo-fg, #faf9f5)"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="19.5" cy="8.5" r="1.6" fill="var(--nxs-logo-dot, #d97745)" />
  </svg>
);
