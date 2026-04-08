
'use client';

import {useEffect, useState, useMemo, createContext, type ReactNode} from 'react';
import {FirebaseApp, getApps, initializeApp} from 'firebase/app';
import {Auth, getAuth} from 'firebase/auth';
import {Firestore, getFirestore, initializeFirestore} from 'firebase/firestore';
import {Loader2} from 'lucide-react';
import {FirebaseErrorListener} from '@/components/FirebaseErrorListener';
import {firebaseConfig} from './config';

type FirebaseContextValue = {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
};

export const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  firestore: null,
});

export const initializeFirebase = () => {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  // Always connect to the (default) Firestore database.
  // Do NOT pass a databaseId - omitting it is the correct way to use (default).
  const firestore = apps.length > 0
    ? getFirestore(app)
    : initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
      });
      
  return {app, auth, firestore};
};

type FirebaseClientProviderProps = {
  children: ReactNode;
};

export function FirebaseClientProvider({children}: FirebaseClientProviderProps) {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebase(instances);
  }, []);

  const contextValue = useMemo(() => {
    if (!firebase) return {app: null, auth: null, firestore: null};
    return {
      app: firebase.app,
      auth: firebase.auth,
      firestore: firebase.firestore,
    };
  }, [firebase]);

  if (!firebase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-500 size-10" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Firebase Initialiseren...</p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}
