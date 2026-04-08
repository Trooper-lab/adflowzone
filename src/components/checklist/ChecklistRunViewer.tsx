
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { Loader2, X, Check, Circle } from 'lucide-react';
import type { ChecklistRun, ChecklistTemplate, ChildAccount } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChecklistRunViewerProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChecklistRunViewer({ runId, open, onOpenChange }: ChecklistRunViewerProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const runDocRef = useMemoFirebase(() => {
    if (!firestore || !runId) return null;
    return doc(firestore, 'checklistRuns', runId);
  }, [firestore, runId]);
  const { data: run, loading: runLoading } = useDoc(runDocRef);
  const checklistRun = run as ChecklistRun | null;

  const templateDocRef = useMemoFirebase(() => {
    if (!firestore || !user || !checklistRun) return null;
    return doc(firestore, 'users', user.uid, 'checklistTemplates', checklistRun.checklistId);
  }, [firestore, user, checklistRun]);
  const { data: template, loading: templateLoading } = useDoc(templateDocRef);
  const checklistTemplate = template as ChecklistTemplate | null;

  const accountDocRef = useMemoFirebase(() => {
    if (!firestore || !checklistRun?.parentClientId || !checklistRun?.childAccountId) return null;
    return doc(firestore, 'parentClients', checklistRun.parentClientId, 'childAccounts', checklistRun.childAccountId);
  }, [firestore, checklistRun]);
  const { data: account, loading: accountLoading } = useDoc(accountDocRef);
  const childAccount = account as ChildAccount | null;

  const isLoading = runLoading || templateLoading || accountLoading;

  const getFormattedDate = () => {
    if (!checklistRun?.completedAt) return 'N/A';
    
    const completedAt = checklistRun.completedAt;
    let dateToFormat: Date;

    if (completedAt instanceof Timestamp) {
      dateToFormat = completedAt.toDate();
    } else if (typeof completedAt === 'string') {
      dateToFormat = parseISO(completedAt);
    } else if (completedAt instanceof Date) {
      dateToFormat = completedAt;
    } else {
      return 'Invalid Date';
    }

    if (isNaN(dateToFormat.getTime())) {
      return 'Invalid Date';
    }
    
    return format(dateToFormat, 'PPP');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col bg-[#111827] border-slate-800 text-slate-50 p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
          {isLoading ? (
            <SheetTitle>Loading Run Details...</SheetTitle>
          ) : (
            <>
              <SheetTitle className="font-headline text-2xl text-slate-50">{checklistTemplate?.name}</SheetTitle>
              <SheetDescription className="text-slate-400">
                Run for <span className="font-semibold text-slate-300">{childAccount?.nickname}</span> on {getFormattedDate()}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="animate-spin size-8 text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-grow">
            <div className="space-y-4 px-6 py-4">
              {checklistRun?.tasks.map((task) => (
                <div key={task.taskId} className="p-4 border rounded-lg bg-slate-800 border-slate-700">
                  <div className="flex items-start gap-4">
                    {task.completed ? <Check className="mt-1 size-5 flex-shrink-0 text-green-400" /> : <Circle className="mt-1 size-5 flex-shrink-0 text-slate-500" />}
                    <p className="flex-grow text-base text-slate-200">{task.description}</p>
                  </div>
                  {task.notes && (
                    <div className="pl-9 pt-2">
                      <p className="text-sm text-slate-400 border-l-2 border-slate-600 pl-3">{task.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
