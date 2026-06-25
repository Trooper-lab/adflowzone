'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, getDocs, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Mail, Shield, UserCog, Globe, CheckCircle2, Clock, UserPlus, ExternalLink, UserCheck, AlertCircle } from 'lucide-react';
import type { AppUser, ParentClient } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type EnrichedUser = AppUser & {
    isClient?: boolean;
    clientName?: string;
    clientId?: string;
};

export default function UserManagementPage() {
    const { user, loading: authLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    
    const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const [appUser, setAppUser] = useState<any>(null);
    
    useEffect(() => {
        if (!userDocRef) return;
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                setAppUser({ id: doc.id, ...doc.data() });
            }
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const isAdmin = useMemo(() => {
        const role = (appUser as any)?.role?.toLowerCase();
        return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es' || user?.email?.toLowerCase() === 'admin@onlyforward.nl';
    }, [appUser, user?.email]);

    useEffect(() => {
        if (!authLoading && !loading && appUser && !isAdmin) {
            router.push('/dashboard');
            toast({ variant: 'destructive', title: 'Toegang geweigerd', description: 'U heeft geen rechten om deze pagina te bekijken.' });
        }
    }, [authLoading, loading, appUser, isAdmin, router, toast]);

    const [teamUsers, setTeamUsers] = useState<EnrichedUser[]>([]);
    const [pendingUsers, setPendingUsers] = useState<EnrichedUser[]>([]);
    const [clientAccessList, setClientAccessList] = useState<{ client: ParentClient, registeredUser?: AppUser }[]>([]);

    const fetchAllData = async () => {
        if (!firestore || !user) return;
        setLoading(true);
        try {
            // 1. Fetch all users from the /users collection
            const usersSnap = await getDocs(collection(firestore, 'users'));
            const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));

            // 2. Fetch all parent clients to check portal emails
            const clientsSnap = await getDocs(collection(firestore, 'parentClients'));
            const allClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));

            // 3. Filter Users by Role
            const team = allUsers.filter(u => u.role === 'admin' || u.role === 'employee');
            const pending = allUsers.filter(u => u.role === 'pending' || !u.role);
            
            setTeamUsers(team);
            setPendingUsers(pending);

            // 4. Map Client Access
            const clientAccess = allClients.map(client => {
                const clientEmail = client.clientUserEmail?.toLowerCase();
                const matchedUser = allUsers.find(u => {
                    const userEmail = u.email?.toLowerCase();
                    return userEmail && clientEmail && userEmail === clientEmail;
                });
                return {
                    client,
                    registeredUser: matchedUser
                };
            });
            setClientAccessList(clientAccess);

        } catch (e) {
            console.error("Error fetching management data:", e);
            toast({ variant: 'destructive', title: 'Fout', description: 'Kon gebruikersgegevens niet laden.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [firestore, user, toast]);

    const handleRoleChange = async (targetUser: AppUser, newRole: 'admin' | 'employee') => {
        if (!firestore) return;
        
        const userRef = doc(firestore, 'users', targetUser.uid);
        try {
            await updateDoc(userRef, { 
                role: newRole,
                managerId: newRole === 'employee' ? user?.uid : null
            });
            toast({ title: 'Rol bijgewerkt', description: `${targetUser.email} is nu een ${newRole}.` });
            fetchAllData(); // Refresh all lists
        } catch (e) {
            console.error("Error updating role:", e);
            toast({ variant: 'destructive', title: 'Fout', description: 'Kon rol niet bijwerken.' });
        }
    };

    if (loading) return <div className="flex justify-center py-40"><Loader2 className="animate-spin size-12 text-blue-500" /></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <Shield className="text-blue-400 size-8" />
                        Gebruikers & Toegang
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Beheer je teamleden en monitor de portaal-toegang voor klanten.</p>
                </div>
            </div>

            <Tabs defaultValue="team" className="w-full space-y-6">
                <TabsList className="glass-card p-1 h-12">
                    <TabsTrigger value="team" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white h-full px-8 font-bold uppercase text-[10px] tracking-widest">
                        <Users className="size-3.5 mr-2" />
                        Interne Team ({teamUsers.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white h-full px-8 font-bold uppercase text-[10px] tracking-widest">
                        <Clock className="size-3.5 mr-2" />
                        Wachtrij ({pendingUsers.length})
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white h-full px-8 font-bold uppercase text-[10px] tracking-widest">
                        <Globe className="size-3.5 mr-2" />
                        Klanten Portaal ({clientAccessList.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="text-orange-400 flex items-center gap-2">
                                <AlertCircle className="size-5" />
                                Wachtende Gebruikers
                            </CardTitle>
                            <CardDescription>Deze personen hebben zich geregistreerd maar hebben nog geen rol of toegang.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-slate-800">
                                {pendingUsers.map((u) => (
                                    <div key={u.uid} className="py-5 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-xl border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                                <UserPlus className="size-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-200">{u.displayName || 'Nieuwe Gebruiker'}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <Mail className="size-3" /> {u.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleRoleChange(u, 'employee')} className="h-8 text-[10px] font-bold uppercase tracking-widest border-blue-500/30 hover:bg-blue-500 hover:text-white">
                                                <UserCog className="mr-2 size-3" /> Maak Medewerker
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleRoleChange(u, 'admin')} className="h-8 text-[10px] font-bold uppercase tracking-widest border-purple-500/30 hover:bg-purple-500 hover:text-white">
                                                <Shield className="mr-2 size-3" /> Maak Admin
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {pendingUsers.length === 0 && (
                                    <div className="py-10 text-center text-slate-500 italic text-sm">Geen nieuwe aanmeldingen in de wachtrij.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team" className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Actieve Teamleden</CardTitle>
                            <CardDescription>Admins hebben volledige toegang, medewerkers zien alleen toegewezen accounts.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-slate-800">
                                {teamUsers.map((u) => (
                                    <div key={u.uid} className="py-5 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-3 rounded-xl border",
                                                u.role === 'admin' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            )}>
                                                {u.role === 'admin' ? <Shield className="size-5" /> : <Users className="size-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-200">{u.displayName || 'Geregistreerde Gebruiker'}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <Mail className="size-3" /> {u.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge variant="outline" className={cn(
                                                "uppercase text-[10px] font-black px-2.5 h-6 border-none",
                                                u.role === 'admin' ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                                            )}>
                                                {u.role || 'admin'}
                                            </Badge>
                                            
                                            {u.uid !== user?.uid && (
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {u.role !== 'employee' ? (
                                                        <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u, 'employee')} className="h-8 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/10 hover:text-blue-400">
                                                            <UserCog className="mr-2 size-3" /> Degraderen
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u, 'admin')} className="h-8 text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500/10 hover:text-purple-400">
                                                            <Shield className="mr-2 size-3" /> Promoveren
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="clients" className="space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Klanten Toegang</CardTitle>
                            <CardDescription>Monitor welke klanten hun portaal hebben geactiveerd.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-slate-800">
                                {clientAccessList.map(({ client, registeredUser }) => (
                                    <div key={client.id} className="py-5 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-3 rounded-xl border",
                                                registeredUser ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-secondary text-slate-500 border-slate-700"
                                            )}>
                                                <Globe className="size-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-200 flex items-center gap-2">
                                                    {client.clientName}
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4 bg-slate-800 border-none">{client.clientType}</Badge>
                                                </div>
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <Mail className="size-3" /> {client.clientUserEmail}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                {registeredUser ? (
                                                    <div className="flex flex-col items-end">
                                                        <Badge className="bg-green-500/10 text-green-400 border-none uppercase text-[9px] font-black mb-1">
                                                            <CheckCircle2 className="size-2.5 mr-1" /> Actief
                                                        </Badge>
                                                        <span className="text-[10px] text-slate-500 font-medium">Geregistreerd: {registeredUser.displayName || 'Klant'}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end">
                                                        <Badge variant="outline" className="text-slate-500 border-slate-700 uppercase text-[9px] font-black mb-1">
                                                            <Clock className="size-2.5 mr-1" /> In afwachting
                                                        </Badge>
                                                        <span className="text-[10px] text-slate-600 italic">Nog niet aangemeld</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/dashboard/clients/${client.id}`}>
                                                    <ExternalLink className="size-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {clientAccessList.length === 0 && (
                                    <div className="py-20 text-center space-y-4">
                                        <Users className="size-12 text-slate-700 mx-auto" />
                                        <p className="text-slate-500 font-medium">Nog geen klanten aangemaakt in het systeem.</p>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href="/dashboard/clients/add">Klant Toevoegen</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}