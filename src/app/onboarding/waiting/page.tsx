
'use client';

import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LogoIcon } from '@/components/icons';
import { LogOut, Clock, Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { AppUser } from '@/lib/types';

export default function WaitingPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, loading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser, loading: appUserLoading } = useDoc(userDocRef);

  useEffect(() => {
    // If user is actually an admin or employee, send them back to dashboard
    // Special case: billy@pearsonline.nl and billy@trooper.es are always admins
    if (!loading && (user?.email === 'billy@pearsonline.nl' || 
                     user?.email === 'billy@trooper.es' ||
                     user?.email?.toLowerCase() === 'admin@onlyforward.nl')) {
      router.push('/dashboard');
      return;
    }

    if (!loading && !appUserLoading && appUser) {
      const role = (appUser as AppUser).role?.toLowerCase();
      if (role === 'admin' || role === 'employee') {
        router.push('/dashboard');
      }
    }
  }, [appUser, appUserLoading, loading, user, router]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  if (loading || appUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-blue-500 size-10" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center">
          <LogoIcon className="h-16 w-16 text-blue-500 mb-6" />
          <h1 className="text-4xl font-bold font-headline tracking-tight">Even geduld...</h1>
        </div>

        <div className="bg-[#1C243A] border border-[#2A3552] p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 animate-pulse">
              <Clock className="size-12" />
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium">Je account is aangemaakt!</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Een beheerder van AdFlow Zone moet je nog een rol toewijzen (Admin of Medewerker) voordat je toegang krijgt tot het dashboard.
            </p>
          </div>

          <div className="pt-4 border-t border-[#2A3552]">
            <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-4">
              Ingelogd als: {user?.email}
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full border-slate-700 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="mr-2 size-4" />
              Uitloggen & Wisselen
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          Zodra je rol is toegewezen kun je deze pagina verversen of opnieuw inloggen om toegang te krijgen.
        </p>
      </div>
    </div>
  );
}
