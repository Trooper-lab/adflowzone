'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Megaphone,
  Pencil,
  PlusCircle,
  LayoutGrid,
  ShoppingCart,
  Smartphone,
  StickyNote,
  Target,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import type { ChildAccount, ParentClient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_META: Record<
  string,
  { label: string; Icon: React.ElementType; badgeCn: string }
> = {
  lead_generation:  { label: 'Lead Gen',   Icon: Target,       badgeCn: 'bg-blue-500/10   text-blue-400'   },
  ecommerce_sales:  { label: 'E-commerce', Icon: ShoppingCart, badgeCn: 'bg-green-500/10  text-green-400'  },
  brand_awareness:  { label: 'Brand',      Icon: Megaphone,    badgeCn: 'bg-purple-500/10 text-purple-400' },
  app_installs:     { label: 'App',        Icon: Smartphone,   badgeCn: 'bg-orange-500/10 text-orange-400' },
  other:            { label: 'Overig',     Icon: LayoutGrid,   badgeCn: 'bg-slate-500/10  text-slate-400'  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-blue-500" />
    </div>
  );
}

function StatCard({
  label,
  value,
  valueCn = 'text-slate-100',
}: {
  label: string;
  value: string;
  valueCn?: string;
}) {
  return (
    <div className="rounded-xl bg-[#1C243A] border border-[#2A3552] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={cn('text-3xl font-bold mt-1.5', valueCn)}>{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#1C243A] border border-[#2A3552] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#2A3552] bg-white/[0.03]">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const firestore = useFirestore();
  const { user } = useUser();

  const parentClientRef = useMemoFirebase(
    () => (firestore && clientId ? doc(firestore, 'parentClients', clientId) : null),
    [firestore, clientId],
  );
  const { data: parentClient, loading: parentLoading } = useDoc(parentClientRef);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user],
  );
  const { data: appUser } = useDoc(userDocRef);

  const isAdmin = useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return (
      role === 'admin' ||
      user?.email === 'billy@pearsonline.nl' ||
      user?.email === 'billy@trooper.es'
    );
  }, [appUser, user?.email]);

  const childAccountsQuery = useMemoFirebase(
    () =>
      firestore && clientId
        ? query(collection(firestore, 'parentClients', clientId, 'childAccounts'))
        : null,
    [firestore, clientId],
  );
  const { data: childAccounts, loading: childrenLoading } =
    useCollection(childAccountsQuery);

  const totals = useMemo(() => {
    if (!childAccounts) return { budget: 0, fee: 0, active: 0, total: 0 };
    return childAccounts.reduce(
      (acc, a) => {
        acc.total += 1;
        if (!a.isPaused) {
          acc.budget += a.monthlyClickBudget || 0;
          acc.fee    += a.managementFee?.amount || 0;
          acc.active += 1;
        }
        return acc;
      },
      { budget: 0, fee: 0, active: 0, total: 0 },
    );
  }, [childAccounts]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (parentLoading || childrenLoading) return <LoadingScreen />;

  if (!parentClient) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-slate-400">Klant niet gevonden.</p>
        <Button variant="link" asChild>
          <Link href="/dashboard/clients">Terug naar klanten</Link>
        </Button>
      </div>
    );
  }

  const client = parentClient as ParentClient;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="shrink-0 text-muted-foreground hover:text-white"
          >
            <Link href="/dashboard/clients">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline text-2xl font-bold text-slate-100 leading-tight">
                {client.clientName}
              </h1>
              <Badge
                className={cn(
                  'text-[10px] font-black uppercase tracking-wider border-none',
                  client.clientType === 'agency'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'bg-orange-500/10 text-orange-400',
                )}
              >
                {client.clientType}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{client.clientContactEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400"
          >
            <Link href={`/dashboard/campaign-briefings/new?clientId=${clientId}`}>
              <StickyNote className="mr-2 size-3.5" /> Nieuwe Blueprint
            </Link>
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-[#2A3552] bg-white/5 hover:bg-white/10 text-slate-300"
            >
              <Link href={`/dashboard/clients/${clientId}/edit`}>
                <Pencil className="mr-2 size-3.5" /> Bewerken
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              asChild
              className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
            >
              <Link href={`/dashboard/clients/${clientId}/add`}>
                <PlusCircle className="mr-2 size-3.5" /> Account Toevoegen
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className={cn('grid gap-4', isAdmin ? 'grid-cols-3' : 'grid-cols-2')}>
        <StatCard
          label="Actieve Accounts"
          value={`${totals.active}${totals.total !== totals.active ? ` / ${totals.total}` : ''}`}
        />
        <StatCard
          label="Maandelijks Budget"
          value={`€${totals.budget.toLocaleString('nl-NL')}`}
          valueCn="text-green-400"
        />
        {isAdmin && (
          <StatCard
            label="Management Fee"
            value={`€${totals.fee.toLocaleString('nl-NL')}`}
            valueCn="text-blue-400"
          />
        )}
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Accounts list ── */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Google Ads Accounts"
            right={
              <span className="text-xs text-slate-600 font-mono tabular-nums">
                {totals.total} totaal
              </span>
            }
          >
            {childAccounts && childAccounts.length > 0 ? (
              <div className="divide-y divide-[#2A3552]">
                {(childAccounts as any[]).map((account) => {
                  const goal = GOAL_META[account.primaryGoal];
                  return (
                    <Link
                      key={account.id}
                      href={`/dashboard/accounts/${account.id}?parent=${clientId}`}
                      className={cn(
                        'flex items-center justify-between px-6 py-4 hover:bg-white/[0.04] transition-colors group',
                        account.isPaused && 'opacity-50',
                      )}
                    >
                      {/* Left: name + ID */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                            {account.nickname}
                          </span>
                          {account.isPaused && (
                            <Badge className="text-[9px] bg-slate-700/50 text-slate-400 border-none h-4 px-1.5 shrink-0">
                              Gepauzeerd
                            </Badge>
                          )}
                          {goal && (
                            <Badge
                              className={cn(
                                'text-[9px] font-bold border-none h-4 px-1.5 shrink-0 hidden sm:flex',
                                goal.badgeCn,
                              )}
                            >
                              {goal.label}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 mt-0.5">
                          ID: {account.googleAdsClientId}
                        </span>
                      </div>

                      {/* Right: financials + arrow */}
                      <div className="flex items-center gap-6 shrink-0 ml-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                            Budget
                          </p>
                          <p className="text-sm font-semibold text-green-400">
                            €{account.monthlyClickBudget?.toLocaleString('nl-NL') || '0'}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              Fee
                            </p>
                            <p className="text-sm font-semibold text-blue-400">
                              €{account.managementFee?.amount?.toLocaleString('nl-NL') || '0'}
                            </p>
                          </div>
                        )}
                        <ArrowRight className="size-4 text-slate-700 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="p-3 rounded-full bg-white/5 mb-3">
                  <Target className="size-8 text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Nog geen accounts toegevoegd voor deze klant.
                </p>
                {isAdmin && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Link href={`/dashboard/clients/${clientId}/add`}>
                      <PlusCircle className="mr-2 size-4" />
                      Eerste Account Toevoegen
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Client info sidebar ── */}
        <div className="space-y-4">
          <SectionCard title="Klantgegevens">
            <div className="p-6 space-y-4">
              <InfoRow icon={User} label="Contactpersoon">
                <span className="text-sm font-medium text-slate-200">
                  {client.clientContactPerson}
                </span>
              </InfoRow>

              <InfoRow icon={Mail} label="E-mail">
                <a
                  href={`mailto:${client.clientContactEmail}`}
                  className="text-sm text-blue-400 hover:text-blue-300 break-all"
                >
                  {client.clientContactEmail}
                </a>
              </InfoRow>

              {client.clientUserEmail && client.clientUserEmail !== client.clientContactEmail && (
                <InfoRow icon={Mail} label="Platform e-mail">
                  <span className="text-sm text-slate-300 break-all">
                    {client.clientUserEmail}
                  </span>
                </InfoRow>
              )}

              {client.clientWebsite && (
                <InfoRow icon={Globe} label="Website">
                  <a
                    href={client.clientWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 truncate"
                  >
                    <span className="truncate">
                      {client.clientWebsite.replace(/^https?:\/\//, '')}
                    </span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </InfoRow>
              )}

              {client.internalNotes && (
                <div className="pt-4 border-t border-[#2A3552]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <StickyNote className="size-3.5 text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Notities
                    </p>
                  </div>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {client.internalNotes}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Quick-link to portfolio view */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full border-[#2A3552] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <Link href="/dashboard/accounts">
              <Wallet className="mr-2 size-3.5" />
              Portfolio Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        {children}
        <p className="text-[11px] text-slate-600 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
