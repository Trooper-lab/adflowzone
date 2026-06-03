'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { generateSearchAdCopy } from '@/ai/flows/generate-search-ad-copy';
import { generatePMaxAdCopy } from '@/ai/flows/generate-pmax-ad-copy';
import { AdCopyInputSchema, type AdCopyInput, type SearchAdCopyOutput, type PMaxAdCopyOutput, type ParentClient, type ChildAccount } from '@/lib/types';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, WandSparkles, Copy, Check, Info, Sparkles, Type, Image as ImageIcon, Key, Languages, MousePointer2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast({ title: 'Gekopieerd!' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({ variant: 'destructive', title: 'Kopiëren mislukt' });
    });
  };

  return (
    <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-white hover:bg-white/10" onClick={handleCopy} disabled={!textToCopy}>
      {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
    </Button>
  );
}

type EnrichedChildAccount = ChildAccount & {
    parentName: string;
}

const callToActionOptions = [
  "Nu Aanvragen", "Nu Boeken", "Contact", "Downloaden", "Meer Informatie", "Offerte Aanvragen", 
  "Nu Shoppen", "Aanmelden", "Abonneren", "Bekijk Meer", "Nu Bestellen", "Registreren",
  "Aan de Slag", "Nu Bekijken", "Demo Aanvragen"
];

const tones = [
  { value: 'Professional', label: 'Professioneel' },
  { value: 'Friendly', label: 'Vriendelijk' },
  { value: 'Witty', label: 'Geestig' },
  { value: 'Urgent', label: 'Dringend' },
  { value: 'Playful', label: 'Speels' },
  { value: 'Authoritative', label: 'Autoritair' },
];

