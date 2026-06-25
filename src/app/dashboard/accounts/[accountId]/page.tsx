'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import {
  doc, updateDoc, arrayUnion, collection, query,
  where, arrayRemove, getDoc, getDocs, writeBatch, Timestamp, orderBy, limit
} from 'firebase/firestore';
import type {
  ChildAccount, ChecklistTemplate, ConnectedChecklist,
  KpiData, ParentClient, ChecklistRun, AppUser, ServicePackage, Todo, Service, TimeEntry
} from '@/lib/types';
import {
  format, startOfMonth, addMonths, isPast, isToday,
  addDays, addWeeks, getDay, setDay, setDate,
  parseISO, subDays, differenceInDays, isValid,
} from 'date-fns';
import { nl } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Activity, ArrowLeft, Briefcase, Clock, Goal,
  History, ListChecks, Loader2, Settings, StickyNote, Trash2,
  TrendingUp, Users, Zap, BarChart2, Package, CheckCircle2,
  FolderOpen, AlertTriangle, Target, DollarSign, MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChecklistRunner } from '@/components/checklist/ChecklistRunner';
import Link from 'next/link';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

// Extracted sub-components
import AccountTodos from '@/components/account/AccountTodos';
import AccountReports from '@/components/account/AccountReports';
import KpiStandardTable from '@/components/account/KpiStandardTable';
import ChecklistHistory from '@/components/account/ChecklistHistory';
import AddChecklistDialog from '@/components/account/AddChecklistDialog';
import InProgressChecklists from '@/components/account/InProgressChecklists';
import AccountCampaigns from '@/components/account/AccountCampaigns';
import AccountDocuments from '@/components/account/AccountDocuments';
import AccountSettings from '@/components/account/AccountSettings';
import AccountServicesManager from '@/components/account/AccountServicesManager';
import AccountChat from '@/components/account/AccountChat';

// ─── Static maps ──────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lead_generation: 'Lead Generation',
  ecommerce_sales: 'E-commerce',
  brand_awareness: 'Brand Awareness',
  app_installs:    'App Installs',
  other:           'Overig',
};

const GOAL_BADGE: Record<string, string> = {
  lead_generation: 'bg-blue-500/10   text-blue-400',
  ecommerce_sales: 'bg-green-500/10  text-green-400',
  brand_awareness: 'bg-purple-500/10 text-purple-400',
  app_installs:    'bg-orange-500/10 text-orange-400',
  other:           'bg-slate-500/10  text-slate-400',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="size-10 animate-spin text-blue-500" />
      <span className="text-slate-400 font-medium text-sm animate-pulse">
        Account laden...
      </span>
    </div>
  );
}

function StatCard({
  label, value, sub, valueCn = 'text-slate-100', accent,
}: {
  label: string; value: string; sub?: string;
  valueCn?: string; accent?: string;
}) {
  return (
    <div className={cn(
      'relative rounded-xl glass-card p-5 overflow-hidden',
    )}>
      {accent && (
        <div className={cn('absolute top-0 left-0 w-1 h-full rounded-l-xl', accent)} />
      )}
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 pl-1">
        {label}
      </p>
      <p className={cn('text-3xl font-bold mt-2 pl-1', valueCn)}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1 pl-1">{sub}</p>}
    </div>
  );
}

