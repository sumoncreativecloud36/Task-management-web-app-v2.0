export type IconName =
  | 'dashboard'
  | 'tasks'
  | 'today'
  | 'week'
  | 'calendar'
  | 'analytics'
  | 'trash'
  | 'settings'
  | 'search'
  | 'bell'
  | 'plus'
  | 'left'
  | 'right'
  | 'down'
  | 'more'
  | 'check'
  | 'close'
  | 'edit'
  | 'copy'
  | 'grip'
  | 'clock'
  | 'flag'
  | 'tag'
  | 'note'
  | 'repeat'
  | 'back'
  | 'inbox'
  | 'alert'
  | 'restore'
  | 'logout'
  | 'download'
  | 'upload'
  | 'flame'
  | 'logo'
  | 'cloud'
  | 'sun'
  | 'moon'
  | 'folder'
  | 'notes'
  | 'pin'
  | 'highlight'
  | 'listBullet'
  | 'listNumber'
  | 'checklist'
  | 'quote'
  | 'link'
  | 'eraser'
  | 'undo'
  | 'redo';

const PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  tasks: 'M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z',
  today: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M9 14l2 2 4-4',
  week: 'M3 5h18v14H3zM3 10h18M9 10v9M15 10v9',
  calendar: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.2a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  bell: 'M18 9a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 01-3.4 0',
  plus: 'M12 5v14M5 12h14',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  more: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  check: 'M4.5 12.5l5 5 10-11',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4l10.5-10.5a2.8 2.8 0 10-4-4L4 16v4zM13.5 6.5l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  flag: 'M5 21V4M5 5h11l-2 4 2 4H5',
  tag: 'M3 12l9-9 9 9-9 9-9-9zM8.5 8.5h.01',
  note: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',
  repeat: 'M4 9a5 5 0 015-5h11M20 15a5 5 0 01-5 5H4M17 1l3 3-3 3M7 17l-3 3 3 3',
  back: 'M20 12H4M10 6l-6 6 6 6',
  inbox: 'M3 13h5l1 3h6l1-3h5M3 13l3-8h12l3 8v6H3z',
  alert: 'M12 3l10 18H2L12 3zM12 9v5M12 18h.01',
  restore: 'M4 12a8 8 0 108-8 8 8 0 00-5.7 2.3L4 8.5M4 4v5h5',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 8l5-5 5 5M4 20h16',
  flame: 'M12 22c4 0 6-2.7 6-6 0-4.5-6-11-6-11S6 11.5 6 16c0 3.3 2 6 6 6zM12 18a2.4 2.4 0 002.5-2.5c0-1.8-2.5-4.5-2.5-4.5s-2.5 2.7-2.5 4.5A2.4 2.4 0 0012 18z',
  logo: 'M4 7h11M4 12h7M4 17h11M15 12.5l2 2 4-4.5',
  cloud: 'M6.5 19a4.5 4.5 0 01-.5-9 6 6 0 0111.5 1.5A3.8 3.8 0 0117 19z',
  sun: 'M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  folder: 'M3 6h6l2 2.5h10V19H3z',
  notes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
  pin: 'M9 4h6l-1 5 3 3H7l3-3-1-5zM12 12v8',
  highlight: 'M4 20h7M14.5 4.5l5 5L11 18H6v-5l8.5-8.5z',
  listBullet: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  listNumber: 'M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5a1.5 1.5 0 013 .5L4 19h3',
  checklist: 'M11 6h9M11 12h9M11 18h9M3.5 5.5l1.5 1.5 3-3M3.5 11.5l1.5 1.5 3-3M4 17h4v3H4z',
  quote: 'M5 18c2-1 3-3 3-6H4V6h6v6c0 4-2 6.5-5 7.5M15 18c2-1 3-3 3-6h-4V6h6v6c0 4-2 6.5-5 7.5',
  link: 'M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1',
  eraser: 'M8 20h12M5.5 14.5L14 6l5 5-8.5 8.5H8l-2.5-2.5a1.5 1.5 0 010-2.5zM10 10l5 5',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
};

export function Icon({
  name,
  size = 15,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
