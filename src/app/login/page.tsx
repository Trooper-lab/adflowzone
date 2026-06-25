
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { LoginForm } from '@/components/auth/login-form';
import { LogoIcon } from '@/components/icons';
import type { AppUser } from '@/lib/types';
import { LoadingScreen } from '@/components/ui/loading-screen';

export default function LoginPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }

    const checkRoleAndRedirect = async () => {
      if (!firestore) return;

      console.log("LOGIN_STEP: Checking role for", user.email, user.uid);

      // Special case: billy@pearsonline.nl and billy@trooper.es are always admins
      if (user.email === 'billy@pearsonline.nl' || 
          user.email === 'billy@trooper.es' ||
          user.email?.toLowerCase() === 'admin@onlyforward.nl') {
        console.log("LOGIN_STEP: Special admin email detected, redirecting to dashboard");
        router.push('/dashboard');
        return;
      }

      try {
        // 1. Check for internal profile (admin/employee)
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let role = null;
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as AppUser;
          role = userData.role?.toLowerCase();
          console.log("LOGIN_STEP: User profile found with role:", role);
          
          if (role === 'admin' || role === 'employee') {
            router.push('/dashboard');
            return;
          }
        }

        // 2. Check for client access via email match (do this BEFORE blocking pending role)
        if (user.email) {
            const emailLower = user.email.toLowerCase();
            const clientQuery = query(
              collection(firestore, 'parentClients'),
              where('clientUserEmail', '==', emailLower),
              limit(1)
            );
            const clientSnapshot = await getDocs(clientQuery);

            if (!clientSnapshot.empty) {
              const clientDoc = clientSnapshot.docs[0];
              console.log("LOGIN_STEP: Client access found for", emailLower, "redirecting to portal", clientDoc.id);
              router.push(`/portal/${clientDoc.id}`);
              return;
            } else {
              console.log("LOGIN_STEP: No client access found for", emailLower);
            }
        }

        // 3. If they have role 'pending', redirect to waiting onboarding screen
        if (role === 'pending') {
          router.push('/onboarding/waiting');
          return;
        }

        // 4. Fallback for new users without a document yet
        console.log("LOGIN_STEP: Fallback to onboarding/waiting");
        if (user.email) {
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
          
          if (defaultRole === 'employee') {
            router.push('/dashboard');
            return;
          }
        }
        
        router.push('/onboarding/waiting');
        
      } catch (error) {
        console.error("LOGIN_ERROR: Error checking user role:", error);
        router.push('/onboarding/waiting');
      }
    };

    checkRoleAndRedirect();
    
  }, [user, userLoading, firestore, router]);


  if (loading) {
    return <LoadingScreen label="Toegang controleren..." />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] text-slate-100 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md z-10 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="size-16 bg-slate-900/60 border border-border rounded-2xl flex items-center justify-center shadow-2xl mb-2">
            <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 font-headline">GO</span>
          </div>
          <h1 className="font-headline text-3xl font-black tracking-tight text-white">
            Global Overview
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Log in op het GO command center van <span className="text-white font-semibold">Only Forward</span>
          </p>
        </div>
        
        <LoginForm />
        
        <p className="text-center text-xs text-slate-500 font-medium tracking-wide">
          Uitsluitend toegankelijk met een geautoriseerd Google account.
        </p>
      </div>
    </div>
  );
}
