import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type TermId } from '../lib/glossary';

/**
 * A key term with a plain-language explanation (src/lib/glossary.ts). Dotted underline, not a link. Opens on hover,
 * keyboard focus or click; closes on Esc, a click outside, or when the pointer / focus leaves (unless opened by a
 * click). Screen readers get the explanation as the term's description. Use it once per view, on the first
 * appearance of the term (layout rule).
 */
export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const entry = GLOSSARY[id];
  const popId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className={`term${open ? ' is-open' : ''}`}
      data-term={id}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-describedby={popId}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => !pinned && setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPinned((p) => !p);
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setPinned((p) => !p);
          setOpen(true);
        }
      }}
    >
      {children ?? entry.term}
      <span className="term-pop" id={popId} role="tooltip" hidden={!open}>
        <b>{entry.term}:</b> {entry.text}
      </span>
    </span>
  );
}
