
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, writeBatch, arrayUnion, DocumentReference } from 'firebase/firestore';
import type { MonthlyReport, ChildAccount, ParentClient, KpiData, Todo, ChecklistRun, ChecklistTemplate, AppUser } from '@/lib/types';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { sendReportByEmail } from '@/app/actions/send-report-email';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Send, CheckCircle, Circle, Wand2, RefreshCw, ArrowLeft, Download, Share, FileText, BarChart, TrendingUp, TrendingDown, ChevronsRight, Copy, Mail, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { generateReportSummary, type ReportSummaryOutput, type ReportSummaryInput } from '@/ai/flows/generate-report-summary';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 min-h-screen bg-muted/20">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-4">Rapportgegevens laden...</span>
    </div>
  );
}


const KpiCard = ({ title, value, change, unit = '' }: { title: string, value: string | number, change: number | null, unit?: string }) => {
    const isPositive = change !== null && change >= 0;
    const isNeutral = change === null || change === 0;

    const isCostMetric = title.toLowerCase().includes('cpa') || title.toLowerCase().includes('cpl');
    const isGoodChange = isCostMetric ? !isPositive : isPositive;

    const formattedChange = change !== null ? `${isPositive ? '+' : ''}${change.toFixed(1)}%` : '–';
    
    return (
        <Card className="bg-card">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="text-2xl font-bold">{unit}{value}</div>
                 {!isNeutral && (
                    <p className={cn("text-xs text-muted-foreground", isGoodChange ? 'text-green-400' : 'text-red-400')}>
                        {formattedChange}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

const NotepadDialog = ({ content, open, onOpenChange }: { content: string, open: boolean, onOpenChange: (open: boolean) => void }) => {
    const { toast } = useToast();
    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            toast({ title: 'Gekopieerd naar Klembord', description: 'De rapportinhoud is gekopieerd.' });
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({ variant: 'destructive', title: 'Kopiëren Mislukt', description: 'Kon inhoud niet naar klembord kopiëren.' });
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Rapport Tekstinhoud</DialogTitle>
                    <DialogDescription>
                        U kunt de volledige rapportinhoud uit het onderstaande tekstvak kopiëren.
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    readOnly
                    value={content}
                    className="h-96 text-xs font-mono bg-slate-900/50"
                />
                <DialogFooter>
                    <Button onClick={handleCopy}>
                        <Copy className="mr-2" />
                        Inhoud Kopiëren
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const ReportPage = () => {
  const { reportId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState<ReportSummaryOutput | null>(null);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [notepadContent, setNotepadContent] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: appUser } = useDoc(userRef) as { data: AppUser | null };
  const isAdmin = appUser?.role === 'admin' || !appUser?.role;
  const managerUid = isAdmin ? user?.uid : appUser?.managerId;

  const reportRef = useMemoFirebase(() => {
    if (!reportId || !firestore) return null;
    return doc(firestore as any, 'reports', reportId as string);
  }, [firestore, reportId]);
  const { data: report, loading: reportLoading, error: reportError, refetch: refetchReport } = useDoc(reportRef) as { data: MonthlyReport | null, loading: boolean, error: any, refetch: () => void };

  const childAccountRef = useMemoFirebase(() => (report && firestore) ? doc(firestore as any, 'parentClients', report.parentClientId, 'childAccounts', report.childAccountId) : null, [report, firestore]);
  const { data: childAccount, loading: accountLoading } = useDoc(childAccountRef) as { data: ChildAccount | null, loading: boolean };

  const parentClientRef = useMemoFirebase(() => (report && firestore) ? doc(firestore as any, 'parentClients', report.parentClientId) : null, [report, firestore]);
  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef) as { data: ParentClient | null, loading: boolean };

  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !managerUid) return null;
    return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
  }, [firestore, managerUid]);
  const { data: checklistTemplates } = useCollection(checklistsQuery) as { data: ChecklistTemplate[] | null };

  const [relatedData, setRelatedData] = useState<{ kpiData: KpiData[], completedTodos: Todo[], pendingTodos: Todo[], checklistRuns: ChecklistRun[] }>({ kpiData: [], completedTodos: [], pendingTodos: [], checklistRuns: [] });
  const [dataLoading, setDataLoading] = useState(true);

  
  useEffect(() => {
    if (report?.aiSummary) {
        setAiSummary({
            executiveSummary: report.aiSummary,
            keyInsights: report.keyInsights || [],
            nextSteps: report.nextSteps || [],
        });
    }
  }, [report]);
  
  const isClientUser = useMemo(() => {
      if (!user || !parentClient) return false;
      return user.email === parentClient.clientUserEmail;
  }, [user, parentClient]);

  useEffect(() => {
    if (!report || !childAccount || !firestore || !user || !checklistTemplates) return;

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const templatesMap = new Map(checklistTemplates.map(t => [t.id, t]));
            
            const kpiQuery = query(collection(firestore as any, 'kpiData'), where('childAccountId', '==', childAccount.id));
            
            const completedTodoPromises = (report.completedTodoRunIds || []).map(id => getDoc(doc(firestore as any, 'users', managerUid!, 'todos', id)));
            
            const pendingTodoPromises = (childAccount.pendingTodoIds || []).map(id => getDoc(doc(firestore as any, 'users', managerUid!, 'todos', id)));

            const checklistRunPromises = (report.completedChecklistRunIds || []).map(id => getDoc(doc(firestore as any, 'checklistRuns', id)));
            
            const [ kpiSnaps, completedTodoSnaps, pendingTodoSnaps, checklistRunSnaps ] = await Promise.all([
                getDocs(kpiQuery),
                Promise.all(completedTodoPromises),
                Promise.all(pendingTodoPromises),
                Promise.all(checklistRunPromises),
            ]);

            const kpiData = kpiSnaps.docs.map(snap => ({ id: snap.id, ...snap.data() } as KpiData));
            
            const completedTodos = completedTodoSnaps
                .filter(snap => snap.exists())
                .map(snap => {
                    const data = snap.data();
                    let completedAt = data?.completedAt;
                    if (completedAt instanceof Timestamp) completedAt = completedAt.toDate().toISOString();
                    return { id: snap.id, ...data, completedAt } as Todo;
                });
            
             const pendingTodos = pendingTodoSnaps
                .filter(snap => snap.exists())
                .map(snap => ({ id: snap.id, ...snap.data() } as Todo));
                
            const checklistRuns = checklistRunSnaps
                .filter(snap => snap.exists())
                .map(snap => {
                    const runData = snap.data() as ChecklistRun;
                    const completedAt = runData.completedAt instanceof Timestamp ? runData.completedAt.toDate().toISOString() : (runData.completedAt ? parseISO(runData.completedAt as string).toISOString() : null);
                    const runAt = runData.runAt instanceof Timestamp ? runData.runAt.toDate().toISOString() : runData.runAt;

                    const template = templatesMap.get(runData.checklistId);
                    return {
                        ...runData,
                        id: snap.id,
                        name: template?.name || 'Unknown Checklist',
                        completedAt: completedAt,
                        runAt: runAt,
                    } as unknown as ChecklistRun;
                });

            setRelatedData({ kpiData, completedTodos, pendingTodos, checklistRuns });

        } catch (e: any) {
            console.error("Error fetching related report data:", e);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'various', operation: 'get' }));
        } finally {
            setDataLoading(false);
        }
    };
    
    fetchData();

  }, [report, childAccount, firestore, user, checklistTemplates]);
  
  const handleUpdateStatus = async (status: 'finalized' | 'sent' | 'confirmed') => {
    if (!reportRef) return;
    setIsSaving(true);
    const statusMap = {
        finalized: "Gefinaliseerd",
        sent: "Gepubliceerd",
        confirmed: "Bevestigd",
        skipped: "Overgeslagen"
    }
    try {
        await updateDoc(reportRef, { status });
        toast({ title: `Rapport ${statusMap[status]}`, description: `Het rapport is nu gemarkeerd als ${statusMap[status].toLowerCase()}.` });
        refetchReport();
    } catch(e: any) {
        console.error("Error updating report status:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reportRef.path, operation: 'update', requestResourceData: { status } }));
    } finally {
        setIsSaving(false);
    }
  }

  const handleGenerateSummary = async () => {
    if (!report || !parentClient || !childAccount || !firestore || !user || !reportRef) return;
    setIsGenerating(true);

    try {
        const isTimestamp = (value: any): value is Timestamp => value && typeof value.toDate === 'function';
        const toISO = (date: any) => isTimestamp(date) ? date.toDate().toISOString() : (date instanceof Date ? date.toISOString() : date);

        const cleanReport = { ...report, generatedAt: toISO(report.generatedAt) };
        const cleanChecklistRuns = relatedData.checklistRuns.map(run => ({
            ...run,
            name: (run as any).name || 'Checklist',
            runAt: toISO(run.runAt),
            completedAt: toISO(run.completedAt),
            tasks: run.tasks.map(t => ({...t, completed: !!t.completed}))
        }));
        const cleanCompletedTodos = relatedData.completedTodos.map(todo => ({
            ...todo,
            createdAt: toISO(todo.createdAt),
            completedAt: toISO(todo.completedAt),
            dueDate: toISO(todo.dueDate),
        }));
        
        const cleanPendingTodos = relatedData.pendingTodos.map(todo => ({
            ...todo,
            createdAt: toISO(todo.createdAt),
            dueDate: toISO(todo.dueDate),
        }));

        const input: ReportSummaryInput = {
            report: cleanReport,
            parentClient,
            childAccount,
            kpiData: relatedData.kpiData.map(kpi => ({ startDate: kpi.startDate, kpiValues: kpi.kpiValues })),
            completedTodos: cleanCompletedTodos,
            pendingTodos: cleanPendingTodos,
            checklistRuns: cleanChecklistRuns,
            campaignDataSnapshot: report.campaignDataSnapshot,
        };
        
        const result = await generateReportSummary(input);
        setAiSummary(result);

        const batch = writeBatch(firestore);

        // 1. Update the report document
        batch.update(reportRef, { 
            aiSummary: result.executiveSummary, 
            keyInsights: result.keyInsights, 
            nextSteps: result.nextSteps 
        });
        
        const newTodoIds: string[] = [];

        if (result.nextSteps && result.nextSteps.length > 0) {
            const now = new Date();
            const todosCollection = collection(firestore, 'users', user.uid, 'todos');
            
            result.nextSteps.forEach((stepContent, index) => {
                const todoDocRef = doc(todosCollection); // Create a new doc ref for each todo
                newTodoIds.push(todoDocRef.id);
                
                const dueDate = addDays(now, 15 + index * 2); // Stagger due dates

                const newTodo: Omit<Todo, 'id'> = {
                    userId: user.uid,
                    parentClientId: report.parentClientId,
                    parentClientName: parentClient.clientName,
                    childAccountId: report.childAccountId,
                    childAccountNickname: childAccount.nickname,
                    content: stepContent,
                    completed: false,
                    createdAt: now.toISOString(),
                    dueDate: dueDate.toISOString()
                };

                batch.set(todoDocRef, newTodo);
            });

            // 2. Update the child account with new todo IDs
            if (newTodoIds.length > 0 && childAccountRef) {
                batch.update(childAccountRef, {
                    pendingTodoIds: arrayUnion(...newTodoIds)
                });
            }
        }
        
        // Commit all writes at once
        await batch.commit();

        toast({ 
            title: "AI Samenvatting & Taken Gegenereerd", 
            description: "De samenvatting is opgeslagen en de volgende stappen zijn als taken toegevoegd." 
        });

    } catch (error) {
        console.error("Error generating AI summary:", error);
        toast({ variant: "destructive", title: "AI Samenvatting Mislukt", description: "Kon samenvatting niet genereren." });
    } finally {
        setIsGenerating(false);
    }
};

  const handleSendEmail = async () => {
    if (!report || !parentClient || !childAccount || !reportRef || !checklistTemplates) return;
    setIsSendingEmail(true);

    try {
        // Helper to sanitize objects for Server Action
        const toPlain = (val: any): any => {
            if (!val) return val;
            if (val instanceof Timestamp) return val.toDate().toISOString();
            if (val instanceof Date) return val.toISOString();
            if (Array.isArray(val)) return val.map(toPlain);
            if (typeof val === 'object' && val.constructor.name === 'Object') {
                const res: any = {};
                for (const k in val) res[k] = toPlain(val[k]);
                return res;
            }
            return val;
        };

        // Prepare the data payload for the server action
        const templatesMap = new Map((checklistTemplates || []).map(t => [t.id, t.name]));

        const enrichedCompletedChecklists = relatedData.checklistRuns.map(run => ({
            ...run,
            name: templatesMap.get(run.checklistId) || 'Onbekende Checklist'
        }));

        const sortedPerformanceData = relatedData.kpiData
            .map(kd => ({ startDate: kd.startDate, month: format(parseISO(kd.startDate), 'MMM yyyy', {locale: nl}), data: kd.kpiValues }))
            .sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());

        // Call the server action with all the data
        const result = await sendReportByEmail(
            toPlain(report),
            toPlain(parentClient),
            toPlain(childAccount),
            toPlain(sortedPerformanceData),
            toPlain(enrichedCompletedChecklists),
            toPlain(relatedData.completedTodos),
            toPlain(report.keyInsights || []),
            toPlain(report.nextSteps || [])
        );

        if (result.success) {
            // If email is sent, update the report doc from the client
            await updateDoc(reportRef, {
                lastEmailedAt: new Date().toISOString()
            });
            toast({ title: "E-mail verzonden", description: "Het rapport is succesvol naar de klant gemaild." });
            refetchReport(); // To show the updated "lastEmailedAt"
        } else {
            throw new Error(result.error || "Onbekende fout bij verzenden van e-mail.");
        }
    } catch (error: any) {
        console.error("Error sending email:", error);
        // Check if it's a Firestore permission error from our updateDoc call
        if (error.name === 'FirestoreError' && error.code === 'permission-denied') {
             const permissionError = new FirestorePermissionError({
                path: reportRef.path,
                operation: 'update',
                requestResourceData: { lastEmailedAt: '...' },
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             toast({ variant: 'destructive', title: 'Fout bij verzenden', description: error.message });
        }
    } finally {
        setIsSendingEmail(false);
    }
  };

  const { kpiCards, performanceData } = useMemo(() => {
    if (!childAccount || !relatedData.kpiData.length || !report) return { kpiCards: [], performanceData: [] };
    
    const reportMonthDate = startOfMonth(new Date(report.period + '-02'));
    const prevMonthDate = startOfMonth(subMonths(reportMonthDate, 1));
    
    const reportMonthKey = format(reportMonthDate, 'yyyy-MM');
    const prevMonthKey = format(prevMonthDate, 'yyyy-MM');
    
    const dataByMonth = new Map<string, Record<string, number>>();
    relatedData.kpiData.forEach(kd => {
        dataByMonth.set(format(parseISO(kd.startDate), 'yyyy-MM'), kd.kpiValues);
    });

    const currentData = dataByMonth.get(reportMonthKey);
    const prevData = dataByMonth.get(prevMonthKey);


    const calculateChange = (current?: number | null, prev?: number | null) => {
        if (prev === null || prev === undefined || current === null || current === undefined) return null;
        if (prev === 0) return current > 0 ? 100 : 0;
        return ((current - prev) / prev) * 100;
    };
    
    const getCPL = (data?: Record<string,number>) => {
        if (!data || !data['conversions'] || data['conversions'] === 0) return null;
        return (data['spend'] || 0) / data['conversions'];
    };
    
    const currentCPL = getCPL(currentData);
    const prevCPL = getCPL(prevData);
    
    const changeForCPL = calculateChange(currentCPL, prevCPL);


    const kpiCards = [
      { title: 'Uitgaven', value: currentData?.spend?.toFixed(2) || '0.00', unit: '€', change: calculateChange(currentData?.spend, prevData?.spend) },
      { title: 'Conversies', value: currentData?.conversions || 0, change: calculateChange(currentData?.conversions, prevData?.conversions) },
      { title: 'CPA / CPL', value: currentCPL?.toFixed(2) || '0.00', unit: '€', change: changeForCPL },
      { title: 'Klikken', value: currentData?.clicks || 0, change: calculateChange(currentData?.clicks, prevData?.clicks) },
    ];
    
    const monthsToDisplay = Array.from({ length: 4 }, (_, i) => subMonths(reportMonthDate, i));

    const performanceData = monthsToDisplay.map(monthDate => {
        const monthKey = format(monthDate, 'yyyy-MM');
        const data = dataByMonth.get(monthKey);
        if (!data) return null;

        return {
            month: format(monthDate, 'MMM yyyy', { locale: nl }),
            data,
        };
    }).filter(Boolean);

    return { kpiCards, performanceData };

  }, [childAccount, relatedData.kpiData, report]);
  
  const checklistCompletion = useMemo(() => {
      if (!relatedData.checklistRuns.length) return 0;
      return 100;
  }, [relatedData.checklistRuns]);

  const handleDownloadText = () => {
    if (!report || !childAccount || !aiSummary) return;

    let content = ``;
    content += `MAANDELIJKS RAPPORT: ${childAccount.nickname}\n`;
    content += `PERIODE: ${format(new Date(report.period + '-02'), 'MMMM yyyy', { locale: nl })}\n`;
    content += `==================================================\n\n`;

    content += `## MANAGEMENTSAMENVATTING\n`;
    content += `${aiSummary.executiveSummary}\n\n`;

    content += `## BELANGRIJKSTE INZICHTEN & OBSERVATIES\n`;
    aiSummary.keyInsights.forEach(insight => {
        content += `- **${insight.title}** (Impact: ${insight.impact}, Categorie: ${insight.category})\n`;
        content += `  ${insight.description}\n`;
    });
    content += `\n`;

    content += `## PRESTATIEGEGEVENS\n`;
    (performanceData as any[]).forEach(p => {
        content += `### ${p.month}\n`;
        childAccount.kpisToTrack.forEach(kpi => {
            content += `- ${kpi.replace(/_/g, ' ').toUpperCase()}: ${getKPIValue(kpi, p.data)}\n`;
        });
        content += `\n`;
    });

    if (report.campaignDataSnapshot) {
        content += `## CAMPAGNEPRESTATIES (${report.campaignDataSnapshot.period})\n`;
        report.campaignDataSnapshot.campaigns.forEach(camp => {
            content += `- ${camp.name}: Kosten €${camp.cost.toFixed(2)}, Conversies ${camp.conversions.toFixed(1)}, CPA €${camp.costPerConversion.toFixed(2)}\n`;
        });
        content += `\n`;
    }

    content += `## MANAGEMENTACTIVITEIT\n`;
    content += `### Voltooide Checklists\n`;
    relatedData.checklistRuns.forEach(run => {
        content += `- ${(run as any).name} (Voltooid: ${run.completedAt ? format(parseISO(run.completedAt as string), 'PPP', { locale: nl }) : 'N/A'})\n`;
        run.tasks.filter(t => t.notes).forEach(t => {
            content += `  - Notitie voor "${t.description}": ${t.notes}\n`;
        });
    });
    if (relatedData.checklistRuns.length === 0) content += `- Er zijn deze periode geen checklists uitgevoerd.\n`;
    content += `\n`;

    content += `### Voltooide Taken\n`;
    relatedData.completedTodos.forEach(todo => {
        content += `- ${todo.content}\n`;
    });
    if (relatedData.completedTodos.length === 0) content += `- Geen taken voltooid.\n`;
    content += `\n`;

    content += `## VOLGENDE STAPPEN\n`;
    aiSummary.nextSteps?.forEach(step => {
        content += `- ${step}\n`;
    });
    if (!aiSummary.nextSteps || aiSummary.nextSteps.length === 0) content += `- Geen specifieke volgende stappen geïdentificeerd.\n`;
    
    setNotepadContent(content);
    setIsNotepadOpen(true);
};

  if (reportLoading || accountLoading || parentLoading || dataLoading) {
    return <LoadingState />;
  }

  if (!report || !childAccount || !parentClient) {
    return <div>Rapport, account of klantgegevens konden niet worden geladen.</div>;
  }
  
  const impactStyles: Record<string, string> = {
      high: 'bg-red-500/20 text-red-300 border-red-500/50',
      medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
      low: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  }
  
  const getKPIValue = (kpi: string, data: Record<string, number> | undefined) => {
    if (!data) return '-';
    
    const spend = Number(data['spend']) || 0;
    const clicks = Number(data['clicks']) || 0;
    const impressions = Number(data['impressions']) || 0;
    const conversions = Number(data['conversions']) || 0;
    const conversionValue = Number(data['conversion_value']) || 0;

    switch (kpi) {
        case 'cpc':
            return clicks > 0 ? `€${(spend / clicks).toFixed(2)}` : '-';
        case 'ctr':
            return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-';
        case 'cpl':
            return conversions > 0 ? `€${(spend / conversions).toFixed(2)}` : '-';
        case 'roas':
            return spend > 0 ? `${(conversionValue / spend).toFixed(2)}x` : '-';
        case 'spend':
        case 'conversion_value':
             return `€${Number(data[kpi] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        default:
            return (data[kpi] as number)?.toLocaleString() ?? '0';
    }
};

    const statusMap: Record<string, { text: string; className: string }> = {
      draft: { text: "Concept", className: "bg-amber-500/20 text-amber-300 border border-amber-500/50" },
      finalized: { text: "Gefinaliseerd", className: "bg-blue-500/20 text-blue-300 border border-blue-500/50" },
      sent: { text: "Gepubliceerd", className: "bg-green-500/20 text-green-300 border border-green-500/50" },
      confirmed: { text: "Bevestigd", className: "bg-purple-500/20 text-purple-300 border border-purple-500/50" },
      skipped: { text: "Overgeslagen", className: "bg-slate-500/20 text-slate-300 border border-slate-500/50" },
    };

  return (
    <div className="bg-background min-h-screen">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b print:hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                 <div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={isClientUser ? `/portal/${report.parentClientId}` : '/dashboard/reports'}>
                          <ArrowLeft className="mr-2" />
                          {isClientUser ? 'Terug naar Portaal' : 'Terug naar Rapporten'}
                      </Link>
                    </Button>
                 </div>
                 <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={handleDownloadText}><FileText className="mr-2"/> Downloaden als Tekst</Button>
                    {!isClientUser && report.status !== 'draft' && (
                        <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail ? <Loader2 className="mr-2 animate-spin" /> : <Mail className="mr-2" />}
                            {report.lastEmailedAt ? 'Opnieuw mailen' : 'Mailen naar klant'}
                        </Button>
                    )}
                 </div>
            </div>
             {report.lastEmailedAt && !isClientUser && (
                <p className="text-xs text-muted-foreground text-right pb-2">
                    Laatst gemaild op: {format(parseISO(report.lastEmailedAt), 'PPP p', { locale: nl })}
                </p>
            )}
        </div>
      </div>

      <main className="container mx-auto py-8 px-4 sm:p-6 lg:px-8">
          <div className="space-y-8">
               <header className="mb-8 flex justify-between items-start">
                  <div>
                      <h1 className="font-headline text-4xl font-bold">{childAccount.nickname}</h1>
                      <p className="text-muted-foreground text-lg">{format(new Date(report.period + '-02'), 'MMMM yyyy', { locale: nl })} Rapport</p>
                  </div>
                   <div>
                        {report.status === 'draft' && !isClientUser && (
                            <Button onClick={() => handleUpdateStatus('finalized')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <Send />}
                                Rapport Finaliseren
                            </Button>
                        )}
                        {report.status === 'finalized' && !isClientUser && (
                            <Button onClick={() => handleUpdateStatus('sent')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <Send />}
                                Publiceren naar Klant
                            </Button>
                        )}
                        {report.status === 'sent' && isClientUser && (
                             <Button onClick={() => handleUpdateStatus('confirmed')} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                                Rapport Bevestigen
                            </Button>
                        )}
                         {report.status !== 'draft' && report.status !== 'finalized' && (!isClientUser || report.status !== 'sent') && (
                            <Badge className={cn("text-base", statusMap[report.status].className)}>
                                <CheckCircle className="mr-2" /> {statusMap[report.status].text}
                            </Badge>
                        )}
                   </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                      <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><Wand2 /> Managementsamenvatting</h2>
                      <Card className="bg-card">
                          <CardContent className="p-6 space-y-6">
                            <p className="text-muted-foreground">
                               {aiSummary?.executiveSummary || "Nog geen samenvatting gegenereerd."}
                            </p>
                            <Separator />
                            <div className="flex justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Rapportageperiode</p>
                                    <p className="font-medium">{format(new Date(report.period + '-02'), 'MMMM yyyy', { locale: nl })}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Primair Doel</p>
                                    <p className="font-medium">{childAccount.primaryGoal.replace(/_/g, ' ')}</p>
                                </div>
                                {!isClientUser && (
                                     <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={isGenerating}>
                                        {isGenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                        Opnieuw genereren
                                    </Button>
                                )}
                            </div>
                          </CardContent>
                      </Card>
                  </div>
                  <div className="lg:col-span-1 grid grid-cols-2 gap-4">
                      {kpiCards.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
                  </div>
              </div>

               <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><FileText /> Belangrijkste Inzichten & Observaties</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {aiSummary?.keyInsights?.map((insight, index) => (
                            <Card key={index} className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center justify-between">
                                        {insight.title}
                                        <Badge variant="outline" className={cn(impactStyles[insight.impact.toLowerCase()])}>{insight.impact}</Badge>
                                    </CardTitle>
                                    <Badge variant="secondary" className="w-fit">{insight.category}</Badge>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                         {!aiSummary?.keyInsights && <p className="text-muted-foreground col-span-3 text-center py-8">Geen inzichten gegenereerd.</p>}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><BarChart /> Prestatiegegevens</h2>
                    <Card>
                        <CardContent className="pt-6">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Maand</TableHead>
                                        {childAccount.kpisToTrack.map(kpi => <TableHead key={kpi} className="uppercase">{kpi.length > 4 ? kpi.slice(0,4) : kpi}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(performanceData as any[]).map(p => (
                                        <TableRow key={p.month}>
                                            <TableCell>{p.month}</TableCell>
                                            {childAccount.kpisToTrack.map(kpi => <TableCell key={kpi}>{getKPIValue(kpi, p.data)}</TableCell>)}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                {report.campaignDataSnapshot && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><Target /> Campagneprestaties ({report.campaignDataSnapshot.period})</h2>
                        <Card>
                            <CardContent className="p-0 overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Campagne</TableHead>
                                            <TableHead className="text-right">Kosten</TableHead>
                                            <TableHead className="text-right">Klikken</TableHead>
                                            <TableHead className="text-right">Weergaven</TableHead>
                                            <TableHead className="text-right">CTR</TableHead>
                                            <TableHead className="text-right">Conversies</TableHead>
                                            <TableHead className="text-right">CPA</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.campaignDataSnapshot.campaigns.map(camp => (
                                            <TableRow key={camp.id}>
                                                <TableCell className="font-medium">{camp.name}</TableCell>
                                                <TableCell className="text-right">€{camp.cost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right">{camp.clicks.toLocaleString('nl-NL')}</TableCell>
                                                <TableCell className="text-right">{camp.impressions.toLocaleString('nl-NL')}</TableCell>
                                                <TableCell className="text-right">{(camp.ctr * 100).toFixed(2)}%</TableCell>
                                                <TableCell className="text-right">{camp.conversions.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}</TableCell>
                                                <TableCell className="text-right">€{camp.costPerConversion.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                )}
              
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Managementactiviteit</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-4">
                            <Card className="bg-card">
                                <CardHeader><CardTitle>Voltooide Checklists</CardTitle></CardHeader>
                                <CardContent>
                                    <Accordion type="single" collapsible>
                                    {relatedData.checklistRuns.map(run => (
                                        <AccordionItem value={run.id} key={run.id}>
                                            <AccordionTrigger>
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-muted p-2 rounded-full"><CheckCircle className="text-green-400"/></div>
                                                    <div>
                                                        <p className="font-semibold text-base">{(run as any).name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {run.completedAt ? format(parseISO(run.completedAt as string), 'MMM dd', { locale: nl }) : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="space-y-2 pl-12 pt-2">
                                                    {run.tasks.filter(t => t.notes).map(t => <li key={t.taskId} className="text-sm text-muted-foreground">{t.description}: <span className="text-foreground">{t.notes}</span></li>)}
                                                    {run.tasks.filter(t => t.notes).length === 0 && <p className="text-sm text-muted-foreground pl-2">Geen notities voor deze run.</p>}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                    </Accordion>
                                    {relatedData.checklistRuns.length === 0 && <p className="text-muted-foreground text-center py-8">Er zijn deze periode geen checklists uitgevoerd.</p>}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1">
                             <Card className="bg-card">
                                <CardHeader><CardTitle>Taken</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="font-semibold mb-2">Deze maand voltooid</h3>
                                            {relatedData.completedTodos.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {relatedData.completedTodos.map(todo => (
                                                        <li key={todo.id} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                                                            <Checkbox checked disabled />
                                                            {todo.content}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-muted-foreground">Geen taken voltooid.</p>}
                                        </div>
                                         <Separator />
                                         <div>
                                            <h3 className="font-semibold mb-2">Nog openstaand</h3>
                                             {relatedData.pendingTodos.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {relatedData.pendingTodos.map(todo => (
                                                        <li key={todo.id} className="flex items-center gap-2 text-sm">
                                                            <Checkbox disabled />
                                                            {todo.content}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-muted-foreground">Geen openstaande taken.</p>}
                                        </div>
                                    </div>
                                </CardContent>
                             </Card>
                        </div>
                    </div>
                </div>

                {aiSummary?.nextSteps && aiSummary.nextSteps.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2"><ChevronsRight /> Volgende Stappen</h2>
                        <Card>
                            <CardContent className="p-6">
                                <ul className="space-y-3">
                                {aiSummary.nextSteps.map((step, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        <div className="flex-shrink-0 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">{index + 1}</div>
                                        <p className="text-foreground/90">{step}</p>
                                    </li>
                                ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                )}
          </div>
      </main>

       <NotepadDialog
            content={notepadContent}
            open={isNotepadOpen}
            onOpenChange={setIsNotepadOpen}
        />
    </div>
  );
}

export default ReportPage;
