import { describe, expect, it, vi } from 'vitest';
import { handleVitePreloadError, loadWithReload, type ReloadEnvironment } from './lazyWithReload';

function environment() {
  const values = new Map<string, string>();
  const reload = vi.fn();
  const env: ReloadEnvironment = {
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    reload,
  };
  return { env, reload };
}

describe('loadWithReload', () => {
  it('reloads once for a dynamic-import loading error, then lets the error through', async () => {
    const { env, reload } = environment();
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/HistoryView-old.js');

    void loadWithReload(() => Promise.reject(error), env);
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);

    await expect(loadWithReload(() => Promise.reject(error), env)).rejects.toBe(error);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload for an unrelated error', async () => {
    const { env, reload } = environment();
    const error = new Error('The view failed while calculating a row');

    await expect(loadWithReload(() => Promise.reject(error), env)).rejects.toBe(error);
    expect(reload).not.toHaveBeenCalled();
  });

  it('applies the same one-reload guard to vite:preloadError', () => {
    const { env, reload } = environment();
    const first = new Event('vite:preloadError', { cancelable: true });
    const second = new Event('vite:preloadError', { cancelable: true });

    handleVitePreloadError(first, env);
    handleVitePreloadError(second, env);

    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
