'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { addDoc, collection, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday, setDay, addWeeks, setDate, addMonths } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { ConnectedChecklist, ChecklistTemplate, ParentClient, Service, ServicePackage } from '@/lib/types';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

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

const connectedChecklistSchema = z.object({
    checklistId: z.string().min(1, 'Please select a checklist'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'one-off']),
    startDate: z.date().optional(),
    dayOfWeek: z.string().optional(),
    dayOfMonth: z.string().optional(),
});


const childAccountSchema = z.object({
    nickname: z.string().min(2, 'Nickname is required.'),
    googleAdsClientId: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Invalid Client ID format (e.g., 123-456-7890).'),
    googleAdsAccountName: z.string().min(2, 'Official account name is required.'),
    fixedHours: z.coerce.number().min(0, 'Hours must be a positive number.').optional(),
    monthlyClickBudget: z.coerce.number().min(0, 'Budget must be a positive number.').optional(),
    primaryGoal: z.enum(['lead_generation', 'ecommerce_sales', 'brand_awareness', 'app_installs', 'other']),
    kpisToTrack: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: 'You have to select at least one KPI to track.',
    }),
    connectedChecklists: z.array(connectedChecklistSchema).optional(),
    targetKpiValues: z.array(z.object({
        kpi: z.string().min(1, "Please select a KPI."),
        target: z.coerce.number().min(0, "Target must be a positive number."),
    })).max(3, "You can set a maximum of 3 key results.").optional(),
    connectedServices: z.array(z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        hours: z.coerce.number().min(0.1, "Minimaal 0.1 uur"),
    })).optional(),
    connectedPackages: z.array(z.object({
        packageId: z.string(),
        packageName: z.string(),
    })).optional(),
});

type ChildAccountFormData = z.infer<typeof childAccountSchema>;


