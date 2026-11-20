import { lazy } from 'react';

const RELOAD_MARKER = 'uc3:module-load-reload';
const MODULE_LOAD_ERROR = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading (?:css )?chunk [\w-]+ failed/i,
  /chunkloaderror/i,
];

export interface ReloadEnvironment {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload: () => void;
}

function browserEnvironment(): ReloadEnvironment {
  return {
    storage: window.sessionStorage,
    reload: () => window.location.reload(),
  };
}

export function isModuleLoadError(error: unknown): boolean {
  if (typeof error === 'string') return MODULE_LOAD_ERROR.some((pattern) => pattern.test(error));
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; message?: unknown };
  const name = value.name;
  const message = value.message;
  if (typeof name === 'string' && /^(?:ChunkLoadError|CSSChunkLoadError)$/i.test(name)) return true;
  return typeof message === 'string' && MODULE_LOAD_ERROR.some((pattern) => pattern.test(message));
}

/** Reloads at most once per session until a lazy module loads successfully. */
export function reloadPageOnce(environment?: ReloadEnvironment): boolean {
  try {
    const { storage, reload } = environment ?? browserEnvironment();
    if (storage.getItem(RELOAD_MARKER) === '1') return false;
    storage.setItem(RELOAD_MARKER, '1');
    reload();
    return true;
  } catch {
    return false;
  }
}

function clearReloadMarker(environment?: ReloadEnvironment) {
  try {
    (environment ?? browserEnvironment()).storage.removeItem(RELOAD_MARKER);
  } catch {
    // Storage can be unavailable in locked-down browsers; loading the view still succeeds.
  }
}

export async function loadWithReload<T>(load: () => Promise<T>, environment?: ReloadEnvironment): Promise<T> {
  try {
    const module = await load();
    clearReloadMarker(environment);
    return module;
  } catch (error) {
    if (isModuleLoadError(error) && reloadPageOnce(environment)) {
      // Navigation replaces this document. Keep Suspense pending in case reload is delayed.
      return new Promise<T>(() => undefined);
    }
    throw error;
  }
}

export const lazyWithReload: typeof lazy = (load) => lazy(() => loadWithReload(load));

/** Vite emits this before a stale preloaded chunk becomes an unhandled browser error. */
export function handleVitePreloadError(event: Event, environment?: ReloadEnvironment) {
  if (reloadPageOnce(environment)) event.preventDefault();
}
