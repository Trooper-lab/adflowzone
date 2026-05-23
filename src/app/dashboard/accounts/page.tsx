'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Briefcase, ChevronDown, ExternalLink, Library,
  ListChecks, Loader2, Mail, PlusCircle,
  Target, Users, Wallet,
} from 'lucide-react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { ParentClient, ChildAccount, AppUser } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrichedAccount = ChildAccount & {
  parentName: string;
  assignedEmployeeName?: string;
};

type ClientGroup = {
  parentClient: ParentClient;
  accounts: EnrichedAccount[];
  totalBudget: number;
  totalFee: number;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-[#2A3552] py-20 text-center">
      <div className="p-4 rounded-full bg-white/5">
        <Library className="size-10 text-slate-600" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-bold font-headline text-slate-200">Geen accounts gevonden</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          {isAdmin
            ? 'Je portfolio is nog leeg. Voeg een klant toe om te beginnen.'
            : 'Er zijn nog geen accounts aan je toegewezen.'}
        </p>
      </div>
      {isAdmin && (
        <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
          <Link href="/dashboard/clients/add">
            <PlusCircle className="mr-2 size-4" /> Nieuwe Klant
          </Link>
        </Button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-[#1C243A] border border-[#2A3552] animate-pulse" />
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-[#1C243A] border border-[#2A3552] animate-pulse" />
      ))}
    </div>
  );
}

