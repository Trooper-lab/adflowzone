'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Briefing, BriefingContext, CampaignBriefing, AdGroupBriefing } from '@/lib/types';
import { generateCampaignStructure } from '@/ai/flows/generate-campaign-structure';
import { generateAdGroups, suggestAdGroups, generateSingleAdGroup } from '@/ai/flows/generate-ad-groups';
import { extractBriefingContext } from '@/ai/flows/extract-briefing-context';
import { AdGroupSuggestion } from '@/lib/types';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, WandSparkles, Save, ChevronLeft, Trash2, Type, Key, LayoutGrid, Briefcase, Globe, Target, Coins, MessageSquareText, FileText, Plus, Users, Euro, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { BlueprintView } from '@/components/briefing/BlueprintView';
import { BriefingForm } from '@/components/briefing/BriefingForm';
import { Separator } from '@/components/ui/separator';

const CAMPAIGN_TYPES = [
  { id: 'search', label: 'Search' },
  { id: 'pmax', label: 'Performance Max' },
  { id: 'display', label: 'Display' },
  { id: 'video', label: 'Video / YouTube' },
  { id: 'shopping', label: 'Standard Shopping' },
];

function AdPreview({ headlines, descriptions, website }: { headlines: string[], descriptions: string[], website: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-slate-100 rounded-full size-6 flex items-center justify-center">
            <Globe className="size-3 text-slate-500" />
        </div>
        <div className="text-[10px] text-slate-500 flex flex-col">
            <span className="font-bold text-slate-700">{website.replace(/^https?:\/\//, '')}</span>
            <span className="opacity-70">Gesponsord</span>
        </div>
      </div>
      <div className="text-blue-700 font-medium text-[16px] leading-tight mb-1 line-clamp-2">
        {(headlines[0] || 'Hoofdkop van de Advertentie') + (headlines[1] ? ' | ' + headlines[1] : '') + (headlines[2] ? ' | ' + headlines[2] : '')}
      </div>
      <div className="text-slate-600 text-xs leading-snug line-clamp-2">
        {descriptions[0] || 'Dit is een voorbeeld van hoe uw advertentie beschrijving eruit zal zien op Google Search.'}
      </div>
    </div>
  );
}

function AssetInput({ value, onChange, placeholder, index }: { value: string, onChange: (val: string) => void, placeholder: string, index: number }) {
    const limit = 30;
    const count = value?.length || 0;
    const isOver = count > limit;
    
    return (
        <div className="relative group">
            <Input 
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={`${placeholder} ${index + 1}`}
                className={`h-9 text-xs bg-slate-900 border-slate-800 pr-12 font-medium ${isOver ? 'border-red-500/50 text-red-200' : 'focus:border-indigo-500/50'} text-slate-200`}
            />
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black tracking-tighter ${isOver ? 'text-red-500' : count > 25 ? 'text-amber-500' : 'text-slate-600'}`}>
                {count}/{limit}
            </div>
        </div>
    );
}

function AssetDescriptionInput({ value, onChange, placeholder, index }: { value: string, onChange: (val: string) => void, placeholder: string, index: number }) {
    const limit = 90;
    const count = value?.length || 0;
    const isOver = count > limit;

    return (
        <div className="relative group">
            <Textarea 
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={`${placeholder} ${index + 1}`}
                className={`h-16 text-xs bg-slate-900 border-slate-800 pr-12 leading-snug resize-none ${isOver ? 'border-red-500/50 text-red-200' : 'focus:border-indigo-500/50'} text-slate-200`}
            />
            <div className={`absolute right-3 bottom-2 text-[9px] font-black tracking-tighter ${isOver ? 'text-red-500' : count > 80 ? 'text-amber-500' : 'text-slate-600'}`}>
                {count}/{limit}
            </div>
        </div>
    );
}

export default function CampaignBriefingEditor() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingAdGroupsFor, setGeneratingAdGroupsFor] = useState<string | null>(null);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [adGroupSuggestions, setAdGroupSuggestions] = useState<Record<string, { title: string, description: string }[]>>({});
  const [manualAdGroup, setManualAdGroup] = useState<Record<string, { title: string, description: string }>>({});
  const [activeTab, setActiveTab] = useState('strategy');

  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);

  const isNew = id === 'new';

  const [briefing, setBriefing] = useState<Briefing>({
    id: isNew ? crypto.randomUUID() : id,
    ownerId: user?.uid || '',
    title: 'Nieuwe Campagne Briefing',
    context: {
      clientName: '',
      website: '',
      industry: '',
      primaryGoals: '',
      targetAudience: '',
      language: 'dutch',
      tone: 'Professional & Results-oriented',
      rawNotes: '',
      additionalNotes: '',
      monthlyBudget: '',
      campaignTypes: ['search', 'pmax'],
      desiredCampaignCount: 3,
      budgetDistributionPreference: '',
    },
    campaigns: [],
    status: 'draft',
    shareToken: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (!firestore || !user) return;
    if (isNew) {
      setBriefing(prev => ({ ...prev, ownerId: user.uid }));
      setLoading(false);
      return;
    }

    const fetchBriefing = async () => {
      try {
        const docRef = doc(firestore, 'briefings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Briefing;
          setBriefing({ ...data, id: docSnap.id });
          if (data.campaigns.length === 0) {
            setActiveTab('strategy');
          } else {
            setActiveTab('editor');
          }
        } else {
          toast({ variant: 'destructive', title: 'Briefing niet gevonden' });
          router.push('/dashboard/campaign-briefings');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBriefing();
  }, [firestore, user, id, isNew, router, toast]);

  const handleContextChange = (field: keyof BriefingContext, value: any) => {
    setBriefing(prev => ({ ...prev, context: { ...prev.context, [field]: value } }));
  };

  const toggleCampaignType = (typeId: string) => {
    const currentTypes = briefing.context.campaignTypes || [];
    const newTypes = currentTypes.includes(typeId)
      ? currentTypes.filter(t => t !== typeId)
      : [...currentTypes, typeId];
    handleContextChange('campaignTypes', newTypes);
  };

  const handleSave = async () => {
    if (!firestore || !user) return;
    setSaving(true);
    try {
      const docRef = doc(firestore, 'briefings', briefing.id);
      const dataToSave = {
        ...briefing,
        updatedAt: new Date().toISOString()
      };
      
      if (isNew) {
        await setDoc(docRef, dataToSave);
        toast({ title: 'Briefing aangemaakt!', description: 'De AI analyseert nu je input...' });
        router.push(`/dashboard/campaign-briefings/${briefing.id}`);
      } else {
        await updateDoc(docRef, dataToSave);
        toast({ title: 'Wijzigingen opgeslagen' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Opslaan mislukt' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateStructure = useCallback(async (overrideContext?: BriefingContext) => {
    const contextToUse = overrideContext || briefing.context;
    
    if (!contextToUse.clientName?.trim() || !contextToUse.website?.trim()) {
      toast({ 
        variant: 'destructive', 
        title: 'Gegevens Ontbreken', 
        description: `Klantnaam en Website zijn verplicht voor AI generatie. Klant: "${contextToUse.clientName}", Website: "${contextToUse.website}".`
      });
      setActiveTab('strategy');
      return;
    }
    setGeneratingStructure(true);
    try {
      const result = await generateCampaignStructure(contextToUse);
      
      const newCampaigns: CampaignBriefing[] = result.campaigns.map(c => ({
        ...c,
        adGroups: [],
      }));

      setBriefing(prev => {
        const updated = { 
          ...prev, 
          campaigns: newCampaigns,
          budgetAllocation: result.budgetAllocation || prev.budgetAllocation,
          bidStrategy: result.bidStrategy || prev.bidStrategy,
          kpis: result.kpis || prev.kpis,
          tracking: result.tracking || prev.tracking,
          timeline: result.timeline || prev.timeline,
          updatedAt: new Date().toISOString()
        };
        
        // Auto-save the generated structure
        if (firestore) {
          const docRef = doc(firestore, 'briefings', updated.id);
          updateDoc(docRef, updated).catch(err => console.error('Auto-save failed:', err));
        }
        
        return updated;
      });
      toast({ title: 'AI heeft een nieuwe campagnestructuur voorgesteld!' });
      setActiveTab('editor');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Genereren mislukt' });
    } finally {
      setGeneratingStructure(false);
    }
  }, [briefing.context, firestore, toast]);

  const handleExtract = useCallback(async (notes: string) => {
    if (!notes) {
      toast({ variant: 'destructive', title: 'Plak eerst notes in het veld' });
      return;
    }
    setExtracting(true);
    try {
      const result = await extractBriefingContext(notes, briefing.context);
      setBriefing(prev => ({ 
        ...prev, 
        context: { ...prev.context, ...result, rawNotes: notes },
        updatedAt: new Date().toISOString()
      }));
      toast({ title: 'Input geanalyseerd!', description: 'De velden zijn ingevuld op basis van je notes.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Analyse mislukt' });
    } finally {
      setExtracting(false);
    }
  }, [briefing.context, toast]);

  // Auto-generate logic
  useEffect(() => {
    const shouldAuto = searchParams.get('auto') === 'true';
    const hasData = briefing.context.clientName?.trim() && briefing.context.website?.trim();
    const noCampaigns = briefing.campaigns.length === 0;

    if (!loading && shouldAuto && hasData && noCampaigns && !hasAutoGenerated) {
      console.log('Auto-generating structure for:', briefing.context.clientName);
      setHasAutoGenerated(true);
      handleGenerateStructure();
    }
  }, [loading, briefing.context.clientName, briefing.context.website, briefing.campaigns.length, hasAutoGenerated, searchParams, handleGenerateStructure]);

  const handleSuggestAdGroups = async (campaignId: string) => {
    const campaign = briefing.campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    setSuggestingFor(campaignId);
    try {
      const result = await suggestAdGroups({
        context: briefing.context,
        campaign: {
          name: campaign.name,
          type: campaign.type,
          objective: campaign.objective,
        },
        existingAdGroups: campaign.adGroups.map(ag => ag.name)
      });
      setAdGroupSuggestions(prev => ({ ...prev, [campaignId]: result.suggestions }));
      toast({ title: 'Suggesties gegenereerd!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Suggesties mislukt' });
    } finally {
      setSuggestingFor(null);
    }
  };

  const handleGenerateSingleAdGroup = async (campaignId: string, title: string, description: string) => {
    if (!title) {
        toast({ variant: 'destructive', title: 'Geef eerst een titel op' });
        return;
    }
    const campaign = briefing.campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    setGeneratingAdGroupsFor(campaignId);
    try {
      const result = await generateSingleAdGroup({
        context: briefing.context,
        campaign: {
          name: campaign.name,
          type: campaign.type,
          objective: campaign.objective,
        },
        adGroupTitle: title,
        adGroupDescription: description
      });
      
      const generatedAdGroups: AdGroupBriefing[] = result.adGroups.map(ag => ({
          ...ag,
          id: ag.id || crypto.randomUUID()
      }));

      setBriefing(prev => ({
        ...prev,
        campaigns: prev.campaigns.map(c => 
          c.id === campaignId ? { ...c, adGroups: [...c.adGroups, ...generatedAdGroups] } : c
        )
      }));
      
      // Clear suggestions and manual input for this campaign
      setAdGroupSuggestions(prev => {
          const next = { ...prev };
          delete next[campaignId];
          return next;
      });
      setManualAdGroup(prev => {
          const next = { ...prev };
          delete next[campaignId];
          return next;
      });

      toast({ title: 'Ad group gegenereerd!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Generatie mislukt' });
    } finally {
      setGeneratingAdGroupsFor(null);
    }
  };


  if (loading) return <div className="p-8"><Loader2 className="animate-spin text-blue-500 size-8 mx-auto" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 bg-[#0F172A]/95 backdrop-blur-md py-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/campaign-briefings">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white shrink-0">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <div className="space-y-1">
            <Input 
              value={briefing.title} 
              onChange={e => setBriefing(prev => ({ ...prev, title: e.target.value }))}
              className="text-xl md:text-2xl font-bold bg-transparent border-none focus-visible:ring-0 text-white w-full md:w-[400px] px-0 h-auto"
            />
            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              <div className={`w-2 h-2 rounded-full ${briefing.status === 'approved' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
              {briefing.status === 'approved' ? 'Goedgekeurd' : 'Concept Fase'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={briefing.status} onValueChange={(val: any) => setBriefing(prev => ({...prev, status: val}))}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 h-10 text-xs font-bold uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="draft" className="text-xs font-bold uppercase tracking-wider">Concept</SelectItem>
              <SelectItem value="approved" className="text-xs font-bold uppercase tracking-wider">Goedgekeurd</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white h-11 px-8 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]">
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            Briefing Opslaan
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-center md:justify-start mb-8 border-b border-slate-800 pb-px">
          <TabsList className="bg-transparent border-none gap-8 h-12 p-0">
            <TabsTrigger value="strategy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 text-slate-400 hover:text-slate-200 font-bold px-0 gap-2 h-12">
                <Briefcase className="size-4" /> Strategie & Context
            </TabsTrigger>
            <TabsTrigger value="editor" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 text-slate-400 hover:text-slate-200 font-bold px-0 gap-2 h-12">
                <LayoutGrid className="size-4" /> Campagne Editor
            </TabsTrigger>
            <TabsTrigger value="blueprint" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 text-slate-400 hover:text-slate-200 font-bold px-0 gap-2 h-12">
                <FileText className="size-4" /> Blueprint Preview
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: STRATEGY & CONTEXT */}
        <TabsContent value="strategy" className="mt-0 animate-in fade-in slide-in-from-left-4 duration-500">
          <BriefingForm 
            key={briefing.updatedAt + (briefing.context.clientName || '')}
            initialData={briefing.context}
            onSubmit={(newContext) => {
              setBriefing(prev => ({ ...prev, context: newContext }));
              handleGenerateStructure(newContext);
            }}
            onExtract={handleExtract}
            loading={generatingStructure}
            extracting={extracting}
            submitLabel="Update Strategy & Generate Structure"
          />
        </TabsContent>

        {/* TAB 2: EDITOR */}
        <TabsContent value="editor" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="space-y-8">
            {/* Global Strategy Editor Quick Access */}
            <Card className="bg-[#1C243A] border-[#2A3552] overflow-hidden shadow-xl">
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                            <Target className="size-4 text-emerald-400"/>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">Strategische Focus & USPs</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global context voor alle campagnes</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Strategische Doelen</Label>
                            <Textarea 
                                value={briefing.context.primaryGoals}
                                onChange={e => setBriefing(prev => ({ ...prev, context: { ...prev.context, primaryGoals: e.target.value } }))}
                                className="h-24 text-xs bg-slate-900 border-slate-800 text-slate-200"
                                placeholder="Wat zijn de hoofddoelen?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Belangrijkste USPs</Label>
                            <Textarea 
                                value={briefing.context.usps}
                                onChange={e => setBriefing(prev => ({ ...prev, context: { ...prev.context, usps: e.target.value } }))}
                                className="h-24 text-xs bg-slate-900 border-slate-800 text-slate-200"
                                placeholder="Wat maakt dit project uniek?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Doelgroep Omschrijving</Label>
                            <Textarea 
                                value={briefing.context.targetAudience}
                                onChange={e => setBriefing(prev => ({ ...prev, context: { ...prev.context, targetAudience: e.target.value } }))}
                                className="h-24 text-xs bg-slate-900 border-slate-800 text-slate-200"
                                placeholder="Wie willen we bereiken?"
                            />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <LayoutGrid className="size-5 text-indigo-400"/> Campagnestructuur
                    </h3>
                    <p className="text-sm text-slate-400">Beheer de door AI voorgestelde campagnes en advertentiegroepen.</p>
                </div>
                <Button 
                    onClick={handleGenerateStructure} 
                    disabled={generatingStructure} 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs h-11 px-6 rounded-xl shadow-lg shadow-indigo-900/40 transition-all hover:scale-[1.02]"
                >
                    {generatingStructure ? <Loader2 className="size-4 mr-2 animate-spin" /> : <WandSparkles className="size-4 mr-2" />}
                    Hergenereer Structuur
                </Button>
            </div>

            {briefing.campaigns.length === 0 && !generatingStructure && (
              <div className="text-center py-20 bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-800">
                <div className="bg-slate-800/50 size-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <WandSparkles className="size-8 text-slate-600" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Nog geen campagnes</h4>
                <p className="text-slate-500 max-w-sm mx-auto mb-8">Vul eerst de strategie in en laat AI een voorstel doen, of voeg handmatig een campagne toe.</p>
                <Button onClick={() => setActiveTab('strategy')} className="bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest text-xs h-12 px-8">Terug naar Strategie</Button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8">
              {briefing.campaigns.map((campaign, cIdx) => (
                <Card key={campaign.id} className="bg-[#1C243A] border-[#2A3552] overflow-hidden shadow-xl">
                  <CardHeader className="bg-slate-900/80 border-b border-[#2A3552] p-6">
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                            <Badge className={`h-7 px-3 text-[10px] font-black uppercase tracking-widest ${campaign.type === 'search' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'}`}>
                                {campaign.type}
                            </Badge>
                            <Input 
                                value={campaign.name} 
                                onChange={e => setBriefing(prev => {
                                    const nc = [...prev.campaigns];
                                    nc[cIdx].name = e.target.value;
                                    return {...prev, campaigns: nc};
                                })}
                                className="font-black text-xl md:text-2xl h-10 bg-transparent border-transparent hover:border-slate-700 px-0 focus-visible:ring-0 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Doelstelling</Label>
                            <Input value={campaign.objective} onChange={e => setBriefing(prev => {
                                const nc = [...prev.campaigns];
                                nc[cIdx].objective = e.target.value;
                                return {...prev, campaigns: nc};
                            })} className="h-9 text-sm bg-slate-900 border-slate-800" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Aanbevolen Budget</Label>
                            <Input value={campaign.suggestedBudget} onChange={e => setBriefing(prev => {
                                const nc = [...prev.campaigns];
                                nc[cIdx].suggestedBudget = e.target.value;
                                return {...prev, campaigns: nc};
                            })} className="h-9 text-sm bg-slate-900 border-slate-800 font-mono" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Campagnetype</Label>
                            <Select 
                                value={campaign.type} 
                                onValueChange={val => setBriefing(prev => {
                                    const nc = [...prev.campaigns];
                                    nc[cIdx].type = val as any;
                                    return {...prev, campaigns: nc};
                                })}
                            >
                                <SelectTrigger className="h-9 text-sm bg-slate-900 border-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="search">Search</SelectItem>
                                    <SelectItem value="pmax">Performance Max</SelectItem>
                                </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Strategische Rationale</Label>
                            <Textarea rows={16} value={campaign.rationale} onChange={e => setBriefing(prev => {
                                const nc = [...prev.campaigns];
                                nc[cIdx].rationale = e.target.value;
                                return {...prev, campaigns: nc};
                            })} className="text-sm bg-slate-900 border-slate-800 resize-none mt-1.5 leading-relaxed" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                        onClick={() => setBriefing(prev => ({...prev, campaigns: prev.campaigns.filter((_, i) => i !== cIdx)}))}
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6 bg-[#141A2B]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                                <LayoutGrid className="size-4 text-indigo-400"/>
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white uppercase tracking-wider">Ad Groups & Assets</h4>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Definieer advertentiegroepen en copy</p>
                            </div>
                        </div>
                        <Button 
                            size="sm" 
                            variant="outline"
                            className="h-9 border-slate-700 bg-slate-900/50 text-slate-200 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-xl px-6"
                            onClick={() => handleSuggestAdGroups(campaign.id)}
                            disabled={suggestingFor === campaign.id || generatingAdGroupsFor === campaign.id}
                        >
                            {suggestingFor === campaign.id ? <Loader2 className="size-3 mr-2 animate-spin" /> : <WandSparkles className="size-3 mr-2" />}
                            AI Suggesties Opvragen
                        </Button>
                    </div>

                    {/* Ad Group Wizard UI */}
                    {(adGroupSuggestions[campaign.id] || suggestingFor === campaign.id) && (
                        <Card className="bg-slate-950/40 border-slate-800/50 mb-8 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                             <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ad Group Wizard</span>
                                </div>
                                <Button variant="ghost" size="sm" className="h-6 text-[9px] uppercase font-bold text-slate-600 hover:text-slate-400" 
                                    onClick={() => setAdGroupSuggestions(prev => {
                                        const n = {...prev};
                                        delete n[campaign.id];
                                        return n;
                                    })}
                                >
                                    Annuleren
                                </Button>
                             </div>
                             <div className="p-6">
                                {suggestingFor === campaign.id ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                                        <Loader2 className="size-8 text-indigo-500 animate-spin" />
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">AI analyseert campagnes...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                        {(adGroupSuggestions[campaign.id] || []).map((s, idx) => (
                                            <div key={idx} className="group relative flex flex-col h-full bg-slate-900/40 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all p-5">
                                                <div className="flex-1 space-y-2 mb-4">
                                                    <h5 className="text-xs font-black text-indigo-400 uppercase tracking-wider">{s.title}</h5>
                                                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{s.description}</p>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    className="w-full bg-indigo-600/10 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest h-9"
                                                    onClick={() => handleGenerateSingleAdGroup(campaign.id, s.title, s.description)}
                                                    disabled={generatingAdGroupsFor === campaign.id}
                                                >
                                                    {generatingAdGroupsFor === campaign.id ? <Loader2 className="size-3 animate-spin" /> : 'Kies deze'}
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="bg-slate-900/20 rounded-2xl border border-dashed border-slate-800 p-5 flex flex-col gap-3">
                                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider">Eigen Input</h5>
                                            <Input 
                                                placeholder="Naam..." 
                                                className="h-9 text-xs bg-slate-950 border-slate-800"
                                                value={manualAdGroup[campaign.id]?.title || ''}
                                                onChange={e => setManualAdGroup(prev => ({ ...prev, [campaign.id]: { ...(prev[campaign.id] || {title:'', description:''}), title: e.target.value } }))}
                                            />
                                            <Textarea 
                                                placeholder="Focus/Thema..." 
                                                className="h-14 text-xs bg-slate-950 border-slate-800 resize-none leading-tight"
                                                value={manualAdGroup[campaign.id]?.description || ''}
                                                onChange={e => setManualAdGroup(prev => ({ ...prev, [campaign.id]: { ...(prev[campaign.id] || {title:'', description:''}), description: e.target.value } }))}
                                            />
                                            <Button 
                                                size="sm" 
                                                variant="outline"
                                                className="w-full border-slate-700 text-[10px] font-black uppercase tracking-widest h-9 hover:bg-indigo-600 hover:text-white"
                                                onClick={() => handleGenerateSingleAdGroup(campaign.id, manualAdGroup[campaign.id]?.title, manualAdGroup[campaign.id]?.description)}
                                                disabled={generatingAdGroupsFor === campaign.id}
                                            >
                                                 {generatingAdGroupsFor === campaign.id ? <Loader2 className="size-3 animate-spin" /> : 'Genereer'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </Card>
                    )}


                    <div className="grid grid-cols-1 gap-6">
                      {campaign.adGroups.map((ag, agIdx) => (
                        <div key={ag.id} className="bg-[#1C243A] rounded-2xl border border-slate-700/50 p-5 relative group shadow-sm">
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-3 right-3 size-7 text-slate-400 opacity-50 group-hover:opacity-100 transition-all hover:bg-red-500/20 hover:text-red-400 border border-transparent hover:border-red-500/30"
                              onClick={() => setBriefing(prev => {
                                  const nc = [...prev.campaigns];
                                  nc[cIdx].adGroups = nc[cIdx].adGroups.filter((_, i) => i !== agIdx);
                                  return {...prev, campaigns: nc};
                              })}
                          >
                              <Trash2 className="size-4" />
                          </Button>
                          
                          <div className="space-y-8">
                                {/* ROW 1: Keywords & Preview */}
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                    <div className="xl:col-span-2 space-y-2">
                                        <Label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-2">
                                            <Key className="size-3" />
                                            {campaign.type === 'search' ? 'Zoekwoorden (één per regel)' : 'Search Themes / Assets'}
                                        </Label>
                                        <Textarea 
                                            value={ag.keywords?.join('\n') || ''}
                                            onChange={e => setBriefing(prev => {
                                                const nc = [...prev.campaigns];
                                                nc[cIdx].adGroups[agIdx].keywords = e.target.value.split('\n');
                                                return {...prev, campaigns: nc};
                                            })}
                                            className="h-48 text-xs font-mono bg-slate-950 border-slate-800 leading-relaxed text-slate-200 focus:border-indigo-500/50"
                                            placeholder="Voer keywords in..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-2">
                                            <Globe className="size-3" /> Advertentie Preview
                                        </Label>
                                        <div className="bg-slate-950/30 rounded-2xl border border-slate-800/50 p-6 h-[192px] flex items-center justify-center">
                                            <AdPreview 
                                                headlines={ag.headlines} 
                                                descriptions={ag.descriptions} 
                                                website={briefing.context.website || 'www.jouwwebsite.nl'} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-slate-800/50" />

                                {/* ROW 2: Descriptions */}
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase text-indigo-400 font-black tracking-[0.15em] flex items-center gap-2">
                                        <Type className="size-3" /> Beschrijvingen (max 90 tekens)
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[0, 1, 2, 3].map(i => (
                                            <AssetDescriptionInput 
                                                key={i}
                                                index={i}
                                                value={ag.descriptions[i] || ''}
                                                placeholder="Beschrijving"
                                                onChange={val => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    const current = [...nc[cIdx].adGroups[agIdx].descriptions];
                                                    current[i] = val;
                                                    nc[cIdx].adGroups[agIdx].descriptions = current;
                                                    return {...prev, campaigns: nc};
                                                })}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* ROW 3: Headlines */}
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase text-blue-400 font-black tracking-[0.15em] flex items-center gap-2">
                                        <Type className="size-3" /> Koppen (max 30 tekens)
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[0, 1, 2].map(colIdx => (
                                            <div key={colIdx} className="space-y-2 bg-slate-950/20 p-4 rounded-2xl border border-slate-800/50">
                                                <div className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">Groep {colIdx + 1}</div>
                                                <div className="space-y-2">
                                                    {[0, 1, 2, 3, 4].map(i => (
                                                        <AssetInput 
                                                            key={i}
                                                            index={colIdx * 5 + i}
                                                            value={ag.headlines[colIdx * 5 + i] || ''}
                                                            placeholder="Kop"
                                                            onChange={val => setBriefing(prev => {
                                                                const nc = [...prev.campaigns];
                                                                const current = [...nc[cIdx].adGroups[agIdx].headlines];
                                                                current[colIdx * 5 + i] = val;
                                                                nc[cIdx].adGroups[agIdx].headlines = current;
                                                                return {...prev, campaigns: nc};
                                                            })}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ROW 4: Audience Signals */}
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase text-emerald-400 font-black tracking-[0.15em] flex items-center gap-2">
                                        <Users className="size-3" /> Doelgroep Signalen (Audience)
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80">
                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase text-slate-300 font-black tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                                                Custom Intent
                                            </span>
                                            <Textarea 
                                                value={ag.audienceSignals?.customIntent?.join('\n') || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].audienceSignals = {
                                                        ...(nc[cIdx].adGroups[agIdx].audienceSignals || { customIntent: [], inMarket: [], customerMatch: [], demographics: '' }),
                                                        customIntent: e.target.value.split('\n')
                                                    };
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-24 text-[11px] bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500/30"
                                                placeholder="Interesses, zoektermen..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase text-slate-300 font-black tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                                                In-Market
                                            </span>
                                            <Textarea 
                                                value={ag.audienceSignals?.inMarket?.join('\n') || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].audienceSignals = {
                                                        ...(nc[cIdx].adGroups[agIdx].audienceSignals || { customIntent: [], inMarket: [], customerMatch: [], demographics: '' }),
                                                        inMarket: e.target.value.split('\n')
                                                    };
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-24 text-[11px] bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500/30"
                                                placeholder="Koopintentie categorieën..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase text-slate-300 font-black tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                                                Customer Match
                                            </span>
                                            <Textarea 
                                                value={ag.audienceSignals?.customerMatch?.join('\n') || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].audienceSignals = {
                                                        ...(nc[cIdx].adGroups[agIdx].audienceSignals || { customIntent: [], inMarket: [], customerMatch: [], demographics: '' }),
                                                        customerMatch: e.target.value.split('\n')
                                                    };
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-24 text-[11px] bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500/30"
                                                placeholder="Eigen data lijsten..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase text-slate-300 font-black tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                                                Demografie
                                            </span>
                                            <Input 
                                                value={ag.audienceSignals?.demographics || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].audienceSignals = {
                                                        ...(nc[cIdx].adGroups[agIdx].audienceSignals || { customIntent: [], inMarket: [], customerMatch: [], demographics: '' }),
                                                        demographics: e.target.value
                                                    };
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-10 text-[11px] bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500/30"
                                                placeholder="Leeftijd, geslacht, inkomen..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {campaign.type === 'pmax' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-800/50">
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase text-purple-400 font-black tracking-[0.15em] flex items-center gap-2">
                                                <Type className="size-3" /> PMax Lange Koppen (max 5)
                                            </Label>
                                            <div className="space-y-2 bg-slate-950/20 p-4 rounded-2xl border border-slate-800/50">
                                                {[0, 1, 2, 3, 4].map(i => (
                                                    <div key={i} className="relative">
                                                        <Input 
                                                            value={ag.longHeadlines?.[i] || ''}
                                                            onChange={e => setBriefing(prev => {
                                                                const nc = [...prev.campaigns];
                                                                const current = [...(nc[cIdx].adGroups[agIdx].longHeadlines || [])];
                                                                current[i] = e.target.value;
                                                                nc[cIdx].adGroups[agIdx].longHeadlines = current;
                                                                return {...prev, campaigns: nc};
                                                            })}
                                                            placeholder={`Lange Kop ${i+1}`}
                                                            className="h-9 text-xs bg-slate-900 border-slate-800 pr-12 text-slate-200 focus:border-purple-500/30"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-black">
                                                            {ag.longHeadlines?.[i]?.length || 0}/90
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase text-purple-400 font-black tracking-[0.15em] flex items-center gap-2">
                                                <LayoutGrid className="size-3" /> PMax Image Prompts
                                            </Label>
                                            <Textarea 
                                                value={ag.imagePrompts?.join('\n') || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].imagePrompts = e.target.value.split('\n');
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-full min-h-[160px] text-xs bg-slate-950 border-slate-800 text-slate-200 focus:border-purple-500/30 leading-relaxed"
                                                placeholder="Beschrijf beelden voor deze asset group..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="h-auto py-12 border-dashed border-2 border-slate-700 bg-slate-900/10 hover:bg-slate-800/20 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-white transition-all hover:border-slate-500"
                        onClick={() => setBriefing(prev => {
                            const nc = [...prev.campaigns];
                            nc[cIdx].adGroups.push({
                                id: crypto.randomUUID(),
                                name: 'Nieuwe Ad Group',
                                headlines: [],
                                descriptions: [],
                                keywords: []
                            });
                            return {...prev, campaigns: nc};
                        })}
                      >
                        <div className="bg-slate-800/50 p-3 rounded-full group-hover:bg-slate-700">
                            <Plus className="size-6" />
                        </div>
                        <span className="font-black uppercase tracking-widest text-xs text-slate-200">Handmatig toevoegen</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button 
                variant="outline" 
                className="h-32 border-dashed border-2 border-slate-700 bg-slate-900/10 hover:bg-slate-800/20 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-white transition-all group hover:border-blue-500/50"
                onClick={() => setBriefing(prev => ({
                    ...prev,
                    campaigns: [...prev.campaigns, {
                        id: crypto.randomUUID(),
                        name: 'Nieuwe Campagne',
                        type: 'search',
                        objective: '',
                        suggestedBudget: '',
                        rationale: '',
                        adGroups: []
                    }]
                }))}
              >
                <div className="bg-slate-800/50 p-3 rounded-full group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all">
                    <Plus className="size-8" />
                </div>
                <span className="font-bold uppercase tracking-widest text-xs">Nieuwe Campagne Toevoegen</span>
              </Button>

              {/* TRACKING & DATA EDITOR */}
              <div className="mt-12 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                        <Target className="size-4 text-purple-400"/>
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Tracking & Data Setup</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Beheer conversie doelen en tracking methodes</p>
                    </div>
                </div>
                
                <Card className="bg-[#1C243A] border-[#2A3552] overflow-hidden">
                    <div className="divide-y divide-slate-800">
                        {(briefing.tracking || []).map((t, tIdx) => (
                            <div key={tIdx} className="p-4 flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Conversie Doel</Label>
                                        <Input 
                                            value={t.goal} 
                                            onChange={e => setBriefing(prev => {
                                                const nt = [...(prev.tracking || [])];
                                                nt[tIdx].goal = e.target.value;
                                                return {...prev, tracking: nt};
                                            })}
                                            className="h-10 text-sm bg-slate-950 border-slate-700 text-white focus:ring-2 focus:ring-purple-500/20" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Tracking Methode</Label>
                                        <Input 
                                            value={t.method} 
                                            onChange={e => setBriefing(prev => {
                                                const nt = [...(prev.tracking || [])];
                                                nt[tIdx].method = e.target.value;
                                                return {...prev, tracking: nt};
                                            })}
                                            className="h-10 text-sm bg-slate-950 border-slate-700 text-white focus:ring-2 focus:ring-purple-500/20" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Prioriteit</Label>
                                        <Select 
                                            value={t.priority} 
                                            onValueChange={val => setBriefing(prev => {
                                                const nt = [...(prev.tracking || [])];
                                                nt[tIdx].priority = val as any;
                                                return {...prev, tracking: nt};
                                            })}
                                        >
                                            <SelectTrigger className="h-10 text-sm bg-slate-950 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="low">Low</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                                    onClick={() => setBriefing(prev => ({
                                        ...prev,
                                        tracking: prev.tracking?.filter((_, i) => i !== tIdx)
                                    }))}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        ))}
                        
                        <div className="p-4">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-slate-700 bg-slate-900/50 text-slate-400 hover:text-white font-bold uppercase tracking-widest text-[10px]"
                                onClick={() => setBriefing(prev => ({
                                    ...prev,
                                    tracking: [...(prev.tracking || []), { goal: '', method: 'GTM / GA4', priority: 'medium' }]
                                }))}
                            >
                                <Plus className="size-3 mr-2" /> Doel Toevoegen
                            </Button>
                        </div>
                    </div>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: BLUEPRINT */}
        <TabsContent value="blueprint" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
           <BlueprintView 
            briefing={briefing} 
            onStatusChange={(status) => setBriefing(prev => ({ ...prev, status }))}
           />
        </TabsContent>
      </Tabs>
    </div>
  );
}
