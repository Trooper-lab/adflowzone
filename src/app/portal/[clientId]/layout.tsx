
'use client';

import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { LogoIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser, useAuth } from '@/firebase';
import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ParentClient } from '@/lib/types';
import { Loader2, LogOut, LayoutDashboard, FileText, Settings, ChevronDown, ListChecks, Library } from 'lucide-react';
import { useMemo } from 'react';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { GlobalSearch } from '@/components/search/GlobalSearch';


export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { clientId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const clientDocRef = useMemo(() => (firestore && clientId && user ? doc(firestore, 'parentClients', clientId as string) : null), [firestore, clientId, user]);
  const { data: client, loading: clientLoading } = useDoc(clientDocRef);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);
  
  const menuItems = [
    {href: `/portal/${clientId}`, label: 'Dashboard', icon: LayoutDashboard},
    {href: `/portal/${clientId}/accounts`, label: 'Accounts', icon: Library},
    {href: `/portal/${clientId}/reports`, label: 'Reports', icon: FileText},
    {href: `/portal/${clientId}/checklists`, label: 'Checklists', icon: ListChecks},
  ];

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  if (userLoading || clientLoading || !user || !client) {
    return <LoadingScreen label="Client Portal laden..." />;
  }
  
  if (client && user.email !== (client as ParentClient).clientUserEmail) {
      handleLogout();
      return <LoadingScreen label="Toegang controleren..." />;
  }

  const parentClient = client as ParentClient;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <LogoIcon className="size-7 text-primary" />
            <span className="text-xl font-semibold font-headline group-data-[collapsible=icon]:hidden">
              {parentClient.clientName}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
           <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Log Out">
                  <LogOut />
                  <span>Log Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
       <SidebarInset>
         <header className="flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <div className='flex items-center gap-4'>
                <SidebarTrigger className="md:hidden" />
                <GlobalSearch />
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                         <Avatar className="h-9 w-9">
                            <AvatarImage src={user.photoURL || ''} alt="User avatar" />
                            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{parentClient.clientContactPerson}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>{user.email}</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
        <main className="flex-1 p-4 sm:p-6">
            {children}
        </main>
    </SidebarInset>
    </SidebarProvider>
  );
}
