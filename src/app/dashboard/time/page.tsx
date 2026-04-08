
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
    Loader2, 
    Clock, 
    Zap, 
    TrendingUp, 
    SkipForward, 
    Calendar, 
    ChevronLeft, 
    ChevronRight,
    Users,
    Activity,
    Hourglass,
    Target,
    ListChecks,
    ExternalLink
} from 'lucide-react';
import type { ChecklistRun, ParentClient, ChildAccount, ChecklistTemplate } from '@/lib/types';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    subMonths, 
    addMonths, 
    parseISO, 
    isWithinInterval 
} from 'date-fns';
import { nl } from 'date-fns/locale';
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
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f43f5e', '#84cc16', '#0ea5e9'];

export default function TimeAnalyticsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [stats, setStats] = useState<TimeStat>({ totalSeconds: 0, completedCount: 0, skipCount: 0, runs: [] });
    const [clientData, setClientData] = useState<ItemTimeData[]>([]);
    const [accountData, setAccountData] = useState<ItemTimeData[]>([]);

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);

                // 1. Fetch all parent clients
                const clientsSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)));
                const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
                const clientMap = new Map(clients.map(c => [c.id, c.clientName]));

                // 2. Fetch all checklist runs
                const runsSnap = await getDocs(query(collection(firestore, 'checklistRuns'), where('ownerId', '==', user.uid)));
                
                // 3. Fetch checklist templates for names
                const templatesSnap = await getDocs(query(collection(firestore, 'users', user.uid, 'checklistTemplates')));
                const templatesMap = new Map(templatesSnap.docs.map(d => [d.id, (d.data() as ChecklistTemplate).name]));

                // 4. Fetch all child accounts in parallel for mapping
                const accountPromises = clients.map(client => 
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

                // 5. Filter for current month
                const monthRuns = allRuns.filter(run => 
                    isWithinInterval(run.dateObject, { start: monthStart, end: monthEnd })
                );

                // 6. Aggregate stats
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
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, user, currentMonth]);

    const formatDuration = (seconds: number) => {
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
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <Clock className="text-blue-400 size-8" />
                        Tijd & Efficiëntie
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Inzicht in je operationele uren en focus-output.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-[#1C243A] p-1.5 rounded-xl border border-[#2A3552] shadow-xl">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="hover:bg-white/5">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <div className="px-4 py-1 text-sm font-bold uppercase tracking-widest text-slate-200 min-w-[140px] text-center">
                        {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="hover:bg-white/5">
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="size-12 text-blue-500 animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analytics berekenen...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="bg-[#1C243A] border-[#2A3552] shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Hourglass className="size-12" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Totaal Gefocust</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-blue-400">{formatDuration(stats.totalSeconds)}</div>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">deze maand</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#1C243A] border-[#2A3552] shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Zap className="size-12" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gem. per Lijst</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-green-400">{avgTimePerChecklist} min</div>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">werkelijke tijd</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#1C243A] border-[#2A3552] shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <SkipForward className="size-12" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Skip Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-yellow-500">{skipRate}%</div>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">{stats.skipCount} keer overgeslagen</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#1C243A] border-[#2A3552] shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Target className="size-12" />
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
                        <Card className="lg:col-span-2 bg-[#1C243A] border-[#2A3552] shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                                    <Activity className="text-blue-400 size-5" />
                                    Tijdbesteding per Account
                                </CardTitle>
                                <CardDescription>Focus verdeling over je actieve accounts (top 10).</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px] pt-4">
                                {accountData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={accountData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2A3552" horizontal={false} />
                                            <XAxis type="number" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} unit="u" />
                                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} axisLine={false} tickLine={false} />
                                            <RechartsTooltip 
                                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                                contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #2A3552', borderRadius: '8px' }}
                                                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                            />
                                            <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={24}>
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
                            <Card className="bg-[#1C243A] border-[#2A3552] shadow-xl">
                                <CardHeader>
                                    <CardTitle className="text-lg font-bold font-headline flex items-center gap-2">
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
                                                    <p className="text-sm font-bold text-slate-200 truncate group-hover:text-blue-400 transition-colors">{client.name}</p>
                                                    <div className="h-1 w-full bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-green-500/50" 
                                                            style={{ width: `${(client.hours / (clientData[0]?.hours || 1)) * 100}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="ml-4 text-right">
                                                    <p className="text-sm font-black text-slate-300">{client.hours}u</p>
                                                </div>
                                            </div>
                                        ))}
                                        {clientData.length === 0 && <p className="text-sm text-slate-500 italic">Nog geen data...</p>}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-blue-600/10 border-blue-500/30 border-2 shadow-2xl relative overflow-hidden group">
                                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                                    <TrendingUp className="size-32" />
                                </div>
                                <CardContent className="pt-6">
                                    <h3 className="text-lg font-black text-blue-400 uppercase tracking-tighter">Flow Tip</h3>
                                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                                        Je skip rate is deze maand <span className="text-blue-400 font-bold">{skipRate}%</span>. 
                                        Probeer taken die je vaker dan 3 keer skipt te herzien in de <Link href="/dashboard/checklists" className="underline hover:text-white">Checklist Builder</Link>.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <Card className="bg-[#1C243A] border-[#2A3552] shadow-xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-[#2A3552]">
                            <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                                <ListChecks className="text-blue-400 size-5" />
                                Recente Activiteit
                            </CardTitle>
                            <CardDescription>De laatst uitgevoerde optimalisaties en geplande taken.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-900/50">
                                    <TableRow className="border-[#2A3552] hover:bg-transparent">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 px-6">Activiteit & Datum</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Account & Klant</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">Status</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 px-6">Gefocuste Tijd</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.runs.slice(0, 15).map((run) => (
                                        <TableRow key={run.id} className="border-[#2A3552] hover:bg-white/5 transition-colors group">
                                            <TableCell className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
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
                                                    <span className="text-[10px] text-blue-400/70 font-bold uppercase tracking-tighter mt-0.5">
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
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-black text-blue-400">
                                                        {formatTime(run.durationSeconds || 0)}
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
        </div>
    );

    function formatTime(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
