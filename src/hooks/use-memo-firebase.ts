
import { useMemo, useRef } from 'react';
import { Query, DocumentReference, queryEqual, refEqual } from 'firebase/firestore';

export function useMemoFirebase<T extends Query | DocumentReference | null>(
  factory: () => T,
  deps: any[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const newRefOrQuery = useMemo(factory, deps);

  const prevRef = useRef<T | null>(null);

  if (prevRef.current) {
    if (newRefOrQuery && newRefOrQuery instanceof Query && prevRef.current instanceof Query) {
      if (queryEqual(newRefOrQuery, prevRef.current)) {
        return prevRef.current as T;
      }
    } else if (newRefOrQuery && newRefOrQuery instanceof DocumentReference && prevRef.current instanceof DocumentReference) {
      if (refEqual(newRefOrQuery, prevRef.current)) {
        return prevRef.current as T;
      }
    }
  }

  prevRef.current = newRefOrQuery;
  return newRefOrQuery;
}

    