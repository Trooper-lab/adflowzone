
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, doc, deleteDoc, getDocs, writeBatch, arrayUnion, arrayRemove, Timestamp, collectionGroup } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChecklistTemplate, Task, ChildAccount, ParentClient, ConnectedChecklist, ChecklistRun, AppUser } from '@/lib/types';
import { Check, PlusCircle, NotebookPen, MoreHorizontal, Pencil, Trash2, X, Loader2, Users, CalendarIcon, History, View, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isToday, isPast, setDay, addWeeks, setDate, addMonths, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ChecklistRunViewer } from '@/components/checklist/ChecklistRunViewer';


type ChildAccountWithParentName = ChildAccount & { parentName: string };

type ConnectionDetails = Partial<Omit<ConnectedChecklist, 'checklistId' | 'lastRunAt' | 'startDate'>> & {
    dayOfWeek?: string;
    dayOfMonth?: string;
    startDate?: Date | string;
};

type ConnectionState = {
    [accountId: string]: ConnectionDetails | null; // null means disconnect
};

function AssignAccountsDialog({ checklist, accounts, open, onOpenChange }: { checklist: ChecklistTemplate, accounts: ChildAccountWithParentName[], open: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const initialConnections = useMemo(() => {
        const connections: ConnectionState = {};
        accounts.forEach(acc => {
            const existing = acc.connectedChecklists?.find(c => c.checklistId === checklist.id);
            if (existing) {
                 const startDate = parseISO(existing.startDate);
                 let dayOfWeek, dayOfMonth;

                 if (existing.frequency === 'weekly') {
                     dayOfWeek = startDate.getDay().toString();
                 } else if (existing.frequency === 'monthly') {
                     dayOfMonth = startDate.getDate().toString();
                 }

                connections[acc.id] = { 
                    ...existing,
                    startDate: startDate,
                    dayOfWeek,
                    dayOfMonth
                };
            }
        });
        return connections;
    }, [accounts, checklist.id]);

    const [connections, setConnections] = useState<ConnectionState>(initialConnections);

    useEffect(() => {
        setConnections(initialConnections);
    }, [initialConnections]);
    
    const accountsByParent = useMemo(() => {
        return accounts.reduce((acc, account) => {
            const parentName = account.parentName || 'Onbekende Klant';
            if (!acc[parentName]) {
                acc[parentName] = [];
            }
            acc[parentName].push(account);
            return acc;
        }, {} as Record<string, ChildAccountWithParentName[]>);
    }, [accounts]);

    const handleAccountToggle = (accountId: string, isChecked: boolean) => {
        setConnections(prev => {
            const newConnections = { ...prev };
            if (isChecked) {
                newConnections[accountId] = { frequency: 'weekly', dayOfWeek: '1' }; // Default to weekly on Monday
            } else {
                newConnections[accountId] = null; // Mark for disconnection
            }
            return newConnections;
        });
    };
    
    const handleDetailChange = (accountId: string, field: keyof ConnectionDetails, value: any) => {
         setConnections(prev => {
            const accountConnection = prev[accountId];
            if (!accountConnection) return prev;

            const newConnection = { ...accountConnection, [field]: value };
            
            // Reset day selection if frequency changes
            if (field === 'frequency') {
                delete newConnection.dayOfWeek;
                delete newConnection.dayOfMonth;
                delete newConnection.startDate;
            }
            
            return { ...prev, [accountId]: newConnection };
        });
    }

    const getNextDate = (freq: string, start?: Date, dayValue?: string): Date => {
        const now = new Date();
        let nextDate = start || now;
    
        if (freq === 'weekly' && dayValue) {
            const desiredDay = parseInt(dayValue);
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
    };


    const handleSaveChanges = async () => {
        if (!firestore) return;
        setLoading(true);

        try {
            const batch = writeBatch(firestore);

            for (const accountId in connections) {
                const details = connections[accountId];
                const originalDetails = initialConnections[accountId];
                const account = accounts.find(acc => acc.id === accountId);
                
                if (!account) continue;

                const accountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);

                if (details === null && originalDetails) { // Disconnect
                    const connectionToRemove = account.connectedChecklists?.find(c => c.checklistId === checklist.id);
                    if (connectionToRemove) {
                        batch.update(accountRef, { connectedChecklists: arrayRemove(connectionToRemove) });
                    }
                } else if (details) { // Connect or Update
                    const { frequency, startDate, dayOfWeek, dayOfMonth } = details;
                    if (!frequency) continue;
                    
                    let finalStartDate: Date | undefined = typeof startDate === 'string' ? parseISO(startDate) : startDate;
                    if (frequency === 'weekly' || frequency === 'monthly') {
                        finalStartDate = getNextDate(frequency, finalStartDate, dayOfWeek || dayOfMonth);
                    }
                    if (!finalStartDate) finalStartDate = new Date();

                    const newConnection: ConnectedChecklist = {
                        checklistId: checklist.id,
                        frequency,
                        startDate: finalStartDate.toISOString(),
                    };

                    if (originalDetails) { // Update
                        const connectionToRemove = account.connectedChecklists?.find(c => c.checklistId === checklist.id);
                        if (connectionToRemove) {
                             batch.update(accountRef, { connectedChecklists: arrayRemove(connectionToRemove) });
                        }
                    }
                    
                    batch.update(accountRef, { connectedChecklists: arrayUnion(newConnection) });
                }
            }

            await batch.commit();
            toast({ title: 'Koppelingen bijgewerkt', description: 'De checklist-toewijzingen zijn opgeslagen.' });
            onOpenChange(false);
        } catch (e) {
            console.error("Error updating account connections:", e);
            toast({ variant: 'destructive', title: 'Fout', description: 'Kon wijzigingen niet opslaan.' });
        } finally {
            setLoading(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>"{checklist.name}" Toewijzen</DialogTitle>
                    <DialogDescription>
                        Selecteer accounts en configureer het schema voor deze checklist.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <div className="space-y-6 py-4">
                        {Object.entries(accountsByParent).sort(([a], [b]) => a.localeCompare(b)).map(([parentName, childAccounts]) => (
                            <div key={parentName} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none px-2 py-0.5 uppercase text-[10px] font-bold tracking-widest">
                                        Klant
                                    </Badge>
                                    <h4 className="font-bold text-sm text-slate-300">{parentName}</h4>
                                </div>
                                <div className="space-y-2 border-l-2 border-slate-800 ml-2 pl-4">
                                {childAccounts.map(account => {
                                    const isConnected = !!connections[account.id];
                                    const details = connections[account.id];

                                    return (
                                        <Accordion key={account.id} type="single" collapsible disabled={!isConnected} className="rounded-md overflow-hidden bg-secondary border border-border">
                                           <AccordionItem value="item-1" className="border-b-0">
                                            <div className="flex items-center space-x-3 px-4 py-2 hover:bg-secondary transition-colors">
                                                    <Checkbox
                                                        id={`acc-${account.id}`}
                                                        checked={isConnected}
                                                        onCheckedChange={(checked) => handleAccountToggle(account.id, !!checked)}
                                                        className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                                    />
                                                    <Label htmlFor={`acc-${account.id}`} className={cn("font-medium flex-grow cursor-pointer text-sm", isConnected ? "text-slate-100" : "text-slate-500")}>
                                                        {account.nickname}
                                                    </Label>
                                                    {isConnected && (
                                                        <AccordionTrigger className="p-0 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                                                            <span className="text-[10px] font-bold text-blue-400 mr-2 uppercase tracking-tighter">Schema</span>
                                                        </AccordionTrigger>
                                                    )}
                                                </div>
                                                
                                                {isConnected && (
                                                    <AccordionContent className="px-4 pb-4 pt-2">
                                                        <div className="grid grid-cols-2 gap-4 items-end p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Frequentie</Label>
                                                                <Select value={details?.frequency} onValueChange={(val) => handleDetailChange(account.id, 'frequency', val)}>
                                                                    <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700"><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="one-off">Eenmalig</SelectItem>
                                                                        <SelectItem value="daily">Dagelijks</SelectItem>
                                                                        <SelectItem value="weekly">Wekelijks</SelectItem>
                                                                        <SelectItem value="monthly">Maandelijks</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            { (details?.frequency === 'daily' || details?.frequency === 'one-off') && (
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Startdatum</Label>
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant={"outline"} className={cn("w-full h-8 justify-start text-left font-normal text-xs bg-slate-900 border-slate-700", !details.startDate && "text-slate-500")}>
                                                                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                                                {details.startDate ? format(details.startDate, "dd MMM yyyy") : <span>Kies datum</span>}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={details.startDate as Date | undefined} onSelect={(d: any) => handleDetailChange(account.id, 'startDate', d)} initialFocus /></PopoverContent>
                                                                    </Popover>
                                                                </div>
                                                            )}

                                                            { details?.frequency === 'weekly' && (
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dag v/d Week</Label>
                                                                    <Select value={details.dayOfWeek} onValueChange={(val) => handleDetailChange(account.id, 'dayOfWeek', val)}>
                                                                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700"><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="1">Maandag</SelectItem>
                                                                            <SelectItem value="2">Dinsdag</SelectItem>
                                                                            <SelectItem value="3">Woensdag</SelectItem>
                                                                            <SelectItem value="4">Donderdag</SelectItem>
                                                                            <SelectItem value="5">Vrijdag</SelectItem>
                                                                            <SelectItem value="6">Zaterdag</SelectItem>
                                                                            <SelectItem value="0">Zondag</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                            { details?.frequency === 'monthly' && (
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dag v/d Maand</Label>
                                                                    <Select value={details.dayOfMonth} onValueChange={(val) => handleDetailChange(account.id, 'dayOfMonth', val)}>
                                                                        <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700"><SelectValue placeholder="Dag..." /></SelectTrigger>
                                                                        <SelectContent>
                                                                            {Array.from({length: 28}, (_, i) => i + 1).map(day => <SelectItem key={day} value={day.toString()}>{day}e</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </AccordionContent>
                                                )}
                                           </AccordionItem>
                                        </Accordion>
                                    );
                                })}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter className="bg-slate-950/30 -mx-6 px-6 py-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">Annuleren</Button>
                    <Button onClick={handleSaveChanges} disabled={loading} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schema Opslaan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function EditChecklistDialog({ checklist, onOpenChange, open }: { checklist: ChecklistTemplate, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(checklist.name);
  const [description, setDescription] = useState(checklist.description);
  const [tasks, setTasks] = useState(checklist.tasks);
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleAddTask = () => {
    setTasks([...tasks, { id: `new-${Date.now()}`, description: '' }]);
  };

  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index].description = value;
    setTasks(newTasks);
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !checklist.id) return;
    setLoading(true);

    const checklistRef = doc(firestore, 'users', checklist.ownerId, 'checklistTemplates', checklist.id);
    const updatedData = {
      name,
      description,
      tasks: tasks.filter(t => t.description.trim() !== '') // Remove empty tasks
    };

    try {
      await updateDoc(checklistRef, updatedData);
      toast({ title: "Checklist Bijgewerkt", description: "Je wijzigingen zijn opgeslagen." });
      onOpenChange(false);
    } catch (e) {
      console.error("Error updating checklist:", e);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: checklistRef.path, operation: 'update', requestResourceData: updatedData }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Checklist Bewerken</DialogTitle>
          <CardDescription>Pas je checklist sjabloon aan.</CardDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Naam</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Omschrijving</Label>
              <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            
            <Separator />

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label>Taken</Label>
                    <Button variant="outline" size="sm" onClick={handleAddTask}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Taak Toevoegen
                    </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {tasks.map((task, index) => (
                        <div key={task.id || index} className="flex items-center gap-2">
                            <Input 
                                value={task.description}
                                onChange={(e) => handleTaskChange(index, e.target.value)}
                                placeholder={`Taak ${index + 1}`}
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTask(index)}>
                                <X className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Annuleren</Button>
          </DialogClose>
          <Button onClick={handleSaveChanges} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Wijzigingen Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistCard({ checklist, onRemove, allAccounts }: { checklist: ChecklistTemplate, onRemove: (id: string) => void, allAccounts: ChildAccountWithParentName[] }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRemoveAlertOpen, setIsRemoveAlertOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const connectedAccountsCount = useMemo(() => {
      return allAccounts.filter(acc => acc.connectedChecklists?.some(c => c.checklistId === checklist.id)).length;
  }, [allAccounts, checklist.id]);
  
  return (
    <>
      <Card className="overflow-hidden flex flex-col glass-card">
        <CardHeader>
          <div className="flex items-start justify-between">
              <div>
                  <CardTitle className="font-headline mb-1">{checklist.name}</CardTitle>
              </div>
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Bewerken
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => setIsAssignDialogOpen(true)}>
                          <Users className="mr-2 h-4 w-4" />
                          Accounts Toewijzen
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setIsRemoveAlertOpen(true)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Verwijderen
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
          </div>
          <CardDescription className="pt-4 line-clamp-2 text-slate-400">{checklist.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <Accordion type="single" collapsible>
            <AccordionItem value="tasks" className="border-slate-800">
              <AccordionTrigger className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:no-underline">
                Bekijk {checklist.tasks.length} Taken
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3 pt-2">
                  {checklist.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-3">
                      <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                      <span className="text-sm text-slate-300">{task.description}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
         <CardFooter className="bg-black/20 p-3">
             <Button variant="link" className="text-blue-400 text-xs p-0 h-auto hover:text-blue-300" onClick={() => setIsAssignDialogOpen(true)}>
                <Users className="mr-2 h-3.5 w-3.5" />
                {connectedAccountsCount} Account{connectedAccountsCount !== 1 ? 's' : ''} Gekoppeld
            </Button>
        </CardFooter>
      </Card>
      
      <AlertDialog open={isRemoveAlertOpen} onOpenChange={setIsRemoveAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Zeker weten?</AlertDialogTitle>
            <AlertDialogDescription>
                Deze actie kan niet ongedaan worden gemaakt. Dit verwijdert het "{checklist.name}" sjabloon definitief. Reeds voltooide runs blijven bewaard.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRemove(checklist.id)} className="bg-destructive hover:bg-destructive/90">Verwijderen</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEditDialogOpen && <EditChecklistDialog checklist={checklist} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />}
      {isAssignDialogOpen && <AssignAccountsDialog checklist={checklist} accounts={allAccounts} open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen} />}
    </>
  );
}

function CreateChecklistDialog({ appUser, isAdmin }: { appUser: AppUser | null, isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<Partial<Task>[]>([{ id: `new-${Date.now()}`, description: '' }]);
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleAddTask = () => {
    setTasks([...tasks, { id: `new-${Date.now()}`, description: '' }]);
  };

  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index].description = value;
    setTasks(newTasks);
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };
  
  const handleSaveChanges = async () => {
    if (!firestore || !user || !appUser) return;
    setLoading(true);

    const managerUid = isAdmin ? user.uid : appUser.managerId;
    if (!managerUid) {
        toast({ variant: 'destructive', title: 'Fout', description: 'Geen manager gevonden voor dit account.' });
        setLoading(false);
        return;
    }

    const finalTasks = tasks
      .filter(t => t.description && t.description.trim() !== '')
      .map((t, i) => ({ id: t.id || `task-${i}`, description: t.description! }));

    if (!name.trim() || !description.trim() || finalTasks.length === 0) {
        toast({ variant: 'destructive', title: 'Informatie ontbreekt', description: 'Vul alle velden in en voeg minimaal één taak toe.'});
        setLoading(false);
        return;
    }

    const newChecklistData = {
      ownerId: managerUid,
      name,
      description,
      tasks: finalTasks,
    };

    try {
      const collectionRef = collection(firestore, 'users', managerUid, 'checklistTemplates');
      await addDoc(collectionRef, newChecklistData);
      toast({ title: "Checklist Gemaakt", description: `${name} is toegevoegd aan je sjablonen.` });
      // Reset state and close
      setName('');
      setDescription('');
      setTasks([{ id: `new-${Date.now()}`, description: '' }]);
      setOpen(false);
    } catch (e) {
      console.error("Error creating checklist:", e);
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `/users/${managerUid}/checklistTemplates`, operation: 'create', requestResourceData: newChecklistData }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
          <PlusCircle className="mr-2 h-4 w-4" />
          Nieuwe Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Nieuwe Checklist Maken</DialogTitle>
           <CardDescription>Definieer je sjabloon en de bijbehorende taken.</CardDescription>
        </DialogHeader>
         <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Naam</Label>
              <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="bijv. Wekelijkse PMax Audit" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-description">Omschrijving</Label>
              <Textarea id="new-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Wat is het doel van deze checklist?" />
            </div>
            
            <Separator />

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label>Taken</Label>
                    <Button variant="outline" size="sm" onClick={handleAddTask}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Taak Toevoegen
                    </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {tasks.map((task, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input 
                                value={task.description}
                                onChange={(e) => handleTaskChange(index, e.target.value)}
                                placeholder={`Taak ${index + 1}`}
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTask(index)}>
                                <X className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-4">
                            Nog geen taken toegevoegd.
                        </div>
                    )}
                </div>
            </div>
        </div>
        <DialogFooter>
           <DialogClose asChild>
            <Button variant="outline">Annuleren</Button>
          </DialogClose>
          <Button onClick={handleSaveChanges} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Checklist Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ appUser, isAdmin }: { appUser: AppUser | null, isAdmin: boolean }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center border-dashed bg-transparent border-slate-800">
      <div className="flex flex-col items-center gap-2">
        <NotebookPen className="size-12 text-muted-foreground" />
        <h3 className="text-xl font-semibold font-headline">Nog geen checklists</h3>
        <p className="text-muted-foreground max-w-sm">
          Het lijkt erop dat je nog geen checklists hebt aangemaakt. Begin met je eerste sjabloon.
        </p>
      </div>
      <CreateChecklistDialog appUser={appUser} isAdmin={isAdmin} />
    </Card>
  );
}

function LoadingState() {
    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => (
                 <Card key={i} className="glass-card">
                    <CardHeader>
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="h-4 bg-secondary rounded w-3/4" />
                            <div className="h-4 bg-secondary rounded w-1/2" />
                        </div>
                    </CardContent>
                     <CardFooter className="bg-black/20 p-3">
                         <div className="h-5 bg-secondary rounded w-1/3" />
                     </CardFooter>
                </Card>
            ))}
        </div>
    )
}

type EnrichedChecklistRun = ChecklistRun & {
    checklistName: string;
    accountNickname: string;
}

const ChecklistRunGroup = ({ template, runs, allAccounts, onViewRun, isAdmin }: { template: ChecklistTemplate, runs: EnrichedChecklistRun[], allAccounts: ChildAccountWithParentName[], onViewRun: (runId: string) => void, isAdmin: boolean }) => {
    const [showAll, setShowAll] = useState(false);
    const visibleRuns = showAll ? runs : runs.slice(0, 10);
    const connectedAccounts = useMemo(() => allAccounts.filter(a => a.connectedChecklists?.some(c => c.checklistId === template.id)), [allAccounts, template.id]);

    return (
        <AccordionItem value={template.id} className="border-border">
            <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                    <div className='flex items-center gap-4'>
                        <h3 className="text-lg font-semibold font-headline">{template.name}</h3>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none">{runs.length} Runs</Badge>
                        <Badge variant="outline" className="text-slate-500 border-slate-800">{connectedAccounts.length} Gekoppelde Accounts</Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                 <Table>
                      <TableHeader>
                          <TableRow className="border-slate-800 hover:bg-transparent">
                              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Account</TableHead>
                              {isAdmin && <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Uitgevoerd Door</TableHead>}
                              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Status</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Voltooid</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Acties</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {visibleRuns.map(run => {
                              const completedDate = run.completedAt;
                              return (
                                  <TableRow key={run.id} className="border-slate-800 hover:bg-secondary">
                                      <TableCell className="font-medium text-slate-300">
                                          <Link href={`/dashboard/accounts/${run.childAccountId}?parent=${run.parentClientId}`} className="hover:text-blue-400 transition-colors">
                                            {run.accountNickname}
                                          </Link>
                                      </TableCell>
                                      {isAdmin && (
                                          <TableCell className="text-slate-300 text-xs font-semibold">
                                              {run.completedByName || 'Onbekend'}
                                          </TableCell>
                                      )}
                                      <TableCell>
                                          <Badge variant={run.status === 'complete' ? 'default' : 'secondary'} className={cn(run.status === 'complete' ? 'bg-green-500/20 text-green-300 border-none' : 'bg-yellow-500/20 text-yellow-300 border-none')}>
                                            {run.status === 'complete' ? 'Voltooid' : 'In uitvoering'}
                                          </Badge>
                                      </TableCell>
                                      <TableCell className="text-slate-400 text-xs">{completedDate ? format(completedDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="ghost" size="sm" onClick={() => onViewRun(run.id)} className="text-slate-400 hover:text-white">
                                              <View className="mr-2 size-4" /> Inzien
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              )
                          })}
                      </TableBody>
                  </Table>
                  {runs.length > 10 && (
                      <div className="text-center pt-4">
                          <Button variant="link" onClick={() => setShowAll(!showAll)} className="text-blue-400 text-xs">
                              {showAll ? 'Minder tonen' : `Toon nog ${runs.length - 10} runs`}
                               <ChevronDown className={cn("ml-2 size-3 transition-transform", showAll && "rotate-180")} />
                          </Button>
                      </div>
                  )}
            </AccordionContent>
        </AccordionItem>
    )
}

export default function ChecklistsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as AppUser)?.role?.toLowerCase();
    return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es' || user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [appUser, user?.email]);

  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [allAccounts, setAllAccounts] = useState<ChildAccountWithParentName[]>([]);
  const [groupedRuns, setGroupedRuns] = useState<Record<string, EnrichedChecklistRun[]>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !user) return;
    setLoading(true);

    const fetchAllData = async () => {
        try {
            const managerUid = isAdmin ? user.uid : (appUser as AppUser)?.managerId;
            if (!managerUid) {
                setLoading(false);
                return;
            }

            // Fetch checklist templates
            const checklistsQuery = isAdmin
                ? query(collectionGroup(firestore, 'checklistTemplates'))
                : query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
            const checklistSnapshot = await getDocs(checklistsQuery);
            const checklistData = checklistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChecklistTemplate));
            const checklistMap = new Map(checklistData.map(c => [c.id, c.name]));
            setChecklists(checklistData);

            // Fetch parent clients
            const clientsQuery = isAdmin 
                ? collection(firestore, 'parentClients')
                : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
            const clientsSnapshot = await getDocs(clientsQuery);
            const parentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentClient));
            const parentClientMap = new Map(parentClients.map(c => [c.id, c.clientName]));

            // Fetch all child accounts
            const childAccountPromises = parentClients.map(client =>
                isAdmin 
                    ? getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
                    : getDocs(query(collection(firestore, 'parentClients', client.id, 'childAccounts'), where('assignedEmployeeId', '==', user.uid)))
            );
            const childAccountSnapshots = await Promise.all(childAccountPromises);
            
            const allChildAccounts: ChildAccountWithParentName[] = childAccountSnapshots.flatMap(snapshot => 
                snapshot.docs.map(doc => {
                    const data = doc.data() as ChildAccount;
                    return {
                        ...data,
                        id: doc.id,
                        parentName: parentClientMap.get(data.parentClientId) || 'Onbekende Klant',
                    };
                })
            ).filter(acc => isAdmin || acc.assignedEmployeeId === user.uid);
            
            const accountMap = new Map(allChildAccounts.map(a => [a.id, a.nickname]));
            setAllAccounts(allChildAccounts);

            // Show all checklists to employees so they can manage team templates
            setChecklists(checklistData);
            
            // Fetch checklist runs
            const runsQuery = isAdmin 
                ? collection(firestore, 'checklistRuns')
                : query(collection(firestore, 'checklistRuns'), where('managerId', '==', managerUid));
            const runsSnapshot = await getDocs(runsQuery);
            
            const runsData = runsSnapshot.docs.map(doc => {
                const data = doc.data() as ChecklistRun;
                let completedAt: Date | null = null;
                if (data.completedAt) {
                    if (data.completedAt instanceof Timestamp) {
                        completedAt = data.completedAt.toDate();
                    } else if (typeof data.completedAt === 'string') {
                        const parsedDate = parseISO(data.completedAt);
                        if (!isNaN(parsedDate.getTime())) {
                            completedAt = parsedDate;
                        }
                    }
                }

                return {
                    ...data,
                    id: doc.id,
                    completedAt: completedAt,
                    checklistName: checklistMap.get(data.checklistId) || 'Unknown Checklist',
                    accountNickname: accountMap.get(data.childAccountId) || 'Unknown Account',
                } as EnrichedChecklistRun;
            }).filter(run => isAdmin || allChildAccounts.some(acc => acc.id === run.childAccountId))
            .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

            const grouped = runsData.reduce((acc, run) => {
                const key = run.checklistId;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(run);
                return acc;
            }, {} as Record<string, EnrichedChecklistRun[]>);
            setGroupedRuns(grouped);

        } catch(e) {
            console.error("Error fetching checklist page data:", e);
            toast({ variant: 'destructive', title: 'Fout', description: 'Kon paginagegevens niet laden.' });
        } finally {
            setLoading(false);
        }
    };
    fetchAllData();
  }, [firestore, user, toast, refreshTrigger, appUser, isAdmin]);

  
  const handleRemove = async (id: string) => {
    if (!firestore || !user || !appUser) return;
    const managerUid = isAdmin ? user.uid : (appUser as AppUser).managerId;
    if (!managerUid) return;
    const docRef = doc(firestore, 'users', managerUid, 'checklistTemplates', id);
    try {
        await deleteDoc(docRef);
        setChecklists(prev => prev.filter(c => c.id !== id));
        toast({ title: 'Checklist Verwijderd', description: 'Het sjabloon is succesvol verwijderd.'});
    } catch(e) {
        console.error("Error removing checklist:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    }
  }
  
  const handleViewRun = (runId: string) => {
    setViewingRunId(runId);
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight">
            Checklist Builder
          </h1>
          <p className="text-muted-foreground">
            Beheer je sjablonen voor terugkerende optimalisatiewerkzaamheden.
          </p>
        </div>
        {!loading && checklists && checklists.length > 0 && <CreateChecklistDialog appUser={appUser as AppUser} isAdmin={isAdmin} />}
      </div>
      
      {loading && <LoadingState />}
      
      {!loading && (!checklists || checklists.length === 0) ? (
        <EmptyState appUser={appUser as AppUser} isAdmin={isAdmin} />
      ) : (
       !loading && checklists && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {checklists.map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} onRemove={handleRemove} allAccounts={allAccounts} />
            ))}
          </div>
        )
      )}
      
       {!loading && Object.keys(groupedRuns).length > 0 && (
          <Card className="glass-card">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline text-2xl"><History className="text-blue-400" /> Checklist Historie</CardTitle>
                  <CardDescription>Een overzicht van alle uitgevoerde checklists over alle accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                      {checklists.filter(c => groupedRuns[c.id]).map(template => (
                          <ChecklistRunGroup 
                            key={template.id} 
                            template={template} 
                            runs={groupedRuns[template.id]}
                             allAccounts={allAccounts}
                             onViewRun={handleViewRun}
                             isAdmin={isAdmin}
                          />
                      ))}
                  </Accordion>
              </CardContent>
          </Card>
      )}

      <ChecklistRunViewer 
        runId={viewingRunId}
        open={!!viewingRunId}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setViewingRunId(null);
          }
        }}
      />
    </div>
  );
}
