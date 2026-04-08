'use client';

import { useState, useMemo } from 'react';
import { query, collection, where, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { ChecklistRun, ChildAccount, ChecklistTemplate } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, AlertCircle } from 'lucide-react';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

interface InProgressChecklistsProps {
    account: ChildAccount;
    onStart: (checklist: any) => void;
}

export default function InProgressChecklists({ account, onStart }: InProgressChecklistsProps) {
    const firestore = useFirestore();
    const { user } = useUser();

    const inProgressQuery = useMemoFirebase(() => {
        if (!firestore || !account.id || !user) return null;
        return query(
            collection(firestore, 'checklistRuns'),
            where('childAccountId', '==', account.id),
            where('status', '==', 'in_progress'),
            limit(5)
        );
    }, [firestore, account.id, user]);

    const { data: inProgressRuns, loading } = useCollection(inProgressQuery);

    const checklistsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // We need templates to get names
        return query(collection(firestore, 'users', user.uid, 'checklistTemplates'));
    }, [firestore, user]);
    const { data: templates } = useCollection(checklistsQuery);

    const templatesMap = useMemo(() => {
        if (!templates) return new Map<string, string>();
        return new Map((templates as ChecklistTemplate[]).map(t => [t.id, t.name]));
    }, [templates]);

    if (loading) return null;
    if (!inProgressRuns || inProgressRuns.length === 0) return null;

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2">
                <AlertCircle className="size-3" />
                Active Drafts
            </h3>
            <div className="grid grid-cols-1 gap-3">
                {(inProgressRuns as ChecklistRun[]).map((run) => (
                    <div 
                        key={run.id} 
                        className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 animate-pulse">
                                <Play size={18} fill="currentColor" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-100">{templatesMap.get(run.checklistId) || 'Unknown Checklist'}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                     In Progress • {run.tasks.filter(t => t.completed).length}/{run.tasks.length} tasks
                                </p>
                            </div>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={() => onStart({ 
                                checklistId: run.checklistId, 
                                startDate: new Date().toISOString(), // Fallback
                                frequency: 'one-off' 
                            })}
                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                        >
                            Resume
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
