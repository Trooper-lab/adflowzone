'use client';

import { useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { ParentClient } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { AddChildAccountForm } from '@/components/portal/AddChildAccountForm';
import { doc } from 'firebase/firestore';

export default function ClientAddChildAccountPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();

  const clientDocRef = useMemo(() => (firestore && clientId ? doc(firestore, 'parentClients', clientId as string) : null), [firestore, clientId]);
  const { data: parentClient, loading: clientLoading } = useDoc(clientDocRef);

  if (clientLoading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin" /> Loading...</div>;
  }

  if (!parentClient) {
    return <div>Client not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold">Add a New Google Ads Account</h1>
        <p className="text-muted-foreground">Configure a new child account for your profile.</p>
      </div>
      <AddChildAccountForm parentClient={parentClient as ParentClient} />
    </div>
  );
}
