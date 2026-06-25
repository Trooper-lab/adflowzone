
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

  // Helper to convert hex to space-separated HSL values (format expected by Tailwind)
  const hexToHsl = (hex: string): string => {
    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanedHex.length !== 3 && cleanedHex.length !== 6) {
      return '221.2 83.2% 53.3%';
    }
    
    let r = 0, g = 0, b = 0;
    if (cleanedHex.length === 3) {
      r = parseInt(cleanedHex[0] + cleanedHex[0], 16);
      g = parseInt(cleanedHex[1] + cleanedHex[1], 16);
      b = parseInt(cleanedHex[2] + cleanedHex[2], 16);
    } else {
      r = parseInt(cleanedHex.slice(0, 2), 16);
      g = parseInt(cleanedHex.slice(2, 4), 16);
      b = parseInt(cleanedHex.slice(4, 6), 16);
    }
    
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const primaryHsl = useMemo(() => parentClient.brandColors?.primary ? hexToHsl(parentClient.brandColors.primary) : null, [parentClient.brandColors?.primary]);
  const secondaryHsl = useMemo(() => parentClient.brandColors?.secondary ? hexToHsl(parentClient.brandColors.secondary) : null, [parentClient.brandColors?.secondary]);
  
  const headingsFont = parentClient.brandFonts?.headings || 'Outfit';
  const bodyFont = parentClient.brandFonts?.body || 'Inter';

  const brandColorPrimary = parentClient.brandColors?.primary || '#adc6ff';
  const brandColorSecondary = parentClient.brandColors?.secondary || '#4edea3';

  return (
    <>
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${headingsFont.replace(' ', '+')}:wght@400;600;700&family=${bodyFont.replace(' ', '+')}:wght@400;500;600&display=swap`}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${primaryHsl ? `--primary: ${primaryHsl} !important; --sidebar-primary: ${primaryHsl} !important;` : ''}
          ${secondaryHsl ? `--secondary: ${secondaryHsl} !important; --accent: ${secondaryHsl} !important;` : ''}
        }
        .dark {
          ${primaryHsl ? `--primary: ${primaryHsl} !important; --sidebar-primary: ${primaryHsl} !important;` : ''}
          ${secondaryHsl ? `--secondary: ${secondaryHsl} !important; --accent: ${secondaryHsl} !important;` : ''}
        }
        body, .font-sans, .font-body {
          font-family: '${bodyFont}', sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .font-headline {
          font-family: '${headingsFont}', sans-serif !important;
        }
      `}} />

      {/* ── AMBIENT GRADIENT BACKDROP ── */}
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
            background: brandColorPrimary,
            opacity: 0.15,
            filter: 'blur(100px)',
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
            background: brandColorSecondary,
            opacity: 0.12,
            filter: 'blur(90px)',
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
            background: brandColorPrimary,
            opacity: 0.05,
            filter: 'blur(130px)',
          }}
        />

        {/* ── GLOBAL OVERVIEW COORDINATES & TELEMETRY GRID ── */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06] select-none pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="portal-go-grad-1" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={brandColorPrimary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={brandColorSecondary} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="portal-go-grad-2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={brandColorSecondary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={brandColorPrimary} stopOpacity="0.4" />
            </linearGradient>
            <pattern id="portal-go-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.5" />
              <circle cx="0" cy="0" r="1" fill="rgba(255, 255, 255, 0.25)" />
              <circle cx="80" cy="0" r="1" fill="rgba(255, 255, 255, 0.25)" />
              <circle cx="0" cy="80" r="1" fill="rgba(255, 255, 255, 0.25)" />
              <circle cx="80" cy="80" r="1" fill="rgba(255, 255, 255, 0.25)" />
            </pattern>
          </defs>

          {/* Grid pattern */}
          <rect width="100%" height="100%" fill="url(#portal-go-grid)" />

          {/* Polar coordinate rings - Top Right */}
          <g transform="translate(1200, 200)" stroke="url(#portal-go-grad-1)" fill="none">
            <circle r="150" strokeWidth="0.5" strokeDasharray="3 6" />
            <circle r="300" strokeWidth="0.75" />
            <circle r="450" strokeWidth="0.5" strokeDasharray="12 6" />
            <circle r="600" strokeWidth="1.25" strokeDasharray="40 20 10 20" />
            <circle r="750" strokeWidth="0.5" />
            
            <line x1="0" y1="0" x2="-800" y2="300" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="0" y1="0" x2="-600" y2="700" strokeWidth="0.5" strokeDasharray="4 4" />
          </g>

          {/* Polar coordinate rings - Bottom Left */}
          <g transform="translate(100, 800)" stroke="url(#portal-go-grad-2)" fill="none">
            <circle r="200" strokeWidth="0.5" strokeDasharray="6 6" />
            <circle r="400" strokeWidth="0.75" strokeDasharray="24 8" />
            <circle r="600" strokeWidth="1.25" />
            <circle r="800" strokeWidth="0.5" strokeDasharray="10 20" />

            <line x1="0" y1="0" x2="800" y2="-300" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="0" y1="0" x2="600" y2="-700" strokeWidth="0.5" strokeDasharray="4 4" />
          </g>

          {/* Slow rotating central telemetry dial */}
          <circle cx="720" cy="450" r="400" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="0.75" strokeDasharray="40 80" fill="none">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 720 450"
              to="360 720 450"
              dur="240s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Telemetry data labels */}
          <g fill="rgba(255, 255, 255, 0.25)" fontSize="8" fontFamily="monospace" letterSpacing="0.15em">
            <text x="24" y="36">PORTAL.LOC // 52.3676° N, 4.9041° E</text>
            <text x="24" y="48">CLIENT.SECURE.LINK // CONNECTED</text>
            
            <text x="1416" y="854" textAnchor="end">PORTAL.GRID.SEC // GO_CLIENT_PORTAL</text>
            <text x="1416" y="866" textAnchor="end">OVERVIEW.UPSTREAM.SYNC</text>
          </g>
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
          <rect width="100%" height="100%" fill="transparent" filter="url(#gggrain-filter)" opacity="0.04" style={{ mixBlendMode: 'soft-light' }}></rect>
        </svg>
      </div>

      <SidebarProvider style={{ position: 'relative', zIndex: 1 }}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
             <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              {parentClient.logoUrl ? (
                <img src={parentClient.logoUrl} alt={parentClient.clientName} className="size-7 object-contain rounded" />
              ) : (
                <LogoIcon className="size-7 text-primary" />
              )}
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
         <SidebarInset className="bg-transparent">
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
                  background: `linear-gradient(90deg, ${brandColorPrimary}00 0%, ${brandColorPrimary}cc 30%, ${brandColorSecondary}cc 70%, ${brandColorSecondary}00 100%)`,
                }}
              />
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
          <main className="relative flex-1 p-4 sm:p-6" style={{ backgroundColor: 'transparent', zIndex: 1, minHeight: 0 }}>
              {children}
          </main>
      </SidebarInset>
      </SidebarProvider>
    </>
  );
}
