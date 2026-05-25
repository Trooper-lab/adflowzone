'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    LayoutGrid, 
    Plus, 
    Loader2, 
    Calendar, 
    CheckCircle2, 
    Circle, 
    MoreHorizontal, 
    Trash2, 
    Pencil, 
    Users, 
    Rocket,
    Clock,
    Target,
    ChevronRight,
    X,
    Check
} from 'lucide-react';
import type { Project, ParentClient, ChildAccount, ProjectMilestone } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<ParentClient[]>([]);
    const [accounts, setAccounts] = useState<ChildAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [newProject, setNewProject] = useState<Partial<Project>>({
        title: '',
        description: '',
        parentClientId: '',
        childAccountId: '',
        status: 'active',
        startDate: new Date().toISOString(),
        milestones: []
    });

    const fetchAllData = async () => {
        if (!firestore || !user) return;
        setLoading(true);
        try {
            const [projectsSnap, clientsSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'projects'), where('ownerId', '==', user.uid))),
                getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)))
            ]);

            const fetchedProjects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
            const fetchedClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ParentClient));
            
            setProjects(fetchedProjects.sort((a, b) => b.startDate.localeCompare(a.startDate)));
            setClients(fetchedClients);

            // Fetch accounts for the clients
            const allAccounts: ChildAccount[] = [];
            for (const client of fetchedClients) {
                const accSnap = await getDocs(collection(firestore, 'parentClients', client.id, 'childAccounts'));
                accSnap.forEach(d => allAccounts.push({ id: d.id, ...d.data() } as ChildAccount));
            }
            setAccounts(allAccounts);

        } catch (e) {
            console.error("Error fetching projects:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [firestore, user]);

    const handleCreateProject = async () => {
        if (!firestore || !user || !newProject.title || !newProject.parentClientId) return;
        setSaving(true);
        try {
            const projectData = {
                ...newProject,
                ownerId: user.uid,
                milestones: newProject.milestones || []
            };
            await addDoc(collection(firestore, 'projects'), projectData);
            toast({ title: 'Project aangemaakt! 🚀' });
            setIsCreateOpen(false);
            fetchAllData();
            setNewProject({ title: '', description: '', parentClientId: '', childAccountId: '', status: 'active', startDate: new Date().toISOString(), milestones: [] });
        } catch (e) {
            console.error("Error creating project:", e);
            toast({ variant: 'destructive', title: 'Fout bij opslaan' });
        } finally {
            setSaving(false);
        }
    };

    const toggleMilestone = async (project: Project, milestoneId: string) => {
        if (!firestore) return;
        const updatedMilestones = project.milestones.map(m => 
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
        );
        try {
            await updateDoc(doc(firestore, 'projects', project.id), { milestones: updatedMilestones });
            setProjects(prev => prev.map(p => p.id === project.id ? { ...p, milestones: updatedMilestones } : p));
        } catch (e) {
            console.error("Error toggling milestone:", e);
            toast({ variant: 'destructive', title: 'Kon milestone niet bijwerken' });
        }
    };

    const deleteProject = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'projects', id));
            setProjects(prev => prev.filter(p => p.id !== id));
            toast({ title: 'Project verwijderd' });
        } catch (e) {
            console.error("Error deleting project:", e);
            toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
        }
    };

    const getProgress = (milestones: ProjectMilestone[]) => {
        if (milestones.length === 0) return 0;
        const completed = milestones.filter(m => m.completed).length;
        return Math.round((completed / milestones.length) * 100);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                        <Rocket className="text-blue-400 size-8" />
                        Project Management
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">Beheer trajecten, mijlpalen en strategische doelen.</p>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest text-xs h-12 px-6 shadow-lg shadow-blue-900/20">
                            <Plus className="mr-2 size-4" /> Nieuw Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card text-slate-100 max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-headline">Strategisch Traject Starten</DialogTitle>
                            <DialogDescription className="text-slate-400">Definieer de doelen en mijlpalen voor dit klantproject.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500">Project Titel</Label>
                                    <Input 
                                        placeholder="bijv. Website Migratie Q2" 
                                        className="bg-slate-900 border-slate-700"
                                        value={newProject.title}
                                        onChange={e => setNewProject({...newProject, title: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500">Klant</Label>
                                    <Select 
                                        value={newProject.parentClientId} 
                                        onValueChange={val => setNewProject({...newProject, parentClientId: val})}
                                    >
                                        <SelectTrigger className="bg-slate-900 border-slate-700">
                                            <SelectValue placeholder="Kies klant..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.clientName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500">Omschrijving</Label>
                                <Textarea 
                                    placeholder="Wat is het hoofddoel van dit traject?" 
                                    className="bg-slate-900 border-slate-700 resize-none h-24"
                                    value={newProject.description}
                                    onChange={e => setNewProject({...newProject, description: e.target.value})}
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-slate-500">Mijlpalen</Label>
                                <div className="space-y-2">
                                    {newProject.milestones?.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="flex-grow bg-slate-900 border border-slate-700 p-2 rounded-lg text-sm text-slate-300">{m.title}</div>
                                            <Button variant="ghost" size="icon" onClick={() => setNewProject({...newProject, milestones: newProject.milestones?.filter((_, idx) => idx !== i)})}><X className="size-4" /></Button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <Input 
                                            id="milestone-input"
                                            placeholder="Nieuwe mijlpaal..." 
                                            className="bg-slate-900 border-slate-700 h-9"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.target as HTMLInputElement).value;
                                                    if (val) {
                                                        setNewProject({...newProject, milestones: [...(newProject.milestones || []), { id: Math.random().toString(36).substr(2, 9), title: val, completed: false }]});
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => {
                                                const input = document.getElementById('milestone-input') as HTMLInputElement;
                                                if (input.value) {
                                                    setNewProject({...newProject, milestones: [...(newProject.milestones || []), { id: Math.random().toString(36).substr(2, 9), title: input.value, completed: false }]});
                                                    input.value = '';
                                                }
                                            }}
                                        >Voeg toe</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Annuleren</Button>
                            <Button 
                                className="bg-blue-600 hover:bg-blue-500 font-bold" 
                                onClick={handleCreateProject}
                                disabled={saving}
                            >
                                {saving ? <Loader2 className="animate-spin size-4 mr-2" /> : <Rocket className="size-4 mr-2" />}
                                Project Starten
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex justify-center py-40"><Loader2 className="size-12 text-blue-500 animate-spin" /></div>
            ) : projects.length === 0 ? (
                <Card className="bg-transparent border-dashed border-slate-800 p-20 text-center">
                    <div className="p-6 rounded-full bg-slate-900/50 w-fit mx-auto mb-6">
                        <Target className="size-12 text-slate-700" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-300">Geen actieve projecten</h2>
                    <p className="text-slate-500 mt-2 max-w-sm mx-auto">Start je eerste strategische traject om de voortgang van grotere klusjes bij te houden.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => {
                        const progress = getProgress(project.milestones);
                        const client = clients.find(c => c.id === project.parentClientId);
                        
                        return (
                            <Card key={project.id} className="glass-card group hover:border-blue-500/30 transition-all overflow-hidden flex flex-col">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="text-[9px] uppercase font-black border-blue-500/20 bg-blue-500/5 text-blue-400">
                                            {client?.clientName || 'Onbekende Klant'}
                                        </Badge>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-white" onClick={() => deleteProject(project.id)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-headline mt-2 text-slate-100">{project.title}</CardTitle>
                                    <CardDescription className="text-xs line-clamp-2 mt-1 text-slate-400">{project.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">Voortgang</span>
                                            <span className={cn(progress === 100 ? "text-green-400" : "text-blue-400")}>{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5 bg-slate-900" />
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Mijlpalen</p>
                                        <div className="space-y-1.5">
                                            {project.milestones.map((m) => (
                                                <div 
                                                    key={m.id} 
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer",
                                                        m.completed ? "bg-green-500/5 border-green-500/10 opacity-60" : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                                                    )}
                                                    onClick={() => toggleMilestone(project, m.id)}
                                                >
                                                    {m.completed ? <CheckCircle2 className="size-4 text-green-500" /> : <Circle className="size-4 text-slate-600" />}
                                                    <span className={cn("text-xs font-medium", m.completed ? "text-slate-500 line-through" : "text-slate-300")}>
                                                        {m.title}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-black/20 p-4 border-t border-white/5 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                                        <Calendar className="size-3" />
                                        Gestart op {format(parseISO(project.startDate), 'dd MMM yyyy')}
                                    </div>
                                    <Badge className={cn(
                                        "text-[9px] font-black uppercase h-5",
                                        project.status === 'active' ? "bg-blue-600" : "bg-green-600"
                                    )}>
                                        {project.status === 'active' ? 'Lopend' : 'Afgerond'}
                                    </Badge>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}