export function AddChildAccountForm({ parentClient }: { parentClient: ParentClient }) {
    const [loading, setLoading] = useState(false);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    // The ownerId of the parentClient is the manager's UID
    const managerUid = parentClient.ownerId; 
    
    const checklistsQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'users', managerUid, 'checklistTemplates'));
    }, [firestore, managerUid]);
    const { data: checklistTemplates, loading: checklistsLoading } = useCollection(checklistsQuery);

    const servicesQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'services'), where('ownerId', '==', managerUid));
    }, [firestore, managerUid]);
    const { data: servicesData } = useCollection(servicesQuery);
    const availableServices = React.useMemo(() => {
        if (!servicesData) return [];
        return servicesData.map(d => ({ id: d.id, ...d.data() } as Service));
    }, [servicesData]);

    const packagesQuery = useMemoFirebase(() => {
        if (!firestore || !managerUid) return null;
        return query(collection(firestore, 'servicePackages'), where('ownerId', '==', managerUid));
    }, [firestore, managerUid]);
    const { data: packagesData } = useCollection(packagesQuery);
    const availablePackages = React.useMemo(() => {
        if (!packagesData) return [];
        return packagesData.map(d => ({ id: d.id, ...d.data() } as ServicePackage));
    }, [packagesData]);


    const form = useForm<ChildAccountFormData>({
        resolver: zodResolver(childAccountSchema),
        defaultValues: {
            nickname: '',
            googleAdsClientId: '',
            googleAdsAccountName: '',
            fixedHours: 0,
            monthlyClickBudget: 0,
            primaryGoal: 'lead_generation',
            kpisToTrack: [],
            connectedChecklists: [],
            targetKpiValues: [],
            connectedServices: [],
            connectedPackages: [],
        },
    });

    const { fields: checklistFields, append: appendChecklist, remove: removeChecklist } = useFieldArray({
        control: form.control,
        name: "connectedChecklists",
    });

    const { fields: keyResultFields, append: appendKeyResult, remove: removeKeyResult } = useFieldArray({
        control: form.control,
        name: "targetKpiValues",
    });

    const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
        control: form.control,
        name: "connectedServices",
    });

    const { fields: packageFields, append: appendPackage, remove: removePackage } = useFieldArray({
        control: form.control,
        name: "connectedPackages",
    });

    const connectedChecklistsValues = form.watch('connectedChecklists');
    const trackedKpis = form.watch('kpisToTrack');
    const watchConnectedServices = form.watch('connectedServices');
    const watchConnectedPackages = form.watch('connectedPackages');

    React.useEffect(() => {
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

    function handleReset() {
        form.reset();
        toast({
            title: 'Form Cleared',
            description: 'You can now add another Google Ads account.',
        });
    }

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
    }


    async function onSubmit(data: ChildAccountFormData) {
        if (!firestore || !managerUid) {
            console.error('Firestore or manager UID not available');
            return;
        }
        setLoading(true);

        const processedChecklists = data.connectedChecklists?.map(c => {
             let finalStartDate: Date | undefined = c.startDate;
             if (c.frequency === 'weekly' || c.frequency === 'monthly') {
                 finalStartDate = getNextDate(c.frequency, c.dayOfWeek || c.dayOfMonth);
             }
             if (!finalStartDate) {
                 finalStartDate = new Date(); // Fallback to today
             }
             return {
                checklistId: c.checklistId,
                frequency: c.frequency,
                startDate: finalStartDate.toISOString(),
            };
        });

        const childAccountData = {
            ...data,
            ownerId: managerUid, // The manager owns the account
            parentClientId: parentClient.id,
            fixedHours: Number(data.fixedHours) || 0,
            monthlyClickBudget: Number(data.monthlyClickBudget) || 0,
            connectedChecklists: processedChecklists,
            connectedServices: data.connectedServices || [],
            connectedPackages: data.connectedPackages || [],
        };

        const childAccountsCollection = collection(firestore, 'parentClients', parentClient.id, 'childAccounts');

        addDoc(childAccountsCollection, childAccountData)
            .then((docRef) => {
                toast({
                    title: 'Google Ads Account Saved',
                    description: `${data.nickname} has been added successfully.`,
                });
                router.push(`/portal/${parentClient.id}`);
            })
            .catch((e: any) => {
                console.error("Error adding child account document: ", e);
                 const permissionError = new FirestorePermissionError({
                    path: childAccountsCollection.path,
                    operation: 'create',
                    requestResourceData: childAccountData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setLoading(false);
            });
    }

  return (
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
                                <FormField
                                    control={form.control}
                                    name="fixedHours"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Vaste Uren per Maand</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.5" placeholder="5" {...field} value={field.value ?? ''} disabled={watchConnectedServices && watchConnectedServices.length > 0} />
                                        </FormControl>
                                        <FormDescription>
                                            {watchConnectedServices && watchConnectedServices.length > 0 
                                                ? "Wordt automatisch berekend o.b.v. gekoppelde diensten." 
                                                : "Het aantal vaste beheeruren per maand."}
                                        </FormDescription>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            
                            {/* Connected Services Section */}
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Gekoppelde Diensten & Uren</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Koppel diensten om de vaste uren op de factuur uit te splitsen.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => appendService({ serviceId: '', serviceName: '', hours: 0 })}
                                    >
                                        <PlusCircle className="size-4 mr-2" /> Dienst Toevoegen
                                    </Button>
                                </div>
                                
                                {serviceFields.length > 0 && (
                                    <div className="space-y-3">
                                        {serviceFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-[1fr_120px_auto] gap-3 items-start p-4 border border-[#2A3552] bg-black/10 rounded-lg">
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
                                                                defaultValue={selectField.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="bg-[#1C243A]"><SelectValue placeholder="Kies een dienst..." /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
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
                                                                    <Input type="number" step="0.1" placeholder="Uren" {...inputField} className="pr-10 bg-[#1C243A]" />
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

                            {/* Connected Packages Section */}
                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Gekoppelde Pakketten</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Koppel een pakket om diensten te bundelen.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => appendPackage({ packageId: '', packageName: '' })}
                                    >
                                        <PlusCircle className="size-4 mr-2" /> Pakket Toevoegen
                                    </Button>
                                </div>
                                
                                {packageFields.length > 0 && (
                                    <div className="space-y-3">
                                        {packageFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-[1fr_auto] gap-3 items-start p-4 border border-[#2A3552] bg-blue-500/5 rounded-lg">
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
                                                                defaultValue={selectField.value}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="bg-[#1C243A]"><SelectValue placeholder="Kies een pakket..." /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
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
                            {keyResultFields.map((field, index) => (
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
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyResult(index)}>
                                        <Trash2 className="text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => appendKeyResult({ kpi: '', target: 0 })}
                                disabled={keyResultFields.length >= 3}
                            >
                                <PlusCircle className="mr-2" />
                                Add Key Result
                            </Button>
                             <FormMessage>{form.formState.errors.targetKpiValues?.message}</FormMessage>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium font-headline">Checklist Setup</h3>
                        <Separator />
                         <FormDescription>Connect recurring checklists to this account upon creation.</FormDescription>
                        
                        <div className="space-y-4">
                             {checklistFields.map((field, index) => {
                                const frequency = connectedChecklistsValues?.[index]?.frequency;
                                return (
                                 <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end p-4 border rounded-lg">
                                     <FormField
                                        control={form.control}
                                        name={`connectedChecklists.${index}.checklistId`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Checklist</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                          <SelectValue placeholder={checklistsLoading ? "Loading..." : "Select..."} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {checklistTemplates?.map((c: ChecklistTemplate) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                                            <FormItem>
                                                <FormLabel>Frequency</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="one-off">One-off</SelectItem>
                                                        <SelectItem value="daily">Daily</SelectItem>
                                                        <SelectItem value="weekly">Weekly</SelectItem>
                                                        <SelectItem value="monthly">Monthly</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    
                                     { (frequency === 'daily' || frequency === 'one-off') && (
                                        <FormField
                                            control={form.control}
                                            name={`connectedChecklists.${index}.startDate`}
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Start Date</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button
                                                                variant={"outline"}
                                                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                                                >
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
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

                                    { frequency === 'weekly' && (
                                        <FormField
                                            control={form.control}
                                            name={`connectedChecklists.${index}.dayOfWeek`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Day of Week</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="1">Monday</SelectItem>
                                                            <SelectItem value="2">Tuesday</SelectItem>
                                                            <SelectItem value="3">Wednesday</SelectItem>
                                                            <SelectItem value="4">Thursday</SelectItem>
                                                            <SelectItem value="5">Friday</SelectItem>
                                                            <SelectItem value="6">Saturday</SelectItem>
                                                            <SelectItem value="0">Sunday</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                     { frequency === 'monthly' && (
                                         <FormField
                                            control={form.control}
                                            name={`connectedChecklists.${index}.dayOfMonth`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Day of Month</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                             {Array.from({length: 28}, (_, i) => i + 1).map(day => (
                                                                <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    {/* Spacer for grid layout when conditional fields are not shown */}
                                    {!(frequency === 'daily' || frequency === 'one-off' || frequency === 'weekly' || frequency === 'monthly') && <div />}

                                     <Button type="button" variant="ghost" size="icon" onClick={() => removeChecklist(index)}>
                                        <Trash2 className="text-destructive"/>
                                     </Button>
                                 </div>
                                );
                             })}
                             <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => appendChecklist({ checklistId: '', frequency: 'weekly', startDate: new Date() })}
                            >
                                <PlusCircle className="mr-2"/>
                                Add Checklist
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Account
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/portal/${parentClient.id}`)}>Cancel</Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
