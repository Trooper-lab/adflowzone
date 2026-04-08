'use client';
import {useState, useEffect, useCallback} from 'react';
import {
  doc,
  onSnapshot,
  getDoc,
  DocumentReference,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import {useFirestore} from '@/firebase/provider';
import {errorEmitter} from '@/firebase/error-emitter';
import {
  FirestorePermissionError,
  type SecurityRuleContext,
} from '@/firebase/errors';

export function useDoc(ref: DocumentReference | null) {
  const [state, setState] = useState<{
    data: DocumentData | null;
    loading: boolean;
    error: FirestoreError | null;
    path: string | null;
  }>({
    data: null,
    loading: ref !== null,
    error: null,
    path: ref?.path || null,
  });

  const firestore = useFirestore();

  // Derived state to prevent tearing:
  // If the ref changes, immediately update state during render so consumers
  // never see `loading: false` and `data: null` for the new ref before the effect runs.
  const currentPath = ref?.path || null;
  if (currentPath !== state.path) {
    setState({
      data: null,
      loading: ref !== null,
      error: null,
      path: currentPath,
    });
  }

  const fetchData = useCallback(async () => {
    if (!firestore || !ref) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
    setState(s => ({ ...s, loading: true }));
    try {
      const docSnap = await getDoc(ref);
      if (docSnap.exists()) {
        setState(s => ({ ...s, data: { id: docSnap.id, ...docSnap.data() }, loading: false }));
      } else {
        setState(s => ({ ...s, data: null, loading: false }));
      }
    } catch (err: any) {
        console.error("Error fetching document:", err);
        setState(s => ({ ...s, error: err, loading: false }));
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        } as SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    }
  }, [firestore, currentPath]); // use currentPath instead of ref to avoid infinite loops if ref object is unstable

  useEffect(() => {
    if (!firestore || !ref) {
      if (state.loading) {
        setState(s => ({ ...s, loading: false }));
      }
      return;
    }

    // Effect starts. Since we already set loading: true during render,
    // we don't strictly need to set it here, but it's fine.

    const unsubscribe = onSnapshot(
      ref,
      (doc) => {
        if (doc.exists()) {
          setState(s => ({ ...s, data: {id: doc.id, ...doc.data()}, loading: false, error: null }));
        } else {
          setState(s => ({ ...s, data: null, loading: false, error: null }));
        }
      },
      (err) => {
        setState(s => ({ ...s, error: err, loading: false }));
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        } as SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    return () => unsubscribe();
  }, [firestore, currentPath]); // use currentPath for stability

  return {data: state.data, loading: state.loading, error: state.error, refetch: fetchData};
}
