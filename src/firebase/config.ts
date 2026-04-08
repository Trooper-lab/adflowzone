
import firebaseConfigData from '../../firebase-applet-config.json';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfigData.apiKey;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfigData.projectId;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfigData.appId;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId;

if (!apiKey) {
  throw new Error('FIREBASE_API_KEY is not set in config or environment');
}
if (!authDomain) {
  throw new Error('FIREBASE_AUTH_DOMAIN is not set in config or environment');
}
if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID is not set in config or environment');
}

// Standard Firebase config - NO firestoreDatabaseId here.
// The (default) database is used automatically when no ID is passed to getFirestore().
export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket: storageBucket || '',
  appId: appId || '',
  messagingSenderId: messagingSenderId || '',
};
