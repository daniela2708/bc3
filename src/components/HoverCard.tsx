import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const HALF_WIDTH = 170;

/**
 * Tooltip with rich content for a cell inside a scrolling table or a grid: fixed position on top of the page, so the
 * table's scroll box never cuts it. Opens on hover and on keyboard focus, closes on leave, blur or Esc. `label` is
 * what a screen reader says for the trigger (it should include the tooltip's content as text).
 */
export function HoverCard({ children, content, label, className }: { children: ReactNode; content: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.top < 240;
    const x = Math.min(Math.max(r.left + r.width / 2, HALF_WIDTH + 8), window.innerWidth - HALF_WIDTH - 8);
    setPos({ x, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const hide = () => setPos(null);
  return (
    <span
      ref={ref}
      className={`hovercard-trigger${className ? ` ${className}` : ''}`}
      tabIndex={0}
      role="img"
      aria-label={label}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide();
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div id={id} role="tooltip" className={`hovercard${pos.below ? ' below' : ''}`} style={{ left: pos.x, top: pos.y }}>
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
