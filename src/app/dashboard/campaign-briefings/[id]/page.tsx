'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Briefing, BriefingContext, CampaignBriefing, AdGroupBriefing } from '@/lib/types';
import { generateCampaignStructure } from '@/ai/flows/generate-campaign-structure';
import { generateAdGroups } from '@/ai/flows/generate-ad-groups';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, WandSparkles, Save, ChevronLeft, Trash2, Plus, Type, Key, LayoutGrid } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function CampaignBriefingEditor() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [generatingAdGroupsFor, setGeneratingAdGroupsFor] = useState<string | null>(null);

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
      tone: 'Professional',
      additionalNotes: '',
    },
    campaigns: [],
    status: 'draft',
    shareToken: crypto.randomUUID(), // Initialize token
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
          setBriefing({ id: docSnap.id, ...docSnap.data() } as Briefing);
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

  const handleContextChange = (field: keyof BriefingContext, value: string) => {
    setBriefing(prev => ({ ...prev, context: { ...prev.context, [field]: value } }));
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
        toast({ title: 'Briefing aangemaakt!' });
        router.push(`/dashboard/campaign-briefings/${briefing.id}`);
      } else {
        await updateDoc(docRef, dataToSave);
        toast({ title: 'Briefing opgeslagen!' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Opslaan mislukt' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateStructure = async () => {
    if (!briefing.context.clientName || !briefing.context.website) {
      toast({ variant: 'destructive', title: 'Vul eerst Klantnaam en Website in' });
      return;
    }
    setGeneratingStructure(true);
    try {
      const result = await generateCampaignStructure(briefing.context);
      const newCampaigns: CampaignBriefing[] = result.campaigns.map(c => ({
        ...c,
        adGroups: [],
      }));
      setBriefing(prev => ({ ...prev, campaigns: [...prev.campaigns, ...newCampaigns] }));
      toast({ title: 'Campagnestructuur voorgesteld door AI!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Generatie mislukt' });
    } finally {
      setGeneratingStructure(false);
    }
  };

  const handleGenerateAdGroups = async (campaignId: string) => {
    const campaign = briefing.campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    setGeneratingAdGroupsFor(campaignId);
    try {
      const result = await generateAdGroups({
        context: briefing.context,
        campaign: {
          name: campaign.name,
          type: campaign.type,
          objective: campaign.objective,
        }
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
      toast({ title: 'Ad groups gegenereerd door AI!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Generatie mislukt' });
    } finally {
      setGeneratingAdGroupsFor(null);
    }
  };

  if (loading) return <div className="p-8"><Loader2 className="animate-spin text-blue-500 size-8 mx-auto" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-[#0F172A] py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/campaign-briefings">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ChevronLeft className="size-5" />
            </Button>
          </Link>
          <Input 
            value={briefing.title} 
            onChange={e => setBriefing(prev => ({ ...prev, title: e.target.value }))}
            className="text-2xl font-bold bg-transparent border-none focus-visible:ring-0 text-white w-[400px] px-0 h-auto"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={briefing.status} onValueChange={(val: any) => setBriefing(prev => ({...prev, status: val}))}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Concept</SelectItem>
              <SelectItem value="approved">Goedgekeurd</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500">
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            Opslaan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Context (Sticky) */}
        <div className="lg:col-span-4">
          <Card className="bg-[#1C243A] border-[#2A3552] sticky top-24">
            <CardHeader className="bg-white/5 border-b border-[#2A3552]">
              <CardTitle className="text-lg">Klant Context</CardTitle>
              <CardDescription>Deze input voedt de AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Klantnaam / Merk</Label>
                <Input value={briefing.context.clientName} onChange={e => handleContextChange('clientName', e.target.value)} className="bg-slate-900 border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Website</Label>
                <Input type="url" value={briefing.context.website} onChange={e => handleContextChange('website', e.target.value)} className="bg-slate-900 border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Industrie & Product/Service</Label>
                <Textarea rows={3} value={briefing.context.industry} onChange={e => handleContextChange('industry', e.target.value)} className="bg-slate-900 border-slate-700 resize-none" placeholder="Bv: E-commerce, Verkoop van premium koffiemachines..." />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Primaire Doelen (KPIs)</Label>
                <Input value={briefing.context.primaryGoals} onChange={e => handleContextChange('primaryGoals', e.target.value)} className="bg-slate-900 border-slate-700" placeholder="Bv: ROAS > 400%, of CPA < €50" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Doelgroep</Label>
                <Textarea rows={2} value={briefing.context.targetAudience} onChange={e => handleContextChange('targetAudience', e.target.value)} className="bg-slate-900 border-slate-700 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Taal</Label>
                    <Select value={briefing.context.language} onValueChange={v => handleContextChange('language', v)}>
                        <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dutch">Nederlands</SelectItem>
                            <SelectItem value="english">Engels</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-slate-400 text-xs uppercase tracking-wider font-bold">Tone of Voice</Label>
                    <Input value={briefing.context.tone || ''} onChange={e => handleContextChange('tone', e.target.value)} className="bg-slate-900 border-slate-700" placeholder="Bv: Professioneel, Activerend" />
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Campaigns & Ad Groups */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between bg-[#1C243A] p-4 rounded-2xl border border-[#2A3552]">
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><LayoutGrid className="size-5 text-blue-400"/> Campagnestructuur</h3>
                <p className="text-sm text-slate-400">Gebruik AI om een structuur voor te stellen op basis van de context.</p>
            </div>
            <Button onClick={handleGenerateStructure} disabled={generatingStructure} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/30">
                {generatingStructure ? <Loader2 className="size-4 mr-2 animate-spin" /> : <WandSparkles className="size-4 mr-2" />}
                AI Structuur Suggestie
            </Button>
          </div>

          {briefing.campaigns.length === 0 && !generatingStructure && (
              <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                  <WandSparkles className="size-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">Nog geen campagnes. Genereer een structuur met AI of voeg handmatig toe.</p>
              </div>
          )}

          {briefing.campaigns.map((campaign, cIdx) => (
            <Card key={campaign.id} className="bg-[#1C243A] border-[#2A3552] overflow-hidden">
                <CardHeader className="bg-slate-900/50 border-b border-[#2A3552] p-4">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <Select 
                                    value={campaign.type} 
                                    onValueChange={val => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].type = val as any;
                                        return {...prev, campaigns: nc};
                                    })}
                                >
                                    <SelectTrigger className="w-[120px] h-8 text-xs font-bold bg-slate-800 border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="search">Search</SelectItem>
                                        <SelectItem value="pmax">PMax</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input 
                                    value={campaign.name} 
                                    onChange={e => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].name = e.target.value;
                                        return {...prev, campaigns: nc};
                                    })}
                                    className="font-bold text-lg h-8 bg-transparent border-transparent hover:border-slate-700 px-2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pl-1">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-slate-500">Doelstelling</Label>
                                    <Input value={campaign.objective} onChange={e => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].objective = e.target.value;
                                        return {...prev, campaigns: nc};
                                    })} className="h-7 text-xs bg-slate-900 border-slate-800" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase text-slate-500">Budget Split</Label>
                                    <Input value={campaign.suggestedBudget} onChange={e => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].suggestedBudget = e.target.value;
                                        return {...prev, campaigns: nc};
                                    })} className="h-7 text-xs bg-slate-900 border-slate-800" />
                                </div>
                            </div>
                            <div className="pl-1">
                                <Label className="text-[10px] uppercase text-slate-500">Rationale</Label>
                                <Textarea rows={2} value={campaign.rationale} onChange={e => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].rationale = e.target.value;
                                        return {...prev, campaigns: nc};
                                })} className="text-xs bg-slate-900 border-slate-800 resize-none mt-1" />
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10 hover:text-red-300 h-8"
                                onClick={() => setBriefing(prev => ({...prev, campaigns: prev.campaigns.filter((_, i) => i !== cIdx)}))}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-4 bg-[#141A2B]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-300">Ad Groups & Assets</h4>
                        <Button 
                            size="sm" 
                            className="h-8 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 border border-indigo-500/30 text-xs"
                            onClick={() => handleGenerateAdGroups(campaign.id)}
                            disabled={generatingAdGroupsFor === campaign.id}
                        >
                            {generatingAdGroupsFor === campaign.id ? <Loader2 className="size-3 mr-2 animate-spin" /> : <WandSparkles className="size-3 mr-2" />}
                            AI Suggest Ad Groups
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {campaign.adGroups.map((ag, agIdx) => (
                            <div key={ag.id} className="bg-[#1C243A] rounded-xl border border-slate-700/50 p-4 relative group">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-2 right-2 size-6 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-400"
                                    onClick={() => setBriefing(prev => {
                                        const nc = [...prev.campaigns];
                                        nc[cIdx].adGroups = nc[cIdx].adGroups.filter((_, i) => i !== agIdx);
                                        return {...prev, campaigns: nc};
                                    })}
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                                
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Ad Group Naam</Label>
                                        <Input 
                                            value={ag.name} 
                                            onChange={e => setBriefing(prev => {
                                                const nc = [...prev.campaigns];
                                                nc[cIdx].adGroups[agIdx].name = e.target.value;
                                                return {...prev, campaigns: nc};
                                            })}
                                            className="h-8 bg-slate-900 border-slate-800 mt-1" 
                                        />
                                    </div>
                                    
                                    <Tabs defaultValue="keywords" className="w-full">
                                        <TabsList className="bg-slate-900/50 border border-slate-800 h-9 p-1">
                                            <TabsTrigger value="keywords" className="text-[11px] data-[state=active]:bg-slate-800"><Key className="size-3 mr-1"/> Keywords</TabsTrigger>
                                            <TabsTrigger value="ads" className="text-[11px] data-[state=active]:bg-slate-800"><Type className="size-3 mr-1"/> Ads</TabsTrigger>
                                        </TabsList>
                                        
                                        <TabsContent value="keywords" className="mt-3">
                                            <Textarea 
                                                value={ag.keywords?.join('\n') || ''}
                                                onChange={e => setBriefing(prev => {
                                                    const nc = [...prev.campaigns];
                                                    nc[cIdx].adGroups[agIdx].keywords = e.target.value.split('\n');
                                                    return {...prev, campaigns: nc};
                                                })}
                                                className="h-32 text-xs font-mono bg-slate-900 border-slate-800"
                                                placeholder="Voer keywords in, één per regel..."
                                            />
                                        </TabsContent>
                                        
                                        <TabsContent value="ads" className="mt-3 space-y-3">
                                            <div>
                                                <Label className="text-[10px] uppercase text-slate-500">Koppen</Label>
                                                <Textarea 
                                                    value={ag.headlines.join('\n')}
                                                    onChange={e => setBriefing(prev => {
                                                        const nc = [...prev.campaigns];
                                                        nc[cIdx].adGroups[agIdx].headlines = e.target.value.split('\n');
                                                        return {...prev, campaigns: nc};
                                                    })}
                                                    className="h-24 text-xs bg-slate-900 border-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[10px] uppercase text-slate-500">Beschrijvingen</Label>
                                                <Textarea 
                                                    value={ag.descriptions.join('\n')}
                                                    onChange={e => setBriefing(prev => {
                                                        const nc = [...prev.campaigns];
                                                        nc[cIdx].adGroups[agIdx].descriptions = e.target.value.split('\n');
                                                        return {...prev, campaigns: nc};
                                                    })}
                                                    className="h-24 text-xs bg-slate-900 border-slate-800"
                                                />
                                            </div>
                                            {campaign.type === 'pmax' && ag.longHeadlines && (
                                                 <div>
                                                    <Label className="text-[10px] uppercase text-slate-500">Lange Koppen</Label>
                                                    <Textarea 
                                                        value={ag.longHeadlines.join('\n')}
                                                        onChange={e => setBriefing(prev => {
                                                            const nc = [...prev.campaigns];
                                                            nc[cIdx].adGroups[agIdx].longHeadlines = e.target.value.split('\n');
                                                            return {...prev, campaigns: nc};
                                                        })}
                                                        className="h-24 text-xs bg-slate-900 border-slate-800"
                                                    />
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
          ))}
          
        </div>
      </div>
    </div>
  );
}
