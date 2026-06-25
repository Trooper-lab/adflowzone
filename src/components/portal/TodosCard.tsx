'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { ParentClient, ChildAccount, Todo } from '@/lib/types';
import type { User } from 'firebase/auth';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, CalendarIcon, ListTodo, X } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

interface TodosCardProps {
    parentClient: ParentClient;
    childAccounts: ChildAccount[];
    user: User;
    onTodoAdded: () => void;
}


function AddTodoForm({ parentClient, childAccounts, onTodoAdded, onCancel }: Omit<TodosCardProps, 'user'> & { onTodoAdded: () => void, onCancel: () => void }) {
    const [newTodoContent, setNewTodoContent] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(childAccounts[0]?.id || null);
    const [dueDate, setDueDate] = useState<Date | undefined>();
    const [loading, setLoading] = useState(false);
    const firestore = useFirestore();

    const handleAddTodo = () => {
        if (!firestore || !newTodoContent.trim() || !selectedAccountId) return;
        
        setLoading(true);
        const selectedAccount = childAccounts.find(acc => acc.id === selectedAccountId);
        if (!selectedAccount) {
            setLoading(false);
            return;
        }
        
        const todoCollection = collection(firestore, 'todos');

        const newTodo: Omit<Todo, 'id'> = {
            ownerId: parentClient.ownerId,
            userId: parentClient.ownerId,
            parentClientId: parentClient.id,
            parentClientName: parentClient.clientName,
            childAccountId: selectedAccountId,
            childAccountNickname: selectedAccount.nickname,
            content: newTodoContent,
            completed: false,
            createdAt: new Date().toISOString(),
            ...(dueDate && { dueDate: dueDate.toISOString() })
        };
        
        addDoc(todoCollection, newTodo)
            .then((docRef) => {
                const childAccountRef = doc(firestore, 'parentClients', parentClient.id, 'childAccounts', selectedAccountId);
                updateDoc(childAccountRef, {
                    pendingTodoIds: arrayUnion(docRef.id)
                }).catch(e => {
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
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="todo-content" className="text-xs">Task</Label>
                <Input 
                    id="todo-content"
                    placeholder="e.g., 'Review new ad creatives'"
                    value={newTodoContent}
                    onChange={(e) => setNewTodoContent(e.target.value)}
                />
            </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label className="text-xs">Account</Label>
                    <Select onValueChange={setSelectedAccountId} defaultValue={selectedAccountId || undefined}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Account..." />
                        </SelectTrigger>
                        <SelectContent>
                            {childAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.nickname}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Due Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !dueDate && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
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
            </div>
                <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onCancel} size="icon">
                    <X className="text-destructive" />
                </Button>
                <Button onClick={handleAddTodo} disabled={loading} size="icon">
                    {loading ? <Loader2 className="animate-spin" /> : <PlusCircle className="text-primary-foreground" />}
                </Button>
            </div>
        </div>
    )
}


export function TodosCard({ parentClient, childAccounts, user, onTodoAdded }: TodosCardProps) {
    const firestore = useFirestore();
    const [isAdding, setIsAdding] = useState(false);
    
    const todosQuery = useMemoFirebase(() => {
        if (!firestore || !parentClient.id) return null;
        return query(
            collection(firestore, 'todos'), 
            where('parentClientId', '==', parentClient.id),
            where('completed', '==', false)
        );
    }, [firestore, parentClient.id, onTodoAdded]); // re-run onTodoAdded
    
    const { data: todos, loading: todosLoading } = useCollection(todosQuery);

    const handleTodoAdded = () => {
        setIsAdding(false);
        onTodoAdded();
    }


    return (
        <Card>
            <CardHeader className="bg-secondary">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">Action Items</CardTitle>
                        <CardDescription>Manage pending tasks</CardDescription>
                    </div>
                     <Button variant="ghost" size="icon" onClick={() => setIsAdding(prev => !prev)}>
                        <PlusCircle className="size-5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-6">
                 <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isAdding ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                 )}>
                     <AddTodoForm 
                        parentClient={parentClient} 
                        childAccounts={childAccounts} 
                        onTodoAdded={handleTodoAdded}
                        onCancel={() => setIsAdding(false)}
                     />
                     <Separator className="my-4" />
                 </div>
                 {todosLoading && <div className="text-sm text-muted-foreground flex items-center justify-center py-4"><Loader2 className="mr-2 animate-spin" />Loading...</div>}
                 
                 {!todosLoading && todos && todos.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No pending action items.</p>}
                 
                 {!todosLoading && todos && todos.length > 0 && (
                    <div className="space-y-3">
                        {(todos as Todo[]).sort((a,b) => (a.dueDate || '') > (b.dueDate || '') ? 1 : -1).map((todo) => (
                            <div key={todo.id} className="flex items-start gap-4 p-3 border rounded-md">
                               <Checkbox id={`todo-${todo.id}`} disabled className="mt-1" />
                                <div className="flex-grow">
                                    <p className="text-sm leading-tight">{todo.content}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="secondary" className="text-xs">{todo.childAccountNickname}</Badge>
                                        {todo.dueDate && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <CalendarIcon className="size-3" />
                                                <span>{format(parseISO(todo.dueDate), 'yyyy-MM-dd')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
            </CardContent>
        </Card>
    );
}