function InlineNumberInput({ value, onSave, className, prefix = '', disabled = false }: { value: number, onSave: (val: number) => void, className?: string, prefix?: string, disabled?: boolean }) {
  const [val, setVal] = useState(value?.toString() || '0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(value?.toString() || '0');
  }, [value]);

  const handleSave = async () => {
    const num = Number(val);
    if (num !== value && !isNaN(num)) {
      setSaving(true);
      await onSave(num);
      setSaving(false);
    } else {
      setVal(value?.toString() || '0');
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix && <span className="absolute left-2 text-[10px] text-slate-500 font-bold z-10">{prefix}</span>}
      <Input 
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
           if (e.key === 'Enter') handleSave();
        }}
        disabled={saving || disabled}
        className={cn("h-7 text-right px-2 py-0 text-xs bg-black/20 border-[#2A3552] hover:border-[#3A4562] focus-visible:ring-1 focus-visible:ring-blue-500 font-mono", prefix && "pl-5", disabled && "opacity-50 cursor-not-allowed")}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [totals, setTotals] = useState({ budget: 0, fee: 0, count: 0, clients: 0 });

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
      user?.email === 'billy@trooper.es'
    );
  }, [appUser, user?.email]);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!firestore || !user || !appUser) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const managerUid = isAdmin ? user.uid : (appUser as AppUser).managerId;
        if (!managerUid) { setLoading(false); return; }

        const clientSnap = await getDocs(
          query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid)),
        );
        const clients = clientSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ParentClient));
        if (!clients.length) { setLoading(false); return; }

        const [accountSnaps, teamSnap] = await Promise.all([
          Promise.all(clients.map((c) =>
            isAdmin
              ? getDocs(collection(firestore, 'parentClients', c.id, 'childAccounts'))
              : getDocs(query(
                  collection(firestore, 'parentClients', c.id, 'childAccounts'),
                  where('assignedEmployeeId', '==', user.uid),
                )),
          )),
          isAdmin
            ? getDocs(query(collection(firestore, 'users'), where('managerId', '==', user.uid)))
            : Promise.resolve({ docs: [] as any[] }),
        ]);

        const empMap = new Map<string, string>();
        if (isAdmin) {
          const members = teamSnap.docs.map((d) => ({ ...d.data(), uid: d.id } as AppUser));
          setTeamMembers(members);
          members.forEach((m) => empMap.set(m.uid, m.displayName || m.email || 'Geen naam'));
        }

        let gBudget = 0, gFee = 0, gCount = 0;

        const built: ClientGroup[] = clients.map((client, i) => {
          const accounts = accountSnaps[i].docs
            .map((d) => {
              const a = d.data() as ChildAccount;
              return {
                ...a, id: d.id,
                parentName: client.clientName,
                assignedEmployeeName: a.assignedEmployeeId
                  ? empMap.get(a.assignedEmployeeId) : undefined,
              } as EnrichedAccount;
            })
            .filter((a) => {
              if (a.isPaused) return false;
              return isAdmin || a.assignedEmployeeId === user.uid;
            })
            .sort((a, b) => a.nickname.localeCompare(b.nickname));

          const tBudget = accounts.reduce((s, a) => s + (a.monthlyClickBudget || 0), 0);
          const tFeeNew = accounts.reduce((s, a) => s + ((a.fixedManagementHours || 0) * (client.hourlyRate || 0)), 0);
          const tFeeOld = accounts.reduce((s, a) => s + (a.managementFee?.amount || 0), 0);
          const tFee = tFeeNew + tFeeOld; // Tijdelijk gecombineerd tijdens migratie
          gBudget += tBudget; gFee += tFee; gCount += accounts.length;

          return { parentClient: client, accounts, totalBudget: tBudget, totalFee: tFee, totalFeeNew: tFeeNew, totalFeeOld: tFeeOld };
        }).filter((g) => g.accounts.length > 0)
          .sort((a, b) => a.parentClient.clientName.localeCompare(b.parentClient.clientName));

        setGroups(built);
        setTotals({ budget: gBudget, fee: gFee, count: gCount, clients: built.length });
      } catch (e) {
        console.error('Portfolio fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [firestore, user, appUser, isAdmin]);

  // ── Employee assignment ───────────────────────────────────────────────────

  const handleAssign = async (parentClientId: string, accountId: string, empId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(
        doc(firestore, 'parentClients', parentClientId, 'childAccounts', accountId),
        { assignedEmployeeId: empId || null },
      );
      setGroups((prev) =>
        prev.map((g) => {
          if (g.parentClient.id !== parentClientId) return g;
          return {
            ...g,
            accounts: g.accounts.map((a) => {
              if (a.id !== accountId) return a;
              const emp = teamMembers.find((m) => m.uid === empId);
              return {
                ...a,
                assignedEmployeeId: empId || undefined,
                assignedEmployeeName: emp ? (emp.displayName || emp.email || 'Geen naam') : undefined,
              };
            }),
          };
        }),
      );
      toast({
        title: empId ? 'Medewerker toegewezen' : 'Toewijzing verwijderd',
        description: 'Wijziging opgeslagen.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Fout bij toewijzen' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-100">
            Portfolio Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Overzicht van al je klanten en hun actieve Google Ads accounts.'
              : 'Accounts waaraan je bent toegewezen.'}
          </p>
        </div>
        {isAdmin && (
          <Button
            asChild
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20 shrink-0"
          >
            <Link href="/dashboard/clients/add">
              <PlusCircle className="mr-2 size-4" /> Nieuwe Klant
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className={cn('grid gap-4', isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-2')}>
            <SummaryCard
              label="Actieve Accounts"
              value={totals.count.toString()}
              icon={Target}
              iconCn="bg-purple-500/10 text-purple-400"
            />
            <SummaryCard
              label="Klanten"
              value={totals.clients.toString()}
              icon={Users}
              iconCn="bg-blue-500/10 text-blue-400"
            />
            <SummaryCard
              label="Maandelijks Budget"
              value={`€${totals.budget.toLocaleString('nl-NL')}`}
              icon={Wallet}
              iconCn="bg-green-500/10 text-green-400"
            />
            {isAdmin && (
              <SummaryCard
                label="Management Omzet"
                value={`€${totals.fee.toLocaleString('nl-NL')}`}
                icon={Briefcase}
                iconCn="bg-indigo-500/10 text-indigo-400"
              />
            )}
          </div>

          {/* ── Client groups ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-1 mb-3">
              Klantendossiers
            </p>
            <Accordion
              type="multiple"
              defaultValue={groups.map((g) => g.parentClient.id)}
              className="space-y-3"
            >
              {groups.map((group) => (
                <AccordionItem
                  key={group.parentClient.id}
                  value={group.parentClient.id}
                  className="rounded-xl border border-[#2A3552] bg-[#1C243A] overflow-hidden shadow-sm border-none"
                >
                  {/* ── Accordion header ── */}
                  <div className="px-5 hover:bg-white/[0.03] transition-colors">
                    <AccordionTrigger className="py-4 hover:no-underline [&[data-state=open]_.chevron]:rotate-180">
                      <div className="flex items-center justify-between w-full pr-3">
                        {/* Left: icon + name + meta */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                            <Users className="size-4 text-blue-400" />
                          </div>
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-100 font-headline truncate">
                                {group.parentClient.clientName}
                              </span>
                              <Badge className={cn(
                                'text-[9px] font-black uppercase px-1.5 h-4 border-none shrink-0',
                                group.parentClient.clientType === 'agency'
                                  ? 'bg-indigo-500/10 text-indigo-400'
                                  : 'bg-orange-500/10 text-orange-400',
                              )}>
                                {group.parentClient.clientType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                <Mail className="size-2.5" />
                                {group.parentClient.clientContactEmail}
                              </span>
                              <span className="text-slate-700 text-[10px]">·</span>
                              <span className="text-[10px] text-blue-400/70 font-bold">
                                {group.accounts.length} accounts
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: financials + chevron */}
                        <div className="hidden lg:flex items-center gap-6 shrink-0">
                          <div className="text-right">
                            <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">Budget</p>
                            <p className="text-sm font-bold text-green-400">
                              €{group.totalBudget.toLocaleString('nl-NL')}
                            </p>
                          </div>
                          {isAdmin && (
                            <>
                              <div className="text-right" onClick={(e) => e.stopPropagation()}>
                                <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">Uurtarief</p>
                                <InlineNumberInput 
                                  value={group.parentClient.hourlyRate || 0} 
                                  prefix="€"
                                  className="w-16"
                                  onSave={async (val) => {
                                      if (!firestore) return;
                                      try {
                                          await updateDoc(doc(firestore, 'parentClients', group.parentClient.id), { hourlyRate: val });
                                          setGroups(prev => prev.map(g => g.parentClient.id === group.parentClient.id ? { ...g, parentClient: { ...g.parentClient, hourlyRate: val } } : g));
                                      } catch (e) {
                                          console.error(e);
                                      }
                                  }}
                                />
                              </div>
                              <div className="text-right pl-4">
                                <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">Fee Totaal</p>
                                <p className="text-sm font-bold text-blue-400">
                                  €{group.totalFee.toLocaleString('nl-NL')}
                                </p>
                              </div>
                            </>
                          )}
                          <ChevronDown className="chevron size-4 text-slate-600 transition-transform duration-200 shrink-0 ml-2" />
                        </div>
                      </div>
                    </AccordionTrigger>
                  </div>

                  {/* ── Accordion body ── */}
                  <AccordionContent className="border-t border-[#2A3552] bg-black/10">
                    <div className="px-5 pt-3 pb-5">
                      {/* Column headers */}
                      <div className={cn(
                        'grid px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1',
                        isAdmin
                          ? 'grid-cols-[1fr_130px_80px_100px_200px]'
                          : 'grid-cols-[1fr_80px_110px]',
                      )}>
                        <span>Account</span>
                        {isAdmin && <span>Medewerker</span>}
                        <span className="text-center">Checklists</span>
                        <span className="text-right">Budget</span>
                        {isAdmin && <span className="text-right pr-2">Uren / Fee</span>}
                      </div>

                      {/* Account rows */}
                      <div className="space-y-1">
                        {group.accounts.map((account) => (
                          <div
                            key={account.id}
                            className={cn(
                              'grid items-center px-3 py-3 rounded-lg border border-white/5 bg-[#1C243A] group',
                              'hover:bg-blue-500/5 hover:border-blue-500/20 transition-all',
                              isAdmin
                                ? 'grid-cols-[1fr_130px_80px_100px_200px]'
                                : 'grid-cols-[1fr_80px_110px]',
                            )}
                          >
                            {/* Name + ID */}
                            <Link href={`/dashboard/accounts/${account.id}?parent=${account.parentClientId}`} className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-slate-200 hover:text-blue-400 hover:underline transition-colors truncate">
                                {account.nickname}
                              </span>
                              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">
                                {account.googleAdsClientId}
                              </span>
                            </Link>

                            {/* Employee picker */}
                            {isAdmin && (
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
                                  <SelectTrigger className="h-7 w-[120px] text-[10px] bg-white/5 border-white/10 hover:bg-white/10">
                                    <SelectValue placeholder="Toewijzen" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1C243A] border-[#2A3552] text-slate-200">
                                    <SelectItem value="unassigned" className="text-[10px]">Geen</SelectItem>
                                    {teamMembers.map((m) => (
                                      <SelectItem key={m.uid} value={m.uid} className="text-[10px]">
                                        {m.displayName || m.email?.split('@')[0] || 'Onbekend'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Checklist count */}
                            <div className="flex justify-center">
                              <Badge className={cn(
                                'text-[9px] font-bold h-5 px-1.5 border-none',
                                (account.connectedChecklists?.length || 0) > 0
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-slate-800/80 text-slate-600',
                              )}>
                                <ListChecks className="size-2.5 mr-1" />
                                {account.connectedChecklists?.length || 0}
                              </Badge>
                            </div>

                            {/* Budget */}
                            <div className="text-right">
                              <span className="text-sm font-semibold text-slate-300">
                                €{account.monthlyClickBudget?.toLocaleString('nl-NL') || '0'}
                              </span>
                            </div>

                            {/* Fee */}
                            {isAdmin && (
                              <div className="text-right flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black mb-1 flex items-center gap-1">
                                        Vaste uren
                                        {account.connectedServices && account.connectedServices.length > 0 && <Briefcase className="size-2 text-blue-400" />}
                                    </span>
                                    <InlineNumberInput
                                      value={account.fixedManagementHours || 0}
                                      className="w-14"
                                      disabled={account.connectedServices && account.connectedServices.length > 0}
                                      onSave={async (val) => {
                                        if (!firestore) return;
                                        try {
                                          await updateDoc(doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id), { fixedManagementHours: val });
                                          setGroups(prev => prev.map(g => g.parentClient.id === account.parentClientId ? {
                                              ...g,
                                              accounts: g.accounts.map(a => a.id === account.id ? { ...a, fixedManagementHours: val } : a)
                                          } : g));
                                        } catch(e) {
                                            console.error(e);
                                        }
                                      }}
                                    />
                                </div>
                                <div className="flex flex-col items-end min-w-[50px] justify-center pt-2">
                                    <span className="text-[10px] font-semibold text-slate-500/70 line-through">
                                      €{account.managementFee?.amount?.toLocaleString('nl-NL') || '0'}
                                    </span>
                                    <span className="text-sm font-bold text-blue-400">
                                      €{((account.fixedManagementHours || 0) * (group.parentClient.hourlyRate || 0)).toLocaleString('nl-NL')}
                                    </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2A3552]/50">
                        <div className="flex gap-1">
                          {isAdmin && (
                            <Button
                              variant="ghost" size="sm" asChild
                              className="text-[10px] font-bold uppercase tracking-widest h-7 text-slate-600 hover:text-slate-200"
                            >
                              <Link href={`/dashboard/clients/${group.parentClient.id}/edit`}>
                                Klant bewerken
                              </Link>
                            </Button>
                          )}
                          {group.parentClient.clientWebsite && (
                            <Button
                              variant="ghost" size="sm" asChild
                              className="text-[10px] font-bold uppercase tracking-widest h-7 text-slate-600 hover:text-slate-200"
                            >
                              <a href={group.parentClient.clientWebsite} target="_blank" rel="noreferrer">
                                Website <ExternalLink className="ml-1 size-2.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="outline" size="sm" asChild
                          className="text-[10px] font-bold uppercase tracking-widest h-7 border-[#2A3552] hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all"
                        >
                          <Link href={`/dashboard/clients/${group.parentClient.id}`}>
                            Volledig dossier
                          </Link>
                        </Button>
                      </div>
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

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, iconCn,
}: {
  label: string; value: string;
  icon: React.ElementType; iconCn: string;
}) {
  return (
    <div className="rounded-xl bg-[#1C243A] border border-[#2A3552] p-5 flex items-center gap-4">
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
