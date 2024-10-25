import React from "react";

/**
 *
 * @param initializer : WARNING: we don't keep the initializer in the dependencies array
 * of the useCallback, so the initializer must be immutable (or equivalent).
 * @returns
 */
export function useLazyRef<T>(initializer: () => T) {
  const ref = React.useRef<T | null>(null);

  const get = React.useCallback(() => {
    if (ref.current === null) {
      ref.current = initializer();
    }
    return ref.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return get;
}

export function useResettableLazyRef<T>(initializer: () => T) {
  const ref = React.useRef<T | null>(null);

  const get = React.useCallback(() => {
    if (ref.current === null) {
      ref.current = initializer();
    }
    return ref.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = React.useCallback(() => {
    ref.current = null;
  }, []);

  return React.useMemo(() => ({ get, reset }), [get, reset]);
}

// export function useResettableAsyncLazyRef<T>(initializer: () => Promise<T>) {
//   const ref = React.useRef<T | null>(null);

//   const get = React.useCallback(async () => {
//     if (ref.current === null) {
//       ref.current = await initializer();
//     }
//     return ref.current;
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const reset = React.useCallback(() => {
//     ref.current = null;
//   }, []);

//   return React.useMemo(() => ({ get, reset }), [get, reset]);
// }
