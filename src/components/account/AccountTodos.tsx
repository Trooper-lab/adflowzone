'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Todo, ChildAccount, ParentClient } from '@/lib/types';
import { parseISO, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Book, Loader2, Pencil, Trash2, Calendar as CalendarIcon, PlusCircle } from 'lucide-react';

interface EditTodoDialogProps {
    todo: Todo;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

function EditTodoDialog({ todo, open, onOpenChange, onSaved }: EditTodoDialogProps) {
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

interface AccountTodosProps {
    parentClient: ParentClient;
    childAccount: ChildAccount;
    childAccountRef: any;
    onRefetchNeeded: () => void;
}

export default function AccountTodos({ parentClient, childAccount, childAccountRef, onRefetchNeeded }: AccountTodosProps) {
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
