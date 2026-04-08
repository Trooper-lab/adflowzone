'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, arrayRemove, getDoc, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import type { ChildAccount, ChecklistTemplate, ConnectedChecklist, KpiData, ParentClient, ChecklistRun, AppUser } from '@/lib/types';
import { format, startOfMonth, addMonths, isPast, isToday, addDays, addWeeks, getDay, setDay, setDate, parseISO, subDays, differenceInDays, isValid } from "date-fns"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Settings, Trash2, Goal, Wallet, ArrowLeft, MessageSquare, ListChecks, History, Users, Activity, Zap, TrendingUp, Clock, AlertTriangle, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChecklistRunner } from '@/components/checklist/ChecklistRunner';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Progress } from '@/components/ui/progress';

// Extracted Components
import AccountTodos from '@/components/account/AccountTodos';
import AccountReports from '@/components/account/AccountReports';
import KpiStandardTable from '@/components/account/KpiStandardTable';
import ChecklistHistory from '@/components/account/ChecklistHistory';
import AddChecklistDialog from '@/components/account/AddChecklistDialog';
import InProgressChecklists from '@/components/account/InProgressChecklists';

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="size-12 rounded-full border-4 border-slate-800" />
        <div className="size-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin absolute top-0" />
      </div>
      <span className="text-slate-400 font-medium animate-pulse">Loading account data...</span>
    </div>
  );
}

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const parentClientId = searchParams.get('parent');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<ConnectedChecklist | null>(null);
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [stats, setStats] = useState({
    checklists30d: 0,
    comments30d: 0,
    healthScore: 0,
    lastRunDays: 0,
    pacingScore: 0
  });

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
  }, [appUser, user?.email]);

  const parentClientRef = useMemoFirebase(() => {
    if (!firestore || !parentClientId) return null;
    return doc(firestore, 'parentClients', parentClientId as string);
  }, [firestore, parentClientId]);

  const childAccountRef = useMemoFirebase(() => {
    if (!firestore || !parentClientId || !accountId) return null;
    return doc(firestore, 'parentClients', parentClientId as string, 'childAccounts', accountId as string);
  }, [firestore, parentClientId, accountId]);

  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef);
  const { data: childAccount, loading: childLoading, refetch: refetchChildAccount } = useDoc(childAccountRef);

  const assignedEmployeeId = (childAccount as ChildAccount)?.assignedEmployeeId;
  const isAccountLoaded = !childLoading && !!childAccount;

  useEffect(() => {
    if (isAccountLoaded && !isAdmin && user?.uid) {
      if (assignedEmployeeId !== user.uid) {
        toast({ 
          variant: 'destructive', 
          title: 'Toegang Geweigerd', 
          description: 'Je bent niet toegewezen aan dit account.' 
        });
        router.push('/dashboard');
      }
    }
  }, [isAccountLoaded, isAdmin, user?.uid, assignedEmployeeId, router, toast]);

  const managerUid = useMemo(() => {
    if (!user || !appUser) return null;
    return isAdmin ? user.uid : (appUser as AppUser)?.managerId || null;
  }, [user, appUser, isAdmin]);

  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !managerUid) return null;
    return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
  }, [firestore, managerUid]);
  const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);

  // Optimized calculateStats
  useEffect(() => {
    const calculateStats = async () => {
      if (!firestore || !childAccount || !(childAccount as ChildAccount).id) {
        return;
      }
      
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Use query instead of fetching all IDs
      const runsQuery = query(
        collection(firestore, 'checklistRuns'),
        where('childAccountId', '==', (childAccount as ChildAccount).id),
        where('completedAt', '>=', thirtyDaysAgo.toISOString())
      );
      
      try {
        const snapshot = await getDocs(runsQuery);
        let checklists = 0;
        let comments = 0;
        let lastRunDate: Date | null = null;

        snapshot.forEach(snap => {
            const run = snap.data() as ChecklistRun;
            checklists++;
            comments += run.tasks.filter(t => t.notes?.trim()).length;
            
            let completedAt: Date | null = null;
            const rawDate = run.completedAt;
            if (rawDate) {
                if (rawDate instanceof Date) {
                    completedAt = rawDate;
                } else if (typeof rawDate === 'string') {
                    completedAt = parseISO(rawDate);
                } else if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
                    completedAt = (rawDate as any).toDate();
                } else if (typeof rawDate === 'number') {
                    completedAt = new Date(rawDate);
                }
            }

            if (completedAt && isValid(completedAt)) {
                if (!lastRunDate || completedAt > lastRunDate) {
                    lastRunDate = completedAt;
                }
            }
        });

        // Pacing Score: Based on connected checklists frequency (rough estimate)
        const connectedCount = (childAccount as ChildAccount).connectedChecklists?.length || 1;
        const expectedRuns = connectedCount * 2; // Arbitrary: expect 2 runs per connected checklist in 30 days
        const pacing = Math.min(Math.round((checklists / expectedRuns) * 100), 100);

        // Days since last run
        const daysSinceLast = lastRunDate ? differenceInDays(new Date(), lastRunDate) : 30;
        const activityScore = Math.max(100 - (daysSinceLast * 10), 0);

        setStats({
            checklists30d: checklists,
            comments30d: comments,
            healthScore: Math.round((pacing + activityScore) / 2),
            lastRunDays: daysSinceLast,
            pacingScore: pacing
        });
      } catch (e) {
        console.error("Error calculating stats:", e);
      }
    };

    if (isAccountLoaded) {
        calculateStats();
    }
  }, [childAccount, firestore, isAccountLoaded, refetchTrigger]);

  const handleStartChecklist = (checklist: ConnectedChecklist) => {
    setActiveChecklist(checklist);
    setIsRunnerOpen(true);
  };
  
  const handleChecklistComplete = () => {
    refetchChildAccount();
    setIsRunnerOpen(false);
    setRefetchTrigger(prev => prev + 1);
  }

  const handleDisconnectChecklist = async (conn: ConnectedChecklist) => {
    if (!childAccountRef || !(childAccount as ChildAccount)?.connectedChecklists) return;
    try {
        const updatedChecklists = (childAccount as ChildAccount).connectedChecklists!.filter(
            c => c.checklistId !== conn.checklistId
        );
        
        await updateDoc(childAccountRef, {
            connectedChecklists: updatedChecklists
        });
        
        toast({ title: 'Checklist ontkoppeld' });
        refetchChildAccount();
    } catch (e) {
        console.error("Error disconnecting checklist:", e);
        toast({ 
            variant: 'destructive',
            title: 'Fout bij ontkoppelen',
            description: 'U heeft mogelijk onvoldoende machtigingen.'
        });
    }
  };

  const enrichedConnectedChecklists = useMemo(() => {
    if (!childAccount?.connectedChecklists || !checklistTemplates) return [];
    
    const templatesMap = new Map((checklistTemplates as ChecklistTemplate[]).map(t => [t.id, t]));

    return childAccount.connectedChecklists.map((conn: ConnectedChecklist) => {
        const template = templatesMap.get(conn.checklistId);
        let nextDueDate: Date;
        const lastRun = conn.lastRunAt ? parseISO(conn.lastRunAt) : null;
        const startDate = parseISO(conn.startDate);
        
        if (conn.frequency === 'one-off' && lastRun) return null;

        const basisDate = lastRun || new Date();
        
        if (conn.frequency === 'daily') {
            nextDueDate = addDays(basisDate, 1);
        } else if (conn.frequency === 'weekly') {
            const scheduledDay = getDay(startDate);
            let nextInstance = setDay(basisDate, scheduledDay, { weekStartsOn: 1 });
            if (isPast(nextInstance) && !isToday(nextInstance)) nextInstance = addWeeks(nextInstance, 1);
            nextDueDate = nextInstance;
        } else if (conn.frequency === 'monthly') {
            const scheduledDate = startDate.getDate();
            let nextInstance = setDate(basisDate, scheduledDate);
             if (isPast(nextInstance) && !isToday(nextInstance)) nextInstance = addMonths(nextInstance, 1);
            nextDueDate = nextInstance;
        } else {
            nextDueDate = startDate;
        }

        return {
            ...conn,
            name: template?.name || 'Unknown Checklist',
            description: template?.description,
            nextDueDate: nextDueDate,
        };
    }).filter(Boolean).sort((a: any,b: any) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  }, [childAccount, checklistTemplates, refetchTrigger]);
  
  const getScheduleText = (checklist: any) => {
    if (!checklist) return '';
    const { frequency, startDate } = checklist;
    const date = parseISO(startDate);
    switch (frequency) {
        case 'daily': return 'Daily';
        case 'one-off': return `One-off (${format(date, 'MMM dd')})`;
        case 'weekly': return `Weekly (${format(date, 'EEEE')})`;
        case 'monthly': return `Monthly (Day ${format(date, 'do')})`;
        default: return 'Custom';
    }
  }

  const handleSaveKpiData = async (data: Record<string, Record<string, number | string>>) => {
    if (!firestore || !user || !childAccount) return;
    setIsSaving(true);

    try {
        const batch = writeBatch(firestore);
        const kpiDocsPromises = (childAccount.kpiDataIds || []).map((id: string) => getDoc(doc(firestore, 'kpiData', id)));
        const existingKpiDocsSnaps = await Promise.all(kpiDocsPromises);
        const existingKpiDocs = existingKpiDocsSnaps.map(snap => ({ id: snap.id, ...snap.data() } as KpiData));

        const newKpiDataIds: string[] = [];

        for (const monthKey in data) {
            const monthDate = parseISO(`${monthKey}-01T12:00:00Z`);
            const startOfMonthISO = startOfMonth(monthDate).toISOString();
            const monthData = data[monthKey];
            const numericKpiValues: Record<string, number> = {};

            const hasValues = Object.values(monthData).some(val => val !== '' && val !== null && val !== undefined);
            if (!hasValues) continue;

            for (const kpi in monthData) {
                 if (['cpc', 'ctr', 'cpl', 'roas'].includes(kpi)) continue; 
                const value = parseFloat(monthData[kpi] as string);
                if (!isNaN(value)) numericKpiValues[kpi] = value;
            }
            
            const existingDoc = existingKpiDocs.find(d => d.startDate === startOfMonthISO);
            
            if (existingDoc) {
                batch.update(doc(firestore, 'kpiData', existingDoc.id), { kpiValues: numericKpiValues });
            } else if (Object.keys(numericKpiValues).length > 0) {
                 const newDocRef = doc(collection(firestore, 'kpiData')); 
                 batch.set(newDocRef, {
                    ownerId: user.uid,
                    childAccountId: childAccount.id,
                    periodType: 'monthly',
                    startDate: startOfMonthISO,
                    kpiValues: numericKpiValues
                 });
                 newKpiDataIds.push(newDocRef.id);
            }
        }
        
        if (newKpiDataIds.length > 0 && childAccountRef) {
            batch.update(childAccountRef, { kpiDataIds: arrayUnion(...newKpiDataIds) });
        }
        
        await batch.commit();
        toast({ title: 'KPI Data Saved' });
        if (newKpiDataIds.length > 0) {
            refetchChildAccount();
            setRefetchTrigger(prev => prev + 1);
        }
    } catch(e) {
         console.error("Error saving KPI data:", e);
    } finally {
        setIsSaving(false);
    }
  };

  const [assignedEmployee, setAssignedEmployee] = useState<AppUser | null>(null);

  useEffect(() => {
    if (assignedEmployeeId && firestore) {
        getDoc(doc(firestore, 'users', assignedEmployeeId)).then(snap => {
            if (snap.exists()) setAssignedEmployee(snap.data() as AppUser);
        });
    }
  }, [assignedEmployeeId, firestore]);

  if (childLoading || parentLoading || checklistsLoading) return <LoadingState />;
  if (!childAccount || !parentClient) return <div className="p-8 text-center">Account not found.</div>;

  const account = childAccount as ChildAccount;
  const client = parentClient as ParentClient;
  
  const goalLabels: Record<string, string> = {
    lead_generation: 'Lead Generation',
    ecommerce_sales: 'E-commerce Sales',
    brand_awareness: 'Brand Awareness',
    other: 'General'
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Premium Header */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-15 group-hover:opacity-25 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-slate-800/50 hover:bg-slate-700 transition-colors">
                    <ArrowLeft className="size-5" />
                </Button>
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="font-headline text-3xl font-bold tracking-tight text-white">{account.nickname}</h1>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-slate-700 text-slate-400 px-2 py-0">
                            {account.googleAdsClientId}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5"><Briefcase className="size-4 text-blue-400" /> {client.clientName}</span>
                        <span className="flex items-center gap-1.5"><Zap className="size-4 text-yellow-500" /> {goalLabels[account.primaryGoal] || account.primaryGoal}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full border transition-all", getHealthBg(stats.healthScore))}>
                    <Activity className={cn("size-4", getHealthColor(stats.healthScore))} />
                    <span className="text-xs font-semibold tracking-wider uppercase">Health: {stats.healthScore}%</span>
                </div>
                {assignedEmployee && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/5 border border-blue-500/20 text-blue-300">
                        <Users className="size-4" />
                        <span className="text-xs font-medium">{assignedEmployee.displayName || assignedEmployee.email}</span>
                    </div>
                )}
                <Button variant="secondary" size="sm" className="rounded-full px-5 bg-white/5 hover:bg-white/10 border-white/5 text-white transition-all shadow-xl" asChild>
                    <Link href={`/dashboard/accounts/${accountId}/edit?parent=${parentClientId}`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Config
                    </Link>
                </Button>
            </div>
        </div>
      </div>
      
      {/* Standings & Key Metrics */}
      <div className={cn("grid grid-cols-1 gap-6", isAdmin ? "md:grid-cols-4" : "md:grid-cols-3")}>
        <Card className="bg-slate-900/30 border-slate-800/50 backdrop-blur-sm overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-50" />
            <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">Monthly Budget</CardDescription>
                <CardTitle className="text-4xl font-bold text-white flex items-baseline gap-1">
                    <span className="text-xl text-blue-400/80">€</span>
                    {account.monthlyClickBudget?.toLocaleString() || '0'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <TrendingUp className="size-3 text-green-400" />
                    <span>Pacing at 100%</span>
                </div>
            </CardContent>
        </Card>

        {isAdmin && (
            <Card className="bg-slate-900/30 border-slate-800/50 backdrop-blur-sm overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-50" />
                <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold text-slate-500">Mgmt Fee</CardDescription>
                    <CardTitle className="text-4xl font-bold text-white flex items-baseline gap-1">
                        <span className="text-xl text-purple-400/80">€</span>
                        {account.managementFee?.amount?.toLocaleString() || '0'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-slate-500 italic">Fixed Monthly</div>
                </CardContent>
            </Card>
        )}

        <Card className="md:col-span-2 bg-slate-900/30 border-slate-800/50 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-30" />
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-base font-bold text-white">Account Standing</CardTitle>
                    <CardDescription className="text-xs">Based on last 30 days of activity</CardDescription>
                </div>
                <Zap className={cn("size-5", getHealthColor(stats.healthScore))} />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                            <span>Pacing</span>
                            <span className={getHealthColor(stats.pacingScore)}>{stats.pacingScore}%</span>
                        </div>
                        <Progress value={stats.pacingScore} className="h-1.5 bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                            <span>Last Sync</span>
                            <span className="text-slate-200">{stats.lastRunDays}d ago</span>
                        </div>
                        <Progress value={Math.max(100 - (stats.lastRunDays * 5), 0)} className="h-1.5 bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                         <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                            <span>Intensity</span>
                            <span className="text-blue-400">{stats.checklists30d} runs</span>
                        </div>
                        <Progress value={Math.min(stats.checklists30d * 20, 100)} className="h-1.5 bg-slate-800" />
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-8 items-start">
        <div className="col-span-3 lg:col-span-2 space-y-10">
            {/* Checklist Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Clock className="text-blue-400 size-5" />
                        Checklist Center
                    </h2>
                </div>
                
                {/* Draft Checklists (Highest Priority) */}
                <InProgressChecklists account={account} onStart={handleStartChecklist} />
                
                <div className="grid grid-cols-1 gap-6">
                    {/* Active/Connected */}
                    <Card className="bg-slate-900/20 border-slate-800/40">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <ListChecks className="size-4 text-emerald-400" />
                                    Active Automated Schedules
                                </CardTitle>
                                {childAccountRef && managerUid && <AddChecklistDialog childAccountRef={childAccountRef} managerUid={managerUid} />}
                            </div>
                        </CardHeader>
                        <CardContent>
                             {!checklistsLoading && enrichedConnectedChecklists.length > 0 ? (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {enrichedConnectedChecklists.map((checklist: any, index: number) => (
                                        <div key={index} className="relative group/card">
                                            <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                            <div className="relative p-5 rounded-xl border border-slate-800/30 bg-slate-900/40 hover:border-blue-500/30 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="space-y-1">
                                                        <h4 className="font-bold text-slate-100 group-hover/card:text-blue-400 transition-colors uppercase text-[10px] tracking-widest">{getScheduleText(checklist)}</h4>
                                                        <p className="text-lg font-bold leading-tight">{checklist.name}</p>
                                                    </div>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-400 hover:bg-red-400/10">
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="bg-slate-900 border-slate-800">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-white">Delete schedule?</AlertDialogTitle>
                                                                <AlertDialogDescription>This stops the automation for {checklist.name}. History is preserved.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="bg-slate-800 border-slate-700">Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDisconnectChecklist(checklist)} className="bg-red-600 hover:bg-red-700">Disconnect</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Next Due</span>
                                                        <p className="text-sm font-semibold text-slate-300">{format(checklist.nextDueDate, "PPP")}</p>
                                                    </div>
                                                    <Button size="sm" onClick={() => handleStartChecklist(checklist)} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 h-9 shadow-lg shadow-blue-900/20">
                                                        Run Now
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-slate-800/50 rounded-2xl">
                                    <ListChecks className="size-10 mx-auto text-slate-700 mb-3" />
                                    <p className="text-slate-500 font-medium">No automated checklists configured.</p>
                                    <p className="text-xs text-slate-600 mt-1">Connect a template to start tracking performance.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* KPI Performance Section (Moved here) */}
                    <div className="space-y-4 pt-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                            <TrendingUp className="text-emerald-400 size-5" />
                            KPI Tracker
                        </h2>
                        <Card className="bg-slate-900/20 shadow-2xl border-slate-800/50">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-6 mb-4">
                                <div>
                                    <CardTitle className="text-sm font-bold text-slate-300">Monthly Metric Ledger</CardTitle>
                                    <CardDescription className="text-xs">Precision monitoring of core performance indicators</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="grid grid-cols-[120px_1fr_80px] items-center gap-4 px-2 py-3 mb-2 text-[10px] font-black tracking-widest text-slate-600 uppercase">
                                    <span>Chronology</span>
                                    <div className="grid grid-cols-6 gap-x-4">
                                        {account.kpisToTrack.map(kpi => <span key={kpi}>{kpi.substring(0,6)}</span>)}
                                    </div>
                                    <span className="text-right">Manage</span>
                                </div>
                                <KpiStandardTable 
                                    childAccount={account} 
                                    onSave={handleSaveKpiData}
                                    isSaving={isSaving}
                                    onRefetchNeeded={() => setRefetchTrigger(p => p + 1)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* History */}
                    <Card className="bg-slate-900/20 border-slate-800/40">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <History className="size-4 text-blue-400" />
                                Performance History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChecklistHistory account={account} managerUid={managerUid} />
                        </CardContent>
                    </Card>
                </div>
            </div>

        </div>

        {/* Sidebar */}
        <div className="col-span-3 lg:col-span-1 space-y-8">
            <div className="transition-all hover:translate-y-[-2px]">
                {client && account && childAccountRef && (
                    <AccountTodos 
                        parentClient={client} 
                        childAccount={account} 
                        childAccountRef={childAccountRef} 
                        onRefetchNeeded={() => setRefetchTrigger(p => p+1)} 
                    />
                )}
            </div>
            
            <div className="transition-all hover:translate-y-[-2px]">
                {accountId && <AccountReports accountId={accountId as string} />}
            </div>

            {/* Account Info Tooltip/Card */}
            <Card className="bg-blue-600/5 border-blue-500/10 backdrop-blur-md">
                <CardHeader className="pb-3 text-center">
                    <div className="size-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                        <Goal className="text-blue-400" />
                    </div>
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-tighter">Strategic Intent</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                        <p className="text-xs font-medium text-slate-400 mb-1 italic">"{account.accountGoal?.value || 'Focused growth and efficiency'}"</p>
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <div className="text-left">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Currency</span>
                            <p className="text-sm font-bold">{account.currency?.id || 'EUR'}</p>
                        </div>
                        <div className="text-right">
                             <span className="text-[10px] text-slate-500 uppercase font-bold">TimeZone</span>
                            <p className="text-sm font-bold">{account.timeZone?.id || 'UTC'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {account && <ChecklistRunner
        account={account}
        checklistId={activeChecklist?.checklistId}
        connectedChecklist={activeChecklist}
        open={isRunnerOpen}
        onOpenChange={setIsRunnerOpen}
        onComplete={handleChecklistComplete}
      />}
    </div>
  );
}
