'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Loader2, 
    Plus, 
    Clock, 
    Trash2, 
    Calendar as CalendarIcon, 
    TrendingUp, 
    SkipForward, 
    ChevronLeft, 
    ChevronRight,
    Users,
    Activity,
    Hourglass,
    Target,
    ListChecks,
    ExternalLink,
    Zap
} from 'lucide-react';
import type { ParentClient, TimeEntry, ChildAccount, ChecklistRun, ChecklistTemplate } from '@/lib/types';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer, 
    Cell
} from 'recharts';
import Link from 'next/link';

type TimeStat = {
    totalSeconds: number;
    completedCount: number;
    skipCount: number;
    runs: (ChecklistRun & { dateObject: Date; clientName: string; accountName: string; checklistName: string })[];
};

type ItemTimeData = {
    name: string;
    hours: number;
    color?: string;
};

const COLORS = ['#4d8eff', '#4edea3', '#8b5cf6', '#fbbf24', '#f43f5e', '#0ea5e9', '#ec4899', '#84cc16'];

export default function TimeTrackingPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // Time tracking state
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Analytics state
    const [activeTab, setActiveTab] = useState('uren');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [stats, setStats] = useState<TimeStat>({ totalSeconds: 0, completedCount: 0, skipCount: 0, runs: [] });
    const [clientData, setClientData] = useState<ItemTimeData[]>([]);
    const [accountData, setAccountData] = useState<ItemTimeData[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    // Form State
    const [newEntry, setNewEntry] = useState({
        parentClientId: '',
        childAccountId: 'none',
        date: new Date(),
        durationMinutes: 60,
        description: '',
    });

    const fetchData = async () => {
        if (!firestore || !user) return;
        setLoading(true);
        try {
            const [clientsSnap, entriesSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid))),
                getDocs(query(collection(firestore, 'timeEntries'), where('ownerId', '==', user.uid)))
            ]);

            const fetchedClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
            setClients(fetchedClients);

            const accountPromises = fetchedClients.map(client => 
                getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
            );
            const accountSnaps = await Promise.all(accountPromises);
            const fetchedAccounts: ChildAccount[] = [];
            accountSnaps.forEach((snap, i) => {
                snap.forEach(d => {
                    fetchedAccounts.push({ id: d.id, parentClientId: fetchedClients[i].id, ...d.data() } as ChildAccount);
                });
            });
            setChildAccounts(fetchedAccounts);

            const fetchedEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
            setEntries(fetchedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (e) {
            console.error("Error fetching data:", e);
            toast({ variant: 'destructive', title: 'Fout bij ophalen gegevens' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [firestore, user]);

    // Fetch Analytics data
    useEffect(() => {
        if (!firestore || !user || activeTab !== 'analytics') return;

        const fetchAnalytics = async () => {
            setAnalyticsLoading(true);
            try {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);

                const clientsSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)));
                const clientsList = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
                const clientMap = new Map(clientsList.map(c => [c.id, c.clientName]));

                const runsSnap = await getDocs(query(collection(firestore, 'checklistRuns'), where('ownerId', '==', user.uid)));
                
                const templatesSnap = await getDocs(query(collection(firestore, 'users', user.uid, 'checklistTemplates')));
                const templatesMap = new Map(templatesSnap.docs.map(d => [d.id, (d.data() as ChecklistTemplate).name]));

                const accountPromises = clientsList.map(client => 
                    getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                );
                const accountSnaps = await Promise.all(accountPromises);
                const allAccountsMap: Record<string, string> = {};
                accountSnaps.forEach(snap => {
                    snap.forEach(d => {
                        allAccountsMap[d.id] = (d.data() as ChildAccount).nickname;
                    });
                });

                const allRuns = runsSnap.docs.map(d => {
                    const data = d.data() as ChecklistRun;
                    const parseDate = (val: any) => {
                        if (!val) return null;
                        if (val instanceof Timestamp) return val.toDate();
                        if (typeof val === 'string') return parseISO(val);
                        if (val instanceof Date) return val;
                        return null;
                    };
                    const date = parseDate(data.completedAt) || parseDate(data.runAt) || new Date(0);
                    
                    return { 
                        ...data, 
                        id: d.id, 
                        dateObject: date,
                        clientName: clientMap.get(data.parentClientId) || 'Onbekende Klant',
                        accountName: allAccountsMap[data.childAccountId] || 'Onbekend Account',
                        checklistName: templatesMap.get(data.checklistId) || 'Verwijderde Checklist'
                    };
                });

                const monthRuns = allRuns.filter(run => 
                    isWithinInterval(run.dateObject, { start: monthStart, end: monthEnd })
                );

                let totalSecs = 0;
                let completed = 0;
                let skips = 0;
                const clientAgg: Record<string, number> = {};
                const accountAgg: Record<string, {name: string, secs: number}> = {};

                monthRuns.forEach(run => {
                    if (run.status === 'complete') {
                        completed++;
                        const duration = run.durationSeconds || 0;
                        totalSecs += duration;
                        
                        const cName = run.clientName;
                        clientAgg[cName] = (clientAgg[cName] || 0) + duration;

                        const aName = run.accountName;
                        if (!accountAgg[run.childAccountId]) {
                            accountAgg[run.childAccountId] = { name: aName, secs: 0 };
                        }
                        accountAgg[run.childAccountId].secs += duration;
                    } else if (run.status === 'skipped') {
                        skips++;
                    }
                });

                setStats({
                    totalSeconds: totalSecs,
                    completedCount: completed,
                    skipCount: skips,
                    runs: monthRuns.sort((a, b) => b.dateObject.getTime() - a.dateObject.getTime())
                });

                setClientData(Object.entries(clientAgg).map(([name, secs]) => ({
                    name: name,
                    hours: parseFloat((secs / 3600).toFixed(2))
                })).sort((a, b) => b.hours - a.hours));

                setAccountData(Object.values(accountAgg).map((a, i) => ({
                    name: a.name,
                    hours: parseFloat((a.secs / 3600).toFixed(2)),
                    color: COLORS[i % COLORS.length]
                })).sort((a, b) => b.hours - a.hours).slice(0, 10));

            } catch (e) {
                console.error("Fout bij ophalen analytics:", e);
            } finally {
                setAnalyticsLoading(false);
            }
        };

        fetchAnalytics();
    }, [firestore, user, currentMonth, activeTab]);

    const handleSaveEntry = async () => {
        if (!firestore || !user || !newEntry.parentClientId || !newEntry.description || newEntry.durationMinutes <= 0) {
            toast({ variant: 'destructive', title: 'Vul alle velden in.' });
            return;
        }

        const client = clients.find(c => c.id === newEntry.parentClientId);
        if (!client) return;

        setSaving(true);
        try {
            const entryData: Omit<TimeEntry, 'id'> = {
                ownerId: user.uid,
                parentClientId: newEntry.parentClientId,
                ...(newEntry.childAccountId !== 'none' && { childAccountId: newEntry.childAccountId }),
                date: newEntry.date.toISOString(),
                durationMinutes: newEntry.durationMinutes,
                description: newEntry.description,
                hourlyRateAtTime: client.hourlyRate || 0,
            };

            await addDoc(collection(firestore, 'timeEntries'), entryData);
            toast({ title: 'Uren succesvol geregistreerd!' });
            setNewEntry({ parentClientId: '', childAccountId: 'none', date: new Date(), durationMinutes: 60, description: '' });
            fetchData();
        } catch (e) {
            console.error("Error saving entry:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan uren' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'timeEntries', id));
            setEntries(prev => prev.filter(e => e.id !== id));
            toast({ title: 'Registratie verwijderd' });
        } catch (e) {
            console.error("Error deleting entry:", e);
            toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
        }
    };

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return `${h}u ${m}m`;
        if (h > 0) return `${h} uur`;
        return `${m} min`;
    };

    const formatAnalyticsDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}u ${m}m` : `${m}m`;
    };

    const avgTimePerChecklist = stats.completedCount > 0 ? Math.round(stats.totalSeconds / stats.completedCount / 60) : 0;
    const skipRate = (stats.completedCount + stats.skipCount) > 0 
        ? Math.round((stats.skipCount / (stats.completedCount + stats.skipCount)) * 100) 
        : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight flex items-center gap-3 text-slate-100">
                        <Clock className="text-blue-400 size-8" />
                        Urenregistratie & Analytics
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Log operationele uren en krijg diepgaande efficiëntie-rapportages.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white/5 border border-white/5 p-1 rounded-xl w-fit flex gap-1 mb-8">
                    <TabsTrigger value="uren" className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        Urenregistratie
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        Tijd & Efficiëntie
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: URENREGISTRATIE */}
                <TabsContent value="uren" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 outline-none">
                    <Card className="glass-card shadow-xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/5">
                            <CardTitle className="text-xl font-bold font-headline text-slate-100">Recente Registraties</CardTitle>
                            <CardDescription>Log handmatig uren voor de lopende klantcontracten.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="size-8 animate-spin text-primary" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="p-2 h-8 w-[130px] text-xs">Datum</TableHead>
                                            <TableHead className="p-2 h-8 w-[160px] text-xs">Klant</TableHead>
                                            <TableHead className="p-2 h-8 w-[160px] text-xs">Account</TableHead>
                                            <TableHead className="p-2 h-8 text-xs">Omschrijving</TableHead>
                                            <TableHead className="p-2 h-8 text-right w-[100px] text-xs">Tijd</TableHead>
                                            <TableHead className="p-2 h-8 w-[40px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Inline Add Row */}
                                        <TableRow className="bg-white/[0.02]">
                                            <TableCell className="p-1 align-top">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={cn("w-full h-8 px-2 justify-start text-left font-normal text-xs rounded-sm", !newEntry.date && "text-muted-foreground")}
                                                        >
                                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                                            {newEntry.date ? format(newEntry.date, "dd MMM", { locale: nl }) : <span>Datum</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 bg-slate-900 border-white/5">
                                                        <Calendar
                                                            mode="single"
                                                            selected={newEntry.date}
                                                            onSelect={(d) => d && setNewEntry({...newEntry, date: d})}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell className="p-1 align-top">
                                                <Select 
                                                    value={newEntry.parentClientId} 
                                                    onValueChange={val => setNewEntry({...newEntry, parentClientId: val, childAccountId: 'none'})}
                                                >
                                                    <SelectTrigger className="w-full h-8 px-2 text-xs rounded-sm">
                                                        <SelectValue placeholder="Kies klant..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.clientName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="p-1 align-top">
                                                <Select 
                                                    value={newEntry.childAccountId} 
                                                    onValueChange={val => setNewEntry({...newEntry, childAccountId: val})}
                                                    disabled={!newEntry.parentClientId}
                                                >
                                                    <SelectTrigger className="w-full h-8 px-2 text-xs rounded-sm">
                                                        <SelectValue placeholder="Account..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="text-xs italic text-muted-foreground">Algemeen</SelectItem>
                                                        {childAccounts.filter(a => a.parentClientId === newEntry.parentClientId).map(a => (
                                                            <SelectItem key={a.id} value={a.id} className="text-xs">{a.nickname || a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="p-1 align-top">
                                                <Input 
                                                    placeholder="Omschrijving..." 
                                                    value={newEntry.description}
                                                    onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                                                    className="h-8 text-xs rounded-sm w-full"
                                                />
                                            </TableCell>
                                            <TableCell className="p-1 align-top text-right">
                                                <div className="flex items-center gap-1 justify-end h-8">
                                                    <Input 
                                                        type="number"
                                                        className="w-14 h-8 text-xs text-right px-1 rounded-sm"
                                                        min="5"
                                                        step="5"
                                                        value={newEntry.durationMinutes}
                                                        onChange={e => setNewEntry({...newEntry, durationMinutes: parseInt(e.target.value) || 0})}
                                                    />
                                                    <span className="text-[10px] text-muted-foreground w-3 text-left">m</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-1 align-top text-right">
                                                <Button 
                                                    onClick={handleSaveEntry}
                                                    disabled={saving}
                                                    size="icon"
                                                    className="h-8 w-8 rounded-sm shrink-0 bg-primary text-primary-foreground"
                                                >
                                                    {saving ? <Loader2 className="animate-spin size-4" /> : <Plus className="size-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>

                                        {entries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    Nog geen uren geregistreerd. Vul hierboven je eerste uren in.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            entries.map((entry) => {
                                                const client = clients.find(c => c.id === entry.parentClientId);
                                                const account = childAccounts.find(a => a.id === entry.childAccountId);
                                                return (
                                                    <TableRow key={entry.id} className="group">
                                                        <TableCell className="p-2 text-xs">{format(parseISO(entry.date), 'd MMM yyyy', { locale: nl })}</TableCell>
                                                        <TableCell className="p-2 text-xs font-medium">{client?.clientName || 'Onbekend'}</TableCell>
                                                        <TableCell className="p-2 text-xs text-muted-foreground">{account?.nickname || account?.name || '-'}</TableCell>
                                                        <TableCell className="p-2 text-xs max-w-md truncate" title={entry.description}>{entry.description}</TableCell>
                                                        <TableCell className="p-2 text-xs text-right tabular-nums">{formatDuration(entry.durationMinutes)}</TableCell>
                                                        <TableCell className="p-1 text-right">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => handleDelete(entry.id)}>
                                                                <Trash2 className="size-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: TIJD & EFFICIENTIE ANALYTICS */}
                <TabsContent value="analytics" className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 outline-none">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                        <div className="space-y-0.5">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <Activity className="text-primary size-5" /> Operationele Analyse
                            </h3>
                            <p className="text-xs text-slate-400">Rapportages en prestatiestatistieken over de geselecteerde maand.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/5 shadow-xl">
                            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="hover:bg-white/5 h-8 w-8">
                                <ChevronLeft className="size-4" />
                            </Button>
                            <div className="px-4 py-1 text-xs font-bold uppercase tracking-widest text-slate-200 min-w-[140px] text-center font-mono">
                                {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="hover:bg-white/5 h-8 w-8">
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>

                    {analyticsLoading ? (
                        <div className="flex flex-col items-center justify-center py-40 gap-4">
                            <Loader2 className="size-12 text-primary animate-spin" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analytics berekenen...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Card className="glass-card relative overflow-hidden group shadow-lg">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Hourglass className="size-12 text-primary" />
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Totaal Gefocust</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xl font-black text-primary">{formatAnalyticsDuration(stats.totalSeconds)}</div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">deze maand</p>
                                    </CardContent>
                                </Card>

                                <Card className="glass-card relative overflow-hidden group shadow-lg">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Zap className="size-12 text-green-400" />
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gem. per Lijst</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xl font-black text-green-400">{avgTimePerChecklist} min</div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">werkelijke tijd</p>
                                    </CardContent>
                                </Card>

                                <Card className="glass-card relative overflow-hidden group shadow-lg">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <SkipForward className="size-12 text-yellow-400" />
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Skip Rate</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xl font-black text-yellow-500">{skipRate}%</div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">{stats.skipCount} keer overgeslagen</p>
                                    </CardContent>
                                </Card>

                                <Card className="glass-card relative overflow-hidden group shadow-lg">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Target className="size-12 text-purple-400" />
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Lijsten Afgerond</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-4xl font-black text-purple-400">{stats.completedCount}</div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">voltooide optimalisaties</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <Card className="lg:col-span-2 glass-card shadow-xl">
                                    <CardHeader>
                                        <CardTitle className="text-xl font-bold font-headline flex items-center gap-2 text-slate-100">
                                            <Activity className="text-primary size-5" />
                                            Tijdbesteding per Account
                                        </CardTitle>
                                        <CardDescription>Focus verdeling over je actieve accounts (top 10).</CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-[400px] pt-4">
                                        {accountData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={accountData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                                                    <XAxis type="number" stroke="#8c909f" fontSize={10} axisLine={false} tickLine={false} unit="u" />
                                                    <YAxis dataKey="name" type="category" stroke="#c2c6d6" fontSize={11} width={100} axisLine={false} tickLine={false} />
                                                    <RechartsTooltip 
                                                        cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                                        contentStyle={{ backgroundColor: 'rgba(23, 31, 51, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', backdropFilter: 'blur(16px)' }}
                                                        itemStyle={{ color: '#4d8eff', fontWeight: 'bold' }}
                                                        labelStyle={{ color: '#dae2fd', fontWeight: 'bold' }}
                                                    />
                                                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={20}>
                                                        {accountData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-500 font-medium italic">Geen data beschikbaar voor deze maand.</div>
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="space-y-6">
                                    <Card className="glass-card shadow-xl">
                                        <CardHeader>
                                            <CardTitle className="text-lg font-bold font-headline flex items-center gap-2 text-slate-100">
                                                <Users className="text-green-400 size-5" />
                                                Grootste Tijdvreters
                                            </CardTitle>
                                            <CardDescription>Totaal uren per klantdossier.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {clientData.map((client, i) => (
                                                    <div key={i} className="flex items-center justify-between group">
                                                        <div className="min-w-0 flex-grow">
                                                            <p className="text-sm font-bold text-slate-200 truncate group-hover:text-primary transition-colors">{client.name}</p>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full mt-1.5 overflow-hidden border border-white/5">
                                                                <div 
                                                                    className="h-full bg-green-500/50" 
                                                                    style={{ width: `${(client.hours / (clientData[0]?.hours || 1)) * 100}%` }} 
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="ml-4 text-right">
                                                            <p className="text-sm font-black text-slate-300 font-mono">{client.hours}u</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {clientData.length === 0 && <p className="text-sm text-slate-500 italic">Nog geen data...</p>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-[#4d8eff]/10 border-[#4d8eff]/20 border shadow-2xl relative overflow-hidden group rounded-xl">
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                                            <TrendingUp className="size-32 text-primary" />
                                        </div>
                                        <CardContent className="pt-6">
                                            <h3 className="text-base font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                                                <Zap className="size-4 text-primary fill-current" /> Flow Tip
                                            </h3>
                                            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                                                Je skip rate is deze maand <span className="text-primary font-bold">{skipRate}%</span>. 
                                                Probeer taken die je vaker dan 3 keer skipt te herzien in de <Link href="/dashboard/checklists" className="underline hover:text-white font-semibold">Checklist Builder</Link>.
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            <Card className="glass-card shadow-xl overflow-hidden">
                                <CardHeader className="bg-white/5 border-b border-white/5">
                                    <CardTitle className="text-xl font-bold font-headline flex items-center gap-2 text-slate-100">
                                        <ListChecks className="text-primary size-5" />
                                        Recente Activiteit
                                    </CardTitle>
                                    <CardDescription>De laatst uitgevoerde optimalisaties en geplande taken.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-900/50">
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 px-6">Activiteit & Datum</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Account & Klant</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Status</TableHead>
                                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 px-6">Gefocuste Tijd</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.runs.slice(0, 15).map((run) => (
                                                <TableRow key={run.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                                    <TableCell className="py-4 px-6">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-200 group-hover:text-primary transition-colors">
                                                                {run.checklistName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                                                                {format(run.dateObject, 'dd MMM yyyy HH:mm')}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col">
                                                            <Link 
                                                                href={`/dashboard/accounts/${run.childAccountId}?parent=${run.parentClientId}`}
                                                                className="text-sm font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
                                                            >
                                                                {run.accountName}
                                                                <ExternalLink className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                                            </Link>
                                                            <span className="text-[10px] text-primary/70 font-bold uppercase tracking-tighter mt-0.5">
                                                                {run.clientName}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] uppercase font-black border-none h-5 px-2",
                                                            run.status === 'complete' ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
                                                        )}>
                                                            {run.status === 'complete' ? 'Voltooid' : 'Overgeslagen'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-4 px-6 text-right">
                                                        <div className="flex flex-col items-end font-mono">
                                                            <span className="text-sm font-black text-primary">
                                                                {formatAnalyticsDuration(run.durationSeconds || 0)}
                                                            </span>
                                                            <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">min:sec</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {stats.runs.length === 0 && (
                                        <div className="p-20 text-center flex flex-col items-center gap-4">
                                            <div className="p-4 rounded-full bg-white/5">
                                                <Activity className="size-12 text-slate-700" />
                                            </div>
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nog geen activiteiten gelogd deze maand.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
