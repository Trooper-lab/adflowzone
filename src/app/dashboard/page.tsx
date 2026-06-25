'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { 
    collection,
    query, 
    where, 
    getDocs, 
    doc, 
    Timestamp, 
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Loader2, 
    PlayCircle, 
    CalendarClock, 
    CalendarCheck, 
    List, 
    LayoutGrid, 
    ChevronDown, 
    ChevronRight, 
    Check, 
    AlertCircle, 
    Clock, 
    CalendarDays, 
    Rocket, 
    ArrowRight, 
    Zap, 
    ChevronLeft, 
    Target, 
    Activity, 
    Users,
    MessageSquare,
    Calendar,
    Trash2,
    UserPlus,
    ExternalLink,
    TrendingUp
} from 'lucide-react';
import type { ParentClient, ChildAccount, ConnectedChecklist, ChecklistRun, ChecklistTemplate, AppUser, Project, Todo } from '@/lib/types';
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
import ManagementDashboard from '@/components/dashboard/ManagementDashboard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';

type DashboardTask = {
    id: string; 
    type: 'checklist' | 'todo';
    accountNickname: string;
    parentName: string;
    parentClientId: string;
    childAccountId: string;
    title: string; 
    dueDate: Date;
    lastCompleted?: string | null;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'one-off';
    status: 'due' | 'overdue' | 'upcoming' | 'in_progress';
    checklist?: ConnectedChecklist;
    childAccount?: ChildAccount;
    assignedEmployeeName?: string;
    todo?: Todo;
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
       <Button asChild variant="outline" className="mt-4 hover:bg-secondary transition-all">
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
                    <CardHeader className="bg-secondary border-b border-border py-3 px-6">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="size-4" />
                                {clientName}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold border-slate-700 text-slate-500 bg-secondary">
                                {clientTasks.length} {clientTasks.length === 1 ? 'taak' : 'taken'}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {clientTasks.map(task => (
                                <div key={task.id} className="p-4 flex items-center justify-between hover:bg-secondary transition-colors group">
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
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 bg-card border-border">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 bg-card border-border">
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-secondary border border-border rounded-xl overflow-hidden shadow-2xl">
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
                                "min-h-[140px] bg-card p-2 flex flex-col gap-1.5 transition-colors hover:bg-card",
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
                                            <div className="p-3 border-b border-border bg-secondary">
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
                                                                    : "bg-secondary border-border text-slate-200 hover:bg-accent"
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

            <Card className="glass-card border-2 border-border shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative group animate-in fade-in zoom-in-95 duration-700 hover:border-primary/30 transition-all">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:w-2 transition-all duration-300" />
                <CardContent className="p-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="space-y-5 flex-grow">
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">{nextTask.parentName}</p>
                                <h3 className="text-4xl md:text-5xl font-bold font-headline leading-tight text-slate-100">{nextTask.accountNickname}</h3>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4">
                                <Badge variant="secondary" className="bg-secondary text-slate-300 border-none px-3 py-1.5 capitalize font-medium">
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
                <div className="bg-black/20 px-10 py-5 flex justify-between items-center border-t border-border">
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
  const [viewMode, setViewMode] = useState<'priorityFlow' | 'calendar' | 'clientList' | 'management'>('priorityFlow');

  const { toast } = useToast();

  // Todo / Task Detail states
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [clients, setClients] = useState<ParentClient[]>([]);
  const [accounts, setAccounts] = useState<ChildAccount[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [briefingText, setBriefingText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es' || user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [appUser, user?.email]);

  const managerUid = useMemo(() => {
    if (!user) return null;
    return isAdmin ? user.uid : (appUser as AppUser)?.managerId || null;
  }, [isAdmin, user, appUser]);

  // Fetch team members & clients
  useEffect(() => {
    if (!firestore || !user) return;
    const fetchTeamAndClients = async () => {
      try {
        const teamSnap = await getDocs(collection(firestore, 'users'));
        setTeamMembers(teamSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)));

        if (managerUid || isAdmin) {
          const clientsQuery = isAdmin 
            ? collection(firestore, 'parentClients') 
            : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
          const clientsSnap = await getDocs(clientsQuery);
          setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient)));
        }
      } catch (e) {
        console.error("Error fetching dashboard team/clients metadata:", e);
      }
    };
    fetchTeamAndClients();
  }, [firestore, user, isAdmin, managerUid]);

  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const ownerId = isAdmin ? user.uid : (appUser as AppUser)?.managerId;
    if (!ownerId) return null;
    return query(collection(firestore, 'users', ownerId, 'checklistTemplates'));
  }, [firestore, user, isAdmin, appUser]);
  const { data: checklistTemplates } = useCollection(checklistsQuery);


  const handleStartChecklist = (task: DashboardTask) => {
    if (task.type === 'todo' && task.todo) {
      setActiveTodo(task.todo);
      setBriefingText(task.todo.briefing || '');
      setCommentText('');
      setIsTaskDetailOpen(true);
    } else {
      setActiveTask(task);
      setIsChecklistRunnerOpen(true);
    }
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

        if (!managerUid) {
            setLoading(false);
            return;
        }

        try {
            console.log("DASHBOARD_STEP: Start Load");
            
            // 1. Fetch Clients & Employees
            const clientsQuery = isAdmin 
                ? collection(firestore, 'parentClients') 
                : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
            
            const [clientsSnapshot, teamSnapshot] = await Promise.all([
                getDocs(clientsQuery),
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
            setAccounts(allChildAccounts);
            
            const visibleChildAccounts = allChildAccounts.filter(account => {
                if (account.isPaused) return false;
                if (isAdmin) {
                    return true;
                }
                return account.assignedEmployeeId === user.uid;
            });

            // 3. Fetch In Progress Runs, Projects & all Todos safely
            const runsQuery = isAdmin 
                ? query(collection(firestore, 'checklistRuns'), where('status', '==', 'in_progress'))
                : query(collection(firestore, 'checklistRuns'), where('ownerId', '==', user.uid), where('status', '==', 'in_progress'));
                
            const projectsQuery = isAdmin
                ? collection(firestore, 'projects')
                : query(collection(firestore, 'projects'), where('ownerId', '==', user.uid));
                
            const todosQuery = isAdmin
                ? collection(firestore, 'todos')
                : query(collection(firestore, 'todos'), where('ownerId', '==', managerUid));

            const [runsSnapshot, projectsSnapshot, todosSnapshot] = await Promise.all([
                getDocs(runsQuery),
                getDocs(projectsQuery),
                getDocs(todosQuery)
            ]).catch(e => {
                console.error("DASHBOARD_ERROR: Secondary data fetch failed", e);
                return [ { docs: [] }, { docs: [] }, { docs: [] } ] as any[];
            });

            const inProgressRuns = (runsSnapshot.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as ChecklistRun));
            const projects = (projectsSnapshot.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as Project));
            const allTodos = (todosSnapshot.docs || []).map((d: any) => ({ id: d.id, ...d.data() } as Todo));
            
            setTodos(allTodos);
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

            // Process and add open todos/tasks
            allTodos.filter((todo: Todo) => !todo.completed).forEach((todo: Todo) => {
                const dueDate = todo.dueDate ? parseISO(todo.dueDate) : new Date(todo.createdAt);
                
                const status: DashboardTask['status'] = todo.status === 'in_progress'
                    ? 'in_progress'
                    : (isPast(dueDate) && !isToday(dueDate) ? 'overdue' : (isToday(dueDate) ? 'due' : 'upcoming'));

                const childAcc = allChildAccounts.find(a => a.id === todo.childAccountId);
                if (childAcc && childAcc.isPaused) return;

                if (!isAdmin && todo.assigneeId !== user.uid) {
                    // Employees only see their own assigned tasks
                    return;
                }

                allTasks.push({
                    id: `todo-${todo.id}`,
                    type: 'todo',
                    accountNickname: todo.childAccountNickname,
                    parentName: todo.parentClientName,
                    parentClientId: todo.parentClientId,
                    childAccountId: todo.childAccountId,
                    title: todo.content,
                    dueDate: dueDate,
                    status: status,
                    todo: todo,
                    assignedEmployeeName: todo.assigneeName || undefined
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
  }, [firestore, user, refreshTrigger, checklistTemplates, appUser, isAdmin, managerUid]);

  // Invoicing hour sync
  const syncHoursToTimeEntry = async (todo: Todo, hours: number) => {
    if (!firestore || !managerUid) return;
    try {
      const timeEntriesSnap = await getDocs(query(
        collection(firestore, 'timeEntries'),
        where('todoId', '==', todo.id)
      ));
      if (hours > 0) {
        const client = clients.find(c => c.id === todo.parentClientId);
        const hourlyRate = client?.hourlyRate || 0;
        const entryData = {
          ownerId: managerUid,
          parentClientId: todo.parentClientId,
          childAccountId: todo.childAccountId,
          date: todo.completedAt || todo.dueDate || new Date().toISOString(),
          durationMinutes: hours * 60,
          description: `Taak: ${todo.content}`,
          hourlyRateAtTime: hourlyRate,
          todoId: todo.id
        };
        if (!timeEntriesSnap.empty) {
          await updateDoc(doc(firestore, 'timeEntries', timeEntriesSnap.docs[0].id), entryData);
        } else {
          await addDoc(collection(firestore, 'timeEntries'), entryData);
        }
      } else {
        if (!timeEntriesSnap.empty) {
          await deleteDoc(doc(firestore, 'timeEntries', timeEntriesSnap.docs[0].id));
        }
      }
    } catch (e) {
      console.error("Error syncing hours to time entry:", e);
    }
  };

  const handleStatusChange = async (todo: Todo, status: Todo['status']) => {
    if (!firestore || !managerUid || !status) return;
    const completed = status === 'completed';
    const completedAt = completed ? new Date().toISOString() : null;
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { status, completed, completedAt });
      if (todo.parentClientId && todo.childAccountId) {
        const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);
        if (completed) {
          await updateDoc(accountRef, {
            pendingTodoIds: arrayRemove(todo.id),
            todoRunIds: arrayUnion(todo.id)
          }).catch(e => console.warn('accountRef update skipped:', e));
        } else {
          await updateDoc(accountRef, {
            pendingTodoIds: arrayUnion(todo.id),
            todoRunIds: arrayRemove(todo.id)
          }).catch(e => console.warn('accountRef update skipped:', e));
        }
      }
      if (todo.workedHours && todo.workedHours > 0) {
        await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
      }
      setActiveTodo(prev => prev ? { ...prev, status, completed, completedAt: completedAt || undefined } : null);
      toast({ title: 'Status bijgewerkt! ✔️' });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error changing status:", e);
    }
  };

  const handleAssigneeChange = async (todo: Todo, assignee: AppUser | null) => {
    if (!firestore || !managerUid) return;
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      const updateData = {
        assigneeId: assignee?.uid || undefined,
        assigneeName: assignee?.displayName || assignee?.email || undefined,
        assigneePhotoUrl: assignee?.photoURL || undefined
      };
      await updateDoc(todoRef, updateData);
      setActiveTodo(prev => prev ? { ...prev, ...updateData } : null);
      toast({ title: 'Toewijzing bijgewerkt!' });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error updating assignee:", e);
    }
  };

  const handleDueDateChange = async (todo: Todo, date: Date | undefined) => {
    if (!firestore || !managerUid) return;
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { dueDate: date ? date.toISOString() : undefined });
      setActiveTodo(prev => prev ? { ...prev, dueDate: date ? date.toISOString() : undefined } : null);
      toast({ title: 'Uitvoerdatum bijgewerkt!' });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error updating due date:", e);
    }
  };

  const handleWorkedHoursChange = async (todo: Todo, val: string) => {
    if (!firestore || !managerUid) return;
    const hours = val === '' ? 0 : parseFloat(val);
    if (isNaN(hours)) return;
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { workedHours: hours });
      await syncHoursToTimeEntry(todo, hours);
      setActiveTodo(prev => prev ? { ...prev, workedHours: hours } : null);
      toast({ title: 'Gewerkte uren bijgewerkt!' });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error saving worked hours:", e);
    }
  };

  const handleTitleChange = async (todo: Todo, val: string) => {
    if (!firestore || !managerUid || !val.trim() || val === todo.content) return;
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { content: val.trim() });
      setActiveTodo(prev => prev ? { ...prev, content: val.trim() } : null);
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error updating title:", e);
    }
  };

  const handleDeleteTask = async (todo: Todo) => {
    if (!firestore || !managerUid) return;
    // Use todo.userId so admins can delete tasks owned by other users
    const todoRef = doc(firestore, 'todos', todo.id);
    try {
      await deleteDoc(todoRef);
      // Only update the account ref if the todo is actually linked to an account
      if (todo.parentClientId && todo.childAccountId) {
        const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);
        await updateDoc(accountRef, {
          pendingTodoIds: arrayRemove(todo.id),
          todoRunIds: arrayRemove(todo.id)
        }).catch(e => console.warn('Could not update account ref (orphan todo):', e));
      }
      await syncHoursToTimeEntry(todo, 0);
      setIsTaskDetailOpen(false);
      toast({ title: 'Taak verwijderd' });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error deleting todo:", e);
      toast({ title: 'Fout bij verwijderen', description: 'Probeer het opnieuw.', variant: 'destructive' });
    }
  };

  const handleSaveBriefing = async () => {
    if (!firestore || !managerUid || !activeTodo) return;
    setIsSavingDetails(true);
    const todoRef = doc(firestore, 'todos', activeTodo.id);
    try {
      if (briefingText !== (activeTodo.briefing || '')) {
         await updateDoc(todoRef, { briefing: briefingText });
         setActiveTodo(prev => prev ? { ...prev, briefing: briefingText } : null);
         toast({ title: 'Briefing opgeslagen' });
      }
      setRefreshTrigger(p => p + 1);
      handleNextTask();
    } catch (e) {
      console.error("Error saving briefing:", e);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleNextTask = () => {
    if (!activeTodo) return;
    
    // Sort tasks to match flowview
    const activeTasks = [...scheduledTasks].filter(t => t.status === 'due' || t.status === 'overdue' || t.status === 'in_progress');
    const allTasksForNext = activeTasks.length > 0 ? activeTasks : scheduledTasks;
    
    const currentIndex = allTasksForNext.findIndex(t => t.id === `todo-${activeTodo.id}`);
    
    if (currentIndex >= 0 && currentIndex < allTasksForNext.length - 1) {
      const next = allTasksForNext[currentIndex + 1];
      if (next.type === 'todo' && next.todo) {
        setActiveTodo(next.todo);
        setBriefingText(next.todo.briefing || '');
        setCommentText('');
      } else {
        setIsTaskDetailOpen(false);
        // Add a small delay so sheet closes smoothly before opening next
        setTimeout(() => {
           setActiveTask(next);
           setIsChecklistRunnerOpen(true);
        }, 300);
      }
    } else {
      setIsTaskDetailOpen(false);
    }
  };


  const handleAddComment = async () => {
    if (!firestore || !managerUid || !activeTodo || !commentText.trim()) return;
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      userId: user?.uid || '',
      userName: appUser?.displayName || user?.displayName || user?.email || 'Onbekend',
      userPhotoUrl: user?.photoURL || undefined,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };
    const todoRef = doc(firestore, 'todos', activeTodo.id);
    try {
      const updatedComments = [...(activeTodo.comments || []), newComment];
      await updateDoc(todoRef, { comments: updatedComments });
      setActiveTodo(prev => prev ? { ...prev, comments: updatedComments } : null);
      setCommentText('');
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Error adding comment:", e);
    }
  };

  const parseTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:text-blue-300 underline break-all inline-flex items-center gap-1 transition-colors"
          >
            {part} <ExternalLink className="size-3" />
          </a>
        );
      }
      return part;
    });
  };

  const STATUS_OPTIONS = [
    { value: 'todo', label: 'Opstarten', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
    { value: 'in_progress', label: 'Lopend', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20' },
    { value: 'on_hold', label: 'Wachtend', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
    { value: 'completed', label: 'Afgerond', color: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' }
  ] as const;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto px-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
            <h1 className="text-4xl md:text-5xl font-bold font-headline tracking-tight text-slate-100">Mijn FlowZone</h1>
            <p className="text-muted-foreground mt-2 font-medium">Focus op de optimalisaties van vandaag.</p>
        </div>
        <div className="flex items-center gap-1 bg-card p-1.5 rounded-xl self-start border border-border shadow-xl animate-in fade-in slide-in-from-right-4 duration-700 overflow-x-auto no-scrollbar max-w-full">
            <Button 
                variant={viewMode === 'priorityFlow' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('priorityFlow')} 
                className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'priorityFlow' && "bg-accent text-white shadow-inner")}
            >
                <Rocket className="mr-2 size-4" /> Focus
            </Button>
            <Button 
                variant={viewMode === 'clientList' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('clientList')} 
                className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'clientList' && "bg-accent text-white shadow-inner")}
            >
                <LayoutGrid className="mr-2 size-4" /> Klanten
            </Button>
            {isAdmin && (
              <Button 
                  variant={viewMode === 'management' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('management')} 
                  className={cn("h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex-shrink-0", viewMode === 'management' && "bg-accent text-white shadow-inner")}
              >
                  <TrendingUp className="mr-2 size-4" /> Management
              </Button>
            )}
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

      {!loading && !error && scheduledTasks.length === 0 && viewMode !== 'management' && (
        <EmptyState />
      )}

      {!loading && !error && (scheduledTasks.length > 0 || viewMode === 'management') && (
          <>
            {activeProjects.length > 0 && viewMode !== 'management' && (
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
                {viewMode === 'management' && <ManagementDashboard accounts={accounts} clients={clients} todos={todos} teamMembers={teamMembers} />}
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

      <Sheet open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl bg-[#171f33]/95 border-border text-slate-100 p-6 flex flex-col h-full shadow-2xl">
          {activeTodo && (
            <>
              <SheetHeader className="pb-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-black">
                    <span>{activeTodo.parentClientName}</span>
                    <span>/</span>
                    <span className="text-blue-400">{activeTodo.childAccountNickname}</span>
                  </div>
                </div>
                <SheetTitle className="text-2xl font-headline text-slate-100 mt-2 leading-snug">{activeTodo.content}</SheetTitle>
                <SheetDescription className="text-xs text-slate-500">Aangemaakt op {format(parseISO(activeTodo.createdAt), 'dd MMMM yyyy HH:mm', { locale: nl })}</SheetDescription>
              </SheetHeader>

              {/* Scrollable details and comment thread */}
              <div className="flex-grow overflow-y-auto space-y-6 py-6 -mx-6 px-6">
                
                {/* Meta details (Assignee, Status, Date, Worked Hours) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white/[0.02] border border-border text-xs">
                  {/* Status */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Status</span>
                    <div className="pt-0.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[9px] uppercase font-black cursor-pointer px-2 py-0.5 border h-5 select-none",
                              STATUS_OPTIONS.find(o => o.value === (activeTodo.status || 'todo'))?.color
                            )}
                          >
                            {STATUS_OPTIONS.find(o => o.value === (activeTodo.status || 'todo'))?.label || 'Opstarten'}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                          {STATUS_OPTIONS.map((opt) => (
                            <DropdownMenuItem 
                              key={opt.value} 
                              onClick={() => handleStatusChange(activeTodo, opt.value)}
                              className="text-xs uppercase font-bold"
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Uitvoerende</span>
                    <div className="pt-0.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 outline-none select-none max-w-full">
                            <Avatar className="size-5 border border-slate-800">
                              {activeTodo.assigneePhotoUrl && <AvatarImage src={activeTodo.assigneePhotoUrl} />}
                              <AvatarFallback className="text-[7px] font-black uppercase bg-slate-800 text-slate-300">
                                {activeTodo.assigneeName ? activeTodo.assigneeName.substring(0, 2).toUpperCase() : <UserPlus className="size-2.5 opacity-55" />}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-[10px] max-w-[80px]">
                              {activeTodo.assigneeName ? activeTodo.assigneeName.split(' ')[0] : 'Toewijzen'}
                            </span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-[200px] overflow-y-auto">
                          <DropdownMenuItem onClick={() => handleAssigneeChange(activeTodo, null)}>
                            Niemand
                          </DropdownMenuItem>
                          {teamMembers.map(member => (
                            <DropdownMenuItem key={member.uid} onClick={() => handleAssigneeChange(activeTodo, member)} className="flex items-center gap-2">
                              <Avatar className="size-4 border border-slate-800">
                                {member.photoURL && <AvatarImage src={member.photoURL} />}
                                <AvatarFallback className="text-[7px] bg-slate-800">{member.displayName?.substring(0,2) || 'M'}</AvatarFallback>
                              </Avatar>
                              <span>{member.displayName || member.email}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Uitvoerdatum</span>
                    <div className="pt-0.5">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 outline-none select-none font-bold uppercase tracking-wider">
                            <Calendar className="size-3 text-slate-500" />
                            {activeTodo.dueDate ? format(parseISO(activeTodo.dueDate), 'd MMM', { locale: nl }) : 'Kies datum'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="start">
                          <CalendarComponent 
                            mode="single" 
                            selected={activeTodo.dueDate ? parseISO(activeTodo.dueDate) : undefined} 
                            onSelect={date => handleDueDateChange(activeTodo, date)} 
                            initialFocus 
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Worked Hours */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Tijd (uren)</span>
                    <div className="pt-0.5 flex items-center gap-1">
                      <input 
                        type="text" 
                        placeholder="0"
                        defaultValue={activeTodo.workedHours || ''}
                        className="w-10 bg-transparent border-none text-left text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 px-1 py-0.5 rounded text-xs font-mono font-bold"
                        onBlur={e => handleWorkedHoursChange(activeTodo, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <Clock className="size-3 text-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Briefing details */}
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Briefing & Notities</Label>
                  <Textarea 
                    placeholder="Voeg hier gedetailleerde instructies, links of context toe..."
                    value={briefingText}
                    onChange={e => setBriefingText(e.target.value)}
                    className="bg-slate-950/40 border-slate-800 text-slate-200 resize-none h-28 text-sm leading-relaxed"
                  />
                  <div className="flex justify-between items-center">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(activeTodo)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold uppercase tracking-widest text-[9px] h-8"
                    >
                      <Trash2 className="size-3.5 mr-1.5" /> Verwijder Taak
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveBriefing} 
                      disabled={isSavingDetails}
                      className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-[9px] h-8 px-4"
                    >
                      {isSavingDetails ? <Loader2 className="animate-spin size-3" /> : 'Opslaan & Volgende'}
                    </Button>
                  </div>
                </div>

                {/* Comments thread */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Reacties</Label>
                  
                  {/* Comments list */}
                  <div className="space-y-4">
                    {!activeTodo.comments || activeTodo.comments.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">Nog geen reacties geplaatst.</p>
                    ) : (
                      <div className="space-y-3">
                        {activeTodo.comments.map((comment) => (
                          <div key={comment.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-border space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="size-4.5 border border-slate-800">
                                  {comment.userPhotoUrl && <AvatarImage src={comment.userPhotoUrl} />}
                                  <AvatarFallback className="text-[6px] font-black uppercase bg-slate-800 text-slate-400">
                                    {comment.userName.substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-slate-300">{comment.userName}</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-600 uppercase">
                                {format(parseISO(comment.createdAt), 'd MMM HH:mm', { locale: nl })}
                              </span>
                            </div>
                            <p className="text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                              {parseTextWithLinks(comment.text)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Comment composer */}
              <SheetFooter className="pt-4 border-t border-border shrink-0 flex-col sm:flex-col items-stretch gap-3">
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Plaats een reactie (kopieer links hierin)..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="bg-slate-950/40 border-slate-800 text-slate-200 h-20 text-xs resize-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] text-slate-600 font-bold uppercase">Shift+Enter voor nieuwe regel</p>
                    <Button 
                      size="sm" 
                      onClick={handleAddComment} 
                      disabled={!commentText.trim()}
                      className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-[9px] h-8 px-4"
                    >
                      Plaats reactie
                    </Button>
                  </div>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
