
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
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  CheckSquare,
  LogOut,
  Settings,
  Library,
  FileText,
  WandSparkles,
  CalendarCheck,
  Database,
  Rocket,
  ShieldCheck,
  MessageSquareText,
  Briefcase,
  Receipt,
  Timer,
  Package,
  Shield,
  ChevronDown,
} from 'lucide-react';
import {LogoIcon} from '@/components/icons';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {useUser, useAuth, useDoc, useFirestore} from '@/firebase';
import {useEffect, useMemo} from 'react';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import { AmbientBackground } from '@/components/AmbientBackground';
import type { AppUser } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui/loading-screen';

export default function DashboardLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const {user, loading} = useUser();
  const firestore = useFirestore();
  const auth = useAuth();

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser, loading: appUserLoading } = useDoc(userDocRef);

  const userRole = (appUser as AppUser)?.role?.toLowerCase();
  const isAdmin = useMemo(() => {
    return userRole === 'admin' ||
           user?.email === 'billy@pearsonline.nl' ||
           user?.email === 'billy@trooper.es' ||
           user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [userRole, user?.email]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const navigationGroups = [
    {
      title: "Werkruimte",
      isAdmin: false,
      items: [
        {href: '/dashboard',          label: 'Mijn FlowZone',      icon: LayoutDashboard, exact: true},
        {href: '/dashboard/projects', label: 'Taken',              icon: Rocket},
      ]
    },
    {
      title: "Klanten & Portfolio",
      isAdmin: false,
      items: [
        {href: '/dashboard/accounts',  label: 'Portfolio Dashboard', icon: Library},
        {href: '/dashboard/check-in',  label: 'Klant Check-in',      icon: CalendarCheck},
      ]
    },
    {
      title: "Operations",
      isAdmin: false,
      items: [
        {href: '/dashboard/checklists', label: 'Checklist Builder', icon: CheckSquare},
        {href: '/dashboard/reports',    label: 'Rapportage Zone',   icon: FileText},
        ...(isAdmin ? [{href: '/dashboard/import', label: 'Data Import', icon: Database}] : []),
      ]
    },
    {
      title: "AI Tools",
      isAdmin: false,
      items: [
        {href: '/dashboard/campaign-briefings', label: 'Campaign Briefings', icon: Briefcase},
        {href: '/dashboard/generator',          label: 'AI Ad Generator',    icon: WandSparkles},
      ]
    },
    {
      title: "Financieel",
      isAdmin: false,
      items: [
        {href: '/dashboard/time-tracking', label: 'Urenregistratie', icon: Timer},
        {href: '/dashboard/invoices',      label: 'Facturatie',      icon: Receipt},
      ]
    },
    ...(isAdmin ? [{
      title: "Beheer",
      isAdmin: true,
      items: [
        {href: '/dashboard/services',   label: 'Diensten Beheer',     icon: Package},
        {href: '/dashboard/employees',  label: 'Gebruikers & Toegang',icon: ShieldCheck},
        {href: '/dashboard/feedback',   label: 'Platform Feedback',   icon: MessageSquareText},
      ]
    }] : [])
  ];

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (pathname.startsWith('/dashboard/reports/')) return;
    if (!loading && !appUserLoading && user) {
      const role = (appUser as AppUser)?.role?.toLowerCase();
      if (
        user.email === 'billy@pearsonline.nl' ||
        user.email === 'billy@trooper.es' ||
        user.email?.toLowerCase() === 'admin@onlyforward.nl'
      ) return;
      if (role === 'pending' || (!appUser && !isAdmin)) {
        router.push('/onboarding/waiting');
      }
    }
  }, [appUser, appUserLoading, loading, user, router, isAdmin, pathname]);

  const isReportPage = pathname.startsWith('/dashboard/reports/');

  if (loading || appUserLoading || !user) {
    return <LoadingScreen label="Initialiseren..." />;
  }

  if (isReportPage) {
    return <>{children}</>;
  }

  const userInitial  = user.email?.[0].toUpperCase() ?? '?';
  const displayName  = (appUser as AppUser)?.displayName || user.email || '';
  const userRoleLabel = (appUser as AppUser)?.role || 'pending';

  return (
    <>
      <AmbientBackground />

      <SidebarProvider style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex flex-col gap-2.5 py-4 px-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
              <div className="relative h-10 w-10 transition-all duration-200">
                <img 
                  src="/go-logo.png" 
                  alt="GO Logo" 
                  className="h-full w-full object-contain" 
                />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-label-caps text-muted-foreground mt-0.5">Global Overview</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="py-2">
            {navigationGroups.map((group) => (
              <SidebarGroup
                key={group.title}
                className={cn(group.isAdmin && "mt-1 pt-2 border-t border-sidebar-border")}
              >
                <SidebarGroupLabel className={cn(
                  "font-label-caps flex items-center gap-1.5 px-3 mb-1",
                  group.isAdmin ? "text-chart-3/80" : "text-muted-foreground/40"
                )}>
                  {group.isAdmin && <Shield className="size-2.5 shrink-0" />}
                  {group.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const active = isActive(item.href, item.exact);
                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            className="transition-all duration-150 rounded-sm h-9"
                          >
                            <Link href={item.href}>
                              <item.icon className={cn(
                                "transition-colors",
                                active ? "text-primary" : "text-muted-foreground/60"
                              )} />
                              <span className={cn(
                                "transition-colors text-[13px]",
                                active ? "font-semibold text-primary" : "text-muted-foreground/80"
                              )}>
                                {item.label}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="bg-transparent">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <GlobalSearch />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent outline-none ring-0 group">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-semibold leading-tight max-w-[160px] truncate text-foreground">
                      {displayName}
                    </span>
                    <span className="font-label-caps mt-0.5 text-primary">
                      {userRoleLabel}
                    </span>
                  </div>
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={user.photoURL || ''} alt="User avatar" />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal pb-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-semibold truncate text-foreground">{displayName}</p>
                    <p className="text-[11px] truncate text-muted-foreground">{user.email}</p>
                    <span className="font-label-caps mt-1 text-primary">{userRoleLabel}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link href="/dashboard/profile">
                    <Settings className="size-3.5" />
                    Profiel Instellingen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <LogOut className="size-3.5" />
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="relative flex-1 p-4 sm:p-6" style={{ zIndex: 1 }}>
            {children}
          </main>
        </SidebarInset>

        <FeedbackWidget />
      </SidebarProvider>
    </>
  );
}
