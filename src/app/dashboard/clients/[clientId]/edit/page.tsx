
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { ParentClient } from '@/lib/types';
import { useMemo } from 'react';

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


export default function EditClientPage() {
  const [loading, setLoading] = useState(false);
  const { clientId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const clientDocRef = useMemo(() => (firestore && clientId ? doc(firestore, 'parentClients', clientId as string) : null), [firestore, clientId]);
  const { data: client, loading: clientLoading } = useDoc(clientDocRef);
  
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

  useEffect(() => {
    if (client) {
      form.reset(client);
    }
  }, [client, form]);
  
  async function onSubmit(data: ParentClientFormData) {
    if (!firestore || !user || !clientId || !clientDocRef) {
      console.error('Dependencies not available');
      return;
    }
    setLoading(true);

    updateDoc(clientDocRef, data)
        .then(() => {
            toast({
                title: 'Client Updated',
                description: `${data.clientName} has been updated successfully.`,
            });
            router.push(`/dashboard/clients/${clientId}`);
        })
        .catch((e: any) => {
            console.error("Error updating document: ", e);
            const permissionError = new FirestorePermissionError({
                path: clientDocRef.path,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setLoading(false);
        });
  }
  
  if (clientLoading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin" /> Loading client data...</div>;
  }
  
  if (!client) {
    return <div>Client not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
        <div className="mb-6">
            <h1 className="font-headline text-3xl font-bold">Edit Client</h1>
            <p className="text-muted-foreground">Update the details for {client.clientName}.</p>
        </div>
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="pt-6 space-y-8">
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
