'use client';

import { useState, useEffect, useMemo } from 'react';
import { query, collection, where, orderBy, limit, getDocs, startAfter, doc, getDoc } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { ChecklistRun, ChildAccount, ChecklistTemplate } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, View, History, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChecklistRunViewer } from '@/components/checklist/ChecklistRunViewer';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

type EnrichedChecklistRun = ChecklistRun & { name: string; id: string };

interface ChecklistHistoryProps {
    account: ChildAccount;
    managerUid: string | null;
}

export default function ChecklistHistory({ account, managerUid }: ChecklistHistoryProps) {
    const firestore = useFirestore();
    const [runs, setRuns] = useState<EnrichedChecklistRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [viewingRunId, setViewingRunId] = useState<string | null>(null);

    const checklistsQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
    }, [firestore, managerUid]);
    const { data: checklistTemplates } = useCollection(checklistsQuery);

    const templatesMap = useMemo(() => {
        if (!checklistTemplates) return new Map<string, string>();
        return new Map((checklistTemplates as ChecklistTemplate[]).map(t => [t.id, t.name]));
    }, [checklistTemplates]);

    const fetchRuns = async (isLoadMore = false) => {
        if (!firestore || !account.id || !checklistTemplates) return;
        
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            let runsQuery = query(
                collection(firestore, 'checklistRuns'),
                where('childAccountId', '==', account.id),
                orderBy('completedAt', 'desc'),
                limit(isLoadMore ? 10 : 3)
            );

            if (isLoadMore && lastDoc) {
                runsQuery = query(runsQuery, startAfter(lastDoc));
            }

            const snapshot = await getDocs(runsQuery);
            
            if (snapshot.empty) {
                setHasMore(false);
                if (!isLoadMore) setRuns([]);
            } else {
                const newRuns = snapshot.docs.map(snap => {
                    const data = snap.data() as ChecklistRun;
                    let completedAt: Date | null = null;
                    
                    const rawDate = data.completedAt;
                    if (rawDate) {
                        if (rawDate instanceof Date) {
                            completedAt = rawDate;
                        } else if (typeof rawDate === 'string') {
                            completedAt = parseISO(rawDate);
                        } else if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
                            completedAt = (rawDate as any).toDate();
                        } else if (typeof rawDate === 'number') {
                            completedAt = new Date(rawDate);
                        }
                    }

                    return {
                        ...data,
                        id: snap.id,
                        completedAt: (completedAt && isValid(completedAt)) ? completedAt : null,
                        name: templatesMap.get(data.checklistId) || 'Unknown Checklist'
                    } as EnrichedChecklistRun;
                });

                if (isLoadMore) {
                    setRuns(prev => [...prev, ...newRuns]);
                } else {
                    setRuns(newRuns);
                }
                
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                setHasMore(snapshot.docs.length === (isLoadMore ? 10 : 3));
            }
        } catch (e) {
            console.error("Error fetching checklist runs query:", e);
            // Fallback to ID-based loading if query fails (e.g. missing index)
            if (!isLoadMore && account.checklistRunIds?.length) {
                const runPromises = account.checklistRunIds.slice(0, 10).map(id => getDoc(doc(firestore, 'checklistRuns', id)));
                const snaps = await Promise.all(runPromises);
                const fetched = snaps.filter(s => s.exists()).map(s => {
                    const data = s.data() as ChecklistRun;
                    let completedAt: Date | null = null;
                    
                    const rawDate = data.completedAt;
                    if (rawDate) {
                        if (rawDate instanceof Date) {
                            completedAt = rawDate;
                        } else if (typeof rawDate === 'string') {
                            completedAt = parseISO(rawDate);
                        } else if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
                            completedAt = (rawDate as any).toDate();
                        } else if (typeof rawDate === 'number') {
                            completedAt = new Date(rawDate);
                        }
                    }

                    return { 
                        ...data, 
                        id: s.id, 
                        completedAt: (completedAt && isValid(completedAt)) ? completedAt : null,
                        name: templatesMap.get(data.checklistId) || 'Unknown' 
                    } as any;
                });
                setRuns(fetched);
                setHasMore(false);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (checklistTemplates) {
            fetchRuns();
        }
    }, [firestore, account.id, checklistTemplates]);

    if (loading) {
        return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;
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
            <div className="space-y-3">
                {runs.map(run => (
                    <div key={run.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-blue-500/30 hover:bg-slate-900/60 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <History size={20} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">{run.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {run.completedAt ? format(run.completedAt as any, 'PPP p') : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <Badge variant={run.status === 'complete' ? 'default' : 'secondary'} className={cn(
                            "capitalize",
                            run.status === 'complete' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        )}>
                            {run.status === 'complete' ? 'Voltooid' : 'In uitvoering'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => setViewingRunId(run.id)} className="text-slate-400 hover:text-white hover:bg-white/5">
                            <View className="mr-2 size-4" />
                            Details
                        </Button>
                    </div>
                ))}

                {hasMore && (
                    <div className="text-center pt-4">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => fetchRuns(true)} 
                            disabled={loadingMore}
                            className="text-muted-foreground hover:text-white"
                        >
                            {loadingMore ? <Loader2 className="animate-spin mr-2 size-4" /> : <ChevronDown className="mr-2 size-4" />}
                            Laad meer historie
                        </Button>
                    </div>
                )}
            </div>
            <ChecklistRunViewer 
                runId={viewingRunId} 
                open={!!viewingRunId} 
                onOpenChange={(isOpen) => !isOpen && setViewingRunId(null)} 
            />
        </>
    );
}
