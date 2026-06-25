
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, doc, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Library, FileText, Target, Wallet, ListTodo, PlusCircle, Pencil, User, Briefcase, BarChart, MoreHorizontal, Users as UsersIcon, Download, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount, ParentClient, MonthlyReport } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { TodosCard } from '@/components/portal/TodosCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading portal data...</span>
    </div>
  );
}

export default function ClientPortalPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [refreshTodos, setRefreshTodos] = useState(0);


  const clientDocRef = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'parentClients', clientId as string);
  }, [firestore, clientId]);
  const { data: parentClient, loading: parentLoading } = useDoc(clientDocRef);

  const childAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return query(collection(firestore, 'parentClients', clientId as string, 'childAccounts'));
  }, [firestore, clientId]);
  const { data: childAccounts, loading: childrenLoading } = useCollection(childAccountsQuery);
  
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !clientId) return null;
    return query(
      collection(firestore, 'reports'),
      where('parentClientId', '==', clientId),
      where('status', 'in', ['sent', 'confirmed'])
    );
  }, [firestore, user, clientId]);
  const { data: reports, loading: reportsLoading } = useCollection(reportsQuery);


  const activeAccounts = useMemo(() => {
    if (!childAccounts) return [];
    return (childAccounts as ChildAccount[]).filter(account => !account.isPaused);
  }, [childAccounts]);


  const totals = useMemo(() => {
    if (!activeAccounts) return { budget: 0, count: 0, fee: 0, todos: 0 };
     return {
      count: activeAccounts.length,
      budget: activeAccounts.reduce((acc, account) => acc + (account.monthlyClickBudget || 0), 0),
      fee: activeAccounts.reduce((acc, account) => acc + (account.managementFee?.amount || 0), 0),
      todos: activeAccounts.reduce((acc, account) => acc + (account.pendingTodoIds?.length || 0), 0),
    };
  }, [activeAccounts]);

  const sortedReports = useMemo(() => {
    if (!reports) return [];
    
    const reportsWithDate = (reports as MonthlyReport[]).map(report => {
        let generatedAt = report.generatedAt;
        if (generatedAt && typeof generatedAt === 'object' && 'seconds' in generatedAt) {
            generatedAt = (generatedAt as unknown as Timestamp).toDate().toISOString();
        }
        return { ...report, generatedAt };
    });

    return reportsWithDate.sort((a, b) => b.period.localeCompare(a.period));
  }, [reports]);

  if (parentLoading || childrenLoading || reportsLoading) {
    return <LoadingState />;
  }

  if (!parentClient) {
    return <div>Client data not found.</div>;
  }

  const client = parentClient as ParentClient;
  const accounts = activeAccounts || [];
  const finalizedReports = sortedReports;


  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Welcome back, {client.clientContactPerson}</h1>
        <p className="text-muted-foreground">
          Here's what's happening with your accounts today.
        </p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Managed Accounts</CardTitle>
                    <User className="size-4 text-blue-400" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{totals.count}</div>
                    <p className="text-xs text-muted-foreground">Active Accounts</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Click Budget</CardTitle>
                    <Wallet className="size-4 text-green-400" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">€{totals.budget.toLocaleString()}</div>
                     <p className="text-xs text-muted-foreground">Monthly cap</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Action Items</CardTitle>
                    <ListTodo className="size-4 text-yellow-400" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{totals.todos}</div>
                    <p className="text-xs text-muted-foreground">Pending tasks</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Management Fee</CardTitle>
                    <Briefcase className="size-4 text-purple-400" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-2xl font-bold">€{totals.fee.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Per month</p>
                </CardContent>
            </Card>
        </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-3"><FileText className="text-purple-400" /> Recent Reports</h2>
                     <Button variant="ghost" asChild>
                        <Link href={`/portal/${clientId}/reports`}>
                            View All Reports <ChevronRight className="ml-2" />
                        </Link>
                    </Button>
                </div>
                <Card className="overflow-hidden">
                {finalizedReports.length > 0 ? (
                    <div>
                        <div className="grid grid-cols-4 items-center p-4 bg-secondary">
                            <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Period</p>
                            <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Account</p>
                            <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Generated</p>
                            <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider text-right">Action</p>
                        </div>
                        <div className="divide-y divide-border">
                        {finalizedReports.slice(0, 3).map(report => {
                            const account = accounts.find(a => a.id === report.childAccountId);
                            return (
                                <div key={report.id} className="grid grid-cols-4 items-center p-4">
                                        <p className="font-medium">{format(parseISO(report.period + '-02'), 'MMMM yyyy')}</p>
                                        <p className="text-muted-foreground">{account?.nickname || 'Unknown Account'}</p>
                                        <p className="text-sm text-muted-foreground">{report.generatedAt ? format(parseISO(report.generatedAt as string), 'MMM dd, yyyy') : 'N/A'}</p>
                                    <div className="text-right">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/dashboard/reports/${report.id}`} className="flex items-center gap-2">
                                                <Download className="size-4" />
                                                View
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No finalized reports are available yet.</p>
                    </div>
                )}
                </Card>
           </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-8">
             {client && accounts && user && (
                 <TodosCard 
                    parentClient={client}
                    childAccounts={accounts} 
                    user={user} 
                    onTodoAdded={() => setRefreshTodos(c => c + 1)}
                    key={refreshTodos} // Force re-render when a todo is added
                />
             )}
              <Card className="bg-secondary relative overflow-hidden">
                 <CardContent className="pt-6 relative z-10">
                     <h3 className="font-bold text-lg text-secondary-foreground">Need Strategy Help?</h3>
                     <p className="text-sm text-muted-foreground mb-4">Schedule a call with your account manager to review Q4 goals.</p>
                     <Button variant="default" className="w-full">
                         Book a Call
                     </Button>
                 </CardContent>
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute -right-4 -bottom-4 size-28 text-foreground/5 opacity-50 z-0">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
             </Card>
        </div>
      </div>
    </div>
  );
}
