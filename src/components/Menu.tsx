import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  /** Renders a colour dot instead of an icon (used by the colour picker). */
  swatch?: string;
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  items: MenuItem[];
  label: string;
  className?: string;
  children?: ReactNode;
}

/** A small popover menu: click, arrow keys, Escape, click-away. */
export function Menu({ items, label, className, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 180;
    const height = items.length * 30 + 10;
    setPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - height - 8),
      left: Math.min(rect.left, window.innerWidth - width - 8),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // The menu is absolutely positioned from a measurement, so any viewport
    // change invalidates it — close rather than leave it floating.
    const onViewportChange = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) setActive(0);
  }, [open]);

  // autoFocus only fires on mount, so arrow keys have to move focus themselves.
  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className ?? 'icon-btn icon-btn--sm'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children ?? <Icon name="more" size={15} strokeWidth={2.4} />}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => (i + 1) % items.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => (i - 1 + items.length) % items.length);
              }
            }}
          >
            {items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={index === active ? 0 : -1}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                className={`menu__item${item.danger ? ' menu__item--danger' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.swatch ? (
                  <span className="menu__swatch" style={{ background: item.swatch }} />
                ) : (
                  item.icon && <Icon name={item.icon} size={14} />
                )}
                <span>{item.label}</span>
                {item.hint && <span className="menu__hint">{item.hint}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
