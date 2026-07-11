'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Briefcase, ChevronDown, ExternalLink, Library,
  ListChecks, Loader2, Mail, PlusCircle,
  Target, Users, Wallet, ArrowUpDown, MoreHorizontal,
  Eye, Edit2, Trash2, Shield, Settings, Check
} from 'lucide-react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { ParentClient, ChildAccount, AppUser } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrichedAccount = ChildAccount & {
  parentClient: ParentClient;
  parentName: string;
  assignedEmployeeName?: string;
  derivedHours?: number;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-border py-20 text-center bg-card/20">
      <div className="p-4 rounded-full bg-secondary">
        <Library className="size-10 text-slate-600" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-bold font-headline text-slate-200">Geen accounts gevonden</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          {isAdmin
            ? 'Je portfolio is nog leeg. Start onboarding om je eerste account toe te voegen.'
            : 'Er zijn nog geen accounts aan je toegewezen.'}
        </p>
      </div>
      {isAdmin && (
        <div className="flex gap-3">
          <Button asChild variant="outline" className="border-border">
            <Link href="/dashboard/clients/add">
              <PlusCircle className="mr-2 size-4" /> Nieuwe Klant
            </Link>
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
            <Link href="/dashboard/accounts/onboard">
              <PlusCircle className="mr-2 size-4" /> Start Onboarding
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary border border-border animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-secondary border border-border animate-pulse" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<EnrichedAccount[]>([]);
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [totals, setTotals] = useState({ budget: 0, fee: 0, count: 0, clients: 0 });

  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof EnrichedAccount | 'parentName'>('parentName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user],
  );
  const { data: appUser } = useDoc(userDocRef);

  const isAdmin = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    return (
      role === 'admin' ||
      user?.email === 'billy@pearsonline.nl' ||
      user?.email === 'billy@trooper.es' ||
      user?.email?.toLowerCase() === 'admin@onlyforward.nl'
    );
  }, [appUser, user?.email]);

  const isInternalUser = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    const email = user?.email?.toLowerCase() || '';
    return (
      role === 'admin' ||
      role === 'employee' ||
      email === 'billy@pearsonline.nl' ||
      email === 'billy@trooper.es' ||
      email.endsWith('@onlyforward.nl') ||
      email.endsWith('@trooper.es') ||
      email.endsWith('@pearsonline.nl')
    );
  }, [appUser, user?.email]);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!firestore || !user || !appUser) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const managerUid = isAdmin ? user.uid : ((appUser as AppUser).managerId || user.uid);

        const clientsQuery = isInternalUser 
          ? collection(firestore, 'parentClients') 
          : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
        
        const clientSnap = await getDocs(clientsQuery);
        const clientsList = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ParentClient));
        
        if (!clientsList.length) { 
          setAccounts([]);
          setTotals({ budget: 0, fee: 0, count: 0, clients: 0 });
          setLoading(false); 
          return; 
        }

        const [accountSnaps, teamSnap, packagesSnap] = await Promise.all([
          Promise.all(clientsList.map((c) =>
            isInternalUser
              ? getDocs(collection(firestore, 'parentClients', c.id, 'childAccounts'))
              : getDocs(query(
                  collection(firestore, 'parentClients', c.id, 'childAccounts'),
                  where('assignedEmployeeId', '==', user.uid),
                )),
          )),
          isInternalUser
            ? getDocs(query(collection(firestore, 'users'), where('managerId', '==', managerUid)))
            : Promise.resolve({ docs: [] as any[] }),
          getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', managerUid)))
        ]);

        const allPackages = packagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const empMap = new Map<string, string>();
        if (isInternalUser) {
          const members = teamSnap.docs.map((d) => ({ ...d.data(), uid: d.id } as AppUser));
          setTeamMembers(members);
          members.forEach((m) => empMap.set(m.uid, m.displayName || m.email || 'Geen naam'));
        }

        let gBudget = 0, gFee = 0, gCount = 0;
        const allEnrichedAccounts: EnrichedAccount[] = [];

        clientsList.forEach((client, i) => {
          const accs = accountSnaps[i].docs
            .map((d) => {
              const a = d.data() as ChildAccount;
              
              let dHours = 0;
              a.connectedServices?.forEach(s => dHours += (Number(s.hours) || 0));
              a.connectedPackages?.forEach(pkgRef => {
                  const pkg = allPackages.find(p => p.id === pkgRef.packageId);
                  if (pkg) {
                      pkg.services?.forEach((s: any) => dHours += (Number(s.hours) || 0));
                  }
              });

              const enriched: EnrichedAccount = {
                ...a, 
                id: d.id,
                parentClient: client,
                parentName: client.clientName,
                assignedEmployeeName: a.assignedEmployeeId
                  ? empMap.get(a.assignedEmployeeId) : undefined,
                derivedHours: dHours
              };

              return enriched;
            })
            .filter((a) => {
              return isInternalUser || a.assignedEmployeeId === user.uid;
            });

          accs.forEach(a => {
            allEnrichedAccounts.push(a);
            if (!a.isPaused) {
              gBudget += a.monthlyClickBudget || 0;
              gFee += (a.derivedHours || 0) * (client.hourlyRate || 0);
              gCount++;
            }
          });
        });

        setAccounts(allEnrichedAccounts);
        setTotals({ budget: gBudget, fee: gFee, count: gCount, clients: clientsList.length });
      } catch (e) {
        console.error('Portfolio fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [firestore, user, appUser, isAdmin, isInternalUser]);

  // ── Employee assignment ───────────────────────────────────────────────────

  const handleAssign = async (parentClientId: string, accountId: string, empId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(
        doc(firestore, 'parentClients', parentClientId, 'childAccounts', accountId),
        { assignedEmployeeId: empId || null },
      );
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== accountId) return a;
          const emp = teamMembers.find((m) => m.uid === empId);
          return {
            ...a,
            assignedEmployeeId: empId || undefined,
            assignedEmployeeName: emp ? (emp.displayName || emp.email || 'Geen naam') : undefined,
          };
        })
      );
      toast({
        title: empId ? 'Medewerker toegewezen' : 'Toewijzing verwijderd',
        description: 'Wijziging opgeslagen.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Fout bij toewijzen' });
    }
  };

  // ── Sorting & Filtering ────────────────────────────────────────────────────

  const handleSort = (field: keyof EnrichedAccount | 'parentName') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        // Search term matching (nickname or parent client name)
        const matchSearch =
          acc.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.parentName.toLowerCase().includes(searchTerm.toLowerCase());

        // Employee filter
        const matchEmployee =
          employeeFilter === 'all' || acc.assignedEmployeeId === employeeFilter;

        // Status filter
        let matchStatus = true;
        const currentStatus = acc.status || (acc.isPaused ? 'paused' : 'active');
        if (statusFilter !== 'all') {
          matchStatus = currentStatus === statusFilter;
        }

        return matchSearch && matchEmployee && matchStatus;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof EnrichedAccount];
        let valB: any = b[sortField as keyof EnrichedAccount];

        // Fallbacks for undefined values
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // Handle string comparison case insensitively
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        // Numeric comparison
        return sortOrder === 'asc'
          ? (valA > valB ? 1 : -1)
          : (valA < valB ? 1 : -1);
      });
  }, [accounts, searchTerm, statusFilter, employeeFilter, sortField, sortOrder]);

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const getActiveChannels = (acc: ChildAccount) => {
    const channels: string[] = [];
    if (acc.googleAdsClientId) channels.push('Google');
    if (acc.metaAdsAccountId) channels.push('Meta');
    if (acc.linkedinAdsAccountId) channels.push('LinkedIn');
    return channels;
  };

  const getStatusBadge = (acc: EnrichedAccount) => {
    const status = acc.status || (acc.isPaused ? 'paused' : 'active');
    
    switch (status) {
      case 'onboarding':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 text-[10px] uppercase font-bold px-2 py-0.5">
            Onboarding
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 text-[10px] uppercase font-bold px-2 py-0.5">
            Gepauzeerd
          </Badge>
        );
      case 'active':
      default:
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15 text-[10px] uppercase font-bold px-2 py-0.5">
            Actief
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-100">
            Portfolio Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Beheer alle klant- en platformaccounts, loopbudgetten en lopende onboarding.'
              : 'Overzicht van de platformaccounts waaraan je bent toegewezen.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-3 shrink-0">
            <Button
              variant="outline"
              asChild
              className="border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800"
            >
              <Link href="/dashboard/clients/add">
                <PlusCircle className="mr-2 size-4" /> Nieuwe Agency/Freelancer
              </Link>
            </Button>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20 shrink-0"
            >
              <Link href="/dashboard/accounts/onboard">
                <PlusCircle className="mr-2 size-4" /> Start Account Onboarding
              </Link>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : accounts.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className={cn('grid gap-4', isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-2')}>
            <SummaryCard
              label="Actieve Accounts"
              value={totals.count.toString()}
              icon={Target}
              iconCn="bg-purple-500/10 text-purple-400 border border-purple-500/20"
            />
            <SummaryCard
              label="Klanten / Bureaus"
              value={totals.clients.toString()}
              icon={Users}
              iconCn="bg-blue-500/10 text-blue-400 border border-blue-500/20"
            />
            <SummaryCard
              label="Maandelijks Click Budget"
              value={`€${totals.budget.toLocaleString('nl-NL')}`}
              icon={Wallet}
              iconCn="bg-green-500/10 text-green-400 border border-green-500/20"
            />
            {isAdmin && (
              <SummaryCard
                label="Management Omzet"
                value={`€${totals.fee.toLocaleString('nl-NL')}`}
                icon={Briefcase}
                iconCn="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              />
            )}
          </div>

          {/* ── Filters & Search ── */}
          <div className="flex flex-col md:flex-row gap-4 bg-slate-900/30 p-4 border border-border rounded-xl">
            <div className="flex-1">
              <Input
                placeholder="Zoek op account of klant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-secondary/50 border-border text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500/50"
              />
            </div>
            
            <div className="w-full md:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-secondary/50 border-border text-slate-200">
                  <SelectValue placeholder="Filter op status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-border text-slate-200">
                  <SelectItem value="all">Alle Statussen</SelectItem>
                  <SelectItem value="active">Actief</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="paused">Gepauzeerd</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isInternalUser && (
              <div className="w-full md:w-[200px]">
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="bg-secondary/50 border-border text-slate-200">
                    <SelectValue placeholder="Verantwoordelijke" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-border text-slate-200">
                    <SelectItem value="all">Alle Medewerkers</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.uid} value={m.uid}>
                        {m.displayName || m.email?.split('@')[0] || 'Onbekend'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── Accounts Flat Table ── */}
          <div className="rounded-xl border border-border bg-card/10 overflow-hidden shadow-xl">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 px-6">
                    <button onClick={() => handleSort('nickname')} className="flex items-center gap-1.5 hover:text-white transition-colors">
                      Account / Bedrijf
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">
                    <button onClick={() => handleSort('parentName')} className="flex items-center gap-1.5 hover:text-white transition-colors">
                      Klant / Bureau
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-center">Kanalen</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Verantwoordelijke</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-right">
                    <button onClick={() => handleSort('derivedHours')} className="flex items-center gap-1.5 hover:text-white ml-auto transition-colors">
                      Uren
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-right">
                    <button onClick={() => handleSort('monthlyClickBudget')} className="flex items-center gap-1.5 hover:text-white ml-auto transition-colors">
                      Click Budget
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-right">Fee p/m</TableHead>
                  )}
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 text-right px-6">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="py-10 text-center text-slate-500">
                      Geen accounts gevonden die voldoen aan je zoekcriteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedAccounts.map((account) => {
                    const activeChannels = getActiveChannels(account);
                    const estimatedFee = (account.derivedHours || 0) * (account.parentClient.hourlyRate || 0);

                    return (
                      <TableRow key={account.id} className="border-border hover:bg-white/[0.02] transition-colors group">
                        {/* Nickname & Client ID */}
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/accounts/${account.id}?parent=${account.parentClientId}`}
                              className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors"
                            >
                              {account.nickname}
                            </Link>
                            <span className="text-[9px] font-mono text-slate-600 uppercase mt-0.5">
                              {account.googleAdsClientId || 'Geen Google Ads'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Parent Client Name */}
                        <TableCell className="py-4">
                          <Link
                            href={`/dashboard/clients/${account.parentClientId}`}
                            className="text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {account.parentName}
                          </Link>
                        </TableCell>

                        {/* Channels */}
                        <TableCell className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {activeChannels.length > 0 ? (
                              activeChannels.map((chan) => (
                                <Badge
                                  key={chan}
                                  className={cn(
                                    'text-[9px] font-bold px-1.5 h-4 border-none uppercase',
                                    chan === 'Google' && 'bg-blue-500/10 text-blue-400',
                                    chan === 'Meta' && 'bg-indigo-500/10 text-indigo-400',
                                    chan === 'LinkedIn' && 'bg-cyan-500/10 text-cyan-400'
                                  )}
                                >
                                  {chan.slice(0, 1)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-600">-</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="py-4 text-center">
                          {getStatusBadge(account)}
                        </TableCell>

                        {/* Assigned Employee Selector */}
                        <TableCell className="py-4">
                          {isAdmin ? (
                            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                              <Select
                                value={account.assignedEmployeeId || 'unassigned'}
                                onValueChange={(v) =>
                                  handleAssign(
                                    account.parentClientId,
                                    account.id,
                                    v === 'unassigned' ? '' : v,
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 w-[120px] text-[10px] bg-secondary/50 border-border hover:bg-accent text-slate-200">
                                  <SelectValue placeholder="Toewijzen" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-border text-slate-200">
                                  <SelectItem value="unassigned" className="text-[10px]">Geen</SelectItem>
                                  {teamMembers.map((m) => (
                                    <SelectItem key={m.uid} value={m.uid} className="text-[10px]">
                                      {m.displayName || m.email?.split('@')[0] || 'Onbekend'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              {account.assignedEmployeeName || 'Niemand'}
                            </span>
                          )}
                        </TableCell>

                        {/* Derived Hours */}
                        <TableCell className="py-4 text-right font-mono text-slate-300">
                          {account.derivedHours || 0} uur
                        </TableCell>

                        {/* Budget */}
                        <TableCell className="py-4 text-right font-semibold font-mono text-green-400">
                          €{(account.monthlyClickBudget || 0).toLocaleString('nl-NL')}
                        </TableCell>

                        {/* Estimated Fee */}
                        {isAdmin && (
                          <TableCell className="py-4 text-right font-semibold font-mono text-blue-400">
                            €{estimatedFee.toLocaleString('nl-NL')}
                          </TableCell>
                        )}

                        {/* Dropdown Menu actions */}
                        <TableCell className="py-4 text-right px-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-accent">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-border text-slate-200">
                              <DropdownMenuLabel>Beheer Account</DropdownMenuLabel>
                              <DropdownMenuItem asChild className="focus:bg-accent focus:text-foreground cursor-pointer">
                                <Link href={`/dashboard/accounts/${account.id}?parent=${account.parentClientId}`}>
                                  <Eye className="mr-2 size-4" /> Dossier Openen
                                </Link>
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem asChild className="focus:bg-accent focus:text-foreground cursor-pointer">
                                  <Link href={`/dashboard/accounts/${account.id}/edit?parent=${account.parentClientId}`}>
                                    <Edit2 className="mr-2 size-4" /> Account Bewerken
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-secondary" />
                              <DropdownMenuItem asChild className="focus:bg-accent focus:text-foreground cursor-pointer">
                                <Link href={`/dashboard/clients/${account.parentClientId}`}>
                                  <Users className="mr-2 size-4" /> Klantdossier
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, iconCn,
}: {
  label: string; value: string;
  icon: React.ElementType; iconCn: string;
}) {
  return (
    <div className="rounded-xl glass-card p-5 flex items-center gap-4">
      <div className={cn('p-2.5 rounded-lg shrink-0', iconCn)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 truncate">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
