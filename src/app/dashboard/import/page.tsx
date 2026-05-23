
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, arrayUnion, getDoc, Timestamp, addDoc, updateDoc, orderBy, limit as firestoreLimit, serverTimestamp, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Database,
    Copy,
    Check,
    Play,
    ArrowRight,
    Terminal,
    Info,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    History,
    Zap,
    X,
    LayoutGrid,
    Target,
    Sparkles,
    ExternalLink,
    CloudDownload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ParentClient, ChildAccount, KpiData, ChecklistRun, ChecklistTemplate } from '@/lib/types';
import { generateChecklistDraft } from '@/ai/flows/generate-checklist-draft';
import { fetchCampaignPerformance } from '@/app/actions/google-ads-campaigns';
import Link from 'next/link';
import { subMonths, format, parseISO, startOfMonth } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';

// --- SCRIPT TEMPLATES ---

const SCRIPTS = {
    MCC_MONTHLY: {
        id: "MCC_MONTHLY",
        title: "MCC Maandelijkse Sync",
        description: "Haal spend & KPI's op voor ALLES in je MCC van de vorige maand.",
        icon: Zap,
        code: `/**
 * AdFlow Zone - MCC KPI Bridge
 * Haalt data op voor al je MCC accounts voor de vorige maand.
 */
function main() {
  const period = "LAST_MONTH"; 
  const accounts = AdsManagerApp.accounts().get();
  const results = [];
  
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  const startStr = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-01T00:00:00.000Z";

  while (accounts.hasNext()) {
    const account = accounts.next();
    AdsManagerApp.select(account);
    const stats = account.getStatsFor(period);
    
    results.push({
      googleAdsClientId: account.getCustomerId(),
      startDate: startStr,
      kpiValues: {
        spend: stats.getCost(),
        clicks: stats.getClicks(),
        impressions: stats.getImpressions(),
        conversions: stats.getConversions(),
        conversion_value: stats.getConversionValue()
      }
    });
  }
  
  Logger.log("--- START ADFLOW JSON ---");
  Logger.log(JSON.stringify(results));
  Logger.log("--- EIND ADFLOW JSON ---");
}`
    },
    SINGLE_HISTORY: {
        id: "SINGLE_HISTORY",
        title: "Historische Data Bridge",
        description: "Haal de laatste 12 maanden aan data op voor één specifiek account.",
        icon: History,
        code: `/**
 * AdFlow Zone - Historical Bridge
 * Haalt de laatste 12 maanden data op voor het huidige account.
 */
function main() {
  const results = [];
  const account = AdsApp.currentAccount();
  const clientId = account.getCustomerId();

  for (var i = 1; i <= 12; i++) {
    var date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(1);
    
    var year = date.getFullYear();
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var startStr = year + month + "-01T00:00:00.000Z";
    
    var dateRangeStart = year + month + "01";
    var lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    var dateRangeEnd = year + month + lastDay;

    var stats = account.getStatsFor(dateRangeStart, dateRangeEnd);
    
    results.push({
      googleAdsClientId: clientId,
      startDate: startStr,
      kpiValues: {
        spend: stats.getCost(),
        clicks: stats.getClicks(),
        impressions: stats.getImpressions(),
        conversions: stats.getConversions(),
        conversion_value: stats.getConversionValue()
      }
    });
  }
  
  Logger.log("--- START ADFLOW JSON ---");
  Logger.log(JSON.stringify(results));
  Logger.log("--- EIND ADFLOW JSON ---");
}`
    }
};

type ImportItem = {
    googleAdsClientId: string;
    startDate: string;
    kpiValues: Record<string, number>;
};

