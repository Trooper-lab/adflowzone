

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, where, getDoc, addDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import type { ChildAccount, ParentClient, ConnectedChecklist, ChecklistTemplate, Todo, KpiData, ChecklistRun } from '@/lib/types';
import { format, isPast, isToday, parseISO, getDay, setDay, addWeeks, setDate, addMonths, subDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Goal, Wallet, Briefcase, Pencil, Edit, Trash2, CheckCircle, PlusCircle, X, CalendarIcon, ListChecks, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { KpiPerformanceTableForReport } from '@/components/reports/KpiPerformanceTableForReport';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading account data...</span>
    </div>
  );
}

function AddTodoForm({ parentClient, childAccount, onTodoAdded, onCancel }: { parentClient: ParentClient, childAccount: ChildAccount, onTodoAdded: () => void, onCancel: () => void }) {
    const [newTodoContent, setNewTodoContent] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>();
    const [loading, setLoading] = useState(false);
    const firestore = useFirestore();

    const handleAddTodo = () => {
        if (!firestore || !newTodoContent.trim()) return;
        
        setLoading(true);
        
        const todoCollection = collection(firestore, 'users', parentClient.ownerId, 'todos');

        const newTodo: Omit<Todo, 'id'> = {
            userId: parentClient.ownerId,
            parentClientId: parentClient.id,
            parentClientName: parentClient.clientName,
            childAccountId: childAccount.id,
            childAccountNickname: childAccount.nickname,
            content: newTodoContent,
            completed: false,
            createdAt: new Date().toISOString(),
            ...(dueDate && { dueDate: dueDate.toISOString() })
        };
        
        addDoc(todoCollection, newTodo)
            .then((docRef) => {
                const childAccountRef = doc(firestore, 'parentClients', parentClient.id, 'childAccounts', childAccount.id);
                updateDoc(childAccountRef, {
                    pendingTodoIds: arrayUnion(docRef.id)
                }).catch(e => {
                     console.error("Error updating child account with todo:", e);
                     const permissionError = new FirestorePermissionError({
                        path: childAccountRef.path,
                        operation: 'update',
                        requestResourceData: { pendingTodoIds: arrayUnion(docRef.id) },
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
                
                setNewTodoContent('');
                setDueDate(undefined);
                onTodoAdded();
            })
            .catch((e: any) => {
                console.error("Error creating todo:", e);
                const permissionError = new FirestorePermissionError({
                    path: todoCollection.path,
                    operation: 'create',
                    requestResourceData: newTodo,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div className="space-y-4 pt-2 pb-4">
             <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                <Input 
                    id="todo-content"
                    placeholder="e.g., 'Review new ad creatives'"
                    value={newTodoContent}
                    onChange={(e) => setNewTodoContent(e.target.value)}
                />
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full md:w-[200px] justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : <span>Due date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button onClick={handleAddTodo} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                    Add Task
                </Button>
            </div>
        </div>
    )
}

function TodosSection({ parentClient, childAccount }: { parentClient: ParentClient, childAccount: ChildAccount }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [pendingTodos, setPendingTodos] = useState<Todo[]>([]);
    const [completedTodos, setCompletedTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (!firestore || !user || !childAccount) {
            setLoading(false);
            return;
        }

        const fetchTodos = async () => {
            setLoading(true);
            const ownerId = (childAccount as any).ownerId;

            // Fetch pending todos
            if (childAccount.pendingTodoIds && childAccount.pendingTodoIds.length > 0) {
                const pendingPromises = childAccount.pendingTodoIds.map(id => getDoc(doc(firestore, `users/${ownerId}/todos/${id}`)));
                const pendingSnaps = await Promise.all(pendingPromises);
                setPendingTodos(pendingSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Todo)));
            } else {
                setPendingTodos([]);
            }

            // Fetch completed todos
            if (childAccount.todoRunIds && childAccount.todoRunIds.length > 0) {
                const completedPromises = childAccount.todoRunIds.map(id => getDoc(doc(firestore, `users/${ownerId}/todos/${id}`)));
                const completedSnaps = await Promise.all(completedPromises);
                setCompletedTodos(completedSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Todo)));
            } else {
                setCompletedTodos([]);
            }

            setLoading(false);
        };

        fetchTodos();
    }, [firestore, user, childAccount, refreshTrigger]);
    
    const handleTodoAdded = () => {
        setIsAdding(false);
        setRefreshTrigger(c => c + 1);
    }
    
    if (loading) return <div className="text-center"><Loader2 className="animate-spin" /></div>;

    return (
        <Card>
            <CardHeader className="bg-muted/30">
                <div className="flex items-center justify-between">
                    <CardTitle>Action Items</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setIsAdding(p => !p)}>
                        <PlusCircle />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", isAdding ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}>
                    <AddTodoForm 
                        parentClient={parentClient} 
                        childAccount={childAccount} 
                        onTodoAdded={handleTodoAdded}
                        onCancel={() => setIsAdding(false)}
                     />
                     <Separator className="my-4" />
                </div>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Pending</h4>
                        {pendingTodos.length > 0 ? (
                            <div className="space-y-2">
                                {pendingTodos.map(todo => (
                                    <div key={todo.id} className="flex items-center gap-3 rounded-md border p-3">
                                        <Checkbox id={`todo-${todo.id}`} disabled />
                                        <label htmlFor={`todo-${todo.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{todo.content}</label>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">No pending tasks.</p>}
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">Completed</h4>
                        {completedTodos.length > 0 ? (
                            <div className="space-y-2">
                                {completedTodos.map(todo => (
                                    <div key={todo.id} className="flex items-center gap-3 rounded-md border p-3">
                                        <Checkbox id={`todo-${todo.id}`} checked disabled />
                                        <label htmlFor={`todo-${todo.id}`} className="text-sm font-medium leading-none text-muted-foreground line-through peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{todo.content}</label>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">No completed tasks yet.</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}


export default function ClientAccountDetailPage() {
  const { clientId, accountId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [thirtyDayStats, setThirtyDayStats] = useState({ checklists: 0, comments: 0 });

  const childAccountRef = useMemoFirebase(() => {
    if (!firestore || !clientId || !accountId) return null;
    return doc(firestore, 'parentClients', clientId as string, 'childAccounts', accountId as string);
  }, [firestore, clientId, accountId]);
  const { data: childAccount, loading: childLoading, error } = useDoc(childAccountRef);

  const parentClientRef = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'parentClients', clientId as string);
  }, [firestore, clientId]);
  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef);
  
  const ownerId = childAccount ? (childAccount as any).ownerId : null;

  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !ownerId) return null;
    return query(collection(firestore, 'users', ownerId, 'checklistTemplates'));
  }, [firestore, ownerId]);
  const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);
  
  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !accountId) return null;
    return query(collection(firestore, 'kpiData'), where('childAccountId', '==', accountId));
  }, [firestore, accountId]);
  const { data: kpiData, loading: kpiLoading } = useCollection(kpiQuery);


  useEffect(() => {
    const calculateStats = async () => {
      if (!firestore || !childAccount || !(childAccount as ChildAccount).checklistRunIds?.length) {
        return;
      }
      
      const thirtyDaysAgo = subDays(new Date(), 30);
      const runIds = (childAccount as ChildAccount).checklistRunIds!;

      const runPromises = runIds.map(id => getDoc(doc(firestore, 'checklistRuns', id)));
      const runSnapshots = await Promise.all(runPromises);

      let checklists = 0;
      let comments = 0;

      runSnapshots.forEach(snap => {
        if (snap.exists()) {
          const run = snap.data() as ChecklistRun;
          const completedAt = run.completedAt instanceof Timestamp ? run.completedAt.toDate() : (run.completedAt ? parseISO(run.completedAt as unknown as string) : null);
          
          if (completedAt && completedAt > thirtyDaysAgo) {
            checklists++;
            comments += run.tasks.filter(t => t.notes?.trim()).length;
          }
        }
      });

      setThirtyDayStats({ checklists, comments });
    };

    calculateStats();
  }, [childAccount, firestore]);

  const enrichedConnectedChecklists = useMemo(() => {
    if (!childAccount?.connectedChecklists || !checklistTemplates) return [];
    
    const templatesMap = new Map((checklistTemplates as ChecklistTemplate[]).map(t => [t.id, t]));

    return childAccount.connectedChecklists.map((conn: ConnectedChecklist) => {
        const template = templatesMap.get(conn.checklistId);

        let nextDueDate: Date;
        const lastRun = conn.lastRunAt ? parseISO(conn.lastRunAt) : null;
        const startDate = parseISO(conn.startDate);
        const basisDate = lastRun || new Date();
        
        if (conn.frequency === 'daily') nextDueDate = addDays(basisDate, 1);
        else if (conn.frequency === 'weekly') {
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

        return { ...conn, name: template?.name, nextDueDate };
    }).filter(Boolean).sort((a: any,b: any) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  }, [childAccount, checklistTemplates]);


  if (childLoading || checklistsLoading || kpiLoading || parentLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <div>Error: {error.message}. Make sure you have the correct permissions.</div>;
  }

  if (!childAccount || !parentClient) {
    return <div>Account or client data not found.</div>;
  }

  const account = childAccount as ChildAccount;
  
  const goalLabels: Record<string, string> = {
    lead_generation: 'Lead Generation',
    ecommerce_sales: 'E-commerce Sales',
    brand_awareness: 'Brand Awareness',
    app_installs: 'App Installs',
    other: 'Other'
  };

  const getScheduleText = (checklist: any) => {
        if (!checklist) return '';
        const { frequency, startDate } = checklist;
        const date = parseISO(startDate);
        switch (frequency) {
            case 'daily': return 'Daily';
            case 'one-off': return `One-off on ${format(date, 'PPP')}`;
            case 'weekly': return `Weekly on ${format(date, 'EEEE')}s`;
            case 'monthly': return `Monthly on the ${format(date, 'do')}`;
            default: return 'Custom';
        }
    }


  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">{account.nickname}</h1>
                <p className="text-muted-foreground">({account.googleAdsClientId})</p>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-300">
                    <div className="size-2 rounded-full bg-green-500 mr-2"/>
                    {goalLabels[account.primaryGoal] || 'Other'}
                </Badge>
                <Button variant="default" size="sm" asChild>
                  <Link href={`/portal/${clientId}/edit/${accountId}`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Account
                  </Link>
                </Button>
            </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Monthly Budget</CardTitle>
                    <Wallet className="text-blue-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">€{account.monthlyClickBudget?.toLocaleString() || '0'}</div>
                </CardContent>
            </Card>
            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Mgmt Fee</CardTitle>
                    <Briefcase className="text-blue-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">€{account.managementFee?.amount?.toLocaleString() || '0'}</div>
                </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader>
                  <CardTitle className="text-sm font-medium">30-Day Activity</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-around items-center">
                  <div className="text-center">
                      <ListChecks className="size-8 mx-auto text-blue-400 mb-2" />
                      <div className="text-3xl font-bold">{thirtyDayStats.checklists}</div>
                      <p className="text-xs text-muted-foreground">Checklists Done</p>
                  </div>
                  <div className="text-center">
                      <MessageSquare className="size-8 mx-auto text-green-400 mb-2" />
                      <div className="text-3xl font-bold">{thirtyDayStats.comments}</div>
                      <p className="text-xs text-muted-foreground">Comments Made</p>
                  </div>
              </CardContent>
            </Card>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Connected Checklists</CardTitle>
                        <CardDescription>Recurring tasks for this account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {enrichedConnectedChecklists.length > 0 ? (
                            <ul className="space-y-3">
                                {(enrichedConnectedChecklists as any[]).map((checklist: any, index: number) => (
                                    <li key={index} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-3">
                                             <CheckCircle className="text-green-400 size-4 flex-shrink-0" />
                                             <div>
                                                <p className="font-semibold">{checklist.name}</p>
                                                <p className="text-xs text-muted-foreground">{getScheduleText(checklist)}</p>
                                             </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">{format(checklist.nextDueDate, "MMM dd")}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-10 border-dashed border rounded-md">
                                <p className="text-muted-foreground text-sm">No checklists are connected.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-2">
                 <TodosSection parentClient={parentClient as ParentClient} childAccount={account} />
            </div>
        </div>
        
        <div className="col-span-3">
             <Card>
                <CardHeader>
                    <CardTitle>KPI Performance</CardTitle>
                    <CardDescription>A summary of key performance indicators for this account.</CardDescription>
                </CardHeader>
                <CardContent>
                     {(account.targetKpiValues && account.targetKpiValues.length > 0) && (
                        <div className="mb-8 space-y-4">
                            <h3 className="font-headline text-lg font-semibold">Monthly Key Results</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {account.targetKpiValues.map(kr => {
                                    return (
                                        <Card key={kr.kpi} className="p-4 flex flex-col justify-between bg-slate-900/50">
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">{kr.kpi.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                                <p className="text-2xl font-bold">
                                                    - / <span className="text-lg font-semibold text-muted-foreground">{kr.target.toLocaleString()}</span>
                                                </p>
                                            </div>
                                            <div className="mt-2">
                                                <Progress value={0} className="h-2" />
                                                <p className="text-xs text-right text-muted-foreground mt-1">0% to target</p>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                            <Separator className="!my-6" />
                        </div>
                    )}
                    <KpiPerformanceTableForReport 
                        childAccount={account} 
                        kpiData={kpiData as KpiData[]} 
                        reportDate={new Date()} 
                    />
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

    

    