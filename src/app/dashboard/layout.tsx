
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
  Loader2,
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
import type { AppUser } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/ui/loading-screen';

// ─────────────────────────────────────────────────────────
// Section Color Themes — each route section gets its own
// ambient gradient palette for the background orbs.
// ─────────────────────────────────────────────────────────
const SECTION_THEMES = {
  werkruimte: { blob1: '#adc6ff', blob2: '#4edea3', label: 'WERKRUIMTE' },
  portfolio:  { blob1: '#22d3ee', blob2: '#06b6d4', label: 'PORTFOLIO' },
  checkin:    { blob1: '#34d399', blob2: '#10b981', label: 'CHECK-IN' },
  operations: { blob1: '#fbbf24', blob2: '#f97316', label: 'OPERATIONS' },
  ai:         { blob1: '#c084fc', blob2: '#818cf8', label: 'AI TOOLS' },
  finance:    { blob1: '#34d399', blob2: '#6ee7b7', label: 'FINANCIEEL' },
  admin:      { blob1: '#fb923c', blob2: '#fbbf24', label: 'BEHEER' },
  reports:    { blob1: '#fb923c', blob2: '#fdba74', label: 'RAPPORTEN' },
  import:     { blob1: '#818cf8', blob2: '#6366f1', label: 'IMPORT' },
  profile:    { blob1: '#adc6ff', blob2: '#93c5fd', label: 'PROFIEL' },
} as const;

type ThemeKey = keyof typeof SECTION_THEMES;

