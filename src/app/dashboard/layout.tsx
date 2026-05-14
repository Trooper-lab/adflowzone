
'use client';

import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  LogOut,
  Settings,
  Library,
  FileText,
  WandSparkles,
  CalendarCheck,
  Clock,
  Database,
  Rocket,
  ShieldCheck,
  MessageSquareText,
  Loader2,
} from 'lucide-react';
import {LogoIcon} from '@/components/icons';
import {Button} from '@/components/ui/button';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {useUser, useAuth, useDoc, useFirestore} from '@/firebase';
import {useEffect, useMemo} from 'react';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import type { AppUser } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';


export default function DashboardLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const {user, loading} = useUser();
  const firestore = useFirestore();
  const auth = useAuth();

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser, loading: appUserLoading } = useDoc(userDocRef);
  
  const userRole = (appUser as AppUser)?.role;
  const isAdmin = useMemo(() => {
    return userRole === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
  }, [userRole, user?.email]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  const navigationGroups = [
    {
      title: "Overzicht",
      items: [
        {href: '/dashboard', label: 'Mijn FlowZone', icon: LayoutDashboard},
        {href: '/dashboard/time', label: 'Tijd & Efficiëntie', icon: Clock},
        {href: '/dashboard/check-in', label: 'Klant Check-in', icon: CalendarCheck},
      ]
    },
    {
      title: "Portfolio",
      items: [
        {href: '/dashboard/accounts', label: 'Portfolio Dashboard', icon: Library},
        {href: '/dashboard/projects', label: 'Project Management', icon: Rocket},
      ]
    },
    {
      title: "Operations",
      items: [
        {href: '/dashboard/checklists', label: 'Checklist Builder', icon: CheckSquare},
        {href: '/dashboard/reports', label: 'Rapportage Zone', icon: FileText},
        {href: '/dashboard/import', label: 'Data Import', icon: Database},
      ]
    },
    {
      title: "Extra",
      items: [
        {href: '/dashboard/generator', label: 'AI Ad Generator', icon: WandSparkles},
      ]
    },
    ...(isAdmin ? [{
      title: "Administratie",
      items: [
        {href: '/dashboard/employees', label: 'Gebruikers & Toegang', icon: ShieldCheck},
        {href: '/dashboard/feedback', label: 'Platform Feedback', icon: MessageSquareText},
      ]
    }] : [])
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Perform role-based access control once auth and Firestore data are ready
    if (!loading && !appUserLoading && user) {
        const role = (appUser as AppUser)?.role?.toLowerCase();
        
        // If the user is explicitly pending or has no profile yet, send to waiting
        // We avoid strict "isStaff" checking here to prevent redirect loops for valid users
        // during temporary state flickers.
        // Special case: billy@pearsonline.nl and billy@trooper.es are always admins and should never be sent to waiting
        if (user.email === 'billy@pearsonline.nl' || user.email === 'billy@trooper.es') {
            return;
        }

        if (role === 'pending' || (!appUser && !isAdmin)) {
            router.push('/onboarding/waiting');
        }
    }
  }, [appUser, appUserLoading, loading, user, router, isAdmin]);

  const isReportPage = pathname.startsWith('/dashboard/reports/');

  if (loading || appUserLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-blue-500 size-10" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">AdFlow Zone Laden...</p>
        </div>
      </div>
    );
  }
  
  if (isReportPage) {
    return <>{children}</>;
  }


  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center py-2">
            <LogoIcon className="size-7 text-primary" />
            <span className="text-xl font-semibold font-headline group-data-[collapsible=icon]:hidden">
              AdFlow Zone
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className="transition-all duration-200"
                      >
                        <Link href={item.href}>
                          <item.icon className={pathname === item.href ? "text-primary" : "text-muted-foreground"} />
                          <span className={pathname === item.href ? "font-bold text-foreground" : "text-muted-foreground"}>
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/50">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Uitloggen" className="text-muted-foreground hover:text-destructive">
                  <LogOut />
                  <span>Uitloggen</span>
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
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">{user.email}</span>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{(appUser as AppUser)?.role || 'pending'}</span>
            </div>
            <Avatar className="h-8 w-8 border-2 border-primary/20">
              <AvatarImage src={user.photoURL || ''} alt="User avatar" />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 bg-slate-950/20">{children}</main>
      </SidebarInset>
      <FeedbackWidget />
    </SidebarProvider>
  );
}
