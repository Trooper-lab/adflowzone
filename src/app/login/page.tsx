
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
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
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as AppUser;
          const role = userData.role?.toLowerCase();
          console.log("LOGIN_STEP: User profile found with role:", role);
          
          if (role === 'admin' || role === 'employee') {
            router.push('/dashboard');
            return;
          }
          
          if (role === 'pending') {
            router.push('/onboarding/waiting');
            return;
          }
        } else {
          console.log("LOGIN_STEP: No user profile found in 'users' collection for UID:", user.uid);
        }

        // 2. Check for client access via email match
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

        // 3. Fallback for new users without a document yet
        console.log("LOGIN_STEP: Fallback to onboarding/waiting");
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <LogoIcon className="mb-4 h-12 w-12 text-primary" />
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground">
            AdFlow Zone
          </h1>
          <p className="mt-2 text-muted-foreground">
            Log in op je portaal.
          </p>
        </div>
        <LoginForm />
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Een gestroomlijnde werkplek voor ad management professionals.
        </p>
      </div>
    </div>
  );
}
