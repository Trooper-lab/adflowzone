'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { addDoc, collection, doc, getDocs, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Check,
  Loader2,
  Megaphone,
  LayoutGrid,
  Save,
  ShoppingCart,
  Smartphone,
  Target,
  PlusCircle,
  CalendarIcon,
  Trash2,
  PauseCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { format, isPast, isToday, setDay, addWeeks, setDate, addMonths } from 'date-fns';
import type { AppUser, ChildAccount, ParentClient, Service, ServicePackage, ChecklistTemplate } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

const inputCn =
  'bg-secondary border-border text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500/50';

const Required = () => <span className="text-red-400 ml-0.5">*</span>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const connectedChecklistSchema = z.object({
  checklistId: z.string().min(1, 'Selecteer een checklist.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'one-off']),
  startDate: z.date().optional(),
  dayOfWeek: z.string().optional(),
  dayOfMonth: z.string().optional(),
});

const schema = z.object({
  nickname: z.string().min(2, 'Minimaal 2 tekens vereist.'),
  googleAdsClientId: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, 'Formaat vereist: 123-456-7890'),
  googleAdsAccountName: z.string().min(2, 'Officiële naam is vereist.'),
  assignedEmployeeId: z.string().optional().nullable(),
  managementFee: z
    .object({
      amount: z.coerce.number().min(0).optional(),
      frequency: z.literal('monthly').default('monthly'),
    })
    .optional(),
  monthlyClickBudget: z.coerce.number().min(0).optional(),
  fixedHours: z.coerce.number().min(0).optional(),
  primaryGoal: z.enum([
    'lead_generation',
    'ecommerce_sales',
    'brand_awareness',
    'app_installs',
    'other',
  ]),
  kpisToTrack: z.array(z.string()).min(1, 'Selecteer minimaal één KPI.'),
  connectedChecklists: z.array(connectedChecklistSchema).optional(),
  targetKpiValues: z.array(z.object({
    kpi: z.string().min(1, "Selecteer een KPI."),
    target: z.coerce.number().min(0, "Target moet positief zijn."),
  })).max(3, "Maximaal 3 key results.").optional(),
  connectedServices: z.array(z.object({
    serviceId: z.string(),
    serviceName: z.string(),
    hours: z.coerce.number().min(0.1, "Minimaal 0.1 uur"),
  })).optional(),
  connectedPackages: z.array(z.object({
    packageId: z.string(),
    packageName: z.string(),
  })).optional(),
  isPaused: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClientId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-3 border-b border-border bg-white/[0.03]">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          {title}
        </p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ChildAccountFormProps {
  parentClientId: string;
  initialData?: ChildAccount;
  isPortal?: boolean;
  onSaveSuccess?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  addAnotherLabel?: string;
}

export default function ChildAccountForm({
  parentClientId,
  initialData,
  isPortal = false,
  onSaveSuccess,
  onCancel,
  cancelLabel = 'Annuleren',
  submitLabel = 'Opslaan & Afronden',
  addAnotherLabel = 'Opslaan & Nog Eén',
}: ChildAccountFormProps) {
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const isEdit = !!initialData;

  // Load Parent Client document to determine Manager UID (ownerId)
  const parentClientRef = useMemoFirebase(
    () => (firestore && parentClientId ? doc(firestore, 'parentClients', parentClientId) : null),
    [firestore, parentClientId]
  );
  const { data: parentClient } = useDoc(parentClientRef);

  const managerUid = useMemo(() => {
    return parentClient ? (parentClient as ParentClient).ownerId : null;
  }, [parentClient]);

  // Load checklist templates belonging to parent client manager
  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !managerUid) return null;
    return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
  }, [firestore, managerUid]);
  const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);

  // Load services belonging to parent client manager
  const servicesQuery = useMemoFirebase(() => {
    if (!firestore || !managerUid) return null;
    return query(collection(firestore, 'services'), where('ownerId', '==', managerUid));
  }, [firestore, managerUid]);
  const { data: servicesData } = useCollection(servicesQuery);
  const availableServices = useMemo(() => {
    if (!servicesData) return [];
    return servicesData.map(d => ({ id: d.id, ...d.data() } as Service));
  }, [servicesData]);

  // Load packages belonging to parent client manager
  const packagesQuery = useMemoFirebase(() => {
    if (!firestore || !managerUid) return null;
    return query(collection(firestore, 'servicePackages'), where('ownerId', '==', managerUid));
  }, [firestore, managerUid]);
  const { data: packagesData } = useCollection(packagesQuery);
  const availablePackages = useMemo(() => {
    if (!packagesData) return [];
    return packagesData.map(d => ({ id: d.id, ...d.data() } as ServicePackage));
  }, [packagesData]);

  // Check admin privileges for logged-in user
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
      assignedEmployeeId: null,
      managementFee: { amount: 0, frequency: 'monthly' },
      monthlyClickBudget: 0,
      fixedHours: 0,
      primaryGoal: 'lead_generation',
      kpisToTrack: ['spend', 'clicks', 'conversions'],
      connectedChecklists: [],
      targetKpiValues: [],
      connectedServices: [],
      connectedPackages: [],
      isPaused: false,
    },
  });

  const { fields: checklistFields, append: appendChecklist, remove: removeChecklist } = useFieldArray({
    control: form.control,
    name: 'connectedChecklists',
  });

  const { fields: keyResultFields, append: appendKeyResult, remove: removeKeyResult } = useFieldArray({
    control: form.control,
    name: 'targetKpiValues',
  });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: 'connectedServices',
  });

  const { fields: packageFields, append: appendPackage, remove: removePackage } = useFieldArray({
    control: form.control,
    name: 'connectedPackages',
  });

  const connectedChecklistsValues = form.watch('connectedChecklists');
  const trackedKpis = form.watch('kpisToTrack');
  const watchConnectedServices = form.watch('connectedServices');
  const watchConnectedPackages = form.watch('connectedPackages');

  // Load employees
  useEffect(() => {
    if (!firestore || isPortal) return;
    const fetchEmployees = async () => {
      try {
        const snap = await getDocs(collection(firestore, 'users'));
        const team = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AppUser))
          .filter((u) => u.role === 'employee');
        setEmployees(team);
      } catch (e) {
        console.error('Fout bij ophalen medewerkers:', e);
      }
    };
    fetchEmployees();
  }, [firestore, isPortal]);

  // Load initialData in edit mode
  useEffect(() => {
    if (initialData) {
      const parsedChecklists = initialData.connectedChecklists?.map(c => ({
        ...c,
        startDate: c.startDate ? new Date(c.startDate) : new Date(),
      })) || [];

      form.reset({
        nickname: initialData.nickname || '',
        googleAdsClientId: initialData.googleAdsClientId || '',
        googleAdsAccountName: initialData.googleAdsAccountName || '',
        assignedEmployeeId: initialData.assignedEmployeeId || null,
        managementFee: {
          amount: initialData.managementFee?.amount || 0,
          frequency: 'monthly',
        },
        monthlyClickBudget: initialData.monthlyClickBudget || 0,
        fixedHours: initialData.fixedHours || 0,
        primaryGoal: initialData.primaryGoal || 'lead_generation',
        kpisToTrack: initialData.kpisToTrack || [],
        connectedChecklists: parsedChecklists,
        targetKpiValues: initialData.targetKpiValues || [],
        connectedServices: initialData.connectedServices || [],
        connectedPackages: initialData.connectedPackages || [],
        isPaused: initialData.isPaused || false,
      });
    }
  }, [initialData, form]);

  // Automatically calculate fixed hours if services or packages change
  useEffect(() => {
    let totalHours = 0;
    if (watchConnectedServices && watchConnectedServices.length > 0) {
      totalHours += watchConnectedServices.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
    }
    if (watchConnectedPackages && watchConnectedPackages.length > 0 && availablePackages.length > 0) {
      watchConnectedPackages.forEach(p => {
        const pkg = availablePackages.find(ap => ap.id === p.packageId);
        if (pkg && pkg.services) {
          totalHours += pkg.services.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
        }
      });
    }
    
    if ((watchConnectedServices && watchConnectedServices.length > 0) || (watchConnectedPackages && watchConnectedPackages.length > 0)) {
      form.setValue('fixedHours', Number(totalHours.toFixed(2)));
    }
  }, [watchConnectedServices, watchConnectedPackages, availablePackages, form]);

  const getNextDate = (freq: string, dayValue?: string): Date => {
    const now = new Date();
    let nextDate = now;

    if (freq === 'weekly' && dayValue) {
      const desiredDay = parseInt(dayValue);
      nextDate = setDay(now, desiredDay, { weekStartsOn: 1 });
      if (isPast(nextDate) || isToday(nextDate)) {
        nextDate = addWeeks(nextDate, 1);
      }
    } else if (freq === 'monthly' && dayValue) {
      const desiredDate = parseInt(dayValue);
      nextDate = setDate(now, desiredDate);
      if (isPast(nextDate) || isToday(nextDate)) {
        nextDate = addMonths(nextDate, 1);
      }
    }
    return nextDate;
  };

  // ── Save handler ─────────────────────────────────────────────────────────────

  async function save(data: FormData, andAddAnother: boolean) {
    if (!firestore || !user) return;
    setSaving(true);

    const processedChecklists = isEdit
      ? initialData?.connectedChecklists || []
      : data.connectedChecklists?.map((c) => {
          let finalStartDate: Date | undefined = c.startDate;
          if (c.frequency === 'weekly' || c.frequency === 'monthly') {
            finalStartDate = getNextDate(c.frequency, c.dayOfWeek || c.dayOfMonth);
          }
          if (!finalStartDate) {
            finalStartDate = new Date();
          }
          return {
            checklistId: c.checklistId,
            frequency: c.frequency,
            startDate: finalStartDate.toISOString(),
          };
        }) || [];

    const childAccountData = {
      nickname: data.nickname,
      googleAdsClientId: data.googleAdsClientId,
      googleAdsAccountName: data.googleAdsAccountName,
      assignedEmployeeId: data.assignedEmployeeId || null,
      managementFee: {
        amount: Number(data.managementFee?.amount) || 0,
        frequency: 'monthly',
      },
      monthlyClickBudget: Number(data.monthlyClickBudget) || 0,
      fixedHours: Number(data.fixedHours) || 0,
      primaryGoal: data.primaryGoal,
      kpisToTrack: data.kpisToTrack,
      connectedChecklists: processedChecklists,
      targetKpiValues: data.targetKpiValues || [],
      connectedServices: data.connectedServices || [],
      connectedPackages: data.connectedPackages || [],
      isPaused: data.isPaused ?? false,
      ownerId: managerUid || user.uid,
      parentClientId: parentClientId,
      ...(!isEdit && { createdAt: serverTimestamp() }),
    };

    try {
      const collectionRef = collection(firestore, 'parentClients', parentClientId, 'childAccounts');

      if (isEdit && initialData) {
        const docRef = doc(firestore, 'parentClients', parentClientId, 'childAccounts', initialData.id);
        await updateDoc(docRef, childAccountData);
        toast({
          title: 'Account bijgewerkt',
          description: `${data.nickname} is succesvol bijgewerkt.`,
        });
      } else {
        await addDoc(collectionRef, childAccountData);
        toast({
          title: 'Account opgeslagen',
          description: `${data.nickname} is succesvol toegevoegd.`,
        });
      }

      if (andAddAnother && !isEdit) {
        form.reset({
          nickname: '',
          googleAdsClientId: '',
          googleAdsAccountName: '',
          assignedEmployeeId: null,
          managementFee: data.managementFee,
          monthlyClickBudget: data.monthlyClickBudget,
          fixedHours: 0,
          primaryGoal: data.primaryGoal,
          kpisToTrack: data.kpisToTrack,
          connectedChecklists: [],
          targetKpiValues: [],
          connectedServices: [],
          connectedPackages: [],
          isPaused: false,
        });
      } else {
        onSaveSuccess?.();
      }
    } catch (e: any) {
      console.error('Error saving account:', e);
      const permissionError = new FirestorePermissionError({
        path: isEdit ? `parentClients/${parentClientId}/childAccounts/${initialData?.id}` : `parentClients/${parentClientId}/childAccounts`,
        operation: isEdit ? 'update' : 'create',
        requestResourceData: childAccountData,
      });
      errorEmitter.emit('permission-error', permissionError);

      toast({
        variant: 'destructive',
        title: 'Opslaan mislukt',
        description: e?.message ?? 'Controleer de invoer en probeer het opnieuw.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
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

        {/* ── Section 2 — Assignment (Only visible in Dashboard/Admin view) ── */}
        {!isPortal && (
          <Section title="Toewijzing">
            <FormField
              control={form.control}
              name="assignedEmployeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Verantwoordelijke Medewerker</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger className={inputCn}>
                        <SelectValue placeholder="Selecteer medewerker..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-border text-slate-200">
                      <SelectItem value="none">Niemand (Alleen Admin)</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.uid} value={emp.uid}>
                          {emp.displayName || emp.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs text-slate-500">
                    Deze medewerker krijgt toegang tot dit account in hun FlowZone.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>
        )}

        {/* ── Section 3 — Financials ── */}
        <Section title="Financieel & Budget">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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

            {/* Management Fee: Visible in dashboard, or if Admin */}
            {!isPortal && isAdmin ? (
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
            ) : (
              // In client portal or for non-admin, render fixedHours field
              <FormField
                control={form.control}
                name="fixedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Vaste Uren per Maand</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="5"
                        {...field}
                        value={field.value ?? ''}
                        disabled={watchConnectedServices && watchConnectedServices.length > 0}
                        className={inputCn}
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-slate-500">
                      {watchConnectedServices && watchConnectedServices.length > 0
                        ? 'Automatisch berekend o.b.v. gekoppelde diensten.'
                        : 'Het aantal vaste beheeruren per maand.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Connected Services List (Splitting hours) */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Gekoppelde Diensten & Uren</h4>
                <p className="text-[11px] text-slate-500 mt-1">Koppel diensten om de vaste uren op de factuur uit te splitsen.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendService({ serviceId: '', serviceName: '', hours: 0 })}
                className="border-border bg-secondary hover:bg-accent text-slate-300"
              >
                <PlusCircle className="size-4 mr-2" /> Dienst Toevoegen
              </Button>
            </div>

            {serviceFields.length > 0 && (
              <div className="space-y-3">
                {serviceFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_120px_auto] gap-3 items-start p-4 border border-border bg-white/[0.01] rounded-xl">
                    <FormField
                      control={form.control}
                      name={`connectedServices.${index}.serviceId`}
                      render={({ field: selectField }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => {
                              selectField.onChange(val);
                              const svc = availableServices.find(s => s.id === val);
                              if (svc) {
                                form.setValue(`connectedServices.${index}.serviceName`, svc.name);
                              }
                            }}
                            value={selectField.value}
                          >
                            <FormControl>
                              <SelectTrigger className={inputCn}>
                                <SelectValue placeholder="Kies een dienst..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-border text-slate-200">
                              {availableServices.map(svc => (
                                <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`connectedServices.${index}.hours`}
                      render={({ field: inputField }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" step="0.1" placeholder="Uren" {...inputField} className={cn(inputCn, 'pr-10')} />
                              <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 font-bold">uur</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)} className="hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connected Packages List */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Gekoppelde Pakketten</h4>
                <p className="text-[11px] text-slate-500 mt-1">Koppel een pakket om diensten te bundelen.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendPackage({ packageId: '', packageName: '' })}
                className="border-border bg-secondary hover:bg-accent text-slate-300"
              >
                <PlusCircle className="size-4 mr-2" /> Pakket Toevoegen
              </Button>
            </div>

            {packageFields.length > 0 && (
              <div className="space-y-3">
                {packageFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_auto] gap-3 items-start p-4 border border-border bg-white/[0.01] rounded-xl">
                    <FormField
                      control={form.control}
                      name={`connectedPackages.${index}.packageId`}
                      render={({ field: selectField }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => {
                              selectField.onChange(val);
                              const pkg = availablePackages.find(p => p.id === val);
                              if (pkg) {
                                form.setValue(`connectedPackages.${index}.packageName`, pkg.name);
                              }
                            }}
                            value={selectField.value}
                          >
                            <FormControl>
                              <SelectTrigger className={inputCn}>
                                <SelectValue placeholder="Kies een pakket..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-border text-slate-200">
                              {availablePackages.map(pkg => (
                                <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePackage(index)} className="hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Section 4 — Goal & KPIs ── */}
        <Section title="Doel & KPI's">
          <FormField
            control={form.control}
            name="primaryGoal"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">
                  Primair Doel <Required />
                </FormLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
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
                            : 'border-border bg-secondary text-slate-400 hover:border-slate-500 hover:text-slate-200',
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
                            : 'border-border bg-secondary text-slate-400 hover:border-slate-500 hover:text-slate-200',
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

          {/* Monthly KPI targets setting */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Maandelijkse KPI Targets (Max 3)</h4>
                <p className="text-[11px] text-slate-500 mt-1">Stel optionele streefwaarden in voor je belangrijkste KPIs.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendKeyResult({ kpi: '', target: 0 })}
                disabled={keyResultFields.length >= 3}
                className="border-border bg-secondary hover:bg-accent text-slate-300"
              >
                <PlusCircle className="size-4 mr-2" /> Target Toevoegen
              </Button>
            </div>

            {keyResultFields.length > 0 && (
              <div className="space-y-3">
                {keyResultFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-start p-4 border border-border bg-white/[0.01] rounded-xl">
                    <FormField
                      control={form.control}
                      name={`targetKpiValues.${index}.kpi`}
                      render={({ field: selectField }) => (
                        <FormItem>
                          <Select onValueChange={selectField.onChange} value={selectField.value}>
                            <FormControl>
                              <SelectTrigger className={inputCn}>
                                <SelectValue placeholder="Selecteer KPI..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-border text-slate-200">
                              {KPI_ITEMS.filter(kpi => trackedKpis?.includes(kpi.id)).map(kpi => (
                                <SelectItem key={kpi.id} value={kpi.id}>{kpi.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`targetKpiValues.${index}.target`}
                      render={({ field: inputField }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" placeholder="Target Waarde" {...inputField} className={inputCn} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyResult(index)} className="hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Section 5 — Checklist Setup (Only visible in Create Mode) ── */}
        {!isEdit && (
          <Section title="Checklist Setup">
            <FormDescription className="text-xs text-slate-500 mb-2">
              Koppel periodieke checklists aan dit account bij aanmaak.
            </FormDescription>
            
            <div className="space-y-3">
              {checklistFields.map((item, index) => {
                const frequency = connectedChecklistsValues?.[index]?.frequency;
                return (
                  <div
                    key={item.id}
                    className="p-4 border border-border bg-white/[0.02] rounded-xl flex flex-col md:flex-row gap-4 items-end relative"
                  >
                    <FormField
                      control={form.control}
                      name={`connectedChecklists.${index}.checklistId`}
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full">
                          <FormLabel className="text-slate-400 text-xs">Checklist</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={inputCn}>
                                <SelectValue placeholder={checklistsLoading ? "Laden..." : "Selecteer..."} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-border text-slate-200">
                              {checklistTemplates?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`connectedChecklists.${index}.frequency`}
                      render={({ field }) => (
                        <FormItem className="flex-1 w-full">
                          <FormLabel className="text-slate-400 text-xs">Frequentie</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={inputCn}>
                                <SelectValue placeholder="Selecteer..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-900 border-border text-slate-200">
                              <SelectItem value="one-off">Eenmalig</SelectItem>
                              <SelectItem value="daily">Dagelijks</SelectItem>
                              <SelectItem value="weekly">Wekelijks</SelectItem>
                              <SelectItem value="monthly">Maandelijks</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Conditional Date / Weekday Selection */}
                    {(frequency === 'daily' || frequency === 'one-off') && (
                      <FormField
                        control={form.control}
                        name={`connectedChecklists.${index}.startDate`}
                        render={({ field }) => (
                          <FormItem className="flex-1 w-full flex flex-col">
                            <FormLabel className="text-slate-400 text-xs mb-1">Startdatum</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      'w-full text-left font-normal border-border bg-secondary text-slate-100',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, 'PPP')
                                    ) : (
                                      <span>Kies een datum</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-slate-900 border-border" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {frequency === 'weekly' && (
                      <FormField
                        control={form.control}
                        name={`connectedChecklists.${index}.dayOfWeek`}
                        render={({ field }) => (
                          <FormItem className="flex-1 w-full">
                            <FormLabel className="text-slate-400 text-xs">Startdag (Week)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className={inputCn}>
                                  <SelectValue placeholder="Selecteer..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-900 border-border text-slate-200">
                                <SelectItem value="1">Maandag</SelectItem>
                                <SelectItem value="2">Dinsdag</SelectItem>
                                <SelectItem value="3">Woensdag</SelectItem>
                                <SelectItem value="4">Donderdag</SelectItem>
                                <SelectItem value="5">Vrijdag</SelectItem>
                                <SelectItem value="6">Zaterdag</SelectItem>
                                <SelectItem value="0">Zondag</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {frequency === 'monthly' && (
                      <FormField
                        control={form.control}
                        name={`connectedChecklists.${index}.dayOfMonth`}
                        render={({ field }) => (
                          <FormItem className="flex-1 w-full">
                            <FormLabel className="text-slate-400 text-xs">Startdag (Maand)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className={inputCn}>
                                  <SelectValue placeholder="Selecteer..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-900 border-border text-slate-200">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                  <SelectItem key={d} value={d.toString()}>{d}e van de maand</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChecklist(index)}
                      className="shrink-0 text-slate-500 hover:text-red-400 hover:bg-secondary mb-[2px]"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendChecklist({ checklistId: '', startDate: new Date(), frequency: 'weekly', dayOfWeek: '1' })}
                className="border-border bg-secondary hover:bg-accent text-slate-300"
              >
                <PlusCircle className="mr-2 size-4" />
                Checklist Koppelen
              </Button>
            </div>
          </Section>
        )}

        {/* ── Section 6 — Pause Account (Only visible in Edit Mode) ── */}
        {isEdit && (
          <Section title="Account Status">
            <FormField
              control={form.control}
              name="isPaused"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4 bg-white/[0.01]">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2 text-slate-200">
                      <PauseCircle className="size-5" />
                      Account Pauzeren
                    </FormLabel>
                    <FormDescription className="text-xs text-slate-500">
                      Gepauzeerde accounts worden verborgen in het dashboard en rapportages.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Section>
        )}

        {/* ── Action Row ── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={onCancel}
              disabled={saving}
            >
              {cancelLabel}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                className="border-border bg-secondary hover:bg-accent text-slate-200"
                disabled={saving}
                onClick={form.handleSubmit((data) => save(data, true))}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {addAnotherLabel}
              </Button>
            )}
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
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
