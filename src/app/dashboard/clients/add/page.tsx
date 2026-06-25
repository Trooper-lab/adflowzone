
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ChildAccountForm from '@/components/account/child-account-form';
import ParentClientForm from '@/components/account/parent-client-form';

export default function AddClientPage() {
  const [step, setStep] = useState(1);
  const [parentClientId, setParentClientId] = useState<string | null>(null);
  const router = useRouter();

  const handleParentClientSave = (id: string) => {
    setParentClientId(id);
    setStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-slate-100">
          Klant & Account Toevoegen
        </h1>
        <p className="text-slate-500 mt-1">
          Volg deze stappen om een nieuwe klant en Google Ads account aan te maken.
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-blue-600 text-white font-bold text-sm">
              1
            </div>
            <h2 className="text-xl font-semibold font-headline text-slate-200">
              Klantgegevens Invullen
            </h2>
          </div>
          <ParentClientForm onSaveSuccess={handleParentClientSave} />
        </div>
      )}

      {step === 2 && parentClientId && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-blue-600 text-white font-bold text-sm">
              2
            </div>
            <h2 className="text-xl font-semibold font-headline text-slate-200">
              Google Ads Account Toevoegen
            </h2>
          </div>
          <ChildAccountForm
            parentClientId={parentClientId}
            onSaveSuccess={() => router.push('/dashboard/clients')}
            onCancel={() => router.push('/dashboard/clients')}
            cancelLabel="Annuleren & Voltooien"
            submitLabel="Opslaan & Afronden"
            addAnotherLabel="Opslaan & Nog Eén"
          />
        </div>
      )}
    </div>
  );
}

