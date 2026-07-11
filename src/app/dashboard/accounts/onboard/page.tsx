'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Check, Loader2, PlusCircle, Trash2, Target, Briefcase, Calendar, Building2, Users, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { ParentClient, ChildAccount, AppUser, Service, ServicePackage, ChecklistTemplate } from '@/lib/types';

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
];

const PRIMARY_GOALS = [
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'ecommerce_sales', label: 'E-commerce Sales' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'app_installs', label: 'App Installs' },
  { value: 'other', label: 'Overig' },
];

function formatClientId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function OnboardAccountPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState(1); // 1, 2, 3 (which represents 2b), 4 (which represents 3), 5 (which represents 4)
  const [saving, setSaving] = useState(false);

  // Load user data
  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
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

  const managerUid = useMemo(() => {
    return isAdmin ? user?.uid : (appUser as any)?.managerId;
  }, [isAdmin, user, appUser]);

  // Dynamic lists from firestore
  const parentClientsQuery = useMemoFirebase(
    () => (firestore && managerUid ? query(collection(firestore, 'parentClients'), where('ownerId', '==', managerUid)) : null),
    [firestore, managerUid]
  );
  const { data: parentClients } = useCollection(parentClientsQuery);

  const employeesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('role', '==', 'employee')) : null),
    [firestore]
  );
  const { data: employees } = useCollection(employeesQuery);

  const servicesQuery = useMemoFirebase(
    () => (firestore && managerUid ? query(collection(firestore, 'services'), where('ownerId', '==', managerUid)) : null),
    [firestore, managerUid]
  );
  const { data: servicesData } = useCollection(servicesQuery);
  const availableServices = useMemo(() => {
    if (!servicesData) return [];
    return servicesData.map(d => ({ id: d.id, ...d.data() } as Service));
  }, [servicesData]);

  const packagesQuery = useMemoFirebase(
    () => (firestore && managerUid ? query(collection(firestore, 'servicePackages'), where('ownerId', '==', managerUid)) : null),
    [firestore, managerUid]
  );
  const { data: packagesData } = useCollection(packagesQuery);
  const availablePackages = useMemo(() => {
    if (!packagesData) return [];
    return packagesData.map(d => ({ id: d.id, ...d.data() } as ServicePackage));
  }, [packagesData]);

  const checklistsQuery = useMemoFirebase(
    () => (firestore && managerUid ? query(collection(firestore, 'users', managerUid, 'checklistTemplates')) : null),
    [firestore, managerUid]
  );
  const { data: checklistTemplates } = useCollection(checklistsQuery);

  // ─── Step 1 State: Klant & Bedrijf ───
  const [parentClientType, setParentClientType] = useState<'existing' | 'new'>('existing');
  const [selectedParentId, setSelectedParentId] = useState('');
  
  // New Parent Client Info
  const [newClientName, setNewClientName] = useState('');
  const [newClientWebsite, setNewClientWebsite] = useState('');
  const [newClientContactPerson, setNewClientContactPerson] = useState('');
  const [newClientContactEmail, setNewClientContactEmail] = useState('');
  const [newClientType, setNewClientType] = useState<'agency' | 'freelancer'>('agency');

  // Child Account Info
  const [accountNickname, setAccountNickname] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');

  // ─── Step 2 State: Kanalen ───
  const [useGoogleAds, setUseGoogleAds] = useState(false);
  const [useMetaAds, setUseMetaAds] = useState(false);
  const [useLinkedinAds, setUseLinkedinAds] = useState(false);
  const [primaryGoal, setPrimaryGoal] = useState<'lead_generation' | 'ecommerce_sales' | 'brand_awareness' | 'app_installs' | 'other'>('lead_generation');
  const [selectedKpis, setSelectedKpis] = useState<string[]>(['spend', 'clicks', 'conversions']);

  // ─── Step 2b State: Ad Account Access & IDs ───
  const [hasGoogleAccess, setHasGoogleAccess] = useState(false);
  const [googleAdsClientId, setGoogleAdsClientId] = useState('');
  const [googleAdsAccountName, setGoogleAdsAccountName] = useState('');

  const [hasMetaAccess, setHasMetaAccess] = useState(false);
  const [metaAdsAccountId, setMetaAdsAccountId] = useState('');
  const [metaAdsAccountName, setMetaAdsAccountName] = useState('');
  const [metaBusinessManagerId, setMetaBusinessManagerId] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');

  const [hasLinkedinAccess, setHasLinkedinAccess] = useState(false);
  const [linkedinAdsAccountId, setLinkedinAdsAccountId] = useState('');
  const [linkedinAdsAccountName, setLinkedinAdsAccountName] = useState('');

  // ─── Step 3 State: Budgetten & Diensten ───
  const [monthlyClickBudget, setMonthlyClickBudget] = useState(0);
  const [managementFee, setManagementFee] = useState(0);
  const [connectedServices, setConnectedServices] = useState<Array<{ serviceId: string; serviceName: string; hours: number }>>([]);
  const [connectedPackages, setConnectedPackages] = useState<Array<{ packageId: string; packageName: string }>>([]);

  const calculatedHours = useMemo(() => {
    let total = 0;
    connectedServices.forEach(s => total += (Number(s.hours) || 0));
    connectedPackages.forEach(p => {
      const pkg = availablePackages.find(ap => ap.id === p.packageId);
      if (pkg && pkg.services) {
        pkg.services.forEach(s => total += (Number(s.hours) || 0));
      }
    });
    return Number(total.toFixed(2));
  }, [connectedServices, connectedPackages, availablePackages]);

  // ─── Step 4 State: Checklists ───
  const [selectedChecklists, setSelectedChecklists] = useState<Array<{ checklistId: string; name: string; frequency: 'daily' | 'weekly' | 'monthly' | 'one-off'; startDate: string; planNow: boolean }>>([]);

  // Auto-assign first employee or logged in user as fallback
  useEffect(() => {
    if (user && !assignedEmployeeId) {
      setAssignedEmployeeId(user.uid);
    }
  }, [user, assignedEmployeeId]);

  // ─── Navigation Handlers ───
  const nextStep = () => {
    if (step === 1) {
      if (parentClientType === 'existing' && !selectedParentId) {
        toast({ title: 'Selecteer een klant', description: 'Kies een bestaande klant om door te gaan.', variant: 'destructive' });
        return;
      }
      if (parentClientType === 'new' && (!newClientName || !newClientWebsite)) {
        toast({ title: 'Vul de verplichte velden in', description: 'Klantnaam en Website zijn verplicht voor een nieuwe klant.', variant: 'destructive' });
        return;
      }
      if (!accountNickname) {
        toast({ title: 'Vul de accountnaam in', description: 'De interne naam voor het platformaccount is verplicht.', variant: 'destructive' });
        return;
      }
    }
    if (step === 2) {
      if (!useGoogleAds && !useMetaAds && !useLinkedinAds) {
        toast({ title: 'Selecteer minimaal één kanaal', description: 'Kies tenminste Google Ads, Meta Ads of LinkedIn Ads.', variant: 'destructive' });
        return;
      }
      if (selectedKpis.length === 0) {
        toast({ title: 'Selecteer minimaal één KPI', description: 'Kies tenminste één KPI om bij te houden.', variant: 'destructive' });
        return;
      }
    }
    if (step === 3) { // Step 2b (Access setup)
      // Check formatting or values if access is granted
      if (useGoogleAds && hasGoogleAccess) {
        if (!googleAdsClientId || !googleAdsAccountName) {
          toast({ title: 'Google Ads details verplicht', description: 'Vul de Google Ads Client ID en Accountnaam in.', variant: 'destructive' });
          return;
        }
      }
      if (useMetaAds && hasMetaAccess) {
        if (!metaAdsAccountId || !metaAdsAccountName) {
          toast({ title: 'Meta Ads details verplicht', description: 'Vul de Meta Ads Account ID en Accountnaam in.', variant: 'destructive' });
          return;
        }
      }
      if (useLinkedinAds && hasLinkedinAccess) {
        if (!linkedinAdsAccountId || !linkedinAdsAccountName) {
          toast({ title: 'LinkedIn Ads details verplicht', description: 'Vul de LinkedIn Ads Account ID en Accountnaam in.', variant: 'destructive' });
          return;
        }
      }
    }

    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
  };

  // ─── Actions ───
  const addService = () => {
    setConnectedServices(prev => [...prev, { serviceId: '', serviceName: '', hours: 0 }]);
  };

  const removeService = (index: number) => {
    setConnectedServices(prev => prev.filter((_, i) => i !== index));
  };

  const addPackage = (packageId: string) => {
    if (!packageId) return;
    const pkg = availablePackages.find(p => p.id === packageId);
    if (pkg && !connectedPackages.some(p => p.packageId === packageId)) {
      setConnectedPackages(prev => [...prev, { packageId: pkg.id, packageName: pkg.name }]);
    }
  };

  const removePackage = (packageId: string) => {
    setConnectedPackages(prev => prev.filter(p => p.packageId !== packageId));
  };

  const toggleChecklist = (templateId: string, name: string) => {
    const exists = selectedChecklists.find(c => c.checklistId === templateId);
    if (exists) {
      setSelectedChecklists(prev => prev.filter(c => c.checklistId !== templateId));
    } else {
      setSelectedChecklists(prev => [...prev, {
        checklistId: templateId,
        name,
        frequency: 'weekly',
        startDate: new Date().toISOString().split('T')[0],
        planNow: true
      }]);
    }
  };

  const updateChecklistConfig = (templateId: string, key: 'frequency' | 'startDate' | 'planNow', value: any) => {
    setSelectedChecklists(prev => prev.map(c => {
      if (c.checklistId === templateId) {
        return { ...c, [key]: value };
      }
      return c;
    }));
  };

  // ─── Save / Submit Onboarding ───
  const handleOnboard = async () => {
    if (!firestore || !user || !managerUid) return;
    setSaving(true);

    try {
      let finalParentId = selectedParentId;
      let finalParentName = '';

      // 1. Create Parent Client if new
      if (parentClientType === 'new') {
        const clientData = {
          ownerId: managerUid,
          clientName: newClientName,
          clientWebsite: newClientWebsite,
          clientContactPerson: newClientContactPerson,
          clientContactEmail: newClientContactEmail,
          clientType: newClientType,
          hourlyRate: 100, // Default hourly rate
          createdAt: new Date().toISOString()
        };
        const pDoc = await addDoc(collection(firestore, 'parentClients'), clientData);
        finalParentId = pDoc.id;
        finalParentName = newClientName;
      } else {
        const existing = parentClients?.find(p => p.id === selectedParentId);
        if (existing) {
          finalParentName = (existing as any).clientName;
        }
      }

      // 2. Determine Onboarding / Active status
      // If access is granted for all selected channels, status is 'active'.
      // Otherwise, status is 'onboarding'.
      let accessComplete = true;
      if (useGoogleAds && !hasGoogleAccess) accessComplete = false;
      if (useMetaAds && !hasMetaAccess) accessComplete = false;
      if (useLinkedinAds && !hasLinkedinAccess) accessComplete = false;

      const accountStatus = accessComplete ? 'active' : 'onboarding';

      // 3. Child Account Data Object
      const childAccountData: any = {
        ownerId: managerUid,
        parentClientId: finalParentId,
        nickname: accountNickname,
        assignedEmployeeId: assignedEmployeeId || null,
        primaryGoal,
        kpisToTrack: selectedKpis,
        monthlyClickBudget,
        fixedHours: calculatedHours,
        status: accountStatus,
        isPaused: false,
        connectedServices: connectedServices.filter(s => s.serviceId !== ''),
        connectedPackages,
        createdAt: serverTimestamp(),
        
        // Channel access configuration
        googleAdsClientId: useGoogleAds && hasGoogleAccess ? googleAdsClientId : '',
        googleAdsAccountName: useGoogleAds && hasGoogleAccess ? googleAdsAccountName : '',

        metaAdsAccountId: useMetaAds && hasMetaAccess ? metaAdsAccountId : '',
        metaAdsAccountName: useMetaAds && hasMetaAccess ? metaAdsAccountName : '',
        metaBusinessManagerId: useMetaAds && hasMetaAccess ? metaBusinessManagerId : '',
        metaPixelId: useMetaAds && hasMetaAccess ? metaPixelId : '',

        linkedinAdsAccountId: useLinkedinAds && hasLinkedinAccess ? linkedinAdsAccountId : '',
        linkedinAdsAccountName: useLinkedinAds && hasLinkedinAccess ? linkedinAdsAccountName : '',
        
        managementFee: {
          amount: managementFee,
          frequency: 'monthly'
        },

        // Connected checklists config
        connectedChecklists: selectedChecklists.map(c => ({
          checklistId: c.checklistId,
          startDate: new Date(c.startDate).toISOString(),
          frequency: c.frequency
        }))
      };

      // 4. Save Child Account
      const childDocRef = await addDoc(
        collection(firestore, 'parentClients', finalParentId, 'childAccounts'),
        childAccountData
      );

      // 5. Schedule / Plan Checklists (Todos generation)
      for (const selected of selectedChecklists) {
        if (!selected.planNow) continue;
        const template = checklistTemplates?.find(t => t.id === selected.checklistId) as ChecklistTemplate;
        if (!template || !template.tasks) continue;

        // Create tasks in todos collection
        for (const task of template.tasks) {
          const todoData = {
            ownerId: managerUid,
            parentClientId: finalParentId,
            parentClientName: finalParentName,
            childAccountId: childDocRef.id,
            childAccountNickname: accountNickname,
            content: `${selected.name} - ${task.description}`,
            completed: false,
            createdAt: new Date().toISOString(),
            dueDate: new Date(selected.startDate).toISOString(),
            status: 'todo',
            workedHours: 0,
            assigneeId: assignedEmployeeId || null,
            assigneeName: employees?.find(e => e.id === assignedEmployeeId)?.displayName || 'Onbekend'
          };
          await addDoc(collection(firestore, 'todos'), todoData);
        }
      }

      toast({
        title: 'Onboarding voltooid!',
        description: `Account ${accountNickname} is aangemaakt met status '${accountStatus}'.`
      });

      router.push('/dashboard/accounts');
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Fout bij onboarding',
        description: e.message || 'Controleer de invoer en probeer het opnieuw.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      
      {/* Page Header */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-slate-400 hover:text-white shrink-0">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="font-headline text-3xl font-black tracking-tight text-slate-100 flex items-center gap-3">
            Klant Onboarding Wizard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Volg de stappen om een nieuwe klant en diens advertentiekanalen, budgetten en checklists op te zetten.
          </p>
        </div>
      </div>

      {/* Progress Steps Indicators */}
      <div className="grid grid-cols-5 gap-3 text-center">
        {[
          { label: 'Klant & Bedrijf', stepNum: 1 },
          { label: 'Kanalen & Doelen', stepNum: 2 },
          { label: 'Account Toegang', stepNum: 3 },
          { label: 'Uren & Budget', stepNum: 4 },
          { label: 'Checklist Builder', stepNum: 5 }
        ].map((s) => (
          <div key={s.stepNum} className="space-y-2">
            <div className={cn(
              'h-2 rounded-full transition-all duration-300',
              step >= s.stepNum ? 'bg-blue-500' : 'bg-slate-800'
            )} />
            <span className={cn(
              'text-[10px] uppercase font-bold tracking-wider hidden md:inline-block',
              step >= s.stepNum ? 'text-blue-400' : 'text-slate-600'
            )}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: Klant & Bedrijf */}
      {step === 1 && (
        <Card className="glass-card shadow-2xl overflow-hidden border-slate-800">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold font-headline text-white flex items-center gap-2">
              <Building2 className="size-5 text-blue-400" /> Stap 1: Klant- & Bedrijfsgegevens
            </CardTitle>
            <CardDescription className="text-slate-400">
              Koppel het nieuwe account aan een bestaand Bureau/Freelancer of maak een nieuwe aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selection Type */}
            <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-2 border border-slate-800 rounded-xl">
              <Button
                variant={parentClientType === 'existing' ? 'default' : 'ghost'}
                onClick={() => setParentClientType('existing')}
                className="w-full text-xs font-bold"
              >
                Bestaande Klant
              </Button>
              <Button
                variant={parentClientType === 'new' ? 'default' : 'ghost'}
                onClick={() => setParentClientType('new')}
                className="w-full text-xs font-bold"
              >
                Nieuwe Klant Aanmaken
              </Button>
            </div>

            {parentClientType === 'existing' ? (
              <div className="space-y-2">
                <Label className="text-slate-300 font-medium">Bestaande Klant / Bureau</Label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger className="bg-secondary border-border text-slate-200 h-12">
                    <SelectValue placeholder="Selecteer klant..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-border text-slate-200">
                    {parentClients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {(client as any).clientName} ({(client as any).clientType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-slate-800 rounded-xl bg-slate-950/20">
                <h3 className="text-xs uppercase font-black text-slate-500 tracking-wider">Nieuwe Klant Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Bedrijfsnaam *</Label>
                    <Input placeholder="bijv. Onlyforward B.V." value={newClientName} onChange={e => setNewClientName(e.target.value)} className="bg-secondary border-border text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Website URL *</Label>
                    <Input placeholder="https://..." value={newClientWebsite} onChange={e => setNewClientWebsite(e.target.value)} className="bg-secondary border-border text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Contactpersoon</Label>
                    <Input placeholder="Voornaam Achternaam" value={newClientContactPerson} onChange={e => setNewClientContactPerson(e.target.value)} className="bg-secondary border-border text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Contact Email</Label>
                    <Input type="email" placeholder="client@domain.com" value={newClientContactEmail} onChange={e => setNewClientContactEmail(e.target.value)} className="bg-secondary border-border text-slate-200" />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label className="text-slate-300">Klant Type</Label>
                  <Select value={newClientType} onValueChange={(val: any) => setNewClientType(val)}>
                    <SelectTrigger className="bg-secondary border-border text-slate-200 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-border text-slate-200">
                      <SelectItem value="agency">Agency (Bureau)</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <h3 className="text-xs uppercase font-black text-slate-500 tracking-wider">Nieuw Platform Account Details</h3>
              <div className="space-y-2">
                <Label className="text-slate-300">Interne Accountnaam *</Label>
                <Input placeholder="bijv. Onlyforward – Google Search Ads" value={accountNickname} onChange={e => setAccountNickname(e.target.value)} className="bg-secondary border-border text-slate-200" />
                <span className="text-[10px] text-slate-500 block">De interne herkenbare naam in FlowZone.</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-300">Verantwoordelijke Medewerker</Label>
                <Select value={assignedEmployeeId} onValueChange={setAssignedEmployeeId}>
                  <SelectTrigger className="bg-secondary border-border text-slate-200">
                    <SelectValue placeholder="Selecteer medewerker..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-border text-slate-200">
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={(emp as any).uid}>
                        {(emp as any).displayName || emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Kanalen & Doelen */}
      {step === 2 && (
        <Card className="glass-card shadow-2xl overflow-hidden border-slate-800">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold font-headline text-white flex items-center gap-2">
              <Target className="size-5 text-emerald-400" /> Stap 2: Kanalen & Doelen
            </CardTitle>
            <CardDescription className="text-slate-400">
              Welke kanalen gaan we opzetten voor deze klant en wat is het hoofddoel?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Platform Selection */}
            <div className="space-y-3">
              <Label className="text-slate-300 font-bold block mb-1">Actieve Kanalen</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => setUseGoogleAds(!useGoogleAds)} 
                  className={cn(
                    'p-4 rounded-xl border border-slate-800 text-center cursor-pointer transition-all hover:bg-slate-800/40 select-none flex flex-col gap-2 items-center',
                    useGoogleAds ? 'bg-blue-600/10 border-blue-500 text-blue-300' : 'bg-slate-900/30 text-slate-400'
                  )}
                >
                  <Target className="size-6 text-blue-400" />
                  <span className="font-bold text-sm">Google Ads</span>
                </div>
                <div 
                  onClick={() => setUseMetaAds(!useMetaAds)} 
                  className={cn(
                    'p-4 rounded-xl border border-slate-800 text-center cursor-pointer transition-all hover:bg-slate-800/40 select-none flex flex-col gap-2 items-center',
                    useMetaAds ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300' : 'bg-slate-900/30 text-slate-400'
                  )}
                >
                  <Users className="size-6 text-indigo-400" />
                  <span className="font-bold text-sm">Meta Ads</span>
                </div>
                <div 
                  onClick={() => setUseLinkedinAds(!useLinkedinAds)} 
                  className={cn(
                    'p-4 rounded-xl border border-slate-800 text-center cursor-pointer transition-all hover:bg-slate-800/40 select-none flex flex-col gap-2 items-center',
                    useLinkedinAds ? 'bg-cyan-600/10 border-cyan-500 text-cyan-300' : 'bg-slate-900/30 text-slate-400'
                  )}
                >
                  <Briefcase className="size-6 text-cyan-400" />
                  <span className="font-bold text-sm">LinkedIn Ads</span>
                </div>
              </div>
            </div>

            {/* Campaign Primary Goal */}
            <div className="space-y-2 pt-2">
              <Label className="text-slate-300">Hoofddoel (Primary Goal)</Label>
              <Select value={primaryGoal} onValueChange={(val: any) => setPrimaryGoal(val)}>
                <SelectTrigger className="bg-secondary border-border text-slate-200 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-border text-slate-200">
                  {PRIMARY_GOALS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KPIs To Track */}
            <div className="space-y-3 pt-2">
              <Label className="text-slate-300">Te meten KPI's</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-950/20 p-4 border border-slate-800 rounded-xl">
                {KPI_ITEMS.map((item) => {
                  const checked = selectedKpis.includes(item.id);
                  return (
                    <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`kpi-${item.id}`}
                        checked={checked}
                        onCheckedChange={(checkedState) => {
                          if (checkedState) {
                            setSelectedKpis(prev => [...prev, item.id]);
                          } else {
                            setSelectedKpis(prev => prev.filter(id => id !== item.id));
                          }
                        }}
                      />
                      <label htmlFor={`kpi-${item.id}`} className="text-xs text-slate-300 font-medium cursor-pointer">
                        {item.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Toegang & Account Koppeling (Step 2b) */}
      {step === 3 && (
        <Card className="glass-card shadow-2xl overflow-hidden border-slate-800">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold font-headline text-white flex items-center gap-2">
              <Shield className="size-5 text-blue-400" /> Stap 2b: Toegang & Account Koppeling
            </CardTitle>
            <CardDescription className="text-slate-400">
              Voer de account-IDs en details in voor de geselecteerde platformen. Als we nog geen toegang hebben, blijft de status van dit dossier 'Onboarding'.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* Google Ads Access Section */}
            {useGoogleAds && (
              <div className="space-y-4 p-4 border border-slate-800 rounded-xl bg-slate-950/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <Target className="size-4" /> Google Ads Toegang
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="google-access" className="text-xs text-slate-400">Toegang Verleend?</Label>
                    <Switch id="google-access" checked={hasGoogleAccess} onCheckedChange={setHasGoogleAccess} />
                  </div>
                </div>

                {hasGoogleAccess && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Client ID *</Label>
                      <Input
                        placeholder="123-456-7890"
                        value={googleAdsClientId}
                        onChange={(e) => setGoogleAdsClientId(formatClientId(e.target.value))}
                        className="bg-secondary border-border text-slate-200 font-mono tracking-wider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Officiële Accountnaam *</Label>
                      <Input
                        placeholder="Naam in Google Ads"
                        value={googleAdsAccountName}
                        onChange={(e) => setGoogleAdsAccountName(e.target.value)}
                        className="bg-secondary border-border text-slate-200"
                      />
                    </div>
                  </div>
                )}
                {!hasGoogleAccess && (
                  <p className="text-xs text-amber-500 italic mt-1">Dossier houdt status 'onboarding' voor Google Ads.</p>
                )}
              </div>
            )}

            {/* Meta Ads Access Section */}
            {useMetaAds && (
              <div className="space-y-4 p-4 border border-slate-800 rounded-xl bg-slate-950/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <Users className="size-4" /> Meta Ads Toegang
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="meta-access" className="text-xs text-slate-400">Toegang Verleend?</Label>
                    <Switch id="meta-access" checked={hasMetaAccess} onCheckedChange={setHasMetaAccess} />
                  </div>
                </div>

                {hasMetaAccess && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Advertentie Account ID *</Label>
                      <Input
                        placeholder="bijv. act_123456789"
                        value={metaAdsAccountId}
                        onChange={(e) => setMetaAdsAccountId(e.target.value)}
                        className="bg-secondary border-border text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Account Naam *</Label>
                      <Input
                        placeholder="bijv. Onlyforward Ads"
                        value={metaAdsAccountName}
                        onChange={(e) => setMetaAdsAccountName(e.target.value)}
                        className="bg-secondary border-border text-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Business Manager ID</Label>
                      <Input
                        placeholder="bijv. 123456789012345"
                        value={metaBusinessManagerId}
                        onChange={(e) => setMetaBusinessManagerId(e.target.value)}
                        className="bg-secondary border-border text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Meta Pixel ID</Label>
                      <Input
                        placeholder="bijv. 9876543210"
                        value={metaPixelId}
                        onChange={(e) => setMetaPixelId(e.target.value)}
                        className="bg-secondary border-border text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}
                {!hasMetaAccess && (
                  <p className="text-xs text-amber-500 italic mt-1">Dossier houdt status 'onboarding' voor Meta Ads.</p>
                )}
              </div>
            )}

            {/* LinkedIn Ads Access Section */}
            {useLinkedinAds && (
              <div className="space-y-4 p-4 border border-slate-800 rounded-xl bg-slate-950/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                    <Briefcase className="size-4" /> LinkedIn Ads Toegang
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="linkedin-access" className="text-xs text-slate-400">Toegang Verleend?</Label>
                    <Switch id="linkedin-access" checked={hasLinkedinAccess} onCheckedChange={setHasLinkedinAccess} />
                  </div>
                </div>

                {hasLinkedinAccess && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-slate-300">LinkedIn Account ID *</Label>
                      <Input
                        placeholder="bijv. 506789123"
                        value={linkedinAdsAccountId}
                        onChange={(e) => setLinkedinAdsAccountId(e.target.value)}
                        className="bg-secondary border-border text-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Account Naam *</Label>
                      <Input
                        placeholder="bijv. Onlyforward LinkedIn Ads"
                        value={linkedinAdsAccountName}
                        onChange={(e) => setLinkedinAdsAccountName(e.target.value)}
                        className="bg-secondary border-border text-slate-200"
                      />
                    </div>
                  </div>
                )}
                {!hasLinkedinAccess && (
                  <p className="text-xs text-amber-500 italic mt-1">Dossier houdt status 'onboarding' voor LinkedIn Ads.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Budgetten & Diensten (Step 3) */}
      {step === 4 && (
        <Card className="glass-card shadow-2xl overflow-hidden border-slate-800">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold font-headline text-white flex items-center gap-2">
              <Briefcase className="size-5 text-emerald-400" /> Stap 3: Uren & Budgetten
            </CardTitle>
            <CardDescription className="text-slate-400">
              Configureer de maandelijkse budgetten, uren, diensten en pakketten voor deze klant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-2">
                <Label className="text-slate-300">Maandelijks Advertentie Click Budget (€)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 text-sm pointer-events-none">€</span>
                  <Input type="number" min={0} value={monthlyClickBudget} onChange={e => setMonthlyClickBudget(Number(e.target.value))} className="bg-secondary border-border text-slate-200 pl-8 h-12" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Maandelijkse Management Fee (€)</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 text-sm pointer-events-none">€</span>
                  <Input type="number" min={0} value={managementFee} onChange={e => setManagementFee(Number(e.target.value))} className="bg-secondary border-border text-slate-200 pl-8 h-12" />
                </div>
              </div>
            </div>

            {/* Packages Selector */}
            <div className="space-y-3 pt-2">
              <Label className="text-slate-300 font-bold block">Pakket Koppelen</Label>
              <Select value="" onValueChange={addPackage}>
                <SelectTrigger className="bg-secondary border-border text-slate-200">
                  <SelectValue placeholder="Kies een pakket om toe te voegen..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-border text-slate-200">
                  {availablePackages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {connectedPackages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {connectedPackages.map(pkg => (
                    <Badge key={pkg.packageId} className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded-md flex items-center gap-2">
                      {pkg.packageName}
                      <button onClick={() => removePackage(pkg.packageId)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Services Selector */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 font-bold">Losse Diensten & Uren</Label>
                <Button type="button" variant="outline" size="sm" onClick={addService} className="border-slate-800 text-slate-300">
                  <PlusCircle className="size-3.5 mr-1" /> Dienst Toevoegen
                </Button>
              </div>

              {connectedServices.length > 0 && (
                <div className="space-y-3">
                  {connectedServices.map((field, index) => (
                    <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-3 items-center p-3 border border-slate-800 bg-slate-900/30 rounded-xl">
                      <Select
                        value={field.serviceId}
                        onValueChange={(val) => {
                          const svc = availableServices.find(s => s.id === val);
                          if (svc) {
                            setConnectedServices(prev => prev.map((s, i) => i === index ? { serviceId: val, serviceName: svc.name, hours: s.hours || svc.baseHours || 0 } : s));
                          }
                        }}
                      >
                        <SelectTrigger className="bg-secondary border-border text-slate-200">
                          <SelectValue placeholder="Kies dienst..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-border text-slate-200">
                          {availableServices.map(svc => (
                            <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.5"
                          min={0}
                          placeholder="Uren"
                          value={field.hours || ''}
                          onChange={(e) => setConnectedServices(prev => prev.map((s, i) => i === index ? { ...s, hours: Number(e.target.value) } : s))}
                          className="bg-secondary border-border text-slate-200 pr-8"
                        />
                        <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 font-bold">uur</span>
                      </div>
                      
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)} className="hover:text-red-400 hover:bg-red-500/10 text-slate-500">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between pt-4 mt-6">
              <span className="text-sm text-blue-300 font-bold uppercase tracking-wider">Totaal geplande uren:</span>
              <span className="text-xl font-black text-blue-400 font-mono">{calculatedHours} uur / maand</span>
            </div>

          </CardContent>
        </Card>
      )}

      {/* STEP 5: Checklists Koppelen & Inplannen (Step 4) */}
      {step === 5 && (
        <Card className="glass-card shadow-2xl overflow-hidden border-slate-800">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold font-headline text-white flex items-center gap-2">
              <Calendar className="size-5 text-purple-400" /> Stap 4: Checklists & Planning Koppelen
            </CardTitle>
            <CardDescription className="text-slate-400">
              Koppel standaard checklists om in te plannen in de wekelijkse of maandelijkse planning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-4">
              <Label className="text-slate-300 font-bold block">Beschikbare Checklists</Label>
              
              {checklistTemplates && checklistTemplates.length > 0 ? (
                <div className="space-y-4">
                  {checklistTemplates.map((template) => {
                    const selected = selectedChecklists.find(c => c.checklistId === template.id);
                    return (
                      <div key={template.id} className={cn(
                        'p-4 rounded-xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30',
                        selected ? 'border-purple-500 bg-purple-500/5' : 'border-slate-800'
                      )}>
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            id={`checklist-${template.id}`}
                            checked={!!selected}
                            onCheckedChange={() => toggleChecklist(template.id, template.name)}
                            className="mt-1"
                          />
                          <div>
                            <label htmlFor={`checklist-${template.id}`} className="font-bold text-slate-100 text-sm cursor-pointer block">{template.name}</label>
                            <p className="text-xs text-slate-500 mt-1">{(template as any).description || 'Geen omschrijving'}</p>
                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase mt-2 inline-block">
                              {(template as any).tasks?.length || 0} taken
                            </span>
                          </div>
                        </div>

                        {selected && (
                          <div className="flex flex-col sm:flex-row gap-3 md:w-auto shrink-0 animate-in slide-in-from-right-2 duration-300">
                            {/* Frequency Selector */}
                            <div className="flex flex-col gap-1 w-full sm:w-[120px]">
                              <span className="text-[9px] uppercase font-black text-slate-500">Frequentie</span>
                              <Select value={selected.frequency} onValueChange={(val: any) => updateChecklistConfig(template.id, 'frequency', val)}>
                                <SelectTrigger className="bg-secondary/50 border-border h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-border text-slate-200">
                                  <SelectItem value="daily" className="text-xs">Dagelijks</SelectItem>
                                  <SelectItem value="weekly" className="text-xs">Wekelijks</SelectItem>
                                  <SelectItem value="monthly" className="text-xs">Maandelijks</SelectItem>
                                  <SelectItem value="one-off" className="text-xs">Eenmalig</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Start date */}
                            <div className="flex flex-col gap-1 w-full sm:w-[130px]">
                              <span className="text-[9px] uppercase font-black text-slate-500">Startdatum</span>
                              <Input
                                type="date"
                                value={selected.startDate}
                                onChange={(e) => updateChecklistConfig(template.id, 'startDate', e.target.value)}
                                className="bg-secondary/50 border-border h-9 text-xs"
                              />
                            </div>

                            {/* Plan now toggle */}
                            <div className="flex flex-col gap-1 items-center justify-center pl-2">
                              <span className="text-[9px] uppercase font-black text-slate-500 mb-1">Direct Inplannen</span>
                              <Switch
                                checked={selected.planNow}
                                onCheckedChange={(state) => updateChecklistConfig(template.id, 'planNow', state)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 border border-dashed border-slate-800 text-slate-500 rounded-xl text-sm">
                  Geen checklist templates gevonden. Maak eerst templates aan in de Checklist Builder.
                </div>
              )}
            </div>
            
          </CardContent>
        </Card>
      )}

      {/* Button Controls */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={prevStep} className="border-slate-800 text-slate-300 h-12 px-6">
            Vorige stap
          </Button>
        ) : (
          <div />
        )}

        {step < 5 ? (
          <Button type="button" onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 shadow-lg shadow-blue-900/20">
            Volgende stap
          </Button>
        ) : (
          <Button type="button" onClick={handleOnboard} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-10 shadow-lg shadow-emerald-900/20">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
            Onboarding Voltooien
          </Button>
        )}
      </div>

    </div>
  );
}
