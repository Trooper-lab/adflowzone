
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, doc, query, where, Timestamp, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, ChevronLeft, ChevronRight, Download, Wallet, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount, ParentClient, MonthlyReport, KpiData } from '@/lib/types';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading reports...</span>
    </div>
  );
}

export default function ClientReportsPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [currentMonth, setCurrentMonth] = useState(subMonths(new Date(), 1));
  const { toast } = useToast();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const selectedPeriod = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
  
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !clientId) return null;
    return query(
      collection(firestore, 'reports'),
      where('parentClientId', '==', clientId),
      where('status', 'in', ['sent', 'confirmed'])
    );
  }, [firestore, user, clientId]);

  const { data: reports, loading: reportsLoading } = useCollection(reportsQuery);
  
  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return query(collection(firestore, 'parentClients', clientId as string, 'childAccounts'));
  }, [firestore, clientId]);
  const { data: accounts, loading: accountsLoading } = useCollection(accountsQuery);

  const accountIds = useMemo(() => accounts?.map(a => a.id) || [], [accounts]);

  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || accountIds.length === 0) return null;
    return query(collection(firestore, 'kpiData'), where('childAccountId', 'in', accountIds));
  }, [firestore, accountIds]);
  const { data: kpiData, loading: kpiLoading } = useCollection(kpiQuery);

  const handleConfirmReport = async (reportId: string) => {
    if (!firestore) return;
    setConfirmingId(reportId);
    const reportRef = doc(firestore, 'reports', reportId);
    try {
        await updateDoc(reportRef, { status: 'confirmed' });
        toast({ title: "Report Confirmed", description: "Thank you for confirming the report."});
    } catch (e: any) {
        console.error("Error confirming report:", e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reportRef.path, operation: 'update', requestResourceData: { status: 'confirmed' } }));
    } finally {
        setConfirmingId(null);
    }
  }


  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };
  
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return (reports as MonthlyReport[]).filter(r => r.period === selectedPeriod);
  }, [reports, selectedPeriod]);
  
  const accountsMap = useMemo(() => {
      if (!accounts) return new Map();
      return new Map((accounts as ChildAccount[]).map(acc => [acc.id, acc]));
  }, [accounts]);

  const kpiDataMap = useMemo(() => {
    if (!kpiData) return new Map();
    const map = new Map<string, number>();
    (kpiData as KpiData[]).forEach(kd => {
      if (format(parseISO(kd.startDate), 'yyyy-MM') === selectedPeriod) {
        map.set(kd.childAccountId, kd.kpiValues.spend || 0);
      }
    });
    return map;
  }, [kpiData, selectedPeriod]);


  if (reportsLoading || accountsLoading || kpiLoading) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            View all finalized reports for your accounts.
          </p>
        </div>
         <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold font-headline text-center w-32">
                {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>
      
      {filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map(report => {
                const account = accountsMap.get(report.childAccountId);
                if (!account) return null;
                const spend = kpiDataMap.get(report.childAccountId) || 0;
                const budget = account.monthlyClickBudget || 0;
                const spendPercentage = budget > 0 ? (spend / budget) * 100 : 0;
                const isConfirming = confirmingId === report.id;

                return (
                    <Card key={report.id} className="flex flex-col justify-between bg-card">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{account.nickname}</CardTitle>
                                    <CardDescription>Report for {format(parseISO(report.period + '-02'), 'MMMM yyyy')}</CardDescription>
                                </div>
                                {report.status === 'sent' && (
                                    <Button onClick={() => handleConfirmReport(report.id)} disabled={isConfirming} className="bg-orange-500 hover:bg-orange-600 text-white">
                                        {isConfirming ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                                        Confirm
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                         <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-3 h-[60px]">{report.aiSummary}</p>
                        </CardContent>
                        <CardContent className="flex-grow flex flex-col justify-end">
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                     <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><Wallet/> Spend</p>
                                     <p className="font-bold text-lg">€{spend.toLocaleString()}<span className="text-sm text-muted-foreground font-normal"> / €{budget.toLocaleString()}</span></p>
                                </div>
                                <Progress value={spendPercentage} />
                            </div>
                             <Button asChild className="w-full mt-4">
                                <Link href={`/dashboard/reports/${report.id}`}>
                                    <Download className="mr-2" /> View Full Report
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )
            })}
         </div>
      ) : (
         <Card className="flex flex-col items-center justify-center gap-6 p-10 text-center border-dashed">
              <div className="flex flex-col items-center gap-2">
                <FileText className="size-12 text-muted-foreground" />
                <h3 className="text-xl font-semibold font-headline">No Reports for {format(currentMonth, 'MMMM yyyy')}</h3>
                <p className="text-muted-foreground max-w-sm">
                  There are no finalized reports for the selected month.
                </p>
              </div>
        </Card>
      )}

    </div>
  );
}
