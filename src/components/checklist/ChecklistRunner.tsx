
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, query, where, getDocs, getDoc, deleteDoc, limit, arrayRemove, Timestamp, writeBatch } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, PlusCircle, CalendarIcon, SkipForward, X, Check, ChevronsRight, ChevronsLeft, ListTodo, MoreHorizontal, Play, Pause, RotateCcw, Clock, ExternalLink, MessageSquare, Trash2, UserPlus } from 'lucide-react';
import type { ChildAccount, ChecklistRunTask, ConnectedChecklist, ChecklistTemplate, ParentClient, Todo, ChecklistRun, AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfDay, isAfter, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


interface ChecklistRunnerProps {
  account: ChildAccount | null;
  checklistId?: string;
  connectedChecklist?: ConnectedChecklist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ChecklistRunner({ account, checklistId, connectedChecklist, open, onOpenChange, onComplete }: ChecklistRunnerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  const isAdmin = (appUser as any)?.role === 'admin';
  const managerId = isAdmin ? user?.uid : (appUser as any)?.managerId;

  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [taskStates, setTaskStates] = useState<Record<string, { completed: boolean; notes: string }>>({});
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [showTodos, setShowTodos] = useState(false);
  
  // Timer State
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [newTodoContent, setNewTodoContent] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [sessionTodos, setSessionTodos] = useState<Todo[]>([]);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [existingRun, setExistingRun] = useState<ChecklistRun | null>(null);

  const parentClientRef = useMemoFirebase(() => {
    if (!firestore || !account) return null;
    return doc(firestore, 'parentClients', account.parentClientId);
  }, [firestore, account]);
  const { data: parentClient } = useDoc(parentClientRef) as { data: ParentClient | null };

  // Metadata state
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [clients, setClients] = useState<ParentClient[]>([]);

  // Todo / Task Detail states
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [briefingText, setBriefingText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Fetch metadata
  useEffect(() => {
    if (!firestore || !open) return;
    const fetchMetadata = async () => {
      try {
        const teamSnap = await getDocs(collection(firestore, 'users'));
        setTeamMembers(teamSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)));

        if (managerId) {
          const clientsSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', managerId)));
          setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient)));
        }
      } catch (e) {
        console.error("Error fetching checklist runner metadata:", e);
      }
    };
    fetchMetadata();
  }, [firestore, open, managerId]);

  const todosQuery = useMemoFirebase(() => {
    if (!firestore || !managerId || !account) return null;
    return query(collection(firestore, 'todos'), where('ownerId', '==', managerId), where('childAccountId', '==', account.id), where('completed', '==', false));
  }, [firestore, managerId, account, open]);
  
  const { data: pendingTodos, loading: todosLoading } = useCollection(todosQuery);

  // Keep activeTodo in sync with real-time updates
  useEffect(() => {
    if (activeTodo && pendingTodos) {
      const match = (pendingTodos as Todo[]).find(t => t.id === activeTodo.id);
      if (match) {
        setActiveTodo(match);
      }
    }
  }, [pendingTodos, activeTodo?.id]);

  const checklistDocRef = useMemoFirebase(() => {
    if (!firestore || !managerId || !checklistId) return null;
    return doc(firestore, 'users', managerId, 'checklistTemplates', checklistId);
  }, [firestore, managerId, checklistId]);

  const { data: checklist, loading: checklistLoading } = useDoc(checklistDocRef);

  // Timer Logic
  useEffect(() => {
    if (timerStatus === 'running') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerStatus]);

  useEffect(() => {
    const findExistingRun = async () => {
        if (!open || !firestore || !user || !account || !checklistId) {
            setExistingRun(null);
            setTimerStatus('idle');
            setElapsedSeconds(0);
            return;
        };

        const todayStart = startOfDay(new Date());

        const runsQuery = query(
            collection(firestore, 'checklistRuns'),
            where('ownerId', '==', user.uid),
            where('childAccountId', '==', account.id),
            where('checklistId', '==', checklistId),
            where('status', '==', 'in_progress'),
            limit(1)
        );

        try {
            const querySnapshot = await getDocs(runsQuery);
            if (!querySnapshot.empty) {
                const runDoc = querySnapshot.docs[0];
                const runData = { id: runDoc.id, ...runDoc.data() } as ChecklistRun;

                let runDate: Date;
                if (runData.runAt && typeof (runData.runAt as any).toDate === 'function') {
                    runDate = (runData.runAt as any).toDate();
                } else if (typeof runData.runAt === 'string') {
                    runDate = parseISO(runData.runAt);
                } else if (runData.runAt instanceof Date) {
                    runDate = runData.runAt;
                } else {
                    runDate = new Date();
                }

                if (isAfter(runDate, todayStart)) {
                    setExistingRun(runData);
                    setElapsedSeconds(runData.durationSeconds || 0);
                    setTimerStatus('running'); // Auto-start if it's already in progress

                    const loadedStates: Record<string, { completed: boolean; notes: string }> = {};
                    runData.tasks.forEach(task => {
                        loadedStates[task.taskId] = { completed: task.completed, notes: task.notes || '' };
                    });
                    setTaskStates(loadedStates);
                } else {
                     setExistingRun(null);
                }

            } else {
                  setExistingRun(null);
                  if (checklist) {
                      const initialStates: Record<string, { completed: boolean; notes: string }> = {};
                    ((checklist as ChecklistTemplate).tasks || []).forEach(task => {
                        initialStates[task.id] = { completed: false, notes: '' };
                    });
                    setTaskStates(initialStates);
                  }
            }
        } catch (error) {
            console.error("Fout bij zoeken naar bestaande run:", error);
            setExistingRun(null);
        }
    };

    findExistingRun();
    
    if (open) {
      setSessionTodos([]);
      setShowTodos(false);
    }
  }, [open, firestore, user, account, checklistId, checklist]);


  const handleTaskChange = (taskId: string, type: 'completed' | 'notes', value: boolean | string) => {
    setTaskStates(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [type]: value },
    }));
  };
  
  const handleToggleTodo = async (todo: Todo) => {
    if (!firestore || !user || !managerId || !account) return;
    
    const todoRef = doc(firestore, 'todos', todo.id);
    const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);

    try {
        await updateDoc(todoRef, { completed: true, completedAt: serverTimestamp(), status: 'completed' });
        await updateDoc(accountRef, {
            pendingTodoIds: arrayRemove(todo.id),
            todoRunIds: arrayUnion(todo.id)
        });
        toast({ title: '🔥 Taak afgerond!', description: 'Lekker bezig.' });
    } catch(e) {
        const permissionError = new FirestorePermissionError({
            path: todoRef.path,
            operation: 'update',
            requestResourceData: { completed: true, status: 'completed' },
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleAddTodo = () => {
    if (!firestore || !user || !managerId || !account || !parentClient || !newTodoContent.trim()) return;
    
    setIsAddingTodo(true);
    const todoCollection = collection(firestore, 'todos');

    const newTodo: Omit<Todo, 'id'> = {
        ownerId: managerId,
        parentClientId: parentClient.id,
        parentClientName: parentClient.clientName,
        childAccountId: account.id,
        childAccountNickname: account.nickname,
        content: newTodoContent,
        completed: false,
        status: 'todo',
        createdAt: new Date().toISOString(),
        ...(dueDate && { dueDate: dueDate.toISOString() })
    };
    
    addDoc(todoCollection, newTodo)
        .then((docRef) => {
            setSessionTodos(prev => [...prev, { ...newTodo, id: docRef.id }]);
            
            const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);
            updateDoc(accountRef, {
                pendingTodoIds: arrayUnion(docRef.id)
            }).catch((e) => {
                  const permissionError = new FirestorePermissionError({
                    path: accountRef.path,
                    operation: 'update',
                    requestResourceData: { pendingTodoIds: arrayUnion(docRef.id) },
                });
                errorEmitter.emit('permission-error', permissionError);
            });

            setNewTodoContent('');
            setDueDate(undefined);
            toast({ title: '➕ Nieuwe taak toegevoegd' });
        })
        .catch((e: any) => {
            const permissionError = new FirestorePermissionError({
                path: todoCollection.path,
                operation: 'create',
                requestResourceData: newTodo,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsAddingTodo(false);
        });
  };

  const syncHoursToTimeEntry = async (todo: Todo, hours: number) => {
    if (!firestore || !managerId) return;
    try {
      const timeEntriesSnap = await getDocs(query(
        collection(firestore, 'timeEntries'),
        where('todoId', '==', todo.id)
      ));
      if (hours > 0) {
        const hourlyRate = parentClient?.hourlyRate || 0;
        const entryData = {
          ownerId: managerId,
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
    if (!firestore || !managerId || !status) return;
    const completed = status === 'completed';
    const completedAt = completed ? new Date().toISOString() : null;
    const todoRef = doc(firestore, 'todos', todo.id);
    const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);
    try {
      await updateDoc(todoRef, { status, completed, completedAt });
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
      if (todo.workedHours && todo.workedHours > 0) {
        await syncHoursToTimeEntry({ ...todo, completedAt: completedAt || undefined }, todo.workedHours);
      }
      setActiveTodo(prev => prev ? { ...prev, status, completed, completedAt: completedAt || undefined } : null);
      toast({ title: 'Status bijgewerkt! ✔️' });
    } catch (e) {
      console.error("Error changing status:", e);
    }
  };

  const handleAssigneeChange = async (todo: Todo, assignee: AppUser | null) => {
    if (!firestore || !managerId) return;
    const todoRef = doc(firestore, 'users', managerId, 'todos', todo.id);
    try {
      const updateData = {
        assigneeId: assignee?.uid || undefined,
        assigneeName: assignee?.displayName || assignee?.email || undefined,
        assigneePhotoUrl: assignee?.photoURL || undefined
      };
      await updateDoc(todoRef, updateData);
      setActiveTodo(prev => prev ? { ...prev, ...updateData } : null);
      toast({ title: 'Toewijzing bijgewerkt!' });
    } catch (e) {
      console.error("Error updating assignee:", e);
    }
  };

  const handleDueDateChange = async (todo: Todo, date: Date | undefined) => {
    if (!firestore || !managerId) return;
    const todoRef = doc(firestore, 'users', managerId, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { dueDate: date ? date.toISOString() : null });
      setActiveTodo(prev => prev ? { ...prev, dueDate: date ? date.toISOString() : undefined } : null);
      toast({ title: 'Uitvoerdatum bijgewerkt!' });
    } catch (e) {
      console.error("Error updating due date:", e);
    }
  };

  const handleWorkedHoursChange = async (todo: Todo, val: string) => {
    if (!firestore || !managerId) return;
    const hours = val === '' ? 0 : parseFloat(val);
    if (isNaN(hours)) return;
    const todoRef = doc(firestore, 'users', managerId, 'todos', todo.id);
    try {
      await updateDoc(todoRef, { workedHours: hours });
      await syncHoursToTimeEntry(todo, hours);
      setActiveTodo(prev => prev ? { ...prev, workedHours: hours } : null);
      toast({ title: 'Gewerkte uren bijgewerkt!' });
    } catch (e) {
      console.error("Error saving worked hours:", e);
    }
  };

  const handleDeleteTask = async (todo: Todo) => {
    if (!firestore || !managerId) return;
    const todoRef = doc(firestore, 'users', managerId, 'todos', todo.id);
    const accountRef = doc(firestore, 'parentClients', todo.parentClientId, 'childAccounts', todo.childAccountId);
    try {
      await deleteDoc(todoRef);
      await updateDoc(accountRef, {
        pendingTodoIds: arrayRemove(todo.id),
        todoRunIds: arrayRemove(todo.id)
      });
      await syncHoursToTimeEntry(todo, 0);
      setIsTaskDetailOpen(false);
      toast({ title: 'Taak verwijderd' });
    } catch (e) {
      console.error("Error deleting todo:", e);
    }
  };

  const handleSaveBriefing = async () => {
    if (!firestore || !managerId || !activeTodo) return;
    setIsSavingDetails(true);
    const todoRef = doc(firestore, 'users', managerId, 'todos', activeTodo.id);
    try {
      await updateDoc(todoRef, { briefing: briefingText });
      setActiveTodo(prev => prev ? { ...prev, briefing: briefingText } : null);
      toast({ title: 'Briefing opgeslagen' });
    } catch (e) {
      console.error("Error saving briefing:", e);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleAddComment = async () => {
    if (!firestore || !managerId || !activeTodo || !commentText.trim()) return;
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      userId: user?.uid || '',
      userName: appUser?.displayName || user?.displayName || user?.email || 'Onbekend',
      userPhotoUrl: user?.photoURL || undefined,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };
    const todoRef = doc(firestore, 'users', managerId, 'todos', activeTodo.id);
    try {
      const updatedComments = [...(activeTodo.comments || []), newComment];
      await updateDoc(todoRef, { comments: updatedComments });
      setActiveTodo(prev => prev ? { ...prev, comments: updatedComments } : null);
      setCommentText('');
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

  const openTodoDetail = (todo: Todo) => {
    setActiveTodo(todo);
    setBriefingText(todo.briefing || '');
    setCommentText('');
    setIsTaskDetailOpen(true);
  };

    const handleSkip = async () => {
    if (!firestore || !user || !account || !connectedChecklist || !checklist) return;

    setSkipping(true);
    setTimerStatus('paused');

    const batch = writeBatch(firestore);
    const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);
    const runsCollection = collection(firestore, 'checklistRuns');

    // Finding the exact connection to update its lastRunAt
    const originalChecklist = (account.connectedChecklists || []).find(c => 
        c.checklistId === connectedChecklist.checklistId && 
        c.startDate === connectedChecklist.startDate
    );

    if (!originalChecklist) {
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon de checklist niet vinden om over te slaan.' });
      setSkipping(false);
      return;
    }

    const updatedChecklist = { 
        ...originalChecklist, 
        lastRunAt: new Date().toISOString(),
        skipCount: (originalChecklist.skipCount || 0) + 1
    };
    
    const newConnectedChecklists = (account.connectedChecklists || []).map(c => 
        (c.checklistId === connectedChecklist.checklistId && c.startDate === connectedChecklist.startDate)
        ? updatedChecklist
        : c
    );

    const skipRunData = {
      ownerId: user.uid,
      managerId: managerId || user.uid,
      childAccountId: account.id,
      parentClientId: account.parentClientId,
      checklistId: checklist.id,
      status: 'skipped',
      completedByName: (appUser as any)?.displayName || user?.displayName || user?.email || 'Unknown',
      runAt: existingRun ? existingRun.runAt : serverTimestamp(),
      completedAt: serverTimestamp(),
      durationSeconds: elapsedSeconds,
      tasks: ((checklist as ChecklistTemplate).tasks || []).map(t => ({
          taskId: t.id,
          description: t.description,
          completed: false,
          notes: 'Checklist overgeslagen via Skip knop.'
      }))
    };

    try {
      if (existingRun) {
          const runRef = doc(firestore, 'checklistRuns', existingRun.id);
          batch.update(runRef, skipRunData);
      } else {
          const newRunRef = doc(runsCollection);
          batch.set(newRunRef, skipRunData);
          batch.update(accountRef, { 
              checklistRunIds: arrayUnion(newRunRef.id)
          });
      }

      batch.update(accountRef, { 
          connectedChecklists: newConnectedChecklists,
      });
      
      await batch.commit();

      toast({
        title: 'Checklist overgeslagen',
        description: `"${(checklist as ChecklistTemplate).name}" is gelogd als overgeslagen en verplaatst naar de volgende cyclus.`,
      });
      
      onOpenChange(false);
      onComplete(); 
    } catch (e) {
      console.error('Fout bij overslaan checklist:', e);
      const permissionError = new FirestorePermissionError({
        path: accountRef.path,
        operation: 'update',
        requestResourceData: { status: 'skipped' },
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setSkipping(false);
    }
  };


  const handleSave = async () => {
    if (!firestore || !user || !account || !checklist) return;

    setLoading(true);
    setTimerStatus('paused');

    const runTasks: ChecklistRunTask[] = ((checklist as ChecklistTemplate).tasks || []).map(task => ({
      taskId: task.id,
      description: task.description,
      completed: taskStates[task.id]?.completed || false,
      notes: taskStates[task.id]?.notes || '',
    }));
    
    const allCompleted = runTasks.every(t => t.completed);

    const checklistRunData = {
      ownerId: user.uid,
      managerId: managerId || user.uid,
      childAccountId: account.id,
      parentClientId: account.parentClientId,
      checklistId: checklist.id,
      status: allCompleted ? 'complete' : 'in_progress',
      completedByName: (appUser as any)?.displayName || user?.displayName || user?.email || 'Unknown',
      tasks: runTasks,
      durationSeconds: elapsedSeconds,
    };
    
    try {
      if (existingRun) {
        const runRef = doc(firestore, 'checklistRuns', existingRun.id);
        await updateDoc(runRef, {
            ...checklistRunData,
            completedAt: allCompleted ? serverTimestamp() : null,
        });
      } else {
        const runRef = await addDoc(collection(firestore, 'checklistRuns'), {
            ...checklistRunData,
            runAt: serverTimestamp(),
            completedAt: allCompleted ? serverTimestamp() : null,
        });
        const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);
        await updateDoc(accountRef, {
            checklistRunIds: arrayUnion(runRef.id)
        });
      }

      // Update auto-planner if it was completed
      if (allCompleted && connectedChecklist) {
          const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);
          const updates: any = {};
          updates.connectedChecklists = (account.connectedChecklists || []).map(c => 
              (c.checklistId === connectedChecklist.checklistId && c.startDate === connectedChecklist.startDate)
              ? { ...c, lastRunAt: new Date().toISOString() }
              : c
          );
          await updateDoc(accountRef, updates);
      }
        
        toast({
            title: allCompleted ? '✨ Checklist Voltooid!' : '💾 Voortgang Bewaard',
            description: allCompleted ? `Inclusief ${formatTime(elapsedSeconds)} aan werk.` : 'Je kunt later verdergaan.',
        });
        
        onOpenChange(false);
        if (onComplete) {
            onComplete();
        }
    } catch (e) {
      console.error('Fout bij opslaan checklist run:', e);
      const permissionError = new FirestorePermissionError({
        path: `/checklistRuns`,
        operation: existingRun ? 'update' : 'create',
        requestResourceData: checklistRunData,
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedCount = Object.values(taskStates).filter(t => t.completed).length;
  const totalCount = checklist ? ((checklist as ChecklistTemplate).tasks || []).length : 0;
  const progressValue = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (checklistLoading || !account || !checklist || !parentClient) {
    return null;
  }

  const template = checklist as ChecklistTemplate;
  const allCompleted = completedCount === totalCount;


  return (
    <Sheet 
      open={open} 
      onOpenChange={(val) => {
        if (!val && timerStatus === 'running') {
          toast({
            variant: 'destructive',
            title: 'Timer loopt nog',
            description: 'Pauzeer de timer voordat je de checklist sluit om de voortgang veilig te stellen.',
          });
          return;
        }
        onOpenChange(val);
      }}
    >
       <SheetContent 
         className={cn(
           "w-full sm:max-w-2xl flex flex-col bg-[#171f33]/95 border-border text-slate-50 p-0 transition-all duration-500 ease-in-out [&>button]:hidden", 
           showTodos && "sm:max-w-5xl"
         )}
         onPointerDownOutside={(e) => {
           if (timerStatus === 'running') e.preventDefault();
         }}
         onEscapeKeyDown={(e) => {
           if (timerStatus === 'running') e.preventDefault();
         }}
       >
         {/* Custom Close Button that is only visible when NOT running */}
         {timerStatus !== 'running' && (
           <button 
             onClick={() => onOpenChange(false)}
             className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary z-50 text-slate-400"
           >
             <X className="h-4 w-4" />
             <span className="sr-only">Close</span>
           </button>
         )}

         <div className="flex w-full h-full overflow-hidden">
            <div className={cn("w-full flex flex-col flex-shrink-0 border-r border-border transition-all duration-500", showTodos ? "sm:w-3/5" : "sm:w-full")}>
                
                {timerStatus === 'idle' ? (
                    <div className="flex-grow flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Checklist Starten: {template.name}</SheetTitle>
                            <SheetDescription>Bereid je voor op de optimalisatie van {account.nickname}.</SheetDescription>
                        </SheetHeader>
                        <div className="p-6 rounded-full bg-blue-500/10 border-2 border-blue-500/20 ring-8 ring-blue-500/5">
                            <Clock className="size-16 text-blue-400" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold font-headline text-slate-100">Klaar om te knallen?</h2>
                            <p className="text-slate-400 max-w-sm mx-auto">Start de timer om te beginnen aan de optimalisatie voor <span className="text-blue-400 font-bold">{account.nickname}</span>.</p>
                        </div>
                        <div className="flex flex-col gap-4 w-full max-w-xs">
                            <Button 
                                onClick={() => setTimerStatus('running')} 
                                size="lg" 
                                className="h-20 text-xl font-black bg-primary text-primary-foreground shadow-2xl shadow-primary/20 active:scale-95 transition-all group"
                            >
                                <Play className="size-6 mr-3 fill-current" /> Timer Starten
                            </Button>
                            <Button 
                                variant="ghost"
                                size="lg"
                                onClick={handleSkip}
                                disabled={skipping}
                                className="text-slate-400 hover:text-white hover:bg-secondary font-bold uppercase tracking-widest text-xs h-12"
                            >
                                {skipping ? <Loader2 className="animate-spin size-4 mr-2" /> : <SkipForward className="size-4 mr-2" />}
                                Nu overslaan
                            </Button>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] uppercase font-black tracking-widest text-slate-600">
                            <span>Geen afleiding</span>
                            <span className="size-1 bg-slate-800 rounded-full" />
                            <span>Focus modus</span>
                            <span className="size-1 bg-slate-800 rounded-full" />
                            <span>Tijdregistratie</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <SheetHeader className="p-6 pb-0">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase text-[10px] font-bold tracking-widest px-2 py-0">Checklist</Badge>
                                        <span className="text-xs text-slate-500">•</span>
                                        <span className="text-xs text-slate-400 font-medium">{parentClient.clientName}</span>
                                    </div>
                                    <SheetTitle className="font-headline text-3xl text-slate-50 leading-tight animate-in fade-in slide-in-from-left-2 duration-700">{template.name}</SheetTitle>
                                </div>
                                
                                <div className={cn(
                                    "flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-500",
                                    timerStatus === 'running' ? "bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : "bg-yellow-500/10 border-yellow-500/30"
                                )}>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Timer</p>
                                        <p className={cn("text-xl font-mono font-bold tabular-nums", timerStatus === 'running' ? "text-blue-400" : "text-yellow-400")}>
                                            {formatTime(elapsedSeconds)}
                                        </p>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="size-10 rounded-full hover:bg-accent"
                                        onClick={() => setTimerStatus(timerStatus === 'running' ? 'paused' : 'running')}
                                    >
                                        {timerStatus === 'running' ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                    <span className="flex items-center gap-2">Voortgang {allCompleted && <Check className="size-3 text-green-400 animate-bounce" />}</span>
                                    <span className={cn("transition-colors duration-500", allCompleted ? "text-green-400" : "text-blue-400")}>{completedCount}/{totalCount} Taken</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border">
                                    <div 
                                        className={cn("h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(77,142,255,0.3)]", allCompleted ? "bg-emerald-400" : "bg-primary")}
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>
                        </SheetHeader>
                        
                        <ScrollArea className="flex-grow mt-4">
                            <div className="space-y-4 px-6 py-4">
                                {(template.tasks || []).map((task, index) => {
                                    const isCompleted = taskStates[task.id]?.completed;
                                    return (
                                        <div 
                                            key={task.id} 
                                            className={cn(
                                                "p-4 border rounded-xl space-y-3 transition-all duration-300 transform", 
                                                isCompleted 
                                                    ? 'bg-emerald-500/[0.03] border-emerald-500/20 opacity-80' 
                                                    : 'bg-white/[0.03] border-border shadow-sm hover:border-border',
                                                "animate-in fade-in slide-in-from-bottom-2 duration-500"
                                            )}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="flex items-start gap-4">
                                                <button
                                                    onClick={() => handleTaskChange(task.id, 'completed', !isCompleted)}
                                                    className={cn(
                                                        "flex-shrink-0 size-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 active:scale-75",
                                                        isCompleted 
                                                            ? 'bg-green-500 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-110' 
                                                            : 'border-slate-600 text-slate-500 hover:border-blue-500 hover:text-blue-400'
                                                    )}
                                                >
                                                    {isCompleted ? <Check className="size-5 animate-in zoom-in duration-300" /> : <span className="text-xs font-bold">{index + 1}</span>}
                                                </button>
                                                <div className="flex-grow space-y-1">
                                                    <Label 
                                                        htmlFor={`task-${task.id}`} 
                                                        className={cn(
                                                            "text-[15px] font-bold leading-snug block transition-all duration-500", 
                                                            isCompleted ? 'text-slate-500 line-through' : 'text-slate-200 cursor-pointer'
                                                        )}
                                                        onClick={() => handleTaskChange(task.id, 'completed', !isCompleted)}
                                                    >
                                                        {task.description}
                                                    </Label>
                                                    {!isCompleted && !taskStates[task.id]?.notes && activeNote !== task.id && (
                                                        <button 
                                                            onClick={() => setActiveNote(task.id)} 
                                                            className="text-[10px] uppercase tracking-widest text-blue-400/70 hover:text-blue-400 flex items-center gap-1.5 mt-1.5 font-black transition-colors"
                                                        >
                                                            <PlusCircle className="size-3" />
                                                            Notitie toevoegen
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {(activeNote === task.id || taskStates[task.id]?.notes) && (
                                                <div className="pl-12 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="relative group">
                                                        <Textarea
                                                            id={`notes-${task.id}`}
                                                            placeholder="Maak een observatie of notitie voor het rapport..."
                                                            value={taskStates[task.id]?.notes}
                                                            onChange={(e) => handleTaskChange(task.id, 'notes', e.target.value)}
                                                            className="mt-1 bg-[#0b1326]/50 border-border focus:border-primary/30 focus-visible:ring-primary/10 text-slate-200 text-sm placeholder:text-slate-600 min-h-[100px] rounded-lg transition-all"
                                                            onBlur={() => !taskStates[task.id]?.notes && setActiveNote(null)}
                                                            autoFocus
                                                        />
                                                        {taskStates[task.id]?.notes && (
                                                            <button 
                                                                onClick={() => { handleTaskChange(task.id, 'notes', ''); setActiveNote(null); }}
                                                                className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-md"
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                        
                        <SheetFooter className="gap-3 p-6 bg-[#171f33] border-t border-border sm:justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
                            <div className="flex gap-2">
                                <button 
                                    className={cn(
                                        "flex items-center text-slate-400 hover:text-white px-3 active:scale-95 transition-all rounded-lg font-bold text-xs uppercase tracking-wider", 
                                        showTodos && "bg-slate-800 text-white shadow-inner"
                                    )} 
                                    onClick={() => setShowTodos(p => !p)}
                                >
                                    <ListTodo className="mr-2 size-4" />
                                    Taken {pendingTodos && pendingTodos.length > 0 && <Badge className="ml-2 bg-blue-600 text-white h-5 px-1.5 min-w-[20px] justify-center text-[10px] animate-pulse border-none">{pendingTodos.length}</Badge>}
                                </button>
                                <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-secondary active:scale-95 transition-all rounded-lg font-bold text-xs uppercase tracking-wider" onClick={handleSkip} disabled={skipping || loading}>
                                    {skipping ? <Loader2 className="animate-spin size-4 mr-2" /> : <SkipForward className="size-4 mr-2" />}
                                    Overslaan
                                </Button>
                            </div>
                            <Button 
                                onClick={handleSave} 
                                className={cn(
                                    "font-black px-10 shadow-xl active:scale-95 transition-all duration-300 rounded-lg h-12 uppercase tracking-[0.15em] text-xs",
                                    allCompleted 
                                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" 
                                        : "bg-primary text-primary-foreground"
                                )} 
                                disabled={loading || skipping}
                            >
                                {loading ? <Loader2 className="animate-spin size-4 mr-2" /> : (allCompleted ? <Check className="size-4 mr-2" /> : <Save className="size-4 mr-2" />)}
                                {allCompleted ? "Opslaan & Afronden" : "Voortgang Bewaren"}
                            </Button>
                        </SheetFooter>
                    </>
                )}
            </div>

             <div className={cn("w-full sm:w-2/5 flex flex-col flex-shrink-0 bg-[#171f33]/90 transition-all duration-500 border-l border-border ease-in-out", !showTodos && "hidden translate-x-full opacity-0")}>
                <div className="p-6 pb-2">
                    <h3 className="text-2xl font-bold font-headline text-slate-100 flex items-center gap-3">
                        <ListTodo className="text-blue-400 size-6" />
                        Openstaande Taken
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.2em] font-black">Account Specifiek</p>
                </div>
                 <ScrollArea className="flex-grow">
                    <div className="space-y-2.5 px-6 py-4">
                        {todosLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                        ) : (
                             (pendingTodos as Todo[] || []).length > 0 ? (pendingTodos as Todo[]).map((todo, i) => (
                                <div 
                                    key={todo.id} 
                                    className="p-3.5 rounded-xl bg-white/[0.02] border border-border flex items-start gap-3 group hover:border-primary/30 transition-all hover:bg-white/[0.04] animate-in fade-in slide-in-from-right-4 duration-500"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    <Checkbox 
                                        id={`todo-runner-${todo.id}`} 
                                        className="mt-1 border-slate-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" 
                                        onCheckedChange={() => handleToggleTodo(todo)}
                                    />
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start gap-2">
                                            <Label htmlFor={`todo-runner-${todo.id}`} className="text-sm font-bold text-slate-300 leading-tight block cursor-pointer group-hover:text-slate-100 transition-colors">{todo.content}</Label>
                                            <button 
                                                className={cn(
                                                    "relative inline-flex items-center justify-center p-1 rounded hover:bg-secondary transition-all text-slate-500 hover:text-slate-300 shrink-0",
                                                    todo.comments && todo.comments.length > 0 && "text-blue-400 hover:text-blue-300"
                                                )}
                                                onClick={() => openTodoDetail(todo)}
                                            >
                                                <MessageSquare className="size-3.5" />
                                                {todo.comments && todo.comments.length > 0 && (
                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-[7px] font-black text-white px-0.5 border border-slate-900">
                                                        {todo.comments.length}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                            {/* Status Badge */}
                                            <Badge variant="outline" className={cn(
                                                "text-[8px] py-0 px-1 border h-4 font-black uppercase rounded",
                                                todo.status === 'in_progress' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                                                todo.status === 'on_hold' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            )}>
                                                {todo.status === 'in_progress' ? 'Lopend' : todo.status === 'on_hold' ? 'Wachtend' : 'Opstarten'}
                                            </Badge>

                                            {/* Due Date */}
                                            {todo.dueDate && (
                                                <span className="flex items-center gap-1">
                                                    <CalendarIcon className="size-2.5 text-slate-600" />
                                                    {format(parseISO(todo.dueDate), 'dd MMM')}
                                                </span>
                                            )}

                                            {/* Worked Hours */}
                                            {todo.workedHours && todo.workedHours > 0 ? (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock className="size-2.5 text-slate-600" />
                                                    {todo.workedHours}u
                                                </span>
                                            ) : null}

                                            {/* Assignee Avatar */}
                                            {todo.assigneeName && (
                                                <span className="flex items-center gap-1 text-[8px] text-slate-400 ml-auto normal-case font-medium">
                                                    <Avatar className="size-3.5 border border-slate-800 shrink-0">
                                                        {todo.assigneePhotoUrl && <AvatarImage src={todo.assigneePhotoUrl} />}
                                                        <AvatarFallback className="text-[5px] bg-slate-800 text-slate-300">
                                                            {todo.assigneeName.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate max-w-[60px]">{todo.assigneeName.split(' ')[0]}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-16 px-4 border-2 border-dashed border-border rounded-3xl animate-in fade-in duration-1000">
                                    <div className="p-4 rounded-full bg-secondary w-fit mx-auto mb-4 border border-border">
                                        <Check className="size-8 text-slate-700" />
                                    </div>
                                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest leading-relaxed">Alles onder controle</p>
                                </div>
                            )
                        )}
                    </div>
                 </ScrollArea>
                 <div className="p-6 border-t border-border bg-[#0f172a]/50">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Nieuwe actie vastleggen</h4>
                     <div className="space-y-4">
                        <Input
                            placeholder="Wat moet er nog gebeuren?"
                            value={newTodoContent}
                            onChange={(e) => setNewTodoContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                            className="bg-[#0b1326]/50 border-border focus:border-primary/30 focus-visible:ring-primary/10 text-slate-200 h-11 text-sm placeholder:text-slate-600 rounded-lg transition-all"
                        />
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    size="sm"
                                    className={cn(
                                        "flex-grow justify-start text-left font-bold border border-border bg-[#0b1326]/50 hover:bg-secondary h-10 text-[10px] uppercase tracking-widest rounded-lg transition-all",
                                        !dueDate && "text-slate-500"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {dueDate ? format(dueDate, "dd MMM") : <span>Deadline</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-50" align="end">
                                    <Calendar
                                    mode="single"
                                    selected={dueDate}
                                    onSelect={setDueDate}
                                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={handleAddTodo} disabled={isAddingTodo || !newTodoContent.trim()} size="sm" className="bg-primary text-primary-foreground font-black h-10 px-6 rounded-lg active:scale-90 transition-all shadow-lg shadow-primary/10">
                                {isAddingTodo ? <Loader2 className="animate-spin size-4" /> : <PlusCircle className="size-4 mr-2" />}
                                Toevoegen
                            </Button>
                        </div>
                        {sessionTodos.length > 0 && (
                            <div className="space-y-2 pt-2">
                                {sessionTodos.slice(-2).map(todo => (
                                    <div key={todo.id} className="flex items-center text-[10px] bg-green-500/10 text-green-400 p-2.5 rounded-lg border border-green-500/20 animate-in fade-in slide-in-from-bottom-2 duration-500 uppercase font-black tracking-widest">
                                        <Check className="size-3 mr-2.5 flex-shrink-0" />
                                        <span className="truncate flex-grow">{todo.content}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
         </div>
       </SheetContent>

      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="w-full sm:max-w-2xl bg-[#171f33]/95 border-border text-slate-100 p-6 flex flex-col h-[85vh] max-h-[85vh] shadow-2xl overflow-hidden">
          {activeTodo && (
            <>
              <DialogHeader className="pb-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-black">
                    <span>{activeTodo.parentClientName}</span>
                    <span>/</span>
                    <span className="text-blue-400">{activeTodo.childAccountNickname}</span>
                  </div>
                </div>
                <DialogTitle className="text-2xl font-headline text-slate-100 mt-2 leading-snug">{activeTodo.content}</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Aangemaakt op {activeTodo.createdAt ? format(parseISO(activeTodo.createdAt), 'dd MMMM yyyy HH:mm', { locale: nl }) : '-'}
                </DialogDescription>
              </DialogHeader>

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
                            <CalendarIcon className="size-3 text-slate-500" />
                            {activeTodo.dueDate ? format(parseISO(activeTodo.dueDate), 'd MMM', { locale: nl }) : 'Kies datum'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 text-slate-200" align="start">
                          <Calendar 
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
                    className="bg-slate-950/40 border-slate-800 text-slate-200 resize-none h-24 text-sm leading-relaxed"
                  />
                  <div className="flex justify-between items-center">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(activeTodo)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold uppercase tracking-widest text-[9px] h-8 transition-colors"
                    >
                      <Trash2 className="size-3.5 mr-1.5" /> Verwijder Taak
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveBriefing} 
                      disabled={isSavingDetails || briefingText === (activeTodo.briefing || '')}
                      className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-[9px] h-8 px-4"
                    >
                      {isSavingDetails ? <Loader2 className="animate-spin size-3" /> : 'Opslaan'}
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
              <DialogFooter className="pt-4 border-t border-border shrink-0 flex-col sm:flex-col items-stretch gap-3">
                <div className="space-y-2">
                  <Textarea 
                    placeholder="Plaats een reactie (kopieer links hierin)..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="bg-slate-950/40 border-slate-800 text-slate-200 h-16 text-xs resize-none"
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
