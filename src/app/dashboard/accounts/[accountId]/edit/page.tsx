
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, PlusCircle, PauseCircle, Users } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useMemo } from 'react';
import type { ChildAccount, AppUser } from '@/lib/types';
import { Switch } from '@/components/ui/switch';


const kpiItems = [
    { id: 'spend', label: 'Spend' },
    { id: 'clicks', label: 'Clicks' },
    { id: 'impressions', label: 'Impressions' },
    { id: 'conversions', label: 'Conversions' },
    { id: 'conversion_value', label: 'Conversion Value' },
    { id: 'roas', label: 'ROAS' },
    { id: 'cpl', label: 'CPL' },
    { id: 'cpc', label: 'CPC' },
    { id: 'ctr', label: 'CTR' },
] as const;

const childAccountSchema = z.object({
    nickname: z.string().min(2, 'Nickname is required.'),
    googleAdsClientId: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Invalid Client ID format (e.g., 123-456-7890).'),
    googleAdsAccountName: z.string().min(2, 'Official account name is required.'),
    assignedEmployeeId: z.string().optional().nullable(),
    managementFee: z.object({
        amount: z.coerce.number().min(0, 'Fee must be a positive number.').optional(),
        frequency: z.literal('monthly').default('monthly'),
    }).optional(),
    monthlyClickBudget: z.coerce.number().min(0, 'Budget must be a positive number.').optional(),
    primaryGoal: z.enum(['lead_generation', 'ecommerce_sales', 'brand_awareness', 'app_installs', 'other']),
    kpisToTrack: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: 'You have to select at least one KPI to track.',
    }),
    targetKpiValues: z.array(z.object({
        kpi: z.string().min(1, "Please select a KPI."),
        target: z.coerce.number().min(0, "Target must be a positive number."),
    })).max(3, "You can set a maximum of 3 key results.").optional(),
    isPaused: z.boolean().optional(),
});

type ChildAccountFormData = z.infer<typeof childAccountSchema>;


