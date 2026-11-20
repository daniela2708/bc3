import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { filterOptions, SEARCHABLE_FROM, type EventOption } from '../lib/eventPick';
import { sanitizeSearch, SEARCH_MAX } from '../lib/filters';
import { Select } from './Select';
import { Field } from './ui';

/**
 * Local "Event" filter of a chart card. A plain dropdown (same component as the global filters) up to 10 options;
 * from 11 options a combobox you can type in to search by price group or promo type. Keyboard: arrows, Enter, Esc.
 */
export function EventPicker({ value, options, onChange, className }: { value: string; options: EventOption[]; onChange: (v: string) => void; className?: string }) {
  if (options.length < SEARCHABLE_FROM) return <Select className={`event-picker${className ? ` ${className}` : ''}`} label="Event" value={value} options={options} onChange={onChange} />;
  return <EventCombobox value={value} options={options} onChange={onChange} className={className} />;
}

function EventCombobox({ value, options, onChange, className }: { value: string; options: EventOption[]; onChange: (v: string) => void; className?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useMemo(() => filterOptions(options, query), [options, query]);
  const current = options.find((o) => o.value === value)?.label ?? '';

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const choose = (o: EventOption) => {
    onChange(o.value);
    close();
  };

  return (
    <Field label="Event" htmlFor={`${id}-input`} className={`event-picker${className ? ` ${className}` : ''}`}>
      <div className="typeahead event-combobox">
        <input
          ref={input}
          id={`${id}-input`}
          className="text-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && list.length ? `${id}-opt-${active}` : undefined}
          title={current}
          placeholder={open ? 'Type a price group or promo type' : current}
          maxLength={SEARCH_MAX}
          value={open ? query : current}
          onChange={(e) => {
            setQuery(sanitizeSearch(e.target.value));
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, list.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && list[active]) {
              e.preventDefault();
              choose(list[active]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        />
        <ChevronDown size={14} aria-hidden="true" className="combo-chevron" />
        {open && (
          <ul className="typeahead-list" role="listbox" id={`${id}-list`} aria-label="Events">
            {list.map((o, n) => (
              <li
                key={o.value}
                id={`${id}-opt-${n}`}
                role="option"
                aria-selected={o.value === value}
                className={n === active ? 'is-active' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                <span>{o.label}</span>
              </li>
            ))}
            {list.length === 0 && <li className="empty">No event matches “{query}”.</li>}
          </ul>
        )}
      </div>
    </Field>
  );
}
