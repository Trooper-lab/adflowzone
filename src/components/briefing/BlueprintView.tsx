'use client';

import React from 'react';
import { Briefing, CampaignBriefing, AdGroupBriefing } from '@/lib/types';
import { BudgetGrid } from './BudgetGrid';
import { CampaignBlock } from './CampaignBlock';
import { KPITable } from './KPITable';
import { TimelineView } from './TimelineView';
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
    <div className="relative max-w-[1080px] mx-auto bg-[#f8fafc] min-h-screen text-[#1e293b] font-sans pb-20 shadow-2xl my-8 rounded-3xl overflow-hidden ring-1 ring-black/5 print:my-0 print:rounded-none print:shadow-none print:ring-0">
      {/* ACTION BAR (Floating) */}
      <div className="sticky top-4 z-50 px-4 print:hidden">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl px-6 py-3 flex items-center justify-between gap-4 max-w-2xl mx-auto ring-1 ring-black/5">
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
                className={`rounded-xl h-8 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all ${
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
      <header className="relative bg-[#0f172a] text-white pt-20 pb-24 px-12 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-12">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-3 rounded-2xl">
               <div className="text-xl font-black tracking-tighter flex items-center gap-1.5">
                <span className="text-emerald-400">AD</span>
                <span className="text-white">FLOW</span>
                <span className="text-emerald-400">ZONE</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2">Google Ads Strategy</div>
              <div className="text-2xl font-bold tracking-tight">Blueprint 2026</div>
            </div>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-5xl font-black tracking-tight leading-[1.1] mb-6">
              {briefing.title}
            </h1>
            <p className="text-xl text-slate-400 font-medium leading-relaxed mb-10">
              Uw route naar een lagere CPL en maximaal rendement voor <span className="text-white">{context.clientName}</span>.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-300">Website: {context.website}</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-slate-300">Taal: {context.language}</span>
              </div>
              {budgetAllocation && (
                <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-slate-300">Budget: {budgetAllocation.totalBudget}/maand</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* STRATEGIC OVERVIEW */}
      <div className="relative z-10 -mt-12 px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-8 rounded-[2rem] border-0 shadow-2xl shadow-slate-200/50 bg-white ring-1 ring-slate-100 flex flex-col">
            <div className="flex-1">
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-emerald-600 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                Strategische Doelen
              </h3>
              <ul className="space-y-4 mb-8">
                {(context.primaryGoals || '').split('\n').filter(g => g.trim()).map((goal, i) => (
                  <li key={i} className="flex items-start gap-4 text-slate-700 font-bold leading-relaxed">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    {goal.replace(/^[•\-\*]\s*/, '')}
                  </li>
                ))}
              </ul>

              {context.usps && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h3 className="text-sm font-black uppercase tracking-[0.15em] text-emerald-600 mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                    Belangrijkste USP's
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {context.usps.split('\n').filter(u => u.trim()).map((usp, i) => (
                      <div key={i} className="bg-slate-50/80 text-xs font-bold text-slate-700 px-4 py-3 rounded-2xl border border-slate-100 flex items-center gap-3 transition-all hover:bg-white hover:shadow-md group">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 group-hover:scale-125 transition-transform" />
                        {usp.replace(/^[•\-\*]\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
          
          <Card className="p-8 rounded-[2rem] border-0 shadow-2xl shadow-slate-200/50 bg-white ring-1 ring-slate-100 flex flex-col">
            <div className="flex-1">
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-blue-600 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Onze Aanpak
              </h3>
              <p className="text-slate-600 font-medium leading-relaxed mb-8">
                We bouwen een robuuste full-funnel structuur die zich richt op zowel directe conversies als duurzame groei, met focus op data-gedreven optimalisatie.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-auto">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Locaties</div>
                  <div className="text-sm font-bold text-slate-800">{context.targetLocations || 'Niet gespecificeerd'}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Talen</div>
                  <div className="text-sm font-bold text-slate-800">{context.targetLanguages || 'Niet gespecificeerd'}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <main className="px-12 py-16 space-y-24">
        {/* 1. CAMPAIGN STRUCTURE */}
        <section>
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">Sectie 01</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Campagne Structuur</h2>
            </div>
            <div className="text-right text-slate-500 text-xs font-bold uppercase tracking-widest">
              Strategisch Voorstel
            </div>
          </div>
          
          <div className="space-y-8">
            {campaigns.map((camp, i) => (
              <CampaignBlock key={camp.id} campaign={camp} index={i + 1} expanded={allExpanded} />
            ))}
          </div>
        </section>

        {/* 2. BUDGET & ROI */}
        <section className="pt-12 border-t border-slate-100">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Sectie 02</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Budget & Rendement</h2>
            </div>
          </div>
          
          <div className="space-y-8">
            {/* Row 1: Budget Allocation */}
            <Card className="rounded-[2.5rem] border-0 shadow-xl shadow-slate-200/50 bg-white ring-1 ring-slate-100 overflow-hidden">
              <div className="bg-slate-50/80 px-10 py-5 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <Euro className="size-4 text-slate-600" />
                  </div>
                  <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Maandelijkse Allocatie</span>
                </div>
                <Badge variant="outline" className="rounded-xl px-4 py-1 bg-white font-black text-slate-900 border-slate-200 shadow-sm">{budgetAllocation?.totalBudget || 'N.v.t.'}</Badge>
              </div>
              <div className="p-10">
                {budgetAllocation ? (
                  <BudgetGrid allocation={budgetAllocation} />
                ) : (
                  <div className="text-slate-500 text-sm italic py-10 text-center">Geen budgetgegevens beschikbaar.</div>
                )}
              </div>
            </Card>

            {/* Row 2: Strategy & ROI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {bidStrategy && (
                <Card className="p-10 rounded-[2.5rem] border-0 shadow-2xl shadow-slate-900/10 bg-slate-900 text-white relative overflow-hidden group min-h-[360px]">
                  <div className="absolute top-0 right-0 p-8 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors">
                    <TrendingUp className="size-16" />
                  </div>
                  
                  <div className="relative z-10 h-full flex flex-col">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-8 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      Biedstrategie
                    </h4>
                    <div className="space-y-6 flex-1">
                      {bidStrategy.phases.slice(0, 3).map((phase, i) => (
                        <div key={i} className="relative pl-8 pb-4 last:pb-0">
                          {i < Math.min(bidStrategy.phases.length, 3) - 1 && (
                            <div className="absolute left-[4px] top-5 bottom-0 w-[2px] bg-white/10" />
                          )}
                          <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-slate-900" />
                          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{phase.name}</div>
                          <div className="text-[14px] font-bold leading-relaxed text-slate-200">{phase.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {kpis && kpis.length > 0 && (
                <Card className="p-10 rounded-[2.5rem] border-0 shadow-2xl shadow-emerald-900/20 bg-emerald-600 text-white relative overflow-hidden group min-h-[360px]">
                  <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                  
                  <div className="relative z-10 h-full flex flex-col">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white mb-8 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                      Verwacht Rendement
                    </h4>
                    <div className="bg-white/5 backdrop-blur-sm rounded-[2rem] p-2 border border-white/10 mt-auto">
                      <KPITable kpis={kpis} />
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </section>

        {/* 3. IMPLEMENTATION ROADMAP */}
        <section className="pt-24 border-t border-slate-100">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-amber-600/30" />
                Sectie 03
              </div>
              <h2 className="text-4xl font-black tracking-tight text-slate-900">Implementatie Roadmap</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
              <Share2 className="size-3 animate-pulse" />
              Scroll horizontaal voor alle stappen
            </div>
          </div>
          
          <div className="relative -mx-12">
            {/* Carousel Container */}
            <div className="flex overflow-x-auto pb-12 gap-6 snap-x no-scrollbar scroll-smooth px-12">
                {(timeline || []).map((step, i) => (
                    <div key={i} className="min-w-[340px] max-w-[340px] snap-center">
                        <Card className="h-full p-10 rounded-[2.5rem] border-0 shadow-xl shadow-slate-200/40 bg-white ring-1 ring-slate-100 flex flex-col hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group/step">
                            <div className="flex items-center justify-between mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-sm border border-amber-100 group-hover/step:bg-amber-500 group-hover/step:text-white group-hover/step:border-amber-400 transition-all duration-500">
                                    {i + 1}
                                </div>
                                <div className="bg-amber-100 text-amber-700 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border border-amber-200/50 shadow-sm">
                                    {step.dateRange}
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 mb-6 leading-tight group-hover/step:text-amber-600 transition-colors">{step.milestone}</h4>
                            <div className="space-y-3 mb-10 flex-1">
                                {(step.tasks || []).map((task, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                                        <p className="text-sm text-slate-600 font-medium leading-relaxed opacity-80 group-hover/step:opacity-100 transition-opacity">
                                            {task}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                    Prioriteit: Hoog
                                </div>
                                <CheckCircle2 className="size-5 text-slate-200 group-hover/step:text-emerald-500 transition-colors" />
                            </div>
                        </Card>
                    </div>
                ))}
            </div>
            
            {/* Subtle Gradient Overlays for horizontal scroll */}
            <div className="absolute top-0 left-0 bottom-12 w-24 bg-gradient-to-r from-[#f8fafc] to-transparent pointer-events-none z-10" />
            <div className="absolute top-0 right-0 bottom-12 w-24 bg-gradient-to-l from-[#f8fafc] to-transparent pointer-events-none z-10" />
          </div>
        </section>

        {/* 4. TRACKING & DATA STRATEGIE */}
        <section className="pt-12 border-t border-slate-100">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-2">Sectie 04</div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Tracking & Data Strategie</h2>
            </div>
          </div>
          <Card className="rounded-[2.5rem] border-0 shadow-2xl shadow-slate-200/50 bg-white ring-1 ring-slate-100 overflow-hidden">
            <div className="bg-slate-50/80 px-10 py-6 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <BarChart3 className="size-4 text-purple-600" />
              </div>
              <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Conversie Doelen & Setup</span>
            </div>
            <div className="p-0">
              {tracking && tracking.length > 0 ? (
                <TrackingTable tracking={tracking} />
              ) : (
                <div className="p-20 text-center">
                  <div className="bg-slate-50 size-16 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-slate-100">
                      <AlertCircle className="size-8 text-slate-300" />
                  </div>
                  <div className="text-slate-400 text-sm font-black uppercase tracking-widest">Geen tracking gegevens beschikbaar.</div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 px-12 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/5 pb-12 mb-12">
          <div className="text-xl font-black tracking-tighter flex items-center gap-1.5 grayscale opacity-50">
            <span className="text-white">AD</span>
            <span>FLOW</span>
            <span className="text-white">ZONE</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-white/40">© 2026 AdFlowZone B.V.</span>
            <span className="text-white/40">Vertrouwelijk document</span>
          </div>
        </div>
        <div className="text-center text-[10px] font-medium text-slate-600">
          Gegenereerd door AI Architect | Project: {context.clientName} | {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </footer>
    </div>
  );
}
