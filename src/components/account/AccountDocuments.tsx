'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Link as LinkIcon, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";

interface AccountDocumentsProps {
  childAccountRef: DocumentReference;
}

export default function AccountDocuments({ childAccountRef }: AccountDocumentsProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);

  // Fetch documents
  const docsQuery = useMemo(
    () => query(collection(childAccountRef, 'documents'), orderBy('createdAt', 'desc')),
    [childAccountRef]
  );
  const { data: documentsData, loading } = useCollection(docsQuery);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    let parsedUrl = url;
    if (!parsedUrl.startsWith('http://') && !parsedUrl.startsWith('https://')) {
      parsedUrl = 'https://' + parsedUrl;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(childAccountRef, 'documents'), {
        title: title.trim(),
        url: parsedUrl,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setUrl('');
      toast({ title: 'Link toegevoegd', description: 'De externe link is succesvol opgeslagen.' });
    } catch (error) {
      console.error('Error adding document:', error);
      toast({ variant: 'destructive', title: 'Fout bij toevoegen', description: 'Er ging iets mis tijdens het opslaan.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (docId: string) => {
    setDeleteLinkId(docId);
  };

  const confirmDelete = async () => {
    if (!deleteLinkId) return;
    try {
      await deleteDoc(doc(childAccountRef, 'documents', deleteLinkId));
      toast({ title: 'Link verwijderd' });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({ variant: 'destructive', title: 'Fout bij verwijderen' });
    } finally {
      setDeleteLinkId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#1C243A] border border-[#2A3552] p-6">
        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <LinkIcon className="size-5 text-blue-400" />
          Nieuwe Link Toevoegen
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Bewaar hier belangrijke links naar Google Drive mappen, gedeelde Spreadsheets of externe dashboards.
        </p>

        <form onSubmit={handleAddDocument} className="flex flex-col sm:flex-row gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel (bijv. Maandelijkse Rapportage)"
            className="bg-[#1C243A] border-[#2A3552] text-white flex-1"
            required
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="bg-[#1C243A] border-[#2A3552] text-white flex-1"
            type="url"
            required
          />
          <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white shrink-0">
            {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
            Toevoegen
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="size-8 animate-spin text-blue-500" /></div>
        ) : documentsData && documentsData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentsData.map((docData: any) => {
              const date = docData.createdAt?.toDate ? docData.createdAt.toDate() : new Date();
              return (
                <div key={docData.id} className="rounded-xl bg-[#1C243A] border border-[#2A3552] p-4 flex flex-col justify-between group hover:border-blue-500/30 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <h4 className="font-bold text-slate-200 line-clamp-2" title={docData.title}>{docData.title}</h4>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1">
                        Toegevoegd: {format(date, 'd MMM yyyy', { locale: nl })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(docData.id)}
                      className="size-8 text-slate-600 hover:text-red-400 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 text-blue-400 justify-center" 
                    asChild
                  >
                    <a href={docData.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4 mr-2" /> Openen
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-[#1C243A] border border-[#2A3552] border-dashed p-10 flex flex-col items-center justify-center text-center">
            <LinkIcon className="size-10 text-slate-600 mb-3" />
            <p className="text-slate-300 font-medium">Nog geen links opgeslagen</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Voeg bovenaan een link toe om snel toegang te krijgen tot belangrijke bestanden en rapportages.
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteLinkId} onOpenChange={(open) => !open && setDeleteLinkId(null)}>
        <AlertDialogContent className="glass-card-elevated border-border bg-[#1C243A] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Link verwijderen?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 font-medium">
              Weet je zeker dat je deze link wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-slate-300 hover:bg-accent hover:text-white">Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
