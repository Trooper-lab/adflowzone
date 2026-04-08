'use client';

import { useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { ParentClient } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { EditChildAccountForm } from '@/components/portal/EditChildAccountForm';
import { doc } from 'firebase/firestore';

export default function ClientEditChildAccountPage() {
  const { clientId, accountId } = useParams();
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
    <EditChildAccountForm parentClient={parentClient as ParentClient} accountId={accountId as string} />
  );
}
