'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import type { ParentClient } from '@/lib/types';

// ─── Constants & Styles ───────────────────────────────────────────────────────

const inputCn =
  'bg-secondary border-border text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500/50';

const Required = () => <span className="text-red-400 ml-0.5">*</span>;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-3 border-b border-border bg-white/[0.03]">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          {title}
        </p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const parentClientSchema = z.object({
  clientType: z.enum(['agency', 'freelancer'], {
    required_error: 'Selecteer een klanttype.',
  }),
  clientName: z.string().min(2, 'Naam moet minimaal 2 tekens zijn.'),
  clientContactPerson: z.string().min(2, 'Contactpersoon is verplicht.'),
  clientContactEmail: z.string().email('Voer een geldig e-mailadres in.'),
  clientUserEmail: z.string().email('Inlog e-mailadres is verplicht.'),
  clientWebsite: z.string().url('Voer een geldige URL in.').optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  brandColors: z.object({
    primary: z.string().optional().or(z.literal('')),
    secondary: z.string().optional().or(z.literal('')),
  }).optional(),
  brandFonts: z.object({
    headings: z.string().optional().or(z.literal('')),
    body: z.string().optional().or(z.literal('')),
  }).optional(),
  internalNotes: z.string().optional(),
  hourlyRate: z.coerce.number().min(0, 'Uurtarief moet positief zijn.').optional(),
});

