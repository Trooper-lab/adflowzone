'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateDoc, getDocs, collection, query, where, writeBatch, getDoc, doc } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import type { Service, ServicePackage } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, PlusCircle, Users, Activity, Target, Megaphone, Share2, Facebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ChildAccount, AppUser, ParentClient } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

const metaKpiItems = [
    { id: 'spend', label: 'Spend' },
    { id: 'reach', label: 'Reach' },
    { id: 'impressions', label: 'Impressions' },
    { id: 'frequency', label: 'Frequency' },
    { id: 'cpm', label: 'CPM' },
    { id: 'outbound_clicks', label: 'Outbound Clicks' },
    { id: 'ctr', label: 'Outbound CTR' },
    { id: 'cpc', label: 'CPC' },
    { id: 'leads', label: 'Leads' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'roas', label: 'ROAS' },
] as const;

const accountSettingsSchema = z.object({
    // General
    nickname: z.string().min(2, 'Nickname is required.'),
    parentClientId: z.string().min(1, 'Parent client is required.'),
    assignedEmployeeId: z.string().optional().nullable(),
    primaryGoal: z.enum(['lead_generation', 'ecommerce_sales', 'brand_awareness', 'app_installs', 'other']),
    isPaused: z.boolean().optional(),
    
    // Budgets & Main KPIs
    totalMonthlyBudget: z.coerce.number().min(0).optional(),
    kpisToTrack: z.array(z.string()).refine((val) => val.length > 0, { message: 'Kies minimaal 1 overkoepelende KPI.' }),
    targetKpiValues: z.array(z.object({
        kpi: z.string().min(1, "Select a KPI."),
        target: z.coerce.number().min(0, "Target must be positive."),
    })).max(3).optional(),
    fixedHours: z.coerce.number().min(0).optional(),
    connectedServices: z.array(z.object({
        serviceId: z.string().min(1, 'Select a service.'),
        serviceName: z.string(),
        hours: z.coerce.number().min(0).optional()
    })).optional(),
    connectedPackages: z.array(z.object({
        packageId: z.string().min(1, 'Select a package.'),
        packageName: z.string()
    })).optional(),

    // Google Ads
    googleAdsClientId: z.string().optional(),
    googleAdsAccountName: z.string().optional(),
    googleAdsBudget: z.coerce.number().min(0).optional(),
    googleAdsKpis: z.array(z.string()).optional(),
    googleAdsContext: z.string().optional(),

    // Meta Ads
    metaAdsAccountId: z.string().optional(),
    metaAdsAccountName: z.string().optional(),
    metaBusinessManagerId: z.string().optional(),
    metaPixelId: z.string().optional(),
    metaAdsBudget: z.coerce.number().min(0).optional(),
    metaAdsKpis: z.array(z.string()).optional(),
    metaAdsContext: z.string().optional(),
});

type AccountSettingsFormData = z.infer<typeof accountSettingsSchema>;

interface AccountSettingsProps {
    account: ChildAccount;
    accountDocRef: DocumentReference;
    isAdmin: boolean;
}

