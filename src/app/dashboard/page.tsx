'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc, Timestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlayCircle, CalendarClock, CalendarCheck, List, LayoutGrid, ChevronDown, ChevronRight, Check, AlertCircle, Clock, CalendarDays, Rocket, ArrowRight, Zap, ChevronLeft, Target, Activity, Users } from 'lucide-react';
import type { ParentClient, ChildAccount, ConnectedChecklist, ChecklistRun, ChecklistTemplate, AppUser, Project } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChecklistRunner } from '@/components/checklist/ChecklistRunner';
import { format, isToday, isPast, addDays, addWeeks, addMonths, parseISO, getDay, setDay, setDate, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, subMonths } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

type DashboardTask = {
    id: string; 
    type: 'checklist';
    accountNickname: string;
    parentName: string;
    parentClientId: string;
    childAccountId: string;
    title: string; 
    dueDate: Date;
    lastCompleted?: string | null;
    frequency: 'daily' | 'weekly' | 'monthly' | 'one-off';
    status: 'due' | 'overdue' | 'upcoming' | 'in_progress';
    checklist: ConnectedChecklist;
    childAccount: ChildAccount;
    assignedEmployeeName?: string;
};

function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center gap-6 p-10 text-center py-20">
            <Loader2 className="size-12 text-muted-foreground animate-spin" />
            <h3 className="text-xl font-semibold font-headline text-slate-200">Dashboard laden...</h3>
            <p className="text-muted-foreground max-w-sm">
                We organiseren je checklists voor vandaag.
            </p>
        </div>
    );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 p-20 text-center border-dashed bg-transparent border-border/30 animate-in fade-in zoom-in duration-700">
      <div className="flex flex-col items-center gap-4">
        <div className="p-6 rounded-full bg-green-500/10 text-green-400 ring-4 ring-green-500/5">
            <Check className="size-12" />
        </div>
        <div className="space-y-2">
            <h3 className="text-2xl font-bold font-headline text-slate-100">Alles bijgewerkt!</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Er zijn geen openstaande taken die vandaag je aandacht nodig hebben. Tijd voor een kop koffie?
            </p>
        </div>
      </div>
       <Button asChild variant="outline" className="mt-4 hover:bg-white/5 transition-all">
            <Link href="/dashboard/accounts">Bekijk Portfolio</Link>
        </Button>
    </Card>
  );
}

const StatusIcon = ({ status }: { status: 'due' | 'overdue' | 'upcoming' | 'in_progress' }) => {
    const colorClass = {
        due: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]',
        overdue: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
        upcoming: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
        in_progress: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
    }[status];
    return <div className={cn('size-2.5 rounded-full transition-all duration-500', colorClass)} />;
}

