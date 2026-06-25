'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { AmbientBackground } from '@/components/AmbientBackground';

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
    <Button variant="ghost" size="icon" className="size-6 text-slate-500 hover:text-white hover:bg-accent" onClick={handleCopy}>
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </Button>
  );
}

export default function ClientBriefingView() {
  const { shareToken } = useParams() as { shareToken: string };
  const firestore = useFirestore();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [parentClient, setParentClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !shareToken) return;

    const fetchBriefing = async () => {
      try {
        const docRef = doc(firestore, 'briefings', shareToken);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists() && snapshot.data().shareToken) {
          const briefingData = { id: snapshot.id, ...snapshot.data() } as Briefing;
          setBriefing(briefingData);
          
          if (briefingData.context.parentClientId) {
            const pcRef = doc(firestore, 'parentClients', briefingData.context.parentClientId);
            const pcSnap = await getDoc(pcRef);
            if (pcSnap.exists()) {
              setParentClient(pcSnap.data());
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [firestore, shareToken]);

  const hexToHsl = (hex: string): string => {
    const cleanedHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanedHex.length !== 3 && cleanedHex.length !== 6) {
      return '221.2 83.2% 53.3%';
    }
    
    let r = 0, g = 0, b = 0;
    if (cleanedHex.length === 3) {
      r = parseInt(cleanedHex[0] + cleanedHex[0], 16);
      g = parseInt(cleanedHex[1] + cleanedHex[1], 16);
      b = parseInt(cleanedHex[2] + cleanedHex[2], 16);
    } else {
      r = parseInt(cleanedHex.slice(0, 2), 16);
      g = parseInt(cleanedHex.slice(2, 4), 16);
      b = parseInt(cleanedHex.slice(4, 6), 16);
    }
    
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const primaryHsl = useMemo(() => parentClient?.brandColors?.primary ? hexToHsl(parentClient.brandColors.primary) : null, [parentClient?.brandColors?.primary]);
  const secondaryHsl = useMemo(() => parentClient?.brandColors?.secondary ? hexToHsl(parentClient.brandColors.secondary) : null, [parentClient?.brandColors?.secondary]);
  
  const headingsFont = parentClient?.brandFonts?.headings || 'Outfit';
  const bodyFont = parentClient?.brandFonts?.body || 'Inter';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d11]">
        <Loader2 className="animate-spin text-blue-500 size-12" />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0d11] text-center p-8">
        <Briefcase className="size-16 text-slate-700 mb-6" />
        <h1 className="text-3xl font-bold text-slate-200">Briefing Niet Gevonden</h1>
        <p className="text-slate-500 mt-2 max-w-md">De opgevraagde briefing kon niet worden gevonden of de link is ongeldig. Neem contact op met je accountmanager.</p>
      </div>
    );
  }

  return (
    <>
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${headingsFont.replace(' ', '+')}:wght@400;600;700&family=${bodyFont.replace(' ', '+')}:wght@400;500;600&display=swap`}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${primaryHsl ? `--primary: ${primaryHsl} !important;` : ''}
          ${secondaryHsl ? `--secondary: ${secondaryHsl} !important; --accent: ${secondaryHsl} !important;` : ''}
        }
        body, .font-sans, .font-body {
          font-family: '${bodyFont}', sans-serif !important;
        }
        h1, h2, h3, h4, h5, h6, .font-headline {
          font-family: '${headingsFont}', sans-serif !important;
        }
      `}} />
      
      <div className="min-h-screen bg-[#0b0d11] text-slate-100 py-12 relative overflow-hidden">
        <AmbientBackground />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          {parentClient?.logoUrl && (
            <div className="flex justify-center mb-8">
              <img src={parentClient.logoUrl} alt={parentClient.clientName} className="h-12 object-contain" />
            </div>
          )}
          <BlueprintView briefing={briefing} />
        </div>
      </div>
    </>
  );
}
