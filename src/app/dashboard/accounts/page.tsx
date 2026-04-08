
'use client';

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {PlusCircle, Users, Loader2, Library, Target, Wallet, Briefcase, ChevronDown, Mail, ExternalLink, ListChecks, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import type { ParentClient, ChildAccount, AppUser } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';


function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 p-20 text-center border-dashed bg-transparent border-[#2A3552]">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-white/5">
            <Library className="size-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
            <h3 className="text-2xl font-bold font-headline">Geen accounts gevonden</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Je portfolio is nog leeg of er zijn geen accounts aan je toegewezen.
            </p>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="bg-[#1C243A] border-[#2A3552] h-24 animate-pulse" />
                ))}
            </div>
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#1C243A] border border-[#2A3552] rounded-xl h-16 animate-pulse" />
            ))}
        </div>
    )
}

type EnrichedChildAccount = ChildAccount & {
    parentName: string;
    assignedEmployeeName?: string;
}

type GroupedAccounts = {
    parentClient: ParentClient;
    accounts: EnrichedChildAccount[];
    totalBudget: number;
    totalFee: number;
}

export default function UnifiedPortfolioPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<GroupedAccounts[]>([]);
    const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
    const [totals, setTotals] = useState({ budget: 0, fee: 0, count: 0 });

    const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: appUser } = useDoc(userDocRef);
    
    const isAdmin = useMemo(() => {
        const role = (appUser as AppUser)?.role?.toLowerCase();
        return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
    }, [appUser, user?.email]);

    useEffect(() => {
        if (!firestore || !user || !appUser) return;

        const fetchAllData = async () => {
            setLoading(true);

            try {
                const managerUid = isAdmin ? user.uid : (appUser as AppUser).managerId;
                if (!managerUid) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch parent clients of the manager
                const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
                const clientsSnapshot = await getDocs(clientsQuery);
                const parentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentClient));

                if (parentClients.length === 0) {
                    setGroupedData([]);
                    setLoading(false);
                    return;
                }
                
                // 2. Fetch all child accounts and employees in parallel
                const [childAccountSnapshots, teamSnapshot] = await Promise.all([
                    Promise.all(parentClients.map(client => 
                        isAdmin 
                            ? getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                            : getDocs(query(collection(firestore, 'parentClients', client.id, 'childAccounts'), where('assignedEmployeeId', '==', user.uid)))
                    )),
                    isAdmin ? getDocs(query(collection(firestore, 'users'), where('managerId', '==', user.uid))) : Promise.resolve({ docs: [] })
                ]);
                
                const employeeNamesMap = new Map<string, string>();
                if (isAdmin) {
                    const members = teamSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser));
                    setTeamMembers(members);
                    members.forEach(m => {
                        employeeNamesMap.set(m.uid, m.displayName || m.email || 'Geen Naam');
                    });
                }

                let globalBudget = 0;
                let globalFee = 0;
                let globalCount = 0;

                const grouped: GroupedAccounts[] = parentClients.map((client, index) => {
                    const snapshot = childAccountSnapshots[index];
                    const accounts = snapshot.docs.map(doc => {
                        const data = doc.data() as ChildAccount;
                        return {
                            ...data,
                            id: doc.id,
                            parentName: client.clientName,
                            assignedEmployeeName: data.assignedEmployeeId ? employeeNamesMap.get(data.assignedEmployeeId) : undefined
                        } as EnrichedChildAccount;
                    }).filter(acc => {
                        if (acc.isPaused) return false;
                        if (isAdmin) return true;
                        return acc.assignedEmployeeId === user.uid;
                    });

                    const clientBudget = accounts.reduce((sum, acc) => sum + (acc.monthlyClickBudget || 0), 0);
                    const clientFee = accounts.reduce((sum, acc) => sum + (acc.managementFee?.amount || 0), 0);

                    globalBudget += clientBudget;
                    globalFee += clientFee;
                    globalCount += accounts.length;

                    return {
                        parentClient: client,
                        accounts: accounts.sort((a, b) => a.nickname.localeCompare(b.nickname)),
                        totalBudget: clientBudget,
                        totalFee: clientFee
                    };
                }).filter(group => group.accounts.length > 0);
                
                setGroupedData(grouped.sort((a, b) => a.parentClient.clientName.localeCompare(b.parentClient.clientName)));
                setTotals({ budget: globalBudget, fee: globalFee, count: globalCount });
            } catch (e) {
                console.error("Fout bij ophalen portfolio data:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();

    }, [firestore, user, appUser, isAdmin]);

    const handleAssignEmployee = async (parentClientId: string, childAccountId: string, employeeId: string) => {
        if (!firestore) return;
        
        try {
            const docRef = doc(firestore, 'parentClients', parentClientId, 'childAccounts', childAccountId);
            await updateDoc(docRef, {
                assignedEmployeeId: employeeId || null
            });

            // Update local state for immediate feedback
            setGroupedData(prev => prev.map(group => {
                if (group.parentClient.id !== parentClientId) return group;
                return {
                    ...group,
                    accounts: group.accounts.map(acc => {
                        if (acc.id !== childAccountId) return acc;
                        const employee = teamMembers.find(m => m.uid === employeeId);
                        return { 
                            ...acc, 
                            assignedEmployeeId: employeeId || undefined,
                            assignedEmployeeName: employee ? (employee.displayName || employee.email || 'Geen Naam') : undefined
                        };
                    })
                };
            }));

            toast({
                title: employeeId ? "Medewerker toegewezen" : "Toewijzing verwijderd",
                description: "De wijziging is succesvol opgeslagen in Firestore."
            });
        } catch (e) {
            console.error("Error updating assignment:", e);
            toast({
                variant: "destructive",
                title: "Fout bij toewijzen",
                description: "Kon de medewerker niet toewijzen. Probeer het opnieuw."
            });
        }
    };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight">
            Portfolio Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Een overzicht van al je klanten en hun actieve Google Ads accounts.' : 'Een overzicht van de accounts waaraan je bent toegewezen.'}
          </p>
        </div>
        {isAdmin && (
            <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
                <Link href="/dashboard/clients/add">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nieuwe Klant
                </Link>
            </Button>
        )}
      </div>
      
      {loading ? <LoadingState /> : groupedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Actieve Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                            <Target className="size-5" />
                        </div>
                        <div className="text-3xl font-bold">{totals.count}</div>
                    </CardContent>
                </Card>
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Maandelijks Click Budget</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                            <Wallet className="size-5" />
                        </div>
                        <div className="text-3xl font-bold">€{totals.budget.toLocaleString('nl-NL')}</div>
                    </CardContent>
                </Card>
                {isAdmin && (
                    <Card className="bg-[#1C243A] border-[#2A3552]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Management Omzet</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Briefcase className="size-5" />
                            </div>
                            <div className="text-3xl font-bold">€{totals.fee.toLocaleString('nl-NL')}</div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Mijn Klantendossiers</h2>
                <Accordion type="multiple" defaultValue={groupedData.map(g => g.parentClient.id)} className="space-y-4">
                    {groupedData.map((group) => (
                        <AccordionItem key={group.parentClient.id} value={group.parentClient.id} className="border-none bg-[#1C243A] border border-[#2A3552] rounded-xl overflow-hidden shadow-sm">
                            <div className="flex items-center px-6 py-4 hover:bg-white/5 transition-colors">
                                <AccordionTrigger className="flex-grow py-0 hover:no-underline [&[data-state=open]>div>div>svg.chevron]:rotate-180">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                <Users className="size-5" />
                                            </div>
                                            <div className="text-left min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold font-headline leading-tight truncate">{group.parentClient.clientName}</h3>
                                                    <Badge variant="secondary" className={cn("text-[9px] uppercase font-black px-1.5 h-4 border-none", group.parentClient.clientType === 'agency' ? "bg-indigo-500/10 text-indigo-400" : "bg-orange-500/10 text-orange-400")}>
                                                        {group.parentClient.clientType}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter flex items-center gap-1">
                                                        <Mail className="size-2.5" /> {group.parentClient.clientContactEmail}
                                                    </p>
                                                    <span className="text-slate-700 text-xs">•</span>
                                                    <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-tighter">{group.accounts.length} accounts</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="hidden lg:flex items-center gap-8">
                                            <div className="text-right">
                                                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-[0.1em] mb-0.5">Budget</p>
                                                <p className="text-sm font-bold text-green-400">€{group.totalBudget.toLocaleString('nl-NL')}</p>
                                            </div>
                                            {isAdmin && (
                                                <div className="text-right">
                                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-[0.1em] mb-0.5">Management</p>
                                                    <p className="text-sm font-bold text-blue-400">€{group.totalFee.toLocaleString('nl-NL')}</p>
                                                </div>
                                            )}
                                            <ChevronDown className="size-4 text-slate-600 transition-transform duration-200 chevron" />
                                        </div>
                                    </div>
                                </AccordionTrigger>
                            </div>
                            
                            <AccordionContent className="px-6 pb-6 pt-2 border-t border-[#2A3552] bg-black/10">
                                <div className="space-y-1 mt-2">
                                    <div className={cn(
                                        "grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500",
                                        isAdmin ? "grid-cols-[1fr_120px_100px_120px_120px]" : "grid-cols-[1fr_100px_120px]"
                                    )}>
                                        <span>Account Informatie</span>
                                        {isAdmin && <span>Medewerker</span>}
                                        <span className="text-center">Dekking</span>
                                        <span className="text-right">Click Budget</span>
                                        {isAdmin && <span className="text-right pr-4">Fee</span>}
                                    </div>
                                    {group.accounts.map((account) => (
                                        <Link 
                                            key={account.id} 
                                            href={`/dashboard/accounts/${account.id}?parent=${account.parentClientId}`}
                                            className={cn(
                                                "grid items-center px-4 py-3 rounded-lg bg-[#1C243A] border border-white/5 group hover:bg-blue-500/5 hover:border-blue-500/20 transition-all",
                                                isAdmin ? "grid-cols-[1fr_120px_100px_120px_120px]" : "grid-cols-[1fr_100px_120px]"
                                            )}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-200 group-hover:text-blue-400 transition-colors">
                                                    {account.nickname}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">ID: {account.googleAdsClientId}</span>
                                            </div>
                                            {isAdmin && (
                                                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                                    <Select
                                                        value={account.assignedEmployeeId || "unassigned"}
                                                        onValueChange={(val) => handleAssignEmployee(account.parentClientId, account.id, val === "unassigned" ? "" : val)}
                                                    >
                                                        <SelectTrigger className="h-7 w-[110px] text-[10px] bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                                                            <SelectValue placeholder="Toewijzen" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-[#1C243A] border-[#2A3552] text-slate-200">
                                                            <SelectItem value="unassigned" className="text-[10px]">Geen</SelectItem>
                                                            {teamMembers.map(member => (
                                                                <SelectItem key={member.uid} value={member.uid} className="text-[10px]">
                                                                    {member.displayName || member.email?.split('@')[0] || 'Onbekend'}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            <div className="flex justify-center">
                                                <Badge variant="outline" className={cn("text-[9px] font-bold h-5 px-1.5 border-none", (account.connectedChecklists?.length || 0) > 0 ? "bg-green-500/10 text-green-400" : "bg-slate-800 text-slate-500")}>
                                                    <ListChecks className="size-2.5 mr-1" />
                                                    {account.connectedChecklists?.length || 0}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-semibold text-slate-300">€{account.monthlyClickBudget?.toLocaleString('nl-NL') || '0'}</span>
                                            </div>
                                            {isAdmin && (
                                                <div className="text-right pr-4">
                                                    <span className="text-sm font-semibold text-blue-400/80">€{account.managementFee?.amount?.toLocaleString('nl-NL') || '0'}</span>
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                                <div className="mt-6 flex justify-between items-center px-1">
                                    <div className="flex gap-2">
                                        {isAdmin && (
                                            <Button variant="ghost" size="sm" asChild className="text-[10px] font-bold uppercase tracking-widest h-7 text-muted-foreground hover:text-white">
                                                <Link href={`/dashboard/clients/${group.parentClient.id}/edit`}>
                                                    Klant Bewerken
                                                </Link>
                                            </Button>
                                        )}
                                        {group.parentClient.clientWebsite && (
                                            <Button variant="ghost" size="sm" asChild className="text-[10px] font-bold uppercase tracking-widest h-7 text-muted-foreground hover:text-white">
                                                <a href={group.parentClient.clientWebsite} target="_blank" rel="noreferrer">
                                                    Website <ExternalLink className="ml-1 size-2.5" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm" asChild className="text-[10px] font-bold uppercase tracking-widest h-7 border-slate-800 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all">
                                        <Link href={`/dashboard/clients/${group.parentClient.id}`}>
                                            Volledig Dossier Inzien
                                        </Link>
                                    </Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </>
      )}
    </div>
  );
}
