'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, MessageSquare, ListChecks, CheckCircle2, History, User, Search, ChevronRight } from 'lucide-react';
import type { ParentClient, ChildAccount, ChecklistRun, Todo } from '@/lib/types';
import { format, subDays, parseISO, isAfter } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

type EnrichedAccount = ChildAccount & {
    parentName: string;
};

export default function CheckInPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [accounts, setAccounts] = useState<EnrichedAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    
    const [activityLoading, setActivityLoading] = useState(false);
    const [stats, setStats] = useState({ checklists: 0, comments: 0, tasks: 0 });
    const [recentNotes, setRecentNotes] = useState<{ date: Date, text: string, taskDesc: string, runName: string }[]>([]);
    const [recentTodos, setRecentTodos] = useState<Todo[]>([]);

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchAccounts = async () => {
            setLoadingAccounts(true);
            try {
                const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid));
                const clientsSnap = await getDocs(clientsQuery);
                const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
                const clientMap = new Map(clients.map(c => [c.id, c.clientName]));

                const allAccounts: EnrichedAccount[] = [];
                for (const client of clients) {
                    const accSnap = await getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'));
                    accSnap.forEach(d => {
                        allAccounts.push({
                            id: d.id,
                            ...d.data(),
                            parentName: clientMap.get(client.id) || 'Onbekend'
                        } as EnrichedAccount);
                    });
                }
                setAccounts(allAccounts.filter(a => !a.isPaused));
            } catch (e) {
                console.error("Fout bij ophalen accounts:", e);
            } finally {
                setLoadingAccounts(false);
            }
        };

        fetchAccounts();
    }, [firestore, user]);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!selectedAccountId || !firestore || !user) return;
            setActivityLoading(true);
            
            const thirtyDaysAgo = subDays(new Date(), 30);
            const account = accounts.find(a => a.id === selectedAccountId);
            if (!account) return;

            try {
                // 1. Fetch Checklist Runs
                const runsQuery = query(
                    collection(firestore, 'checklistRuns'),
                    where('childAccountId', '==', selectedAccountId),
                    where('status', '==', 'complete')
                );
                const runsSnap = await getDocs(runsQuery);
                const runs = runsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChecklistRun));
                
                // 2. Fetch Completed Todos
                const todosQuery = query(
                    collection(firestore, 'users', user.uid, 'todos'),
                    where('childAccountId', '==', selectedAccountId),
                    where('completed', '==', true)
                );
                const todosSnap = await getDocs(todosQuery);
                const todos = todosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Todo));

                // Filter 30 days
                const recentRuns = runs.filter(run => {
                    const date = run.completedAt instanceof Timestamp ? run.completedAt.toDate() : parseISO(run.completedAt as unknown as string);
                    return isAfter(date, thirtyDaysAgo);
                });

                const recentCompletedTodos = todos.filter(todo => {
                    const date = todo.completedAt instanceof Timestamp ? todo.completedAt.toDate() : parseISO(todo.completedAt as unknown as string);
                    return isAfter(date, thirtyDaysAgo);
                });

                // Extract notes
                const notes: any[] = [];
                recentRuns.forEach(run => {
                    const runDate = run.completedAt instanceof Timestamp ? run.completedAt.toDate() : parseISO(run.completedAt as unknown as string);
                    run.tasks.forEach(t => {
                        if (t.notes?.trim()) {
                            notes.push({
                                date: runDate,
                                text: t.notes,
                                taskDesc: t.description,
                                runName: 'Checklist Run' 
                            });
                        }
                    });
                });

                setStats({
                    checklists: recentRuns.length,
                    comments: notes.length,
                    tasks: recentCompletedTodos.length
                });
                setRecentNotes(notes.sort((a, b) => b.date.getTime() - a.date.getTime()));
                setRecentTodos(recentCompletedTodos.sort((a, b) => {
                    const da = a.completedAt instanceof Timestamp ? a.completedAt.toDate() : parseISO(a.completedAt!);
                    const db = b.completedAt instanceof Timestamp ? b.completedAt.toDate() : parseISO(b.completedAt!);
                    return db.getTime() - da.getTime();
                }));

            } catch (e) {
                console.error("Fout bij ophalen activiteit:", e);
            } finally {
                setActivityLoading(false);
            }
        };

        fetchActivity();
    }, [selectedAccountId, firestore, user, accounts]);

    const accountOptions = useMemo(() => 
        accounts.map(a => ({ value: a.id, label: `${a.nickname} (${a.parentName})` })), 
    [accounts]);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold font-headline tracking-tight">Klant Check-in</h1>
                <p className="text-muted-foreground">Bereid je voor op je volgende call met een 30-dagen overzicht.</p>
            </div>

            <Card className="bg-[#1C243A] border-[#2A3552]">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-grow w-full">
                            <Combobox 
                                options={accountOptions}
                                value={selectedAccountId}
                                onValueChange={setSelectedAccountId}
                                placeholder="Selecteer een account om te checken..."
                                searchPlaceholder="Zoek account..."
                                loading={loadingAccounts}
                            />
                        </div>
                        {selectedAccount && (
                            <Button variant="outline" asChild className="shrink-0">
                                <Link href={`/dashboard/accounts/${selectedAccount.id}?parent=${selectedAccount.parentClientId}`}>
                                    Bekijk Volledig Dossier <ChevronRight className="ml-2 size-4" />
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {!selectedAccountId && (
                <div className="py-20 text-center flex flex-col items-center gap-4 animate-in fade-in duration-500">
                    <div className="p-4 rounded-full bg-blue-500/10 text-blue-400">
                        <Search className="size-12" />
                    </div>
                    <h2 className="text-xl font-semibold">Kies een account</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">Selecteer hierboven een Google Ads account om de prestaties en werkzaamheden van de afgelopen maand te bekijken.</p>
                </div>
            )}

            {selectedAccountId && activityLoading && (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                    <Loader2 className="size-12 text-blue-500 animate-spin" />
                    <p className="text-muted-foreground">Activiteit wordt geanalyseerd...</p>
                </div>
            )}

            {selectedAccountId && !activityLoading && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-[#1C243A] border-[#2A3552]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Checklists Voltooid</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                    <ListChecks className="size-6" />
                                </div>
                                <div className="text-4xl font-bold">{stats.checklists}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[#1C243A] border-[#2A3552]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Observaties & Comments</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
                                    <MessageSquare className="size-6" />
                                </div>
                                <div className="text-4xl font-bold">{stats.comments}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[#1C243A] border-[#2A3552]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Taken Afgevinkt</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
                                    <CheckCircle2 className="size-6" />
                                </div>
                                <div className="text-4xl font-bold">{stats.tasks}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Notes Feed */}
                        <Card className="bg-[#1C243A] border-[#2A3552] flex flex-col h-[600px]">
                            <CardHeader className="border-b border-[#2A3552]">
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="text-green-400 size-5" />
                                    Recente Observaties
                                </CardTitle>
                                <CardDescription>Opmerkingen uit voltooide checklists</CardDescription>
                            </CardHeader>
                            <ScrollArea className="flex-grow">
                                <CardContent className="p-0">
                                    {recentNotes.length === 0 ? (
                                        <div className="p-10 text-center text-muted-foreground">Geen opmerkingen gevonden deze maand.</div>
                                    ) : (
                                        <div className="divide-y divide-[#2A3552]">
                                            {recentNotes.map((note, i) => (
                                                <div key={i} className="p-4 space-y-2 hover:bg-white/5 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 border-slate-700">{format(note.date, 'dd MMM')}</Badge>
                                                        <span className="text-[10px] text-muted-foreground italic">{note.runName}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-blue-400">{note.taskDesc}</p>
                                                    <p className="text-sm text-slate-200 bg-slate-900/50 p-3 rounded-lg border border-slate-800 italic">&ldquo;{note.text}&rdquo;</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </ScrollArea>
                        </Card>

                        {/* Todos Feed */}
                        <Card className="bg-[#1C243A] border-[#2A3552] flex flex-col h-[600px]">
                            <CardHeader className="border-b border-[#2A3552]">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="text-purple-400 size-5" />
                                    Voltooide Taken
                                </CardTitle>
                                <CardDescription>Handmatig afgevinkte actiepunten</CardDescription>
                            </CardHeader>
                            <ScrollArea className="flex-grow">
                                <CardContent className="p-0">
                                    {recentTodos.length === 0 ? (
                                        <div className="p-10 text-center text-muted-foreground">Geen taken voltooid deze maand.</div>
                                    ) : (
                                        <div className="divide-y divide-[#2A3552]">
                                            {recentTodos.map((todo, i) => {
                                                const doneDate = todo.completedAt instanceof Timestamp ? todo.completedAt.toDate() : parseISO(todo.completedAt!);
                                                return (
                                                    <div key={i} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                                                        <div className="mt-1 flex-shrink-0">
                                                            <CheckCircle2 className="size-4 text-green-500" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm text-slate-200">{todo.content}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Voltooid op {format(doneDate, 'PPP', { locale: nl })}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </ScrollArea>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}