import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './App';
import { actions } from './lib/filterStore';
import { DEFAULT_STATE, toQuery, type FilterState } from './lib/filters';

interface TestElementProps {
  children?: ReactNode;
  onClick?: () => void;
}

function elements(node: ReactNode): ReactElement<TestElementProps>[] {
  if (!isValidElement<TestElementProps>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}

describe('ErrorBoundary', () => {
  it('clears its error when serialized filter state changes', () => {
    const previousKey = toQuery({ ...structuredClone(DEFAULT_STATE), dept: 1 });
    const nextKey = toQuery({ ...structuredClone(DEFAULT_STATE), dept: 2 });
    const props = { children: null, resetKey: nextKey, onResetFilters: vi.fn(), onReload: vi.fn() };

    expect(ErrorBoundary.getDerivedStateFromProps(props, { failed: true, key: previousKey })).toEqual({ failed: false, key: nextKey });
  });

  it('uses the filter reset action from the error card button', () => {
    let filters: FilterState = { ...structuredClone(DEFAULT_STATE), tab: 'history', dept: 2, cat: 3 };
    const onResetFilters = () => {
      filters = actions.reset()(filters);
    };
    const boundary = new ErrorBoundary({ children: null, resetKey: toQuery(filters), onResetFilters, onReload: vi.fn() });
    boundary.state = { failed: true, key: toQuery(filters) };
    boundary.setState = vi.fn();
    const buttons = elements(boundary.render()).filter((element) => element.type === 'button');

    buttons[0].props.onClick?.();

    expect(filters).toEqual({ ...structuredClone(DEFAULT_STATE), tab: 'history' });
    expect(boundary.setState).toHaveBeenCalledWith({ failed: false });
  });

  it('"Reset filters" clears the error even when the filters are already at their defaults', () => {
    const onResetFilters = vi.fn();
    const key = toQuery({ ...structuredClone(DEFAULT_STATE), tab: 'history' });
    const boundary = new ErrorBoundary({ children: null, resetKey: key, onResetFilters, onReload: vi.fn() });
    boundary.state = { failed: true, key };
    boundary.setState = vi.fn();
    elements(boundary.render()).filter((element) => element.type === 'button')[0].props.onClick?.();
    expect(boundary.setState).toHaveBeenCalledWith({ failed: false });
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('"Reload page" calls the reload handler', () => {
    const onReload = vi.fn();
    const boundary = new ErrorBoundary({ children: null, resetKey: '', onResetFilters: vi.fn(), onReload });
    boundary.state = { failed: true, key: '' };
    elements(boundary.render()).filter((element) => element.type === 'button')[1].props.onClick?.();
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
