'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Briefing } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Briefcase, LayoutGrid, CheckCircle2, ChevronDown, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BlueprintView } from '@/components/briefing/BlueprintView';

function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast({ title: 'Gekopieerd!' });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="ghost" size="icon" className="size-6 text-slate-500 hover:text-white hover:bg-white/10" onClick={handleCopy}>
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </Button>
  );
}

export default function ClientBriefingView() {
  const { shareToken } = useParams() as { shareToken: string };
  const firestore = useFirestore();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !shareToken) return;

    const fetchBriefing = async () => {
      try {
        const docRef = doc(firestore, 'briefings', shareToken);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists() && snapshot.data().shareToken) {
          setBriefing({ id: snapshot.id, ...snapshot.data() } as Briefing);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [firestore, shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <Loader2 className="animate-spin text-blue-500 size-12" />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] text-center p-8">
        <Briefcase className="size-16 text-slate-700 mb-6" />
        <h1 className="text-3xl font-bold text-slate-200">Briefing Niet Gevonden</h1>
        <p className="text-slate-500 mt-2 max-w-md">De opgevraagde briefing kon niet worden gevonden of de link is ongeldig. Neem contact op met je accountmanager.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <BlueprintView briefing={briefing} />
      </div>
    </div>
  );
}
