'use client'

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import type { ParentClient, ChildAccount } from '@/lib/types';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Search, Library, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

type SearchResult = {
  id: string;
  type: 'client' | 'account';
  name: string;
  parentName?: string;
  url: string;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = React.useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return role === 'admin' || 
           user?.email === 'billy@pearsonline.nl' || 
           user?.email === 'billy@trooper.es' ||
           user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [appUser, user?.email]);
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  const isClientPortal = !!clientId;

  const clientDocRef = useMemoFirebase(() => (firestore && clientId ? doc(firestore, 'parentClients', clientId) : null), [firestore, clientId]);
  const { data: parentClient } = useDoc(clientDocRef);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open || !user || !firestore) return;

    const fetchAllData = async () => {
      if (isClientPortal) {
        if (!parentClient) return;
        // Client Portal: Fetch only accounts for the current client
        const childAccountsQuery = query(collection(firestore, 'parentClients', clientId, 'childAccounts'));
        const accountSnapshots = await getDocs(childAccountsQuery);
        
        const accountResults: SearchResult[] = accountSnapshots.docs.map(doc => {
            const account = doc.data() as ChildAccount;
            return {
              id: doc.id,
              type: 'account',
              name: account.nickname,
              parentName: (parentClient as ParentClient).clientName,
              url: `/portal/${clientId}/accounts/${doc.id}`
            };
        });
        setResults(accountResults);

      } else {
        // Manager Dashboard: Fetch all clients and accounts
        const managerUid = isAdmin ? user.uid : (appUser as any)?.managerId;
        if (!managerUid) return;
        const parentClientsQuery = isAdmin
          ? query(collection(firestore, 'parentClients'))
          : query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid));
        const clientsSnapshot = await getDocs(parentClientsQuery);
        const parentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentClient));

        const clientResults: SearchResult[] = parentClients.map(client => ({
          id: client.id,
          type: 'client',
          name: client.clientName,
          url: `/dashboard/clients/${client.id}`
        }));

        const childAccountPromises = parentClients.map(client =>
          isAdmin 
            ? getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'))
            : getDocs(query(collection(firestore, 'parentClients', client.id, 'childAccounts'), where('assignedEmployeeId', '==', user.uid)))
        );
        const childAccountSnapshots = await Promise.all(childAccountPromises);
        
        const accountResults: SearchResult[] = childAccountSnapshots.flatMap(snapshot =>
          snapshot.docs.map(doc => {
            const account = doc.data() as ChildAccount;
            const parent = parentClients.find(p => p.id === account.parentClientId);
            return {
              id: doc.id,
              type: 'account',
              name: account.nickname,
              parentName: parent?.clientName,
              url: `/dashboard/accounts/${doc.id}?parent=${account.parentClientId}`
            };
          })
        );
        setResults([...clientResults, ...accountResults]);
      }
    };
    fetchAllData();
  }, [open, user, firestore, isClientPortal, clientId, parentClient, isAdmin, appUser]);

  const runCommand = (command: () => unknown) => {
    setOpen(false)
    command()
  }
  
  const clientPortalGroups = (
       <CommandGroup heading="Accounts">
        {results.filter(r => r.type === 'account').map(result => (
            <CommandItem key={result.id} value={`${result.name} ${result.parentName}`} onSelect={() => runCommand(() => router.push(result.url))}>
            <Library className="mr-2 h-4 w-4" />
            <span>{result.name}</span>
            </CommandItem>
        ))}
        </CommandGroup>
  );

  const managerDashboardGroups = (
    <>
      <CommandGroup heading="Clients">
        {results.filter(r => r.type === 'client').map(result => (
          <CommandItem key={result.id} value={`${result.name} ${result.type}`} onSelect={() => runCommand(() => router.push(result.url))}>
            <Users className="mr-2 h-4 w-4" />
            <span>{result.name}</span>
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="Accounts">
        {results.filter(r => r.type === 'account').map(result => (
          <CommandItem key={result.id} value={`${result.name} ${result.parentName}`} onSelect={() => runCommand(() => router.push(result.url))}>
            <Library className="mr-2 h-4 w-4" />
            <span>{result.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{result.parentName}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-[0.5rem] text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search for clients or accounts..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {isClientPortal ? clientPortalGroups : managerDashboardGroups}
        </CommandList>
      </CommandDialog>
    </>
  );
}
