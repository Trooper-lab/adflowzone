'use client';

import { useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ParentClient } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ChildAccountForm from '@/components/account/child-account-form';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ClientAddChildAccountPage() {
  const { clientId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const clientDocRef = useMemo(() => (firestore && clientId ? doc(firestore, 'parentClients', clientId as string) : null), [firestore, clientId]);
  const { data: parentClient, loading: clientLoading } = useDoc(clientDocRef);

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[50vh]">
        <Loader2 className="animate-spin text-muted-foreground size-8" />
        <span className="ml-3 text-slate-400">Klantgegevens laden...</span>
      </div>
    );
  }

  if (!parentClient) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center text-slate-400">
        Klantprofiel niet gevonden.
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
          <Link href={`/portal/${clientId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl font-bold text-slate-100">
            Nieuw Google Ads Account Toevoegen
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configureer een nieuw Google Ads account voor uw profiel.
          </p>
        </div>
      </div>

      <ChildAccountForm
        parentClientId={clientId as string}
        isPortal={true}
        onSaveSuccess={() => router.push(`/portal/${clientId}`)}
        onCancel={() => router.push(`/portal/${clientId}`)}
        submitLabel="Account Opslaan"
        addAnotherLabel="Opslaan & Nog Eén"
      />
    </div>
  );
}
