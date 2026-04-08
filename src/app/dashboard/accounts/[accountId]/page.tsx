'use client';

import { useMemo, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, updateDoc, arrayUnion, addDoc, collection, query, orderBy, deleteDoc, serverTimestamp, where, arrayRemove, getDoc, getDocs, writeBatch, onSnapshot, Timestamp } from 'firebase/firestore';
import type { ChildAccount, ChecklistTemplate, ConnectedChecklist, KpiData, Todo, ParentClient, TodoRun, MonthlyReport, ChecklistRun, AppUser } from '@/lib/types';
import { format, startOfMonth, addMonths, subMonths, endOfMonth, isPast, isToday, addDays, addWeeks, getDay, setDay, setDate, isAfter, parseISO, subDays } from "date-fns"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link as LinkIcon, CheckCircle, GripVertical, Settings, PlusCircle, Calendar as CalendarIcon, ArrowRight, ChevronLeft, ChevronRight, Trash2, Save, PlayCircle, Briefcase, Pencil, Goal, Wallet, FileText, Edit, ArrowDown, Upload, Book, Check, ArrowLeft, MessageSquare, ListChecks, History, View, X, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ChecklistRunner } from '@/components/checklist/ChecklistRunner';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Progress } from '@/components/ui/progress';
import { ChecklistRunViewer } from '@/components/checklist/ChecklistRunViewer';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading account data...</span>
    </div>
  );
}


