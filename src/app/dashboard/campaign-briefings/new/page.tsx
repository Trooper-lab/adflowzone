'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, addDoc, doc, getDoc, query } from 'firebase/firestore';
import { BriefingContext, ParentClient, ChildAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Zap,
  Building2,
  Users,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { extractBriefingContext } from '@/ai/flows/extract-briefing-context';
import { BriefingForm } from '@/components/briefing/BriefingForm';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function NewBriefingPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [context, setContext] = useState<BriefingContext>({
    clientName: '',
    website: '',
    industry: '',
    primaryGoals: '',
    targetAudience: '',
    tone: 'Professional & Results-oriented',
    language: 'dutch',
    rawNotes: '',
    additionalNotes: '',
    monthlyBudget: '',
    campaignTypes: ['search', 'pmax'],
    desiredCampaignCount: 3,
    budgetDistributionPreference: 'Focus on high-intent Search',
    bidStrategyPreference: 'Maximize Conversions (Target CPA)',
    focusProducts: '',
    competitors: '',
    targetLocations: '',
    targetLanguages: '',
    usps: '',
    offer: '',
    negativeKeywordsBase: '',
    conversionValue: '',
  });

  // Handle URL parameters for pre-filling
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    const accountId = searchParams.get('accountId');
    const parentId = searchParams.get('parent');

    if (clientId) {
      setContext(prev => ({ ...prev, parentClientId: clientId }));
    } else if (parentId) {
      setContext(prev => ({ 
        ...prev, 
        parentClientId: parentId,
        childAccountId: accountId || '' 
      }));
    }
  }, [searchParams]);

  const handleExtract = async (notes: string) => {
    if (!notes) {
      toast({ variant: 'destructive', title: 'Plak eerst notes in het veld' });
      return;
    }
    setExtracting(true);
    try {
      const result = await extractBriefingContext(notes, context);
      setContext(prev => ({
        ...prev,
        ...result,
        rawNotes: notes
      }));
      toast({ title: 'AI heeft informatie geëxtraheerd!', description: 'De velden zijn bijgewerkt op basis van je notes.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Extractie mislukt' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (formData?: BriefingContext) => {
    if (!user || !firestore) return;

    const rawContext = formData || context;
    const finalContext = {
      ...rawContext,
      clientName: rawContext.clientName?.trim() || '',
      website: rawContext.website?.trim() || '',
    };

    if (!finalContext.childAccountId) {
      toast({ variant: 'destructive', title: 'Selecteer een account', description: 'Het koppelen van een child account is verplicht.' });
      return;
    }

    if (!finalContext.clientName || !finalContext.website) {
      toast({ variant: 'destructive', title: 'Vul de basisgegevens in', description: 'Klantnaam en Website zijn verplicht.' });
      return;
    }

    setLoading(true);
    try {
      const briefingData = {
        ownerId: user.uid,
        title: `Google Ads Blueprint - ${finalContext.clientName}`,
        context: finalContext,
        campaigns: [],
        status: 'draft',
        shareToken: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(firestore, 'briefings'), briefingData);
      toast({ title: 'Blueprint Architect Gestart!', description: 'Je wordt nu doorgestuurd naar de editor.' });
      router.push(`/dashboard/campaign-briefings/${docRef.id}?auto=true`);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fout bij aanmaken briefing' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <Link 
              href="/dashboard/campaign-briefings"
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-400 transition-colors group"
            >
              <ArrowLeft className="size-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Terug naar overzicht
            </Link>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                <Zap className="size-3" /> Step 1: Strategy & Briefing Gathering
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">
                Campaign <span className="text-blue-500">Architect</span>
              </h1>
              <p className="text-slate-400 font-medium max-w-xl">
                Vul de details in of laat AI je helpen door meeting notes te plakken. Dit vormt de basis voor de volledige Blueprint.
              </p>
            </div>
          </div>
        </div>

        {/* The Form */}
        <BriefingForm 
          context={context}
          onChange={setContext}
          onSubmit={(finalContext) => handleSubmit(finalContext)}
          onExtract={handleExtract}
          loading={loading}
          extracting={extracting}
        />
      </div>
    </div>
  );
}
