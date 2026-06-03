
'use client';

import {useEffect, useState, useMemo, createContext, type ReactNode} from 'react';
import {FirebaseApp, getApps, initializeApp} from 'firebase/app';
import {Auth, getAuth} from 'firebase/auth';
import {Firestore, getFirestore, initializeFirestore} from 'firebase/firestore';
import {AlertCircle} from 'lucide-react';
import {FirebaseErrorListener} from '@/components/FirebaseErrorListener';
import {firebaseConfig} from './config';
import {LoadingScreen} from '@/components/ui/loading-screen';

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
  let app;
  try {
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  } catch (err) {
    console.error("initializeFirebase: initializeApp failed:", err);
    const apps = getApps();
    if (apps.length > 0) {
      app = apps[0];
    } else {
      throw err;
    }
  }

  const auth = getAuth(app);
  
  let firestore;
  try {
    firestore = getApps().length > 0
      ? getFirestore(app)
      : initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true,
        });
  } catch (err) {
    console.error("initializeFirebase: initializeFirestore failed, falling back to getFirestore:", err);
    firestore = getFirestore(app);
  }
      
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
  const [mounted, setMounted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    console.log("FirebaseClientProvider: Component mounted on client.");
    try {
      console.log("FirebaseClientProvider: Initializing Firebase...");
      const instances = initializeFirebase();
      console.log("FirebaseClientProvider: Firebase initialized successfully.");
      setFirebase(instances);
    } catch (error: any) {
      console.error("FirebaseClientProvider: Failed to initialize Firebase:", error);
      setInitError(error?.message || String(error));
    }
    setMounted(true);
  }, []);

  const contextValue = useMemo(() => {
    if (!firebase) return {app: null, auth: null, firestore: null};
    return {
      app: firebase.app,
      auth: firebase.auth,
      firestore: firebase.firestore,
    };
  }, [firebase]);

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500">
             <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold font-headline text-slate-100">Firebase Initialisatie Mislukt</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
             De applicatie kon Firebase niet initialiseren. Dit kan komen door ontbrekende omgevingsvariabelen of een tijdelijk verbindingsprobleem.
          </p>
          <div className="bg-slate-950/60 p-3 rounded-lg text-left text-[11px] font-mono text-red-400 border border-slate-800 break-all select-all">
             Error: {initError}
          </div>
          <button 
            className="w-full bg-red-600 hover:bg-red-500 text-xs font-bold uppercase tracking-wider h-10 rounded-lg transition-colors text-white"
            onClick={() => window.location.reload()}
          >
             Pagina Vernieuwen
          </button>
        </div>
      </div>
    );
  }

  if (!mounted || !firebase) {
    return <LoadingScreen label="Firebase Initialiseren..." />;
  }

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}
