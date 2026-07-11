'use client';

import { useState, useEffect } from 'react';
import { BriefingContext, ParentClient, ChildAccount } from '@/lib/types';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Target, 
  Users, 
  Zap, 
  MessageSquareText, 
  Globe, 
  Coins, 
  WandSparkles, 
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Lock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Check
} from 'lucide-react';

const CAMPAIGN_TYPES = [
  { id: 'search', label: 'Google Search' },
  { id: 'pmax', label: 'Performance Max' },
  { id: 'meta', label: 'Meta Ads (Facebook & Instagram)' },
  { id: 'linkedin', label: 'LinkedIn Ads' },
  { id: 'display', label: 'Google Display' },
  { id: 'video', label: 'YouTube Video' },
  { id: 'shopping', label: 'Standard Shopping' },
];

interface BriefingFormProps {
  context: BriefingContext;
  onChange: (data: BriefingContext) => void;
  onSubmit: (data: BriefingContext) => void;
  onExtract: (notes: string) => Promise<void>;
  loading?: boolean;
  extracting?: boolean;
  submitLabel?: string;
}

export function BriefingForm({ 
  context, 
  onChange,
  onSubmit, 
  onExtract, 
  loading, 
  extracting,
  submitLabel = 'Ga naar Editor'
}: BriefingFormProps) {

  const { user } = useUser();
  const firestore = useFirestore();
  const [formTab, setFormTab] = useState<string>(context.childAccountId ? 'details' : 'ai');

  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [childSearch, setChildSearch] = useState('');
  const [showChildDropdown, setShowChildDropdown] = useState(false);

  useEffect(() => {
    if (!firestore || !user) return;
    const loadAllChildAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const clientsSnap = await getDocs(collection(firestore, 'parentClients'));
        const clientsList = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const accountsPromises = clientsList.map(async (c) => {
          const accSnap = await getDocs(collection(firestore, 'parentClients', c.id, 'childAccounts'));
          return accSnap.docs.map(d => ({
            id: d.id,
            parentId: c.id,
            parentName: (c as any).clientName || '',
            ...d.data()
          }));
        });
        
        const results = await Promise.all(accountsPromises);
        setAllAccounts(results.flat());
      } catch (e) {
        console.error("Error loading all child accounts:", e);
      } finally {
        setLoadingAccounts(false);
      }
    };
    loadAllChildAccounts();
  }, [firestore, user]);

  useEffect(() => {
    if (context.childAccountId && allAccounts.length > 0) {
      const match = allAccounts.find(a => a.id === context.childAccountId);
      if (match) {
        setChildSearch(match.nickname || match.name || '');
        if (!context.clientName || !context.website) {
          onChange({
            ...context,
            clientName: match.nickname || match.name || '',
            website: match.website || match.clientWebsite || context.website || 'https://default.com',
            parentClientId: match.parentId
          });
        }
      }
    }
  }, [context.childAccountId, allAccounts]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.child-dropdown-container')) {
        setShowChildDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const filteredAccounts = allAccounts.filter(acc => 
    (acc.nickname || '').toLowerCase().includes(childSearch.toLowerCase()) ||
    (acc.parentName || '').toLowerCase().includes(childSearch.toLowerCase())
  );

  const handleChange = (field: keyof BriefingContext, value: any) => {
    onChange({ ...context, [field]: value });
  };

  const toggleCampaignType = (id: string) => {
    onChange({
      ...context,
      campaignTypes: context.campaignTypes?.includes(id)
        ? context.campaignTypes.filter(t => t !== id)
        : [...(context.campaignTypes || []), id]
    });
  };

  const isGoogleEnabled = context.campaignTypes?.some(t => ['search', 'pmax', 'display', 'video'].includes(t));
  const isMetaEnabled = context.campaignTypes?.includes('meta');
  const isLinkedinEnabled = context.campaignTypes?.includes('linkedin');

  const toggleChannel = (channel: 'google' | 'meta' | 'linkedin') => {
    let current = context.campaignTypes || [];
    if (channel === 'google') {
      const hasGoogle = current.some(t => ['search', 'pmax', 'display', 'video'].includes(t));
      if (hasGoogle) {
        current = current.filter(t => !['search', 'pmax', 'display', 'video'].includes(t));
      } else {
        current = [...current, 'search', 'pmax'];
      }
    } else if (channel === 'meta') {
      if (current.includes('meta')) {
        current = current.filter(t => t !== 'meta');
      } else {
        current = [...current, 'meta'];
      }
    } else if (channel === 'linkedin') {
      if (current.includes('linkedin')) {
        current = current.filter(t => t !== 'linkedin');
      } else {
        current = [...current, 'linkedin'];
      }
    }
    onChange({ ...context, campaignTypes: current });
  };

  return (
    <Tabs value={formTab} onValueChange={setFormTab} className="w-full space-y-8">
      {/* Tabs navigation header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <TabsList className="bg-slate-900/60 border border-slate-800/80 p-1 h-12 rounded-xl">
          <TabsTrigger value="ai" className="px-6 h-10 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 hover:text-white transition-all">
            <Sparkles className="size-3.5" />
            AI Co-Pilot (Notes)
          </TabsTrigger>
          <TabsTrigger value="details" className="px-6 h-10 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 hover:text-white transition-all">
            <Building2 className="size-3.5" />
            Details & Instellingen
          </TabsTrigger>
        </TabsList>
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">
          {formTab === 'ai' ? 'Snel invullen met AI' : 'Tweak handmatig alle parameters'}
        </span>
      </div>

      {/* TAB A: AI CO-PILOT */}
      <TabsContent value="ai" className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquareText className="size-5 text-blue-400" /> Ruwe informatie extraheren
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Plak hier meeting notes, e-mails of klantnotities. De AI analyseert de tekst en vult alle velden (zoals USPs, budget en kanalen) automatisch voor je in.
                </p>
              </div>

              <div className="relative group">
                <Textarea 
                  placeholder="Plak hier je ruwe informatie, e-mails, transcripties..." 
                  value={context.rawNotes || ''}
                  onChange={e => handleChange('rawNotes', e.target.value)}
                  className="bg-slate-950/40 border-slate-800 min-h-[380px] font-sans text-sm leading-relaxed focus:border-blue-500/50 text-white resize-none rounded-xl"
                />
              </div>

              <div className="flex justify-between items-center gap-4 pt-3 border-t border-slate-800/60">
                <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  Veilige Enterprise AI-extractie
                </div>
                <Button 
                  onClick={async () => {
                    await onExtract(context.rawNotes || '');
                    setFormTab('details');
                  }} 
                  disabled={extracting || !context.rawNotes}
                  className="bg-blue-600 hover:bg-blue-500 text-white h-12 px-8 font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:scale-105 transition-all"
                >
                  {extracting ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                  Analyseren & Details Invullen
                </Button>
              </div>
            </Card>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-slate-900/40 border-slate-800 p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Hoe werkt de AI Co-Pilot?</h4>
              <ol className="text-xs text-slate-500 space-y-3 list-decimal list-inside leading-relaxed">
                <li>Plak je ruwe aantekeningen of mails in het veld.</li>
                <li>Klik op <strong>Analyseren & Details Invullen</strong>.</li>
                <li>Onze AI haalt alle doelen, USPs, budgetten en doelgroep-details eruit.</li>
                <li>Je wordt automatisch doorgestuurd naar het **Details** tabblad waar je alles kunt controleren en opslaan.</li>
              </ol>
            </Card>
            
            <Button
              variant="outline"
              onClick={() => setFormTab('details')}
              className="w-full h-12 border-slate-800 bg-slate-900/50 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white"
            >
              Handmatig invullen zonder AI →
            </Button>
          </div>
        </div>
      </TabsContent>

      {/* TAB B: DETAILS & INSTELLINGEN */}
      <TabsContent value="details" className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Form Fields */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Card 1: Klant & Identiteit */}
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden group">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Building2 className="size-5 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">1. Klant & Platform</h2>
                </div>

                <div className="space-y-4">
                  {/* Combobox Search Selector */}
                  <div className="space-y-2 relative child-dropdown-container">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Child Account selecteren *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Typ om te zoeken..."
                        value={childSearch}
                        onChange={e => {
                          setChildSearch(e.target.value);
                          setShowChildDropdown(true);
                        }}
                        onFocus={() => setShowChildDropdown(true)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-white"
                      />
                      {context.childAccountId && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setChildSearch('');
                            onChange({
                              ...context,
                              childAccountId: '',
                              parentClientId: '',
                              clientName: ''
                            });
                          }}
                          className="h-10 text-xs border-slate-800 bg-slate-950/20 text-slate-400 hover:text-white"
                        >
                          Wissen
                        </Button>
                      )}
                    </div>

                    {showChildDropdown && (
                      <div className="absolute z-50 w-full mt-1.5 bg-slate-900 border border-slate-755 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                        {loadingAccounts ? (
                          <div className="p-3 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                            <Loader2 className="size-3 animate-spin text-blue-500" />
                            Accounts laden...
                          </div>
                        ) : filteredAccounts.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">Geen accounts gevonden</div>
                        ) : (
                          filteredAccounts.map(acc => (
                            <div
                              key={acc.id}
                              onClick={() => {
                                onChange({
                                  ...context,
                                  childAccountId: acc.id,
                                  parentClientId: acc.parentId,
                                  clientName: acc.nickname || acc.name || '',
                                  website: acc.website || acc.clientWebsite || context.website || 'https://default.com'
                                });
                                setChildSearch(acc.nickname || acc.name || '');
                                setShowChildDropdown(false);
                              }}
                              className="p-3 text-xs text-slate-350 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors flex justify-between items-center"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-205">{acc.nickname}</span>
                                <span className="text-[10px] text-slate-500">{acc.parentName}</span>
                              </div>
                              {context.childAccountId === acc.id && (
                                <Check className="size-3 text-blue-500" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {context.childAccountId ? (
                    <div className="text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="size-3.5" />
                      <span>Gekoppeld aan <strong>{context.clientName}</strong> ({allAccounts.find(a => a.id === context.childAccountId)?.parentName || ''}).</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                      <span>Selecteer een child account om door te kunnen gaan. Koppelen is verplicht.</span>
                    </div>
                  )}

                  {/* Pre-filled name & settings details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Klantnaam (Blueprint Focus)</Label>
                      <Input 
                        placeholder="Naam van de klant" 
                        value={context.clientName || ''}
                        onChange={e => handleChange('clientName', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blueprint Taal</Label>
                      <Select value={context.language} onValueChange={(v: any) => handleChange('language', v)}>
                        <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                          <SelectItem value="dutch">Nederlands</SelectItem>
                          <SelectItem value="english">Engels</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand Tone / Voice</Label>
                      <Input 
                        placeholder="Bijv. Professioneel, Urgent, Playful" 
                        value={context.tone || ''}
                        onChange={e => handleChange('tone', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 2: Strategie & Focus */}
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Target className="size-5 text-purple-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">2. Strategie & Focus</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Marketing Hook / Angle</Label>
                    <Input 
                      placeholder="Focus of primaire invalshoek" 
                      value={context.marketingHook || ''}
                      onChange={e => handleChange('marketingHook', e.target.value)}
                      className="bg-slate-900 border-slate-750 h-10 text-xs text-blue-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Landingspagina's per Campagne</Label>
                    <Textarea 
                      placeholder="Bijv. Search: /zonnepanelen, Meta: /offerte, of voer specifieke URL's in." 
                      value={context.campaignLandingPages || ''}
                      onChange={e => handleChange('campaignLandingPages', e.target.value)}
                      className="bg-slate-900 border-slate-750 min-h-[90px] text-xs text-slate-100 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primaire Conversie Actie</Label>
                      <Select 
                        value={context.primaryConversion || ''} 
                        onValueChange={(v) => handleChange('primaryConversion', v)}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                          <SelectValue placeholder="Kies conversie type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                          <SelectItem value="Lead Form Submit">Lead Form Submit</SelectItem>
                          <SelectItem value="E-commerce Purchase">E-commerce Purchase</SelectItem>
                          <SelectItem value="Phone Call">Phone Call</SelectItem>
                          <SelectItem value="App Install">App Install</SelectItem>
                          <SelectItem value="Store Visit">Store Visit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primaire Call to Action (CTA)</Label>
                      <Input 
                        placeholder="Bijv. Offerte aanvragen" 
                        value={context.primaryCta || ''}
                        onChange={e => handleChange('primaryCta', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Focus Producten / Diensten</Label>
                      <Input 
                        placeholder="Producten of diensten om te pushen" 
                        value={context.focusProducts || ''}
                        onChange={e => handleChange('focusProducts', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Concurrenten</Label>
                      <Input 
                        placeholder="Belangrijkste concurrenten" 
                        value={context.competitors || ''}
                        onChange={e => handleChange('competitors', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Belangrijkste USPs</Label>
                      <Textarea 
                        placeholder="Wat maakt dit aanbod uniek?" 
                        value={context.usps || ''}
                        onChange={e => handleChange('usps', e.target.value)}
                        className="bg-slate-900 border-slate-750 min-h-[90px] text-xs text-slate-100 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Het Aanbod / De Deal</Label>
                      <Textarea 
                        placeholder="Aanbieding of deal" 
                        value={context.offer || ''}
                        onChange={e => handleChange('offer', e.target.value)}
                        className="bg-slate-900 border-slate-750 min-h-[90px] text-xs text-slate-100 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 3: Doelgroep & Goals */}
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Users className="size-5 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">3. Doelgroep & Targetting</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Locatie Targetting</Label>
                      <Input 
                        placeholder="Bijv. Heel Nederland, of Radius 20km om Utrecht" 
                        value={context.targetLocations || ''}
                        onChange={e => handleChange('targetLocations', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Talen</Label>
                      <Input 
                        placeholder="Bijv. Nederlands, Engels" 
                        value={context.targetLanguages || ''}
                        onChange={e => handleChange('targetLanguages', e.target.value)}
                        className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primaire Campagne Doelen</Label>
                    <Input 
                      placeholder="Bijv. Leadgeneratie, ROAS optimalisatie" 
                      value={context.primaryGoals || ''}
                      onChange={e => handleChange('primaryGoals', e.target.value)}
                      className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Doelgroep Omschrijving</Label>
                    <Textarea 
                      placeholder="Wie is de ideale klant? Leeftijd, interesses, gedrag..." 
                      value={context.targetAudience || ''}
                      onChange={e => handleChange('targetAudience', e.target.value)}
                      className="bg-slate-900 border-slate-750 min-h-[90px] text-xs text-slate-100 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 4: Tactiek & Budget */}
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Zap className="size-5 text-orange-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">4. Tactiek, Kanalen & Budget</h2>
                </div>

                <div className="space-y-6">
                  {/* CHANNEL 1: GOOGLE ADS */}
                  <div className={`p-5 rounded-xl border transition-all ${
                    isGoogleEnabled 
                      ? 'bg-blue-600/5 border-blue-500/30' 
                      : 'bg-slate-950/20 border-slate-850'
                  }`}>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-850/50">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="channel-google" 
                          checked={isGoogleEnabled}
                          onCheckedChange={() => toggleChannel('google')}
                          className="size-5 border-slate-700 data-[state=checked]:bg-blue-600"
                        />
                        <label htmlFor="channel-google" className="text-sm font-black text-slate-100 cursor-pointer">
                          Google Ads
                        </label>
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Google Search & PMax</span>
                    </div>

                    {isGoogleEnabled && (
                      <div className="mt-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Google Ads Budget (€)</Label>
                            <div className="relative">
                              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                              <Input 
                                placeholder="Bijv. 2500" 
                                value={context.googleBudget || ''}
                                onChange={e => handleChange('googleBudget', e.target.value)}
                                className="bg-slate-900 border-slate-750 h-10 pl-10 text-xs text-slate-100 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aantal Google Campagnes</Label>
                            <Select 
                              value={String(context.desiredCampaignCount || 3)} 
                              onValueChange={(v) => handleChange('desiredCampaignCount', Number(v))}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                  <SelectItem key={n} value={String(n)}>{n} Campagnes</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Google Campaign Sub-types Selection */}
                        <div className="space-y-2 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selecteer Campagnetypen</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1.5">
                            {[
                              { id: 'search', label: 'Search' },
                              { id: 'pmax', label: 'PMax' },
                              { id: 'display', label: 'Display' },
                              { id: 'video', label: 'YouTube' }
                            ].map(sub => (
                              <div 
                                key={sub.id} 
                                onClick={() => toggleCampaignType(sub.id)}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                                  context.campaignTypes?.includes(sub.id)
                                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-750'
                                }`}
                              >
                                <Checkbox 
                                  checked={context.campaignTypes?.includes(sub.id)}
                                  onCheckedChange={() => toggleCampaignType(sub.id)}
                                  className="size-3.5"
                                />
                                <span className="text-[11px] font-bold">{sub.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Biedstrategie Search</Label>
                            <Select 
                              value={context.biddingStrategySearch || context.bidStrategyPreference || ''} 
                              onValueChange={(v) => handleChange('biddingStrategySearch', v)}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                                <SelectValue placeholder="Biedstrategie" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                <SelectItem value="Maximize Conversions">Maximize Conversions</SelectItem>
                                <SelectItem value="Maximize Clicks">Maximize Clicks</SelectItem>
                                <SelectItem value="Target CPA">Target CPA (tCPA)</SelectItem>
                                <SelectItem value="Target ROAS">Target ROAS (tROAS)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Biedstrategie PMax</Label>
                            <Select 
                              value={context.biddingStrategyPmax || ''} 
                              onValueChange={(v) => handleChange('biddingStrategyPmax', v)}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                                <SelectValue placeholder="Biedstrategie" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                <SelectItem value="Maximize Conversions">Maximize Conversions</SelectItem>
                                <SelectItem value="Target CPA">Target CPA (tCPA)</SelectItem>
                                <SelectItem value="Maximize Conversion Value">Maximize Conversion Value</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Conversie Waarde</Label>
                            <Input 
                              placeholder="Bijv. €150 per lead" 
                              value={context.conversionValue || ''}
                              onChange={e => handleChange('conversionValue', e.target.value)}
                              className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100"
                            />
                          </div>
                        </div>

                        {context.campaignTypes?.includes('search') && context.campaignTypes?.includes('pmax') && (
                          <div className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budgetverdeling Search vs PMax</Label>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-black text-slate-400">
                                <span>Search: {context.budgetSplitSearch || 50}%</span>
                                <span>PMax: {context.budgetSplitPmax || 50}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="100" step="5"
                                value={context.budgetSplitSearch || 50}
                                onChange={e => {
                                  const val = parseInt(e.target.value);
                                  onChange({ ...context, budgetSplitSearch: val, budgetSplitPmax: 100 - val });
                                }}
                                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CHANNEL 2: META ADS */}
                  <div className={`p-5 rounded-xl border transition-all ${
                    isMetaEnabled 
                      ? 'bg-pink-600/5 border-pink-500/30' 
                      : 'bg-slate-950/20 border-slate-850'
                  }`}>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-850/50">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="channel-meta" 
                          checked={isMetaEnabled}
                          onCheckedChange={() => toggleChannel('meta')}
                          className="size-5 border-slate-700 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600"
                        />
                        <label htmlFor="channel-meta" className="text-sm font-black text-slate-100 cursor-pointer">
                          Meta Ads
                        </label>
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Facebook & Instagram</span>
                    </div>

                    {isMetaEnabled && (
                      <div className="mt-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meta Ads Budget (€)</Label>
                            <div className="relative">
                              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                              <Input 
                                placeholder="Bijv. 1500" 
                                value={context.metaBudget || ''}
                                onChange={e => handleChange('metaBudget', e.target.value)}
                                className="bg-slate-900 border-slate-750 h-10 pl-10 text-xs text-slate-100 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aantal Meta Campagnes</Label>
                            <Select 
                              value={String(context.metaCampaignCount || 2)} 
                              onValueChange={(v) => handleChange('metaCampaignCount', Number(v))}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                  <SelectItem key={n} value={String(n)}>{n} Campagnes</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Meta Visuals Formats Multi-select Checkboxes */}
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visuals Formaat (Meerdere keuzes mogelijk)</Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                            {[
                              { id: 'static', label: 'Statisch' },
                              { id: 'video', label: 'Video / Reels' },
                              { id: 'carousel', label: 'Carrousels' },
                              { id: 'both', label: 'Combinatie' }
                            ].map(f => {
                              const active = context.metaVisualsFormats?.includes(f.id) || false;
                              return (
                                <div 
                                  key={f.id}
                                  onClick={() => {
                                    const current = context.metaVisualsFormats || [];
                                    const next = active ? current.filter(x => x !== f.id) : [...current, f.id];
                                    onChange({ ...context, metaVisualsFormats: next });
                                  }}
                                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                                    active
                                      ? 'bg-pink-600/10 border-pink-500/40 text-pink-300'
                                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-750'
                                  }`}
                                >
                                  <Checkbox checked={active} className="size-3.5" />
                                  <span className="text-[11px] font-bold">{f.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Meta Campaign Types: Prospecting & Remarketing checkboxes */}
                        <div className="space-y-2 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Soort Meta Campagnes</Label>
                          <div className="flex gap-4 pt-1.5">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="meta-prospecting" 
                                checked={context.metaProspecting || false}
                                onCheckedChange={(c) => handleChange('metaProspecting', !!c)}
                                className="size-4"
                              />
                              <label htmlFor="meta-prospecting" className="text-xs text-slate-350 font-medium cursor-pointer">
                                Prospecting (Koude doelgroep)
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="meta-remarketing" 
                                checked={context.metaRemarketing || false}
                                onCheckedChange={(c) => handleChange('metaRemarketing', !!c)}
                                className="size-4"
                              />
                              <label htmlFor="meta-remarketing" className="text-xs text-slate-350 font-medium cursor-pointer">
                                Remarketing (Warme doelgroep)
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 rounded-lg border bg-slate-950/40 border-slate-850 text-slate-300 h-10">
                          <Checkbox 
                            id="metaLeadForms" 
                            checked={context.metaLeadForms || false}
                            onCheckedChange={(checked) => handleChange('metaLeadForms', !!checked)}
                          />
                          <label htmlFor="metaLeadForms" className="text-xs font-bold cursor-pointer flex-1">
                            Meta Instant Lead Forms gebruiken
                          </label>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meta Creative Hooks / Ad Copy Invalshoeken</Label>
                          <Textarea 
                            placeholder="Invalshoeken voor advertentieteksten (bijv. korting, gemak, angst om te missen)" 
                            value={context.metaCreativeHooks || ''}
                            onChange={e => handleChange('metaCreativeHooks', e.target.value)}
                            className="bg-slate-900 border-slate-750 min-h-[80px] text-xs text-slate-100 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CHANNEL 3: LINKEDIN ADS */}
                  <div className={`p-5 rounded-xl border transition-all ${
                    isLinkedinEnabled 
                      ? 'bg-blue-700/5 border-blue-500/30' 
                      : 'bg-slate-950/20 border-slate-850'
                  }`}>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-850/50">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id="channel-linkedin" 
                          checked={isLinkedinEnabled}
                          onCheckedChange={() => toggleChannel('linkedin')}
                          className="size-5 border-slate-700 data-[state=checked]:bg-blue-700 data-[state=checked]:border-blue-700"
                        />
                        <label htmlFor="channel-linkedin" className="text-sm font-black text-slate-100 cursor-pointer">
                          LinkedIn Ads
                        </label>
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">B2B Platform</span>
                    </div>

                    {isLinkedinEnabled && (
                      <div className="mt-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn Ads Budget (€)</Label>
                            <div className="relative">
                              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                              <Input 
                                placeholder="Bijv. 1000" 
                                value={context.linkedinBudget || ''}
                                onChange={e => handleChange('linkedinBudget', e.target.value)}
                                className="bg-slate-900 border-slate-750 h-10 pl-10 text-xs text-slate-100 font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aantal LinkedIn Campagnes</Label>
                            <Select 
                              value={String(context.linkedinCampaignCount || 2)} 
                              onValueChange={(v) => handleChange('linkedinCampaignCount', Number(v))}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-750 h-10 text-xs text-slate-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                  <SelectItem key={n} value={String(n)}>{n} Campagnes</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* LinkedIn Ad Formats Multi-select Checkboxes */}
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn Advertentie Indeling (Meerdere keuzes mogelijk)</Label>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
                            {[
                              { id: 'single_image', label: 'Single Image' },
                              { id: 'carousel', label: 'Carousel' },
                              { id: 'video', label: 'Video Ad' },
                              { id: 'document', label: 'Document' },
                              { id: 'message', label: 'Message' }
                            ].map(f => {
                              const active = context.linkedinAdFormats?.includes(f.id) || false;
                              return (
                                <div 
                                  key={f.id}
                                  onClick={() => {
                                    const current = context.linkedinAdFormats || [];
                                    const next = active ? current.filter(x => x !== f.id) : [...current, f.id];
                                    onChange({ ...context, linkedinAdFormats: next });
                                  }}
                                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                                    active
                                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-750'
                                  }`}
                                >
                                  <Checkbox checked={active} className="size-3.5" />
                                  <span className="text-[11px] font-bold">{f.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LinkedIn Campaign Types: Prospecting & Remarketing checkboxes */}
                        <div className="space-y-2 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Soort LinkedIn Campagnes</Label>
                          <div className="flex gap-4 pt-1.5">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="linkedin-prospecting" 
                                checked={context.linkedinProspecting || false}
                                onCheckedChange={(c) => handleChange('linkedinProspecting', !!c)}
                                className="size-4"
                              />
                              <label htmlFor="linkedin-prospecting" className="text-xs text-slate-350 font-medium cursor-pointer">
                                Prospecting (Koude doelgroep)
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="linkedin-remarketing" 
                                checked={context.linkedinRemarketing || false}
                                onCheckedChange={(c) => handleChange('linkedinRemarketing', !!c)}
                                className="size-4"
                              />
                              <label htmlFor="linkedin-remarketing" className="text-xs text-slate-350 font-medium cursor-pointer">
                                Remarketing (Warme doelgroep)
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">LinkedIn Creative Brief / Copy Invalshoek</Label>
                          <Textarea 
                            placeholder="B2B copy insteken en specifieke content/whitepaper aanbiedingen..." 
                            value={context.linkedinCreativeBrief || ''}
                            onChange={e => handleChange('linkedinCreativeBrief', e.target.value)}
                            className="bg-slate-900 border-slate-750 min-h-[80px] text-xs text-slate-100 rounded-lg"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Submission buttons row */}
            <div className="pt-6 flex items-center justify-between gap-6 border-t border-slate-800">
               <div className="flex-1">
                  <p className="text-xs text-slate-500">
                    Alle velden gemarkeerd met een * zijn verplicht. Je kunt in de editor alles nog wijzigen en verfijnen.
                  </p>
               </div>
               <Button 
                onClick={() => onSubmit(context)} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-14 rounded-xl font-bold text-sm flex items-center gap-3 shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                {submitLabel}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          
          {/* Right Sidebar Columns */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Live Blueprint Summary Box */}
            <Card className="bg-slate-900/40 border-slate-850 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-450 border-b border-slate-850 pb-2">Blueprint Config</h3>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Klant:</span>
                  <span className="font-bold text-slate-200">{context.clientName || 'Nog niet ingevuld'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Website:</span>
                  <span className="font-bold text-slate-350 truncate max-w-[160px]" title={context.website}>{context.website || 'Nog niet ingevuld'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Taal:</span>
                  <span className="font-bold text-slate-200">{context.language === 'dutch' ? 'Nederlands' : 'Engels'}</span>
                </div>
                
                <div className="flex flex-col gap-1 border-t border-slate-850/60 pt-2.5">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 pb-1">Actieve Kanalen & Budget:</span>
                  {isGoogleEnabled && (
                    <div className="flex justify-between pl-2">
                      <span className="text-slate-450">Google Ads:</span>
                      <span className="font-bold text-slate-300">{context.googleBudget ? `€${context.googleBudget}` : 'Inbegrepen'}</span>
                    </div>
                  )}
                  {isMetaEnabled && (
                    <div className="flex justify-between pl-2">
                      <span className="text-slate-450">Meta Ads:</span>
                      <span className="font-bold text-slate-300">{context.metaBudget ? `€${context.metaBudget}` : 'Inbegrepen'}</span>
                    </div>
                  )}
                  {isLinkedinEnabled && (
                    <div className="flex justify-between pl-2">
                      <span className="text-slate-450">LinkedIn Ads:</span>
                      <span className="font-bold text-slate-300">{context.linkedinBudget ? `€${context.linkedinBudget}` : 'Inbegrepen'}</span>
                    </div>
                  )}
                  {!isGoogleEnabled && !isMetaEnabled && !isLinkedinEnabled && (
                    <span className="text-slate-500 pl-2 italic">Geen kanalen geselecteerd</span>
                  )}
                </div>
              </div>
            </Card>

            {/* Negative Keywords Box */}
            <Card className="bg-slate-900/40 border-slate-850 p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Uitsluitingszoekwoorden (Focus)</Label>
                <p className="text-[10px] text-slate-550 leading-relaxed">Optioneel: Geef hier termen op die we absoluut willen uitsluiten.</p>
              </div>
              <Textarea 
                placeholder="Bijv. Geen banen, Geen tweedehands, Geen gratis..." 
                value={context.negativeKeywordsBase || ''}
                onChange={e => handleChange('negativeKeywordsBase', e.target.value)}
                className="bg-slate-950/30 border-slate-800 min-h-[90px] text-xs text-slate-100 rounded-lg"
              />
            </Card>

            {/* Extra Notes Box */}
            <Card className="bg-slate-900/40 border-slate-850 p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Extra Notities / Opmerkingen</Label>
                <p className="text-[10px] text-slate-550 leading-relaxed">Eventuele extra opmerkingen voor de AI bij het bouwen van de campagnes.</p>
              </div>
              <Textarea 
                placeholder="Bijv. Focus in het begin alleen op product X, wegens tijdelijke voorraad." 
                value={context.additionalNotes || ''}
                onChange={e => handleChange('additionalNotes', e.target.value)}
                className="bg-slate-950/30 border-slate-800 min-h-[90px] text-xs text-slate-100 rounded-lg"
              />
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
