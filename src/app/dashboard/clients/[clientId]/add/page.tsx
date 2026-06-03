'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Check,
  Loader2,
  Megaphone,
  LayoutGrid,
  Save,
  ShoppingCart,
  Smartphone,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const KPI_ITEMS = [
  { id: 'spend', label: 'Spend' },
  { id: 'clicks', label: 'Clicks' },
  { id: 'impressions', label: 'Impressions' },
  { id: 'conversions', label: 'Conversions' },
  { id: 'conversion_value', label: 'Conv. Value' },
  { id: 'roas', label: 'ROAS' },
  { id: 'cpl', label: 'CPL' },
  { id: 'cpc', label: 'CPC' },
  { id: 'ctr', label: 'CTR' },
] as const;

const PRIMARY_GOALS = [
  { value: 'lead_generation',  label: 'Lead Generation',  Icon: Target,       color: 'blue'   },
  { value: 'ecommerce_sales',  label: 'E-commerce Sales', Icon: ShoppingCart, color: 'green'  },
  { value: 'brand_awareness',  label: 'Brand Awareness',  Icon: Megaphone,    color: 'purple' },
  { value: 'app_installs',     label: 'App Installs',     Icon: Smartphone,   color: 'orange' },
  { value: 'other',            label: 'Overig',           Icon: LayoutGrid,   color: 'slate'  },
] as const;

const GOAL_ACTIVE_CLASSES: Record<string, string> = {
  blue:   'border-blue-500/50 bg-blue-500/10 text-blue-300',
  green:  'border-green-500/50 bg-green-500/10 text-green-300',
  purple: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
  orange: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
  slate:  'border-slate-500/50 bg-slate-500/10 text-slate-300',
};

const GOAL_ICON_ACTIVE_CLASSES: Record<string, string> = {
  blue:   'text-blue-400',
  green:  'text-green-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  slate:  'text-slate-400',
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nickname: z.string().min(2, 'Minimaal 2 tekens vereist.'),
  googleAdsClientId: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, 'Formaat vereist: 123-456-7890'),
  googleAdsAccountName: z.string().min(2, 'Vereist.'),
  managementFee: z
    .object({
      amount: z.coerce.number().min(0).optional(),
      frequency: z.literal('monthly').default('monthly'),
    })
    .optional(),
  monthlyClickBudget: z.coerce.number().min(0).optional(),
  primaryGoal: z.enum([
    'lead_generation',
    'ecommerce_sales',
    'brand_awareness',
    'app_installs',
    'other',
  ]),
  kpisToTrack: z.array(z.string()).min(1, 'Selecteer minimaal één KPI.'),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Auto-insert dashes while the user types a Google Ads Client ID */
