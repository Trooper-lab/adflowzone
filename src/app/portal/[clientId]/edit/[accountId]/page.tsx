'use client';

import { useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ChildAccount } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ChildAccountForm from '@/components/account/child-account-form';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

export default function ClientEditChildAccountPage() {
  const { clientId, accountId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const accountDocRef = useMemoFirebase(
    () => (firestore && clientId && accountId ? doc(firestore, 'parentClients', clientId as string, 'childAccounts', accountId as string) : null),
    [firestore, clientId, accountId]
  );
  const { data: account, loading: accountLoading } = useDoc(accountDocRef);

  if (accountLoading) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[50vh]">
        <Loader2 className="animate-spin text-muted-foreground size-8" />
        <span className="ml-3 text-slate-400">Accountgegevens laden...</span>
      </div>
    );
  }

  if (!account || !clientId) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center text-slate-400">
        Account niet gevonden.
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
          <Link href={`/portal/${clientId}/accounts`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl font-bold text-slate-100">
            Google Ads Account Bewerken
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pas instellingen, KPIs, en budgetten aan voor {(account as ChildAccount).nickname}.
          </p>
        </div>
      </div>

      <ChildAccountForm
        parentClientId={clientId as string}
        initialData={account as ChildAccount}
        isPortal={true}
        onSaveSuccess={() => router.push(`/portal/${clientId}/accounts`)}
        onCancel={() => router.push(`/portal/${clientId}/accounts`)}
        submitLabel="Wijzigingen Opslaan"
      />
    </div>
  );
}
