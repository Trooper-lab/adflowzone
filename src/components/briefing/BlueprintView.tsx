'use client';

import React from 'react';
import { Briefing, CampaignBriefing, AdGroupBriefing } from '@/lib/types';
import { CampaignBlock } from './CampaignBlock';
import { KeywordResearchBlock } from './KeywordResearchBlock';
import { TrackingTable } from './TrackingTable';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Share2, Download, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, Euro, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlueprintViewProps {
  briefing: Briefing;
  onStatusChange?: (status: 'draft' | 'approved') => void;
}

export function BlueprintView({ briefing, onStatusChange }: BlueprintViewProps) {
  const { context, campaigns, budgetAllocation, bidStrategy, kpis, tracking, timeline } = briefing;
  const [allExpanded, setAllExpanded] = React.useState(false);

  return (
    <div className="relative w-full mx-auto bg-transparent min-h-screen text-slate-100 font-sans pb-20 print:bg-white print:text-black print:my-0 print:rounded-none print:shadow-none print:ring-0">
      {/* ACTION BAR (Floating) */}
      <div className="sticky top-4 z-50 px-8 print:hidden">
        <div className="bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md rounded-xl px-6 py-3 flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${briefing.status === 'approved' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'} animate-pulse`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Status: <span className={briefing.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}>
                {briefing.status === 'approved' ? 'Gepubliceerd' : 'Draft Concept'}
              </span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white shadow-sm transition-all"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? <ChevronUp className="w-3 h-3 mr-1.5 text-slate-400" /> : <ChevronDown className="w-3 h-3 mr-1.5 text-slate-400" />}
              {allExpanded ? 'Alles Inklappen' : 'Alles Uitklappen'}
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1 border-slate-800" />
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white shadow-sm transition-all" 
              onClick={() => window.print()}
            >
              <Printer className="w-3 h-3 mr-1.5 text-slate-400" /> PDF Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white shadow-sm transition-all" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link gekopieerd naar klembord!');
              }}
            >
              <Share2 className="w-3 h-3 mr-1.5 text-slate-400" /> Delen
            </Button>
            {onStatusChange && (
               <Button 
                variant={briefing.status === 'approved' ? 'outline' : 'default'} 
                size="sm" 
                className={`rounded-sm h-8 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all ${
                  briefing.status === 'approved' 
                    ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white' 
                    : 'bg-primary hover:bg-primary/95 text-white border-0'
                }`}
                onClick={() => onStatusChange(briefing.status === 'approved' ? 'draft' : 'approved')}
              >
                {briefing.status === 'approved' ? 'Deselecteren' : 'Goedkeuren'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* HEADER - Premium Dark Style */}
      <header className="relative bg-gradient-to-br from-slate-950 to-slate-900/95 border-b border-slate-800/80 text-white pt-24 pb-32 px-12 lg:px-24 overflow-hidden rounded-t-3xl print:bg-white print:text-black print:border-b-2 print:border-slate-200">
        {/* GO Telemetry Orbit Overlays */}
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] text-slate-800/15 pointer-events-none rotate-[15deg] print:hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.15">
            <circle cx="50" cy="50" r="40" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="30" />
            <circle cx="50" cy="50" r="20" strokeDasharray="8 4" />
            <line x1="10" y1="50" x2="90" y2="50" />
            <line x1="50" y1="10" x2="50" y2="90" />
          </svg>
        </div>
        <div className="absolute bottom-[-30%] left-[-10%] w-[600px] h-[600px] text-slate-800/10 pointer-events-none rotate-[45deg] print:hidden">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.1">
            <circle cx="50" cy="50" r="35" />
            <circle cx="50" cy="50" r="15" strokeDasharray="2 4" />
            <line x1="20" y1="20" x2="80" y2="80" />
          </svg>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-16">
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
               <div className="text-xl font-black tracking-tighter flex items-center gap-1.5">
                <span className="text-white">GO</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/90 mb-2">Google Ads Strategy</div>
              <div className="text-2xl font-bold tracking-tight">Blueprint 2026</div>
            </div>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-5xl font-black tracking-tight leading-[1.1] mb-6">
              {briefing.title}
            </h1>
            <p className="text-xl text-slate-300 font-medium leading-relaxed mb-10">
              Uw route naar een lagere CPL en maximaal rendement voor <span className="text-white">{context.clientName}</span>.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-slate-300">Website: {context.website}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white" />
                <span className="text-xs font-bold text-slate-300">Taal: {context.language}</span>
              </div>
              {context.monthlyBudget && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-5 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-slate-300">
                    Budget: {context.monthlyBudget.includes('€') ? '' : '€'}{context.monthlyBudget} {context.monthlyBudget.toLowerCase().includes('maand') ? '' : '/ maand'}
                  </span>
                </div>
              )}
              <a href="#zoekwoorden-onderzoek" className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-5 py-3 flex items-center gap-3 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer print:hidden">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-300 hover:text-white transition-colors">Bekijk Zoekwoord Volumes</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* STRATEGIC OVERVIEW */}
      <div className="relative z-10 -mt-12 px-12">
        <Card className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl max-w-7xl mx-auto print:bg-white print:text-black print:border print:border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-primary mb-6 flex items-center gap-2 print:text-black">
                <span className="w-2 h-2 bg-primary rounded-full print:bg-black" />
                Strategische Doelen
              </h3>
              <ul className="space-y-4 mb-8">
                {(context.primaryGoals || '').split('\n').filter(g => g.trim()).map((goal, i) => (
                  <li key={i} className="flex items-start gap-4 text-slate-200 font-bold leading-relaxed print:text-slate-950">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 print:bg-slate-100">
                      <CheckCircle2 className="w-4 h-4 text-primary print:text-black" />
                    </div>
                    {goal.replace(/^[•\-\*]\s*/, '')}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-8">
              {context.usps && (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.15em] text-primary mb-6 flex items-center gap-2 print:text-black">
                    <span className="w-2 h-2 bg-primary rounded-full print:bg-black" />
                    Belangrijkste USP's
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {context.usps.split('\n').filter(u => u.trim()).map((usp, i) => (
                      <div key={i} className="bg-slate-950/20 text-xs font-bold text-slate-300 px-4 py-3 rounded-xl border border-slate-800/80 flex items-center gap-3 transition-all hover:bg-slate-900/40 hover:border-slate-700/50 print:bg-slate-50 print:text-slate-900 print:border-slate-200 group">
                        <div className="w-2 h-2 bg-primary rounded-full shrink-0 group-hover:scale-125 transition-transform print:bg-slate-800" />
                        {usp.replace(/^[•\-\*]\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={context.usps ? "pt-8 border-t border-slate-800 print:border-slate-200" : ""}>
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-primary mb-6 flex items-center gap-2 print:text-black">
                  <span className="w-2 h-2 bg-primary rounded-full print:bg-black" />
                  Basisgegevens
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/20 rounded-xl border border-slate-800/80 print:bg-slate-50 print:border-slate-200">
                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider print:text-slate-600">Locaties</div>
                    <div className="text-sm font-bold text-slate-200 print:text-slate-900">{context.targetLocations || 'Niet gespecificeerd'}</div>
                  </div>
                  <div className="p-4 bg-slate-950/20 rounded-xl border border-slate-800/80 print:bg-slate-50 print:border-slate-200">
                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider print:text-slate-600">Talen</div>
                    <div className="text-sm font-bold text-slate-200 print:text-slate-900">{context.targetLanguages || 'Niet gespecificeerd'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <main className="max-w-7xl mx-auto px-12 py-16 space-y-24">
        {/* 1. CAMPAIGN STRUCTURE */}
        <section>
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-primary/90 uppercase tracking-[0.2em] mb-2 print:text-slate-500">Sectie 01</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-100 print:text-black">Campagne Structuur</h2>
            </div>
            <div className="text-right text-slate-400 text-xs font-bold uppercase tracking-widest print:text-slate-600">
              Strategisch Voorstel
            </div>
          </div>
          
          <div className="space-y-8">
            {campaigns.map((camp, i) => (
              <CampaignBlock key={camp.id} campaign={camp} index={i + 1} expanded={allExpanded} website={context.website} />
            ))}
          </div>
        </section>

        {/* 2. ZOEKWOORDEN ONDERZOEK */}
        <section id="zoekwoorden-onderzoek" className="pt-12 border-t border-slate-800 print:border-slate-200 scroll-mt-32">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-primary/90 uppercase tracking-[0.2em] mb-2 print:text-slate-500">Sectie 02</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-100 print:text-black">Zoekwoorden Onderzoek</h2>
            </div>
            <div className="text-right text-slate-400 text-xs font-bold uppercase tracking-widest print:text-slate-600">
              Marktanalyse & Intentie
            </div>
          </div>
          
          <KeywordResearchBlock context={context} />
        </section>

        {/* 3. TRACKING & DATA STRATEGIE */}
        <section className="pt-12 border-t border-slate-800 print:border-slate-200">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-primary/90 uppercase tracking-[0.2em] mb-2 print:text-slate-500">Sectie 03</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-100 print:text-black">Tracking & Data Strategie</h2>
            </div>
          </div>
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl overflow-hidden print:bg-white print:border-slate-200">
            <div className="bg-slate-950/20 px-10 py-6 border-b border-slate-800 flex items-center gap-3 print:bg-slate-50 print:border-slate-200">
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-sm print:bg-white print:border-slate-200">
                <BarChart3 className="size-4 text-emerald-500" />
              </div>
              <span className="text-sm font-black text-slate-200 uppercase tracking-widest print:text-slate-900">Conversie Doelen & Setup</span>
            </div>
            <div className="p-0">
              {tracking && tracking.length > 0 ? (
                <TrackingTable tracking={tracking} />
              ) : (
                <div className="p-20 text-center">
                  <div className="bg-slate-950/20 size-16 rounded-xl flex items-center justify-center mx-auto mb-6 border border-slate-800">
                      <AlertCircle className="size-8 text-slate-500" />
                  </div>
                  <div className="text-slate-400 text-sm font-black uppercase tracking-widest">Geen tracking gegevens beschikbaar.</div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>

      <footer className="bg-transparent border-t border-slate-800/80 text-slate-500 px-12 py-12 print:border-slate-200 print:bg-white print:text-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-800 pb-12 mb-12 print:border-slate-200">
          <div className="text-xl font-black tracking-tighter flex items-center gap-1.5 grayscale opacity-70">
            <span className="text-white print:text-black">GO</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-500 print:text-slate-700">© 2026 Only Forward B.V.</span>
            <span className="text-slate-500 print:text-slate-700">Vertrouwelijk document</span>
          </div>
        </div>
        <div className="text-center text-[10px] font-medium text-slate-500 print:text-slate-700">
          Gegenereerd door AI Architect | Project: {context.clientName} | {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </footer>
    </div>
  );
}
