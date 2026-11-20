import { ChevronDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { filterOptions, SEARCHABLE_FROM, type EventOption } from '../lib/eventPick';
import { sanitizeSearch, SEARCH_MAX } from '../lib/filters';
import { Select } from './Select';
import { Field } from './ui';

/**
 * Local "Event" filter of a chart card. A plain dropdown up to 10 options; from 11 options a combobox you can type in
 * to search by price group or promo type (arrows, Enter, Esc). `inline` puts the "Event" label inside the control
 * (chart card controls row); otherwise it is a regular labelled filter field. Long names end with an ellipsis and
 * show in full in the tooltip and in the list.
 */
export function EventPicker({ value, options, onChange, className, inline = false }: { value: string; options: EventOption[]; onChange: (v: string) => void; className?: string; inline?: boolean }) {
  const cls = `event-picker${inline ? ' inline' : ''}${className ? ` ${className}` : ''}`;
  if (options.length >= SEARCHABLE_FROM) return <EventCombobox value={value} options={options} onChange={onChange} className={cls} inline={inline} />;
  if (!inline) return <Select className={cls} label="Event" value={value} options={options} onChange={onChange} />;
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <div className={`${cls} inline-field`} title={current}>
      <span className="inline-label" aria-hidden="true">
        Event
      </span>
      <select aria-label="Event" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="combo-chevron" />
    </div>
  );
}

function EventCombobox({ value, options, onChange, className, inline }: { value: string; options: EventOption[]; onChange: (v: string) => void; className: string; inline: boolean }) {
  const id = useId();
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

  const box = (
    <div className={`typeahead event-combobox${inline ? ' inline-field' : ''}`} title={open ? undefined : current}>
      {inline && (
        <span className="inline-label" aria-hidden="true">
          Event
        </span>
      )}
      <input
        id={`${id}-input`}
        className="text-input"
        type="text"
        role="combobox"
        aria-label={inline ? 'Event' : undefined}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && list.length ? `${id}-opt-${active}` : undefined}
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
              aria-label={o.label}
              title={o.label}
              className={n === active ? 'is-active' : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
            >
              <span className="opt-primary">{o.primary ?? o.label}</span>
              {o.secondary && <span className="opt-secondary">{o.secondary}</span>}
            </li>
          ))}
          {list.length === 0 && <li className="empty">No event matches “{query}”.</li>}
        </ul>
      )}
    </div>
  );
  if (inline) return <div className={className}>{box}</div>;
  return (
    <Field label="Event" htmlFor={`${id}-input`} className={className}>
      {box}
    </Field>
  );
}
