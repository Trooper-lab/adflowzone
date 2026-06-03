'use client';
import {useState, useEffect} from 'react';
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  Query,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import {useFirestore} from '@/firebase/provider';
import {errorEmitter} from '@/firebase/error-emitter';
import {
  FirestorePermissionError,
  type SecurityRuleContext,
} from '@/firebase/errors';

export function useCollection(q: Query | null) {
  const [data, setData] = useState<DocumentData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore || !q) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let resolved = false;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        resolved = true;
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setData(data);
        setLoading(false);
      },
      async (err) => {
        resolved = true;
        setError(err);
        // @ts-ignore internal _query property
        const internalQuery = q._query;
        const permissionError = new FirestorePermissionError({
          path: internalQuery.path.segments.join('/'),
          operation: 'list',
          // @ts-ignore
          requestResourceData: internalQuery.filters?.map(f => ({
            field: f.field.segments.join('.'),
            op: f.op,
            value: f.value,
          }))
        } as SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      }
    );

    // Timeout fallback: if onSnapshot doesn't resolve in 4 seconds,
    // try to fetch once via getDocs.
    const timeoutId = setTimeout(async () => {
      if (!resolved) {
        console.warn(`useCollection: onSnapshot timed out. Attempting fallback getDocs...`);
        try {
          const snapshot = await getDocs(q);
          if (!resolved) {
            resolved = true;
            const data = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setData(data);
            setLoading(false);
          }
        } catch (err: any) {
          if (!resolved) {
            resolved = true;
            console.error(`useCollection: Fallback getDocs also failed:`, err);
            setError(err);
            setLoading(false);
          }
        }
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [firestore, q]);

  return {data, loading, error};
}
