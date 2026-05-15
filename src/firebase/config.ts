
// Standard Firebase config - values are preferred from env but have defaults for local dev
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBIdcolRg2LsvtgkRjfJET9deT-ItdNvdc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-5373578840-9f1dc.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-5373578840-9f1dc",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-5373578840-9f1dc.firebasestorage.app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:96883666005:web:30b9c9a7bdcfd204b338dc",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "96883666005",
};

if (!firebaseConfig.apiKey) {
  throw new Error('FIREBASE_API_KEY is not set in config or environment');
}
if (!firebaseConfig.authDomain) {
  throw new Error('FIREBASE_AUTH_DOMAIN is not set in config or environment');
}
if (!firebaseConfig.projectId) {
  throw new Error('FIREBASE_PROJECT_ID is not set in config or environment');
}