export default function EditChildAccountPage() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const { accountId } = useParams();
  const searchParams = useSearchParams();
  const parentClientId = searchParams.get('parent');
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const accountDocRef = useMemo(() => (firestore && parentClientId && accountId ? doc(firestore, 'parentClients', parentClientId as string, 'childAccounts', accountId as string) : null), [firestore, parentClientId, accountId]);
  const { data: account, loading: accountLoading } = useDoc(accountDocRef);
  
  const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);
  
  const isAdmin = useMemo(() => {
    const role = (appUser as any)?.role?.toLowerCase();
    return role === 'admin' || 
           user?.email === 'billy@pearsonline.nl' || 
           user?.email === 'billy@trooper.es' || 
           user?.email?.toLowerCase() === 'admin@onlyforward.nl';
  }, [appUser, user?.email]);

  useEffect(() => {
    if (!accountLoading && appUser && !isAdmin) {
      toast({ 
        variant: 'destructive', 
        title: 'Toegang Geweigerd', 
        description: 'Alleen beheerders kunnen accountinstellingen wijzigen.' 
      });
      router.push(`/dashboard/accounts/${accountId}?parent=${parentClientId}`);
    }
  }, [accountLoading, appUser, isAdmin, router, toast, accountId, parentClientId]);

  const form = useForm<ChildAccountFormData>({
    resolver: zodResolver(childAccountSchema),
    defaultValues: {
        nickname: '',
        googleAdsClientId: '',
        googleAdsAccountName: '',
        assignedEmployeeId: null,
        monthlyClickBudget: 0,
        primaryGoal: 'lead_generation',
        kpisToTrack: [],
        managementFee: {
            amount: 0,
            frequency: 'monthly'
        },
        targetKpiValues: [],
        isPaused: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "targetKpiValues",
  });
  
  const trackedKpis = form.watch('kpisToTrack');

  useEffect(() => {
    if (account) {
        const defaultData = {
            ...account,
            assignedEmployeeId: account.assignedEmployeeId || null,
            monthlyClickBudget: account.monthlyClickBudget || 0,
            managementFee: {
                amount: account.managementFee?.amount || 0,
                frequency: 'monthly' as const
            },
            targetKpiValues: account.targetKpiValues || [],
            isPaused: account.isPaused || false,
        };
      form.reset(defaultData);
    }
  }, [account, form]);

  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        try {
            const snap = await getDocs(collection(firestore, 'users'));
            const team = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as AppUser))
                .filter(u => u.role === 'employee');
            setEmployees(team);
        } catch (e) {
            console.error("Fout bij ophalen medewerkers:", e);
        }
    }
    fetchEmployees();
  }, [firestore]);

  async function onSubmit(data: ChildAccountFormData) {
    if (!accountDocRef) {
      console.error('Account doc reference not available');
      return;
    }
    setLoading(true);
    
    const dataToSave = {
        ...data,
        managementFee: {
            amount: Number(data.managementFee?.amount) || 0,
            frequency: 'monthly'
        },
        monthlyClickBudget: Number(data.monthlyClickBudget) || 0,
    };

    updateDoc(accountDocRef, dataToSave)
        .then(() => {
            toast({
                title: 'Account Updated',
                description: `${data.nickname} has been updated successfully.`,
            });
            router.push(`/dashboard/accounts/${accountId}?parent=${parentClientId}`);
        })
        .catch((e: any) => {
            console.error("Error updating document: ", e);
            const permissionError = new FirestorePermissionError({
                path: accountDocRef.path,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setLoading(false);
        });
  }
  
  if (accountLoading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin" /> Loading account data...</div>;
  }
  
  if (!account) {
    return <div>Account not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
        <div className="mb-6">
            <h1 className="font-headline text-3xl font-bold">Edit Google Ads Account</h1>
            <p className="text-muted-foreground">Update the details for {account.nickname}.</p>
        </div>
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <FormField
                        control={form.control}
                        name="nickname"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Account Nickname</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Digital Growth - Main Lead Gen" {...field} className="text-3xl font-headline font-bold p-0 border-0 shadow-none focus-visible:ring-0 !text-3xl" />
                            </FormControl>
                            <FormDescription>This is how you will internally identify this account.</FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Assignment Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium font-headline flex items-center gap-2">
                                <Users className="size-5" /> Toewijzing
                            </h3>
                            <Separator />
                            <FormField
                                control={form.control}
                                name="assignedEmployeeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Verantwoordelijke Medewerker</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecteer medewerker..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Niemand (Alleen Admin)</SelectItem>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.uid} value={emp.uid}>{emp.displayName || emp.email}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>Deze medewerker krijgt toegang tot dit account in hun FlowZone.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Section A */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium font-headline">Core Account Identification</h3>
                            <Separator />
                            <FormField
                                control={form.control}
                                name="googleAdsClientId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Google Ads Client ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123-456-7890" {...field} />
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
                                    <FormLabel>Google Ads Official Account Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="As seen in Google Ads" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                         <div className="space-y-4">
                            <h3 className="text-lg font-medium font-headline">Financials</h3>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="monthlyClickBudget"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Monthly Click Budget</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                                                <Input type="number" placeholder="1000.00" {...field} value={field.value ?? ''} className="pl-7" />
                                            </div>
                                        </FormControl>
                                        <FormDescription>The client's budget for ad clicks per month.</FormDescription>
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
                                            <FormLabel>Monthly Management Fee</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                                                    <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} className="pl-7" />
                                                </div>
                                            </FormControl>
                                            <FormDescription>Your fee for managing this account.</FormDescription>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </div>
                        
                        {/* Section C */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium font-headline">Performance Tracking &amp; Goal Setting</h3>
                            <Separator />
                            <FormField
                                control={form.control}
                                name="primaryGoal"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Account Goal</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a primary goal" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="lead_generation">Lead Generation</SelectItem>
                                                <SelectItem value="ecommerce_sales">E-commerce Sales</SelectItem>
                                                <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                                                <SelectItem value="app_installs">App Installs</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="kpisToTrack"
                                render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Key Performance Indicators (KPIs) to Track</FormLabel>
                                            <FormDescription>
                                            Select the metrics you want to track for this account.
                                            </FormDescription>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {kpiItems.map((item) => (
                                            <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="kpisToTrack"
                                            render={({ field }) => {
                                                return (
                                                <FormItem
                                                    key={item.id}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(item.id)}
                                                        onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...(field.value || []), item.id])
                                                            : field.onChange(
                                                                (field.value || [])?.filter(
                                                                (value) => value !== item.id
                                                                )
                                                            )
                                                        }}
                                                    />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                    {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                                )
                                            }}
                                            />
                                        ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-4">
                                <FormLabel>Monthly Key Results (Max 3)</FormLabel>
                                <FormDescription>Set specific targets for your most important KPIs.</FormDescription>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center p-4 border rounded-lg">
                                        <FormField
                                            control={form.control}
                                            name={`targetKpiValues.${index}.kpi`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select KPI..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {kpiItems.filter(kpi => trackedKpis?.includes(kpi.id)).map(kpi => (
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
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" placeholder="Set Target" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                            <Trash2 className="text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ kpi: '', target: 0 })}
                                    disabled={fields.length >= 3}
                                >
                                    <PlusCircle className="mr-2" />
                                    Add Key Result
                                </Button>
                                <FormMessage>{form.formState.errors.targetKpiValues?.message}</FormMessage>
                            </div>
                        </div>

                         <div className="space-y-4">
                            <h3 className="text-lg font-medium font-headline">Account Status</h3>
                            <Separator />
                             <FormField
                                control={form.control}
                                name="isPaused"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base flex items-center gap-2">
                                                <PauseCircle />
                                                Pause Account
                                            </FormLabel>
                                            <FormDescription>
                                                Paused accounts will be hidden from the dashboard and account overviews.
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
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    </div>
  );
}
