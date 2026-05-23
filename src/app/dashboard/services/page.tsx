'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Briefcase, PlusCircle, Trash2, Edit2, CheckCircle2, Package, ListPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Service, ServicePackage } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function ServicesManagementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(true);
    const [services, setServices] = useState<Service[]>([]);
    const [packages, setPackages] = useState<ServicePackage[]>([]);
    
    const [activeTab, setActiveTab] = useState('services');

    // Forms state
    const [isAddingService, setIsAddingService] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
    const [serviceForm, setServiceForm] = useState({ name: '', description: '', baseHours: '', onboardingFee: '', deliverables: '' });

    const [isAddingPackage, setIsAddingPackage] = useState(false);
    const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
    const [packageForm, setPackageForm] = useState({ name: '', description: '', packageDiscount: '' });
    const [packageServices, setPackageServices] = useState<{serviceId: string, serviceName: string, hours: number}[]>([]);

    const fetchData = async () => {
        if (!firestore || !user) return;
        setLoading(true);
        try {
            const [srvSnap, pkgSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'services'), where('ownerId', '==', user.uid))),
                getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid)))
            ]);
            
            setServices(srvSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)).sort((a, b) => a.name.localeCompare(b.name)));
            setPackages(pkgSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServicePackage)).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij ophalen gegevens' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [firestore, user]);

    // ---- SERVICE HANDLERS ----

    const handleSaveService = async () => {
        if (!firestore || !user) return;
        if (!serviceForm.name.trim()) {
            toast({ variant: 'destructive', title: 'Vul een naam in' });
            return;
        }

        const deliverablesArray = serviceForm.deliverables
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0);

        const dataToSave = {
            ownerId: user.uid,
            name: serviceForm.name,
            description: serviceForm.description,
            baseHours: serviceForm.baseHours ? Number(serviceForm.baseHours) : 0,
            onboardingFee: serviceForm.onboardingFee ? Number(serviceForm.onboardingFee) : 0,
            deliverables: deliverablesArray
        };

        try {
            if (editingServiceId) {
                await updateDoc(doc(firestore, 'services', editingServiceId), dataToSave);
                toast({ title: 'Dienst bijgewerkt' });
            } else {
                await addDoc(collection(firestore, 'services'), dataToSave);
                toast({ title: 'Dienst toegevoegd' });
            }
            
            cancelServiceEdit();
            fetchData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan' });
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!firestore) return;
        if (!confirm('Weet je zeker dat je deze dienst wilt verwijderen?')) return;
        try {
            await deleteDoc(doc(firestore, 'services', id));
            toast({ title: 'Dienst verwijderd' });
            fetchData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
        }
    };

    const startEditService = (s: Service) => {
        setServiceForm({
            name: s.name,
            description: s.description || '',
            baseHours: s.baseHours ? s.baseHours.toString() : '',
            onboardingFee: s.onboardingFee ? s.onboardingFee.toString() : '',
            deliverables: s.deliverables ? s.deliverables.join('\n') : ''
        });
        setEditingServiceId(s.id);
        setIsAddingService(true);
    };

    const cancelServiceEdit = () => {
        setServiceForm({ name: '', description: '', baseHours: '', onboardingFee: '', deliverables: '' });
        setEditingServiceId(null);
        setIsAddingService(false);
    };

    // ---- PACKAGE HANDLERS ----

    const handleSavePackage = async () => {
        if (!firestore || !user) return;
        if (!packageForm.name.trim()) {
            toast({ variant: 'destructive', title: 'Vul een naam in' });
            return;
        }
        if (packageServices.length === 0) {
            toast({ variant: 'destructive', title: 'Selecteer minimaal 1 dienst' });
            return;
        }

        const dataToSave = {
            ownerId: user.uid,
            name: packageForm.name,
            description: packageForm.description,
            packageDiscount: packageForm.packageDiscount ? Number(packageForm.packageDiscount) : 0,
            services: packageServices
        };

        try {
            if (editingPackageId) {
                await updateDoc(doc(firestore, 'servicePackages', editingPackageId), dataToSave);
                toast({ title: 'Pakket bijgewerkt' });
            } else {
                await addDoc(collection(firestore, 'servicePackages'), dataToSave);
                toast({ title: 'Pakket toegevoegd' });
            }
            
            cancelPackageEdit();
            fetchData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan' });
        }
    };

    const handleDeletePackage = async (id: string) => {
        if (!firestore) return;
        if (!confirm('Weet je zeker dat je dit pakket wilt verwijderen?')) return;
        try {
            await deleteDoc(doc(firestore, 'servicePackages', id));
            toast({ title: 'Pakket verwijderd' });
            fetchData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
        }
    };

    const startEditPackage = (p: ServicePackage) => {
        setPackageForm({
            name: p.name,
            description: p.description || '',
            packageDiscount: p.packageDiscount ? p.packageDiscount.toString() : ''
        });
        setPackageServices(p.services || []);
        setEditingPackageId(p.id);
        setIsAddingPackage(true);
    };

    const cancelPackageEdit = () => {
        setPackageForm({ name: '', description: '', packageDiscount: '' });
        setPackageServices([]);
        setEditingPackageId(null);
        setIsAddingPackage(false);
    };

    const togglePackageService = (service: Service) => {
        const existing = packageServices.find(s => s.serviceId === service.id);
        if (existing) {
            setPackageServices(packageServices.filter(s => s.serviceId !== service.id));
        } else {
            setPackageServices([...packageServices, { serviceId: service.id, serviceName: service.name, hours: service.baseHours || 0 }]);
        }
    };

    const updatePackageServiceHours = (serviceId: string, hours: number) => {
        setPackageServices(packageServices.map(s => s.serviceId === serviceId ? { ...s, hours } : s));
    };

    if (loading && services.length === 0 && packages.length === 0) {
        return <div className="flex justify-center py-40"><Loader2 className="animate-spin size-12 text-blue-500" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <Package className="text-blue-400 size-8" />
                        Producten & Diensten
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Beheer je losse diensten en bundel ze in pakketten voor een schaalbaar aanbod.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-[#1C243A] border border-[#2A3552] mb-6 w-full justify-start overflow-x-auto h-auto p-1">
                    <TabsTrigger value="services" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2.5 px-6">
                        <Briefcase className="size-4 mr-2" /> Losse Diensten ({services.length})
                    </TabsTrigger>
                    <TabsTrigger value="packages" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2.5 px-6">
                        <Package className="size-4 mr-2" /> Dienstenpakketten ({packages.length})
                    </TabsTrigger>
                </TabsList>

                {/* --- SERVICES TAB --- */}
                <TabsContent value="services" className="space-y-6">
                    <div className="flex justify-end">
                        {!isAddingService && (
                            <Button onClick={() => setIsAddingService(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
                                <PlusCircle className="size-4 mr-2" /> Nieuwe Dienst
                            </Button>
                        )}
                    </div>

                    {isAddingService && (
                        <Card className="bg-[#1C243A] border-blue-500/50 shadow-lg shadow-blue-900/10">
                            <CardHeader>
                                <CardTitle>{editingServiceId ? 'Dienst Bewerken' : 'Nieuwe Dienst Toevoegen'}</CardTitle>
                                <CardDescription>Definieer de details en *deliverables* voor deze dienst.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Naam</label>
                                        <Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="bijv. Google Ads Beheer" className="bg-black/20 border-[#2A3552]" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Standaard Uren (per maand)</label>
                                        <Input type="number" value={serviceForm.baseHours} onChange={e => setServiceForm({ ...serviceForm, baseHours: e.target.value })} placeholder="bijv. 4" className="bg-black/20 border-[#2A3552]" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Setup Kosten / Onboarding (€)</label>
                                        <Input type="number" value={serviceForm.onboardingFee} onChange={e => setServiceForm({ ...serviceForm, onboardingFee: e.target.value })} placeholder="bijv. 250" className="bg-black/20 border-[#2A3552]" />
                                    </div>
                                </div>
                                
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Omschrijving (optioneel)</label>
                                    <Textarea value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="Korte interne beschrijving..." className="bg-black/20 border-[#2A3552] min-h-[60px]" />
                                </div>

                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Deliverables (1 per regel)</label>
                                    <Textarea 
                                        value={serviceForm.deliverables} 
                                        onChange={e => setServiceForm({ ...serviceForm, deliverables: e.target.value })} 
                                        placeholder={`Maandelijkse rapportage\nWekelijkse optimalisatie\nA/B testing ad copy`} 
                                        className="bg-black/20 border-[#2A3552] min-h-[100px]" 
                                    />
                                    <p className="text-xs text-muted-foreground">Deze lijst helpt de klant te begrijpen wat de dienst precies inhoudt.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-3 border-t border-[#2A3552]/50 pt-6">
                                <Button variant="ghost" onClick={cancelServiceEdit}>Annuleren</Button>
                                <Button onClick={handleSaveService} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <CheckCircle2 className="size-4 mr-2" /> Opslaan
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services.map(service => (
                            <Card key={service.id} className="bg-[#1C243A] border-[#2A3552] group hover:border-blue-500/30 transition-all flex flex-col">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-lg text-slate-200">{service.name}</CardTitle>
                                            {service.baseHours ? (
                                                <Badge variant="outline" className="mt-2 bg-blue-500/10 text-blue-400 border-blue-500/20">{service.baseHours} uur / maand</Badge>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-400" onClick={() => startEditService(service)}><Edit2 className="size-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteService(service.id)}><Trash2 className="size-4" /></Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-4">
                                    {service.description && <p className="text-sm text-slate-400">{service.description}</p>}
                                    {service.onboardingFee ? <p className="text-xs font-medium text-slate-300">Setupkosten: €{service.onboardingFee}</p> : null}
                                    {service.deliverables && service.deliverables.length > 0 && (
                                        <div className="bg-black/20 p-3 rounded-md border border-[#2A3552]/50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Deliverables</p>
                                            <ul className="text-sm text-slate-300 space-y-1 pl-4 list-disc marker:text-blue-500">
                                                {service.deliverables.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
                                                {service.deliverables.length > 3 && <li className="text-slate-500 italic">+ {service.deliverables.length - 3} meer...</li>}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- PACKAGES TAB --- */}
                <TabsContent value="packages" className="space-y-6">
                    <div className="flex justify-end">
                        {!isAddingPackage && (
                            <Button onClick={() => setIsAddingPackage(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
                                <PlusCircle className="size-4 mr-2" /> Nieuw Pakket
                            </Button>
                        )}
                    </div>

                    {isAddingPackage && (
                        <Card className="bg-[#1C243A] border-blue-500/50 shadow-lg shadow-blue-900/10">
                            <CardHeader>
                                <CardTitle>{editingPackageId ? 'Pakket Bewerken' : 'Nieuw Pakket Aanmaken'}</CardTitle>
                                <CardDescription>Bundel meerdere diensten in een overkoepelend pakket.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Pakketnaam</label>
                                        <Input value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="bijv. Growth Package" className="bg-black/20 border-[#2A3552]" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Pakketkorting per maand (€)</label>
                                        <Input type="number" value={packageForm.packageDiscount} onChange={e => setPackageForm({ ...packageForm, packageDiscount: e.target.value })} placeholder="bijv. 50" className="bg-black/20 border-[#2A3552]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Omschrijving (optioneel)</label>
                                    <Textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Voor wie is dit pakket bedoeld?" className="bg-black/20 border-[#2A3552] min-h-[60px]" />
                                </div>

                                <div className="border border-[#2A3552] rounded-lg p-4 bg-black/10">
                                    <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><ListPlus className="size-4" /> Selecteer Diensten voor dit Pakket</h3>
                                    {services.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">Er zijn nog geen diensten gedefinieerd. Maak eerst diensten aan.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {services.map(service => {
                                                const isSelected = packageServices.some(s => s.serviceId === service.id);
                                                const pkgSvc = packageServices.find(s => s.serviceId === service.id);
                                                return (
                                                    <div key={service.id} className={`flex items-center justify-between p-3 rounded-md border transition-all ${isSelected ? 'bg-blue-500/10 border-blue-500/50' : 'bg-[#1C243A] border-[#2A3552]'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <input 
                                                                type="checkbox" 
                                                                className="size-4 rounded border-slate-500 bg-black/50 accent-blue-600"
                                                                checked={isSelected}
                                                                onChange={() => togglePackageService(service)}
                                                            />
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-200">{service.name}</p>
                                                                <p className="text-xs text-slate-500">{service.baseHours || 0} standaard uren</p>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-400">Pakket uren:</span>
                                                                <Input 
                                                                    type="number" 
                                                                    className="w-20 h-8 text-sm bg-black/50 border-[#2A3552]" 
                                                                    value={pkgSvc?.hours || ''}
                                                                    onChange={(e) => updatePackageServiceHours(service.id, Number(e.target.value))}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-3 border-t border-[#2A3552]/50 pt-6">
                                <Button variant="ghost" onClick={cancelPackageEdit}>Annuleren</Button>
                                <Button onClick={handleSavePackage} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <CheckCircle2 className="size-4 mr-2" /> Opslaan
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {packages.map(pkg => {
                            const totalHours = pkg.services?.reduce((acc, s) => acc + (s.hours || 0), 0) || 0;
                            return (
                                <Card key={pkg.id} className="bg-[#1C243A] border-blue-500/20 group hover:border-blue-500/50 transition-all flex flex-col shadow-lg shadow-blue-900/5">
                                    <CardHeader className="pb-3 bg-blue-500/5 border-b border-blue-500/10">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-lg text-slate-100 flex items-center gap-2"><Package className="size-4 text-blue-400" /> {pkg.name}</CardTitle>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{pkg.services?.length || 0} diensten</Badge>
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{totalHours} uur / maand</Badge>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-400" onClick={() => startEditPackage(pkg)}><Edit2 className="size-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDeletePackage(pkg.id)}><Trash2 className="size-4" /></Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 space-y-4 pt-4">
                                        {pkg.description && <p className="text-sm text-slate-400">{pkg.description}</p>}
                                        {pkg.packageDiscount && pkg.packageDiscount > 0 ? (
                                            <p className="text-xs font-bold text-emerald-400">Pakketkorting: -€{pkg.packageDiscount} / mnd</p>
                                        ) : null}
                                        
                                        <div className="bg-black/20 p-3 rounded-md border border-[#2A3552]/50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Inbegrepen in pakket</p>
                                            <ul className="text-sm text-slate-300 space-y-1">
                                                {pkg.services?.map((s, i) => (
                                                    <li key={i} className="flex justify-between items-center border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                                        <span>{s.serviceName}</span>
                                                        <span className="text-slate-500 text-xs">{s.hours}u</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
