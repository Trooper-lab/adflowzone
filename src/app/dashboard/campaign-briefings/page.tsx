'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Briefing } from '@/lib/types';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Calendar, ChevronRight, Share2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc } from 'firebase/firestore';

function CopyLinkButton({ briefingId }: { briefingId: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/portal/briefing/${briefingId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: 'Link gekopieerd!' });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" size="sm" className="h-8 gap-2 bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300" onClick={handleCopy}>
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      <span className="text-[10px] uppercase font-bold tracking-wider">Kopieer Link</span>
    </Button>
  );
}

export default function CampaignBriefingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: appUser } = useDoc(userDocRef);

  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user || !appUser) return;

    const fetchBriefings = async () => {
      try {
        setLoading(true);
        // Admin sees all, employees see their own or based on assigned accounts (simplified for now to ownerId)
        const role = (appUser as any)?.role?.toLowerCase();
        const isAdmin = role === 'admin' || 
                        user.email === 'billy@pearsonline.nl' || 
                        user.email === 'billy@trooper.es' ||
                        user.email?.toLowerCase() === 'admin@onlyforward.nl';
        
        let q;
        if (isAdmin) {
             q = query(collection(firestore, 'briefings'), orderBy('updatedAt', 'desc'));
        } else {
             q = query(collection(firestore, 'briefings'), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc'));
        }
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Briefing));
        setBriefings(data);
      } catch (err) {
        console.error("Error fetching briefings:", err);
        toast({ variant: 'destructive', title: 'Fout bij ophalen briefings' });
      } finally {
        setLoading(false);
      }
    };

    fetchBriefings();
  }, [firestore, user, appUser, toast]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                <Briefcase className="text-blue-400 size-8" />
                Campaign Briefings
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">Beheer en deel campagnevoorstellen met je klanten.</p>
        </div>
        <Link href="/dashboard/campaign-briefings/new">
          <Button className="h-12 px-6 font-black bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
            <Plus className="size-5 mr-2" />
            Nieuwe Briefing
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="glass-card h-64 animate-pulse" />
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-slate-900/20 rounded-3xl border-2 border-dashed border-white/5 text-center">
            <Briefcase className="size-12 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-300">Geen briefings gevonden</h3>
            <p className="text-slate-500 mt-2">Maak je eerste AI-gestuurde briefing aan.</p>
            <Link href="/dashboard/campaign-briefings/new" className="mt-6">
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white">
                    <Plus className="size-4 mr-2" />
                    Start nu
                </Button>
            </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {briefings.map(briefing => (
            <Link href={`/dashboard/campaign-briefings/${briefing.id}`} key={briefing.id} className="block group">
              <Card className="glass-card shadow-xl group-hover:border-blue-500/50 transition-all h-full flex flex-col">
                <CardHeader className="pb-3 border-b border-white/5">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={briefing.status === 'approved' ? 'default' : 'secondary'} className={briefing.status === 'approved' ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"}>
                        {briefing.status === 'approved' ? 'Goedgekeurd' : 'Concept'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-1">
                    {briefing.title}
                  </CardTitle>
                  <CardDescription className="text-slate-400 line-clamp-1">
                    {briefing.context.clientName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 flex-grow space-y-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="size-4" />
                    <span>{format(new Date(briefing.updatedAt), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Briefcase className="size-4" />
                    <span>{briefing.campaigns.length} Campagnes</span>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-4 flex justify-between items-center bg-slate-900/50 rounded-b-xl">
                  {briefing.shareToken ? (
                      <CopyLinkButton briefingId={briefing.id} />
                  ) : <div/>}
                  <Button variant="ghost" size="icon" className="size-8 text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10">
                    <ChevronRight className="size-5" />
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
