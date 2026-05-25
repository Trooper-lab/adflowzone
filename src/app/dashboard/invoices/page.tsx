'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, ChevronLeft, ChevronRight, ChevronDown, Copy, CheckCircle2 } from 'lucide-react';
import type { ParentClient, ChildAccount, TimeEntry } from '@/lib/types';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO, isWithinInterval } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type InvoiceData = {
    clientId: string;
    clientName: string;
    fixedFee: number;
    totalHours: number;
    variableFee: number;
    totalFee: number;
    timeEntriesCount: number;
    fixedAccounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string }[];
    entries: TimeEntry[];
};

const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}u ${m}m`;
    if (h > 0) return `${h} uur`;
    return `${m} min`;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
};

export default function InvoicesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [invoiceData, setInvoiceData] = useState<InvoiceData[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoiceData = async () => {
            if (!firestore || !user) return;
            setLoading(true);
            try {
                const monthStart = startOfMonth(currentMonth);
                const monthEnd = endOfMonth(currentMonth);

                // 1. Fetch all clients
                const clientsSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)));
                const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));

                // 1.5 Fetch packages
                const packagesSnap = await getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid)));
                const allPackages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // 2. Fetch all child accounts for fixed fees
                const childAccountsPromises = clients.map(client => 
                    getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                );
                const childAccountsSnaps = await Promise.all(childAccountsPromises);
                
                const clientFixedFees: Record<string, { total: number, accounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string }[] }> = {};
                childAccountsSnaps.forEach((snap, i) => {
                    let totalFixed = 0;
                    const hourlyRate = clients[i].hourlyRate || 0;
                    const accounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string }[] = [];
                    snap.forEach(d => {
                        const acc = d.data() as ChildAccount;
                        const oldFee = 0; // Legacy fee removed

                        let allServicesToBill = [...(acc.connectedServices || [])];
                        
                        if (acc.connectedPackages && acc.connectedPackages.length > 0) {
                            acc.connectedPackages.forEach((pkgRef: any) => {
                                const pkg = allPackages.find(p => p.id === pkgRef.packageId);
                                if (pkg && pkg.services) {
                                    pkg.services.forEach((s: any) => {
                                        allServicesToBill.push({
                                            serviceId: s.serviceId,
                                            serviceName: `${pkg.name} - ${s.serviceName}`,
                                            hours: s.hours
                                        });
                                    });

                                    if (pkg.packageDiscount && pkg.packageDiscount > 0) {
                                        accounts.push({
                                            id: `${d.id}_pkg_${pkg.id}_discount`,
                                            name: acc.nickname || acc.name || 'Account',
                                            fee: -pkg.packageDiscount,
                                            serviceName: `Pakketkorting: ${pkg.name}`
                                        });
                                        totalFixed -= pkg.packageDiscount;
                                    }
                                }
                            });
                        }

                        if (allServicesToBill.length > 0) {
                            // Split by allServicesToBill
                            allServicesToBill.forEach((svc) => {
                                const svcHours = Number(svc.hours) || 0;
                                const svcFee = svcHours * hourlyRate;
                                if (svcFee > 0) {
                                    totalFixed += svcFee;
                                    accounts.push({
                                        id: `${d.id}_${Math.random().toString(36).substr(2, 9)}`,
                                        name: acc.nickname || acc.name || 'Account',
                                        fee: svcFee,
                                        hours: svcHours,
                                        rate: hourlyRate,
                                        serviceName: svc.serviceName
                                    });
                                }
                            });
                            // Still add old fee if it exists
                            if (oldFee > 0) {
                                totalFixed += oldFee;
                                accounts.push({
                                    id: `${d.id}_old`,
                                    name: acc.nickname || acc.name || 'Account',
                                    fee: oldFee,
                                    oldFee: oldFee,
                                    serviceName: "Oude Management Fee"
                                });
                            }
                        } else {
                            const newFee = (acc.fixedHours || 0) * hourlyRate;
                            const fee = newFee + oldFee;

                            if (fee > 0) {
                                totalFixed += fee;
                                accounts.push({ 
                                    id: d.id, 
                                    name: acc.nickname || acc.name || 'Account', 
                                    fee,
                                    hours: acc.fixedHours || 0,
                                    rate: hourlyRate,
                                    oldFee: oldFee
                                });
                            }
                        }
                    });
                    clientFixedFees[clients[i].id] = { total: totalFixed, accounts };
                });

                // 3. Fetch time entries
                const timeEntriesSnap = await getDocs(query(collection(firestore, 'timeEntries'), where('ownerId', '==', user.uid)));
                const allEntries = timeEntriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
                
                // Filter for current month
                const monthEntries = allEntries.filter(entry => {
                    const date = parseISO(entry.date);
                    return isWithinInterval(date, { start: monthStart, end: monthEnd });
                });

                // Aggregate time entries per client
                const clientTimeAgg: Record<string, { totalHours: number, variableFee: number, count: number, entries: TimeEntry[] }> = {};
                monthEntries.forEach(entry => {
                    if (!clientTimeAgg[entry.parentClientId]) {
                        clientTimeAgg[entry.parentClientId] = { totalHours: 0, variableFee: 0, count: 0, entries: [] };
                    }
                    const hours = entry.durationMinutes / 60;
                    clientTimeAgg[entry.parentClientId].totalHours += hours;
                    clientTimeAgg[entry.parentClientId].variableFee += hours * (entry.hourlyRateAtTime || 0);
                    clientTimeAgg[entry.parentClientId].count += 1;
                    clientTimeAgg[entry.parentClientId].entries.push(entry);
                });

                // Combine data
                const finalData: InvoiceData[] = clients.map(client => {
                    const fixedData = clientFixedFees[client.id] || { total: 0, accounts: [] };
                    const timeAgg = clientTimeAgg[client.id] || { totalHours: 0, variableFee: 0, count: 0, entries: [] };
                    
                    // Sort entries by date desc
                    timeAgg.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    return {
                        clientId: client.id,
                        clientName: client.clientName,
                        fixedFee: fixedData.total,
                        fixedAccounts: fixedData.accounts,
                        totalHours: timeAgg.totalHours,
                        variableFee: timeAgg.variableFee,
                        totalFee: fixedData.total + timeAgg.variableFee,
                        timeEntriesCount: timeAgg.count,
                        entries: timeAgg.entries
                    };
                }).filter(data => data.totalFee > 0 || data.timeEntriesCount > 0); // Only show clients with billable stuff

                setInvoiceData(finalData.sort((a, b) => b.totalFee - a.totalFee));

            } catch (e) {
                console.error("Error fetching invoice data:", e);
                toast({ variant: 'destructive', title: 'Fout bij ophalen gegevens' });
            } finally {
                setLoading(false);
            }
        };

        fetchInvoiceData();
    }, [firestore, user, currentMonth]);

    const copyToClipboard = (data: InvoiceData) => {
        const text = `Factuur Details voor ${data.clientName} - ${format(currentMonth, 'MMMM yyyy', { locale: nl })}\n` +
                     `Vaste kosten (Management Fee): ${formatCurrency(data.fixedFee)}\n` +
                     `Losse uren (${data.totalHours.toFixed(2)} uur): ${formatCurrency(data.variableFee)}\n` +
                     `---------------------------\n` +
                     `Totaalbedrag: ${formatCurrency(data.totalFee)}`;
        
        navigator.clipboard.writeText(text);
        setCopiedId(data.clientId);
        toast({ title: 'Factuurgegevens gekopieerd!' });
        setTimeout(() => setCopiedId(null), 2000);
    };

    const grandTotal = useMemo(() => invoiceData.reduce((acc, curr) => acc + curr.totalFee, 0), [invoiceData]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight flex items-center gap-3">
                        <Receipt className="text-blue-500 size-8" />
                        Facturatie Overzicht
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Genereer maandelijkse totalen voor je administratie.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-card p-1.5 rounded-xl border shadow-xl">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="size-4" />
                    </Button>
                    <div className="px-4 py-1 text-sm font-bold uppercase tracking-widest min-w-[140px] text-center">
                        {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="size-10 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Totaal Omzet (Schatting)</p>
                                <h2 className="text-4xl font-black text-primary mt-1">{formatCurrency(grandTotal)}</h2>
                            </div>
                            <Badge variant="outline" className="text-xs py-1.5 px-3 border-primary/30">
                                {invoiceData.length} klanten deze maand
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Klanten Overzicht</CardTitle>
                            <CardDescription>Overzicht van vaste en variabele kosten per klant.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {invoiceData.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">Geen factureerbare activiteiten gevonden voor deze maand.</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Klant</TableHead>
                                            <TableHead className="text-right">Vaste Kosten</TableHead>
                                            <TableHead className="text-right">Losse Uren</TableHead>
                                            <TableHead className="text-right">Variabele Kosten</TableHead>
                                            <TableHead className="text-right font-bold text-foreground">Totaal</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoiceData.map((data) => (
                                            <InvoiceRow 
                                                key={data.clientId} 
                                                data={data} 
                                                currentMonth={currentMonth} 
                                                copiedId={copiedId} 
                                                onCopyData={copyToClipboard}
                                                toast={toast}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function InvoiceRow({ data, currentMonth, copiedId, onCopyData, toast }: any) {
    const [expanded, setExpanded] = useState(false);
    const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);

    const copyEntry = (e: React.MouseEvent, entry: TimeEntry) => {
        e.stopPropagation();
        const text = `${format(parseISO(entry.date), 'dd MMM yyyy', { locale: nl })} - ${formatDuration(entry.durationMinutes)} - ${entry.description}`;
        navigator.clipboard.writeText(text);
        setCopiedEntryId(entry.id);
        toast({ title: 'Urenregel gekopieerd!' });
        setTimeout(() => setCopiedEntryId(null), 2000);
    };

    const copyFixedEntry = (e: React.MouseEvent, acc: { id: string, name: string, fee: number, hours?: number, rate?: number, serviceName?: string }) => {
        e.stopPropagation();
        const details = acc.hours && acc.hours > 0 ? ` (${acc.hours} uur @ ${formatCurrency(acc.rate || 0)}/u)` : '';
        const servicePart = acc.serviceName ? ` - ${acc.serviceName}` : '';
        const text = `Vaste Fee - ${acc.name}${servicePart}${details} - ${formatCurrency(acc.fee)}`;
        navigator.clipboard.writeText(text);
        setCopiedEntryId(acc.id);
        toast({ title: 'Vaste kosten gekopieerd!' });
        setTimeout(() => setCopiedEntryId(null), 2000);
    };

    const hasDetails = data.timeEntriesCount > 0 || data.fixedAccounts.length > 0;

    return (
        <>
            <TableRow 
                className={cn("cursor-pointer hover:bg-muted/50 transition-colors", expanded && "bg-muted/30")} 
                onClick={() => setExpanded(!expanded)}
            >
                <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                        {hasDetails ? (
                            expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
                        ) : (
                            <div className="w-4" />
                        )}
                        {data.clientName}
                    </div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.fixedFee)}</TableCell>
                <TableCell className="text-right">
                    <span className="text-muted-foreground">{data.totalHours.toFixed(2)}u</span>
                    {data.timeEntriesCount > 0 && (
                        <span className="ml-2 text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{data.timeEntriesCount} logs</span>
                    )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.variableFee)}</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(data.totalFee)}</TableCell>
                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onCopyData(data)}
                        className="h-8"
                    >
                        {copiedId === data.clientId ? (
                            <CheckCircle2 className="size-4 text-green-500 mr-2" />
                        ) : (
                            <Copy className="size-4 text-muted-foreground mr-2" />
                        )}
                        Kopieer Totaal
                    </Button>
                </TableCell>
            </TableRow>
            {expanded && hasDetails && (
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-0">
                        <div className="px-6 py-4 border-b border-border/50 space-y-6">
                            
                            {data.fixedAccounts.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Vaste Kosten (Management Fee)</h4>
                                    <div className="space-y-2">
                                        {data.fixedAccounts.map((acc: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string }) => (
                                            <div key={acc.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-background p-3 rounded-md border shadow-sm gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-primary">
                                                        Vaste Fee - {acc.name}
                                                        {acc.serviceName && <span className="ml-2 text-muted-foreground font-normal">({acc.serviceName})</span>}
                                                    </span>
                                                    {acc.hours && acc.hours > 0 ? (
                                                        <span className="text-muted-foreground">{acc.hours} uur @ {formatCurrency(acc.rate || 0)}/u</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Oude management fee</span>
                                                    )}
                                                    {acc.oldFee && acc.oldFee > 0 && acc.hours && acc.hours > 0 ? (
                                                        <span className="text-[10px] text-muted-foreground">Inclusief oude fee: {formatCurrency(acc.oldFee)}</span>
                                                    ) : null}
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
                                                    <div className="flex flex-col items-end">
                                                        <span className="tabular-nums font-bold text-foreground">-</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{formatCurrency(acc.fee)}</span>
                                                    </div>
                                                    <Button 
                                                        variant="secondary" 
                                                        size="sm" 
                                                        className="h-7 text-xs"
                                                        onClick={(e) => copyFixedEntry(e, acc)}
                                                    >
                                                        {copiedEntryId === acc.id ? (
                                                            <CheckCircle2 className="size-3 mr-1.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="size-3 mr-1.5" />
                                                        )}
                                                        Kopieer
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.entries.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Losse Uren</h4>
                                    <div className="space-y-2">
                                        {data.entries.map((entry: TimeEntry) => (
                                            <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-background p-3 rounded-md border shadow-sm gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-primary">{format(parseISO(entry.date), 'd MMM yyyy', { locale: nl })}</span>
                                                    <span className="text-muted-foreground">{entry.description}</span>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
                                                    <div className="flex flex-col items-end">
                                                        <span className="tabular-nums font-bold text-foreground">{formatDuration(entry.durationMinutes)}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{formatCurrency((entry.durationMinutes / 60) * entry.hourlyRateAtTime)}</span>
                                                    </div>
                                                    <Button 
                                                        variant="secondary" 
                                                        size="sm" 
                                                        className="h-7 text-xs"
                                                        onClick={(e) => copyEntry(e, entry)}
                                                    >
                                                        {copiedEntryId === entry.id ? (
                                                            <CheckCircle2 className="size-3 mr-1.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="size-3 mr-1.5" />
                                                        )}
                                                        Kopieer
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
