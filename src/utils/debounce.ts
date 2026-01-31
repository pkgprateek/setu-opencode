/**
 * Debounce utility for batching rapid operations
 * 
 * Used by ContextCollector to batch disk writes when multiple
 * files are read in parallel (avoids 10 writes for 10 file reads).
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after `ms` milliseconds have elapsed since the last call.
 * 
 * @param fn - The function to debounce
 * @param ms - The debounce delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  }) as T & { cancel: () => void };
  
  // Allow cancellation (useful for cleanup)
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  
  return debounced;
}

/**
 * Default debounce delay for context persistence (ms)
 * 
 * 100ms is enough to batch parallel reads while
 * feeling instantaneous to users.
 */
export const CONTEXT_SAVE_DEBOUNCE_MS = 100;
