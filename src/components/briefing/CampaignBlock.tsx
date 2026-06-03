import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Target, Globe, Languages, Coins, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CampaignBriefing } from '@/lib/types';
import { AdGroupPreview } from './AdGroupPreview';

interface CampaignBlockProps {
  campaign: CampaignBriefing;
  index: number;
  expanded?: boolean;
}

export function CampaignBlock({ campaign, index, expanded }: CampaignBlockProps) {
  const [isOpen, setIsOpen] = useState(expanded ?? false);
  const [allAdGroupsExpanded, setAllAdGroupsExpanded] = useState(expanded ?? false);

  // Sync with global expanded prop
  React.useEffect(() => {
    if (expanded !== undefined) {
      setIsOpen(expanded);
      setAllAdGroupsExpanded(expanded);
    }
  }, [expanded]);

  const isPMax = campaign.type === 'pmax';

  return (
    <div className="group overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/40 transition-all hover:shadow-2xl hover:shadow-slate-200/60 ring-1 ring-slate-100">
      {/* CAMP HEADER */}
      <div 
        className={`px-8 py-7 flex items-center justify-between flex-wrap gap-6 border-b border-slate-50 cursor-pointer select-none transition-colors ${isOpen ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50/30'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-105 ${isPMax ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
            {isPMax ? '⚡' : '🔍'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Campaign {String(index).padStart(2, '0')}</span>
              <Badge variant="secondary" className={`text-[9px] font-black uppercase tracking-wider border-0 px-2 py-0.5 ${isPMax ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {campaign.type}
              </Badge>
            </div>
            <h3 className="font-black text-2xl text-slate-900 tracking-tight leading-none">{campaign.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-8">
            <div className="text-right hidden sm:block">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Doelstelling</div>
                <div className="text-sm font-black text-slate-900">{campaign.objective}</div>
            </div>
            <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl shadow-slate-900/20 flex items-center gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dagbudget</div>
                  <div className="text-lg font-black">{campaign.suggestedBudget}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </div>
        </div>
      </div>

      {isOpen && (
        <>
          {/* STRATEGIC OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-50 border-b border-slate-50">
        <div className="lg:col-span-2 p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Strategische Rationale</span>
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {campaign.rationale}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 pt-2">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Targeting</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px]">📍 {campaign.targetLocations || 'Nederland'}</Badge>
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px]">🌐 {campaign.targetLanguages || 'Nederlands'}</Badge>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Coins className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Biedstrategie</span>
                    </div>
                    <div className="text-sm font-black text-slate-900">Maximize Conversions (tCPA)</div>
                </div>
            </div>
        </div>
        
        <div className="p-8 bg-slate-50/30 flex flex-col justify-center">
            <div className="space-y-4">
                <div className="text-center">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Budget Verdeling</div>
                    <div className="relative w-24 h-24 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="transparent" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path className="text-emerald-500" strokeWidth="3" strokeDasharray="35, 100" strokeLinecap="round" stroke="currentColor" fill="transparent" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-slate-900">35%</span>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-center font-bold text-slate-500 uppercase tracking-widest mt-2">Van Totaal Budget</p>
            </div>
        </div>
      </div>

      {/* AD GROUPS */}
      <div className="bg-white">
        <div className="px-8 py-4 bg-slate-50/30 border-y border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Advertentiegroepen & Assets</span>
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 px-2 border border-slate-200 bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setAllAdGroupsExpanded(!allAdGroupsExpanded);
                }}
              >
                {allAdGroupsExpanded ? <ChevronUp className="w-2.5 h-2.5 mr-1" /> : <ChevronDown className="w-2.5 h-2.5 mr-1" />}
                {allAdGroupsExpanded ? 'Alles Inklappen' : 'Alles Uitklappen'}
              </Button>
          </div>
          <span className="text-[10px] font-bold text-slate-500">{campaign.adGroups.length} items</span>
        </div>
        <div className="grid grid-cols-1 gap-6 p-8 bg-slate-50/30">
          {campaign.adGroups.map((ag, agIndex) => (
            <AdGroupPreview 
              key={ag.id} 
              adGroup={ag} 
              index={agIndex + 1} 
              campaignType={campaign.type}
              expanded={allAdGroupsExpanded}
            />
          ))}
        </div>
      </div>

      {/* NEGATIVE KEYWORDS */}
      {campaign.negativeKeywords && campaign.negativeKeywords.length > 0 && (
        <div className="bg-rose-50/30 p-8 border-t border-rose-100">
          <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            Uitsluitingszoekwoorden
          </h4>
          <div className="flex flex-wrap gap-2">
            {campaign.negativeKeywords.map((kw, i) => (
              <span key={i} className="px-3 py-1.5 bg-white border border-rose-100 rounded-xl text-[11px] font-bold text-rose-700 shadow-sm">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
