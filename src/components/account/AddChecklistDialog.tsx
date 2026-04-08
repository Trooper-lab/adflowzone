'use client';

import { useState } from 'react';
import { query, collection, updateDoc, arrayUnion } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { ChecklistTemplate, ConnectedChecklist } from '@/lib/types';
import { format, isPast, isToday, addWeeks, addMonths, setDay, setDate } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface AddChecklistDialogProps {
    childAccountRef: any;
    managerUid: string | null;
}

export default function AddChecklistDialog({ childAccountRef, managerUid }: AddChecklistDialogProps) {
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
                    <PlusCircle className="mr-2 h-4 w-4" />
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
