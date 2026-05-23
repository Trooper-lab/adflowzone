'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Clock, Trash2, Calendar as CalendarIcon, PlayCircle } from 'lucide-react';
import type { ParentClient, TimeEntry, ChildAccount } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TimeTrackingPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                getDocs(query(collection(firestore, 'timeEntries'), where('ownerId', '==', user.uid))) // Ideally we add orderBy('date', 'desc') but requires index
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
            // Sort client-side until index is built
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
                hourlyRateAtTime: client.hourlyRate || 0, // Fallback if 0
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

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight flex items-center gap-3">
                        <Clock className="text-blue-500 size-8" />
                        Urenregistratie
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Log losse uren per klant voor maandelijkse facturatie.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recente Registraties</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="size-8 animate-spin" /></div>
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
                                <TableRow className="bg-muted/30">
                                    <TableCell className="p-1 align-top">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full h-8 px-2 justify-start text-left font-normal text-xs rounded-sm", !newEntry.date && "text-muted-foreground")}
                                                >
                                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                                    {newEntry.date ? format(newEntry.date, "dd MMM", { locale: nl }) : <span>Datum</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
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
                                            className="h-8 w-8 rounded-sm shrink-0"
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
        </div>
    );
}
