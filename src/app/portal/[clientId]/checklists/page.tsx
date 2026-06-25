
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, doc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ListChecks, ChevronLeft, ChevronRight, View, MessageSquare } from 'lucide-react';
import type { ChildAccount, ChecklistRun, ChecklistTemplate } from '@/lib/types';
import { format, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChecklistRunViewer } from '@/components/checklist/ChecklistRunViewer';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading checklist history...</span>
    </div>
  );
}

type EnrichedChecklistRun = ChecklistRun & { name: string; };

function getCompletedMs(run: any) {
  if (!run.completedAt) return 0;
  if (run.completedAt instanceof Timestamp) return run.completedAt.toDate().getTime();
  const date = typeof run.completedAt === 'string' ? parseISO(run.completedAt) : new Date(run.completedAt);
  return date.getTime();
}

export default function ClientChecklistsPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<EnrichedChecklistRun[]>([]);
  const [accounts, setAccounts] = useState<ChildAccount[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);

  const selectedPeriodStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const selectedPeriodEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const clientDocRef = useMemoFirebase(() => (firestore && clientId ? doc(firestore, 'parentClients', clientId as string) : null), [firestore, clientId]);
  const { data: parentClient } = useDoc(clientDocRef);
  const ownerId = parentClient ? (parentClient as any).ownerId : null;

  useEffect(() => {
    if (!firestore || !ownerId || !clientId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch accounts, templates, and runs concurrently
        const accountsQuery = query(collection(firestore, `parentClients/${clientId}/childAccounts`));
        const templatesQuery = query(collection(firestore, 'users', ownerId, 'checklistTemplates'));
        
        const [accountsSnap, templatesSnap] = await Promise.all([
          getDocs(accountsQuery),
          getDocs(templatesQuery)
        ]);

        const fetchedAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChildAccount));
        setAccounts(fetchedAccounts);
        
        const fetchedTemplates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChecklistTemplate));
        const templatesMap = new Map(fetchedTemplates.map(t => [t.id, t.name]));
        setTemplates(fetchedTemplates);

        if (fetchedAccounts.length === 0) {
            setRuns([]);
            setLoading(false);
            return;
        }

        const accountIds = fetchedAccounts.map(a => a.id);
        const runsQuery = query(
            collection(firestore, 'checklistRuns'), 
            where('childAccountId', 'in', accountIds),
            where('status', '==', 'complete')
        );

        const runsSnap = await getDocs(runsQuery);
        const allRuns = runsSnap.docs.map(d => {
            const data = d.data() as ChecklistRun;
            return {
                ...data,
                id: d.id,
                name: templatesMap.get(data.checklistId) || 'Unknown Checklist'
            } as EnrichedChecklistRun;
        });
        setRuns(allRuns);

      } catch (error) {
        console.error("Error fetching checklist data for client:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [firestore, clientId, ownerId]);

  const filteredAndGroupedRuns = useMemo(() => {
    const filtered = runs.filter(run => {
        const completedAt = run.completedAt;
        if (!completedAt) return false;
        
        let dateToCompare: Date;
        if (completedAt instanceof Timestamp) {
            dateToCompare = completedAt.toDate();
        } else {
            dateToCompare = parseISO(completedAt as unknown as string);
        }
        return isWithinInterval(dateToCompare, { start: selectedPeriodStart, end: selectedPeriodEnd });
    });

    return filtered.reduce((acc, run) => {
        if (!acc[run.childAccountId]) {
            acc[run.childAccountId] = [];
        }
        acc[run.childAccountId].push(run);
        return acc;
    }, {} as Record<string, EnrichedChecklistRun[]>);
  }, [runs, selectedPeriodStart, selectedPeriodEnd]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  
  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Checklist History</h1>
          <p className="text-muted-foreground">
            Review of all completed maintenance tasks for your accounts.
          </p>
        </div>
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-lg font-semibold font-headline text-center w-32">{format(currentMonth, 'MMMM yyyy')}</span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      
      {Object.keys(filteredAndGroupedRuns).length > 0 ? (
        <div className="space-y-8">
            {accounts.filter(acc => filteredAndGroupedRuns[acc.id]).map(account => (
                <div key={account.id} className="space-y-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold font-headline">{account.nickname}</h2>
                         <Badge variant="secondary">{filteredAndGroupedRuns[account.id].length} run{filteredAndGroupedRuns[account.id].length > 1 ? 's' : ''}</Badge>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Checklist</TableHead>
                                        <TableHead>Completed Date</TableHead>
                                        <TableHead>Comments</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndGroupedRuns[account.id].sort((a,b) => getCompletedMs(b) - getCompletedMs(a)).map(run => {
                                        const commentCount = run.tasks.filter(task => task.notes && task.notes.trim() !== '').length;
                                        return (
                                            <TableRow key={run.id}>
                                                <TableCell className="font-medium">{run.name}</TableCell>
                                                <TableCell>
                                                    {run.completedAt ? format(run.completedAt instanceof Timestamp ? run.completedAt.toDate() : parseISO(run.completedAt as string), 'PPP') : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <MessageSquare className="size-4 text-muted-foreground" />
                                                        {commentCount}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => setViewingRunId(run.id)}>
                                                        <View className="mr-2 size-4" /> View Run
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
      ) : (
         <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center border-dashed">
              <div className="flex flex-col items-center gap-2">
                <ListChecks className="size-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold font-headline">No Checklists Run in {format(currentMonth, 'MMMM yyyy')}</h3>
                <p className="text-muted-foreground max-w-sm">
                  There are no completed checklists for the selected month.
                </p>
              </div>
        </Card>
      )}

      <ChecklistRunViewer runId={viewingRunId} open={!!viewingRunId} onOpenChange={(isOpen) => !isOpen && setViewingRunId(null)} />
    </div>
  );
}