const ClientListView = ({ tasks, onStart, isAdmin }: { tasks: DashboardTask[], onStart: (task: DashboardTask) => void, isAdmin: boolean }) => {
    const grouped = useMemo(() => {
        const map: Record<string, DashboardTask[]> = {};
        tasks.forEach(t => {
            if (!map[t.parentName]) map[t.parentName] = [];
            map[t.parentName].push(t);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [tasks]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {grouped.map(([clientName, clientTasks]) => (
                <Card key={clientName} className="glass-card overflow-hidden shadow-xl">
                    <CardHeader className="bg-white/5 border-b border-white/5 py-3 px-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="size-4" />
                                {clientName}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold border-slate-700 text-slate-500 bg-white/5">
                                {clientTasks.length} {clientTasks.length === 1 ? 'taak' : 'taken'}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {clientTasks.map(task => (
                                <div key={task.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <StatusIcon status={task.status} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                                                {task.accountNickname}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-slate-500 truncate">{task.title}</p>
                                                {isAdmin && task.assignedEmployeeName && (
                                                    <>
                                                        <span className="text-slate-700 text-[10px]">•</span>
                                                        <Badge variant="secondary" className="p-0 bg-transparent border-none text-[10px] text-blue-400/70 hover:text-blue-400 font-bold uppercase tracking-wider h-auto">
                                                            {task.assignedEmployeeName}
                                                        </Badge>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 pl-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Deadline</p>
                                            <p className={cn("text-xs font-bold", task.status === 'overdue' ? "text-red-400" : "text-slate-400")}>
                                                {format(task.dueDate, 'dd MMM')}
                                            </p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => onStart(task)}
                                            className="h-10 w-10 rounded-full hover:bg-blue-600 hover:text-white p-0 active:scale-90 transition-all"
                                        >
                                            <PlayCircle className="size-6" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

const CalendarView = ({ tasks, onStart, isAdmin }: { tasks: DashboardTask[], onStart: (task: DashboardTask) => void, isAdmin: boolean }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold font-headline text-slate-100 flex items-center gap-2">
                    <CalendarDays className="text-blue-400 size-5" />
                    {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                </h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 bg-card border-white/5">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 bg-card border-white/5">
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                    <div key={day} className="bg-card p-3 text-center font-label-caps text-muted-foreground">
                        {day}
                    </div>
                ))}
                {days.map((day, i) => {
                    const dayTasks = tasks.filter(t => isSameDay(t.dueDate, day));
                    const isTodayDay = isToday(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const hasMore = dayTasks.length > 3;
                    const visibleTasks = dayTasks.slice(0, 3);

                    return (
                        <div 
                            key={i} 
                            className={cn(
                                "min-h-[140px] bg-card/60 p-2 flex flex-col gap-1.5 transition-colors hover:bg-card/80",
                                !isCurrentMonth && "opacity-30 bg-[#161d2e]",
                                isTodayDay && "ring-1 ring-inset ring-blue-500/50 bg-blue-500/[0.02]"
                            )}
                        >
                            <div className="flex justify-between items-center px-1 mb-1">
                                <span className={cn(
                                    "text-xs font-bold",
                                    isTodayDay ? "text-blue-400" : "text-slate-500"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayTasks.length > 0 && (
                                    <span className="text-[10px] font-black text-slate-600">{dayTasks.length}</span>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-1 overflow-y-hidden">
                                {visibleTasks.map(task => (
                                    <button
                                        key={task.id}
                                        onClick={() => onStart(task)}
                                        className={cn(
                                            "text-left p-1.5 rounded-md text-[9px] font-bold uppercase tracking-tight truncate border transition-all active:scale-95 group relative",
                                            task.status === 'overdue' 
                                                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" 
                                                : task.status === 'in_progress'
                                                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20"
                                                : "bg-blue-500/5 border-blue-500/10 text-blue-400/80 hover:bg-blue-500/10 hover:text-blue-400"
                                        )}
                                        title={`${task.accountNickname}: ${task.title}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn(
                                                "size-1 rounded-full shrink-0",
                                                task.status === 'overdue' ? "bg-red-500" : task.status === 'in_progress' ? "bg-yellow-500" : "bg-blue-500"
                                            )} />
                                            <span className="truncate">{task.accountNickname.split(' ')[0]}</span>
                                        </div>
                                    </button>
                                ))}

                                {hasMore && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="text-center p-1 rounded-md text-[9px] font-black uppercase tracking-widest text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/5 transition-all">
                                                + {dayTasks.length - 3} meer
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0 glass-card-elevated shadow-2xl" align="start" side="right">
                                            <div className="p-3 border-b border-white/5 bg-white/5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    Taken op {format(day, 'd MMMM', { locale: nl })}
                                                </p>
                                            </div>
                                            <ScrollArea className="max-h-[300px]">
                                                <div className="p-2 space-y-1">
                                                    {dayTasks.map(task => (
                                                        <button
                                                            key={task.id}
                                                            onClick={() => onStart(task)}
                                                            className={cn(
                                                                "w-full text-left p-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-3 border",
                                                                task.status === 'overdue' 
                                                                    ? "bg-red-500/10 border-red-500/20 text-red-400" 
                                                                    : task.status === 'in_progress'
                                                                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                                                                    : "bg-white/5 border-white/5 text-slate-200 hover:bg-white/10"
                                                            )}
                                                        >
                                                            <StatusIcon status={task.status} />
                                                            <div className="min-w-0">
                                                                <p className="truncate">{task.accountNickname}</p>
                                                                <p className="text-[9px] font-medium opacity-60 truncate">{task.title}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PriorityFlowView = ({ tasks, onStart, isAdmin }: { tasks: DashboardTask[], onStart: (task: DashboardTask) => void, isAdmin: boolean }) => {
    const activeTasks = tasks.filter(t => t.status === 'due' || t.status === 'overdue' || t.status === 'in_progress');
    const nextTask = activeTasks[0];
    const remainingToday = activeTasks.length;

    if (!nextTask) return <EmptyState />;

    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 mb-4 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm shadow-blue-500/5">
                    <Zap className="size-3 mr-2 animate-pulse" /> Focus Modus
                </Badge>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.3em]">Volgende Prioriteit</h2>
            </div>

            <Card className="glass-card border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative group animate-in fade-in zoom-in-95 duration-700 hover:border-primary/30 transition-all">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:w-2 transition-all duration-300" />
                <CardContent className="p-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="space-y-5 flex-grow">
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">{nextTask.parentName}</p>
                                <h3 className="text-4xl md:text-5xl font-bold font-headline leading-tight text-slate-100">{nextTask.accountNickname}</h3>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4">
                                <Badge variant="secondary" className="bg-white/5 text-slate-300 border-none px-3 py-1.5 capitalize font-medium">
                                    {nextTask.frequency}
                                </Badge>
                                <div className="flex items-center gap-2.5 text-sm font-bold tracking-tight">
                                    <StatusIcon status={nextTask.status} />
                                    <span className={cn(nextTask.status === 'overdue' ? "text-red-400" : "text-slate-400 uppercase tracking-widest text-[10px]")}>
                                        {nextTask.status === 'overdue' ? "TE LAAT" : "VANDAAG"}
                                    </span>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800 rounded-full" />
                                <p className="text-xl md:text-2xl text-slate-300 font-medium pl-6 py-1 leading-relaxed">
                                    {nextTask.title}
                                </p>
                            </div>

                            {isAdmin && nextTask.assignedEmployeeName && (
                                <div className="flex items-center gap-2 px-6 py-1 text-slate-500">
                                    <Users className="size-3.5" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Toegewezen aan: <span className="text-blue-400">{nextTask.assignedEmployeeName}</span></span>
                                </div>
                            )}
                        </div>

                        <Button 
                            onClick={() => onStart(nextTask)} 
                            size="lg" 
                            className="w-full md:w-auto h-24 px-12 text-xl font-black bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/40 group-hover:scale-105 active:scale-95 transition-all duration-300 relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                Nu Starten <ArrowRight className="size-7 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        </Button>
                    </div>
                </CardContent>
                <div className="bg-black/20 px-10 py-5 flex justify-between items-center border-t border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <List className="size-3" /> Nog <span className="text-blue-400 font-black">{remainingToday}</span> taken op de planning voor vandaag
                    </p>
                </div>
            </Card>
        </div>
    );
};

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [scheduledTasks, setScheduledTasks] = useState<DashboardTask[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<DashboardTask | null>(null);
  const [isChecklistRunnerOpen, setIsChecklistRunnerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'priorityFlow' | 'calendar' | 'clientList'>('priorityFlow');

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
  }, [appUser, user?.email]);

  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const ownerId = isAdmin ? user.uid : (appUser as AppUser)?.managerId;
    if (!ownerId) return null;
    return query(collection(firestore, 'users', ownerId, 'checklistTemplates'));
  }, [firestore, user, isAdmin, appUser]);
  const { data: checklistTemplates } = useCollection(checklistsQuery);


  const handleStartChecklist = (task: DashboardTask) => {
    setActiveTask(task);
    setIsChecklistRunnerOpen(true);
  };
  
  const handleChecklistComplete = () => {
      setIsChecklistRunnerOpen(false);
      setActiveTask(null);
      setTimeout(() => setRefreshTrigger(c => c + 1), 300);
  };

  useEffect(() => {
    if (!firestore || !user || !checklistTemplates || !appUser) {
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);

    const fetchAllData = async () => {
        const allTasks: DashboardTask[] = [];
        const templatesMap = new Map((checklistTemplates as ChecklistTemplate[]).map(t => [t.id, t]));
        const managerUid = isAdmin ? user.uid : (appUser as AppUser)?.managerId;

        if (!managerUid) {
            setLoading(false);
            return;
        }

        try {
            console.log("DASHBOARD_STEP: Start Load");
            
            // 1. Fetch Clients & Employees
            const [clientsSnapshot, teamSnapshot] = await Promise.all([
                getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid))),
                isAdmin ? getDocs(query(collection(firestore, 'users'), where('managerId', '==', user.uid))) : Promise.resolve({ docs: [] })
            ]);

            const parentClients = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
            const parentClientMap = new Map(parentClients.map(c => [c.id, c.clientName]));

            const employeeMap = new Map<string, string>();
            if (isAdmin) {
                teamSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    employeeMap.set(data.uid, data.displayName || data.email || 'Geen Naam');
                });
            }

            if (parentClients.length === 0) {
                setScheduledTasks([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Accounts
            const childAccountPromises = parentClients.map(client => 
                isAdmin
                    ? getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                    : getDocs(query(collection(firestore, 'parentClients', client.id, 'childAccounts'), where('assignedEmployeeId', '==', user.uid)))
            );
            const childAccountSnapshots = await Promise.all(childAccountPromises);
            const allChildAccounts = childAccountSnapshots.flatMap(snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChildAccount)));
            
            const visibleChildAccounts = allChildAccounts.filter(account => {
                if (account.isPaused) return false;
                if (isAdmin) {
                    // Admins see only unassigned accounts in their own planning view
                    return !account.assignedEmployeeId;
                }
                return account.assignedEmployeeId === user.uid;
            });

            // 3. Fetch In Progress Runs & Projects safely
            const [runsSnapshot, projectsSnapshot] = await Promise.all([
                getDocs(query(collection(firestore, 'checklistRuns'), where(isAdmin ? 'managerId' : 'ownerId', '==', isAdmin ? managerUid : user.uid), where('status', '==', 'in_progress'))),
                getDocs(query(collection(firestore, 'projects'), where('ownerId', '==', user.uid)))
            ]).catch(e => {
                console.error("DASHBOARD_ERROR: Secondary data fetch failed", e);
                return [ { docs: [] }, { docs: [] } ] as any[];
            });

            const inProgressRuns = (runsSnapshot.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as ChecklistRun));
            const projects = (projectsSnapshot.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as Project));
            
            setActiveProjects(projects.filter((p: any) => p.status === 'active'));

            visibleChildAccounts.forEach((account) => {
                if (!account.connectedChecklists) return;
                
                account.connectedChecklists.forEach(conn => {
                    const template = templatesMap.get(conn.checklistId);
                    if (!template) return;
                    
                    const inProgressRun = inProgressRuns.find((run: any) => run.childAccountId === account.id && run.checklistId === conn.checklistId);

                    if (conn.frequency === 'one-off' && conn.lastRunAt && !inProgressRun) {
                        return;
                    }

                    const startDate = parseISO(conn.startDate);
                    let dueDate: Date;

                    if (inProgressRun) {
                         dueDate = inProgressRun.runAt instanceof Timestamp ? inProgressRun.runAt.toDate() : parseISO(inProgressRun.runAt as unknown as string);
                    } else if (conn.lastRunAt) {
                        const lastRunDate = startOfDay(parseISO(conn.lastRunAt));
                        if (conn.frequency === 'daily') {
                            dueDate = addDays(lastRunDate, 1);
                        } else if (conn.frequency === 'weekly') {
                            const scheduledDay = getDay(startDate);
                            let nextInstance = setDay(addWeeks(lastRunDate,1), scheduledDay, { weekStartsOn: 1 });
                            dueDate = nextInstance;
                        } else if (conn.frequency === 'monthly') {
                            const scheduledDate = startDate.getDate();
                            let nextInstance = setDay(lastRunDate, scheduledDate);
                            if (isPast(nextInstance)) {
                                nextInstance = addMonths(nextInstance, 1);
                            }
                            dueDate = nextInstance;
                        } else { 
                            return; 
                        }
                    } else {
                        dueDate = startDate;
                    }

                    const status: DashboardTask['status'] = inProgressRun 
                        ? 'in_progress' 
                        : (isPast(dueDate) && !isToday(dueDate) ? 'overdue' : (isToday(dueDate) ? 'due' : 'upcoming'));


                    allTasks.push({
                        id: `checklist-${account.id}-${conn.checklistId}-${conn.startDate}`,
                        type: 'checklist',
                        accountNickname: account.nickname,
                        parentName: parentClientMap.get(account.parentClientId) || 'Onbekende Klant',
                        parentClientId: account.parentClientId,
                        childAccountId: account.id,
                        title: template.name,
                        dueDate: dueDate,
                        lastCompleted: conn.lastRunAt,
                        frequency: conn.frequency,
                        status: status,
                        checklist: conn,
                        childAccount: account,
                        assignedEmployeeName: isAdmin ? (account.assignedEmployeeId ? (employeeMap.get(account.assignedEmployeeId) || 'Onbekend Teamid') : 'Niet toegewezen') : undefined,
                    });
                });
            });
            
            allTasks.sort((a, b) => {
                if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                return a.dueDate.getTime() - b.dueDate.getTime();
            });
            setScheduledTasks(allTasks);

        } catch (e: any) {
            console.error("DASHBOARD_CRITICAL_ERROR:", e);
            setError(e.message || "Er ging iets mis bij het ophalen van de data.");
        } finally {
            setLoading(false);
        }
    };

    fetchAllData();
  }, [firestore, user, refreshTrigger, checklistTemplates, appUser, isAdmin]);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto px-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
            <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-slate-100">Mijn FlowZone</h1>
            <p className="text-muted-foreground mt-2 font-medium">Focus op de optimalisaties van vandaag.</p>
        </div>
        <div className="flex items-center gap-1 bg-card/60 p-1.5 rounded-xl self-start border border-white/5 shadow-xl animate-in fade-in slide-in-from-right-4 duration-700 overflow-x-auto no-scrollbar max-w-full backdrop-blur-md">
            <Button 
                variant={viewMode === 'priorityFlow' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('priorityFlow')} 
                className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'priorityFlow' && "bg-white/10 text-white shadow-inner")}
            >
                <Rocket className="mr-2 size-4" /> Focus
            </Button>
            <Button 
                variant={viewMode === 'clientList' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('clientList')} 
                className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'clientList' && "bg-white/10 text-white shadow-inner")}
            >
                <LayoutGrid className="mr-2 size-4" /> Klanten
            </Button>
            <Button 
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('calendar')} 
                className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'calendar' && "bg-white/10 text-white shadow-inner")}
            >
                <CalendarDays className="mr-2 size-4" /> Kalender
            </Button>
        </div>
      </div>

       {loading && <LoadingState />}

       {error && (
           <Card className="bg-red-500/10 border-red-500/20 p-6 flex items-center gap-4 text-red-400">
               <AlertCircle className="size-6" />
               <div>
                   <p className="font-bold">Database Verbindingsfout</p>
                   <p className="text-sm opacity-80">{error}</p>
               </div>
               <Button variant="outline" size="sm" onClick={() => setRefreshTrigger(p => p+1)} className="ml-auto border-red-500/20 hover:bg-red-500/10">Opnieuw Proberen</Button>
           </Card>
       )}

      {!loading && !error && scheduledTasks.length === 0 && (
        <EmptyState />
      )}

      {!loading && !error && (
          <>
            {activeProjects.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1 flex items-center gap-2">
                        <Target className="size-3 text-blue-400" /> Lopende Projecten
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {activeProjects.slice(0, 4).map(project => {
                            const completed = project.milestones.filter(m => m.completed).length;
                            const progress = project.milestones.length > 0 ? (completed / project.milestones.length) * 100 : 0;
                            return (
                                <Link key={project.id} href="/dashboard/projects">
                                    <Card className="glass-card hover:border-primary/30 transition-all p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xs font-bold text-slate-200 truncate pr-2">{project.title}</h3>
                                            <span className="text-[9px] font-black text-blue-400">{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1 bg-slate-900" />
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">
                                            {completed}/{project.milestones.length} mijlpalen afgerond
                                        </p>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="transition-all duration-1000">
                {viewMode === 'priorityFlow' && <PriorityFlowView tasks={scheduledTasks} onStart={handleStartChecklist} isAdmin={isAdmin} />}
                {viewMode === 'clientList' && <ClientListView tasks={scheduledTasks} onStart={handleStartChecklist} isAdmin={isAdmin} />}
                {viewMode === 'calendar' && <CalendarView tasks={scheduledTasks} onStart={handleStartChecklist} isAdmin={isAdmin} />}
            </div>
          </>
      )}

      <ChecklistRunner
        account={activeTask?.childAccount ?? null}
        checklistId={activeTask?.type === 'checklist' ? activeTask.checklist?.checklistId : undefined}
        connectedChecklist={activeTask?.type === 'checklist' ? activeTask.checklist : undefined}
        open={isChecklistRunnerOpen}
        onOpenChange={setIsChecklistRunnerOpen}
        onComplete={handleChecklistComplete}
      />
    </div>
  );
}
