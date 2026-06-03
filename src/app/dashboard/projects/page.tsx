'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc, 
    doc, 
    deleteDoc, 
    Timestamp, 
    arrayUnion, 
    arrayRemove,
    onSnapshot,
    writeBatch
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Plus, 
    Loader2, 
    Calendar, 
    Trash2, 
    Clock, 
    Search,
    ChevronDown,
    ChevronRight,
    MessageSquare,
    UserPlus,
    X,
    FolderKanban,
    CalendarDays,
    ExternalLink
} from 'lucide-react';
import type { Todo, ParentClient, ChildAccount, AppUser } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = [
    { value: 'todo', label: 'Opstarten', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
    { value: 'in_progress', label: 'Lopend', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20' },
    { value: 'on_hold', label: 'Wachtend', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
    { value: 'completed', label: 'Afgerond', color: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' }
] as const;

export default function TasksPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // User Role and Manager ID
    const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: appUser } = useDoc(userDocRef);
    const isAdmin = (appUser as any)?.role?.toLowerCase() === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es' || user?.email?.toLowerCase() === 'admin@onlyforward.nl';
    const managerUid = isAdmin ? user?.uid : (appUser as any)?.managerId;

    // Real-time Data
    const [todos, setTodos] = useState<Todo[]>([]);
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [accounts, setAccounts] = useState<ChildAccount[]>([]);
    const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTodos, setLoadingTodos] = useState(true);

    // Page State
    const [viewMode, setViewMode] = useState<'grouped' | 'list'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [clientFilter, setClientFilter] = useState<string>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
    const [showCompleted, setShowCompleted] = useState(false);
    
    // Collapse States for Child Account Groups
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Bulk selection state per child account
    const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, string[]>>({});

    // Inline inputs for new tasks per child account
    const [inlineNewTaskText, setInlineNewTaskText] = useState<Record<string, string>>({});

    // Unified Task Sheet State
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
    const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
    
    // Form fields for the sheet
    const [sheetTitle, setSheetTitle] = useState('');
    const [sheetAccountId, setSheetAccountId] = useState('');
    const [sheetStatus, setSheetStatus] = useState<Todo['status']>('todo');
    const [sheetAssignee, setSheetAssignee] = useState<string>('unassigned');
    const [sheetDueDate, setSheetDueDate] = useState<Date | undefined>(undefined);
    const [sheetBriefing, setSheetBriefing] = useState('');
    
    const [commentText, setCommentText] = useState('');
    const [isSavingSheet, setIsSavingSheet] = useState(false);

    // Fetch static data (Clients, Accounts, Team)
    useEffect(() => {
        if (!firestore || !managerUid) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch parent clients
                const clientsQuery = isAdmin 
                    ? collection(firestore, 'parentClients') 
                    : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
                const clientsSnap = await getDocs(clientsQuery);
                const fetchedClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
                setClients(fetchedClients);

                // 2. Fetch child accounts
                const allAccounts: ChildAccount[] = [];
                for (const client of fetchedClients) {
                    const accSnap = await getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'));
                    accSnap.forEach(d => allAccounts.push({ id: d.id, ...d.data() } as ChildAccount));
                }
                setAccounts(allAccounts);

                // 3. Fetch Team members
                const teamSnap = await getDocs(collection(firestore, 'users'));
                const team = teamSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
                setTeamMembers(team);
            } catch (e) {
                console.error("Error fetching static tasks metadata:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, managerUid]);

    // Real-time subscribe to Todos
    useEffect(() => {
        if (!firestore || !managerUid) return;

        setLoadingTodos(true);
        const q = isAdmin
            ? query(collection(firestore, 'todos'), where('completed', '==', false))
            : query(collection(firestore, 'todos'), where('ownerId', '==', managerUid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTodos = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Todo));
            setTodos(fetchedTodos);
            setLoadingTodos(false);
        }, (error) => {
            console.error("Error subscribing to todos:", error);
            setLoadingTodos(false);
        });

        return () => unsubscribe();
    }, [firestore, managerUid]);

    // Synchronize worked hours to timeEntries collection
    const syncHoursToTimeEntry = async (todo: Todo, hours: number) => {
        if (!firestore || !managerUid) return;

        try {
            // Find existing time entry for this todo
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
                    // Update existing
                    await updateDoc(doc(firestore, 'timeEntries', timeEntriesSnap.docs[0].id), entryData);
                } else {
                    // Create new
                    await addDoc(collection(firestore, 'timeEntries'), entryData);
                }
            } else {
                // Delete existing if hours set to 0 or cleared
                if (!timeEntriesSnap.empty) {
                    await deleteDoc(doc(firestore, 'timeEntries', timeEntriesSnap.docs[0].id));
                }
            }
        } catch (e) {
            console.error("Error syncing hours to time entry:", e);
        }
    };

    // Add new Task
    const handleAddTask = async (childAccount: ChildAccount, text: string) => {
        if (!firestore || !user || !managerUid || !text.trim()) return;

        const client = clients.find(c => c.id === childAccount.parentClientId);
        if (!client) return;

        const now = new Date();

        const newTodo: Omit<Todo, 'id'> = {
            ownerId: managerUid,
            parentClientId: client.id,
            parentClientName: client.clientName,
            childAccountId: childAccount.id,
            childAccountNickname: childAccount.nickname,
            content: text.trim(),
            completed: false,
            createdAt: now.toISOString(),
            status: 'todo',
            dueDate: now.toISOString()
        };

        try {
            const docRef = await addDoc(collection(firestore, 'todos'), newTodo);
            
            // Add to child account pending ids
            const accountRef = doc(firestore, 'parentClients', client.id, 'childAccounts', childAccount.id);
            await updateDoc(accountRef, {
                pendingTodoIds: arrayUnion(docRef.id)
            });

            // Clear input
            setInlineNewTaskText(prev => ({ ...prev, [childAccount.id]: '' }));
            toast({ title: 'Taak aangemaakt! 🚀' });
        } catch (e) {
            console.error("Error creating todo:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan' });
        }
    };

    // Toggle Complete / Incomplete
    const handleToggleComplete = async (todo: Todo, currentlyCompleted: boolean) => {
        if (!firestore || !managerUid) return;

        const completed = !currentlyCompleted;
        const status = completed ? 'completed' : 'todo';
        const completedAt = completed ? new Date().toISOString() : null;

        const todoRef = doc(firestore, 'todos', todo.id);
        const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);

        try {
            await updateDoc(todoRef, { completed, status, completedAt });
            
            // Update child account references
            if (completed) {
                await updateDoc(accountRef, {
                    pendingTodoIds: arrayRemove(todo.id),
                    todoRunIds: arrayUnion(todo.id)
                });
            } else {
                await updateDoc(accountRef, {
                    pendingTodoIds: arrayUnion(todo.id),
                    todoRunIds: arrayRemove(todo.id)
                });
            }

            // Sync hours date reference
            if (todo.workedHours && todo.workedHours > 0) {
                await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
            }
        } catch (e) {
            console.error("Error toggling todo completion:", e);
            toast({ variant: 'destructive', title: 'Kan status niet bijwerken' });
        }
    };

    // Change Status
    const handleStatusChange = async (todo: Todo, status: Todo['status']) => {
        if (!firestore || !managerUid || !status) return;

        const completed = status === 'completed';
        const completedAt = completed ? new Date().toISOString() : null;

        const todoRef = doc(firestore, 'todos', todo.id);
        const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);

        try {
            await updateDoc(todoRef, { status, completed, completedAt });

            // Sync with child account arrays
            if (completed) {
                await updateDoc(accountRef, {
                    pendingTodoIds: arrayRemove(todo.id),
                    todoRunIds: arrayUnion(todo.id)
                });
            } else {
                await updateDoc(accountRef, {
                    pendingTodoIds: arrayUnion(todo.id),
                    todoRunIds: arrayRemove(todo.id)
                });
            }

            // Sync hours date reference
            if (todo.workedHours && todo.workedHours > 0) {
                await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
            }
        } catch (e) {
            console.error("Error updating status:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan status' });
        }
    };

    // Change Assignee
    const handleAssigneeChange = async (todo: Todo, assignee: AppUser | null) => {
        if (!firestore || !managerUid) return;

        const todoRef = doc(firestore, 'todos', todo.id);
        try {
            await updateDoc(todoRef, {
                assigneeId: assignee?.uid || null,
                assigneeName: assignee?.displayName || assignee?.email || null,
                assigneePhotoUrl: assignee?.photoURL || null
            });
        } catch (e) {
            console.error("Error updating assignee:", e);
            toast({ variant: 'destructive', title: 'Fout bij toewijzen' });
        }
    };

    // Change Due Date
    const handleDueDateChange = async (todo: Todo, date: Date | undefined) => {
        if (!firestore || !managerUid) return;

        const todoRef = doc(firestore, 'todos', todo.id);
        try {
            await updateDoc(todoRef, {
                dueDate: date ? date.toISOString() : null
            });
        } catch (e) {
            console.error("Error updating due date:", e);
            toast({ variant: 'destructive', title: 'Fout bij bijwerken datum' });
        }
    };

    // Change Worked Hours
    const handleWorkedHoursChange = async (todo: Todo, val: string) => {
        if (!firestore || !managerUid) return;

        const hours = val === '' ? 0 : parseFloat(val);
        if (isNaN(hours)) return;

        const todoRef = doc(firestore, 'todos', todo.id);
        try {
            await updateDoc(todoRef, { workedHours: hours });
            await syncHoursToTimeEntry(todo, hours);
        } catch (e) {
            console.error("Error saving worked hours:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan uren' });
        }
    };

    // Inline Edit Title
    const handleTitleChange = async (todo: Todo, val: string) => {
        if (!firestore || !managerUid || !val.trim() || val === todo.content) return;

        const todoRef = doc(firestore, 'todos', todo.id);
        try {
            await updateDoc(todoRef, { content: val.trim() });
        } catch (e) {
            console.error("Error updating title:", e);
        }
    };

    // Delete Task
    const handleDeleteTask = async (todo: Todo) => {
        if (!firestore || !managerUid) return;

        const todoRef = doc(firestore, 'todos', todo.id);
        const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);

        try {
            await deleteDoc(todoRef);
            await updateDoc(accountRef, {
                pendingTodoIds: arrayRemove(todo.id),
                todoRunIds: arrayRemove(todo.id)
            });

            // Delete time entry
            await syncHoursToTimeEntry(todo, 0);

            if (selectedTodo?.id === todo.id) {
                setIsDetailOpen(false);
            }
            toast({ title: 'Taak verwijderd' });
        } catch (e) {
            console.error("Error deleting todo:", e);
            toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
        }
    };

    // Bulk Selection Helpers
    const handleToggleSelectTask = (accountId: string, todoId: string, checked: boolean) => {
        setSelectedTaskIds(prev => {
            const list = prev[accountId] || [];
            if (checked) {
                return { ...prev, [accountId]: [...list, todoId] };
            } else {
                return { ...prev, [accountId]: list.filter(id => id !== todoId) };
            }
        });
    };

    const handleSelectAllForAccount = (accountId: string, accountTodos: Todo[], checked: boolean) => {
        setSelectedTaskIds(prev => {
            if (checked) {
                return { ...prev, [accountId]: accountTodos.map(t => t.id) };
            } else {
                return { ...prev, [accountId]: [] };
            }
        });
    };

    const handleDeselectAllForAccount = (accountId: string) => {
        setSelectedTaskIds(prev => ({ ...prev, [accountId]: [] }));
    };

    // Bulk Firestore Action Helpers
    const handleBulkStatusChange = async (accountId: string, status: Todo['status']) => {
        if (!firestore || !managerUid || !status) return;
        const taskIds = selectedTaskIds[accountId] || [];
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);
        const completed = status === 'completed';
        const completedAt = completed ? new Date().toISOString() : null;

        const selectedTodos = todos.filter(t => taskIds.includes(t.id));
        if (selectedTodos.length === 0) return;
        const parentClientId = selectedTodos[0].parentClientId;
        const accountRef = doc(firestore, 'parentClients', parentClientId, 'childAccounts', accountId);

        try {
            selectedTodos.forEach(todo => {
                const todoRef = doc(firestore, 'todos', todo.id);
                batch.update(todoRef, { status, completed, completedAt });
            });

            if (completed) {
                batch.update(accountRef, {
                    pendingTodoIds: arrayRemove(...taskIds),
                    todoRunIds: arrayUnion(...taskIds)
                });
            } else {
                batch.update(accountRef, {
                    pendingTodoIds: arrayUnion(...taskIds),
                    todoRunIds: arrayRemove(...taskIds)
                });
            }

            await batch.commit();

            for (const todo of selectedTodos) {
                if (todo.workedHours && todo.workedHours > 0) {
                    await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
                }
            }

            setSelectedTaskIds(prev => ({ ...prev, [accountId]: [] }));
            toast({ title: `Status van ${taskIds.length} taken bijgewerkt! 🚀` });
        } catch (e) {
            console.error("Error bulk updating status:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk status update' });
        }
    };

    const handleBulkAssigneeChange = async (accountId: string, assignee: AppUser | null) => {
        if (!firestore || !managerUid) return;
        const taskIds = selectedTaskIds[accountId] || [];
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);

        try {
            taskIds.forEach(id => {
                const todoRef = doc(firestore, 'todos', id);
                batch.update(todoRef, {
                    assigneeId: assignee?.uid || null,
                    assigneeName: assignee?.displayName || assignee?.email || null,
                    assigneePhotoUrl: assignee?.photoURL || null
                });
            });

            await batch.commit();
            setSelectedTaskIds(prev => ({ ...prev, [accountId]: [] }));
            toast({ title: `Toewijzing van ${taskIds.length} taken bijgewerkt!` });
        } catch (e) {
            console.error("Error bulk updating assignee:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk toewijzen' });
        }
    };

    const handleBulkDueDateChange = async (accountId: string, date: Date | undefined) => {
        if (!firestore || !managerUid) return;
        const taskIds = selectedTaskIds[accountId] || [];
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);
        const isoDate = date ? date.toISOString() : null;

        try {
            taskIds.forEach(id => {
                const todoRef = doc(firestore, 'todos', id);
                batch.update(todoRef, { dueDate: isoDate });
            });

            await batch.commit();
            setSelectedTaskIds(prev => ({ ...prev, [accountId]: [] }));
            toast({ title: `Uitvoerdatum van ${taskIds.length} taken bijgewerkt!` });
        } catch (e) {
            console.error("Error bulk updating due date:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk uitvoerdatum' });
        }
    };

    const handleBulkDelete = async (accountId: string) => {
        if (!firestore || !managerUid) return;
        const taskIds = selectedTaskIds[accountId] || [];
        if (taskIds.length === 0) return;

        const selectedTodos = todos.filter(t => taskIds.includes(t.id));
        if (selectedTodos.length === 0) return;
        const parentClientId = selectedTodos[0].parentClientId;
        const accountRef = doc(firestore, 'parentClients', parentClientId, 'childAccounts', accountId);

        const batch = writeBatch(firestore);

        try {
            taskIds.forEach(id => {
                const todoRef = doc(firestore, 'todos', id);
                batch.delete(todoRef);
            });

            batch.update(accountRef, {
                pendingTodoIds: arrayRemove(...taskIds),
                todoRunIds: arrayRemove(...taskIds)
            });

            await batch.commit();

            for (const todo of selectedTodos) {
                await syncHoursToTimeEntry(todo, 0);
            }

            setSelectedTaskIds(prev => ({ ...prev, [accountId]: [] }));
            toast({ title: `${taskIds.length} taken verwijderd` });
        } catch (e) {
            console.error("Error bulk deleting tasks:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk verwijderen' });
        }
    };

    const handleSelectAllVisible = (checked: boolean) => {
        if (checked) {
            const newSelection: Record<string, string[]> = {};
            listTodos.forEach(todo => {
                if (!newSelection[todo.childAccountId]) {
                    newSelection[todo.childAccountId] = [];
                }
                newSelection[todo.childAccountId].push(todo.id);
            });
            setSelectedTaskIds(newSelection);
        } else {
            setSelectedTaskIds({});
        }
    };

    const handlePageBulkStatusChange = async (status: Todo['status']) => {
        if (!firestore || !managerUid || !status) return;
        const taskIds = Object.values(selectedTaskIds).flat();
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);
        const completed = status === 'completed';
        const completedAt = completed ? new Date().toISOString() : null;

        const selectedTodos = todos.filter(t => taskIds.includes(t.id));
        if (selectedTodos.length === 0) return;

        try {
            const tasksByAccount: Record<string, string[]> = {};
            selectedTodos.forEach(todo => {
                const todoRef = doc(firestore, 'todos', todo.id);
                batch.update(todoRef, { status, completed, completedAt });

                if (!tasksByAccount[todo.childAccountId]) {
                    tasksByAccount[todo.childAccountId] = [];
                }
                tasksByAccount[todo.childAccountId].push(todo.id);
            });

            Object.entries(tasksByAccount).forEach(([accountId, accountTaskIds]) => {
                const todo = selectedTodos.find(t => t.childAccountId === accountId);
                if (todo) {
                    const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', accountId);
                    if (completed) {
                        batch.update(accountRef, {
                            pendingTodoIds: arrayRemove(...accountTaskIds),
                            todoRunIds: arrayUnion(...accountTaskIds)
                        });
                    } else {
                        batch.update(accountRef, {
                            pendingTodoIds: arrayUnion(...accountTaskIds),
                            todoRunIds: arrayRemove(...accountTaskIds)
                        });
                    }
                }
            });

            await batch.commit();

            for (const todo of selectedTodos) {
                if (todo.workedHours && todo.workedHours > 0) {
                    await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
                }
            }

            setSelectedTaskIds({});
            toast({ title: `Status van ${taskIds.length} taken bijgewerkt! 🚀` });
        } catch (e) {
            console.error("Error bulk updating status:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk status update' });
        }
    };

    const handlePageBulkAssigneeChange = async (assignee: AppUser | null) => {
        if (!firestore || !managerUid) return;
        const taskIds = Object.values(selectedTaskIds).flat();
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);

        try {
            taskIds.forEach(id => {
                const todoRef = doc(firestore, 'todos', id);
                batch.update(todoRef, {
                    assigneeId: assignee?.uid || null,
                    assigneeName: assignee?.displayName || assignee?.email || null,
                    assigneePhotoUrl: assignee?.photoURL || null
                });
            });

            await batch.commit();
            setSelectedTaskIds({});
            toast({ title: `Toewijzing van ${taskIds.length} taken bijgewerkt!` });
        } catch (e) {
            console.error("Error bulk updating assignee:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk toewijzen' });
        }
    };

    const handlePageBulkDueDateChange = async (date: Date | undefined) => {
        if (!firestore || !managerUid) return;
        const taskIds = Object.values(selectedTaskIds).flat();
        if (taskIds.length === 0) return;

        const batch = writeBatch(firestore);
        const isoDate = date ? date.toISOString() : null;

        try {
            taskIds.forEach(id => {
                const todoRef = doc(firestore, 'todos', id);
                batch.update(todoRef, { dueDate: isoDate });
            });

            await batch.commit();
            setSelectedTaskIds({});
            toast({ title: `Uitvoerdatum van ${taskIds.length} taken bijgewerkt!` });
        } catch (e) {
            console.error("Error bulk updating due date:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk uitvoerdatum' });
        }
    };

    const handlePageBulkDelete = async () => {
        if (!firestore || !managerUid) return;
        const taskIds = Object.values(selectedTaskIds).flat();
        if (taskIds.length === 0) return;

        const selectedTodos = todos.filter(t => taskIds.includes(t.id));
        if (selectedTodos.length === 0) return;

        const batch = writeBatch(firestore);

        try {
            const tasksByAccount: Record<string, string[]> = {};
            selectedTodos.forEach(todo => {
                const todoRef = doc(firestore, 'todos', todo.id);
                batch.delete(todoRef);

                if (!tasksByAccount[todo.childAccountId]) {
                    tasksByAccount[todo.childAccountId] = [];
                }
                tasksByAccount[todo.childAccountId].push(todo.id);
            });

            Object.entries(tasksByAccount).forEach(([accountId, accountTaskIds]) => {
                const todo = selectedTodos.find(t => t.childAccountId === accountId);
                if (todo) {
                    const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', accountId);
                    batch.update(accountRef, {
                        pendingTodoIds: arrayRemove(...accountTaskIds),
                        todoRunIds: arrayRemove(...accountTaskIds)
                    });
                }
            });

            await batch.commit();

            for (const todo of selectedTodos) {
                await syncHoursToTimeEntry(todo, 0);
            }

            setSelectedTaskIds({});
            toast({ title: `${taskIds.length} taken verwijderd` });
        } catch (e) {
            console.error("Error bulk deleting tasks:", e);
            toast({ variant: 'destructive', title: 'Fout bij bulk verwijderen' });
        }
    };

    const openCreatePanel = () => {
        setSheetMode('create');
        setSelectedTodo(null);
        setSheetTitle('');
        setSheetAccountId('');
        setSheetStatus('todo');
        setSheetAssignee('unassigned');
        setSheetDueDate(new Date());
        setSheetBriefing('');
        setCommentText('');
        setIsSheetOpen(true);
    };

    const openDetailPanel = (todo: Todo) => {
        setSheetMode('edit');
        setSelectedTodo(todo);
        setSheetTitle(todo.content);
        setSheetAccountId(todo.childAccountId);
        setSheetStatus(todo.status || 'todo');
        setSheetAssignee(todo.assigneeId || 'unassigned');
        setSheetDueDate(todo.dueDate ? parseISO(todo.dueDate) : undefined);
        setSheetBriefing(todo.briefing || '');
        setCommentText('');
        setIsSheetOpen(true);
    };

    const handleSaveTaskSheet = async () => {
        if (!firestore || !user || !managerUid || !sheetTitle.trim() || !sheetAccountId) return;
        setIsSavingSheet(true);

        try {
            const targetAccount = accounts.find(a => a.id === sheetAccountId);
            const client = targetAccount ? clients.find(c => c.id === targetAccount.parentClientId) : null;
            if (!targetAccount || !client) throw new Error("Invalid account selection");

            const assigneeObj = teamMembers.find(t => t.uid === sheetAssignee);
            const completed = sheetStatus === 'completed';
            
            if (sheetMode === 'create') {
                const now = new Date();
                const newTodo: Omit<Todo, 'id'> = {
                    ownerId: managerUid,
                    parentClientId: client.id,
                    parentClientName: client.clientName,
                    childAccountId: targetAccount.id,
                    childAccountNickname: targetAccount.nickname,
                    content: sheetTitle.trim(),
                    completed: completed,
                    createdAt: now.toISOString(),
                    status: sheetStatus,
                    dueDate: sheetDueDate ? sheetDueDate.toISOString() : null,
                    briefing: sheetBriefing,
                    assigneeId: assigneeObj?.uid || null,
                    assigneeName: assigneeObj?.displayName || assigneeObj?.email || null,
                    assigneePhotoUrl: assigneeObj?.photoURL || null
                };

                const docRef = await addDoc(collection(firestore, 'todos'), newTodo);
                const accountRef = doc(firestore, 'parentClients', client.id, 'childAccounts', targetAccount.id);
                await updateDoc(accountRef, {
                    [completed ? 'todoRunIds' : 'pendingTodoIds']: arrayUnion(docRef.id)
                });
                
                toast({ title: 'Taak aangemaakt! 🚀' });
                setIsSheetOpen(false);
            } else if (sheetMode === 'edit' && selectedTodo) {
                const completedAt = completed && selectedTodo.status !== 'completed' ? new Date().toISOString() : selectedTodo.completedAt || null;
                
                const updates: Partial<Todo> = {
                    content: sheetTitle.trim(),
                    status: sheetStatus,
                    completed: completed,
                    completedAt: completedAt,
                    dueDate: sheetDueDate ? sheetDueDate.toISOString() : null,
                    briefing: sheetBriefing,
                    assigneeId: assigneeObj?.uid || null,
                    assigneeName: assigneeObj?.displayName || assigneeObj?.email || null,
                    assigneePhotoUrl: assigneeObj?.photoURL || null
                };
                
                const todoRef = doc(firestore, 'todos', selectedTodo.id);
                await updateDoc(todoRef, updates);

                // Handle child account array references if status changed to/from completed
                if (selectedTodo.status !== sheetStatus && (selectedTodo.status === 'completed' || sheetStatus === 'completed')) {
                    const accountRef = doc(firestore, 'parentClients', selectedTodo.parentClientId, 'childAccounts', selectedTodo.childAccountId);
                    if (completed) {
                        await updateDoc(accountRef, {
                            pendingTodoIds: arrayRemove(selectedTodo.id),
                            todoRunIds: arrayUnion(selectedTodo.id)
                        });
                    } else {
                        await updateDoc(accountRef, {
                            pendingTodoIds: arrayUnion(selectedTodo.id),
                            todoRunIds: arrayRemove(selectedTodo.id)
                        });
                    }
                }
                
                toast({ title: 'Taak bijgewerkt!' });
                setIsSheetOpen(false);
            }
        } catch (e) {
            console.error("Error saving task:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan taak' });
        } finally {
            setIsSavingSheet(false);
        }
    };

    // Add comment to todo thread
    const handleAddComment = async () => {
        if (!firestore || !managerUid || !selectedTodo || !commentText.trim()) return;

        const newComment = {
            id: Math.random().toString(36).substring(2, 9),
            userId: user?.uid || '',
            userName: appUser?.displayName || user?.displayName || user?.email || 'Onbekend',
            userPhotoUrl: user?.photoURL || null,
            text: commentText.trim(),
            createdAt: new Date().toISOString()
        };

        const todoRef = doc(firestore, 'todos', selectedTodo.id);
        try {
            const updatedComments = [...(selectedTodo.comments || []), newComment];
            await updateDoc(todoRef, { comments: updatedComments });
            setSelectedTodo(prev => prev ? { ...prev, comments: updatedComments } : null);
            setCommentText('');
        } catch (e) {
            console.error("Error posting comment:", e);
            toast({ variant: 'destructive', title: 'Kon reactie niet plaatsen' });
        }
    };

    // Link parsing helper
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

    // Filter and group todos
    const filteredTodos = useMemo(() => {
        return todos.filter(todo => {
            // Search Match
            if (searchTerm && !todo.content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            // Status Match
            if (statusFilter !== 'all' && todo.status !== statusFilter) return false;
            // Client Match
            if (clientFilter !== 'all' && todo.parentClientId !== clientFilter) return false;
            // Assignee Match
            if (assigneeFilter !== 'all') {
                if (assigneeFilter === 'unassigned') {
                    if (todo.assigneeId) return false;
                } else if (todo.assigneeId !== assigneeFilter) {
                    return false;
                }
            }
            // Show Completed Match
            if (!showCompleted && todo.status === 'completed') return false;

            return true;
        });
    }, [todos, searchTerm, statusFilter, clientFilter, assigneeFilter, showCompleted]);

    const listTodos = useMemo(() => {
        return filteredTodos.filter(todo => {
            const acc = accounts.find(a => a.id === todo.childAccountId);
            return acc && !acc.isPaused;
        }).sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        });
    }, [filteredTodos, accounts]);

    // Grouping by Child Account
    const groupedAccounts = useMemo(() => {
        const result: Array<{
            account: ChildAccount;
            client: ParentClient | undefined;
            todos: Todo[];
            openCount: number;
        }> = [];

        // Group only child accounts that have matching todos or fit client filter
        accounts.forEach(acc => {
            if (acc.isPaused) return;
            const accTodos = filteredTodos.filter(t => t.childAccountId === acc.id);
            const client = clients.find(c => c.id === acc.parentClientId);

            // Fetch actual open todo count (for display next to name)
            const openTodos = todos.filter(t => t.childAccountId === acc.id && t.status !== 'completed');

            // If we are applying search filters, we only show accounts with matching tasks
            if (searchTerm || statusFilter !== 'all' || assigneeFilter !== 'all') {
                if (accTodos.length === 0) return;
            } else if (clientFilter !== 'all' && acc.parentClientId !== clientFilter) {
                return;
            }

            result.push({
                account: acc,
                client,
                todos: accTodos.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
                openCount: openTodos.length
            });
        });

        // Sort by Client Name, then Account Nickname
        return result.sort((a, b) => {
            const clientA = a.client?.clientName || '';
            const clientB = b.client?.clientName || '';
            const comp = clientA.localeCompare(clientB);
            if (comp !== 0) return comp;
            return a.account.nickname.localeCompare(b.account.nickname);
        });
    }, [accounts, clients, filteredTodos, todos, clientFilter, searchTerm, statusFilter, assigneeFilter]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <FolderKanban className="text-blue-400 size-8" />
                        Takenbeheer
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Beheer operationele taken, briefings en gewerkte uren per klantaccount.</p>
                </div>

                <div className="flex items-center gap-4 self-start md:self-auto">
                    {/* View Switcher Toggle */}
                    <div className="flex items-center bg-slate-950/40 p-1 rounded-lg border border-slate-800">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            className={cn(
                                "text-xs font-bold uppercase tracking-wider px-3 py-1.5 h-8 rounded-md transition-all",
                                viewMode === 'grouped' 
                                    ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                                    : "text-slate-400 hover:text-slate-200"
                            )}
                            onClick={() => setViewMode('grouped')}
                        >
                            Per Account
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            className={cn(
                                "text-xs font-bold uppercase tracking-wider px-3 py-1.5 h-8 rounded-md transition-all",
                                viewMode === 'list' 
                                    ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                                    : "text-slate-400 hover:text-slate-200"
                            )}
                            onClick={() => setViewMode('list')}
                        >
                            Lijstweergave
                        </Button>
                    </div>

                    {/* New Task Button */}
                    <Button onClick={openCreatePanel} size="sm" className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-xs h-9 px-4 rounded-lg shadow-lg shadow-blue-500/10 flex items-center gap-1.5">
                        <Plus className="size-4" /> Nieuwe Taak
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="glass-card border-white/5 bg-slate-900/30">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                        <Input 
                            placeholder="Zoek in taken..." 
                            className="bg-slate-950/40 border-slate-800 pl-10 text-slate-200"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-3">
                        {/* Klant filter */}
                        <div className="flex flex-col gap-1.5">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-slate-800 bg-slate-950/40 text-slate-300 justify-between min-w-[140px] text-xs">
                                        {clientFilter === 'all' ? 'Alle Klanten' : clients.find(c => c.id === clientFilter)?.clientName || 'Selecteer klant'}
                                        <ChevronDown className="ml-2 size-3.5 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 align-end max-h-[300px] overflow-y-auto">
                                    <DropdownMenuItem onClick={() => setClientFilter('all')}>Alle Klanten</DropdownMenuItem>
                                    {clients.map(c => (
                                        <DropdownMenuItem key={c.id} onClick={() => setClientFilter(c.id)}>{c.clientName}</DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Status filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-slate-800 bg-slate-950/40 text-slate-300 justify-between min-w-[120px] text-xs">
                                    {statusFilter === 'all' ? 'Alle Statussen' : STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
                                    <ChevronDown className="ml-2 size-3.5 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Alle Statussen</DropdownMenuItem>
                                {STATUS_OPTIONS.map(o => (
                                    <DropdownMenuItem key={o.value} onClick={() => setStatusFilter(o.value)}>{o.label}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Assignee filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-slate-800 bg-slate-950/40 text-slate-300 justify-between min-w-[140px] text-xs">
                                    {assigneeFilter === 'all' 
                                        ? 'Iedereen' 
                                        : assigneeFilter === 'unassigned' 
                                            ? 'Niet toegewezen' 
                                            : teamMembers.find(t => t.uid === assigneeFilter)?.displayName || 'Medewerker'}
                                    <ChevronDown className="ml-2 size-3.5 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                <DropdownMenuItem onClick={() => setAssigneeFilter('all')}>Iedereen</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAssigneeFilter('unassigned')}>Niet toegewezen</DropdownMenuItem>
                                {teamMembers.map(t => (
                                    <DropdownMenuItem key={t.uid} onClick={() => setAssigneeFilter(t.uid)}>{t.displayName || t.email}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Toggle completed */}
                        <Button 
                            variant="ghost" 
                            className={cn(
                                "border border-slate-800 text-xs font-semibold px-4 h-9 rounded-lg transition-all",
                                showCompleted 
                                    ? "bg-blue-600/10 text-blue-400 border-blue-600/30 hover:bg-blue-600/20" 
                                    : "bg-slate-950/40 text-slate-400 hover:bg-slate-950/60"
                            )}
                            onClick={() => setShowCompleted(p => !p)}
                        >
                            Voltooide Taken
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Task Board / Table Groupings */}
            {loading || loadingTodos ? (
                <div className="flex justify-center py-40"><Loader2 className="size-12 text-blue-500 animate-spin" /></div>
                        ) : viewMode === 'list' ? (
                listTodos.length === 0 ? (
                    <Card className="bg-transparent border-dashed border-slate-800 p-20 text-center">
                        <h2 className="text-xl font-bold text-slate-300">Geen taken gevonden</h2>
                        <p className="text-slate-500 mt-2 max-w-sm mx-auto">Er zijn geen openstaande taken voor de geselecteerde filters.</p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Page Bulk Action Bar */}
                        {Object.values(selectedTaskIds).flat().length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1e293b]/70 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-300 animate-in slide-in-from-top duration-300">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-blue-400">{Object.values(selectedTaskIds).flat().length} geselecteerd</span>
                                    <button 
                                        onClick={() => setSelectedTaskIds({})} 
                                        className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-black transition-colors"
                                    >
                                        Deselecteer
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Page Bulk Status Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                Status wijzigen
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            {STATUS_OPTIONS.map((opt) => (
                                                <DropdownMenuItem 
                                                    key={opt.value} 
                                                    onClick={() => handlePageBulkStatusChange(opt.value)}
                                                    className="text-xs uppercase font-bold"
                                                >
                                                    {opt.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Page Bulk Assignee Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                Toewijzen aan
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-[200px] overflow-y-auto align-end">
                                            <DropdownMenuItem onClick={() => handlePageBulkAssigneeChange(null)}>
                                                Niemand
                                            </DropdownMenuItem>
                                            {teamMembers.map(member => (
                                                <DropdownMenuItem key={member.uid} onClick={() => handlePageBulkAssigneeChange(member)} className="flex items-center gap-2">
                                                    <Avatar className="size-4 border border-slate-800">
                                                        {member.photoURL && <AvatarImage src={member.photoURL} />}
                                                        <AvatarFallback className="text-[7px] bg-slate-800">{member.displayName?.substring(0,2) || 'M'}</AvatarFallback>
                                                    </Avatar>
                                                    <span>{member.displayName || member.email}</span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Page Bulk Due Date Popover */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                Datum aanpassen
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="end">
                                            <CalendarComponent 
                                                mode="single" 
                                                onSelect={(date) => handlePageBulkDueDateChange(date)} 
                                                initialFocus 
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    {/* Page Bulk Delete Button */}
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        className="h-8 text-[10px] font-black uppercase tracking-wider"
                                        onClick={() => handlePageBulkDelete()}
                                    >
                                        <Trash2 className="size-3 mr-1" /> Verwijderen
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border border-white/5 bg-slate-900/15 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-[#0f172a]/20 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                            <th className="w-10 px-4 py-3 text-center">
                                                <Checkbox 
                                                    checked={listTodos.length > 0 && (Object.values(selectedTaskIds).flat().length === listTodos.length)} 
                                                    onCheckedChange={(checked) => handleSelectAllVisible(!!checked)} 
                                                    className="border-slate-700 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                />
                                            </th>
                                            <th className="px-3 py-3 min-w-[200px]">Taak</th>
                                            <th className="px-3 py-3 w-40">Klant / Account</th>
                                            <th className="w-12 py-3 text-center">Chat</th>
                                            <th className="w-28 px-3 py-3">Uitvoerende</th>
                                            <th className="w-32 px-3 py-3">Status</th>
                                            <th className="w-28 px-3 py-3">Uitvoerdatum</th>
                                            <th className="w-24 px-4 py-3 text-right">Tijd (u)</th>
                                            <th className="w-10 px-3 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {listTodos.map((todo) => (
                                            <tr 
                                                key={todo.id} 
                                                className={cn(
                                                    "hover:bg-white/[0.02] transition-colors group",
                                                    todo.status === 'completed' && "opacity-60 bg-green-500/[0.01]"
                                                )}
                                            >
                                                {/* Checkbox */}
                                                <td className="px-4 py-2.5 text-center">
                                                    <Checkbox 
                                                        checked={selectedTaskIds[todo.childAccountId]?.includes(todo.id) || false} 
                                                        onCheckedChange={(checked) => handleToggleSelectTask(todo.childAccountId, todo.id, !!checked)} 
                                                        className="border-slate-700 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                    />
                                                </td>

                                                {/* Task Content */}
                                                <td className="px-3 py-2.5">
                                                    <input 
                                                        type="text" 
                                                        value={todo.content} 
                                                        className={cn(
                                                            "w-full bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 px-1 py-0.5 rounded text-xs font-semibold leading-normal",
                                                            todo.status === 'completed' && "line-through text-slate-500"
                                                        )}
                                                        onChange={e => {
                                                            const updated = todos.map(t => t.id === todo.id ? { ...t, content: e.target.value } : t);
                                                            setTodos(updated);
                                                        }}
                                                        onBlur={e => handleTitleChange(todo, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                (e.target as HTMLInputElement).blur();
                                                            }
                                                        }}
                                                    />
                                                </td>

                                                {/* Klant / Account */}
                                                <td className="px-3 py-2.5 font-medium text-slate-400">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-300 font-bold leading-normal truncate">{todo.childAccountNickname}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold truncate mt-0.5">{todo.parentClientName}</span>
                                                    </div>
                                                </td>

                                                {/* Chat */}
                                                <td className="py-2.5 text-center">
                                                    <button 
                                                        className={cn(
                                                            "relative inline-flex items-center justify-center p-1 rounded hover:bg-white/5 transition-all text-slate-500 hover:text-slate-300",
                                                            todo.comments && todo.comments.length > 0 && "text-blue-400 hover:text-blue-300"
                                                        )}
                                                        onClick={() => openDetailPanel(todo)}
                                                    >
                                                        <MessageSquare className="size-4" />
                                                        {todo.comments && todo.comments.length > 0 && (
                                                            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-black text-white px-0.5 border border-slate-900">
                                                                {todo.comments.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* Assignee */}
                                                <td className="px-3 py-2.5">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 outline-none select-none max-w-full">
                                                                <Avatar className="size-5 border border-slate-800">
                                                                    {todo.assigneePhotoUrl && <AvatarImage src={todo.assigneePhotoUrl} />}
                                                                    <AvatarFallback className="text-[7px] font-black uppercase bg-slate-800 text-slate-300">
                                                                        {todo.assigneeName ? todo.assigneeName.substring(0, 2).toUpperCase() : <UserPlus className="size-2.5 opacity-55" />}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="truncate text-[10px] hidden md:inline-block max-w-[80px]">
                                                                    {todo.assigneeName ? todo.assigneeName.split(' ')[0] : 'Toewijzen'}
                                                                </span>
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-[250px] overflow-y-auto align-end">
                                                            <DropdownMenuItem onClick={() => handleAssigneeChange(todo, null)}>
                                                                De-selecteer (Niemand)
                                                            </DropdownMenuItem>
                                                            {teamMembers.map(member => (
                                                                <DropdownMenuItem key={member.uid} onClick={() => handleAssigneeChange(todo, member)} className="flex items-center gap-2">
                                                                    <Avatar className="size-4 border border-slate-800">
                                                                        {member.photoURL && <AvatarImage src={member.photoURL} />}
                                                                        <AvatarFallback className="text-[7px] bg-slate-800">{member.displayName?.substring(0,2) || 'M'}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span>{member.displayName || member.email}</span>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>

                                                {/* Status */}
                                                <td className="px-3 py-2.5">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Badge 
                                                                variant="outline" 
                                                                className={cn(
                                                                    "text-[9px] uppercase font-black cursor-pointer px-2 py-0.5 border h-5 truncate select-none",
                                                                    STATUS_OPTIONS.find(o => o.value === (todo.status || 'todo'))?.color
                                                                )}
                                                            >
                                                                {STATUS_OPTIONS.find(o => o.value === (todo.status || 'todo'))?.label || 'Opstarten'}
                                                            </Badge>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                            {STATUS_OPTIONS.map((opt) => (
                                                                <DropdownMenuItem 
                                                                    key={opt.value} 
                                                                    onClick={() => handleStatusChange(todo, opt.value)}
                                                                    className="text-xs uppercase font-bold"
                                                                >
                                                                    {opt.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>

                                                {/* Due Date */}
                                                <td className="px-3 py-2.5">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 outline-none select-none font-bold uppercase tracking-wider">
                                                                <Calendar className="size-3 text-slate-500" />
                                                                {todo.dueDate ? format(parseISO(todo.dueDate), 'd MMM', { locale: nl }) : 'Kies datum'}
                                                            </button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="start">
                                                            <CalendarComponent 
                                                                mode="single" 
                                                                selected={todo.dueDate ? parseISO(todo.dueDate) : undefined} 
                                                                onSelect={date => handleDueDateChange(todo, date)} 
                                                                initialFocus 
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </td>

                                                {/* Worked Hours */}
                                                <td className="px-4 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <input 
                                                            type="text" 
                                                            placeholder="0"
                                                            defaultValue={todo.workedHours || ''}
                                                            className="w-10 bg-transparent border-none text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 px-1 py-0.5 rounded text-xs font-mono font-bold"
                                                            onBlur={e => handleWorkedHoursChange(todo, e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    (e.target as HTMLInputElement).blur();
                                                                }
                                                            }}
                                                        />
                                                        <Clock className="size-3 text-slate-600" />
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md"
                                                            onClick={() => openDetailPanel(todo)}
                                                        >
                                                            <Search className="size-3.5" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                                            onClick={() => handleDeleteTask(todo)}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            ) : groupedAccounts.length === 0 ? (
                <Card className="bg-transparent border-dashed border-slate-800 p-20 text-center">
                    <h2 className="text-xl font-bold text-slate-300">Geen taken gevonden</h2>
                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">Er zijn geen openstaande taken voor de geselecteerde filters.</p>
                </Card>
            ) : (
                <div className="space-y-6">
                    {groupedAccounts.map(({ account, client, todos: accountTodos, openCount }) => {
                        const isCollapsed = collapsedGroups[account.id] || false;
                        
                        // Find nearest action (dueDate) for open tasks
                        const nextActionTodo = accountTodos.find(t => t.status !== 'completed' && t.dueDate);
                        const nextActionDate = nextActionTodo?.dueDate 
                            ? format(parseISO(nextActionTodo.dueDate), 'd MMM', { locale: nl }) 
                            : '-';

                        return (
                            <div key={account.id} className="rounded-xl border border-white/5 bg-slate-900/15 overflow-hidden transition-all duration-300">
                                {/* Child Account Header Row */}
                                <div 
                                    className="flex items-center justify-between px-4 py-3 bg-[#171f33]/40 border-b border-white/5 cursor-pointer select-none group"
                                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [account.id]: !isCollapsed }))}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                                            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-bold text-slate-200 truncate">{account.nickname}</h3>
                                                <Badge className="bg-blue-600/10 text-blue-400 border border-blue-600/20 text-[10px] py-0 px-1.5 h-4 justify-center">
                                                    {openCount}
                                                </Badge>
                                                {client && (
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:inline-block">• {client.clientName}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Parent Level Columns Alignments */}
                                    <div className="flex items-center gap-6 text-xs text-slate-400 pl-4 shrink-0 font-medium">
                                        {/* Avatar of assignee if set for account */}
                                        {account.assignedEmployeeId && (
                                            <div className="flex items-center gap-1.5" title={`Accountmanager: ${account.assignedEmployeeName}`}>
                                                <div className="size-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-black text-slate-400 overflow-hidden">
                                                    {account.assignedEmployeeName?.substring(0, 2).toUpperCase() || 'AM'}
                                                </div>
                                                <span className="text-[10px] opacity-75 hidden md:inline">{account.assignedEmployeeName?.split(' ')[0]}</span>
                                            </div>
                                        )}
                                        
                                        {/* Next action date summary */}
                                        <div className="hidden sm:flex flex-col text-right">
                                            <span className="text-[8px] font-black uppercase text-slate-600 tracking-wider">Volgende actie</span>
                                            <span className="text-[10px] font-bold text-blue-400 mt-0.5">{nextActionDate}</span>
                                        </div>
                                    </div>
                                </div>

                                 {/* Group Sub-items (Tasks Table) */}
                                 <div className={cn("transition-all duration-300", isCollapsed ? "max-h-0 overflow-hidden" : "max-h-auto opacity-100")}>
                                     {/* Bulk Action Bar */}
                                     {selectedTaskIds[account.id]?.length > 0 && (
                                         <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1e293b]/70 border-b border-white/5 px-4 py-2.5 text-xs text-slate-300 animate-in slide-in-from-top duration-300">
                                             <div className="flex items-center gap-3">
                                                 <span className="font-bold text-blue-400">{selectedTaskIds[account.id].length} geselecteerd</span>
                                                 <button 
                                                     onClick={() => handleDeselectAllForAccount(account.id)} 
                                                     className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-black transition-colors"
                                                 >
                                                     Deselecteer
                                                 </button>
                                             </div>
                                             <div className="flex items-center gap-3 flex-wrap">
                                                 {/* Status Dropdown */}
                                                 <DropdownMenu>
                                                     <DropdownMenuTrigger asChild>
                                                         <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                             Status wijzigen
                                                         </Button>
                                                     </DropdownMenuTrigger>
                                                     <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                         {STATUS_OPTIONS.map((opt) => (
                                                             <DropdownMenuItem 
                                                                 key={opt.value} 
                                                                 onClick={() => handleBulkStatusChange(account.id, opt.value)}
                                                                 className="text-xs uppercase font-bold"
                                                             >
                                                                 {opt.label}
                                                             </DropdownMenuItem>
                                                         ))}
                                                     </DropdownMenuContent>
                                                 </DropdownMenu>

                                                 {/* Assignee Dropdown */}
                                                 <DropdownMenu>
                                                     <DropdownMenuTrigger asChild>
                                                         <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                             Toewijzen aan
                                                         </Button>
                                                     </DropdownMenuTrigger>
                                                     <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-[200px] overflow-y-auto">
                                                         <DropdownMenuItem onClick={() => handleBulkAssigneeChange(account.id, null)}>
                                                             Niemand
                                                         </DropdownMenuItem>
                                                         {teamMembers.map(member => (
                                                             <DropdownMenuItem key={member.uid} onClick={() => handleBulkAssigneeChange(account.id, member)} className="flex items-center gap-2">
                                                                 <Avatar className="size-4 border border-slate-800">
                                                                     {member.photoURL && <AvatarImage src={member.photoURL} />}
                                                                     <AvatarFallback className="text-[7px] bg-slate-800">{member.displayName?.substring(0,2) || 'M'}</AvatarFallback>
                                                                 </Avatar>
                                                                 <span>{member.displayName || member.email}</span>
                                                             </DropdownMenuItem>
                                                         ))}
                                                     </DropdownMenuContent>
                                                 </DropdownMenu>

                                                 {/* Due Date Popover */}
                                                 <Popover>
                                                     <PopoverTrigger asChild>
                                                         <Button variant="outline" size="sm" className="h-8 border-slate-700 bg-slate-900/60 text-slate-300 text-[10px] font-black uppercase tracking-wider">
                                                             Datum aanpassen
                                                         </Button>
                                                     </PopoverTrigger>
                                                     <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="end">
                                                         <CalendarComponent 
                                                             mode="single" 
                                                             onSelect={(date) => handleBulkDueDateChange(account.id, date)} 
                                                             initialFocus 
                                                         />
                                                     </PopoverContent>
                                                 </Popover>

                                                 {/* Delete Button */}
                                                 <Button 
                                                     variant="destructive" 
                                                     size="sm" 
                                                     className="h-8 text-[10px] font-black uppercase tracking-wider"
                                                     onClick={() => handleBulkDelete(account.id)}
                                                 >
                                                     <Trash2 className="size-3 mr-1" /> Verwijderen
                                                 </Button>
                                             </div>
                                         </div>
                                     )}

                                     <div className="overflow-x-auto">
                                         <table className="w-full text-left text-xs border-collapse">
                                             <thead>
                                                 <tr className="border-b border-white/5 bg-[#0f172a]/20 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                                     <th className="w-10 px-4 py-2.5 text-center">
                                                         <Checkbox 
                                                             checked={accountTodos.length > 0 && (selectedTaskIds[account.id]?.length === accountTodos.length)} 
                                                             onCheckedChange={(checked) => handleSelectAllForAccount(account.id, accountTodos, !!checked)} 
                                                             className="border-slate-700 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                         />
                                                     </th>
                                                     <th className="px-3 py-2.5 min-w-[200px]">Subitem</th>
                                                     <th className="w-12 py-2.5 text-center">Chat</th>
                                                     <th className="w-28 px-3 py-2.5">Uitvoerende</th>
                                                     <th className="w-32 px-3 py-2.5">Status</th>
                                                     <th className="w-28 px-3 py-2.5">Uitvoerdatum</th>
                                                     <th className="w-24 px-4 py-2.5 text-right">Tijd (u)</th>
                                                     <th className="w-10 px-3 py-2.5"></th>
                                                 </tr>
                                             </thead>
                                             <tbody className="divide-y divide-white/5">
                                                 {accountTodos.map((todo) => (
                                                     <tr 
                                                         key={todo.id} 
                                                         className={cn(
                                                             "hover:bg-white/[0.02] transition-colors group",
                                                             todo.status === 'completed' && "opacity-60 bg-green-500/[0.01]"
                                                         )}
                                                     >
                                                         {/* Selection Checkbox */}
                                                         <td className="px-4 py-2 text-center">
                                                             <Checkbox 
                                                                 checked={selectedTaskIds[account.id]?.includes(todo.id) || false} 
                                                                 onCheckedChange={(checked) => handleToggleSelectTask(account.id, todo.id, !!checked)} 
                                                                 className="border-slate-700 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                             />
                                                         </td>

                                                        {/* Task Title Content */}
                                                        <td className="px-3 py-2">
                                                            <input 
                                                                type="text" 
                                                                value={todo.content} 
                                                                className={cn(
                                                                    "w-full bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 px-1 py-0.5 rounded text-xs font-semibold leading-normal",
                                                                    todo.status === 'completed' && "line-through text-slate-500"
                                                                )}
                                                                onChange={e => {
                                                                    const updated = todos.map(t => t.id === todo.id ? { ...t, content: e.target.value } : t);
                                                                    setTodos(updated);
                                                                }}
                                                                onBlur={e => handleTitleChange(todo, e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        (e.target as HTMLInputElement).blur();
                                                                    }
                                                                }}
                                                            />
                                                        </td>

                                                        {/* Chat / Comments */}
                                                        <td className="py-2 text-center">
                                                            <button 
                                                                className={cn(
                                                                    "relative inline-flex items-center justify-center p-1 rounded hover:bg-white/5 transition-all text-slate-500 hover:text-slate-300",
                                                                    todo.comments && todo.comments.length > 0 && "text-blue-400 hover:text-blue-300"
                                                                )}
                                                                onClick={() => openDetailPanel(todo)}
                                                            >
                                                                <MessageSquare className="size-4" />
                                                                {todo.comments && todo.comments.length > 0 && (
                                                                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-black text-white px-0.5 border border-slate-900">
                                                                        {todo.comments.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* Assignee (Uitvoerende) */}
                                                        <td className="px-3 py-2">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 outline-none select-none max-w-full">
                                                                        <Avatar className="size-5 border border-slate-800">
                                                                            {todo.assigneePhotoUrl && <AvatarImage src={todo.assigneePhotoUrl} />}
                                                                            <AvatarFallback className="text-[7px] font-black uppercase bg-slate-800 text-slate-300">
                                                                                {todo.assigneeName ? todo.assigneeName.substring(0, 2).toUpperCase() : <UserPlus className="size-2.5 opacity-55" />}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="truncate text-[10px] hidden md:inline-block max-w-[80px]">
                                                                            {todo.assigneeName ? todo.assigneeName.split(' ')[0] : 'Toewijzen'}
                                                                        </span>
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200 max-h-[250px] overflow-y-auto align-end">
                                                                    <DropdownMenuItem onClick={() => handleAssigneeChange(todo, null)}>
                                                                        De-selecteer (Niemand)
                                                                    </DropdownMenuItem>
                                                                    {teamMembers.map(member => (
                                                                        <DropdownMenuItem key={member.uid} onClick={() => handleAssigneeChange(todo, member)} className="flex items-center gap-2">
                                                                            <Avatar className="size-4 border border-slate-800">
                                                                                {member.photoURL && <AvatarImage src={member.photoURL} />}
                                                                                <AvatarFallback className="text-[7px] bg-slate-800">{member.displayName?.substring(0,2) || 'M'}</AvatarFallback>
                                                                            </Avatar>
                                                                            <span>{member.displayName || member.email}</span>
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-3 py-2">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Badge 
                                                                        variant="outline" 
                                                                        className={cn(
                                                                            "text-[9px] uppercase font-black cursor-pointer px-2 py-0.5 border h-5 truncate select-none",
                                                                            STATUS_OPTIONS.find(o => o.value === (todo.status || 'todo'))?.color
                                                                        )}
                                                                    >
                                                                        {STATUS_OPTIONS.find(o => o.value === (todo.status || 'todo'))?.label || 'Opstarten'}
                                                                    </Badge>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-slate-200">
                                                                    {STATUS_OPTIONS.map((opt) => (
                                                                        <DropdownMenuItem 
                                                                            key={opt.value} 
                                                                            onClick={() => handleStatusChange(todo, opt.value)}
                                                                            className="text-xs uppercase font-bold"
                                                                        >
                                                                            {opt.label}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>

                                                        {/* Date Picker */}
                                                        <td className="px-3 py-2">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <button className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 outline-none select-none font-bold uppercase tracking-wider">
                                                                        <Calendar className="size-3 text-slate-500" />
                                                                        {todo.dueDate ? format(parseISO(todo.dueDate), 'd MMM', { locale: nl }) : 'Kies datum'}
                                                                    </button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="start">
                                                                    <CalendarComponent 
                                                                        mode="single" 
                                                                        selected={todo.dueDate ? parseISO(todo.dueDate) : undefined} 
                                                                        onSelect={date => handleDueDateChange(todo, date)} 
                                                                        initialFocus 
                                                                    />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </td>

                                                        {/* Worked Hours */}
                                                        <td className="px-4 py-2 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="0"
                                                                    defaultValue={todo.workedHours || ''}
                                                                    className="w-10 bg-transparent border-none text-right text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 px-1 py-0.5 rounded text-xs font-mono font-bold"
                                                                    onBlur={e => handleWorkedHoursChange(todo, e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            (e.target as HTMLInputElement).blur();
                                                                        }
                                                                    }}
                                                                />
                                                                <Clock className="size-3 text-slate-600" />
                                                            </div>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md"
                                                                    onClick={() => openDetailPanel(todo)}
                                                                >
                                                                    <Search className="size-3.5" />
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                                                    onClick={() => handleDeleteTask(todo)}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* Inline task adder row */}
                                                <tr className="bg-slate-900/5">
                                                    <td className="px-4 py-3 text-center">
                                                        <Plus className="size-3.5 text-slate-600" />
                                                    </td>
                                                    <td colSpan={7} className="px-3 py-1">
                                                        <input 
                                                            type="text" 
                                                            placeholder="+ Voeg subitem toe..." 
                                                            className="w-full bg-transparent border-none text-slate-400 placeholder:text-slate-600 text-xs focus:outline-none py-1.5 font-medium"
                                                            value={inlineNewTaskText[account.id] || ''}
                                                            onChange={e => setInlineNewTaskText(prev => ({ ...prev, [account.id]: e.target.value }))}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddTask(account, (e.target as HTMLInputElement).value);
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Unified Task Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-xl bg-[#171f33]/95 backdrop-blur-xl border-white/5 text-slate-100 p-6 flex flex-col h-full shadow-2xl overflow-hidden">
                    <SheetHeader className="pb-4 border-b border-white/5 shrink-0">
                        <SheetTitle className="text-xl font-headline text-slate-100">
                            {sheetMode === 'create' ? 'Nieuwe Taak Aanmaken' : 'Taak Details'}
                        </SheetTitle>
                        {sheetMode === 'edit' && selectedTodo && (
                            <SheetDescription className="text-xs text-slate-500">
                                Aangemaakt op {format(parseISO(selectedTodo.createdAt), 'dd MMMM yyyy HH:mm', { locale: nl })}
                            </SheetDescription>
                        )}
                    </SheetHeader>

                    {/* Scrollable details and comment thread */}
                    <div className="flex-grow overflow-y-auto space-y-6 py-6 -mx-6 px-6">
                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-400">Taak Titel <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Wat moet er gebeuren?"
                                    value={sheetTitle}
                                    onChange={e => setSheetTitle(e.target.value)}
                                    className="bg-slate-950/60 border border-slate-800 text-slate-200 text-sm font-medium focus-visible:ring-blue-500/20"
                                    required
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-400">Account <span className="text-red-500">*</span></Label>
                                    <Select 
                                        value={sheetAccountId}
                                        onValueChange={setSheetAccountId}
                                        disabled={sheetMode === 'edit'}
                                    >
                                        <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs text-slate-200 focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 h-[34px]">
                                            <SelectValue placeholder="Selecteer..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            {accounts.filter(a => !a.isPaused).map(acc => {
                                                const client = clients.find(c => c.id === acc.parentClientId);
                                                return (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.nickname} {client ? `(${client.clientName})` : ''}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-400">Status</Label>
                                    <Select 
                                        value={sheetStatus}
                                        onValueChange={(val: any) => setSheetStatus(val)}
                                    >
                                        <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs text-slate-200 focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 h-[34px]">
                                            <SelectValue placeholder="Status..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            {STATUS_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-400">Uitvoerende</Label>
                                    <Select 
                                        value={sheetAssignee}
                                        onValueChange={setSheetAssignee}
                                    >
                                        <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-xs text-slate-200 focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 h-[34px]">
                                            <SelectValue placeholder="Uitvoerende..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                                            <SelectItem value="unassigned">Niet toegewezen</SelectItem>
                                            {teamMembers.map(t => (
                                                <SelectItem key={t.uid} value={t.uid}>{t.displayName || t.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 flex flex-col justify-end">
                                    <Label className="text-xs font-bold text-slate-400 mb-2">Uitvoerdatum</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full bg-slate-950/60 border-slate-800 justify-start text-left font-normal text-xs text-slate-200 hover:bg-slate-900 focus-visible:ring-blue-500/20 h-[34px]">
                                                <Calendar className="mr-2 size-3.5 text-slate-500" />
                                                {sheetDueDate ? format(sheetDueDate, 'd MMMM yyyy', { locale: nl }) : <span>Kies datum...</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="start">
                                            <CalendarComponent 
                                                mode="single" 
                                                selected={sheetDueDate} 
                                                onSelect={setSheetDueDate} 
                                                initialFocus 
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Briefing details */}
                            <div className="space-y-2 pt-2">
                                <Label className="text-xs font-bold text-slate-400">Briefing & Notities</Label>
                                <Textarea 
                                    placeholder="Voeg hier gedetailleerde instructies, links of context toe voor deze taak..."
                                    value={sheetBriefing}
                                    onChange={e => setSheetBriefing(e.target.value)}
                                    className="bg-slate-950/40 border-slate-800 text-slate-200 resize-none h-32 text-sm leading-relaxed focus-visible:ring-blue-500/20"
                                />
                            </div>
                            
                            {/* Opslaan Knop */}
                            <div className="flex justify-end pt-4 pb-2 border-b border-white/5">
                                <Button 
                                    onClick={handleSaveTaskSheet} 
                                    disabled={isSavingSheet || !sheetTitle.trim() || !sheetAccountId}
                                    className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-[10px] h-9 px-6 shadow-lg shadow-blue-500/20 w-full"
                                >
                                    {isSavingSheet ? <Loader2 className="animate-spin size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
                                    {sheetMode === 'create' ? 'Taak Aanmaken' : 'Wijzigingen Opslaan'}
                                </Button>
                            </div>
                        </div>

                        {sheetMode === 'edit' && selectedTodo && (
                            <div className="space-y-4 pt-4">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Reacties</Label>
                                
                                {/* Comments list */}
                                <div className="space-y-4">
                                    {!selectedTodo.comments || selectedTodo.comments.length === 0 ? (
                                        <p className="text-xs text-slate-600 italic">Nog geen reacties geplaatst.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedTodo.comments.map((comment) => (
                                                <div key={comment.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
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
                        )}
                    </div>

                    {/* Comment composer */}
                    {sheetMode === 'edit' && selectedTodo && (
                        <SheetFooter className="pt-4 border-t border-white/5 shrink-0 flex-col sm:flex-col items-stretch gap-3">
                            <div className="space-y-2">
                                <Textarea 
                                    placeholder="Plaats een reactie (kopieer links hierin)..."
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    className="bg-slate-950/40 border-slate-800 text-slate-200 h-20 text-xs resize-none focus-visible:ring-blue-500/20"
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
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}