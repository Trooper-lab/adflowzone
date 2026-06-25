'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ChildAccountForm from '@/components/account/child-account-form';

export default function AddChildAccountPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

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
          <Link href={`/dashboard/clients/${clientId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-2xl font-bold text-slate-100">
            Nieuw Account Toevoegen
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configureer een nieuw Google Ads account voor deze klant.
          </p>
        </div>
      </div>

      <ChildAccountForm
        parentClientId={clientId}
        onSaveSuccess={() => router.push(`/dashboard/clients/${clientId}`)}
        onCancel={() => router.push(`/dashboard/clients/${clientId}`)}
        cancelLabel="Annuleren"
        submitLabel="Opslaan & Afronden"
        addAnotherLabel="Opslaan & Nog Eén"
      />
    </div>
  );
}

