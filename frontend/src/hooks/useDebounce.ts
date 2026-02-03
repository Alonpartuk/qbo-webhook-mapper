import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounce a value - returns the value after the specified delay
 * @param value The value to debounce
 * @param delay The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 * @param callback The function to debounce
 * @param delay The delay in milliseconds (default: 300ms)
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}

/**
 * Prevent rapid repeated calls to an async function
 * Useful for API key generation, form submissions, etc.
 * @param callback The async function to throttle
 * @param delay Minimum time between calls (default: 1000ms)
 * @returns A throttled version of the callback with loading state
 */
export function useThrottledAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  callback: T,
  delay = 1000
): {
  execute: (...args: Parameters<T>) => Promise<ReturnType<T> | undefined>;
  isLoading: boolean;
  lastExecuted: number | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<number | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const execute = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    const now = Date.now();

    // Check if we're within the throttle window
    if (lastExecuted && now - lastExecuted < delay) {
      console.log('[Throttle] Blocked - too soon since last execution');
      return undefined;
    }

    // Check if already loading
    if (isLoading) {
      console.log('[Throttle] Blocked - already loading');
      return undefined;
    }

    setIsLoading(true);
    setLastExecuted(now);

    try {
      const result = await callbackRef.current(...args);
      return result as ReturnType<T>;
    } finally {
      setIsLoading(false);
    }
  }, [delay, isLoading, lastExecuted]);

  return { execute, isLoading, lastExecuted };
}
