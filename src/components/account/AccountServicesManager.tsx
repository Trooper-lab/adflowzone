'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateDoc, getDocs, collection, query, where, DocumentReference } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { ChildAccount, Service, ServicePackage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, PlusCircle, Package, Briefcase, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const servicesSchema = z.object({
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
});

type ServicesFormData = z.infer<typeof servicesSchema>;

interface AccountServicesManagerProps {
    account: ChildAccount;
    accountDocRef: DocumentReference;
    isAdmin: boolean;
}

export default function AccountServicesManager({ account, accountDocRef, isAdmin }: AccountServicesManagerProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availablePackages, setAvailablePackages] = useState<ServicePackage[]>([]);

    const form = useForm<ServicesFormData>({
        resolver: zodResolver(servicesSchema),
        defaultValues: {
            fixedHours: account.fixedHours || 0,
            connectedServices: account.connectedServices || [],
            connectedPackages: account.connectedPackages || [],
        },
    });

    const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
        control: form.control,
        name: "connectedServices",
    });

    const { fields: packageFields, append: appendPackage, remove: removePackage } = useFieldArray({
        control: form.control,
        name: "connectedPackages",
    });

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
        if (!firestore || !user?.uid || !isAdmin) return;
        const fetchPackagesAndServices = async () => {
            try {
                const pkgSnap = await getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid)));
                setAvailablePackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServicePackage)));

                const svcSnap = await getDocs(query(collection(firestore, 'services'), where('ownerId', '==', user.uid)));
                setAvailableServices(svcSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
            } catch (e) {
                console.error("Error fetching packages/services:", e);
            }
        };
        fetchPackagesAndServices();
    }, [firestore, user, isAdmin]);

    async function onSubmit(data: ServicesFormData) {
        setIsSaving(true);
        try {
            await updateDoc(accountDocRef, {
                fixedHours: data.fixedHours || 0,
                connectedServices: data.connectedServices || [],
                connectedPackages: data.connectedPackages || [],
            });
            toast({
                title: 'Diensten Opgeslagen',
                description: 'De diensten en pakketten zijn succesvol bijgewerkt.',
            });
        } catch (e: any) {
            console.error("Error updating document: ", e);
            toast({
                title: 'Fout bij opslaan',
                description: e.message || 'Er is een onverwachte fout opgetreden.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    }

    if (!isAdmin) {
        return (
            <div className="rounded-xl border border-dashed border-[#2A3552] p-10 flex flex-col items-center justify-center text-center">
                <Package className="size-10 text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-300">Diensten en Pakketten</h3>
                <p className="text-slate-500 max-w-sm mt-2 text-sm">Alleen beheerders kunnen diensten en pakketten koppelen.</p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                        <Card className="bg-[#0A0D17] border-white/5 shadow-2xl">
                            <CardHeader className="border-b border-white/5 pb-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                                        <Package className="size-5 text-emerald-400" /> Gekoppelde Pakketten
                                    </CardTitle>
                                    <p className="text-sm text-slate-400 mt-1">Koppel een kant-en-klaar pakket om diensten te bundelen.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendPackage({ packageId: '', packageName: '' })} className="bg-[#0F1423] border-[#2A3552] text-white">
                                    <PlusCircle className="size-4 mr-2" /> Pakket Toevoegen
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {packageFields.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic text-center py-4">Nog geen pakketten gekoppeld.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {packageFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-[1fr_auto] gap-3 items-start p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
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
                                                                    <SelectTrigger className="bg-[#1C243A] border-[#2A3552] text-white"><SelectValue placeholder="Kies een pakket..." /></SelectTrigger>
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
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removePackage(index)} className="hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                    <Trash2 className="size-4 text-red-400" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-[#0A0D17] border-white/5 shadow-2xl">
                            <CardHeader className="border-b border-white/5 pb-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                                        <Briefcase className="size-5 text-blue-400" /> Gekoppelde Diensten
                                    </CardTitle>
                                    <p className="text-sm text-slate-400 mt-1">Koppel diensten om de vaste uren op de factuur uit te splitsen.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendService({ serviceId: '', serviceName: '', hours: 0 })} className="bg-[#0F1423] border-[#2A3552] text-white">
                                    <PlusCircle className="size-4 mr-2" /> Dienst Toevoegen
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {serviceFields.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic text-center py-4">Nog geen losse diensten gekoppeld.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {serviceFields.map((field, index) => (
                                            <div key={field.id} className="grid grid-cols-[1fr_120px_auto] gap-3 items-start p-4 border border-[#2A3552] bg-[#0F1423] rounded-lg">
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
                                                                    <SelectTrigger className="bg-[#1C243A] border-[#2A3552] text-white"><SelectValue placeholder="Kies een dienst..." /></SelectTrigger>
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
                                                                    <Input type="number" step="0.1" placeholder="Uren" {...inputField} className="pr-10 bg-[#1C243A] border-[#2A3552] text-white font-mono" />
                                                                    <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 font-bold">uur</span>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)} className="hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                    <Trash2 className="size-4 text-red-400" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                </div>
                
                <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8">
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bezig met opslaan...</> : <><Save className="mr-2 h-4 w-4" /> Wijzigingen Opslaan</>}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