type ParentClientFormData = z.infer<typeof parentClientSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ParentClientFormProps {
  initialData?: ParentClient;
  onSaveSuccess?: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function ParentClientForm({
  initialData,
  onSaveSuccess,
  onCancel,
  submitLabel = 'Klant Opslaan & Doorgaan',
}: ParentClientFormProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isEdit = !!initialData;

  const form = useForm<ParentClientFormData>({
    resolver: zodResolver(parentClientSchema),
    defaultValues: {
      clientType: 'agency',
      clientName: '',
      clientContactPerson: '',
      clientContactEmail: '',
      clientUserEmail: '',
      clientWebsite: '',
      logoUrl: '',
      brandColors: {
        primary: '#000000',
        secondary: '#ffffff',
      },
      brandFonts: {
        headings: 'Outfit',
        body: 'Inter',
      },
      internalNotes: '',
      hourlyRate: 0,
    },
  });

  // Load initial data for edit mode
  useEffect(() => {
    if (initialData) {
      form.reset({
        clientType: initialData.clientType || 'agency',
        clientName: initialData.clientName || '',
        clientContactPerson: initialData.clientContactPerson || '',
        clientContactEmail: initialData.clientContactEmail || '',
        clientUserEmail: initialData.clientUserEmail || '',
        clientWebsite: initialData.clientWebsite || '',
        logoUrl: initialData.logoUrl || '',
        brandColors: {
          primary: initialData.brandColors?.primary || '#000000',
          secondary: initialData.brandColors?.secondary || '#ffffff',
        },
        brandFonts: {
          headings: initialData.brandFonts?.headings || 'Outfit',
          body: initialData.brandFonts?.body || 'Inter',
        },
        internalNotes: initialData.internalNotes || '',
        hourlyRate: initialData.hourlyRate || 0,
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: ParentClientFormData) {
    if (!firestore || !user) {
      console.error('Firestore of gebruiker is niet beschikbaar');
      return;
    }
    setLoading(true);

    const clientData = {
      ...data,
      ownerId: user.uid,
    };

    try {
      let savedId = '';
      if (isEdit && initialData) {
        const clientDocRef = doc(firestore, 'parentClients', initialData.id);
        await updateDoc(clientDocRef, clientData);
        savedId = initialData.id;
        toast({
          title: 'Klant bijgewerkt',
          description: `${data.clientName} is succesvol bijgewerkt.`,
        });
      } else {
        const parentClientsCollection = collection(firestore, 'parentClients');
        const docRef = await addDoc(parentClientsCollection, clientData);
        savedId = docRef.id;
        toast({
          title: 'Klant opgeslagen',
          description: `${data.clientName} is succesvol toegevoegd.`,
        });
      }

      onSaveSuccess?.(savedId);
    } catch (e: any) {
      console.error('Fout bij opslaan document:', e);
      const permissionError = new FirestorePermissionError({
        path: 'parentClients',
        operation: isEdit ? 'update' : 'create',
        requestResourceData: clientData,
      });
      errorEmitter.emit('permission-error', permissionError);

      toast({
        variant: 'destructive',
        title: 'Fout bij opslaan',
        description: e?.message ?? 'Er is iets misgegaan.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        
        {/* ── Section 1 — Algemene Gegevens ── */}
        <Section title="Algemene Gegevens">
          <FormField
            control={form.control}
            name="clientType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-slate-300">Klant Type <Required /></FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-row space-x-6"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="agency" className="border-slate-600 text-blue-500" />
                      </FormControl>
                      <FormLabel className="font-normal text-slate-300 cursor-pointer">Agency</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="freelancer" className="border-slate-600 text-blue-500" />
                      </FormControl>
                      <FormLabel className="font-normal text-slate-300 cursor-pointer">Freelancer</FormLabel>
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
                <FormLabel className="text-slate-300">Klant Naam <Required /></FormLabel>
                <FormControl>
                  <Input placeholder="bijv. RAAKER of Digital Growth" {...field} className={inputCn} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Website (Optioneel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.digitalgrowth.com" {...field} className={inputCn} />
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
                  <FormLabel className="text-slate-300">Standaard Uurtarief</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm pointer-events-none">
                        €
                      </span>
                      <Input type="number" min={0} placeholder="75.00" {...field} className={cn(inputCn, 'pl-7')} />
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs text-slate-500">
                    Het uurtarief dat standaard wordt berekend voor urenregistraties.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* ── Section 2 — Contactpersoon & Portaal ── */}
        <Section title="Contactpersoon & Portaal">
          <FormField
            control={form.control}
            name="clientContactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Primair Contactpersoon <Required /></FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} className={inputCn} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientContactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Algemeen Contact E-mail <Required /></FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" {...field} className={inputCn} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-500 font-normal">
                    Primair e-mailadres voor algemene communicatie.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientUserEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Klantportaal Inlog E-mail <Required /></FormLabel>
                  <FormControl>
                    <Input placeholder="portaal@example.com" {...field} className={inputCn} />
                  </FormControl>
                  <FormDescription className="text-xs text-slate-500 font-normal">
                    Het e-mailadres dat de klant gebruikt om in te loggen in zijn portaal.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* ── Section 3 — Huisstijl & Branding ── */}
        <Section title="Huisstijl & Branding">
          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Logo URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/logo.png" {...field} className={inputCn} />
                </FormControl>
                <FormDescription className="text-xs text-slate-500 font-normal">
                  URL naar het logo van de agency.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="brandColors.primary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Primaire Kleur</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl>
                      <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer bg-secondary border-border" />
                    </FormControl>
                    <Input placeholder="#000000" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} className={inputCn} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brandColors.secondary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Secundaire Kleur</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl>
                      <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer bg-secondary border-border" />
                    </FormControl>
                    <Input placeholder="#ffffff" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} className={inputCn} />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="brandFonts.headings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Koppen Lettertype</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'Outfit'}>
                    <FormControl>
                      <SelectTrigger className={inputCn}>
                        <SelectValue placeholder="Kies lettertype" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-border text-slate-200">
                      <SelectItem value="Alegreya">Alegreya (Serif)</SelectItem>
                      <SelectItem value="Inter">Inter (Sans)</SelectItem>
                      <SelectItem value="Outfit">Outfit (Display)</SelectItem>
                      <SelectItem value="Roboto">Roboto (Sans)</SelectItem>
                      <SelectItem value="Montserrat">Montserrat (Sans)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brandFonts.body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Broodtekst Lettertype</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'Inter'}>
                    <FormControl>
                      <SelectTrigger className={inputCn}>
                        <SelectValue placeholder="Kies lettertype" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-border text-slate-200">
                      <SelectItem value="Inter">Inter (Sans)</SelectItem>
                      <SelectItem value="Roboto">Roboto (Sans)</SelectItem>
                      <SelectItem value="Open Sans">Open Sans (Sans)</SelectItem>
                      <SelectItem value="Lato">Lato (Sans)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* ── Section 4 — Interne Notities ── */}
        <Section title="Interne Notities">
          <FormField
            control={form.control}
            name="internalNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Interne Notities (Optioneel)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Klantspecifieke opmerkingen..." {...field} className={inputCn} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* ── Action Row ── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={onCancel}
              disabled={loading}
            >
              Annuleren
            </Button>
          ) : (
            <div />
          )}
          
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
