
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PlusCircle, Pencil, Library, Wallet, Briefcase, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <span className="ml-2">Loading accounts...</span>
    </div>
  );
}

export default function ClientAccountsPage() {
  const { clientId } = useParams();
  const firestore = useFirestore();

  const childAccountsQuery = useMemoFirebase(() => {
    if (!firestore || !clientId) return null;
    return query(collection(firestore, 'parentClients', clientId as string, 'childAccounts'));
  }, [firestore, clientId]);

  const { data: childAccountsData, loading: childrenLoading } = useCollection(childAccountsQuery);
  
  const activeAccounts = useMemo(() => {
      if (!childAccountsData) return [];
      return (childAccountsData as ChildAccount[]).filter(account => !account.isPaused);
  }, [childAccountsData]);


  if (childrenLoading) {
    return <LoadingState />;
  }
  
  const accounts = activeAccounts || [];

  return (
    <div className="flex flex-col gap-8">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">Your Accounts</h1>
                <p className="text-muted-foreground">A summary of all your managed Google Ads accounts.</p>
            </div>
            <Button asChild>
                <Link href={`/portal/${clientId}/add`}>
                    <PlusCircle className="mr-2"/>
                    Add New Account
                </Link>
            </Button>
        </div>
        
        {accounts.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-4">
                {accounts.map((account) => (
                    <AccordionItem value={account.id} key={account.id} className="border-none">
                         <Card className="overflow-hidden">
                            <AccordionTrigger className="p-6 text-left hover:no-underline hover:bg-muted/50 [&[data-state=open]>div>div>svg.arrow]:rotate-180">
                                <div className="flex items-center justify-between w-full">
                                    <h3 className="font-semibold text-lg font-headline">{account.nickname}</h3>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-green-400">
                                            <Wallet />
                                            <span className="font-bold text-lg">€{account.monthlyClickBudget?.toLocaleString() || '0'}</span>
                                        </div>
                                         <div className="flex items-center gap-2 text-blue-400">
                                            <Briefcase />
                                            <span className="font-bold text-lg">€{account.managementFee?.amount?.toLocaleString() || '0'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                                              <Link href={`/portal/${clientId}/edit/${account.id}`}>
                                                  <Pencil className="mr-2 h-4 w-4" />
                                                  Edit
                                              </Link>
                                            </Button>
                                             <Button variant="default" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                                              <Link href={`/portal/${clientId}/accounts/${account.id}`}>
                                                  View Details
                                              </Link>
                                            </Button>
                                        </div>
                                        <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 text-muted-foreground arrow" />
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="p-6 pt-0 flex justify-between items-center bg-muted/20">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Official Name: {account.googleAdsAccountName}</p>
                                        <p className="text-sm text-muted-foreground">Google Ads ID: {account.googleAdsClientId}</p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <Card className="text-center py-20 border-dashed">
              <CardHeader>
                <Library className="mx-auto size-12 text-muted-foreground mb-4"/>
                <CardTitle className="font-headline text-xl">No Accounts Found</CardTitle>
                <CardDescription>You haven't added any Google Ads accounts to your profile yet.</CardDescription>
              </CardHeader>
            </Card>
        )}
    </div>
  );
}