function AddChecklistDialog({ childAccountRef, managerUid }: { childAccountRef: any, managerUid: string | null }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [open, setOpen] = useState(false);
    const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | undefined>(new Date());
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'one-off' | undefined>();
    const [dayOfWeek, setDayOfWeek] = useState<string | undefined>();
    const [dayOfMonth, setDayOfMonth] = useState<string | undefined>();
    const { toast } = useToast();

    const checklistsQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
    }, [firestore, managerUid]);
    const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);


    const handleFrequencyChange = (value: 'daily' | 'weekly' | 'monthly' | 'one-off') => {
        setFrequency(value);
        setStartDate(new Date());
        setDayOfWeek(undefined);
        setDayOfMonth(undefined);
    }
    
    const getNextDate = (freq: typeof frequency, start: Date, dayValue?: string): Date => {
        const now = new Date();
        let nextDate = start;

        if (freq === 'weekly' && dayValue) {
            const desiredDay = parseInt(dayValue); // 0=Sun, 1=Mon...
            nextDate = setDay(now, desiredDay, { weekStartsOn: 1 });
            if (isPast(nextDate) && !isToday(nextDate)) {
                 nextDate = addWeeks(nextDate, 1);
            }
        } else if (freq === 'monthly' && dayValue) {
            const desiredDate = parseInt(dayValue);
            nextDate = setDate(now, desiredDate);
            if (isPast(nextDate) && !isToday(nextDate)) {
                nextDate = addMonths(nextDate, 1);
            }
        }
        
        return nextDate;
    }


    const handleAddChecklist = async () => {
        if (!childAccountRef || !selectedChecklistId || !frequency) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a checklist and frequency.',
            });
            return;
        }

        let finalStartDate: Date | undefined = startDate;

        if (frequency === 'weekly' && !dayOfWeek) {
            toast({ variant: 'destructive', title: 'Missing Day', description: 'Please select a day of the week.' });
            return;
        }
        if (frequency === 'monthly' && !dayOfMonth) {
            toast({ variant: 'destructive', title: 'Missing Day', description: 'Please select a day of the month.' });
            return;
        }
        
        if (frequency === 'weekly' || frequency === 'monthly') {
            finalStartDate = getNextDate(frequency, startDate!, dayOfWeek || dayOfMonth);
        }

        if (!finalStartDate) {
             toast({ variant: 'destructive', title: 'Invalid Date', description: 'Could not determine a valid start date.' });
            return;
        }

        const newConnectedChecklist: ConnectedChecklist = {
            checklistId: selectedChecklistId,
            startDate: finalStartDate.toISOString(),
            frequency: frequency,
        };
        
        updateDoc(childAccountRef, {
            connectedChecklists: arrayUnion(newConnectedChecklist)
        }).then(() => {
            toast({
                title: 'Checklist Added',
                description: 'The new checklist has been connected to this account.',
            });
            setOpen(false); // Close the dialog on success
        }).catch((e) => {
            console.error("Error adding checklist:", e);
            const permissionError = new FirestorePermissionError({
                path: childAccountRef.path,
                operation: 'update',
                requestResourceData: { connectedChecklists: arrayUnion(newConnectedChecklist) },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle />
                    Connect New
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Checklist</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="checklist-select">Checklist Template</Label>
                        <Select onValueChange={setSelectedChecklistId}>
                            <SelectTrigger id="checklist-select">
                                <SelectValue placeholder={checklistsLoading ? "Loading..." : "Select a checklist..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {checklistTemplates && (checklistTemplates as ChecklistTemplate[]).map((checklist) => (
                                    <SelectItem key={checklist.id} value={checklist.id}>
                                        {checklist.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="frequency-select">Frequency</Label>
                        <Select onValueChange={(value) => handleFrequencyChange(value as any)}>
                            <SelectTrigger id="frequency-select">
                                <SelectValue placeholder="Select frequency..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="one-off">One-off</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    { (frequency === 'daily' || frequency === 'one-off') && (
                        <div className="space-y-2">
                            <Label htmlFor="start-date">Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !startDate && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                    
                    { frequency === 'weekly' && (
                         <div className="space-y-2">
                            <Label htmlFor="day-of-week-select">Day of the Week</Label>
                            <Select onValueChange={setDayOfWeek}>
                                <SelectTrigger id="day-of-week-select">
                                    <SelectValue placeholder="Select a day..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Monday</SelectItem>
                                    <SelectItem value="2">Tuesday</SelectItem>
                                    <SelectItem value="3">Wednesday</SelectItem>
                                    <SelectItem value="4">Thursday</SelectItem>
                                    <SelectItem value="5">Friday</SelectItem>
                                    <SelectItem value="6">Saturday</SelectItem>
                                    <SelectItem value="0">Sunday</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    
                     { frequency === 'monthly' && (
                         <div className="space-y-2">
                            <Label htmlFor="day-of-month-select">Day of the Month</Label>
                            <Select onValueChange={setDayOfMonth}>
                                <SelectTrigger id="day-of-month-select">
                                    <SelectValue placeholder="Select a day..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 28}, (_, i) => i + 1).map(day => (
                                        <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddChecklist}>Add Checklist</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const KpiPerformanceTable = ({ childAccount, onSave, isSaving, onRefetchNeeded }: { childAccount: ChildAccount, onSave: (data: Record<string, Record<string, number | string>>) => Promise<void>, isSaving: boolean, onRefetchNeeded: () => void }) => {
    const firestore = useFirestore();
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [tableData, setTableData] = useState<Record<string, Record<string, number | string>>>({});
    const [editMonth, setEditMonth] = useState<string | null>(null);
    const [visibleMonths, setVisibleMonths] = useState(6);

    const months = useMemo(() => {
        const today = new Date();
        return Array.from({ length: visibleMonths }, (_, i) => startOfMonth(subMonths(today, i)));
    }, [visibleMonths]);

    useEffect(() => {
        const fetchKpiData = async () => {
            if (!firestore || !user || !childAccount.kpiDataIds || childAccount.kpiDataIds.length === 0) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const kpiPromises = childAccount.kpiDataIds.map(kpiId => getDoc(doc(firestore, 'kpiData', kpiId)));
                const kpiSnaps = await Promise.all(kpiPromises);
                const fetchedKpis = kpiSnaps
                    .filter(snap => snap.exists())
                    .map(snap => ({ id: snap.id, ...snap.data() } as KpiData));

                const dataByMonth: Record<string, Record<string, number | string>> = {};
                fetchedKpis.forEach(kpiDoc => {
                    const monthKey = format(new Date(kpiDoc.startDate), 'yyyy-MM');
                    dataByMonth[monthKey] = kpiDoc.kpiValues;
                });
                
                setTableData(dataByMonth);

            } catch (e) {
                console.error("Error fetching kpi data", e);
            } finally {
                setLoading(false);
            }
        };

        fetchKpiData();
    }, [firestore, user, childAccount.kpiDataIds, onRefetchNeeded]);

    const handleValueChange = (month: string, kpi: string, value: string) => {
        const isInteger = ['clicks', 'impressions', 'conversions'].includes(kpi);
        setTableData(prev => ({
            ...prev,
            [month]: {
                ...prev[month],
                [kpi]: isInteger ? (parseInt(value, 10) || 0).toString() : value,
            },
        }));
    };

    const handleSaveMonth = (monthKey: string) => {
        onSave({[monthKey]: tableData[monthKey]}).then(() => {
            setEditMonth(null);
        });
    }

    if (loading) {
        return <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /> <span className="ml-2">Loading KPI data...</span></div>
    }

    return (
        <div className="space-y-2">
            {months.map(monthDate => {
                const monthKey = format(monthDate, 'yyyy-MM');
                const monthData = tableData[monthKey] || {};
                const isEditing = editMonth === monthKey;

                const calculateValue = (kpi: string) => {
                    const spend = parseFloat(monthData['spend'] as string);
                    const clicks = parseInt(monthData['clicks'] as string);
                    const impressions = parseInt(monthData['impressions'] as string);
                    const conversions = parseInt(monthData['conversions'] as string);
                    const conversionValue = parseFloat(monthData['conversion_value'] as string);

                    switch (kpi) {
                        case 'cpc':
                            return clicks > 0 ? `€${(spend / clicks).toFixed(2)}` : '-';
                        case 'ctr':
                            return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-';
                        case 'cpl':
                            return conversions > 0 ? `€${(spend / conversions).toFixed(2)}` : '-';
                         case 'roas':
                            return spend > 0 ? `${(conversionValue / spend).toFixed(2)}x` : '-';
                        default:
                            return monthData[kpi] ?? '';
                    }
                };

                const isCurrency = (kpi: string) => ['spend', 'conversion_value'].includes(kpi);
                const isCalculated = (kpi: string) => ['cpc', 'ctr', 'cpl', 'roas'].includes(kpi);
                const isInteger = (kpi: string) => ['clicks', 'impressions', 'conversions'].includes(kpi);

                return (
                    <div key={monthKey} className="grid grid-cols-[120px_1fr_80px] items-center gap-4 p-2 rounded-lg hover:bg-slate-800/50">
                        <div className="font-medium text-muted-foreground flex items-center gap-2">
                           {isToday(monthDate) && <div className="size-2 rounded-full bg-blue-500" />}
                           {format(monthDate, 'MMM yyyy')}
                        </div>
                        <div className="grid grid-cols-6 gap-x-4">
                             {childAccount.kpisToTrack.map(kpi => (
                                <div key={kpi} className="space-y-1">
                                    {isEditing ? (
                                        isCalculated(kpi) ? (
                                            <div className="text-sm h-8 flex items-center px-3 text-muted-foreground">
                                                {calculateValue(kpi)}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {isCurrency(kpi) && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>}
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    value={monthData[kpi] as string || ''}
                                                    onChange={(e) => handleValueChange(monthKey, kpi, e.target.value)}
                                                    className={cn("text-sm h-8 no-spinners bg-slate-900/50", isCurrency(kpi) && "pl-6")}
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className={cn("text-sm h-8 flex items-center px-3", !monthData[kpi] && 'text-muted-foreground')}>
                                            {calculateValue(kpi)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="text-right">
                           {isEditing ? (
                               <Button size="icon" variant="ghost" onClick={() => handleSaveMonth(monthKey)} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Save className="text-blue-400" />}
                                </Button>
                           ) : (
                                <Button size="icon" variant="ghost" onClick={() => setEditMonth(monthKey)}>
                                    <Pencil />
                                </Button>
                           )}
                        </div>
                    </div>
                );
            })}
             <div className="text-center pt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setVisibleMonths(p => p + 6)}>
                    Show earlier months <ArrowDown className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
};

function EditTodoDialog({ todo, open, onOpenChange, onSaved }: { todo: Todo, open: boolean, onOpenChange: (open: boolean) => void, onSaved: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [content, setContent] = useState(todo.content);
    const [dueDate, setDueDate] = useState<Date | undefined>(todo.dueDate ? parseISO(todo.dueDate) : undefined);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setContent(todo.content);
        setDueDate(todo.dueDate ? parseISO(todo.dueDate) : undefined);
    }, [todo]);
    
    const handleSave = async () => {
        if (!firestore || !user || !content.trim()) return;
        setLoading(true);

        const todoRef = doc(firestore, 'users', user.uid, 'todos', todo.id);
        
        try {
            await updateDoc(todoRef, {
                content: content,
                dueDate: dueDate ? dueDate.toISOString() : null,
            });
            toast({ title: "Todo updated!" });
            onSaved();
            onOpenChange(false);
        } catch (e: any) {
            console.error("Error updating todo:", e);
             const permissionError = new FirestorePermissionError({
                path: todoRef.path,
                operation: 'update',
                requestResourceData: { content, dueDate: dueDate?.toISOString() },
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Todo</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="todo-content">Content</Label>
                        <Input id="todo-content" value={content} onChange={e => setContent(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="todo-due-date">Due Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn( "w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="animate-spin mr-2" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function TodosCard({ parentClient, childAccount, childAccountRef, onRefetchNeeded }: { parentClient: ParentClient, childAccount: ChildAccount, childAccountRef: any, onRefetchNeeded: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [newTodoContent, setNewTodoContent] = useState('');
    const [newTodoDueDate, setNewTodoDueDate] = useState<Date | undefined>();
    const [pendingTodos, setPendingTodos] = useState<Todo[]>([]);
    const [completedTodos, setCompletedTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

    
    useEffect(() => {
        if (!firestore || !user?.uid) {
            setLoading(false);
            return;
        }

        const fetchTodos = async () => {
            setLoading(true);

            if (childAccount.pendingTodoIds && childAccount.pendingTodoIds.length > 0) {
                const pendingPromises = childAccount.pendingTodoIds.map(id => getDoc(doc(firestore, `users/${user.uid}/todos/${id}`)));
                const pendingSnaps = await Promise.all(pendingPromises);
                const fetchedPending = pendingSnaps
                    .filter(snap => snap.exists() && !snap.data().completed)
                    .map(snap => ({ id: snap.id, ...snap.data() } as Todo));
                setPendingTodos(fetchedPending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
            } else {
                 setPendingTodos([]);
            }
            
            if (childAccount.todoRunIds && childAccount.todoRunIds.length > 0) {
                const completedPromises = childAccount.todoRunIds.map(id => getDoc(doc(firestore, `users/${user.uid}/todos/${id}`)));
                const completedSnaps = await Promise.all(completedPromises);
                const fetchedCompleted = completedSnaps
                    .filter(snap => snap.exists() && snap.data().completed)
                    .map(snap => ({ id: snap.id, ...snap.data() } as Todo))
                    .sort((a, b) => {
                        const parseCompletedAt = (val: any) => {
                            if (!val) return new Date(0);
                            if (typeof val === 'string') return parseISO(val);
                            if (val && typeof val === 'object' && val.toDate) return val.toDate();
                            return new Date(val);
                        };
                        const dateA = parseCompletedAt(a.completedAt);
                        const dateB = parseCompletedAt(b.completedAt);
                        return dateB.getTime() - dateA.getTime();
                    });
                setCompletedTodos(fetchedCompleted.slice(0, 3));
            } else {
                setCompletedTodos([]);
            }

            setLoading(false);
        };

        fetchTodos();
    }, [firestore, user, childAccount.id, childAccount.pendingTodoIds, childAccount.todoRunIds, onRefetchNeeded]);

    const handleAddTodo = () => {
        if (!firestore || !user || !newTodoContent.trim()) return;
        
        const todoCollection = collection(firestore, 'users', user.uid, 'todos');
        const now = new Date();

        const newTodo: Omit<Todo, 'id'> = {
            userId: user.uid,
            parentClientId: parentClient.id,
            parentClientName: parentClient.clientName,
            childAccountId: childAccount.id,
            childAccountNickname: childAccount.nickname,
            content: newTodoContent,
            completed: false,
            createdAt: now.toISOString(),
            dueDate: (newTodoDueDate || now).toISOString()
        };
        
        addDoc(todoCollection, newTodo)
            .then((docRef) => {
                if (childAccountRef) {
                    updateDoc(childAccountRef, {
                        pendingTodoIds: arrayUnion(docRef.id)
                    }).then(onRefetchNeeded).catch((e) => {
                        console.error("Error updating child account with todo:", e);
                         const permissionError = new FirestorePermissionError({
                            path: childAccountRef.path,
                            operation: 'update',
                            requestResourceData: { pendingTodoIds: arrayUnion(docRef.id) },
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    });
                }
                setNewTodoContent('');
                setNewTodoDueDate(undefined);
            })
            .catch((e: any) => {
                console.error("Error creating todo:", e);
                const permissionError = new FirestorePermissionError({
                    path: todoCollection.path,
                    operation: 'create',
                    requestResourceData: newTodo,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleToggleTodo = (todo: Todo) => {
        if (!firestore || !user || !childAccountRef) return;
        const todoRef = doc(firestore, 'users', user.uid, 'todos', todo.id);
        
        updateDoc(todoRef, { completed: true, completedAt: new Date().toISOString() })
            .then(() => {
                 updateDoc(childAccountRef, {
                    pendingTodoIds: arrayRemove(todo.id),
                    todoRunIds: arrayUnion(todo.id) 
                }).then(onRefetchNeeded)
            })
            .catch(e => {
                console.error("Error toggling todo:", e);
                const permissionError = new FirestorePermissionError({
                    path: todoRef.path,
                    operation: 'update',
                    requestResourceData: { completed: true },
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };
    
    const handleDeleteTodo = async (todo: Todo) => {
        if (!firestore || !user || !childAccountRef) return;
        const todoRef = doc(firestore, 'users', user.uid, 'todos', todo.id);
        
        try {
            await deleteDoc(todoRef);
            
            const updateField = todo.completed ? 'todoRunIds' : 'pendingTodoIds';
            await updateDoc(childAccountRef, {
                [updateField]: arrayRemove(todo.id)
            });
            onRefetchNeeded();
        } catch (e) {
            console.error("Error deleting todo:", e);
            const permissionError = new FirestorePermissionError({ path: todoRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }

    return (
        <Card className="bg-card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Book className="text-blue-400" /> Quick Notes & Todos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 {loading && <div className="text-sm text-muted-foreground flex items-center justify-center py-4"><Loader2 className="mr-2 animate-spin" /></div>}

                 {!loading && (
                     <>
                        <div className="space-y-3">
                             <h4 className="font-semibold text-sm">Pending</h4>
                            {pendingTodos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending todos.</p>}
                            {pendingTodos.map((todo: any) => (
                                <div key={todo.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800/50 group">
                                    <Checkbox 
                                        id={`todo-${todo.id}`} 
                                        checked={false}
                                        onCheckedChange={() => handleToggleTodo(todo)}
                                    />
                                    <div className="flex-grow">
                                        <Label htmlFor={`todo-${todo.id}`} className="cursor-pointer">
                                            {todo.content}
                                        </Label>
                                         <p className="text-xs text-muted-foreground">{todo.dueDate && format(parseISO(todo.dueDate), 'MMM dd')}</p>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTodo(todo)}><Pencil className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                                                <AlertDialogDescription>This will permanently delete this todo. This action cannot be undone.</AlertDialogDescription>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTodo(todo)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add a reminder..."
                                value={newTodoContent}
                                onChange={(e) => setNewTodoContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                                className="bg-slate-900/50"
                            />
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[120px] justify-start text-left font-normal",
                                        !newTodoDueDate && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newTodoDueDate ? format(newTodoDueDate, "dd/MM") : <span>Due date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                    mode="single"
                                    selected={newTodoDueDate}
                                    onSelect={setNewTodoDueDate}
                                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button size="icon" variant="ghost" onClick={handleAddTodo}>
                                <PlusCircle />
                            </Button>
                        </div>
                        {completedTodos.length > 0 && (
                            <div className="space-y-3 pt-4">
                                <Separator />
                                <h4 className="font-semibold text-sm">Recently Completed</h4>
                                {completedTodos.map((todo) => (
                                     <div key={todo.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800/50 group">
                                        <Checkbox 
                                            id={`todo-${todo.id}`} 
                                            checked={true}
                                            disabled
                                        />
                                        <div className="flex-grow">
                                            <Label htmlFor={`todo-${todo.id}`} className="text-muted-foreground line-through">
                                                {todo.content}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Completed: {todo.completedAt ? (() => {
                                                    try {
                                                        const date = typeof todo.completedAt === 'string' 
                                                            ? parseISO(todo.completedAt) 
                                                            : (todo.completedAt && typeof todo.completedAt === 'object' && (todo.completedAt as any).toDate)
                                                                ? (todo.completedAt as any).toDate()
                                                                : new Date(todo.completedAt);
                                                        return format(date, 'MMM dd');
                                                    } catch (e) {
                                                        return 'Invalid date';
                                                    }
                                                })() : ''}
                                            </p>
                                        </div>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                                                <AlertDialogDescription>This will permanently delete this todo record. This action cannot be undone.</AlertDialogDescription>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTodo(todo)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        )}
                     </>
                 )}
            </CardContent>
             {editingTodo && (
                <EditTodoDialog 
                    todo={editingTodo} 
                    open={!!editingTodo} 
                    onOpenChange={() => setEditingTodo(null)}
                    onSaved={onRefetchNeeded}
                />
            )}
        </Card>
    )
}

function ReportsCard({ accountId }: { accountId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !accountId) return null;
    return query(
      collection(firestore, 'reports'),
      where('ownerId', '==', user.uid),
      where('childAccountId', '==', accountId)
    );
  }, [firestore, user, accountId]);
  
  const { data: fetchedReports, loading: reportsLoading, error: reportsError } = useCollection(reportsQuery);

  useEffect(() => {
    if (fetchedReports) {
      const sortedReports = (fetchedReports as MonthlyReport[]).map(report => {
        const generatedAt = report.generatedAt;
        if (generatedAt && typeof generatedAt === 'object' && 'seconds' in generatedAt) {
            return { ...report, generatedAt: (generatedAt as unknown as Timestamp).toDate().toISOString() };
        }
        return report;
      }).sort((a, b) => b.period.localeCompare(a.period));
      setReports(sortedReports);
    }
  }, [fetchedReports]);
  

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="text-blue-400" /> Generated Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {reportsLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            <Loader2 className="mr-2 animate-spin" />
            Loading reports...
          </div>
        )}
        {!reportsLoading && reports.length === 0 && (
          <div className="text-center py-10">
             <FileText className="mx-auto size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground mt-4">
              No reports generated yet.
            </p>
            <Button variant="link" asChild>
              <Link href="/dashboard/reports">Generate First Report</Link>
            </Button>
          </div>
        )}
        {!reportsLoading && reports.length > 0 && (
          <div className="space-y-2">
            {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-800/50">
                    <div>
                        <p className="font-medium">
                            {format(parseISO(report.period + '-02'), 'MMMM yyyy')} Report
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Generated on {report.generatedAt ? format(parseISO(report.generatedAt), 'PPP') : 'N/A'}
                        </p>
                    </div>
                     <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/reports/${report.id}`}>
                        View Report
                      </Link>
                    </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type EnrichedChecklistRun = ChecklistRun & { name: string; };

function CompletedChecklists({ account, managerUid }: { account: ChildAccount, managerUid: string | null }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [runs, setRuns] = useState<EnrichedChecklistRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingRunId, setViewingRunId] = useState<string | null>(null);

    const checklistsQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
    }, [firestore, managerUid]);
    const { data: checklistTemplates } = useCollection(checklistsQuery);

    useEffect(() => {
        const fetchRuns = async () => {
            if (!firestore || !account.checklistRunIds?.length || !checklistTemplates) {
                setLoading(false);
                return;
            }
            setLoading(true);

            const templatesMap = new Map((checklistTemplates as ChecklistTemplate[]).map(t => [t.id, t.name]));

            const runPromises = account.checklistRunIds.map(id => getDoc(doc(firestore, 'checklistRuns', id)));
            const runSnapshots = await Promise.all(runPromises);

            const fetchedRuns = runSnapshots
                .filter(snap => snap.exists())
                .map(snap => {
                     const data = snap.data() as ChecklistRun;
                     let completedAt: Date | null = null;
                         if (data.completedAt) {
                             if (typeof data.completedAt === 'string') {
                                completedAt = parseISO(data.completedAt);
                             } else if (data.completedAt && typeof data.completedAt === 'object' && 'toDate' in data.completedAt) {
                                completedAt = (data.completedAt as any).toDate();
                             }
                         }
                    return {
                        ...data,
                        id: snap.id,
                        completedAt,
                        name: templatesMap.get(data.checklistId) || 'Unknown Checklist'
                    } as EnrichedChecklistRun;
                })
                .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
            
            setRuns(fetchedRuns);
            setLoading(false);
        };

        fetchRuns();
    }, [firestore, account.checklistRunIds, checklistTemplates]);

    if (loading) {
        return <div className="text-center py-4"><Loader2 className="animate-spin" /></div>;
    }
    
    if (runs.length === 0) {
        return (
             <div className="text-center py-10 border-dashed border rounded-md border-slate-700">
                <p className="text-muted-foreground">No checklists have been completed for this account yet.</p>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-2">
                {runs.map(run => (
                    <div key={run.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-3 rounded-md hover:bg-slate-800/50">
                        <div>
                            <p className="font-semibold">{run.name}</p>
                            <p className="text-sm text-muted-foreground">Completed: {run.completedAt ? format(run.completedAt, 'PPP') : 'N/A'}</p>
                        </div>
                         <Badge variant={run.status === 'complete' ? 'default' : 'secondary'} className={cn(run.status === 'complete' && 'bg-green-500/20 text-green-300')}>{run.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => setViewingRunId(run.id)}>
                            <View className="mr-2" />
                            View Run
                        </Button>
                    </div>
                ))}
            </div>
            <ChecklistRunViewer runId={viewingRunId} open={!!viewingRunId} onOpenChange={(isOpen) => !isOpen && setViewingRunId(null)} />
        </>
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
  const [thirtyDayStats, setThirtyDayStats] = useState({ checklists: 0, comments: 0 });

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
  const { data: childAccount, loading: childLoading, error, refetch: refetchChildAccount } = useDoc(childAccountRef);

  const assignedEmployeeId = (childAccount as ChildAccount)?.assignedEmployeeId;
  const isAccountLoaded = !childLoading && !!childAccount;

  // Access control for employees
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
          const completedAt = (run.completedAt && typeof run.completedAt === 'object' && 'toDate' in run.completedAt) ? (run.completedAt as any).toDate() : (run.completedAt ? parseISO(run.completedAt as unknown as string) : null);
          
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
    if (!childAccountRef) return;
    
    try {
        // We need to send the exact object to arrayRemove. conn was enriched,
        // so we pick out the core properties.
        const originalConn = {
            checklistId: conn.checklistId,
            startDate: conn.startDate,
            frequency: conn.frequency,
            ...(conn.lastRunAt && { lastRunAt: conn.lastRunAt })
        };

        await updateDoc(childAccountRef, {
            connectedChecklists: arrayRemove(originalConn)
        });
        toast({ title: 'Checklist ontkoppeld', description: 'De checklist is verwijderd van dit account.' });
        refetchChildAccount();
    } catch (e) {
        console.error("Error disconnecting checklist:", e);
        const permissionError = new FirestorePermissionError({
            path: childAccountRef.path,
            operation: 'update',
            requestResourceData: { connectedChecklists: 'arrayRemove' },
        });
        errorEmitter.emit('permission-error', permissionError);
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
        
        if (conn.frequency === 'one-off' && lastRun) {
            return null;
        }

        const basisDate = lastRun || new Date();
        
        if (conn.frequency === 'daily') {
            nextDueDate = addDays(basisDate, 1);
        } else if (conn.frequency === 'weekly') {
            const scheduledDay = getDay(startDate);
            let nextInstance = setDay(basisDate, scheduledDay, { weekStartsOn: 1 });
            if (isPast(nextInstance) && !isToday(nextInstance)) {
                nextInstance = addWeeks(nextInstance, 1);
            }
            nextDueDate = nextInstance;
        } else if (conn.frequency === 'monthly') {
            const scheduledDate = startDate.getDate();
            let nextInstance = setDay(basisDate, scheduledDate);
             if (isPast(nextInstance) && !isToday(nextInstance)) {
                 nextInstance = addMonths(nextInstance, 1);
            }
            nextDueDate = nextInstance;
        } else { // one-off and not yet run
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
            case 'one-off': return `One-off on ${format(date, 'PPP')}`;
            case 'weekly': return `Weekly on ${format(date, 'EEEE')}s`;
            case 'monthly': return `Monthly on the ${format(date, 'do')}`;
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
                if (!isNaN(value)) {
                     numericKpiValues[kpi] = value;
                }
            }
            
            const existingDoc = existingKpiDocs.find(d => d.startDate === startOfMonthISO);
            
            if (existingDoc) {
                const docRef = doc(firestore, 'kpiData', existingDoc.id);
                batch.update(docRef, { kpiValues: numericKpiValues });
            } else if (Object.keys(numericKpiValues).length > 0) {
                 const kpiDataCollection = collection(firestore, 'kpiData');
                 const newDocRef = doc(kpiDataCollection); 
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
            batch.update(childAccountRef, {
                kpiDataIds: arrayUnion(...newKpiDataIds)
            });
        }
        
        await batch.commit();

        toast({ title: 'KPI Data Saved', description: 'All changes have been saved successfully.' });
        if (newKpiDataIds.length > 0) {
            refetchChildAccount();
            setRefetchTrigger(prev => prev + 1);
        }

    } catch(e) {
         console.error("Error saving KPI data in batch", e);
         toast({ variant: 'destructive', title: 'Error Saving', description: 'Could not save all KPI data.'});
    } finally {
        setIsSaving(false);
    }
  };


  const [assignedEmployee, setAssignedEmployee] = useState<AppUser | null>(null);

  useEffect(() => {
    if (assignedEmployeeId && firestore) {
        getDoc(doc(firestore, 'users', assignedEmployeeId)).then(snap => {
            if (snap.exists()) {
                setAssignedEmployee(snap.data() as AppUser);
            }
        });
    }
  }, [assignedEmployeeId, firestore]);

  if (childLoading || parentLoading || checklistsLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <div>Error: {error.message}. Make sure you have the correct permissions.</div>;
  }

  if (!childAccount || !parentClient) {
    return <div>Account not found.</div>;
  }

  const account = childAccount as ChildAccount;
  const client = parentClient as ParentClient;
  
  const goalLabels: Record<string, string> = {
    lead_generation: 'Lead Generation',
    ecommerce_sales: 'E-commerce Sales',
    brand_awareness: 'Brand Awareness',
    app_installs: 'App Installs',
    other: 'Other'
  };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">{account.nickname}</h1>
                <p className="text-muted-foreground">({account.googleAdsClientId})</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-300">
                <div className="size-2 rounded-full bg-green-500 mr-2"/>
                {goalLabels[account.primaryGoal] || 'Other'}
            </Badge>
            {assignedEmployee && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border-blue-500/50">
                    <Users className="size-3 mr-2" />
                    {assignedEmployee.displayName || assignedEmployee.email}
                </Badge>
            )}
            <Button variant="default" size="sm" asChild>
              <Link href={`/dashboard/accounts/${accountId}/edit?parent=${parentClientId}`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Config
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

      <div className="grid grid-cols-3 gap-8 items-start">
        <div className="col-span-3 lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Completed Checklists</CardTitle>
                </CardHeader>
                <CardContent>
                    <CompletedChecklists account={account} managerUid={managerUid} />
                </CardContent>
            </Card>

            <Card className="bg-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Goal className="text-blue-400" /> KPI Performance</CardTitle>
                            <CardDescription>Track key metrics manually for client reporting.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                            <Upload className="mr-2" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-[120px_1fr_80px] items-center gap-4 px-2 py-1 text-xs font-semibold text-muted-foreground">
                        <span>PERIOD</span>
                        <div className="grid grid-cols-6 gap-x-4">
                            {account.kpisToTrack.map(kpi => <span key={kpi} className="uppercase">{kpi.length > 5 ? kpi.substring(0,4) : kpi }</span>)}
                        </div>
                        <span className="text-right">ACTION</span>
                    </div>
                     <KpiPerformanceTable 
                        childAccount={account} 
                        onSave={handleSaveKpiData}
                        isSaving={isSaving}
                        onRefetchNeeded={() => setRefetchTrigger(p => p + 1)}
                    />
                </CardContent>
            </Card>

            <Card className="bg-card">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><CheckCircle className="text-blue-400" /> Recurring Checklists</CardTitle>
                        {childAccountRef && managerUid && <AddChecklistDialog childAccountRef={childAccountRef} managerUid={managerUid} />}
                    </div>
                </CardHeader>
                <CardContent>
                    {checklistsLoading && <div><Loader2 className="animate-spin" /> Loading checklists...</div>}
                    {!checklistsLoading && enrichedConnectedChecklists.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-4">
                            {enrichedConnectedChecklists.map((checklist: any, index: number) => (
                                <Card key={index} className="bg-slate-900/50">
                                    <CardHeader>
                                        <div className="flex items-start justify-between w-full">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <CheckCircle className="text-green-400" />
                                                    {checklist.name}
                                                </CardTitle>
                                                <CardDescription>{getScheduleText(checklist)}</CardDescription>
                                            </div>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Zeker weten?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Dit zal de checklist "{checklist.name}" ontkoppelen van dit account. 
                                                            Eerdere voltooide runs blijven wel bewaard in de geschiedenis.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDisconnectChecklist(checklist)}>Ontkoppelen</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardHeader>
                                    <CardFooter className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs text-muted-foreground">NEXT DUE</p>
                                            <p className="font-semibold">{format(checklist.nextDueDate, "MMM dd, yyyy")}</p>
                                        </div>
                                        <Button variant="secondary" onClick={() => handleStartChecklist(checklist)}>Start Now</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 border-dashed border rounded-md border-slate-700">
                            <p className="text-muted-foreground">No checklists connected.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="col-span-3 lg:col-span-1 space-y-8">
            {client && account && childAccountRef && <TodosCard parentClient={client} childAccount={account} childAccountRef={childAccountRef} onRefetchNeeded={() => setRefetchTrigger(p => p+1)} />}
            {accountId && <ReportsCard accountId={accountId as string} />}
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
