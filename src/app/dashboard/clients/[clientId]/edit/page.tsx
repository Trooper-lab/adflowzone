'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import ParentClientForm from '@/components/account/parent-client-form';
import type { ParentClient } from '@/lib/types';

export default function EditClientPage() {
  const { clientId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const clientDocRef = useMemo(
    () => (firestore && clientId ? doc(firestore, 'parentClients', clientId as string) : null),
    [firestore, clientId]
  );
  const { data: client, loading: clientLoading } = useDoc(clientDocRef);

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center p-10 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Laden van klantgegevens...
      </div>
    );
  }

  if (!client) {
    return <div className="text-slate-400 text-center p-10">Klant niet gevonden.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mb-12 space-y-6">
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-slate-100">Klant Bewerken</h1>
        <p className="text-slate-500 mt-1">
          Bewerk de instellingen en branding voor {(client as ParentClient).clientName}.
        </p>
      </div>

      <ParentClientForm
        initialData={client as ParentClient}
        onSaveSuccess={() => router.push(`/dashboard/clients/${clientId}`)}
        onCancel={() => router.push(`/dashboard/clients/${clientId}`)}
        submitLabel="Wijzigingen Opslaan"
      />
    </div>
  );
}