export default function AdCopyGeneratorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return role === 'admin' || 
           user?.email === 'billy@pearsonline.nl' || 
           user?.email === 'billy@trooper.es' ||
           user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [appUser, user?.email]);
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchAdCopyOutput | null>(null);
  const [pmaxResult, setPmaxResult] = useState<PMaxAdCopyOutput | null>(null);
  const [searchKeywordFormat, setSearchKeywordFormat] = useState<'broad' | 'phrase' | 'exact'>('broad');
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<EnrichedChildAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user || (!appUser && !isAdmin)) return;

    const fetchAllAccounts = async () => {
        setAccountsLoading(true);
        try {
            const managerUid = isAdmin ? user.uid : (appUser as any)?.managerId;
            if (!managerUid) return;

            const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
            const clientsSnapshot = await getDocs(clientsQuery);
            const parentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentClient));
            
            const parentClientMap = new Map(parentClients.map(c => [c.id, c.clientName]));

            const childAccountPromises = parentClients.map(client =>
                isAdmin 
                    ? getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                    : getDocs(query(collection(firestore, 'parentClients', client.id, 'childAccounts'), where('assignedEmployeeId', '==', user.uid)))
            );
            const childAccountSnapshots = await Promise.all(childAccountPromises);
            
            const allChildAccounts: EnrichedChildAccount[] = childAccountSnapshots.flatMap(snapshot => 
                snapshot.docs.map(doc => {
                    const data = doc.data() as ChildAccount;
                    return {
                        ...data,
                        id: doc.id,
                        parentName: parentClientMap.get(data.parentClientId) || 'Unknown Client',
                    } as EnrichedChildAccount;
                })
            );
            
            setAccounts(allChildAccounts.filter(account => !account.isPaused));
        } catch (e) {
            console.error("Fout bij ophalen accounts voor generator:", e);
        } finally {
            setAccountsLoading(false);
        }
    };

    fetchAllAccounts();
  }, [firestore, user, appUser, isAdmin]);

  const form = useForm<AdCopyInput>({
    resolver: zodResolver(AdCopyInputSchema),
    defaultValues: {
      campaignType: 'search',
      businessName: '',
      productDescription: '',
      targetAudience: '',
      tone: 'Professional',
      language: 'dutch',
      callToAction: 'Meer Informatie',
    },
  });

  async function onSubmit(data: AdCopyInput) {
    setLoading(true);
    setSearchResult(null);
    setPmaxResult(null);

    try {
      if (data.campaignType === 'search') {
        const output = await generateSearchAdCopy(data);
        setSearchResult(output);
      } else {
        const output = await generatePMaxAdCopy(data);
        setPmaxResult(output);
      }
      toast({ title: '✨ Assets gegenereerd!', description: 'Je nieuwe advertentie-assets staan klaar.' });
    } catch (error) {
      console.error('Error generating ad copy:', error);
      toast({
        variant: 'destructive',
        title: 'Generatie mislukt',
        description: 'Er ging iets mis bij het aanroepen van de AI. Probeer het opnieuw.',
      });
    } finally {
      setLoading(false);
    }
  }

  const formattedSearchKeywords = useMemo(() => {
    if (!searchResult?.keywords) return '';
    
    switch (searchKeywordFormat) {
      case 'exact':
        return searchResult.keywords.map(kw => `[${kw}]`).join('\n');
      case 'phrase':
        return searchResult.keywords.map(kw => `"${kw}"`).join('\n');
      default: // broad
        return searchResult.keywords.join('\n');
    }
  }, [searchResult, searchKeywordFormat]);
  
  const formattedPmaxKeywords = useMemo(() => {
    if (!pmaxResult) return '';
    return pmaxResult.keywords.join('\n');
  }, [pmaxResult]);

  const accountOptions = useMemo(() => {
    return accounts.map(acc => ({
        value: acc.nickname,
        label: `${acc.nickname} (${acc.parentName})`,
    }));
  }, [accounts]);

  const AssetCard = ({ title, items, maxLength, icon: Icon, type = "headline" }: { title: string, items: string[], maxLength: number, icon: any, type?: "headline" | "description" }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
            <Icon className="size-4 text-blue-400" />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h4>
            <Badge variant="outline" className="ml-auto text-[10px] font-bold border-slate-800 text-slate-500 bg-white/5">{items.length} items</Badge>
        </div>
        <div className="grid grid-cols-1 gap-2">
            {items.map((text, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl glass-card group hover:border-blue-500/30 transition-all">
                    <p className="text-sm text-slate-200 leading-snug">{text}</p>
                    <div className="flex items-center gap-3 pl-4 shrink-0">
                        <span className={cn("text-[10px] font-mono font-bold", text.length > maxLength ? "text-red-400" : "text-slate-600")}>
                            {text.length}/{maxLength}
                        </span>
                        <CopyButton textToCopy={text} />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                <Sparkles className="text-blue-400 size-8 animate-pulse" />
                AI Ad Generator
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Creëer high-performance Google Ads assets die voldoen aan alle policies.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-4">
          <Card className="glass-card shadow-xl sticky top-6">
            <CardHeader className="border-b border-white/5 bg-white/5">
              <CardTitle className="text-lg">Configuratie</CardTitle>
              <CardDescription>Vul de details in voor een optimale generatie.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                   <FormField
                    control={form.control}
                    name="campaignType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Campagnetype</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className="bg-slate-900 border-slate-700">
                                    <SelectValue placeholder="Selecteer type..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="search">Google Search Ad</SelectItem>
                                <SelectItem value="pmax">Performance Max (PMax)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Account / Merk</FormLabel>
                            <Combobox
                                options={accountOptions}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Kies uit portfolio..."
                                loading={accountsLoading}
                                searchPlaceholder="Zoek account..."
                                notFoundText="Geen account gevonden."
                            />
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                  <FormField
                    control={form.control}
                    name="productDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Wat verkoop je?</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Beschrijf je product, service en de grootste voordelen..." 
                            {...field} 
                            rows={4} 
                            className="bg-slate-900 border-slate-700 resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="tone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Tone of Voice</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-slate-900 border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {tones.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="language"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Taal</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-slate-900 border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="dutch">Nederlands</SelectItem>
                                    <SelectItem value="english">Engels</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                   </div>

                    <FormField
                        control={form.control}
                        name="callToAction"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-black tracking-widest text-slate-500">Geadviseerde CTA</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="bg-slate-900 border-slate-700">
                                        <SelectValue placeholder="Kies CTA..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {callToActionOptions.map(cta => (
                                        <SelectItem key={cta} value={cta}>{cta}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                  <Button type="submit" className="w-full h-12 font-black bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-95 transition-all" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin size-5 mr-2" /> : <WandSparkles className="size-5 mr-2" />}
                    Assets Genereren
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8">
          {loading && (
            <div className="flex flex-col items-center justify-center h-[600px] bg-card/50 rounded-3xl border-2 border-dashed border-white/5 animate-in fade-in duration-500 grain-animated">
              <div className="relative">
                <Loader2 className="size-16 animate-spin text-blue-500" />
                <Sparkles className="absolute -top-2 -right-2 size-6 text-yellow-400 animate-bounce" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-200">AI is aan het werk...</h3>
              <p className="mt-2 text-slate-500 font-medium max-w-xs text-center">We schrijven nu overtuigende advertenties die voldoen aan alle tekenlimieten.</p>
            </div>
          )}

          {!loading && !searchResult && !pmaxResult && (
            <div className="flex flex-col items-center justify-center h-[600px] bg-slate-900/20 rounded-3xl border-2 border-dashed border-white/5 text-center p-12">
                <div className="p-6 rounded-full bg-blue-500/5 border border-blue-500/10 mb-6">
                    <MousePointer2 className="size-12 text-blue-500/50" />
                </div>
                <h3 className="text-2xl font-bold text-slate-300 font-headline">Klaar voor de start</h3>
                <p className="text-slate-500 mt-2 max-w-sm">Vul links de details in en klik op genereren om professionele advertentie-assets te maken.</p>
                <div className="mt-8 flex gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <span className="flex items-center gap-1.5"><Check className="size-3" /> Geen ! in koppen</span>
                    <span className="flex items-center gap-1.5"><Check className="size-3" /> Tekenlimiet check</span>
                    <span className="flex items-center gap-1.5"><Check className="size-3" /> Google Compliant</span>
                </div>
            </div>
          )}

          {(searchResult || pmaxResult) && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Keywords Section */}
              <Card className="glass-card shadow-xl overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Key className="size-5 text-blue-400" />
                    <div>
                        <CardTitle className="text-base">Keyword Voorstellen</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-tighter">Focus op zoekintentie</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <Button 
                        variant={searchKeywordFormat === 'broad' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setSearchKeywordFormat('broad')}
                        className="h-7 text-[10px] font-bold px-3"
                    >Broad</Button>
                    <Button 
                        variant={searchKeywordFormat === 'phrase' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setSearchKeywordFormat('phrase')}
                        className="h-7 text-[10px] font-bold px-3"
                    >"Phrase"</Button>
                    <Button 
                        variant={searchKeywordFormat === 'exact' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setSearchKeywordFormat('exact')}
                        className="h-7 text-[10px] font-bold px-3"
                    >[Exact]</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="relative group">
                        <Textarea 
                            readOnly
                            value={searchResult ? formattedSearchKeywords : formattedPmaxKeywords}
                            className="h-40 font-mono text-xs bg-slate-900/50 border-slate-800 text-blue-300 resize-none"
                        />
                        <div className="absolute top-2 right-2">
                            <CopyButton textToCopy={searchResult ? formattedSearchKeywords : formattedPmaxKeywords} />
                        </div>
                    </div>
                </CardContent>
              </Card>

              {/* Ad Copy Section */}
              <Card className="glass-card shadow-xl overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5 py-4">
                  <div className="flex items-center gap-3">
                    <Type className="size-5 text-blue-400" />
                    <div>
                        <CardTitle className="text-base">Advertentieteksten</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-tighter">Geoptimaliseerd voor Ad Strength</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  {searchResult && (
                    <>
                        <AssetCard title="Koppen (Max 30 tekens - Geen !)" items={searchResult.adCopy.headlines} maxLength={30} icon={Type} />
                        <Separator className="bg-white/5" />
                        <AssetCard title="Beschrijvingen (Max 90 tekens)" items={searchResult.adCopy.descriptions} maxLength={90} icon={Type} type="description" />
                    </>
                  )}

                  {pmaxResult && (
                    <>
                        <AssetCard title="Koppen (Max 30 tekens - Geen !)" items={pmaxResult.adCopy.headlines} maxLength={30} icon={Type} />
                        <Separator className="bg-white/5" />
                        <AssetCard title="Lange Koppen (Max 90 tekens)" items={pmaxResult.adCopy.longHeadlines} maxLength={90} icon={Type} />
                        <Separator className="bg-white/5" />
                        <AssetCard title="Beschrijvingen (Max 90 tekens)" items={pmaxResult.adCopy.descriptions} maxLength={90} icon={Type} type="description" />
                    </>
                  )}
                </CardContent>
              </Card>

              {pmaxResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="glass-card shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2"><ImageIcon className="size-4 text-blue-400" /> Image Gen Prompts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pmaxResult.imagePrompts.map((prompt, i) => (
                                <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 group hover:border-blue-500/20 transition-all">
                                    <p className="text-[11px] text-slate-400 leading-relaxed italic">&ldquo;{prompt}&rdquo;</p>
                                    <div className="flex justify-end mt-2">
                                        <CopyButton textToCopy={prompt} />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="glass-card shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2"><Languages className="size-4 text-blue-400" /> Call to Action</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between">
                                <span className="font-bold text-blue-400">{pmaxResult.callToAction}</span>
                                <CopyButton textToCopy={pmaxResult.callToAction} />
                            </div>
                            <div className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-[10px] text-slate-500">
                                <div className="flex items-center gap-2 mb-2 font-black uppercase tracking-widest">
                                    <Info className="size-3" /> Tip
                                </div>
                                <p>Zorg dat de gekozen CTA knop in de Google Ads interface overeenkomt met de tekst in je koppen voor een hogere relevantie-score.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