function getSectionTheme(pathname: string): (typeof SECTION_THEMES)[ThemeKey] {
  if (pathname === '/dashboard') return SECTION_THEMES.werkruimte;
  if (pathname.startsWith('/dashboard/accounts') || pathname.startsWith('/dashboard/projects'))
    return SECTION_THEMES.portfolio;
  if (pathname.startsWith('/dashboard/check-in'))
    return SECTION_THEMES.checkin;
  if (pathname.startsWith('/dashboard/checklists') || pathname.startsWith('/dashboard/campaign-briefings'))
    return SECTION_THEMES.operations;
  if (pathname.startsWith('/dashboard/generator') || pathname.startsWith('/dashboard/ai'))
    return SECTION_THEMES.ai;
  if (pathname.startsWith('/dashboard/time-tracking') || pathname.startsWith('/dashboard/invoices'))
    return SECTION_THEMES.finance;
  if (pathname.startsWith('/dashboard/services') || pathname.startsWith('/dashboard/employees') || pathname.startsWith('/dashboard/feedback'))
    return SECTION_THEMES.admin;
  if (pathname.startsWith('/dashboard/reports'))
    return SECTION_THEMES.reports;
  if (pathname.startsWith('/dashboard/import'))
    return SECTION_THEMES.import;
  if (pathname.startsWith('/dashboard/profile'))
    return SECTION_THEMES.profile;
  return SECTION_THEMES.werkruimte;
}

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

  // Helper: determine if a nav item is active, supporting sub-route matching
  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const navigationGroups = [
    {
      title: "Werkruimte",
      isAdmin: false,
      items: [
        {href: '/dashboard', label: 'Mijn FlowZone', icon: LayoutDashboard, exact: true},
        {href: '/dashboard/projects', label: 'Taken', icon: Rocket},
      ]
    },
    {
      title: "Klanten & Portfolio",
      isAdmin: false,
      items: [
        {href: '/dashboard/accounts', label: 'Portfolio Dashboard', icon: Library},
        {href: '/dashboard/check-in', label: 'Klant Check-in', icon: CalendarCheck},
      ]
    },
    {
      title: "Operations",
      isAdmin: false,
      items: [
        {href: '/dashboard/checklists', label: 'Checklist Builder', icon: CheckSquare},
        {href: '/dashboard/reports', label: 'Rapportage Zone', icon: FileText},
        ...(isAdmin ? [{href: '/dashboard/import', label: 'Data Import', icon: Database, exact: false}] : []),
      ]
    },
    {
      title: "AI Tools",
      isAdmin: false,
      items: [
        {href: '/dashboard/campaign-briefings', label: 'Campaign Briefings', icon: Briefcase},
        {href: '/dashboard/generator', label: 'AI Ad Generator', icon: WandSparkles},
      ]
    },
    {
      title: "Financieel",
      isAdmin: false,
      items: [
        {href: '/dashboard/time-tracking', label: 'Urenregistratie', icon: Timer},
        {href: '/dashboard/invoices', label: 'Facturatie', icon: Receipt},
      ]
    },
    ...(isAdmin ? [{
      title: "Beheer",
      isAdmin: true,
      items: [
        {href: '/dashboard/services', label: 'Diensten Beheer', icon: Package, exact: false},
        {href: '/dashboard/employees', label: 'Gebruikers & Toegang', icon: ShieldCheck, exact: false},
        {href: '/dashboard/feedback', label: 'Platform Feedback', icon: MessageSquareText, exact: false},
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
        
        // Special case: billy@pearsonline.nl and billy@trooper.es are always admins and should never be sent to waiting
        if (user.email === 'billy@pearsonline.nl' || 
            user.email === 'billy@trooper.es' ||
            user.email?.toLowerCase() === 'admin@onlyforward.nl') {
            return;
        }

        if (role === 'pending' || (!appUser && !isAdmin)) {
            router.push('/onboarding/waiting');
        }
    }
  }, [appUser, appUserLoading, loading, user, router, isAdmin]);

  const isReportPage = pathname.startsWith('/dashboard/reports/');
  const sectionTheme = getSectionTheme(pathname);

  if (loading || appUserLoading || !user) {
    return <LoadingScreen label="Initialiseren..." />;
  }
  
  if (isReportPage) {
    return <>{children}</>;
  }

  const userInitial = user.email?.[0].toUpperCase() ?? '?';
  const displayName = (appUser as AppUser)?.displayName || user.email || '';
  const userRoleLabel = (appUser as AppUser)?.role || 'pending';

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          AMBIENT GRADIENT BACKDROP
          Fixed behind everything — transitions per section
          ═══════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top-right primary orb */}
        <div
          style={{
            position: 'absolute',
            top: '-15vh',
            right: '-10vw',
            width: '70vw',
            height: '70vh',
            borderRadius: '50%',
            background: sectionTheme.blob1,
            opacity: 0.18,
            filter: 'blur(100px)',
            transition: 'background 1.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {/* Bottom-left secondary orb */}
        <div
          style={{
            position: 'absolute',
            bottom: '-15vh',
            left: '-8vw',
            width: '60vw',
            height: '60vh',
            borderRadius: '50%',
            background: sectionTheme.blob2,
            opacity: 0.14,
            filter: 'blur(90px)',
            transition: 'background 1.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {/* Center mid-screen haze */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '30%',
            width: '50vw',
            height: '50vh',
            borderRadius: '50%',
            background: sectionTheme.blob1,
            opacity: 0.06,
            filter: 'blur(130px)',
            transition: 'background 1.5s cubic-bezier(0.4,0,0.2,1)',
          }}
        />

        {/* ═══════════════════════════════════════════════════
            DYNAMIC VECTOR FLOW LINES
            Undulating animated bezier curves crossing the screen
            ═══════════════════════════════════════════════════ */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08] select-none pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="flow-line-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={sectionTheme.blob1} stopOpacity="0.2" />
              <stop offset="50%" stopColor={sectionTheme.blob2} stopOpacity="1" />
              <stop offset="100%" stopColor={sectionTheme.blob1} stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="flow-line-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={sectionTheme.blob2} stopOpacity="0.1" />
              <stop offset="50%" stopColor={sectionTheme.blob1} stopOpacity="0.8" />
              <stop offset="100%" stopColor={sectionTheme.blob2} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Line 1 (Upper - ~20% height) */}
          <path
            d="M -100 180 C 300 80, 600 280, 1000 130 C 1200 80, 1400 220, 1600 180"
            fill="none"
            stroke="url(#flow-line-grad-1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="180 380"
            style={{
              animation: 'flow-line-pulse 25s linear infinite'
            }}
            opacity="0.4"
          >
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="
                M -100 180 C 300 80, 600 280, 1000 130 C 1200 80, 1400 220, 1600 180;
                M -100 220 C 400 220, 700 80, 950 180 C 1150 220, 1350 100, 1600 220;
                M -100 150 C 250 100, 800 220, 1100 140 C 1300 80, 1450 190, 1600 150;
                M -100 180 C 300 80, 600 280, 1000 130 C 1200 80, 1400 220, 1600 180
              "
            />
          </path>
          {/* Line 2 (Upper-mid - ~38% height) */}
          <path
            d="M -100 360 C 250 420, 550 280, 850 380 C 1100 450, 1350 300, 1600 360"
            fill="none"
            stroke="url(#flow-line-grad-2)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="240 440"
            style={{
              animation: 'flow-line-pulse-reverse 30s linear infinite'
            }}
            opacity="0.55"
          >
            <animate
              attributeName="d"
              dur="24s"
              repeatCount="indefinite"
              values="
                M -100 360 C 250 420, 550 280, 850 380 C 1100 450, 1350 300, 1600 360;
                M -100 390 C 350 300, 650 400, 950 320 C 1200 280, 1400 400, 1600 390;
                M -100 330 C 300 380, 600 300, 900 410 C 1150 440, 1300 340, 1600 330;
                M -100 360 C 250 420, 550 280, 850 380 C 1100 450, 1350 300, 1600 360
              "
            />
          </path>
          {/* Line 3 (Center - ~55% height) */}
          <path
            d="M -100 540 C 300 480, 600 620, 900 500 C 1150 420, 1350 580, 1600 540"
            fill="none"
            stroke="url(#flow-line-grad-1)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{
              animation: 'flow-line-pulse 35s linear infinite'
            }}
            opacity="0.3"
          >
            <animate
              attributeName="d"
              dur="28s"
              repeatCount="indefinite"
              values="
                M -100 540 C 300 480, 600 620, 900 500 C 1150 420, 1350 580, 1600 540;
                M -100 510 C 350 580, 700 480, 1000 560 C 1200 600, 1400 500, 1600 510;
                M -100 570 C 250 540, 650 580, 950 520 C 1100 480, 1300 640, 1600 570;
                M -100 540 C 300 480, 600 620, 900 500 C 1150 420, 1350 580, 1600 540
              "
            />
          </path>
          {/* Line 4 (Lower-mid - ~72% height) */}
          <path
            d="M -100 720 C 250 680, 600 820, 950 720 C 1150 650, 1350 800, 1600 720"
            fill="none"
            stroke="url(#flow-line-grad-2)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="160 360"
            style={{
              animation: 'flow-line-pulse-reverse 27s linear infinite'
            }}
            opacity="0.5"
          >
            <animate
              attributeName="d"
              dur="22s"
              repeatCount="indefinite"
              values="
                M -100 720 C 250 680, 600 820, 950 720 C 1150 650, 1350 800, 1600 720;
                M -100 690 C 350 780, 650 700, 1000 760 C 1200 800, 1400 720, 1600 690;
                M -100 750 C 300 740, 700 800, 900 720 C 1100 680, 1300 840, 1600 750;
                M -100 720 C 250 680, 600 820, 950 720 C 1150 650, 1350 800, 1600 720
              "
            />
          </path>
          {/* Line 5 (Lower - ~88% height) */}
          <path
            d="M -100 880 C 300 850, 600 950, 900 880 C 1150 820, 1350 930, 1600 880"
            fill="none"
            stroke="url(#flow-line-grad-1)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              animation: 'flow-line-pulse 32s linear infinite'
            }}
            opacity="0.4"
          >
            <animate
              attributeName="d"
              dur="26s"
              repeatCount="indefinite"
              values="
                M -100 880 C 300 850, 600 950, 900 880 C 1150 820, 1350 930, 1600 880;
                M -100 850 C 350 920, 650 860, 950 910 C 1200 940, 1400 870, 1600 850;
                M -100 910 C 250 890, 700 930, 1000 870 C 1150 840, 1300 960, 1600 910;
                M -100 880 C 300 850, 600 950, 900 880 C 1150 820, 1350 930, 1600 880
              "
            />
          </path>
        </svg>

        {/* Premium Background Grain Overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="gggrain-filter" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="1" seed="2" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence"></feTurbulence>
              <feColorMatrix type="saturate" values="0" x="0%" y="0%" width="100%" height="100%" in="turbulence" result="colormatrix"></feColorMatrix>
              <feComponentTransfer x="0%" y="0%" width="100%" height="100%" in="colormatrix" result="componentTransfer">
                <feFuncR type="linear" slope="1.2"></feFuncR>
                <feFuncG type="linear" slope="1.2"></feFuncG>
                <feFuncB type="linear" slope="1.2"></feFuncB>
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="transparent" filter="url(#gggrain-filter)" opacity="0.05" style={{ mixBlendMode: 'soft-light' }}></rect>
        </svg>
      </div>

      <SidebarProvider style={{ position: 'relative', zIndex: 1 }}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-white/5">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center py-3 px-1">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full blur-md opacity-40" style={{ backgroundColor: '#adc6ff' }} />
              <LogoIcon className="size-6 relative z-10" style={{ color: '#adc6ff' }} />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-bold tracking-tight" style={{ color: '#dae2fd' }}>AdFlow Zone</span>
              <p className="font-label-caps" style={{ fontSize: '9px', color: '#8c909f', letterSpacing: '0.1em' }}>ADMIN CONSOLE</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="py-2">
          {navigationGroups.map((group, groupIndex) => (
            <SidebarGroup
              key={group.title}
              className={cn(
                group.isAdmin && "mt-1 pt-2 border-t border-white/5"
              )}
            >
              <SidebarGroupLabel
                className={cn(
                  "font-label-caps flex items-center gap-1.5 px-3 mb-1",
                  group.isAdmin
                    ? "text-amber-400/80"
                    : "text-muted-foreground/40"
                )}
              >
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
                          className={cn(
                            "transition-all duration-200 rounded-sm h-9",
                          )}
                        >
                          <Link href={item.href}>
                            <item.icon
                              className={cn(
                                "transition-colors",
                                active ? "text-secondary" : "text-muted-foreground/60"
                              )}
                            />
                            <span
                              className={cn(
                                "transition-colors text-[13px]",
                                active ? "font-semibold text-secondary" : "text-muted-foreground/80"
                              )}
                            >
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
        {/* ── Top Header bar ── */}
        <header
          className="relative flex h-14 shrink-0 items-center justify-between px-4 sm:px-6"
          style={{
            backgroundColor: 'rgba(23, 31, 51, 0.5)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 10,
          }}
        >
          {/* Section color accent strip at top of header */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, ${sectionTheme.blob1}00 0%, ${sectionTheme.blob1}cc 30%, ${sectionTheme.blob2}cc 70%, ${sectionTheme.blob2}00 100%)`,
              transition: 'background 1.2s ease',
            }}
          />
          <div className='flex items-center gap-4'>
            <SidebarTrigger />
            <GlobalSearch />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5 outline-none ring-0 group">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold leading-tight max-w-[160px] truncate" style={{ color: '#dae2fd' }}>
                    {displayName}
                  </span>
                  <span className="font-label-caps mt-0.5" style={{ fontSize: '9px', color: '#4edea3', letterSpacing: '0.1em' }}>
                    {userRoleLabel}
                  </span>
                </div>
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={user.photoURL || ''} alt="User avatar" />
                  <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: 'rgba(173,198,255,0.1)', color: '#adc6ff' }}>
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-2xl" style={{ backgroundColor: 'hsl(222, 29%, 19%)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <DropdownMenuLabel className="font-normal pb-2">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold truncate" style={{ color: '#dae2fd' }}>{displayName}</p>
                  <p className="text-[11px] truncate" style={{ color: '#8c909f' }}>{user.email}</p>
                  <span className="font-label-caps mt-1" style={{ fontSize: '9px', color: '#4edea3' }}>
                    {userRoleLabel}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <DropdownMenuItem asChild className="cursor-pointer gap-2 focus:bg-white/5">
                <Link href="/dashboard/profile" style={{ color: '#c2c6d6' }}>
                  <Settings className="size-3.5" />
                  Profiel Instellingen
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2"
                style={{ color: '#ffb3ad' }}
              >
                <LogOut className="size-3.5" />
                Uitloggen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main
          className="relative flex-1 p-4 sm:p-6"
          style={{ backgroundColor: 'transparent', zIndex: 1, minHeight: 0 }}
        >
          {children}
        </main>
      </SidebarInset>
      <FeedbackWidget />
    </SidebarProvider>
    </>
  );
}
