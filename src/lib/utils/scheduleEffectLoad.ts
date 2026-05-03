/**
 * Runs `fn` after the current effect commit so async loaders are not invoked
 * synchronously inside `useEffect` (avoids react-hooks/set-state-in-effect when
 * the loader sets state before its first `await`).
 */
export function scheduleEffectLoad(fn: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) fn();
  });
  return () => {
    cancelled = true;
  };
}
