import { useRef, type ReactNode } from 'react';

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * Secondary tabs at the top of a view (WAI-ARIA tabs with automatic activation): role tablist / tab, aria-selected,
 * roving tabindex, arrows / Home / End through `next`, visible focus. Each panel is `role="tabpanel"` with the id
 * `${idPrefix}-panel-${id}` (see SubTabPanel).
 */
export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  next,
  label,
  idPrefix,
  aside,
}: {
  tabs: SubTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The tab a key moves to from the current one; null for keys the bar does not handle. */
  next: (current: T, key: string) => T | null;
  label: string;
  idPrefix: string;
  /** Shown at the right end of the bar (e.g. a status chip). */
  aside?: ReactNode;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  return (
    <div className="subtabs-bar">
      <div className="subtabs" role="tablist" aria-label={label}>
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el) refs.current.set(t.id, el);
                else refs.current.delete(t.id);
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={`subtab${selected ? ' is-active' : ''}`}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => {
                const to = next(t.id, e.key);
                if (to === null) return;
                e.preventDefault();
                onChange(to);
                refs.current.get(to)?.focus();
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {aside && <span className="subtabs-aside">{aside}</span>}
    </div>
  );
}

/** The panel of the active subtab, labelled by its tab. */
export function SubTabPanel({ id, idPrefix, children }: { id: string; idPrefix: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} className="subtab-panel">
      {children}
    </div>
  );
}
