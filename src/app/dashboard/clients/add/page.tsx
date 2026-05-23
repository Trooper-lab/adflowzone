
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { addDoc, collection, getDocs, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, CalendarIcon, PlusCircle, Trash2, Users } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { checklists } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { ConnectedChecklist, AppUser } from '@/lib/types';


const parentClientSchema = z.object({
  clientType: z.enum(['agency', 'freelancer'], {
    required_error: 'You need to select a client type.',
  }),
  clientName: z.string().min(2, 'Client name must be at least 2 characters.'),
  clientContactPerson: z.string().min(2, 'Contact person must be at least 2 characters.'),
  clientContactEmail: z.string().email('Please enter a valid email address.'),
  clientUserEmail: z.string().email('You must provide a portal login email.'),
  clientWebsite: z.string().url().optional().or(z.literal('')),
  internalNotes: z.string().optional(),
  hourlyRate: z.coerce.number().min(0, 'Hourly rate must be a positive number.').optional(),
});

type ParentClientFormData = z.infer<typeof parentClientSchema>;

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
    startDate: z.date(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'one-off']),
});

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
    connectedChecklists: z.array(connectedChecklistSchema).optional(),
});

type ChildAccountFormData = z.infer<typeof childAccountSchema>;


function ParentClientForm({ onSave }: { onSave: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ParentClientFormData>({
    resolver: zodResolver(parentClientSchema),
    defaultValues: {
      clientType: 'agency',
      clientName: '',
      clientContactPerson: '',
      clientContactEmail: '',
      clientUserEmail: '',
      clientWebsite: '',
      internalNotes: '',
      hourlyRate: 0,
    },
  });

  async function onSubmit(data: ParentClientFormData) {
    if (!firestore || !user) {
      console.error('Firestore or user not available');
      return;
    }
    setLoading(true);

    const clientData = {
      ...data,
      ownerId: user.uid,
    };

    const parentClientsCollection = collection(firestore, 'parentClients');
    addDoc(parentClientsCollection, clientData)
      .then((docRef) => {
        toast({
            title: 'Client Saved',
            description: `${data.clientName} has been saved successfully.`,
        });
        onSave(docRef.id);
      })
      .catch((e: any) => {
          console.error("Error adding document: ", e);
          const permissionError = new FirestorePermissionError({
              path: parentClientsCollection.path,
              operation: 'create',
              requestResourceData: clientData,
          });
          errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
          setLoading(false);
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Add Your New Client Agency/Freelancer</CardTitle>
        <CardDescription>
          Identify the white-label customer and establish their branding for reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Client Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="agency" />
                        </FormControl>
                        <FormLabel className="font-normal">Agency</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="freelancer" />
                        </FormControl>
                        <FormLabel className="font-normal">Freelancer</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Digital Growth Agency" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientContactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Main Contact Person</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientContactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>General Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., john.smith@digitalgrowth.com" {...field} />
                  </FormControl>
                  <FormDescription>This is the primary email for general communication.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="clientUserEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Portal Login Email</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., client.portal@digitalgrowth.com" {...field} />
                  </FormControl>
                   <FormDescription>The email your client will use to sign in to their portal.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="clientWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Website (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.digitalgrowth.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Client is focused on lead gen for B2B..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standaard Uurtarief (€)</FormLabel>
                  <FormControl>
                     <div className="relative">
                         <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                         <Input type="number" placeholder="75.00" {...field} className="pl-7" />
                     </div>
                  </FormControl>
                  <FormDescription>Het uurtarief dat standaard wordt berekend voor losse uren.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Client &amp; Continue
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChildAccountForm({ parentClientId }: { parentClientId: string }) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<AppUser[]>([]);
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    const userDocRef = useMemo(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: appUser } = useDoc(userDocRef);

    const isAdmin = useMemo(() => {
        const role = (appUser as any)?.role?.toLowerCase();
        return role === 'admin' || user?.email === 'billy@pearsonline.nl' || user?.email === 'billy@trooper.es';
    }, [appUser, user?.email]);

    const form = useForm<ChildAccountFormData>({
        resolver: zodResolver(childAccountSchema),
        defaultValues: {
            nickname: '',
            googleAdsClientId: '',
            googleAdsAccountName: '',
            assignedEmployeeId: null,
            managementFee: { amount: 0, frequency: 'monthly' },
            monthlyClickBudget: 0,
            primaryGoal: 'lead_generation',
            kpisToTrack: [],
            connectedChecklists: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "connectedChecklists",
    });

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

    function handleReset() {
        form.reset();
        toast({
            title: 'Form Cleared',
            description: 'You can now add another Google Ads account.',
        });
    }

    async function onSubmit(data: ChildAccountFormData) {
        if (!firestore || !user) {
            console.error('Firestore or user not available');
            return;
        }
        setLoading(true);

        const childAccountData = {
            ...data,
            ownerId: user.uid,
            parentClientId: parentClientId,
            // Convert dates to ISO strings for Firestore
            connectedChecklists: data.connectedChecklists?.map(c => ({
                ...c,
                startDate: c.startDate.toISOString(),
            })),
        };

        const childAccountsCollection = collection(firestore, 'parentClients', parentClientId, 'childAccounts');

        addDoc(childAccountsCollection, childAccountData)
            .then((docRef) => {
                toast({
                    title: 'Google Ads Account Saved',
                    description: `${data.nickname} has been added successfully.`,
                });
                handleReset(); // Clear form for next entry
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
                         <div className={cn("grid grid-cols-1 gap-4", isAdmin ? "md:grid-cols-2" : "md:grid-cols-1")}>
                            <FormField
                                control={form.control}
                                name="monthlyClickBudget"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Monthly Click Budget</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">€</span>
                                            <Input type="number" placeholder="1000.00" {...field} className="pl-7" />
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
                                                <Input type="number" placeholder="0.00" {...field} className="pl-7" />
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
                                                        ? field.onChange([...field.value, item.id])
                                                        : field.onChange(
                                                            field.value?.filter(
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
                    </div>
                     <div className="space-y-4">
                        <h3 className="text-lg font-medium font-headline">Checklist Setup</h3>
                        <Separator />
                         <FormDescription>Connect recurring checklists to this account upon creation.</FormDescription>
                        
                        <div className="space-y-4">
                             {fields.map((field, index) => (
                                 <div key={field.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end p-4 border rounded-lg">
                                     <FormField
                                        control={form.control}
                                        name={`connectedChecklists.${index}.checklistId`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Checklist</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
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
                                     <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="text-destructive"/>
                                     </Button>
                                 </div>
                             ))}
                             <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ checklistId: '', startDate: new Date(), frequency: 'weekly' })}
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
                        Save &amp; Add Another Account
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/dashboard/clients')}>Finish Setup</Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}


export default function AddClientPage() {
  const [step, setStep] = useState(1);
  const [parentClientId, setParentClientId] = useState<string | null>(null);

  const handleParentClientSave = (id: string) => {
    setParentClientId(id);
    setStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto">
        <div className="mb-6">
            <h1 className="font-headline text-3xl font-bold">Add New Client & Account</h1>
            <p className="text-muted-foreground">Follow these two steps to onboard a new client.</p>
        </div>
      {step === 1 && (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold">1</div>
                <h2 className="text-xl font-semibold font-headline">Add The Parent Client</h2>
            </div>
            <ParentClientForm onSave={handleParentClientSave} />
        </div>
      )}
      {step === 2 && parentClientId && (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold">2</div>
                <h2 className="text-xl font-semibold font-headline">Add The Google Ads Account</h2>
            </div>
            <ChildAccountForm parentClientId={parentClientId} />
        </div>
      )}
    </div>
  );
}
