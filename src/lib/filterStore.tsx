/* eslint-disable react-refresh/only-export-components -- context provider, hook and actions belong together */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATS, ITEMS, PRICE_GROUPS, SUBS } from '../data/products';
import { EVENTS } from '../data/promos';
import { STORE_BY_ID } from '../data/stores';
import { DEFAULT_STATE, effectiveTime, fromQuery, toQuery, type FilterState, type TabId, type TimeSel } from './filters';

interface FilterApi {
  state: FilterState;
  update: (fn: (s: FilterState) => FilterState) => void;
}

const FilterContext = createContext<FilterApi | null>(null);

function readUrl(): FilterState {
  try {
    return fromQuery(window.location.search.replace(/^\?/, ''), EVENTS.length);
  } catch (err) {
    console.error('Could not read filters from the URL', err);
    return structuredClone(DEFAULT_STATE);
  }
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(readUrl);
  useEffect(() => {
    try {
      window.history.replaceState(null, '', `${window.location.pathname}?${toQuery(state)}`);
    } catch (err) {
      console.error('Could not write filters to the URL', err);
    }
  }, [state]);
  const update = useCallback((fn: (s: FilterState) => FilterState) => setState((s) => fn(s)), []);
  const api = useMemo(() => ({ state, update }), [state, update]);
  return <FilterContext.Provider value={api}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterApi {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider');
  return ctx;
}

/** Pure state transitions. Changing a product or promo filter clears the event picked for the charts. */
export const actions = {
  tab: (tab: TabId) => (s: FilterState): FilterState => ({ ...s, tab, sel: -1, event: -1, promoType: 'all' }),
  time: (patch: Partial<TimeSel>) => (s: FilterState): FilterState => ({ ...s, time: { ...effectiveTime(s), ...patch }, sel: -1, event: -1 }),
  dept: (dept: number) => (s: FilterState): FilterState => ({ ...s, dept, cat: -1, sub: -1, pg: -1, item: -1, sel: -1, event: -1 }),
  cat: (cat: number) => (s: FilterState): FilterState => ({ ...s, cat, dept: cat >= 0 ? CATS[cat].dept : s.dept, sub: -1, pg: -1, item: -1, sel: -1, event: -1 }),
  sub: (sub: number) => (s: FilterState): FilterState => ({ ...s, sub, pg: -1, item: -1, sel: -1, event: -1 }),
  pg: (pg: number) => (s: FilterState): FilterState => {
    if (pg < 0) return { ...s, pg: -1, sel: -1, event: -1 };
    const p = PRICE_GROUPS[pg];
    return { ...s, pg, sub: p.sub, cat: p.cat, dept: p.dept, codes: [], item: s.item >= 0 && ITEMS[s.item].pg === pg ? s.item : -1, sel: -1, event: -1 };
  },
  item: (item: number) => (s: FilterState): FilterState => {
    if (item < 0) return { ...s, item: -1, sel: -1 };
    const it = ITEMS[item];
    return { ...s, item, sub: it.sub, cat: SUBS[it.sub].cat, dept: it.dept, sel: -1, event: -1 };
  },
  codes: (codes: number[]) => (s: FilterState): FilterState => ({ ...s, codes, pg: codes.length ? -1 : s.pg, sel: -1, event: -1 }),
  region: (region: number) => (s: FilterState): FilterState => ({
    ...s,
    region,
    districts: [],
    stores: region > 0 ? s.stores.filter((id) => STORE_BY_ID.get(id)?.region === region) : s.stores,
  }),
  places: (districts: string[], stores: number[]) => (s: FilterState): FilterState => ({ ...s, districts, stores }),
  reset: () => (s: FilterState): FilterState => ({ ...structuredClone(DEFAULT_STATE), tab: s.tab }),
};