export default function DataImportPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [rawJson, setRawJson] = useState('');
    const [parsedData, setParsedData] = useState<ImportItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<ChildAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [activeBridge, setActiveBridge] = useState<string>(SCRIPTS.MCC_MONTHLY.id);

    // AI Draft generation state (using inferred types to avoid TSX generic parsing ambiguity)
    const [generatingFor, setGeneratingFor] = useState(new Set<string>());
    const [createdRunIds, setCreatedRunIds] = useState(new Map<string, string>()); // accountId → runId

    // Bulk API Sync state
    const [selectedSyncAccounts, setSelectedSyncAccounts] = useState<Set<string>>(new Set());
    const [syncStatuses, setSyncStatuses] = useState<Record<string, 'idle' | 'syncing' | 'success' | 'error'>>({});
    const [isBulkSyncing, setIsBulkSyncing] = useState(false);

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchAccounts = async () => {
            setLoadingAccounts(true);
            try {
                const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid));
                const clientsSnap = await getDocs(clientsQuery);
                const clientIds = clientsSnap.docs.map(d => d.id);

                const allAccounts: ChildAccount[] = [];
                for (const clientId of clientIds) {
                    const accSnap = await getDocs(collection(firestore, 'parentClients', clientId, 'childAccounts'));
                    accSnap.forEach(d => allAccounts.push({ id: d.id, ...d.data() } as ChildAccount));
                }
                setAccounts(allAccounts.filter(a => !a.isPaused).sort((a, b) => a.nickname.localeCompare(b.nickname)));
            } catch (e) {
                console.error("Fout bij laden accounts:", e);
            } finally {
                setLoadingAccounts(false);
            }
        };

        fetchAccounts();
    }, [firestore, user]);

    const handleCopyScript = (key: string, code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedKey(key);
            toast({ title: "Code gekopieerd!", description: "Plak dit nu in de Google Ads script editor." });
            setTimeout(() => setCopiedKey(null), 3000);
        });
    };

    const handleParseJson = () => {
        try {
            let jsonString = rawJson;
            const startMarker = "--- START ADFLOW JSON ---";
            const endMarker = "--- EIND ADFLOW JSON ---";
            
            if (jsonString.includes(startMarker)) {
                jsonString = jsonString.split(startMarker)[1].split(endMarker)[0].trim();
            }

            const data = JSON.parse(jsonString) as ImportItem[];
            setParsedData(data);
            toast({ title: "Data herkend", description: `${data.length} datapunten gevonden voor import.` });
        } catch (e) {
            console.error("Error parsing JSON:", e);
            toast({ variant: "destructive", title: "Ongeldige JSON", description: "Zorg dat je de volledige JSON array uit de Google Ads logs kopieert." });
        }
    };

    const matchedResults = useMemo(() => {
        return parsedData.map(item => {
            const match = accounts.find(a => a.googleAdsClientId === item.googleAdsClientId);
            return {
                ...item,
                account: match,
                status: match ? 'matched' : 'unmatched'
            };
        });
    }, [parsedData, accounts]);

    const handleImport = async () => {
        if (!firestore || !user) return;
        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);
            let importCount = 0;

            for (const item of matchedResults) {
                if (!item.account) continue;

                const kpiDataCollection = collection(firestore, 'kpiData');
                const newDocRef = doc(kpiDataCollection);

                const kpiDoc: Omit<KpiData, 'id'> = {
                    ownerId: user.uid,
                    childAccountId: item.account.id,
                    periodType: 'monthly',
                    startDate: item.startDate,
                    kpiValues: item.kpiValues
                };

                batch.set(newDocRef, kpiDoc);
                
                const accountRef = doc(firestore, 'parentClients', item.account.parentClientId, 'childAccounts', item.account.id);
                batch.update(accountRef, {
                    kpiDataIds: arrayUnion(newDocRef.id)
                });
                
                importCount++;
            }

            await batch.commit();
            toast({ 
                title: "Import Voltooid! ✨", 
                description: `${importCount} datapunten zijn succesvol geïmporteerd.` 
            });
            setRawJson('');
            setParsedData([]);
        } catch (e) {
            console.error("Import fout:", e);
            toast({ variant: "destructive", title: "Import Mislukt", description: "Er ging iets mis bij het opslaan van de data." });
        } finally {
            setIsSaving(false);
        }
    };

    const accountOptions = useMemo(() => 
        accounts.map(a => ({ value: a.id, label: a.nickname })), 
    [accounts]);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const handleGenerateDraft = async (item: (typeof matchedResults)[number]) => {
        if (!item.account || !firestore || !user) return;
        const account = item.account as ChildAccount;

        // Account needs a connected checklist to generate a draft
        const connectedChecklist = account.connectedChecklists?.[0];
        if (!connectedChecklist) {
            toast({
                variant: 'destructive',
                title: 'Geen checklist gekoppeld',
                description: `${account.nickname} heeft nog geen checklist. Koppel er eerst een op de accountpagina.`,
            });
            return;
        }

        setGeneratingFor(prev => new Set([...prev, account.id]));

        try {
            // 1. Fetch the checklist template
            const templateRef = doc(firestore, 'users', user.uid, 'checklistTemplates', connectedChecklist.checklistId);
            const templateSnap = await getDoc(templateRef);
            if (!templateSnap.exists()) throw new Error('Checklist template niet gevonden. Is de template verwijderd?');
            const template = { id: templateSnap.id, ...templateSnap.data() } as ChecklistTemplate;

            if (!template.tasks?.length) throw new Error('De checklist heeft geen taken om in te vullen.');

            // 2. Fetch the last 3 completed checklist runs for context
            const runsQuery = query(
                collection(firestore, 'checklistRuns'),
                where('childAccountId', '==', account.id),
                where('status', '==', 'complete'),
                orderBy('completedAt', 'desc'),
                firestoreLimit(3)
            );
            const runsSnap = await getDocs(runsQuery);
            const recentRuns = runsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChecklistRun));

            // 3. Build context string from recent run notes
            const recentRunsContext = recentRuns.length > 0
                ? recentRuns.map(run => {
                    const dateStr = run.completedAt?.toDate?.()?.toLocaleDateString('nl-NL') ?? 'onbekend';
                    const notedTasks = (run.tasks ?? []).filter(t => t.notes?.trim());
                    if (!notedTasks.length) return `Run ${dateStr}: geen notities.`;
                    return `Run ${dateStr}:\n${notedTasks.map(t => `  - ${t.description}: ${t.notes}`).join('\n')}`;
                }).join('\n\n')
                : '';

            // 4. Call the AI flow
            toast({ title: '🤖 AI aan het werk...', description: `Checklist draft genereren voor ${account.nickname}.` });
            const result = await generateChecklistDraft({
                accountNickname:  account.nickname,
                primaryGoal:      account.primaryGoal,
                kpiValues:        item.kpiValues,
                targetKpiValues:  account.targetKpiValues,
                tasks:            template.tasks,
                recentRunsContext,
            });

            // 5. Map suggestions onto tasks
            const runTasks = template.tasks.map(task => {
                const suggestion = result.suggestions.find(s => s.taskId === task.id);
                return {
                    taskId:      task.id,
                    description: task.description,
                    completed:   suggestion?.autoComplete ?? false,
                    notes:       suggestion?.suggestedNote ?? '',
                };
            });

            // 6. Write the ChecklistRun to Firestore as in_progress
            const runRef = await addDoc(collection(firestore, 'checklistRuns'), {
                ownerId:           user.uid,
                childAccountId:    account.id,
                parentClientId:    account.parentClientId,
                checklistId:       template.id,
                status:            'in_progress',
                runAt:             serverTimestamp(),
                completedAt:       null,
                completedByName:   'AI Agent',
                durationSeconds:   0,
                tasks:             runTasks,
            });

            // 7. Add run ID to account
            await updateDoc(
                doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id),
                { checklistRunIds: arrayUnion(runRef.id) }
            );

            setCreatedRunIds(prev => new Map([...prev, [account.id, runRef.id]]));
            toast({
                title: '✨ Draft aangemaakt!',
                description: `AI checklist draft klaar voor ${account.nickname}. Open de accountpagina om te reviewen.`,
            });

        } catch (e: any) {
            console.error('Draft generation error:', e);
            toast({ variant: 'destructive', title: 'Fout bij genereren', description: e.message });
        } finally {
            setGeneratingFor(prev => { const next = new Set(prev); next.delete(account.id); return next; });
        }
    };

    const handleToggleSyncAccount = (accountId: string) => {
        const next = new Set(selectedSyncAccounts);
        if (next.has(accountId)) {
            next.delete(accountId);
        } else {
            next.add(accountId);
        }
        setSelectedSyncAccounts(next);
    };

    const handleSelectAllSyncAccounts = (allSelectableIds: string[]) => {
        if (selectedSyncAccounts.size === allSelectableIds.length) {
            setSelectedSyncAccounts(new Set());
        } else {
            setSelectedSyncAccounts(new Set(allSelectableIds));
        }
    };

    const handleBulkSync = async () => {
        if (!firestore || selectedSyncAccounts.size === 0) return;
        setIsBulkSyncing(true);

        const period = 'THIS_MONTH';

        for (const accountId of selectedSyncAccounts) {
            const account = accounts.find(a => a.id === accountId);
            if (!account || !account.googleAdsClientId) {
                setSyncStatuses(prev => ({ ...prev, [accountId]: 'error' }));
                continue;
            }

            setSyncStatuses(prev => ({ ...prev, [accountId]: 'syncing' }));

            try {
                const result = await fetchCampaignPerformance(
                    account.id,
                    account.googleAdsClientId,
                    period
                );
                
                const docRef = doc(firestore, 'campaignPerformance', `${account.id}_${period}`);
                await setDoc(docRef, result);

                setSyncStatuses(prev => ({ ...prev, [accountId]: 'success' }));
            } catch (error) {
                console.error(`Error syncing account ${accountId}:`, error);
                setSyncStatuses(prev => ({ ...prev, [accountId]: 'error' }));
            }
        }

        setIsBulkSyncing(false);
        toast({ title: 'Bulk synchronisatie voltooid' });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <Database className="text-blue-400 size-8" />
                        Data Import Bridge
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Beheer en synchroniseer Google Ads data voor je accounts.</p>
                </div>
            </div>

            <Tabs defaultValue="api-sync" className="w-full">
                <TabsList className="mb-6 bg-[#1C243A] border border-[#2A3552]">
                    <TabsTrigger value="api-sync" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">API Bulk Sync</TabsTrigger>
                    <TabsTrigger value="scripts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Script Bridge (JSON)</TabsTrigger>
                </TabsList>

                <TabsContent value="api-sync" className="mt-0">
                    <Card className="bg-[#1C243A] border-[#2A3552] shadow-xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-[#2A3552]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CloudDownload className="size-5 text-blue-400" />
                                        Campagne Data Ophalen
                                    </CardTitle>
                                    <CardDescription>Haal campagne-prestaties (deze maand) op voor geselecteerde accounts rechtstreeks via de Google Ads API.</CardDescription>
                                </div>
                                <Button 
                                    onClick={handleBulkSync}
                                    disabled={isBulkSyncing || selectedSyncAccounts.size === 0}
                                    className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-xs h-10"
                                >
                                    {isBulkSyncing ? <Loader2 className="animate-spin size-4 mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                                    Synchroniseer ({selectedSyncAccounts.size})
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="text-[10px] uppercase bg-white/5 text-slate-500 tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold w-12 text-center">
                                                <Checkbox 
                                                    checked={selectedSyncAccounts.size > 0 && selectedSyncAccounts.size === accounts.filter(a => a.googleAdsClientId).length}
                                                    onCheckedChange={() => handleSelectAllSyncAccounts(accounts.filter(a => a.googleAdsClientId).map(a => a.id))}
                                                />
                                            </th>
                                            <th className="px-4 py-3 font-semibold">Account</th>
                                            <th className="px-4 py-3 font-semibold">Google Ads Client ID</th>
                                            <th className="px-4 py-3 font-semibold text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2A3552]">
                                        {accounts.filter(a => a.googleAdsClientId).map(account => (
                                            <tr key={account.id} className="hover:bg-white/[0.02] cursor-pointer" onClick={() => handleToggleSyncAccount(account.id)}>
                                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox 
                                                        checked={selectedSyncAccounts.has(account.id)}
                                                        onCheckedChange={() => handleToggleSyncAccount(account.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-200">{account.nickname}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge className="font-mono text-[10px] bg-white/5 text-slate-400 border border-[#2A3552]">
                                                        {account.googleAdsClientId}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {syncStatuses[account.id] === 'syncing' && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Loader2 className="size-3 mr-1 animate-spin"/> Bezig</Badge>}
                                                    {syncStatuses[account.id] === 'success' && <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><Check className="size-3 mr-1"/> Voltooid</Badge>}
                                                    {syncStatuses[account.id] === 'error' && <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><AlertCircle className="size-3 mr-1"/> Fout</Badge>}
                                                    {syncStatuses[account.id] === 'idle' || !syncStatuses[account.id] ? <span className="text-slate-600 text-xs">-</span> : null}
                                                </td>
                                            </tr>
                                        ))}
                                        {accounts.filter(a => a.googleAdsClientId).length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                                                    Geen accounts gevonden met een Google Ads Client ID.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scripts" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Script Selector Section */}
                <div className="lg:col-span-5 space-y-6">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">1. Kies je Bridge</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {Object.entries(SCRIPTS).map(([key, script]) => {
                            const isActive = activeBridge === script.id;
                            return (
                                <Card 
                                    key={key} 
                                    className={cn(
                                        "bg-[#1C243A] border-[#2A3552] group hover:border-blue-500/30 transition-all overflow-hidden cursor-pointer",
                                        isActive && "border-blue-500/50 ring-1 ring-blue-500/20"
                                    )}
                                    onClick={() => setActiveBridge(script.id)}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "p-3 rounded-xl border transition-colors",
                                                isActive ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            )}>
                                                <script.icon className="size-6" />
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <h3 className="font-bold text-slate-100">{script.title}</h3>
                                                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{script.description}</p>
                                            </div>
                                        </div>

                                        {script.id === 'SINGLE_HISTORY' && isActive && (
                                            <div className="mt-6 space-y-4 animate-in fade-in duration-300">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Doelaccount</label>
                                                    <Combobox 
                                                        options={accountOptions}
                                                        value={selectedAccountId}
                                                        onValueChange={setSelectedAccountId}
                                                        placeholder="Selecteer account..."
                                                        loading={loadingAccounts}
                                                    />
                                                </div>
                                                {selectedAccount && (
                                                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[10px] font-bold text-blue-400 uppercase tracking-tight flex items-center gap-2">
                                                        <Target className="size-3" /> Navigeer in Google Ads naar ID: {selectedAccount.googleAdsClientId}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-6">
                                            <Button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyScript(key, script.code);
                                                }}
                                                className={cn(
                                                    "w-full font-black uppercase tracking-widest text-[10px] h-11 transition-all",
                                                    copiedKey === key ? "bg-green-600 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-500"
                                                )}
                                                disabled={script.id === 'SINGLE_HISTORY' && !selectedAccountId}
                                            >
                                                {copiedKey === key ? (
                                                    <><Check className="mr-2 size-4" /> Code Gekopieerd</>
                                                ) : (
                                                    <><Copy className="mr-2 size-4" /> Kopieer Script Code</>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                            <Info className="size-4" /> Hoe werkt het?
                        </h4>
                        <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                            <li>Kopieer de code van de gewenste bridge hierboven.</li>
                            <li>Ga in Google Ads naar <strong>Tools &gt; Scripts</strong>.</li>
                            <li>Maak een nieuw script, plak de code en klik op <strong>Run</strong>.</li>
                            <li>Kopieer de JSON output uit de logs en plak deze hiernaast.</li>
                        </ol>
                    </div>
                </div>

                {/* Import Area */}
                <div className="lg:col-span-7 space-y-6">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">2. Verwerk Data</h2>
                    
                    <Card className="bg-[#1C243A] border-[#2A3552] shadow-xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-[#2A3552]">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <RefreshCw className="size-5 text-green-400" />
                                Plak Output
                            </CardTitle>
                            <CardDescription>Plak de volledige logs uit Google Ads hieronder.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <Textarea
                                placeholder='Plak hier de logs uit Google Ads...'
                                className="h-[250px] bg-slate-950 border-slate-800 font-mono text-[10px] text-green-400 focus:ring-green-500/20"
                                value={rawJson}
                                onChange={(e) => setRawJson(e.target.value)}
                            />
                            <Button
                                onClick={handleParseJson}
                                className="w-full bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-xs h-12"
                                disabled={!rawJson.trim()}
                            >
                                Data Analyseren <ArrowRight className="ml-2 size-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    {parsedData.length > 0 && (
                        <Card className="bg-[#1C243A] border-[#2A3552] shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Preview & Match</CardTitle>
                                <Badge variant="outline" className="text-[10px] border-slate-700">{parsedData.length} items</Badge>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="divide-y divide-slate-800 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
                                    {matchedResults.map((item, i) => (
                                        <div key={i} className="py-3 space-y-2 group">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-200 truncate">
                                                        {item.account?.nickname || 'Onbekend Account'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-500 font-mono">{item.googleAdsClientId}</span>
                                                        <span className="text-[10px] text-blue-400/70 font-bold uppercase">{format(parseISO(item.startDate), 'MMM yyyy', {locale: nl})}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-green-400">€{item.kpiValues.spend?.toLocaleString('nl-NL') ?? '—'}</p>
                                                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Spend</p>
                                                    </div>
                                                    {item.account ? (
                                                        <div className="p-1.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                                                            <CheckCircle2 className="size-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="p-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                                            <X className="size-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {item.account && (
                                                <div className="flex justify-end">
                                                    {createdRunIds.has(item.account.id) ? (
                                                        <p className="text-[10px] font-bold text-green-400 flex items-center gap-1.5">
                                                            <Check className="size-3" /> Draft aangemaakt
                                                        </p>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] font-black uppercase tracking-widest border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                                            disabled={generatingFor.has(item.account.id)}
                                                            onClick={() => handleGenerateDraft(item)}
                                                        >
                                                            {generatingFor.has(item.account.id) ? (
                                                                <><Loader2 className="mr-1.5 size-3 animate-spin" /> Genereren...</>
                                                            ) : (
                                                                <><Sparkles className="mr-1.5 size-3" /> AI Draft genereren</>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-slate-800">
                                    <Button
                                        onClick={handleImport}
                                        disabled={isSaving || !matchedResults.some(a => a.account)}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-black h-12 shadow-lg shadow-green-900/20 active:scale-95 transition-all"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin size-5 mr-2" /> : <Play className="size-5 mr-2 fill-current" />}
                                        IMPORT STARTEN
                                    </Button>
                                    <p className="mt-3 text-center text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                                        Bestaande data voor deze maanden wordt overschreven.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