function formatClientId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddChildAccountPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [saving, setSaving] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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
      user?.email === 'billy@trooper.es' ||
      user?.email?.toLowerCase() === 'admin@onlyforward.nl'
    );
  }, [appUser, user?.email]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nickname: '',
      googleAdsClientId: '',
      googleAdsAccountName: '',
      managementFee: { amount: 0, frequency: 'monthly' },
      monthlyClickBudget: 0,
      primaryGoal: 'lead_generation',
      kpisToTrack: ['spend', 'clicks', 'conversions'],
    },
  });

  // ── Save handler ─────────────────────────────────────────────────────────────

  async function save(data: FormData, andAddAnother: boolean) {
    if (!firestore || !user) return;
    setSaving(true);
    try {
      await addDoc(
        collection(firestore, 'parentClients', clientId, 'childAccounts'),
        {
          ...data,
          ownerId: user.uid,
          parentClientId: clientId,
          managementFee: {
            amount: Number(data.managementFee?.amount) || 0,
            frequency: 'monthly',
          },
          monthlyClickBudget: Number(data.monthlyClickBudget) || 0,
          isPaused: false,
          connectedChecklists: [],
          targetKpiValues: [],
          createdAt: serverTimestamp(),
        },
      );

      toast({
        title: 'Account opgeslagen',
        description: `${data.nickname} is succesvol toegevoegd.`,
      });

      if (andAddAnother) {
        // Preserve financial + goal settings so the next entry is faster
        form.reset({
          nickname: '',
          googleAdsClientId: '',
          googleAdsAccountName: '',
          managementFee: data.managementFee,
          monthlyClickBudget: data.monthlyClickBudget,
          primaryGoal: data.primaryGoal,
          kpisToTrack: data.kpisToTrack,
        });
      } else {
        router.push(`/dashboard/clients/${clientId}`);
      }
    } catch (e: any) {
      console.error('Error saving account:', e);
      toast({
        variant: 'destructive',
        title: 'Opslaan mislukt',
        description: e?.message ?? 'Controleer de invoer en probeer het opnieuw.',
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="shrink-0 text-muted-foreground hover:text-white"
        >
          <Link href={`/dashboard/clients/${clientId}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-2xl font-bold text-slate-100">
            Nieuw Account Toevoegen
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configureer een nieuw Google Ads account voor deze klant.
          </p>
        </div>
      </div>

      <Form {...form}>
        {/* Note: the form's own onSubmit maps to "save & finish" */}
        <form onSubmit={form.handleSubmit((data) => save(data, false))} className="space-y-5">

          {/* ── Section 1 — Account Identification ── */}
          <Section title="Account Identificatie">
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    Account Naam <Required />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="bijv. DigitalGrowth – Main Lead Gen"
                      {...field}
                      className={inputCn}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-500">
                    Interne naam om dit account te herkennen.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="googleAdsClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">
                      Google Ads Client ID <Required />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123-456-7890"
                        {...field}
                        onChange={(e) =>
                          field.onChange(formatClientId(e.target.value))
                        }
                        className={cn(inputCn, 'font-mono tracking-wider')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="googleAdsAccountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">
                      Officiële Account Naam <Required />
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Zoals weergegeven in Google Ads"
                        {...field}
                        className={inputCn}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          {/* ── Section 2 — Financials ── */}
          <Section title="Financieel">
            <div className={cn('grid gap-4', isAdmin ? 'grid-cols-2' : 'grid-cols-1')}>
              <FormField
                control={form.control}
                name="monthlyClickBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">
                      Maandelijks Click Budget
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm pointer-events-none">
                          €
                        </span>
                        <Input
                          type="number"
                          min={0}
                          placeholder="1000"
                          {...field}
                          value={field.value ?? ''}
                          className={cn(inputCn, 'pl-7')}
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs text-slate-500">
                      Budget van de klant voor advertentieklikken.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isAdmin && (
                <FormField
                  control={form.control}
                  name="managementFee.amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">
                        Maandelijkse Management Fee
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm pointer-events-none">
                            €
                          </span>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            className={cn(inputCn, 'pl-7')}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Jouw fee voor het beheer van dit account.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </Section>

          {/* ── Section 3 — Goal & KPIs ── */}
          <Section title="Doel & KPI's">
            {/* Primary Goal — card buttons */}
            <FormField
              control={form.control}
              name="primaryGoal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">
                    Primair Doel <Required />
                  </FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {PRIMARY_GOALS.map(({ value, label, Icon, color }) => {
                      const active = field.value === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-semibold transition-all duration-150',
                            active
                              ? GOAL_ACTIVE_CLASSES[color]
                              : 'border-white/5 bg-white/5 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                          )}
                        >
                          <Icon
                            className={cn(
                              'size-5',
                              active ? GOAL_ICON_ACTIVE_CLASSES[color] : 'text-slate-500',
                            )}
                          />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* KPIs — toggle chips */}
            <FormField
              control={form.control}
              name="kpisToTrack"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-slate-300">
                      Te Volgen KPI's <Required />
                    </FormLabel>
                    <span className="text-xs text-slate-500">(min. 1)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {KPI_ITEMS.map(({ id, label }) => {
                      const active = field.value?.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            field.onChange(
                              active
                                ? field.value.filter((v) => v !== id)
                                : [...(field.value ?? []), id],
                            )
                          }
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                            active
                              ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
                              : 'border-white/5 bg-white/5 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                          )}
                        >
                          {active && <Check className="size-3" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>

          {/* ── Action Row ── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => router.push(`/dashboard/clients/${clientId}`)}
              disabled={saving}
            >
              Annuleren
            </Button>
            <div className="flex items-center gap-3">
              {/* "Save & add another" — explicit type=button to prevent dual-submit */}
              <Button
                type="button"
                variant="outline"
                className="border-white/5 bg-white/5 hover:bg-white/10 text-slate-200"
                disabled={saving}
                onClick={form.handleSubmit((data) => save(data, true))}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Opslaan &amp; Nog Eén
              </Button>
              {/* "Save & finish" — regular submit */}
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Opslaan &amp; Afronden
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Small reusable helpers ───────────────────────────────────────────────────

const inputCn =
  'bg-white/5 border-white/5 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500/50';

const Required = () => <span className="text-red-400 ml-0.5">*</span>;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-3 border-b border-white/5 bg-white/[0.03]">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          {title}
        </p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}
