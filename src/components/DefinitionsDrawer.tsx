import { useEffect, useMemo, useRef, useState } from 'react';
import { KPI_DEFINITIONS, kpiStatus, OPEN_QUESTIONS, WORKBOOK_NAME, WORKBOOK_URL } from '../lib/definitions';
import { sanitizeSearch, SEARCH_MAX, TABS } from '../lib/filters';
import { GLOSSARY, TERM_IDS } from '../lib/glossary';
import { VIEW_INFO } from '../lib/viewInfo';

const TAB_LABEL = Object.fromEntries(TABS.map((t) => [t.id, t.label]));

/** KPI definitions modal, in the UC1 format: one table with definition, calculation, source and status. */
export function DefinitionsDrawer({ open, focusId, onClose }: { open: boolean; focusId: string | null; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    closeRef.current?.focus();
    if (focusId) document.getElementById(`def-${focusId}`)?.scrollIntoView({ block: 'center' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, focusId, onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KPI_DEFINITIONS;
    return KPI_DEFINITIONS.filter((d) => [d.name, d.definition, d.formula, d.note ?? '', d.priority].some((f) => f.toLowerCase().includes(q)));
  }, [query]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="defs-modal" role="dialog" aria-modal="true" aria-labelledby="defs-title" onClick={(e) => e.stopPropagation()}>
        <div className="defs-head">
          <h2 id="defs-title">KPI definitions</h2>
          <div className="defs-intro">
            <p>
              Definitions and calculations copied from the requirements workbook{' '}
              <a className="btn-link" href={WORKBOOK_URL} target="_blank" rel="noopener noreferrer" title="Open the workbook in SharePoint (new tab)">
                {WORKBOOK_NAME}
              </a>{' '}
              (how the prototype applies each one is marked Prototype), for validation with Weis, followed by each view's priority, user story and what is still to validate. Every rate is a ratio of totals. Items marked Definition pending depend on an open question (numbers follow the workbook tab “UC #3 - Open Questions”); the assumption the prototype uses is listed at the end. Level 2 items are useful but not part of the MVP. Illustrative data only.
            </p>
            <input
              className="text-input defs-search"
              type="search"
              placeholder="Search KPIs"
              aria-label="Search KPI definitions"
              maxLength={SEARCH_MAX}
              value={query}
              onChange={(e) => setQuery(sanitizeSearch(e.target.value))}
            />
          </div>
        </div>
        <div className="defs-body">
          <table className="defs-table">
            <thead>
              <tr>
                <th>KPI</th>
                <th>Business definition</th>
                <th>Calculation</th>
                <th>Views</th>
                <th>Priority · status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} id={`def-${d.id}`} className={d.id === focusId ? 'is-focus' : undefined}>
                  <th scope="row">
                    {d.name} <span className="defs-unit">({d.unit})</span>
                  </th>
                  <td>
                    {d.definition}
                    {d.note && <span className="defs-note">Prototype: {d.note}</span>}
                  </td>
                  <td>{d.formula}</td>
                  <td className="defs-views">{d.views.map((v) => TAB_LABEL[v]).join(' · ')}</td>
                  <td>
                    {d.priority}
                    <span className="defs-recon">{kpiStatus(d) === 'Workbook' ? 'From the workbook' : kpiStatus(d)}</span>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No KPI matches “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <h3 className="defs-q-title">Views: priority, user story and what is still to validate</h3>
          <ul className="defs-views-list">
            {TABS.map((t, i) => {
              const v = VIEW_INFO[t.id];
              return (
                <li key={t.id} id={`view-${t.id}`}>
                  <p className="defs-view-head">
                    <b>{t.label}</b>
                    <span className="chip neutral">
                      {v.priority}
                      {v.priorityNote ? ` (${v.priorityNote})` : ''} · View {i + 1} of {TABS.length}
                    </span>
                  </p>
                  <p className="defs-view-question">{v.question}</p>
                  <p>
                    <span className="section-tag">User story</span>
                    {v.story}
                  </p>
                  <p>
                    <span className="section-tag dashed">To validate</span>
                    {v.validate}
                  </p>
                </li>
              );
            })}
          </ul>
          <h3 className="defs-q-title">Glossary</h3>
          <dl className="defs-glossary">
            {TERM_IDS.map((id) => (
              <div key={id} id={`term-${id}`}>
                <dt>{GLOSSARY[id].term}</dt>
                <dd>{GLOSSARY[id].text}</dd>
              </div>
            ))}
          </dl>
          <h3 className="defs-q-title">Open questions and the assumption used</h3>
          <ul className="defs-questions">
            {OPEN_QUESTIONS.map((q) => (
              <li key={q.id ?? q.title}>
                <span className={`chip ${q.status === 'Answered' || q.status === 'Note' ? 'neutral' : 'amber'}`}>
                  {q.id === null ? 'Note' : `#${q.id} · ${q.status}`}
                </span>
                <b>{q.title}:</b> {q.assumption}
              </li>
            ))}
          </ul>
        </div>
        <div className="defs-foot">
          <button ref={closeRef} type="button" className="defs-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
