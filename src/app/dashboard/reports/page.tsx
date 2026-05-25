
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, doc, writeBatch, arrayUnion, Timestamp, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { ParentClient, ChildAccount, MonthlyReport, KpiData, Todo, ChecklistRun, ChecklistTemplate } from '@/lib/types';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, Users, FileText, Wand2, MoreHorizontal, CheckCircle, Settings, Search as SearchIcon, FileWarning, Play, View, SkipForward, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { sendReportByEmail } from '@/app/actions/send-report-email';
import { fetchCampaignPerformance } from '@/app/actions/google-ads-campaigns';

type EnrichedAccount = ChildAccount & {
    parentName: string;
    reportStatus: 'generated' | 'not-generated' | 'draft' | 'finalized' | 'sent' | 'confirmed' | 'skipped';
    report?: MonthlyReport;
    hasKpiDataForMonth?: boolean;
};


function KpiEntryDialog({ 
    account, 
    period, 
    open, 
    onOpenChange, 
    onSave,
    managerUid
} : { 
    account: ChildAccount, 
    period: string, 
    open: boolean, 
    onOpenChange: (open: boolean) => void,
    onSave: () => void,
    managerUid: string
}) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [kpiValues, setKpiValues] = useState<Record<string, string>>({});

    const handleValueChange = (kpi: string, value: string) => {
        setKpiValues(prev => ({ ...prev, [kpi]: value }));
    };

    const handleSave = async () => {
        if (!firestore || !user) return;
        setIsSaving(true);
        
        const numericKpiValues: Record<string, number> = {};
        for (const kpi in kpiValues) {
            const value = parseFloat(kpiValues[kpi]);
            if (!isNaN(value)) {
                numericKpiValues[kpi] = value;
            }
        }
        
        if (Object.keys(numericKpiValues).length === 0) {
            toast({ variant: 'destructive', title: 'Geen gegevens ingevoerd' });
            setIsSaving(false);
            return;
        }

        const kpiDataCollection = collection(firestore, 'kpiData');
        const newDocRef = doc(kpiDataCollection);

        const kpiDoc: Omit<KpiData, 'id'> = {
            ownerId: managerUid,
            childAccountId: account.id,
            periodType: 'monthly',
            startDate: startOfMonth(new Date(period)).toISOString(),
            kpiValues: numericKpiValues
        };
        
        const childAccountRef = doc(firestore, 'parentClients', account.parentClientId, 'childAccounts', account.id);

        try {
            const batch = writeBatch(firestore);
            batch.set(newDocRef, kpiDoc);
            batch.update(childAccountRef, { kpiDataIds: arrayUnion(newDocRef.id) });
            await batch.commit();
            
            toast({ title: 'KPI-gegevens opgeslagen' });
            onSave(); // This will trigger the report generation now
            onOpenChange(false);
        } catch (e) {
            console.error("Error saving KPI data:", e);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'kpiData', operation: 'create', requestResourceData: kpiDoc }));
        } finally {
            setIsSaving(false);
        }
    };
    
    const inputKpis = account.kpisToTrack.filter(kpi => !['cpc', 'ctr', 'cpl', 'roas'].includes(kpi));


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Voer KPI-gegevens in voor {format(new Date(period), 'MMMM yyyy', { locale: nl })}</DialogTitle>
                    <DialogDescription>
                        Voor het genereren van rapporten zijn de KPI-gegevens voor de geselecteerde maand vereist. Voer de waarden in voor {account.nickname}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    {inputKpis.map(kpi => {
                        const isCurrency = ['spend', 'conversion_value'].includes(kpi);
                        return (
                            <div key={kpi} className="space-y-2">
                                <Label htmlFor={kpi} className="capitalize">{kpi.replace(/_/g, ' ')}</Label>
                                <div className="relative">
                                    {isCurrency && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>}
                                    <Input
                                        id={kpi}
                                        type="number"
                                        value={kpiValues[kpi] || ''}
                                        onChange={(e) => handleValueChange(kpi, e.target.value)}
                                        className={cn(isCurrency && "pl-6")}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Opslaan & Rapport Genereren
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function LoadingState() {
    return (
        <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center border-dashed bg-transparent border-slate-800">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-12 text-blue-500 animate-spin" />
                <h3 className="text-xl font-semibold font-headline">Rapportgegevens laden...</h3>
                <p className="text-muted-foreground max-w-sm">
                    Een ogenblik geduld terwijl we uw accounts en rapporten ophalen.
                </p>
            </div>
        </Card>
    );
}

export default function ReportDashboard() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const [appUser, setAppUser] = useState<any>(null);
    
    useEffect(() => {
        if (!userDocRef) return;
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                setAppUser({ id: doc.id, ...doc.data() });
            }
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const isAdmin = useMemo(() => {
        const role = (appUser as any)?.role?.toLowerCase();
        return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
    }, [appUser, user?.email]);

    const [loading, setLoading] = useState(true);
    const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
    const [skippingReportId, setSkippingReportId] = useState<string | null>(null);
    const [sendingReportId, setSendingReportId] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<EnrichedAccount[]>([]);
    const [reportsByAccount, setReportsByAccount] = useState<Record<string, MonthlyReport[]>>({});
    const [currentMonth, setCurrentMonth] = useState(subMonths(new Date(), 1));
    const managerUidForKpi = useMemo(() => isAdmin ? user?.uid : appUser?.managerId, [isAdmin, user, appUser]);
    const [kpiModalState, setKpiModalState] = useState<{ open: boolean; account: ChildAccount | null }>({ open: false, account: null });
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'draft' | 'finalized' | 'sent' | 'confirmed' | 'skipped' | 'history'>('all');
    
    const selectedPeriod = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
    const selectedPeriodStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const selectedPeriodEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

    const fetchReportData = async () => {
        if (!firestore || !user || !appUser) return;
        setLoading(true);
        try {
            const managerUid = isAdmin ? user.uid : appUser.managerId;
            if (!managerUid) {
                setLoading(false);
                return;
            }

            const clientsQuery = query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
            const [clientsSnapshot] = await Promise.all([getDocs(clientsQuery)]);

            const parentClientMap = new Map(clientsSnapshot.docs.map(doc => [doc.id, (doc.data() as ParentClient)]));

            const allChildAccounts: ChildAccount[] = [];
            for (const clientId of parentClientMap.keys()) {
                const accountsQuery = query(collection(firestore, `parentClients/${clientId}/childAccounts`));
                const accountsSnapshot = await getDocs(accountsQuery);
                accountsSnapshot.forEach(doc => {
                    allChildAccounts.push({ id: doc.id, ...doc.data() } as ChildAccount);
                });
            }
            
            const activeChildAccounts = allChildAccounts.filter(acc => {
                if (acc.isPaused) return false;
                if (!isAdmin) return acc.assignedEmployeeId === user.uid;
                return true;
            });
            const allKpiDataIds = activeChildAccounts.flatMap(a => a.kpiDataIds || []);
            
            const kpiDocsPromises = [];
            for (let i = 0; i < allKpiDataIds.length; i += 30) {
                const chunk = allKpiDataIds.slice(i, i + 30);
                if (chunk.length > 0) {
                    kpiDocsPromises.push(getDocs(query(collection(firestore, 'kpiData'), where('__name__', 'in', chunk))));
                }
            }

            let reportsQuery;
            if (activeTab === 'history') {
                reportsQuery = query(
                    collection(firestore, 'reports'),
                    where('ownerId', '==', managerUid)
                );
            } else {
                reportsQuery = query(
                    collection(firestore, 'reports'),
                    where('ownerId', '==', managerUid),
                    where('period', '==', selectedPeriod)
                );
            }

            const [kpiDocsSnaps, reportsSnapshot] = await Promise.all([Promise.all(kpiDocsPromises), getDocs(reportsQuery)]);

            const allKpiData = kpiDocsSnaps.flatMap(snap => snap.docs.map(d => {
                const { id: _, ...data } = d.data() as any;
                return { ...data, id: d.id } as KpiData;
            }));

            const kpiDataByAccount: Record<string, KpiData[]> = {};
            allKpiData.forEach(kpiDoc => {
                if (!kpiDataByAccount[kpiDoc.childAccountId]) kpiDataByAccount[kpiDoc.childAccountId] = [];
                kpiDataByAccount[kpiDoc.childAccountId].push(kpiDoc);
            });

            const reportsByAccountRaw: Record<string, MonthlyReport[]> = {};
            reportsSnapshot.docs.forEach(doc => {
                const { id: _, ...data } = doc.data() as any;
                const report = { ...data, id: doc.id } as MonthlyReport;
                if (!reportsByAccountRaw[report.childAccountId]) reportsByAccountRaw[report.childAccountId] = [];
                reportsByAccountRaw[report.childAccountId].push(report);
            });
            setReportsByAccount(reportsByAccountRaw);

            // Map for quick access (still useful for single-period view)
            const reportsMap = new Map(reportsSnapshot.docs.map(doc => {
                const { id: _, ...data } = doc.data() as any;
                return [data.childAccountId, { ...data, id: doc.id }];
            }));

            // Use YYYY-MM-DD for robust comparison across timezones
            const targetDateStr = format(selectedPeriodStart, 'yyyy-MM-dd');

            const enrichedAccounts: EnrichedAccount[] = activeChildAccounts.map(account => {
                const report = reportsMap.get(account.id);
                const accountKpis = kpiDataByAccount[account.id] || [];
                
                const hasKpiDataForMonth = accountKpis.some(kpi => {
                    const kpiDateStr = kpi.startDate.split('T')[0];
                    return kpiDateStr === targetDateStr;
                });
                
                return {
                    ...account,
                    parentName: parentClientMap.get(account.parentClientId)?.clientName || 'Unknown Client',
                    reportStatus: report ? report.status : 'not-generated',
                    report: report,
                    hasKpiDataForMonth: hasKpiDataForMonth,
                };
            });
            
            setAccounts(enrichedAccounts);

        } catch (e: any) {
            console.error("Error fetching report data", e);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'reports', operation: 'list' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (appUser) {
            fetchReportData();
        }
    }, [firestore, user, appUser, selectedPeriod, selectedPeriodStart, isAdmin, activeTab]);

    const handleGenerateReport = async (account: ChildAccount & { hasKpiDataForMonth?: boolean }) => {
        if (!firestore || !user || !appUser) return;
        
        const managerUid = isAdmin ? user.uid : appUser.managerId;
        if (!managerUid) return;

        if (!account.hasKpiDataForMonth) {
            setKpiModalState({ open: true, account: account });
            return;
        }

        setGeneratingReportId(account.id);
        
        try {
            const checklistRunsQuery = query(
                collection(firestore, 'checklistRuns'),
                where('childAccountId', '==', account.id),
                where('status', '==', 'complete')
            );
            const checklistRunsSnapshot = await getDocs(checklistRunsQuery);
            const completedChecklistRunIds = checklistRunsSnapshot.docs
                .map(doc => {
                    const { id: _, ...data } = doc.data() as any;
                    return { ...data, id: doc.id } as ChecklistRun;
                })
                .filter(run => {
                    const completedAt = (run.completedAt as any)?.seconds 
                        ? new Timestamp((run.completedAt as any).seconds, (run.completedAt as any).nanoseconds).toDate() 
                        : (typeof run.completedAt === 'string' ? parseISO(run.completedAt) : (run.completedAt as any));
                    return isWithinInterval(completedAt, { start: selectedPeriodStart, end: selectedPeriodEnd });
                })
                .map(run => run.id);

            const todosQuery = query(
                collection(firestore, 'users', managerUid, 'todos'),
                where('childAccountId', '==', account.id),
                where('completed', '==', true)
            );
            const todosSnapshot = await getDocs(todosQuery);
            const completedTodoIds = todosSnapshot.docs
                 .map(doc => {
                     const { id: _, ...data } = doc.data() as any;
                     return { ...data, id: doc.id } as Todo;
                 })
                 .filter(todo => {
                     if (!todo.completedAt) return false;
                     const completedAt = (todo.completedAt as any)?.seconds 
                        ? new Timestamp((todo.completedAt as any).seconds, (todo.completedAt as any).nanoseconds).toDate() 
                        : (typeof todo.completedAt === 'string' ? parseISO(todo.completedAt) : (todo.completedAt as any));
                     return isWithinInterval(completedAt, { start: selectedPeriodStart, end: selectedPeriodEnd });
                 })
                 .map(todo => todo.id);

            const currentMonthDate = startOfMonth(new Date());
            const isCurrentMonth = selectedPeriodStart.getTime() === currentMonthDate.getTime();
            const dateRange = isCurrentMonth ? 'THIS_MONTH' : 'LAST_MONTH';
            
            let campaignDataSnapshot = null;
            if (account.googleAdsClientId) {
                try {
                    campaignDataSnapshot = await fetchCampaignPerformance(
                        account.id,
                        account.googleAdsClientId,
                        dateRange
                    );
                } catch (e) {
                    console.error("Kon campagnedata niet ophalen voor rapportage:", e);
                }
            }

            const newReport = {
                ownerId: managerUid,
                childAccountId: account.id,
                parentClientId: account.parentClientId,
                period: selectedPeriod,
                status: 'draft',
                generatedAt: new Date().toISOString(),
                completedChecklistRunIds: completedChecklistRunIds,
                completedTodoRunIds: completedTodoIds,
                campaignDataSnapshot: campaignDataSnapshot || undefined,
                aiSummary: '',
                keyInsights: [],
                nextSteps: []
            };

            const reportsCollection = collection(firestore, 'reports');
            const docRef = await addDoc(reportsCollection, newReport as any);
            router.push(`/dashboard/reports/${docRef.id}`);

        } catch (e: any) {
             console.error("Error generating report:", e);
             setGeneratingReportId(null);
        }
    }

    const handleSkipReport = async (account: ChildAccount) => {
        if (!firestore || !user || !appUser) return;
        const managerUid = isAdmin ? user.uid : appUser.managerId;
        if (!managerUid) return;

        setSkippingReportId(account.id);

        try {
            const skippedReport = {
                ownerId: managerUid,
                childAccountId: account.id,
                parentClientId: account.parentClientId,
                period: selectedPeriod,
                status: 'skipped',
                generatedAt: new Date().toISOString(),
                completedChecklistRunIds: [],
                completedTodoRunIds: [],
                aiSummary: 'Rapportage overgeslagen voor deze periode.',
                keyInsights: [],
                nextSteps: []
            };

            const reportsCollection = collection(firestore, 'reports');
            await addDoc(reportsCollection, skippedReport as any);
            
            toast({ title: 'Rapport overgeslagen', description: `De periode ${selectedPeriod} is voor ${account.nickname} gemarkeerd als overgeslagen.` });
            fetchReportData(); // Refresh list
        } catch (e: any) {
            console.error("Error skipping report:", e);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'reports', operation: 'create', requestResourceData: {} }));
        } finally {
            setSkippingReportId(null);
        }
    }

    const handlePublishAndSend = async (account: EnrichedAccount) => {
        if (!firestore || !user || !appUser || !account.report) return;
        const managerUid = isAdmin ? user.uid : appUser.managerId;
        if (!managerUid) return;

        setSendingReportId(account.id);

        try {
            const report = account.report;
            const reportRef = doc(firestore, 'reports', report.id);
            const parentClientRef = doc(firestore, 'parentClients', report.parentClientId);
            
            // 1. Fetch all necessary data for the email
            const [clientSnap, checklistTemplatesSnap, kpiDocsSnap, checklistRunsSnap, completedTodosSnap] = await Promise.all([
                getDoc(parentClientRef),
                getDocs(query(collection(firestore, 'users', managerUid, 'checklistTemplates'))),
                getDocs(query(collection(firestore, 'kpiData'), where('childAccountId', '==', account.id))),
                Promise.all((report.completedChecklistRunIds || []).map(id => getDoc(doc(firestore, 'checklistRuns', id)))),
                Promise.all((report.completedTodoRunIds || []).map(id => getDoc(doc(firestore, `users/${managerUid}/todos/${id}`))))
            ]);

            const client = clientSnap.data() as ParentClient;
            const templatesMap = new Map(checklistTemplatesSnap.docs.map(d => [d.id, (d.data() as ChecklistTemplate).name]));
            
            const performanceData = kpiDocsSnap.docs
                .map(d => {
                    const kd = d.data() as KpiData;
                    return { startDate: kd.startDate, month: format(parseISO(kd.startDate), 'MMM yyyy', {locale: nl}), data: kd.kpiValues };
                })
                .sort((a, b) => b.startDate.localeCompare(a.startDate));

            const completedChecklists = checklistRunsSnap
                .filter(s => s.exists())
                .map(s => {
                    const data = s.data() as ChecklistRun;
                    let completedAt = data.completedAt;
                    if (completedAt instanceof Timestamp) completedAt = completedAt.toDate().toISOString();
                    let runAt = data.runAt;
                    if (runAt instanceof Timestamp) runAt = runAt.toDate().toISOString();
                    return { ...data, name: templatesMap.get(data.checklistId) || 'Onbekende Checklist', completedAt, runAt };
                });

            const completedTodos = completedTodosSnap
                .filter(s => s.exists())
                .map(s => {
                    const data = s.data();
                    let completedAt = data?.completedAt;
                    if (completedAt instanceof Timestamp) completedAt = completedAt.toDate().toISOString();
                    let createdAt = data?.createdAt;
                    if (createdAt instanceof Timestamp) createdAt = createdAt.toDate().toISOString();
                    return { id: s.id, ...data, completedAt, createdAt } as Todo;
                });

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

            // 2. Publish (Update Status)
            await updateDoc(reportRef, { 
                status: 'sent',
                lastEmailedAt: new Date().toISOString()
            });

            // 3. Send Email
            const result = await sendReportByEmail(
                toPlain({ ...report, status: 'sent' }),
                toPlain(client),
                toPlain(account as ChildAccount),
                toPlain(performanceData),
                toPlain(completedChecklists),
                toPlain(completedTodos),
                toPlain(report.keyInsights || []),
                toPlain(report.nextSteps || [])
            );

            if (result.success) {
                toast({ title: 'Rapport Verzonden!', description: `Het rapport voor ${account.nickname} is gepubliceerd en gemaild.` });
                fetchReportData();
            } else {
                throw new Error(result.error || "Fout bij verzenden e-mail.");
            }

        } catch (e: any) {
            console.error("Error publishing and sending report:", e);
            toast({ variant: 'destructive', title: 'Fout bij verzenden', description: e.message });
        } finally {
            setSendingReportId(null);
        }
    }


    const handlePrevMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const { pendingCount, draftCount, finalizedCount, sentCount, confirmedCount, skippedCount, completionPercentage } = useMemo(() => {
        const statusCounts = accounts.reduce((acc, account) => {
            const status = account.report?.status || 'not-generated';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalAccounts = accounts.length;
        if (totalAccounts === 0) {
            return { pendingCount: 0, draftCount: 0, finalizedCount: 0, sentCount: 0, confirmedCount: 0, skippedCount: 0, completionPercentage: 0 };
        }

        const confirmed = statusCounts['confirmed'] || 0;
        const sent = statusCounts['sent'] || 0;
        const finalized = statusCounts['finalized'] || 0;
        const draft = statusCounts['draft'] || 0;
        const skipped = statusCounts['skipped'] || 0;
        
        return {
            pendingCount: totalAccounts - (confirmed + sent + finalized + draft + skipped),
            draftCount: draft,
            finalizedCount: finalized,
            sentCount: sent,
            confirmedCount: confirmed,
            skippedCount: skipped,
            completionPercentage: ((confirmed + sent + skipped) / totalAccounts) * 100,
        };
    }, [accounts]);

     const filteredAccounts = useMemo(() => {
        if (activeTab === 'all') return accounts;
        if (activeTab === 'pending') return accounts.filter(acc => acc.reportStatus === 'not-generated');
        return accounts.filter(acc => acc.reportStatus === activeTab);
    }, [accounts, activeTab]);


    const accountsByClient = useMemo(() => {
        return filteredAccounts.reduce((acc, account) => {
            if (!acc[account.parentClientId]) {
                acc[account.parentClientId] = {
                    parentName: account.parentName,
                    accounts: []
                };
            }
            acc[account.parentClientId].accounts.push(account);
            return acc;
        }, {} as Record<string, { parentName: string, accounts: EnrichedAccount[] }>);
    }, [filteredAccounts]);
    
    const cycleStatusData = useMemo(() => ([
        { name: 'In afwachting', value: pendingCount, color: '#6b7280' },
        { name: 'Concept', value: draftCount, color: '#f59e0b' },
        { name: 'Gefinaliseerd', value: finalizedCount, color: '#3b82f6' },
        { name: 'Gepubliceerd', value: sentCount, color: '#10b981' },
        { name: 'Bevestigd', value: confirmedCount, color: '#8b5cf6' },
        { name: 'Overgeslagen', value: skippedCount, color: '#475569' },
    ]), [pendingCount, draftCount, finalizedCount, sentCount, confirmedCount, skippedCount]);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold tracking-tight text-slate-100">Rapportagezone</h1>
                 <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth} className="border-slate-700 hover:bg-slate-800">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold font-headline text-center w-32 text-slate-200">
                        {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} className="border-slate-700 hover:bg-slate-800">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-3 glass-card">
                    <CardHeader>
                        <CardTitle className="text-slate-200">Maandelijkse Cyclusstatus</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative size-32">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={cycleStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={450} paddingAngle={0} stroke="none">
                                        {cycleStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-bold text-slate-100">{Math.round(completionPercentage)}%</span>
                            </div>
                        </div>
                         <div className="flex-grow grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-center">
                            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Wachtrij</p><p className="text-2xl font-bold text-slate-200">{pendingCount}</p></div>
                            <div><p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Concept</p><p className="text-2xl font-bold text-amber-400">{draftCount}</p></div>
                            <div><p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Klaar</p><p className="text-2xl font-bold text-blue-400">{finalizedCount}</p></div>
                            <div><p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Verzonden</p><p className="text-2xl font-bold text-green-400">{sentCount}</p></div>
                            <div><p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">Bevestigd</p><p className="text-2xl font-bold text-purple-400">{confirmedCount}</p></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Skips</p><p className="text-2xl font-bold text-slate-400">{skippedCount}</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
             <div className="flex justify-between items-center bg-card p-1.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <Button variant={activeTab === 'all' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('all')} className="h-8 text-[10px] uppercase font-bold tracking-wider">Alles</Button>
                    <Button variant={activeTab === 'pending' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('pending')} className="h-8 text-[10px] uppercase font-bold tracking-wider">Wachtrij</Button>
                     <Button variant={activeTab === 'draft' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('draft')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-amber-400">Concepten</Button>
                    <Button variant={activeTab === 'finalized' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('finalized')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-blue-400">Gefinaliseerd</Button>
                    <Button variant={activeTab === 'sent' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('sent')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-green-400">Verzonden</Button>
                    <Button variant={activeTab === 'confirmed' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('confirmed')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-purple-400">Bevestigd</Button>
                    <Button variant={activeTab === 'skipped' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('skipped')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-400">Skips</Button>
                    <Button variant={activeTab === 'history' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('history')} className="h-8 text-[10px] uppercase font-bold tracking-wider text-blue-400">Geschiedenis</Button>
                </div>
            </div>

            {loading ? <LoadingState /> : (
                <Accordion type="multiple" defaultValue={Object.keys(accountsByClient)} className="w-full space-y-4">
                    {Object.entries(accountsByClient).map(([clientId, clientData]) => (
                        <AccordionItem value={clientId} key={clientId} className="border-none glass-card rounded-xl overflow-hidden shadow-sm">
                             <div className="flex items-center px-6 py-4 hover:bg-white/5 transition-colors">
                                <AccordionTrigger className="flex-grow p-0 hover:no-underline">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                                            <Users className="size-5" />
                                        </div>
                                        <h3 className="text-lg font-bold font-headline text-slate-100">{clientData.parentName} <span className="text-xs font-normal text-slate-500 ml-2">({clientData.accounts.length} accounts)</span></h3>
                                    </div>
                                </AccordionTrigger>
                            </div>
                            <AccordionContent className="p-0 border-t border-white/5 bg-black/10">
                                <div className="divide-y divide-white/5">
                                {clientData.accounts.flatMap(account => {
                                    const accountReports = (activeTab === 'history') 
                                        ? (reportsByAccount[account.id] || []).sort((a, b) => b.period.localeCompare(a.period))
                                        : [account.report].filter(Boolean) as MonthlyReport[];
                                    
                                    if (activeTab === 'history' && accountReports.length === 0) {
                                        return [(
                                            <div key={account.id} className="p-4 pl-8 text-xs text-slate-500 italic">
                                                Geen rapportages gevonden voor {account.nickname}.
                                            </div>
                                        )];
                                    }

                                    // If not in history mode and no report exists, we still show the "Not Generated" row
                                    const reportsToRender = (activeTab !== 'history' && accountReports.length === 0) 
                                        ? [null as any] 
                                        : accountReports;

                                    return reportsToRender.map((reportInstance, rIndex) => {
                                        const currentReport = reportInstance;
                                        const status = currentReport?.status || 'not-generated';
                                        const generatedAtDate = currentReport?.generatedAt;
                                        let formattedDate = 'Geen datum';
                                        if (generatedAtDate) {
                                            const date = (generatedAtDate as any).seconds 
                                                ? new Date((generatedAtDate as any).seconds * 1000) 
                                                : new Date(generatedAtDate as string);
                                            if (!isNaN(date.getTime())) {
                                                formattedDate = format(date, 'dd MMM', { locale: nl });
                                            }
                                        }

                                        return (
                                        <div key={`${account.id}-${rIndex}`} className="p-4 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 hover:bg-white/5 transition-colors">
                                            <div className="pl-4">
                                                <Link href={`/dashboard/accounts/${account.id}?parent=${account.parentClientId}`} className="font-bold text-slate-200 hover:text-blue-400 transition-colors">
                                                    {account.nickname}
                                                </Link>
                                                {activeTab === 'history' && currentReport && (
                                                    <span className="ml-2 text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded">
                                                        {format(new Date(currentReport.period + '-02'), 'MMM yyyy', { locale: nl })}
                                                    </span>
                                                )}
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Budget: €{account.monthlyClickBudget?.toLocaleString('nl-NL') || 0}</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                {activeTab === 'history' ? (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-500/20 bg-slate-500/5 text-[9px] font-black uppercase">Archief</Badge>
                                                ) : (
                                                    account.hasKpiDataForMonth ? (
                                                        <Badge variant="outline" className="text-green-400 border-green-500/20 bg-green-500/5 text-[9px] font-black uppercase"><CheckCircle className="mr-1 size-3"/>Data OK</Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] font-black uppercase"><FileWarning className="mr-1 size-3"/>Mis data</Badge>
                                                    )
                                                )}
                                            </div>

                                            <div className="flex flex-col">
                                                <Badge 
                                                    className={cn("w-fit font-black text-[9px] uppercase tracking-wider h-5 border-none", {
                                                        'bg-blue-500/10 text-blue-400': status === 'finalized',
                                                        'bg-amber-500/10 text-amber-400': status === 'draft',
                                                        'bg-green-500/10 text-green-400': status === 'sent',
                                                        'bg-purple-500/10 text-purple-400': status === 'confirmed',
                                                        'bg-slate-500/10 text-slate-400': status === 'skipped',
                                                        'bg-slate-800 text-slate-500': status === 'not-generated',
                                                    })}
                                                >
                                                    {status === 'skipped' && <SkipForward className="mr-1 size-2.5" />}
                                                    {status === 'not-generated' ? 'In wachtrij' : status}
                                                </Badge>
                                                {status !== 'not-generated' && (
                                                    <span className="text-[9px] text-slate-600 mt-1 font-bold uppercase">{formattedDate}</span>
                                                )}
                                            </div>

                                            <div className="text-right flex items-center gap-2 pr-4 justify-end">
                                                {status === 'finalized' && (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handlePublishAndSend({ ...account, report: currentReport })}
                                                        disabled={sendingReportId === account.id}
                                                        className="h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20"
                                                    >
                                                        {sendingReportId === account.id ? <Loader2 className="animate-spin size-3 mr-2" /> : <Send className="mr-2 size-3"/>}
                                                        Publiceer & Mail
                                                    </Button>
                                                )}
                                                
                                                {status !== 'not-generated' ? (
                                                    <Button variant="ghost" size="sm" asChild className="h-8 px-3 text-xs font-bold text-slate-400 hover:text-white">
                                                        <Link href={`/dashboard/reports/${currentReport?.id}`}><View className="mr-2 size-3.5"/>Inzien</Link>
                                                    </Button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleSkipReport(account)} 
                                                            disabled={skippingReportId === account.id || generatingReportId === account.id}
                                                            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5"
                                                        >
                                                            {skippingReportId === account.id ? <Loader2 className="animate-spin size-3" /> : <SkipForward className="mr-2 size-3"/>}
                                                            Skip
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleGenerateReport(account)} 
                                                            disabled={generatingReportId === account.id || skippingReportId === account.id}
                                                            className="h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                                        >
                                                            {generatingReportId === account.id ? <Loader2 className="animate-spin size-3" /> : <Wand2 className="mr-2 size-3"/>}
                                                            Run
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    });
                                })}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}


            {kpiModalState.account && managerUidForKpi && (
                <KpiEntryDialog
                    account={kpiModalState.account}
                    period={selectedPeriod}
                    open={kpiModalState.open}
                    onOpenChange={(open) => setKpiModalState({ open, account: null })}
                    onSave={() => {
                        if (kpiModalState.account) {
                           handleGenerateReport({ ...kpiModalState.account, hasKpiDataForMonth: true });
                        }
                    }}
                    managerUid={managerUidForKpi}
                />
            )}
        </div>
    );

    
}
