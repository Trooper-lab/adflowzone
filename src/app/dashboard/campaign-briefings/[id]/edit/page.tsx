'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Briefing, BriefingContext } from '@/lib/types';
import { BriefingForm } from '@/components/briefing/BriefingForm';
import { 
  ArrowLeft,
  Settings2,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function EditBriefingPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);

  useEffect(() => {
    if (!firestore) return;
    
    const fetchBriefing = async () => {
      try {
        const docRef = doc(firestore, 'briefings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBriefing({ id: docSnap.id, ...docSnap.data() } as Briefing);
        } else {
          toast({
            title: 'Error',
            description: 'Briefing niet gevonden',
            variant: 'destructive',
          });
          router.push('/dashboard/campaign-briefings');
        }
      } catch (error) {
        console.error('Error fetching briefing:', error);
        toast({
          title: 'Error',
          description: 'Kon briefing niet laden',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [id, router, firestore, toast]);

  const handleExtract = async (notes: string) => {
    if (!notes.trim()) {
      toast({
        title: 'Waarschuwing',
        description: 'Plak eerst wat informatie in het tekstveld.',
        variant: 'destructive',
      });
      return;
    }

    setExtracting(true);
    try {
      const response = await fetch('/api/ai/extract-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error('Extractie mislukt');
      
      const extractedData = await response.json();
      setBriefing(prev => prev ? {
        ...prev,
        context: { ...prev.context, ...extractedData }
      } : null);
      toast({
        title: 'Succes',
        description: 'Informatie succesvol geëxtraheerd!',
      });
    } catch (error) {
      console.error('Error extracting briefing:', error);
      toast({
        title: 'Error',
        description: 'Er ging iets mis bij het extraheren.',
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (data: BriefingContext) => {
    if (!firestore) return;
    setSaving(true);
    try {
      const docRef = doc(firestore, 'briefings', id);
      await updateDoc(docRef, {
        context: data,
        updatedAt: serverTimestamp()
      });

      toast({
        title: 'Succes',
        description: 'Wijzigingen opgeslagen!',
      });
      router.push(`/dashboard/campaign-briefings/${id}`);
    } catch (error) {
      console.error('Error updating briefing:', error);
      toast({
        title: 'Error',
        description: 'Kon wijzigingen niet opslaan.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Link 
            href={`/dashboard/campaign-briefings/${id}`}
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors group"
          >
            <ArrowLeft className="size-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Terug naar Editor
          </Link>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              <Settings2 className="size-10 text-blue-600" />
              Bewerk Strategie
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl">
              Pas de kerngegevens van je briefing aan voor {briefing.context.clientName}.
            </p>
          </div>
        </div>
      </div>

      {/* The Form */}
      <BriefingForm 
        context={briefing.context}
        onChange={(newContext) => setBriefing(prev => prev ? { ...prev, context: newContext } : null)}
        onSubmit={(newContext) => handleSubmit(newContext)}
        onExtract={handleExtract}
        loading={saving}
        extracting={extracting}
        submitLabel="Opslaan & naar Editor"
      />

    </div>
  );
}
