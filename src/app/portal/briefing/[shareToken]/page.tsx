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
    <div className="min-h-screen bg-[#0F172A] pb-32">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1C243A] to-[#0F172A] border-b border-[#2A3552] pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-6">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase tracking-widest font-black text-[10px]">
              Campaign Briefing
            </Badge>
            {briefing.status === 'approved' && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 uppercase tracking-widest font-black text-[10px] flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Goedgekeurd
              </Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-headline text-white tracking-tight leading-tight">
            {briefing.title}
          </h1>
          <p className="text-xl text-slate-400 mt-4 max-w-2xl">
            Voorbereid voor <span className="text-white font-bold">{briefing.context.clientName}</span>.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 mt-12 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Context Summary */}
        <section>
          <h2 className="text-2xl font-bold text-slate-200 mb-6 flex items-center gap-2">
            <LayoutGrid className="size-6 text-blue-400" />
            Strategie & Doelen
          </h2>
          <Card className="bg-[#1C243A] border-[#2A3552] shadow-2xl">
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Primaire Doelen</h4>
                <p className="text-slate-200">{briefing.context.primaryGoals}</p>
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Doelgroep</h4>
                <p className="text-slate-200">{briefing.context.targetAudience}</p>
              </div>
              <div className="md:col-span-2">
                 <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Industrie Focus</h4>
                <p className="text-slate-200">{briefing.context.industry}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Campaigns */}
        <section>
          <h2 className="text-2xl font-bold text-slate-200 mb-6">Voorgestelde Campagnes ({briefing.campaigns.length})</h2>
          <div className="space-y-6">
            {briefing.campaigns.map((campaign, cIdx) => (
              <Card key={campaign.id} className="bg-[#1C243A] border-[#2A3552] shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-900/50 border-b border-white/5 py-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <Badge className="bg-blue-600 text-white hover:bg-blue-500 mb-3 uppercase tracking-wider text-[10px] font-bold">
                                {campaign.type === 'pmax' ? 'Performance Max' : 'Search Campaign'}
                            </Badge>
                            <CardTitle className="text-xl text-white">{campaign.name}</CardTitle>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Budget</span>
                            <span className="font-bold text-lg text-emerald-400">{campaign.suggestedBudget}</span>
                        </div>
                    </div>
                    <p className="text-slate-400 mt-4 leading-relaxed">{campaign.rationale}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="adgroups" className="border-none">
                        <AccordionTrigger className="px-6 py-4 hover:bg-white/5 text-slate-300 font-bold hover:no-underline data-[state=open]:bg-white/5">
                            Bekijk Ad Groups & Assets ({campaign.adGroups.length})
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-6 px-6">
                            <div className="space-y-6 mt-4">
                                {campaign.adGroups.map(ag => (
                                    <div key={ag.id} className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
                                        <h4 className="text-lg font-bold text-white mb-4">{ag.name}</h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Keywords */}
                                            {ag.keywords && ag.keywords.length > 0 && (
                                                <div className="bg-[#1C243A] rounded-xl p-4 border border-[#2A3552]">
                                                    <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-3">Keywords / Thema's</h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ag.keywords.map((kw, i) => (
                                                            <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700">
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ads */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Koppen</h5>
                                                    <ul className="space-y-2">
                                                        {ag.headlines.map((hl, i) => (
                                                            <li key={i} className="text-sm text-slate-300 flex justify-between items-start p-2 rounded-md hover:bg-white/5 group">
                                                                <span>{hl}</span>
                                                                <CopyButton textToCopy={hl} />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                
                                                <Separator className="bg-[#2A3552]" />
                                                
                                                <div>
                                                    <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Beschrijvingen</h5>
                                                    <ul className="space-y-2">
                                                        {ag.descriptions.map((desc, i) => (
                                                            <li key={i} className="text-sm text-slate-400 flex justify-between items-start p-2 rounded-md hover:bg-white/5 group leading-relaxed">
                                                                <span>{desc}</span>
                                                                <CopyButton textToCopy={desc} />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {campaign.type === 'pmax' && ag.longHeadlines && (
                                                    <>
                                                        <Separator className="bg-[#2A3552]" />
                                                        <div>
                                                            <h5 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Lange Koppen</h5>
                                                            <ul className="space-y-2">
                                                                {ag.longHeadlines.map((hl, i) => (
                                                                    <li key={i} className="text-sm text-slate-300 flex justify-between items-start p-2 rounded-md hover:bg-white/5 group">
                                                                        <span>{hl}</span>
                                                                        <CopyButton textToCopy={hl} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
