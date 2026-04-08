'use client';

import { useState, useEffect } from 'react';
import { query, collection, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { MonthlyReport } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText } from 'lucide-react';
import Link from 'next/link';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Timestamp } from 'firebase/firestore';

export default function AccountReports({ accountId }: { accountId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [reports, setReports] = useState<MonthlyReport[]>([]);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !accountId) return null;
    return query(
      collection(firestore, 'reports'),
      where('ownerId', '==', user.uid),
      where('childAccountId', '==', accountId)
    );
  }, [firestore, user, accountId]);
  
  const { data: fetchedReports, loading: reportsLoading } = useCollection(reportsQuery);

  useEffect(() => {
    if (fetchedReports) {
      const sortedReports = (fetchedReports as MonthlyReport[]).map(report => {
        const generatedAt = report.generatedAt;
        if (generatedAt && typeof generatedAt === 'object' && 'seconds' in generatedAt) {
            return { ...report, generatedAt: (generatedAt as unknown as Timestamp).toDate().toISOString() };
        }
        return report;
      }).sort((a, b) => b.period.localeCompare(a.period));
      setReports(sortedReports);
    }
  }, [fetchedReports]);
  

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="text-blue-400" /> Generated Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {reportsLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            <Loader2 className="mr-2 animate-spin" />
            Loading reports...
          </div>
        )}
        {!reportsLoading && reports.length === 0 && (
          <div className="text-center py-10">
             <FileText className="mx-auto size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground mt-4">
              No reports generated yet.
            </p>
            <Button variant="link" asChild>
              <Link href="/dashboard/reports">Generate First Report</Link>
            </Button>
          </div>
        )}
        {!reportsLoading && reports.length > 0 && (
          <div className="space-y-2">
            {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-800/50">
                    <div>
                        <p className="font-medium">
                            {format(parseISO(report.period + '-02'), 'MMMM yyyy')} Report
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Generated on {report.generatedAt ? format(parseISO(report.generatedAt), 'PPP') : 'N/A'}
                        </p>
                    </div>
                     <Button asChild variant="outline" size="sm">
                       <Link href={`/dashboard/reports/${report.id}`}>
                         View Report
                       </Link>
                     </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
