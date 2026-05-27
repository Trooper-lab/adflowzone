'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, ChevronLeft, ChevronRight, ChevronDown, Copy, CheckCircle2 } from 'lucide-react';
import type { ParentClient, ChildAccount, TimeEntry, ServicePackage } from '@/lib/types';
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
    fixedAccounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string, childAccountId?: string }[];
    entries: TimeEntry[];
    childAccountNames: Record<string, string>;
    childAccountIdsMap: Record<string, string>;
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
                const allPackages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as ServicePackage));

                // 2. Fetch all child accounts for fixed fees
                const childAccountsPromises = clients.map(client => 
                    getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                );
                const childAccountsSnaps = await Promise.all(childAccountsPromises);
                
                const childAccountIdNormalizeMap: Record<string, string> = {};
                const childAccountNamesMap: Record<string, Record<string, string>> = {};
                const clientFixedFees: Record<string, { total: number, accounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string, childAccountId?: string }[] }> = {};
                childAccountsSnaps.forEach((snap, i) => {
                    const clientId = clients[i].id;
                    childAccountNamesMap[clientId] = {};
                    let totalFixed = 0;
                    const hourlyRate = clients[i].hourlyRate || 0;
                    const accounts: { id: string, name: string, fee: number, hours?: number, rate?: number, oldFee?: number, serviceName?: string, childAccountId?: string }[] = [];
                    snap.forEach(d => {
                        const acc = d.data() as ChildAccount;
                        const name = acc.nickname || acc.googleAdsAccountName || 'Account';
                        
                        // Map names
                        childAccountNamesMap[clientId][d.id] = name;
                        
                        // Map normalization
                        childAccountIdNormalizeMap[d.id] = d.id;
                        if (acc.googleAdsClientId) {
                            childAccountIdNormalizeMap[acc.googleAdsClientId] = d.id;
                            childAccountNamesMap[clientId][acc.googleAdsClientId] = name;
                        }
                        if (acc.metaAdsAccountId) {
                            childAccountIdNormalizeMap[acc.metaAdsAccountId] = d.id;
                            childAccountNamesMap[clientId][acc.metaAdsAccountId] = name;
                        }
                        
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
                                            name: acc.nickname || acc.googleAdsAccountName || 'Account',
                                            fee: -pkg.packageDiscount,
                                            serviceName: `Pakketkorting: ${pkg.name}`,
                                            childAccountId: d.id
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
                                        name: acc.nickname || acc.googleAdsAccountName || 'Account',
                                        fee: svcFee,
                                        hours: svcHours,
                                        rate: hourlyRate,
                                        serviceName: svc.serviceName,
                                        childAccountId: d.id
                                    });
                                }
                            });
                        }
                        
                        // Still add old fee if it exists (for legacy support if needed)
                        if (oldFee > 0) {
                            totalFixed += oldFee;
                            accounts.push({
                                id: `${d.id}_old`,
                                name: acc.nickname || acc.googleAdsAccountName || 'Account',
                                fee: oldFee,
                                oldFee: oldFee,
                                serviceName: "Oude Management Fee",
                                childAccountId: d.id
                            });
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
                    
                    // Normalize entry.childAccountId
                    let normChildId = entry.childAccountId;
                    if (normChildId && childAccountIdNormalizeMap[normChildId]) {
                        normChildId = childAccountIdNormalizeMap[normChildId];
                    }
                    
                    clientTimeAgg[entry.parentClientId].entries.push({
                        ...entry,
                        childAccountId: normChildId
                    });
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
                        entries: timeAgg.entries,
                        childAccountNames: childAccountNamesMap[client.id] || {},
                        childAccountIdsMap: childAccountIdNormalizeMap
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

    const hasDetails = data.timeEntriesCount > 0 || data.fixedAccounts.length > 0;

    const groupedAccounts = useMemo(() => {
        const groups: Record<string, { id: string, name: string, fixedItems: any[], variableItems: any[] }> = {};
        
        // Add fixed accounts
        if (data.fixedAccounts) {
            data.fixedAccounts.forEach((acc: any) => {
                let childId = acc.childAccountId || 'none';
                if (childId !== 'none' && data.childAccountIdsMap?.[childId]) {
                    childId = data.childAccountIdsMap[childId];
                }
                if (!groups[childId]) {
                    groups[childId] = {
                        id: childId,
                        name: childId === 'none' ? 'Algemeen' : (data.childAccountNames?.[childId] || acc.name || 'Account'),
                        fixedItems: [],
                        variableItems: []
                    };
                }
                groups[childId].fixedItems.push({
                    id: acc.id,
                    type: 'fixed',
                    description: acc.serviceName || 'Vaste service fee',
                    hours: acc.hours || 0,
                    rate: acc.rate || 0,
                    fee: acc.fee,
                    isDiscount: acc.fee < 0
                });
            });
        }
        
        // Add variable items (aggregated)
        if (data.entries && data.entries.length > 0) {
            const tempVarGroups: Record<string, { totalHours: number, totalFee: number }> = {};
            data.entries.forEach((entry: TimeEntry) => {
                let childId = entry.childAccountId || 'none';
                if (childId !== 'none' && data.childAccountIdsMap?.[childId]) {
                    childId = data.childAccountIdsMap[childId];
                }
                if (!tempVarGroups[childId]) {
                    tempVarGroups[childId] = { totalHours: 0, totalFee: 0 };
                }
                const hours = entry.durationMinutes / 60;
                tempVarGroups[childId].totalHours += hours;
                tempVarGroups[childId].totalFee += hours * (entry.hourlyRateAtTime || 0);
            });
            
            Object.entries(tempVarGroups).forEach(([childId, agg]) => {
                if (agg.totalHours === 0) return;
                
                if (!groups[childId]) {
                    groups[childId] = {
                        id: childId,
                        name: childId === 'none' ? 'Algemeen' : (data.childAccountNames?.[childId] || 'Account'),
                        fixedItems: [],
                        variableItems: []
                    };
                }
                
                const avgRate = agg.totalHours > 0 ? (agg.totalFee / agg.totalHours) : 0;
                groups[childId].variableItems.push({
                    id: `${data.clientId}_var_${childId}`,
                    type: 'variable',
                    description: 'Support uren',
                    hours: agg.totalHours,
                    rate: avgRate,
                    fee: agg.totalFee,
                    isDiscount: false
                });
            });
        }
        
        // Sort groups: 'none' (Algemeen) last, others alphabetically
        return Object.values(groups).sort((a, b) => {
            if (a.id === 'none') return 1;
            if (b.id === 'none') return -1;
            return a.name.localeCompare(b.name);
        });
    }, [data]);

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
                <TableRow className="bg-muted/5 hover:bg-muted/5">
                    <TableCell colSpan={6} className="p-4">
                        <div className="border border-border/50 rounded-lg overflow-hidden shadow-sm bg-background/50">
                            <Table>
                                <TableHeader className="bg-muted/20">
                                    <TableRow>
                                        <TableHead className="w-[100px] text-xs">Type</TableHead>
                                        <TableHead className="text-xs">Omschrijving / Dienst</TableHead>
                                        <TableHead className="text-right w-[110px] text-xs">Uren</TableHead>
                                        <TableHead className="text-right w-[110px] text-xs">Tarief</TableHead>
                                        <TableHead className="text-right w-[110px] text-xs font-bold">Bedrag</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedAccounts.map((group: any) => (
                                        <Fragment key={group.id}>
                                            {/* Group Account Name Header Row */}
                                            <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/40">
                                                <TableCell colSpan={6} className="py-2.5 px-4">
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                                                                {group.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full tabular-nums">
                                                            Subtotaal: {formatCurrency(
                                                                group.fixedItems.reduce((sum: number, item: any) => sum + item.fee, 0) + 
                                                                group.variableItems.reduce((sum: number, item: any) => sum + item.fee, 0)
                                                            )}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Fixed Rows */}
                                            {group.fixedItems.map((item: any) => (
                                                <TableRow key={item.id} className="hover:bg-muted/30">
                                                    <TableCell className="py-2.5 pl-6">
                                                        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider py-0.5 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                            Vast
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs font-medium text-slate-200">
                                                        {item.description}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">
                                                        {item.hours > 0 ? `${item.hours.toFixed(2)} u` : '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">
                                                        {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                                                    </TableCell>
                                                    <TableCell className={cn("py-2.5 text-xs text-right tabular-nums font-bold", item.isDiscount ? "text-red-400" : "text-slate-100")}>
                                                        {formatCurrency(item.fee)}
                                                    </TableCell>
                                                    <TableCell className="py-1 text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const details = item.hours > 0 ? ` (${item.hours.toFixed(2)} uur @ ${formatCurrency(item.rate)}/u)` : '';
                                                                const text = `Vaste Fee - ${group.name} (${item.description})${details} - ${formatCurrency(item.fee)}`;
                                                                navigator.clipboard.writeText(text);
                                                                setCopiedEntryId(item.id);
                                                                toast({ title: 'Gekopieerd!' });
                                                                setTimeout(() => setCopiedEntryId(null), 2000);
                                                            }}
                                                        >
                                                            {copiedEntryId === item.id ? (
                                                                <CheckCircle2 className="size-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="size-3.5" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {/* Variable Rows */}
                                            {group.variableItems.map((item: any) => (
                                                <TableRow key={item.id} className="hover:bg-muted/30">
                                                    <TableCell className="py-2.5 pl-6">
                                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider py-0.5 px-1.5 border-orange-500/30 text-orange-400 bg-orange-500/5">
                                                            Los
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs font-medium text-slate-200">
                                                        {item.description}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">
                                                        {item.hours > 0 ? `${item.hours.toFixed(2)} u` : '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">
                                                        {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-xs text-right tabular-nums font-bold text-slate-100">
                                                        {formatCurrency(item.fee)}
                                                    </TableCell>
                                                    <TableCell className="py-1 text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const details = item.hours > 0 ? ` (${item.hours.toFixed(2)} uur @ ${formatCurrency(item.rate)}/u)` : '';
                                                                const text = `Support - ${group.name} (${item.description})${details} - ${formatCurrency(item.fee)}`;
                                                                navigator.clipboard.writeText(text);
                                                                setCopiedEntryId(item.id);
                                                                toast({ title: 'Gekopieerd!' });
                                                                setTimeout(() => setCopiedEntryId(null), 2000);
                                                            }}
                                                        >
                                                            {copiedEntryId === item.id ? (
                                                                <CheckCircle2 className="size-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="size-3.5" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
