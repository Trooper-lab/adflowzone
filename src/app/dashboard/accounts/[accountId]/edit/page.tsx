'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount } from '@/lib/types';
import ChildAccountForm from '@/components/account/child-account-form';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

export default function EditChildAccountPage() {
  const { accountId } = useParams();
  const searchParams = useSearchParams();
  const parentClientId = searchParams.get('parent');
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const accountDocRef = useMemoFirebase(
    () => (firestore && parentClientId && accountId ? doc(firestore, 'parentClients', parentClientId as string, 'childAccounts', accountId as string) : null),
    [firestore, parentClientId, accountId]
  );
  const { data: account, loading: accountLoading } = useDoc(accountDocRef);
  
  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return (
      role === 'admin' || 
      user?.email === 'billy@pearsonline.nl' || 
      user?.email === 'billy@trooper.es' || 
      user?.email?.toLowerCase() === 'admin@onlyforward.nl'
    );
  }, [appUser, user?.email]);

  useEffect(() => {
    if (!accountLoading && appUser && !isAdmin) {
      toast({ 
        variant: 'destructive', 
        title: 'Toegang Geweigerd', 
        description: 'Alleen beheerders kunnen accountinstellingen wijzigen.' 
      });
      router.push(`/dashboard/accounts/${accountId}?parent=${parentClientId}`);
    }
  }, [accountLoading, appUser, isAdmin, router, toast, accountId, parentClientId]);

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[50vh]">
        <Loader2 className="animate-spin text-muted-foreground size-8" />
        <span className="ml-3 text-slate-400">Accountgegevens laden...</span>
      </div>
    );
  }
  
  if (!account || !parentClientId) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center text-slate-400">
        Account of klantgegevens niet gevonden.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="shrink-0 text-muted-foreground hover:text-white"
        >
          <Link href={`/dashboard/accounts/${accountId}?parent=${parentClientId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-2xl font-bold text-slate-100">
            Account Details Bewerken
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pas instellingen, KPIs, en budgetten aan voor {(account as ChildAccount).nickname}.
          </p>
        </div>
      </div>

      <ChildAccountForm
        parentClientId={parentClientId}
        initialData={account as ChildAccount}
        onSaveSuccess={() => router.push(`/dashboard/accounts/${accountId}?parent=${parentClientId}`)}
        onCancel={() => router.push(`/dashboard/accounts/${accountId}?parent=${parentClientId}`)}
        submitLabel="Wijzigingen Opslaan"
      />
    </div>
  );
}
