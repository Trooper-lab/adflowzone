'use client';

import {useEffect} from 'react';
import {useToast} from '@/hooks/use-toast';
import {errorEmitter} from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

export function FirebaseErrorListener() {
  const {toast} = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error(error); // Also log to console for dev visibility

      // We will throw the error here to make it visible in the Next.js dev overlay
      // DO NOT CATCH THIS ERROR.
      // The dev overlay is the intended UI for this error.
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          throw error;
        }, 0);
      } else {
        // In production, just show a toast
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description:
            'You do not have permission to perform this action. Please contact support if you believe this is an error.',
        });
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  // This component does not render anything
  return null;
}
