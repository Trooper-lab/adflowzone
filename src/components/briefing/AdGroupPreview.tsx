import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { AdGroupBriefing } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface AdGroupPreviewProps {
  adGroup: AdGroupBriefing;
  index: number;
  campaignType: 'search' | 'pmax';
  expanded?: boolean;
}

export function AdGroupPreview({ adGroup, index, campaignType, expanded }: AdGroupPreviewProps) {
  const [isOpen, setIsOpen] = useState(expanded ?? false);
  const [copiedIndex, setCopiedIndex] = useState<{type: string, index: number} | null>(null);
  const isPMax = campaignType === 'pmax';

  const copyToClipboard = (text: string, type: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex({ type, index: idx });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Sync with parent expanded prop
  React.useEffect(() => {
    if (expanded !== undefined) {
      setIsOpen(expanded);
    }
  }, [expanded]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div 
        className={`px-8 py-5 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-between border-b border-slate-50 cursor-pointer select-none transition-all hover:bg-slate-50 ${isPMax ? 'text-purple-600' : 'text-emerald-600'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isPMax ? 'bg-purple-600 text-white shadow-[0_2px_8px_rgba(147,51,234,0.3)]' : 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.3)]'}`}>
            {index}
          </span>
          <span className="text-slate-400">
            {isPMax ? 'Assetgroep' : 'Advertentiegroep'}:
          </span>
          <span className="text-slate-900 ml-1 text-sm">{adGroup.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-300 normal-case">{adGroup.headlines.length} koppen • {adGroup.keywords?.length || 0} termen</span>
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
            {isOpen ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
          </div>
        </div>
      </div>      {isOpen && (
        <div className="divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* ROW 1: KEYWORDS & PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Keywords */}
            <div className="p-8">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-6 pb-2 border-b border-slate-50 flex items-center justify-between">
                <span>🔑 {isPMax ? 'Zoekthema\'s' : 'Zoekwoorden'}</span>
                <span className="font-bold text-slate-300">{adGroup.keywords?.length || 0} items</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {adGroup.keywords?.map((kw, i) => (
                  <span key={i} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm ring-1 transition-all hover:scale-105 cursor-default ${isPMax ? 'bg-purple-50 text-purple-700 ring-purple-100' : 'bg-blue-50 text-blue-700 ring-blue-100'}`}>
                    {kw}
                  </span>
                ))}
              </div>

              {adGroup.audienceSignals && (
                <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-purple-600 mb-4 flex items-center gap-2">
                    <span>🎯 Doelgroepsignalen</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5">Custom Intent</div>
                      <p className="text-[11px] text-slate-600 font-bold leading-relaxed line-clamp-2">{adGroup.audienceSignals.customIntent.join(', ')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5">In-Market</div>
                      <p className="text-[11px] text-slate-600 font-bold leading-relaxed line-clamp-2">{adGroup.audienceSignals.inMarket.join(', ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="p-8 bg-slate-50/20">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-6 pb-2 border-b border-slate-50">
                <span>👁️ Advertentie Preview</span>
              </div>
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl shadow-slate-200/40 ring-1 ring-slate-100 max-w-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400">G</div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-900">Gesponsord</span>
                      <span className="text-[10px] text-slate-400 font-medium">www.client.nl</span>
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold text-[#1a0dab] hover:underline cursor-pointer leading-tight mb-2 tracking-tight line-clamp-2">
                  {adGroup.headlines[0]} – {adGroup.headlines[1]}
                </div>
                <div className="text-[12px] text-slate-600 leading-relaxed font-medium line-clamp-2">
                  {adGroup.descriptions[0]} {adGroup.descriptions[1]}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: HEADLINES */}
          <div className="p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600 mb-6 pb-2 border-b border-indigo-50 flex items-center justify-between">
              <span>📝 Koppen (Headlines)</span>
              <span className="text-slate-300">{adGroup.headlines.length} / 15</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Group 1: Zoekwoord gericht */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-indigo-700 bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-indigo-100/50 uppercase tracking-widest text-center">
                  Groep 1: Zoekwoord gericht
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(0, 5).map((hl, i) => {
                    const globalIdx = i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-all group relative cursor-pointer"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-300 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-800 flex-grow tracking-tight leading-tight">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: USPs */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-indigo-700 bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-indigo-100/50 uppercase tracking-widest text-center">
                  Groep 2: USPs
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(5, 10).map((hl, i) => {
                    const globalIdx = 5 + i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-all group relative cursor-pointer"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-300 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-800 flex-grow tracking-tight leading-tight">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: CTAs */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-indigo-700 bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-indigo-100/50 uppercase tracking-widest text-center">
                  Groep 3: CTAs
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(10, 15).map((hl, i) => {
                    const globalIdx = 10 + i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-all group relative cursor-pointer"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-300 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-800 flex-grow tracking-tight leading-tight">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: DESCRIPTIONS */}
          <div className="p-8 bg-slate-50/30">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 mb-6 pb-2 border-b border-emerald-50 flex items-center justify-between">
              <span>💬 Beschrijvingen</span>
              <span className="text-slate-300">{adGroup.descriptions.length} / 4</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {adGroup.descriptions.map((desc, i) => {
                const isCopied = copiedIndex?.type === 'description' && copiedIndex?.index === i;
                return (
                  <div 
                    key={i} 
                    className="flex items-start gap-3 py-4 px-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-100 transition-all group cursor-pointer"
                    onClick={() => copyToClipboard(desc, 'description', i)}
                  >
                    <span className="text-[10px] font-black text-slate-300 w-4 mt-0.5">{i + 1}</span>
                    <span className="text-[12px] font-medium text-slate-600 flex-grow leading-relaxed">{desc}</span>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${desc.length > 90 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                        {desc.length}/90
                      </span>
                      {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 4: LONG HEADLINES (PMax only) */}
          {isPMax && adGroup.longHeadlines && adGroup.longHeadlines.length > 0 && (
            <div className="p-8 bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-purple-600 mb-6 pb-2 border-b border-purple-50 flex items-center justify-between">
                <span>📏 Lange Koppen</span>
                <span className="text-slate-300">{adGroup.longHeadlines.length} / 5</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adGroup.longHeadlines.map((lh, i) => (
                  <div key={i} className="flex items-start gap-3 py-4 px-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-purple-100 transition-colors group">
                    <span className="text-[10px] font-black text-slate-300 w-4 mt-0.5">{i + 1}</span>
                    <span className="text-[12px] font-bold text-slate-800 flex-grow leading-relaxed">{lh}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${lh.length > 90 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'} shrink-0 mt-0.5`}>
                      {lh.length}/90
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROW 5: EXTENSIONS */}
          {adGroup.extensions && (
            <div className="p-8 bg-slate-50/30 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600 mb-6 pb-2 border-b border-amber-50 flex items-center justify-between">
                <span>🔗 Extensies (Sitelinks & Callouts)</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sitelinks */}
                {adGroup.extensions.sitelinks && adGroup.extensions.sitelinks.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[9px] font-black text-amber-700 bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-100/50 uppercase tracking-widest inline-block mb-2">
                      Sitelinks
                    </div>
                    <div className="space-y-3">
                      {adGroup.extensions.sitelinks.map((sl, i) => (
                        <div key={i} className="flex items-start gap-3 py-3 px-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-amber-100 transition-colors">
                          <span className="text-[10px] font-black text-slate-300 w-4 mt-0.5">{i + 1}</span>
                          <div className="flex-grow">
                            <div className="text-[12px] font-bold text-[#1a0dab] hover:underline cursor-pointer mb-1 tracking-tight">{sl.title}</div>
                            <div className="text-[11px] text-slate-600 leading-snug font-medium">{sl.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Callouts */}
                {adGroup.extensions.callouts && adGroup.extensions.callouts.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[9px] font-black text-amber-700 bg-amber-50/60 px-3 py-1.5 rounded-lg border border-amber-100/50 uppercase tracking-widest inline-block mb-2">
                      Callouts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {adGroup.extensions.callouts.map((callout, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 shadow-sm flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-500" />
                          {callout}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
