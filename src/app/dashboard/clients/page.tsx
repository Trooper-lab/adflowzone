
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Button} from '@/components/ui/button';
import {MoreHorizontal, PlusCircle, Users, Loader2, Wallet, Briefcase, Target, ExternalLink, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import type { ParentClient, ChildAccount } from '@/lib/types';
import { cn } from '@/lib/utils';

type ClientWithTotals = ParentClient & {
    totalBudget: number;
    totalFee: number;
    accountCount: number;
};

function CreateClientButton() {
  return (
    <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
      <Link href="/dashboard/clients/add">
        <PlusCircle className="mr-2 h-4 w-4" />
        Klant Toevoegen
      </Link>
    </Button>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 p-20 text-center border-dashed bg-transparent border-[#2A3552]">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-white/5">
            <Users className="size-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
            <h3 className="text-2xl font-bold font-headline">Nog geen klanten</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Het lijkt erop dat je nog geen klanten hebt toegevoegd. Begin met het aanmaken van je eerste klantprofiel.
            </p>
        </div>
      </div>
      <CreateClientButton />
    </Card>
  );
}

function LoadingState() {
    return (
        <Card className="flex flex-col items-center justify-center gap-6 p-20 text-center border-dashed bg-transparent border-[#2A3552]">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-12 text-blue-500 animate-spin" />
                <h3 className="text-xl font-semibold font-headline">Klanten laden...</h3>
                <p className="text-muted-foreground">
                    Je portfolio wordt samengesteld.
                </p>
            </div>
        </Card>
    )
}


export default function ClientsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const [appUser, setAppUser] = useState<any>(null);
    
    useEffect(() => {
        if (!userDocRef) return;
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                setAppUser({ id: doc.id, ...doc.data() });
            }
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const isAdmin = useMemo(() => {
        const role = (appUser as any)?.role?.toLowerCase();
        return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
    }, [appUser, user?.email]);

    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<ClientWithTotals[]>([]);

    useEffect(() => {
        if (!firestore || !user || !appUser) return;

        const fetchAllData = async () => {
            setLoading(true);

            try {
                const managerUid = isAdmin ? user.uid : appUser.managerId;
                if (!managerUid) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch parent clients
                const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
                const clientsSnapshot = await getDocs(clientsQuery);
                const parentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentClient));

                if (parentClients.length === 0) {
                    setClients([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch all child accounts and calculate totals for each client (excluding paused accounts)
                const clientsWithTotals: ClientWithTotals[] = await Promise.all(
                    parentClients.map(async (client) => {
                        const childAccountsQuery = collection(firestore, 'parentClients', client.id, 'childAccounts');
                        const childAccountsSnapshot = await getDocs(childAccountsQuery);
                        const childAccounts = childAccountsSnapshot.docs.map(doc => doc.data() as ChildAccount);
                        
                        // Filter for active accounts only
                        const activeAccounts = childAccounts.filter(acc => !acc.isPaused);
                        
                        const totals = activeAccounts.reduce((acc, account) => {
                            acc.totalBudget += account.monthlyClickBudget || 0;
                            acc.totalFee += account.managementFee?.amount || 0;
                            acc.count += 1;
                            return acc;
                        }, { totalBudget: 0, totalFee: 0, count: 0 });

                        return { ...client, ...totals, accountCount: totals.count };
                    })
                );
                
                setClients(clientsWithTotals.sort((a, b) => a.clientName.localeCompare(b.clientName)));
            } catch (e) {
                console.error("Fout bij laden klanten:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();

    }, [firestore, user, appUser, isAdmin]);

    const globalStats = useMemo(() => {
        return clients.reduce((acc, client) => {
            acc.totalBudget += client.totalBudget;
            acc.totalFees += client.totalFee;
            acc.totalAccounts += client.accountCount;
            return acc;
        }, { totalBudget: 0, totalFees: 0, totalAccounts: 0 });
    }, [clients]);


  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight">
            Klantendossiers
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer je bureaus, freelancers en hun Google Ads accounts.
          </p>
        </div>
        {!loading && clients.length > 0 && isAdmin && <CreateClientButton />}
      </div>
      
      {loading ? (
          <LoadingState />
      ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 p-20 text-center border-dashed bg-transparent border-[#2A3552] border rounded-xl">
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-white/5">
                    <Users className="size-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold font-headline">Nog geen klanten</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Het lijkt erop dat er nog geen klanten zijn toegevoegd.
                    </p>
                </div>
            </div>
            {isAdmin && <CreateClientButton />}
          </div>
      ) : (
        <>
            {/* Global Portfolio Stats */}
            <div className={cn("grid grid-cols-1 gap-6", isAdmin ? "md:grid-cols-3" : "md:grid-cols-2")}>
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Totaal Portfolio Budget</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-green-400">€{globalStats.totalBudget.toLocaleString('nl-NL')}</div>
                        <span className="text-xs text-muted-foreground">/ maand</span>
                    </CardContent>
                </Card>
                {isAdmin && (
                    <Card className="bg-[#1C243A] border-[#2A3552]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Totaal Management Fees</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-baseline gap-2">
                            <div className="text-3xl font-bold text-blue-400">€{globalStats.totalFees.toLocaleString('nl-NL')}</div>
                            <span className="text-xs text-muted-foreground">/ maand</span>
                        </CardContent>
                    </Card>
                )}
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Actieve Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-baseline gap-2">
                        <div className="text-3xl font-bold text-purple-400">{globalStats.totalAccounts}</div>
                        <span className="text-xs text-muted-foreground">over {clients.length} klanten</span>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-[#1C243A] border-[#2A3552] overflow-hidden shadow-xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-[#2A3552] hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 px-6">Klant & Type</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4">Contactpersoon</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 text-center">Accounts</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 text-right">Totaal Budget</TableHead>
                            {isAdmin && <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 text-right">Totaal Fee</TableHead>}
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 text-right px-6">Acties</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <TableRow key={client.id} className="border-[#2A3552] hover:bg-white/5 transition-colors group">
                                <TableCell className="py-4 px-6">
                                    <div className="flex flex-col">
                                        <Link href={`/dashboard/clients/${client.id}`} className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                                            {client.clientName}
                                        </Link>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className={cn("text-[9px] uppercase font-black px-1.5 h-4 border-none", client.clientType === 'agency' ? "bg-indigo-500/10 text-indigo-400" : "bg-orange-500/10 text-orange-400")}>
                                                {client.clientType}
                                            </Badge>
                                            {client.clientWebsite && (
                                                <a href={client.clientWebsite} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-white">
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <User className="size-3 text-muted-foreground" />
                                            {client.clientContactPerson}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Mail className="size-3" />
                                            {client.clientContactEmail}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-4 text-center">
                                    <Badge variant="outline" className="bg-white/5 border-[#2A3552] text-slate-400 font-mono">
                                        {client.accountCount}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-4 text-right font-semibold text-green-400">
                                    €{client.totalBudget.toLocaleString('nl-NL')}
                                </TableCell>
                                {isAdmin && (
                                    <TableCell className="py-4 text-right font-semibold text-blue-400">
                                        €{client.totalFee.toLocaleString('nl-NL')}
                                    </TableCell>
                                )}
                                <TableCell className="py-4 text-right px-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-[#1C243A] border-[#2A3552] text-slate-200">
                                            <DropdownMenuLabel>Beheer</DropdownMenuLabel>
                                            <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer">
                                                <Link href={`/dashboard/clients/${client.id}/`}>
                                                    <Target className="mr-2 size-4" /> Accounts bekijken
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="focus:bg-white/10 focus:text-white cursor-pointer">
                                                <Link href={`/dashboard/clients/${client.id}/edit`}>
                                                    <Briefcase className="mr-2 size-4" /> Klant bewerken
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-[#2A3552]" />
                                            <DropdownMenuItem className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer">
                                                Verwijderen
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </>
      )}
    </div>
  );
}
