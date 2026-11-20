import { ClipboardList, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ITEM_BY_CODE, ITEMS, PRICE_GROUPS, SUBS } from '../data/products';
import { parseCodeList, PASTE_MAX_CHARS, PASTE_MAX_CODES } from '../lib/upc';
import { Select } from './Select';
import { Field } from './ui';

/**
 * Price Group filter (workbook: Item Group / Price Association). Pick a price group, or paste a list of UPCs /
 * PLUs: the list filters to those items. Input is length-capped, tokenised and validated (PLU 4–5 digits,
 * UPC-A or EAN-13 with a valid check digit); nothing pasted is ever rendered as HTML.
 */
export function PriceGroupPicker({
  pg,
  codes,
  dept,
  cat,
  sub,
  onPg,
  onCodes,
  disabledReason,
}: {
  pg: number;
  codes: number[];
  dept: number;
  cat: number;
  sub: number;
  onPg: (pg: number) => void;
  onCodes: (items: number[]) => void;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ found: number; notFound: string[]; invalid: string[]; truncated: boolean; duplicates: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options = PRICE_GROUPS.filter((p) => (sub < 0 || p.sub === sub) && (cat < 0 || p.cat === cat) && (dept < 0 || p.dept === dept));
  const apply = () => {
    const parsed = parseCodeList(text);
    const found: number[] = [];
    const notFound: string[] = [];
    for (const c of parsed.valid) {
      const i = ITEM_BY_CODE.get(c);
      if (i === undefined) notFound.push(c);
      else found.push(i);
    }
    setResult({ found: found.length, notFound: notFound.slice(0, 10), invalid: parsed.invalid, truncated: parsed.truncated, duplicates: parsed.duplicates });
    if (found.length) {
      onCodes(found);
      setOpen(false);
    }
  };

  if (codes.length > 0)
    return (
      <Field label="Price Group" disabledReason={disabledReason}>
        <span className="static-field pasted-field">
          <ClipboardList size={14} aria-hidden="true" />
          {codes.length} item{codes.length > 1 ? 's' : ''} from pasted list
          <button type="button" className="clear-btn inline" aria-label="Clear pasted list" onClick={() => onCodes([])} disabled={!!disabledReason}>
            <X size={14} />
          </button>
        </span>
      </Field>
    );

  return (
    <div className="pg-picker" ref={ref}>
      <Select
        className="w-pg"
        label="Price Group"
        value={String(pg)}
        options={[
          { value: '-1', label: 'All price groups' },
          ...options.map((p) => ({ value: String(p.idx), label: p.name, group: SUBS[p.sub].name })),
        ]}
        onChange={(v) => onPg(Number(v))}
        disabledReason={disabledReason}
      />
      <button type="button" className="btn-link paste-btn" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} disabled={!!disabledReason}>
        <ClipboardList size={13} aria-hidden="true" />
        Paste UPCs
      </button>
      {open && (
        <div className="popover paste-pop" role="dialog" aria-label="Paste a list of UPCs or PLUs" id={id}>
          <div className="popover-head">
            <label htmlFor={`${id}-text`} className="field-label">
              Paste UPCs or PLUs (up to {PASTE_MAX_CODES})
            </label>
            <p className="paste-concept" role="note">
              Concept for review: this is the functionality we want to bring to Power BI. The final input format may differ.
            </p>
            <textarea
              id={`${id}-text`}
              className="text-input paste-area"
              rows={6}
              maxLength={PASTE_MAX_CHARS}
              spellCheck={false}
              placeholder={'One per line, or separated by commas or spaces.\nUPC-A (12 digits), EAN-13 (13) or PLU (4–5).'}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, PASTE_MAX_CHARS));
                setResult(null);
              }}
            />
          </div>
          {result && (
            <div className="paste-result" role="status">
              {result.found === 0 && <p className="access-error">No item in the catalog matches the pasted codes.</p>}
              {result.invalid.length > 0 && <p>Not a valid UPC, EAN-13 or PLU: {result.invalid.join(', ')}</p>}
              {result.notFound.length > 0 && <p>Valid but not in the catalog: {result.notFound.join(', ')}</p>}
              {result.duplicates > 0 && <p>{result.duplicates} duplicate code{result.duplicates > 1 ? 's' : ''} ignored.</p>}
              {result.truncated && <p>Only the first {PASTE_MAX_CODES} codes ({PASTE_MAX_CHARS.toLocaleString('en-US')} characters) are read.</p>}
            </div>
          )}
          <div className="popover-foot">
            <span className="paste-hint">Try: {ITEMS.filter((i) => i.upc).slice(0, 2).map((i) => i.upc).join(', ')}</span>
            <span className="foot-actions">
              <button type="button" className="btn-link" onClick={() => setText('')}>
                Clear
              </button>
              <button type="button" className="btn-primary small" onClick={apply} disabled={!text.trim()}>
                Apply list
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
