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
    <div className="relative w-full mx-auto bg-white min-h-screen text-[#1e293b] font-sans pb-20 print:my-0 print:rounded-none print:shadow-none print:ring-0">
      {/* ACTION BAR (Floating) */}
      <div className="sticky top-4 z-50 px-8 print:hidden">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-sm px-6 py-3 flex items-center justify-between gap-4 max-w-5xl mx-auto ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${briefing.status === 'approved' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'} animate-pulse`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Status: <span className={briefing.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}>
                {briefing.status === 'approved' ? 'Gepubliceerd' : 'Draft Concept'}
              </span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? <ChevronUp className="w-3 h-3 mr-1.5 text-slate-500" /> : <ChevronDown className="w-3 h-3 mr-1.5 text-slate-500" />}
              {allExpanded ? 'Alles Inklappen' : 'Alles Uitklappen'}
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all" 
              onClick={() => window.print()}
            >
              <Printer className="w-3 h-3 mr-1.5 text-slate-500" /> PDF Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link gekopieerd naar klembord!');
              }}
            >
              <Share2 className="w-3 h-3 mr-1.5 text-slate-500" /> Delen
            </Button>
            {onStatusChange && (
               <Button 
                variant={briefing.status === 'approved' ? 'outline' : 'default'} 
                size="sm" 
                className={`rounded-sm h-8 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all ${
                  briefing.status === 'approved' 
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white border-0'
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
      <header className="relative bg-[#1A3C94] text-white pt-24 pb-32 px-12 lg:px-24 overflow-hidden">
        {/* Abstract Background Elements */}
        <svg viewBox="0 0 100 100" className="absolute top-[-30%] right-[-10%] w-[1000px] h-[1000px] text-white/20 pointer-events-none rotate-[15deg]" fill="none" stroke="currentColor" strokeWidth="0.2">
          <path d="M41.012 17.917c3.962-6.862 14.014-6.862 17.976 0l29.434 50.98c3.962 6.863-1.064 15.438-8.988 15.438H20.566c-7.924 0-12.95-8.575-8.988-15.438l29.434-50.98z" />
        </svg>
        <svg viewBox="0 0 100 100" className="absolute top-[10%] right-[5%] w-[600px] h-[600px] text-white/10 pointer-events-none -rotate-[25deg]" fill="none" stroke="currentColor" strokeWidth="0.33">
          <path d="M41.012 17.917c3.962-6.862 14.014-6.862 17.976 0l29.434 50.98c3.962 6.863-1.064 15.438-8.988 15.438H20.566c-7.924 0-12.95-8.575-8.988-15.438l29.434-50.98z" />
        </svg>
        <svg viewBox="0 0 100 100" className="absolute bottom-[-50%] left-[-20%] w-[800px] h-[800px] text-white/15 pointer-events-none rotate-[45deg]" fill="none" stroke="currentColor" strokeWidth="0.25">
          <path d="M41.012 17.917c3.962-6.862 14.014-6.862 17.976 0l29.434 50.98c3.962 6.863-1.064 15.438-8.988 15.438H20.566c-7.924 0-12.95-8.575-8.988-15.438l29.434-50.98z" />
        </svg>
        
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-16">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-sm">
               <div className="text-xl font-black tracking-tighter flex items-center gap-1.5">
                <span className="text-white">ADFLOWZONE</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b3d4ff] mb-2">Google Ads Strategy</div>
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
              <div className="bg-white/5 border border-white/10 rounded-sm px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1A3C94]" />
                <span className="text-xs font-bold text-slate-300">Website: {context.website}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-sm px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white" />
                <span className="text-xs font-bold text-slate-300">Taal: {context.language}</span>
              </div>
              {context.monthlyBudget && (
                <div className="bg-white/5 border border-white/10 rounded-sm px-5 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#b3d4ff]" />
                  <span className="text-xs font-bold text-slate-300">
                    Budget: {context.monthlyBudget.includes('€') ? '' : '€'}{context.monthlyBudget} {context.monthlyBudget.toLowerCase().includes('maand') ? '' : '/ maand'}
                  </span>
                </div>
              )}
              <a href="#zoekwoorden-onderzoek" className="bg-white/5 border border-white/10 rounded-sm px-5 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-300 hover:text-white transition-colors">Bekijk Zoekwoord Volumes</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* STRATEGIC OVERVIEW */}
      <div className="relative z-10 -mt-12 px-12">
        <Card className="p-8 rounded-sm border border-slate-200 shadow-sm bg-white max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-[#1A3C94] mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#1A3C94] rounded-full" />
                Strategische Doelen
              </h3>
              <ul className="space-y-4 mb-8">
                {(context.primaryGoals || '').split('\n').filter(g => g.trim()).map((goal, i) => (
                  <li key={i} className="flex items-start gap-4 text-slate-900 font-bold leading-relaxed">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#1A3C94]" />
                    </div>
                    {goal.replace(/^[•\-\*]\s*/, '')}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-8">
              {context.usps && (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.15em] text-[#1A3C94] mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#1A3C94] rounded-full" />
                    Belangrijkste USP's
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {context.usps.split('\n').filter(u => u.trim()).map((usp, i) => (
                      <div key={i} className="bg-slate-50/80 text-xs font-bold text-slate-800 px-4 py-3 rounded-sm border border-slate-100 flex items-center gap-3 transition-all hover:bg-white hover:shadow-sm group">
                        <div className="w-2 h-2 bg-[#1A3C94] rounded-full shrink-0 group-hover:scale-125 transition-transform" />
                        {usp.replace(/^[•\-\*]\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={context.usps ? "pt-8 border-t border-slate-100" : ""}>
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-[#1A3C94] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#1A3C94] rounded-full" />
                  Basisgegevens
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-sm border border-slate-100">
                    <div className="text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">Locaties</div>
                    <div className="text-sm font-bold text-slate-900">{context.targetLocations || 'Niet gespecificeerd'}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-sm border border-slate-100">
                    <div className="text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">Talen</div>
                    <div className="text-sm font-bold text-slate-900">{context.targetLanguages || 'Niet gespecificeerd'}</div>
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
              <div className="text-[10px] font-black text-[#1A3C94] uppercase tracking-[0.2em] mb-2">Sectie 01</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Campagne Structuur</h2>
            </div>
            <div className="text-right text-slate-700 text-xs font-bold uppercase tracking-widest">
              Strategisch Voorstel
            </div>
          </div>
          
          <div className="space-y-8">
            {campaigns.map((camp, i) => (
              <CampaignBlock key={camp.id} campaign={camp} index={i + 1} expanded={allExpanded} />
            ))}
          </div>
        </section>

        {/* 2. ZOEKWOORDEN ONDERZOEK */}
        <section id="zoekwoorden-onderzoek" className="pt-12 border-t border-slate-100 scroll-mt-32">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-[#1A3C94] uppercase tracking-[0.2em] mb-2">Sectie 02</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Zoekwoorden Onderzoek</h2>
            </div>
            <div className="text-right text-slate-700 text-xs font-bold uppercase tracking-widest">
              Marktanalyse & Intentie
            </div>
          </div>
          
          <KeywordResearchBlock context={context} />
        </section>

        {/* 3. TRACKING & DATA STRATEGIE */}
        <section className="pt-12 border-t border-slate-100">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-[#1A3C94] uppercase tracking-[0.2em] mb-2">Sectie 03</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Tracking & Data Strategie</h2>
            </div>
          </div>
          <Card className="rounded-sm border border-slate-200 shadow-sm bg-white overflow-hidden">
            <div className="bg-slate-50/80 px-10 py-6 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <BarChart3 className="size-4 text-[#1A3C94]" />
              </div>
              <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Conversie Doelen & Setup</span>
            </div>
            <div className="p-0">
              {tracking && tracking.length > 0 ? (
                <TrackingTable tracking={tracking} />
              ) : (
                <div className="p-20 text-center">
                  <div className="bg-slate-50 size-16 rounded-sm flex items-center justify-center mx-auto mb-6 border border-slate-100">
                      <AlertCircle className="size-8 text-slate-300" />
                  </div>
                  <div className="text-slate-700 text-sm font-black uppercase tracking-widest">Geen tracking gegevens beschikbaar.</div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>

      <footer className="bg-[#161615] text-slate-400 px-12 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/10 pb-12 mb-12">
          <div className="text-xl font-black tracking-tighter flex items-center gap-1.5 grayscale opacity-70">
            <span className="text-white">AD</span>
            <span>FLOW</span>
            <span className="text-white">ZONE</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">© 2026 AdFlowZone B.V.</span>
            <span className="text-slate-400">Vertrouwelijk document</span>
          </div>
        </div>
        <div className="text-center text-[10px] font-medium text-slate-400">
          Gegenereerd door AI Architect | Project: {context.clientName} | {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </footer>
    </div>
  );
}
