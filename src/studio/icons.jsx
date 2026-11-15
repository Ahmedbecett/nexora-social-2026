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
