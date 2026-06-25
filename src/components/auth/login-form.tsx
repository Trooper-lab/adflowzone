'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      if (user && user.email) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Determine role on first sign-up
          const emailLower = user.email.toLowerCase();
          const defaultRole = emailLower.endsWith('@onlyforward.nl') ? 'employee' : 'pending';
          
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: defaultRole,
            createdAt: new Date().toISOString(),
          }, { merge: true });
        }
      }

      router.push('/dashboard');
    } catch (error: any) {
      console.error("Google Authentication error:", error);
      toast({
        variant: 'destructive',
        title: 'Verificatie Mislukt',
        description: error.message || 'Er is een fout opgetreden bij het inloggen met Google.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-[#0F172A]/40 shadow-2xl relative overflow-hidden">
      <CardHeader className="text-center space-y-1 pb-6">
        <CardTitle className="font-headline text-xl text-white font-bold">
          Welkom bij GO
        </CardTitle>
        <CardDescription className="text-slate-400 text-xs font-medium">
          Meld u aan met uw Google-account om door te gaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <Button
          onClick={handleGoogleLogin}
          className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-bold flex items-center justify-center gap-3 transition-all rounded-xl shadow-lg border border-slate-200"
          disabled={loading}
        >
          {loading ? (
            <span className="size-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M5.26620007,9.76451677 C6.19875008,6.9710334 C8.79471676,5 11.8535834,5 C13.5606667,5 15.1053167,5.62145 16.3051668,6.65788337 L19.8653335,3.0977167 C17.7275834,1.18131668 14.9221168,0 11.8535834,0 C7.22853339,0 3.25055004,2.65863336 1.30906668,6.5401334 L5.26620007,9.76451677 Z"
              />
              <path
                fill="#34A853"
                d="M16.0407335,17.3075835 C14.9035501,18.4239835 13.4150668,19 11.8535834,19 C8.79471676,19 6.19875008,17.0289666 5.26620007,14.2354832 L1.30906668,17.4598666 C3.25055004,21.3413666 7.22853339,24 11.8535834,24 C14.8690168,24 17.6053335,22.9090667 19.6974169,21.0372333 L16.0407335,17.3075835 Z"
              />
              <path
                fill="#4285F4"
                d="M23.4900002,12.2727167 C23.4900002,11.4545334 23.4162835,10.6690667 23.2800002,9.90906674 L11.8535834,9.90906674 L11.8535834,14.6181668 L18.3842169,14.6181668 C18.1026002,16.1410668 17.2437335,17.4286168 16.0407335,17.3075835 L19.6974169,21.0372333 C22.0413835,18.8795333 23.4900002,15.6981667 23.4900002,12.2727167 Z"
              />
              <path
                fill="#FBBC05"
                d="M5.26620007,9.76451677 C5.01955007,10.5165668 4.8814334,11.3197668 4.8814334,12.1528668 C4.8814334,12.9859668 5.01955007,13.7891668 5.26620007,14.2354832 L1.30906668,17.4598666 C0.473550005,15.8677667 0,14.0661668 0,12.1528668 C0,10.2395668 0.473550005,8.43796677 1.30906668,6.8458668 L5.26620007,9.76451677 Z"
              />
            </svg>
          )}
          Inloggen met Google
        </Button>
      </CardContent>
    </Card>
  );
}
