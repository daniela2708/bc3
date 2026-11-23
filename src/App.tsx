import { Component, Suspense, useCallback, useState, type ErrorInfo, type ReactNode } from 'react';
import { BottomBar } from './components/Blocks';
import { DefinitionsDrawer } from './components/DefinitionsDrawer';
import { FilterCard } from './components/FilterCard';
import { Disclaimer, Header } from './components/Header';
import { actions, FilterProvider, useFilters } from './lib/filterStore';
import { toQuery } from './lib/filters';
import { lazyWithReload } from './lib/lazyWithReload';
import { PerformanceView } from './views/PerformanceView';

const PostPromoView = lazyWithReload(() => import('./views/PostPromoView'));
const RunTrendView = lazyWithReload(() => import('./views/RunTrendView'));
const HistoryView = lazyWithReload(() => import('./views/HistoryView'));
const ShopperView = lazyWithReload(() => import('./views/ShopperView'));

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  onResetFilters: () => void;
  onReload: () => void;
}

/** Shows a generic message to users; details go to the console only. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  /**
   * Clears the error, then resets the filters. Clearing here as well covers an error raised with the filters already
   * at their defaults, where the reset leaves the reset key unchanged.
   */
  resetFilters = () => {
    this.setState({ failed: false });
    this.props.onResetFilters();
  };
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('View failed to render', error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <section className="card app-error" role="alert">
          <h2>Something went wrong</h2>
          <p>This view could not be displayed. Try another filter or reset the filters.</p>
          <div className="app-error-actions">
            <button type="button" className="btn-outline" onClick={this.resetFilters}>
              Reset filters
            </button>
            <button type="button" className="btn-outline" onClick={this.props.onReload}>
              Reload page
            </button>
          </div>
        </section>
      );
    return this.props.children;
  }
}

function Shell() {
  const { state, update } = useFilters();
  const [defs, setDefs] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const openDefinitions = useCallback((id?: string) => setDefs({ open: true, focus: id ?? null }), []);
  const closeDefinitions = useCallback(() => setDefs((d) => ({ ...d, open: false })), []);

  const view = (() => {
    switch (state.tab) {
      case 'other':
        return <PerformanceView variant="other" />;
      case 'post':
        return <PostPromoView />;
      case 'trend':
        return <RunTrendView />;
      case 'history':
        return <HistoryView />;
      case 'shopper':
        return <ShopperView />;
      default:
        return <PerformanceView variant="hotbuy" />;
    }
  })();

  return (
    <>
      <Header onOpenDefinitions={() => openDefinitions()} />
      <Disclaimer />
      <main className="page">
        <FilterCard />
        <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${state.tab}`}>
          <ErrorBoundary resetKey={`${toQuery(state)}#${state.codes.join(',')}`} onResetFilters={() => update(actions.reset())} onReload={() => window.location.reload()}>
            <Suspense fallback={<section className="card empty-card">Loading view…</section>}>{view}</Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <BottomBar
        tab={state.tab}
        onTab={(t) => {
          update(actions.tab(t));
          window.scrollTo({ top: 0 });
        }}
      />
      <DefinitionsDrawer open={defs.open} focusId={defs.focus} onClose={closeDefinitions} />
    </>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <Shell />
    </FilterProvider>
  );
}