function Section({
  title, icon: Icon, iconCn, right, children, className
}: {
  title: string; icon?: React.ElementType; iconCn?: string;
  right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-xl glass-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-white/[0.03]">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn('size-4', iconCn ?? 'text-slate-500')} />}
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {title}
          </p>
        </div>
        {right && <div>{right}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const parentClientId = searchParams.get('parent');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('overzicht');
  const [isSaving, setIsSaving] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<ConnectedChecklist | null>(null);
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [stats, setStats] = useState({
    checklists30d: 0,
    comments30d: 0,
    healthScore: 0,
    lastRunDays: 0,
    pacingScore: 0,
    recentRuns: [] as any[],
    allRuns30d: [] as any[],
  });
  const [assignedEmployee, setAssignedEmployee] = useState<AppUser | null>(null);

  // ── Firestore refs ────────────────────────────────────────────────────────

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

  const parentClientRef = useMemoFirebase(
    () => (firestore && parentClientId
      ? doc(firestore, 'parentClients', parentClientId as string) : null),
    [firestore, parentClientId],
  );
  const childAccountRef = useMemoFirebase(
    () => (firestore && parentClientId && accountId
      ? doc(firestore, 'parentClients', parentClientId as string, 'childAccounts', accountId as string)
      : null),
    [firestore, parentClientId, accountId],
  );

  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef);
  const { data: childAccount, loading: childLoading, refetch: refetchChildAccount } = useDoc(childAccountRef);

  const assignedEmployeeId = (childAccount as ChildAccount)?.assignedEmployeeId;
  const isAccountLoaded = !childLoading && !!childAccount;

  const managerUid = useMemo(() => {
    if (!user || !appUser) return null;
    if (isAdmin) {
      return (parentClient as ParentClient)?.ownerId || user.uid;
    }
    return (appUser as AppUser)?.managerId || null;
  }, [user, appUser, isAdmin, parentClient]);

  const checklistsQuery = useMemoFirebase(
    () => (firestore && managerUid
      ? query(collection(firestore, 'users', managerUid, 'checklistTemplates')) : null),
    [firestore, managerUid],
  );
  const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);

  // ── Access guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAccountLoaded && !isAdmin && user?.uid) {
      if (assignedEmployeeId !== user.uid) {
        toast({ variant: 'destructive', title: 'Toegang Geweigerd', description: 'Je bent niet toegewezen aan dit account.' });
        router.push('/dashboard');
      }
    }
  }, [isAccountLoaded, isAdmin, user?.uid, assignedEmployeeId, router, toast]);

  // ── Load assigned employee name ───────────────────────────────────────────

  useEffect(() => {
    if (assignedEmployeeId && firestore) {
      getDoc(doc(firestore, 'users', assignedEmployeeId)).then((snap) => {
        if (snap.exists()) setAssignedEmployee(snap.data() as AppUser);
      });
    }
  }, [assignedEmployeeId, firestore]);

  // Packages fetch
  const packagesQuery = useMemoFirebase(
    () => (firestore && managerUid ? query(collection(firestore, 'servicePackages'), where('ownerId', '==', managerUid)) : null),
    [firestore, managerUid]
  );
  const { data: packagesData } = useCollection(packagesQuery);
  const allPackages = useMemo(() => {
    if (!packagesData) return [];
    return packagesData as ServicePackage[];
  }, [packagesData]);

  // Open Todos fetch
  const openTodosQuery = useMemoFirebase(
    () => (firestore && managerUid && accountId ? query(
      collection(firestore, 'todos'),
      where('childAccountId', '==', accountId as string),
      where('status', 'in', ['todo', 'in_progress'])
    ) : null),
    [firestore, managerUid, accountId]
  );
  const { data: openTodosData } = useCollection(openTodosQuery);
  const overdueTodosCount = useMemo(() => {
      if (!openTodosData) return 0;
      let count = 0;
      const today = new Date();
      openTodosData.forEach((d: any) => {
          const t = d as Todo;
          if (t.dueDate && parseISO(t.dueDate) < today) count++;
      });
      return count;
  }, [openTodosData]);

  // Time Entries fetch
  const effectiveParentId = parentClientId || (childAccount as ChildAccount)?.parentClientId;
  const timeEntriesQuery = useMemoFirebase(
    () => (firestore && managerUid && effectiveParentId ? query(
      collection(firestore, 'timeEntries'),
      where('parentClientId', '==', effectiveParentId as string)
    ) : null),
    [firestore, managerUid, effectiveParentId]
  );
  const { data: timeEntriesRaw } = useCollection(timeEntriesQuery);
  
  const { recentTimeEntries, totalMinutes30d } = useMemo(() => {
    let totalMins = 0;
    const combined: any[] = [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    // 1. Manual Time Entries
    if (timeEntriesRaw) {
        (timeEntriesRaw as TimeEntry[]).forEach(entry => {
            if (entry.date >= cutoff && (entry.childAccountId === accountId || !entry.childAccountId || entry.childAccountId === 'none')) {
                const mins = entry.durationMinutes || 0;
                totalMins += mins;
                combined.push({
                    type: 'manual',
                    title: entry.description || 'Handmatige tijd',
                    date: parseISO(entry.date),
                    mins: mins
                });
            }
        });
    }

    // 2. Auto Checklist Runs
    if (stats.allRuns30d) {
        stats.allRuns30d.forEach(run => {
            const mins = Math.round((run.durationSeconds || 0) / 60);
            if (mins > 0) {
                totalMins += mins;
                combined.push({
                    type: 'checklist',
                    title: `Checklist: ${run.name || 'Onbekend'}`,
                    date: run._parsedDate,
                    mins: mins
                });
            }
        });
    }

    combined.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return { recentTimeEntries: combined, totalMinutes30d: totalMins };
  }, [timeEntriesRaw, accountId, stats.allRuns30d]);

  // Hero KPI fetch
  const heroKpiName = (childAccount as ChildAccount)?.kpisToTrack?.[0] || null;
  const targetHeroKpi = (childAccount as ChildAccount)?.targetKpiValues?.find(t => t.kpi === heroKpiName)?.target;
  const [latestHeroKpi, setLatestHeroKpi] = useState<{value: number | string, date: Date} | null>(null);

  useEffect(() => {
      if (!firestore || !childAccount || !heroKpiName) return;
      const fetchLatestKpi = async () => {
          const q = query(collection(firestore, 'kpiData'), where('childAccountId', '==', (childAccount as ChildAccount).id), orderBy('startDate', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
              const data = snap.docs[0].data() as KpiData;
              if (data.kpiValues && data.kpiValues[heroKpiName] !== undefined) {
                  setLatestHeroKpi({ value: data.kpiValues[heroKpiName], date: parseISO(data.startDate) });
              }
          }
      };
      fetchLatestKpi();
  }, [childAccount, firestore, heroKpiName, refetchTrigger]);

  // MRR Calculation
  const totalMrr = useMemo(() => {
      if (!childAccount || !parentClient) return 0;
      const acc = childAccount as ChildAccount;
      const client = parentClient as ParentClient;
      let mrr = 0;
      const rate = client.hourlyRate || 0;

      if ((!acc.connectedServices || acc.connectedServices.length === 0) && (!acc.connectedPackages || acc.connectedPackages.length === 0)) {
          return (acc.managementFee?.amount || 0);
      }

      let totalHours = 0;
      acc.connectedServices?.forEach(s => totalHours += (Number(s.hours) || 0));
      mrr += totalHours * rate;

      acc.connectedPackages?.forEach(pkgRef => {
          const pkg = allPackages.find(p => p.id === pkgRef.packageId);
          if (pkg) {
              let pkgHours = 0;
              pkg.services?.forEach((s: any) => pkgHours += (Number(s.hours) || 0));
              mrr += pkgHours * rate;
              if (pkg.packageDiscount) mrr -= pkg.packageDiscount;
          }
      });
      return mrr + (acc.managementFee?.amount || 0);
  }, [childAccount, parentClient, allPackages]);

  // Derived Hours Calculation
  const derivedHours = useMemo(() => {
      if (!childAccount) return 0;
      const acc = childAccount as ChildAccount;
      let totalHours = 0;
      acc.connectedServices?.forEach(s => totalHours += (Number(s.hours) || 0));
      acc.connectedPackages?.forEach(pkgRef => {
          const pkg = allPackages.find(p => p.id === pkgRef.packageId);
          if (pkg) {
              pkg.services?.forEach((s: any) => totalHours += (Number(s.hours) || 0));
          }
      });
      return totalHours;
  }, [childAccount, allPackages]);

  // ── Stats calculation ─────────────────────────────────────────────────────

  useEffect(() => {
    const calculateStats = async () => {
      if (!firestore || !childAccount || !(childAccount as ChildAccount).id) return;

      const thirtyDaysAgo = subDays(new Date(), 30);
      const runsQuery = query(
        collection(firestore, 'checklistRuns'),
        where('childAccountId', '==', (childAccount as ChildAccount).id),
        where('completedAt', '>=', thirtyDaysAgo),
      );

      try {
        const snapshot = await getDocs(runsQuery);
        let checklists = 0;
        let comments = 0;
        let lastRunDate: Date | null = null;
        const runsArray: any[] = [];

        snapshot.forEach((snap) => {
          const run = snap.data() as ChecklistRun;
          checklists++;
          comments += run.tasks.filter((t) => t.notes?.trim()).length;

          let completedAt: Date | null = null;
          const rawDate = run.completedAt;
          if (rawDate) {
            if (rawDate instanceof Date) completedAt = rawDate;
            else if (typeof rawDate === 'string') completedAt = parseISO(rawDate);
            else if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) completedAt = (rawDate as any).toDate();
            else if (typeof rawDate === 'number') completedAt = new Date(rawDate);
          }
          if (completedAt && isValid(completedAt)) {
            if (!lastRunDate || completedAt > lastRunDate) lastRunDate = completedAt;
            runsArray.push({ ...run, _parsedDate: completedAt });
          }
        });

        runsArray.sort((a, b) => b._parsedDate.getTime() - a._parsedDate.getTime());
        
        const connectedCount = (childAccount as ChildAccount).connectedChecklists?.length || 1;
        const expectedRuns = connectedCount * 2;
        const pacing = Math.min(Math.round((checklists / expectedRuns) * 100), 100);
        const daysSinceLast = lastRunDate ? differenceInDays(new Date(), lastRunDate) : 30;
        const activityScore = Math.max(100 - daysSinceLast * 10, 0);

        setStats({
          checklists30d: checklists,
          comments30d: comments,
          healthScore: Math.round((pacing + activityScore) / 2),
          lastRunDays: daysSinceLast,
          pacingScore: pacing,
          recentRuns: runsArray.slice(0, 3),
          allRuns30d: runsArray,
        });
      } catch (e) {
        console.error('Error calculating stats:', e);
      }
    };

    if (isAccountLoaded) calculateStats();
  }, [childAccount, firestore, isAccountLoaded, refetchTrigger]);

  // ── Checklist handlers ────────────────────────────────────────────────────

  const handleStartChecklist = (checklist: ConnectedChecklist) => {
    setActiveChecklist(checklist);
    setIsRunnerOpen(true);
  };

  const handleChecklistComplete = () => {
    refetchChildAccount();
    setIsRunnerOpen(false);
    setRefetchTrigger((p) => p + 1);
  };

  const handleDisconnectChecklist = async (conn: ConnectedChecklist) => {
    if (!childAccountRef || !(childAccount as ChildAccount)?.connectedChecklists) return;
    try {
      const updated = (childAccount as ChildAccount).connectedChecklists!.filter(
        (c) => c.checklistId !== conn.checklistId,
      );
      await updateDoc(childAccountRef, { connectedChecklists: updated });
      toast({ title: 'Checklist ontkoppeld' });
      refetchChildAccount();
    } catch {
      toast({ variant: 'destructive', title: 'Fout bij ontkoppelen', description: 'Onvoldoende rechten.' });
    }
  };

  // ── KPI save handler ──────────────────────────────────────────────────────

  const handleSaveKpiData = async (data: Record<string, Record<string, number | string>>) => {
    if (!firestore || !user || !childAccount) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const existingSnaps = await Promise.all(
        (childAccount.kpiDataIds || []).map((id: string) => getDoc(doc(firestore, 'kpiData', id))),
      );
      const existingDocs = existingSnaps.map((s) => ({ id: s.id, ...s.data() } as KpiData));
      const newIds: string[] = [];

      for (const monthKey in data) {
        const monthDate  = parseISO(`${monthKey}-01T12:00:00Z`);
        const monthStart = startOfMonth(monthDate).toISOString();
        const monthData  = data[monthKey];
        const numericKpis: Record<string, number> = {};
        const hasValues = Object.values(monthData).some((v) => v !== '' && v !== null && v !== undefined);
        if (!hasValues) continue;

        for (const kpi in monthData) {
          if (['cpc', 'ctr', 'cpl', 'roas'].includes(kpi)) continue;
          const v = parseFloat(monthData[kpi] as string);
          if (!isNaN(v)) numericKpis[kpi] = v;
        }

        const existing = existingDocs.find((d) => d.startDate === monthStart);
        if (existing) {
          batch.update(doc(firestore, 'kpiData', existing.id), { kpiValues: numericKpis });
        } else if (Object.keys(numericKpis).length > 0) {
          const newRef = doc(collection(firestore, 'kpiData'));
          batch.set(newRef, {
            ownerId: user.uid, 
            childAccountId: childAccount.id,
            parentClientId: childAccount.parentClientId,
            periodType: 'monthly', 
            startDate: monthStart, 
            kpiValues: numericKpis,
          });
          newIds.push(newRef.id);
        }
      }

      if (newIds.length > 0 && childAccountRef) {
        batch.update(childAccountRef, { kpiDataIds: arrayUnion(...newIds) });
      }
      await batch.commit();
      toast({ title: 'KPI data opgeslagen' });
      if (newIds.length > 0) { refetchChildAccount(); setRefetchTrigger((p) => p + 1); }
    } catch (e) {
      console.error('Error saving KPI data:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Enriched checklists ───────────────────────────────────────────────────

  const enrichedConnectedChecklists = useMemo(() => {
    if (!childAccount?.connectedChecklists || !checklistTemplates) return [];
    const tplMap = new Map((checklistTemplates as ChecklistTemplate[]).map((t) => [t.id, t]));

    return childAccount.connectedChecklists.map((conn: ConnectedChecklist) => {
      const template  = tplMap.get(conn.checklistId);
      const lastRun   = conn.lastRunAt ? parseISO(conn.lastRunAt) : null;
      const startDate = parseISO(conn.startDate);
      if (conn.frequency === 'one-off' && lastRun) return null;

      const basis = lastRun || new Date();
      let nextDue: Date;
      if (conn.frequency === 'daily') {
        nextDue = addDays(basis, 1);
      } else if (conn.frequency === 'weekly') {
        let d = setDay(basis, getDay(startDate), { weekStartsOn: 1 });
        if (isPast(d) && !isToday(d)) d = addWeeks(d, 1);
        nextDue = d;
      } else if (conn.frequency === 'monthly') {
        let d = setDate(basis, startDate.getDate());
        if (isPast(d) && !isToday(d)) d = addMonths(d, 1);
        nextDue = d;
      } else {
        nextDue = startDate;
      }

      return {
        ...conn,
        name: template?.name || 'Onbekende checklist',
        description: template?.description,
        nextDueDate: nextDue,
      };
    }).filter(Boolean).sort((a: any, b: any) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  }, [childAccount, checklistTemplates, refetchTrigger]);

  const getScheduleText = (c: any) => {
    if (!c) return '';
    const date = parseISO(c.startDate);
    switch (c.frequency) {
      case 'daily':   return 'Dagelijks';
      case 'one-off': return `Eenmalig (${format(date, 'dd MMM')})`;
      case 'weekly':  return `Wekelijks (${format(date, 'EEEE')})`;
      case 'monthly': return `Maandelijks (dag ${format(date, 'do')})`;
      default:        return 'Aangepast';
    }
  };

  // ── Health helpers ────────────────────────────────────────────────────────

  const healthColor = (s: number) => s >= 80 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';
  const healthPill  = (s: number) =>
    s >= 80
      ? 'bg-green-500/10  border border-green-500/20  text-green-400'
      : s >= 50
      ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
      : 'bg-red-500/10    border border-red-500/20    text-red-400';

  // ── Guards ────────────────────────────────────────────────────────────────

  if (childLoading || parentLoading || checklistsLoading) return <LoadingState />;
  if (!childAccount || !parentClient) return (
    <div className="p-8 text-center text-slate-400">Account niet gevonden.</div>
  );

  const account = childAccount as ChildAccount;
  const client  = parentClient as ParentClient;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="rounded-xl glass-card px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost" size="icon"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-white shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline text-2xl font-bold text-slate-100 leading-tight">
                {account.nickname}
              </h1>
              <Badge className="font-mono text-[10px] border-border bg-secondary text-slate-400 border">
                {account.googleAdsClientId}
              </Badge>
              {account.primaryGoal && (
                <Badge className={cn('text-[9px] font-bold border-none hidden sm:flex', GOAL_BADGE[account.primaryGoal])}>
                  {GOAL_LABELS[account.primaryGoal]}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <Link
                href={`/dashboard/clients/${parentClientId}`}
                className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
              >
                <Briefcase className="size-3.5" />
                {client.clientName}
              </Link>
              {assignedEmployee && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Users className="size-3.5 text-blue-400" />
                  {assignedEmployee.displayName || assignedEmployee.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400"
          >
            <Link href={`/dashboard/campaign-briefings/new?accountId=${accountId}&parent=${parentClientId}`}>
              <StickyNote className="mr-2 size-3.5" /> Nieuwe Blueprint
            </Link>
          </Button>
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide', healthPill(stats.healthScore))}>
            <Activity className="size-3.5" />
            Health {stats.healthScore}%
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto h-auto p-1 sticky top-0 z-10">
          {[
            { value: 'overzicht', icon: Activity, label: 'Overzicht' },
            { value: 'chat', icon: MessageSquare, label: 'AI Chatbot' },
            { value: 'checklists', icon: ListChecks, label: 'Checklists & Taken' },
            { value: 'campagnes', icon: TrendingUp, label: "Campagnes & KPI's" },
            { value: 'diensten', icon: Package, label: 'Diensten & Pakketten' },
            { value: 'documenten', icon: FolderOpen, label: 'Documenten & Links' },
            { value: 'rapportages', icon: BarChart2, label: 'Rapportages' },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="group flex items-center justify-center transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2.5 px-4 rounded-md text-slate-400 hover:text-white hover:bg-secondary data-[state=active]:hover:bg-primary/30">
              <t.icon className="size-4 shrink-0" />
              <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-2 group-data-[state=active]:max-w-[200px] group-data-[state=active]:opacity-100 group-data-[state=active]:ml-2 text-sm font-medium">{t.label}</span>
            </TabsTrigger>
          ))}
          {isAdmin && (
              <TabsTrigger value="instellingen" className="group flex items-center justify-center transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2.5 px-4 rounded-md text-slate-400 hover:text-white hover:bg-secondary data-[state=active]:hover:bg-primary/30 ml-auto">
                  <Settings className="size-4 shrink-0" />
                  <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-2 group-data-[state=active]:max-w-[200px] group-data-[state=active]:opacity-100 group-data-[state=active]:ml-2 text-sm font-medium">Instellingen</span>
              </TabsTrigger>
          )}
        </TabsList>

        {/* ── TAB: OVERZICHT (Compact, Financial & Standings) ── */}
        <TabsContent value="overzicht" className="space-y-6 animate-in fade-in duration-500">
          
          {/* Alerts */}
          {overdueTodosCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                      <h4 className="font-bold text-red-400">Operationele Achterstand</h4>
                      <p className="text-sm text-red-300/80 mt-1">Er {overdueTodosCount === 1 ? 'is' : 'zijn'} {overdueTodosCount} openstaande to-do{overdueTodosCount === 1 ? '' : 's'} waarvan de deadline verstreken is. Pak dit zo snel mogelijk op om de voortgang te bewaken.</p>
                  </div>
              </div>
          )}

          <div className={cn('grid gap-4', isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3')}>
            {isAdmin ? (
                <StatCard label="Totale MRR" value={`€${totalMrr.toLocaleString('nl-NL')}`} sub="Diensten & Pakketten" valueCn="text-blue-400" accent="bg-blue-500/40" />
            ) : (
                <StatCard label="Click Budget" value={`€${account.monthlyClickBudget?.toLocaleString('nl-NL') || '0'}`} sub="per maand" valueCn="text-green-400" accent="bg-green-500/40" />
            )}
            
            <StatCard label="Urenbudget" value={`${derivedHours} uur`} sub="Diensten & Pakketten" valueCn="text-slate-100" accent="bg-slate-500/40" />
            
            {isAdmin && (
                <StatCard label="Click Budget" value={`€${account.monthlyClickBudget?.toLocaleString('nl-NL') || '0'}`} sub="per maand" valueCn="text-green-400" accent="bg-green-500/40" />
            )}

            {heroKpiName ? (
                <div className="relative rounded-xl glass-card p-5 overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-purple-500/40" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 pl-1 flex items-center gap-1.5"><Target className="size-3" /> Hero KPI: {heroKpiName}</p>
                  <p className="text-3xl font-bold mt-2 pl-1 text-purple-400">{latestHeroKpi?.value !== undefined ? latestHeroKpi.value : '-'}</p>
                  <p className="text-xs text-slate-600 mt-1 pl-1">
                      {targetHeroKpi ? `Target: ${targetHeroKpi}` : 'Geen target ingesteld'} 
                      {latestHeroKpi?.date && ` (${format(latestHeroKpi.date, 'MMM', { locale: nl })})`}
                  </p>
                </div>
            ) : (
                <StatCard label="Laatste sync" value={stats.lastRunDays === 0 ? 'Vandaag' : `${stats.lastRunDays}d geleden`} valueCn={stats.lastRunDays > 7 ? 'text-red-400' : stats.lastRunDays > 3 ? 'text-yellow-400' : 'text-slate-100'} accent={stats.lastRunDays > 7 ? 'bg-red-500/40' : 'bg-slate-500/40'} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl glass-card px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Account Standing — laatste 30 dagen</p>
                <div className="grid grid-cols-3 gap-8">
                  {[
                    { label: 'Pacing', value: `${stats.pacingScore}%`, bar: stats.pacingScore, cn: healthColor(stats.pacingScore) },
                    { label: 'Activiteit', value: `${stats.lastRunDays}d geleden`, bar: Math.max(100 - stats.lastRunDays * 5, 0), cn: stats.lastRunDays > 7 ? 'text-red-400' : 'text-green-400' },
                    { label: 'Intensiteit', value: `${stats.checklists30d} runs`, bar: Math.min(stats.checklists30d * 20, 100), cn: 'text-blue-400' },
                  ].map(({ label, value, bar, cn: valCn }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                        <span className={cn('text-[10px] font-bold', valCn)}>{value}</span>
                      </div>
                      <Progress value={bar} className="h-1.5 bg-secondary" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recente Activiteit */}
              <Section title="Laatste Activiteit" icon={History} iconCn="text-blue-400">
                <div className="p-5">
                    {stats.recentRuns && stats.recentRuns.length > 0 ? (
                        <div className="space-y-4">
                            {(stats.recentRuns as any[]).map((run, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="mt-0.5"><CheckCircle2 className="size-4 text-emerald-400" /></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-200">{run.name || 'Checklist uitgevoerd'}</p>
                                        <p className="text-xs text-slate-500">{format(run._parsedDate, 'PPP', { locale: nl })} • {run.tasks?.filter((t: any) => t.notes?.trim()).length || 0} notities</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Geen recente activiteit in de afgelopen 30 dagen.</p>
                    )}
                </div>
              </Section>
            </div>

            <div className="space-y-6">
              {/* Tijdregistratie (Laatste 30 dagen) */}
              <Section title="Tijdregistratie (30d)" icon={Clock} iconCn="text-blue-400">
                <div className="p-5">
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-2xl font-bold text-white">{Math.floor(totalMinutes30d / 60)}h {totalMinutes30d % 60}m</span>
                        <span className="text-xs text-slate-500 mb-1">geregistreerd</span>
                    </div>
                    {recentTimeEntries.length > 0 ? (
                        <div className="space-y-3">
                            {recentTimeEntries.slice(0, 5).map((entry, i) => (
                                <div key={i} className="flex justify-between items-start gap-3 py-2 border-b border-border last:border-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="text-sm text-slate-300 font-medium truncate">{entry.title}</p>
                                        <p className="text-[10px] text-slate-500">
                                            {format(entry.date, 'PPP', { locale: nl })} 
                                            {entry.type === 'checklist' && ' • Systeem'}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className={cn("shrink-0", entry.type === 'checklist' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400')}>
                                        {Math.floor(entry.mins / 60)}h {entry.mins % 60}m
                                    </Badge>
                                </div>
                            ))}
                            {recentTimeEntries.length > 5 && (
                                <p className="text-xs text-slate-500 italic mt-2">+ {recentTimeEntries.length - 5} oudere registraties</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Geen uren geregistreerd in de laatste 30 dagen.</p>
                    )}
                </div>
              </Section>

              {/* Actieve Diensten Samenvatting */}
              <Section title="Actieve Diensten" icon={Package} iconCn="text-emerald-400">
                <div className="p-5">
                    {(!account.connectedPackages?.length && !account.connectedServices?.length) ? (
                        <p className="text-sm text-slate-500 italic">Geen diensten of pakketten actief.</p>
                    ) : (
                        <div>
                            {account.connectedPackages && account.connectedPackages.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Pakketten</p>
                                    <div className="flex flex-wrap gap-2">
                                        {account.connectedPackages.map((pkg, i) => (
                                            <Badge key={i} variant="outline" className="bg-blue-500/5 border-blue-500/20 text-blue-400">
                                                {pkg.packageName}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {account.connectedServices && account.connectedServices.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Losse Diensten</p>
                                    <div className="flex flex-wrap gap-2">
                                        {account.connectedServices.map((svc, i) => (
                                            <Badge key={i} variant="outline" className="bg-black/20 border-border text-slate-300">
                                                {svc.serviceName}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              </Section>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: AI Sparringpartner ── */}
        <TabsContent value="chat" className="space-y-6 animate-in fade-in duration-500">
          {effectiveParentId && accountId ? (
            <AccountChat parentClientId={effectiveParentId as string} accountId={accountId as string} />
          ) : (
            <div className="p-8 text-center text-slate-400">AI chat client configuration unavailable.</div>
          )}
        </TabsContent>

        {/* ── TAB: CHECKLISTS & TAKEN ── */}
        <TabsContent value="checklists" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <InProgressChecklists account={account} onStart={handleStartChecklist} />
              
              <Section title="Actieve Checklists" icon={ListChecks} iconCn="text-emerald-400" right={childAccountRef && managerUid ? <AddChecklistDialog childAccountRef={childAccountRef} managerUid={managerUid} /> : null}>
                <div className="p-5">
                  {!checklistsLoading && enrichedConnectedChecklists.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {enrichedConnectedChecklists.map((checklist: any, index: number) => (
                        <div key={index} className="rounded-lg border border-border bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5 transition-all p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{getScheduleText(checklist)}</p>
                              <p className="text-sm font-bold text-slate-100 leading-snug">{checklist.name}</p>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-red-400 hover:bg-red-400/10 shrink-0"><Trash2 className="size-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass-card-elevated">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">Planning verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription>Stopt de automatisering voor {checklist.name}. Geschiedenis blijft bewaard.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-secondary border-border">Annuleren</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDisconnectChecklist(checklist)} className="bg-red-600 hover:bg-red-700">Ontkoppelen</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Volgende uitvoering</p>
                              <p className="text-xs font-semibold text-slate-300 mt-0.5">{format(checklist.nextDueDate, 'PPP')}</p>
                            </div>
                            <Button size="sm" onClick={() => handleStartChecklist(checklist)} className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-4 shadow-lg shadow-blue-900/20">Uitvoeren</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-border rounded-lg">
                      <ListChecks className="size-8 mx-auto text-slate-700 mb-2" />
                      <p className="text-sm text-slate-500">Geen actieve checklists gekoppeld.</p>
                      <p className="text-xs text-slate-600 mt-1">Koppel een template om prestaties bij te houden.</p>
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Uitgevoerde Checklists" icon={History} iconCn="text-blue-400">
                <div className="p-5">
                  <ChecklistHistory account={account} managerUid={managerUid} />
                </div>
              </Section>
            </div>
            
            <div className="space-y-6">
              {client && account && childAccountRef && (
                <AccountTodos parentClient={client} childAccount={account} childAccountRef={childAccountRef} onRefetchNeeded={() => setRefetchTrigger((p) => p + 1)} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: CAMPAGNES & KPI's ── */}
        <TabsContent value="campagnes" className="space-y-6 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 gap-6">
              <Section title="KPI Tracker" icon={TrendingUp} iconCn="text-emerald-400">
                <div className="p-5">
                  <div className="grid grid-cols-[120px_1fr_80px] items-center gap-4 px-2 py-3 mb-2 text-[10px] font-black tracking-widest text-slate-600 uppercase">
                    <span>Maand</span>
                    <div className="grid grid-cols-6 gap-x-4">
                      {account.kpisToTrack.map((kpi) => (
                        <span key={kpi}>{kpi.substring(0, 6)}</span>
                      ))}
                    </div>
                    <span className="text-right">Beheer</span>
                  </div>
                  <KpiStandardTable childAccount={account} onSave={handleSaveKpiData} isSaving={isSaving} onRefetchNeeded={() => setRefetchTrigger((p) => p + 1)} />
                </div>
              </Section>

              <Section title="Google Ads Campagnes (Blueprints)" icon={BarChart2} iconCn="text-blue-400">
                <div className="p-5">
                  <AccountCampaigns childAccount={account} />
                </div>
              </Section>
           </div>
        </TabsContent>

        {/* ── TAB: DIENSTEN & PAKKETTEN ── */}
        <TabsContent value="diensten" className="space-y-6 animate-in fade-in duration-500">
          {childAccountRef && managerUid ? (
              <AccountServicesManager account={account} accountDocRef={childAccountRef} isAdmin={isAdmin} />
          ) : (
              <div className="p-8 text-center text-slate-400">Services configuration unavailable.</div>
          )}
        </TabsContent>

        {/* ── TAB: DOCUMENTEN & LINKS ── */}
        <TabsContent value="documenten" className="animate-in fade-in duration-500">
          <AccountDocuments childAccountRef={childAccountRef as any} />
        </TabsContent>

        {/* ── TAB: INSTELLINGEN (Settings) ── */}
        {isAdmin && (
            <TabsContent value="instellingen" className="animate-in fade-in duration-500">
                <AccountSettings account={{ ...childAccount, parentClientId: effectiveParentId } as ChildAccount} accountDocRef={childAccountRef as any} isAdmin={isAdmin} />
            </TabsContent>
        )}

        {/* ── TAB: RAPPORTAGES ── */}
        <TabsContent value="rapportages" className="space-y-6 animate-in fade-in duration-500">
           {accountId && <AccountReports accountId={accountId as string} />}
        </TabsContent>

      </Tabs>

      {/* Checklist runner modal */}
      {account && (
        <ChecklistRunner
          account={account}
          checklistId={activeChecklist?.checklistId}
          connectedChecklist={activeChecklist}
          open={isRunnerOpen}
          onOpenChange={setIsRunnerOpen}
          onComplete={handleChecklistComplete}
        />
      )}
    </div>
  );
}