export default function AccountSettings({ account, accountDocRef, isAdmin }: AccountSettingsProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();
    const [employees, setEmployees] = useState<AppUser[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingData, setPendingData] = useState<AccountSettingsFormData | null>(null);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availablePackages, setAvailablePackages] = useState<ServicePackage[]>([]);

    const form = useForm<AccountSettingsFormData>({
        resolver: zodResolver(accountSettingsSchema),
        defaultValues: {
            nickname: account.nickname || '',
            parentClientId: account.parentClientId || '',
            assignedEmployeeId: account.assignedEmployeeId || null,
            primaryGoal: account.primaryGoal || 'lead_generation',
            isPaused: account.isPaused || false,
            totalMonthlyBudget: account.totalMonthlyBudget || account.monthlyClickBudget || 0,
            kpisToTrack: account.kpisToTrack || [],
            targetKpiValues: account.targetKpiValues || [],
            fixedHours: account.fixedHours || 0,
            connectedServices: account.connectedServices || [],
            connectedPackages: account.connectedPackages || [],
            googleAdsClientId: account.googleAdsClientId || '',
            googleAdsAccountName: account.googleAdsAccountName || '',
            googleAdsBudget: account.googleAdsBudget || 0,
            googleAdsKpis: account.googleAdsKpis || [],
            googleAdsContext: account.googleAdsContext || '',
            metaAdsAccountId: account.metaAdsAccountId || '',
            metaAdsAccountName: account.metaAdsAccountName || '',
            metaBusinessManagerId: account.metaBusinessManagerId || '',
            metaPixelId: account.metaPixelId || '',
            metaAdsBudget: account.metaAdsBudget || 0,
            metaAdsKpis: account.metaAdsKpis || [],
            metaAdsContext: account.metaAdsContext || '',
        },
    });

    const { fields: targetFields, append: appendTarget, remove: removeTarget } = useFieldArray({
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

    const trackedKpis = form.watch('kpisToTrack');
    const watchConnectedServices = form.watch('connectedServices');
    const watchConnectedPackages = form.watch('connectedPackages');

    // Automatically calculate fixed hours if services or packages are used
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
                console.error("Error fetching employees:", e);
            }
        }
        fetchEmployees();
    }, [firestore]);
    const [parentClients, setParentClients] = useState<ParentClient[]>([]);

    useEffect(() => {
        if (!firestore || !user?.uid || !isAdmin) return;
        const fetchPackagesServicesAndClients = async () => {
            try {
                const pkgSnap = await getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid)));
                setAvailablePackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServicePackage)));

                const svcSnap = await getDocs(query(collection(firestore, 'services'), where('ownerId', '==', user.uid)));
                setAvailableServices(svcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));

                const clientSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)));
                setParentClients(clientSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient)));
            } catch (e) {
                console.error("Error fetching packages/services/clients:", e);
            }
        };
        fetchPackagesServicesAndClients();
    }, [firestore, user, isAdmin]);

    const transferAccount = async (newParentId: string) => {
        if (!firestore || !user) return newParentId;
        const oldParentId = account.parentClientId;
        const accountId = account.id;

        const oldRef = doc(firestore, 'parentClients', oldParentId, 'childAccounts', accountId);
        const newRef = doc(firestore, 'parentClients', newParentId, 'childAccounts', accountId);

        const oldDoc = await getDoc(oldRef);
        if (!oldDoc.exists()) {
            throw new Error("Source child account does not exist");
        }
        const accountData = oldDoc.data();

        const updatedData = {
            ...accountData,
            parentClientId: newParentId,
            nickname: form.getValues('nickname'),
            assignedEmployeeId: form.getValues('assignedEmployeeId'),
            primaryGoal: form.getValues('primaryGoal'),
            isPaused: form.getValues('isPaused'),
            totalMonthlyBudget: form.getValues('totalMonthlyBudget'),
            kpisToTrack: form.getValues('kpisToTrack'),
            targetKpiValues: form.getValues('targetKpiValues') || [],
            fixedHours: form.getValues('fixedHours'),
            connectedServices: form.getValues('connectedServices') || [],
            connectedPackages: form.getValues('connectedPackages') || [],
            googleAdsClientId: form.getValues('googleAdsClientId'),
            googleAdsAccountName: form.getValues('googleAdsAccountName'),
            googleAdsBudget: form.getValues('googleAdsBudget'),
            googleAdsKpis: form.getValues('googleAdsKpis') || [],
            googleAdsContext: form.getValues('googleAdsContext'),
            metaAdsAccountId: form.getValues('metaAdsAccountId'),
            metaAdsAccountName: form.getValues('metaAdsAccountName'),
            metaBusinessManagerId: form.getValues('metaBusinessManagerId'),
            metaPixelId: form.getValues('metaPixelId'),
            metaAdsBudget: form.getValues('metaAdsBudget'),
            metaAdsKpis: form.getValues('metaAdsKpis') || [],
            metaAdsContext: form.getValues('metaAdsContext'),
            monthlyClickBudget: form.getValues('totalMonthlyBudget'),
        };

        const batch = writeBatch(firestore);
        batch.set(newRef, updatedData);
        batch.delete(oldRef);
        await batch.commit();

        // Update related collections:
        // A. checklistRuns
        const runsSnap = await getDocs(query(collection(firestore, 'checklistRuns'), where('childAccountId', '==', accountId)));
        const runsBatch = writeBatch(firestore);
        runsSnap.forEach((runDoc) => {
            runsBatch.update(doc(firestore, 'checklistRuns', runDoc.id), { parentClientId: newParentId });
        });
        if (!runsSnap.empty) await runsBatch.commit();

        // B. todos
        const todosSnap = await getDocs(query(collection(firestore, 'users', user.uid, 'todos'), where('childAccountId', '==', accountId)));
        const todosBatch = writeBatch(firestore);
        todosSnap.forEach((todoDoc) => {
            todosBatch.update(doc(firestore, 'users', user.uid, 'todos', todoDoc.id), { parentClientId: newParentId });
        });
        if (!todosSnap.empty) await todosBatch.commit();

        // C. reports
        const reportsSnap = await getDocs(query(collection(firestore, 'reports'), where('childAccountId', '==', accountId)));
        const reportsBatch = writeBatch(firestore);
        reportsSnap.forEach((reportDoc) => {
            reportsBatch.update(doc(firestore, 'reports', reportDoc.id), { parentClientId: newParentId });
        });
        if (!reportsSnap.empty) await reportsBatch.commit();

        // D. projects
        const projectsSnap = await getDocs(query(collection(firestore, 'projects'), where('childAccountId', '==', accountId)));
        const projectsBatch = writeBatch(firestore);
        projectsSnap.forEach((projectDoc) => {
            projectsBatch.update(doc(firestore, 'projects', projectDoc.id), { parentClientId: newParentId });
        });
        if (!projectsSnap.empty) await projectsBatch.commit();

        // E. timeEntries
        const timeSnap = await getDocs(query(collection(firestore, 'timeEntries'), where('childAccountId', '==', accountId)));
        const timeBatch = writeBatch(firestore);
        timeSnap.forEach((timeDoc) => {
            timeBatch.update(doc(firestore, 'timeEntries', timeDoc.id), { parentClientId: newParentId });
        });
        if (!timeSnap.empty) await timeBatch.commit();
        
        return newParentId;
    };

    const onInvalid = (errors: any) => {
        console.error("Form validation errors:", errors);
        toast({
            variant: 'destructive',
            title: 'Fout bij opslaan',
            description: 'Vul alle verplichte velden correct in.',
        });
    };

    const handleConfirmTransfer = async () => {
        if (!pendingData) return;
        setIsConfirmOpen(false);
        setIsSaving(true);
        try {
            const newParentId = await transferAccount(pendingData.parentClientId);
            toast({
                title: 'Overgezet',
                description: 'Het account is succesvol overgezet naar de nieuwe klant.',
            });
            router.push(`/dashboard/accounts/${account.id}?parent=${newParentId}`);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij overzetten', description: 'Kon het account niet overzetten.' });
        } finally {
            setIsSaving(false);
            setPendingData(null);
        }
    };

    async function onSubmit(data: AccountSettingsFormData) {
        console.log("onSubmit called. data.parentClientId:", data.parentClientId, "account.parentClientId:", account.parentClientId);
        const hasParentChanged = data.parentClientId !== account.parentClientId;
        console.log("hasParentChanged:", hasParentChanged);
        if (hasParentChanged) {
            setPendingData(data);
            setIsConfirmOpen(true);
        } else {
            setIsSaving(true);
            try {
                await updateDoc(accountDocRef, {
                    ...data,
                    // Ensure legacy field is kept in sync if needed
                    monthlyClickBudget: data.totalMonthlyBudget,
                });
                toast({
                    title: 'Opgeslagen',
                    description: 'Advertising setup is succesvol bijgewerkt.',
                });
            } catch (e: any) {
                console.error("Error updating document: ", e);
                toast({
                    variant: 'destructive',
                    title: 'Fout bij opslaan',
                    description: 'De wijzigingen konden niet worden opgeslagen.',
                });
                const permissionError = new FirestorePermissionError({
                    path: accountDocRef.path,
                    operation: 'update',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
            } finally {
                setIsSaving(false);
            }
        }
    }
    if (!isAdmin) {
        return (
            <div className="rounded-xl border border-dashed border-[#2A3552] p-10 flex flex-col items-center justify-center text-center">
                <Target className="size-10 text-slate-600 mb-3" />
                <p className="text-slate-300 font-medium">Toegang Geweigerd</p>
                <p className="text-sm text-slate-500 mt-1 max-w-md">Alleen beheerders kunnen de Advertising Setup aanpassen.</p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                
                {/* 1. Algemene Strategie & Toewijzing */}
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="border-b border-[#2A3552]">
                        <CardTitle className="text-white flex items-center gap-2"><Target className="size-5 text-blue-400" /> Algemene Strategie</CardTitle>
                        <CardDescription className="text-slate-400">Overkoepelende afspraken voor dit account.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="nickname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">Account Nickname</FormLabel>
                                        <FormControl>
                                            <Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="Bijv. Jansen B.V. - E-commerce" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="assignedEmployeeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300 flex items-center gap-2">Toewijzing <Users className="size-3 text-slate-500" /></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                                            <FormControl>
                                                <SelectTrigger className="bg-[#0F1423] border-[#2A3552] text-white">
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="primaryGoal"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">Primair Doel</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-[#0F1423] border-[#2A3552] text-white">
                                                    <SelectValue placeholder="Selecteer hoofddoel" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="lead_generation">Lead Generation</SelectItem>
                                                <SelectItem value="ecommerce_sales">E-commerce Sales</SelectItem>
                                                <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                                                <SelectItem value="app_installs">App Installs</SelectItem>
                                                <SelectItem value="other">Overig</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                             />

                            <FormField
                                control={form.control}
                                name="isPaused"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[#2A3552] bg-[#0F1423] p-3">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-slate-300 font-medium">Account Pauzeren</FormLabel>
                                            <FormDescription className="text-[10px]">Verbergt dit account tijdelijk.</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="parentClientId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">Klant (Parent Client)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-[#0F1423] border-[#2A3552] text-white">
                                                    <SelectValue placeholder="Selecteer klant..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {parentClients.map(client => (
                                                    <SelectItem key={client.id} value={client.id}>{client.clientName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs text-slate-400">
                                            Zet dit account over naar een andere parent client.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Budgetten & Hero KPI's */}
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="border-b border-[#2A3552]">
                        <CardTitle className="text-white flex items-center gap-2"><Activity className="size-5 text-emerald-400" /> Financiën & Hero KPI's</CardTitle>
                        <CardDescription className="text-slate-400">Het overkoepelende budget en de belangrijkste (max 3) targets voor dit dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="totalMonthlyBudget"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">Totaal Maandelijks Klikbudget</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">€</span>
                                                <Input type="number" className="bg-[#0F1423] border-[#2A3552] text-white pl-7" placeholder="Totaal over alle platformen" {...field} value={field.value ?? ''} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4 border-t border-[#2A3552] pt-4">
                            <FormField
                                control={form.control}
                                name="kpisToTrack"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300">Hoofd KPI's voor Dashboard</FormLabel>
                                        <FormDescription className="text-slate-400 text-xs">Welke metrics bepalen het totale succes?</FormDescription>
                                        <div className="flex flex-wrap gap-3 mt-2">
                                        {kpiItems.map((item) => (
                                            <FormField
                                                key={item.id}
                                                control={form.control}
                                                name="kpisToTrack"
                                                render={({ field }) => (
                                                    <FormItem key={item.id} className="flex flex-row items-start space-x-2 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                className="border-[#2A3552] data-[state=checked]:bg-emerald-500"
                                                                checked={field.value?.includes(item.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked ? field.onChange([...(field.value || []), item.id]) : field.onChange((field.value || [])?.filter((val) => val !== item.id))
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal text-slate-300 text-xs">{item.label}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <div className="space-y-3 pt-4">
                                <FormLabel className="text-slate-300">Maandelijkse KPI Targets (Max 3)</FormLabel>
                                {targetFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2 p-3 border border-[#2A3552] bg-[#0F1423] rounded-lg">
                                        <FormField
                                            control={form.control}
                                            name={`targetKpiValues.${index}.kpi`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-[#1C243A] border-[#2A3552] text-white h-8"><SelectValue placeholder="Select KPI..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {kpiItems.filter(kpi => trackedKpis?.includes(kpi.id)).map(kpi => (
                                                                <SelectItem key={kpi.id} value={kpi.id}>{kpi.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`targetKpiValues.${index}.target`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input type="number" className="bg-[#1C243A] border-[#2A3552] text-white h-8" placeholder="Target" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => removeTarget(index)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                                {targetFields.length < 3 && (
                                    <Button type="button" variant="outline" size="sm" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" onClick={() => appendTarget({ kpi: '', target: 0 })}>
                                        <PlusCircle className="mr-2 size-4" /> Voeg Target Toe
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Google Ads Setup */}
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="border-b border-[#2A3552]">
                        <CardTitle className="text-white flex items-center gap-2"><Megaphone className="size-5 text-blue-400" /> Google Ads Setup</CardTitle>
                        <CardDescription className="text-slate-400">Specifieke instellingen en sturing voor Google Ads.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="googleAdsClientId" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Client ID</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="123-456-7890" {...field} /></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="googleAdsAccountName" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Account Naam</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="Officiële naam" {...field} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name="googleAdsBudget" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Kanaal Budget per maand</FormLabel><FormControl>
                                <div className="relative w-1/2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">€</span>
                                    <Input type="number" className="bg-[#0F1423] border-[#2A3552] text-white pl-7" placeholder="Budget voor Google Ads" {...field} value={field.value ?? ''} />
                                </div>
                            </FormControl></FormItem>
                        )}/>
                        <FormField control={form.control} name="googleAdsKpis" render={() => (
                            <FormItem><FormLabel className="text-slate-300">Google Ads KPI's</FormLabel>
                                <div className="flex flex-wrap gap-3 mt-2">
                                    {kpiItems.map((item) => (
                                        <FormField key={item.id} control={form.control} name="googleAdsKpis" render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                                                <FormControl>
                                                    <Checkbox className="border-[#2A3552] data-[state=checked]:bg-blue-500" checked={field.value?.includes(item.id)}
                                                        onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange((field.value || [])?.filter((val) => val !== item.id))}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal text-slate-300 text-xs">{item.label}</FormLabel>
                                            </FormItem>
                                        )} />
                                    ))}
                                </div>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="googleAdsContext" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Briefing & Targeting Notities (Google Ads)</FormLabel><FormControl>
                                <Textarea className="bg-[#0F1423] border-[#2A3552] text-white h-24" placeholder="Bijv. Uitsluitend B2B zoekwoorden, geen display netwerk..." {...field} />
                            </FormControl></FormItem>
                        )}/>
                    </CardContent>
                </Card>

                {/* 4. Meta Ads Setup */}
                <Card className="bg-[#1C243A] border-[#2A3552]">
                    <CardHeader className="border-b border-[#2A3552]">
                        <CardTitle className="text-white flex items-center gap-2"><Facebook className="size-5 text-indigo-400" /> Meta (Facebook/Insta) Ads Setup</CardTitle>
                        <CardDescription className="text-slate-400">Specifieke instellingen en sturing voor Meta advertising.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="metaBusinessManagerId" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Business Manager ID</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="ID" {...field} /></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="metaPixelId" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Pixel / Dataset ID</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="Pixel ID" {...field} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="metaAdsAccountId" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Ad Account ID</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="ID" {...field} /></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="metaAdsAccountName" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Account Naam</FormLabel><FormControl><Input className="bg-[#0F1423] border-[#2A3552] text-white" placeholder="Naam in BM" {...field} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name="metaAdsBudget" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Kanaal Budget per maand</FormLabel><FormControl>
                                <div className="relative w-1/2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">€</span>
                                    <Input type="number" className="bg-[#0F1423] border-[#2A3552] text-white pl-7" placeholder="Budget voor Meta" {...field} value={field.value ?? ''} />
                                </div>
                            </FormControl></FormItem>
                        )}/>
                        <FormField control={form.control} name="metaAdsKpis" render={() => (
                            <FormItem><FormLabel className="text-slate-300">Meta Ads KPI's</FormLabel>
                                <div className="flex flex-wrap gap-3 mt-2">
                                    {metaKpiItems.map((item) => (
                                        <FormField key={item.id} control={form.control} name="metaAdsKpis" render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                                                <FormControl>
                                                    <Checkbox className="border-[#2A3552] data-[state=checked]:bg-indigo-500" checked={field.value?.includes(item.id)}
                                                        onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange((field.value || [])?.filter((val) => val !== item.id))}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal text-slate-300 text-xs">{item.label}</FormLabel>
                                            </FormItem>
                                        )} />
                                    ))}
                                </div>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="metaAdsContext" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Briefing & Targeting Notities (Meta)</FormLabel><FormControl>
                                <Textarea className="bg-[#0F1423] border-[#2A3552] text-white h-24" placeholder="Bijv. Focus op lookalikes kopers 180d, uitsluitend mobiel..." {...field} />
                            </FormControl></FormItem>
                        )}/>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4 mt-8 pb-10">
                    <Button 
                        type="submit" 
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold" 
                        disabled={isSaving}
                        onClick={() => {
                            console.log("Button clicked! Form values:", form.getValues());
                            console.log("Form State Errors:", form.formState.errors);
                            console.log("account object:", account);
                        }}
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
                    </Button>
                </div>

                <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <AlertDialogContent className="glass-card-elevated border-white/5 bg-[#1C243A] text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Account overzetten?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-300 font-medium">
                                Weet je zeker dat je dit account wilt overzetten naar een andere klant? Alle gekoppelde uren, checklist runs en rapportages worden mee verhuisd.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setPendingData(null)}>Annuleren</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmTransfer} className="bg-blue-600 hover:bg-blue-500 text-white">Overzetten</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </form>
        </Form>
    );
}
