
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlusCircle, Pencil, Globe, Mail, User, Wallet, Briefcase } from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount, ParentClient } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading client data...</span>
    </div>
  );
}

export default function ClientDetailPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();

  const parentClientRef = useMemo(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'parentClients', clientId as string);
  }, [firestore, clientId]);

  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef);

  const { user } = useUser();
  const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);

  const isAdmin = useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
  }, [appUser, user?.email]);

  const childAccountsQuery = useMemo(() => {
    if (!firestore || !clientId) return null;
    return query(collection(firestore, 'parentClients', clientId as string, 'childAccounts'));
  }, [firestore, clientId]);

  const { data: childAccounts, loading: childrenLoading } = useCollection(childAccountsQuery);

  const totals = useMemo(() => {
    if (!childAccounts) return { budget: 0, fee: 0 };
    return childAccounts.reduce((acc, account) => {
      acc.budget += account.monthlyClickBudget || 0;
      acc.fee += account.managementFee?.amount || 0;
      return acc;
    }, { budget: 0, fee: 0 });
  }, [childAccounts]);

  if (parentLoading || childrenLoading) {
    return <LoadingState />;
  }

  if (!parentClient) {
    return <div>Client not found.</div>;
  }

  const client = parentClient as ParentClient;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{client.clientName}</h1>
        <p className="text-muted-foreground">
          <span className="capitalize">{client.clientType}</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
             <div className={cn("grid grid-cols-1 gap-6", isAdmin ? "md:grid-cols-2" : "md:grid-cols-1")}>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Monthly Click Budget</CardTitle>
                        <Wallet className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">€{totals.budget.toLocaleString()}</div>
                    </CardContent>
                </Card>
                {isAdmin && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Monthly Management Fee</CardTitle>
                            <Briefcase className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">€{totals.fee.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                )}
            </div>
            <Card>
                <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                    <CardTitle>Managed Google Ads Accounts</CardTitle>
                    <CardDescription>
                        All Google Ads accounts associated with {client.clientName}.
                    </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href={`/dashboard/clients/${clientId}/add`}>
                            <PlusCircle />
                            Add Account
                        </Link>
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                {childAccounts && childAccounts.length > 0 ? (
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nickname</TableHead>
                            <TableHead>Google Ads ID</TableHead>
                            {isAdmin && <TableHead>Mng. Fee</TableHead>}
                            <TableHead>Click Budget</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {childAccounts.map((account: any) => (
                        <TableRow key={account.id}>
                            <TableCell className="font-medium">
                                <Link href={`/dashboard/accounts/${account.id}?parent=${clientId}`} className="hover:underline text-primary">
                                    {account.nickname}
                                </Link>
                            </TableCell>
                            <TableCell>{account.googleAdsClientId}</TableCell>
                            {isAdmin && <TableCell>€{account.managementFee?.amount?.toLocaleString() || '0'}</TableCell>}
                            <TableCell>€{account.monthlyClickBudget?.toLocaleString() || '0'}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-10 border-dashed border rounded-md">
                    <p className="text-muted-foreground">No Google Ads accounts have been added for this client yet.</p>
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1">
             <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Client Details</CardTitle>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/clients/${client.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <User className="size-5 text-muted-foreground" />
                        <div className="text-sm">
                            <p className="font-medium">{client.clientContactPerson}</p>
                            <p className="text-muted-foreground">Main Contact</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3">
                        <Mail className="size-5 text-muted-foreground" />
                        <div className="text-sm min-w-0">
                            <a href={`mailto:${client.clientContactEmail}`} className="font-medium hover:underline break-all">{client.clientContactEmail}</a>
                            <p className="text-muted-foreground">Contact Email</p>
                        </div>
                    </div>
                     {client.clientWebsite && (
                        <div className="flex items-center gap-3">
                            <Globe className="size-5 text-muted-foreground" />
                            <div className="text-sm">
                                <a href={client.clientWebsite} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{client.clientWebsite}</a>
                                <p className="text-muted-foreground">Website</p>
                            </div>
                        </div>
                    )}
                    {client.internalNotes && (
                        <div>
                             <Separator className="my-4" />
                            <p className="text-sm font-medium mb-1">Internal Notes</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.internalNotes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
