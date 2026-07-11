import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Globe, ExternalLink } from 'lucide-react';
import { AdGroupBriefing } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface AdGroupPreviewProps {
  adGroup: AdGroupBriefing;
  index: number;
  campaignType: 'search' | 'pmax' | 'meta' | 'linkedin';
  expanded?: boolean;
  website?: string;
}

export function AdGroupPreview({ adGroup, index, campaignType, expanded, website }: AdGroupPreviewProps) {
  const [isOpen, setIsOpen] = useState(expanded ?? false);
  const [copiedIndex, setCopiedIndex] = useState<{type: string, index: number} | null>(null);
  const isPMax = campaignType === 'pmax';
  const isMeta = campaignType === 'meta';
  const isLinkedin = campaignType === 'linkedin';

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
    <div className="bg-slate-900/30 rounded-2xl border border-slate-800/80 shadow-md overflow-hidden print:bg-white print:border-slate-200 print:rounded-none print:shadow-none">
      <div 
        className={`px-8 py-5 text-xs font-black uppercase tracking-[0.15em] flex items-center justify-between border-b border-slate-800 cursor-pointer select-none transition-all hover:bg-slate-950/20 print:bg-slate-50 print:border-slate-200 ${isPMax ? 'text-purple-400 print:text-purple-700' : 'text-emerald-400 print:text-emerald-700'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isPMax ? 'bg-purple-600 text-white shadow-[0_2px_8px_rgba(147,51,234,0.3)]' : 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.3)]'}`}>
            {index}
          </span>
          <span className="text-slate-300 print:text-slate-900">
            {isPMax ? 'Assetgroep' : 'Advertentiegroep'}:
          </span>
          <span className="text-slate-100 ml-1 text-sm print:text-slate-900">{adGroup.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-slate-400 normal-case print:text-slate-550">{adGroup.headlines.length} koppen • {adGroup.keywords?.length || 0} termen</span>
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center print:bg-slate-100">
            {isOpen ? <ChevronUp className="w-3 h-3 text-slate-300 print:text-slate-900" /> : <ChevronDown className="w-3 h-3 text-slate-300 print:text-slate-900" />}
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="divide-y divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-300 print:divide-slate-200">
          {/* ROW 1: KEYWORDS & PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 print:divide-slate-200">
            {/* Keywords */}
            <div className="p-8">
              <div className="mb-8">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mb-3 flex items-center gap-2 print:text-slate-700">
                  <Globe className="w-3 h-3" />
                  <span>Landingspagina</span>
                </div>
                <a href={adGroup.landingPage || website || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-950/20 hover:bg-slate-900 border border-slate-800 text-sm font-bold text-blue-400 shadow-sm hover:shadow hover:text-blue-300 transition-all rounded-xl print:bg-slate-50 print:border-slate-200 print:text-blue-700 group">
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  {adGroup.landingPage || website || 'Geen URL opgegeven'}
                </a>
              </div>

              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300 mb-6 pb-2 border-b border-slate-800 flex items-center justify-between print:text-slate-800 print:border-slate-200">
                <span>🔑 {isPMax ? 'Zoekthema\'s' : 'Zoekwoorden'}</span>
                <span className="font-bold text-slate-400 print:text-slate-700">{adGroup.keywords?.length || 0} items</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {adGroup.keywords?.map((kw, i) => (
                  <span key={i} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-sm ring-1 transition-all hover:scale-105 cursor-default ${isPMax ? 'bg-purple-500/10 text-purple-300 ring-purple-500/20 print:bg-purple-100 print:text-purple-900 print:ring-purple-250' : 'bg-blue-500/10 text-blue-300 ring-blue-500/20 print:bg-blue-100 print:text-blue-900 print:ring-blue-250'}`}>
                    {kw}
                  </span>
                ))}
              </div>

              {adGroup.audienceSignals && (
                <div className="mt-8 pt-8 border-t border-slate-800 space-y-4 print:border-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-purple-400 mb-4 flex items-center gap-2 print:text-purple-700">
                    <span>🎯 Doelgroepsignalen</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950/20 rounded-xl p-4 border border-slate-800/80 print:bg-slate-50 print:border-slate-200">
                      <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5 print:text-purple-600">Custom Intent</div>
                      <p className="text-[11px] text-slate-300 font-bold leading-relaxed line-clamp-2 print:text-slate-800">{adGroup.audienceSignals.customIntent.join(', ')}</p>
                    </div>
                    <div className="bg-slate-950/20 rounded-xl p-4 border border-slate-800/80 print:bg-slate-50 print:border-slate-200">
                      <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5 print:text-purple-600">In-Market</div>
                      <p className="text-[11px] text-slate-300 font-bold leading-relaxed line-clamp-2 print:text-slate-800">{adGroup.audienceSignals.inMarket.join(', ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="p-8 bg-slate-950/10 print:bg-slate-50/50 flex flex-col justify-start">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300 mb-6 pb-2 border-b border-slate-800 print:text-slate-800 print:border-slate-200">
                <span>👁️ Advertentie Preview</span>
              </div>
              <div className="flex justify-center w-full">
                {isMeta ? (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-xl text-left w-full max-w-sm flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-900 border border-indigo-750 flex items-center justify-center text-[10px] font-black text-white">f</div>
                      <div className="text-[10px] flex flex-col">
                        <span className="font-bold text-slate-200">Meta Ads Business</span>
                        <span className="text-slate-500 text-[8px] mt-0.5">Gesponsord</span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                      {adGroup.primaryTexts?.[0] || 'Dit is de primaire ad copy.'}
                    </p>
                    <div className="bg-slate-900 aspect-video rounded-lg border border-slate-850 flex flex-col items-center justify-center p-4">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Meta Visual</span>
                      <p className="text-[9px] text-slate-600 text-center italic line-clamp-2 px-4">
                        {adGroup.imagePrompts?.[0] || 'Visualisation prompt.'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500">{(website || 'www.website.nl').replace(/^https?:\/\//, '')}</span>
                        <span className="font-bold text-slate-200 text-xs truncate mt-0.5">{adGroup.headlines[0] || 'Headline'}</span>
                        <span className="text-[10px] text-slate-550 truncate mt-0.5">{adGroup.descriptions[0] || 'Description'}</span>
                      </div>
                      <Button variant="secondary" size="sm" className="h-8 text-[10px] uppercase font-bold shrink-0 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800">
                        {adGroup.callToAction || 'Learn More'}
                      </Button>
                    </div>
                  </div>
                ) : isLinkedin ? (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-xl text-left w-full max-w-sm flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-[10px] font-black text-blue-400">in</div>
                      <div className="text-[10px] flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-200">LinkedIn Business</span>
                          <span className="text-slate-500 text-[9px]">· 1e</span>
                        </div>
                        <span className="text-slate-500 text-[8px] mt-0.5">Gesponsord</span>
                      </div>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                      {adGroup.primaryTexts?.[0] || 'LinkedIn ad copy.'}
                    </p>
                    <div className="bg-slate-900 aspect-video rounded-lg border border-slate-850 flex flex-col items-center justify-center p-4">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">LinkedIn Visual</span>
                      <p className="text-[9px] text-slate-650 text-center italic line-clamp-2 px-4">
                        {adGroup.imagePrompts?.[0] || 'Visual prompt.'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-200 text-xs truncate">{adGroup.headlines[0] || 'Headline'}</span>
                        <span className="text-[9px] text-slate-500 truncate mt-0.5">{(website || 'www.website.nl').replace(/^https?:\/\//, '')}</span>
                      </div>
                      <Button variant="secondary" size="sm" className="h-8 text-[10px] uppercase font-bold shrink-0 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800">
                        {adGroup.callToAction || 'Learn More'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 shadow-xl shadow-black/40 w-full max-w-md print:bg-white print:border-slate-200 print:shadow-none">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-200 print:bg-slate-50 print:border-slate-200 print:text-slate-900">G</div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-400 print:text-slate-500">Gesponsord</span>
                          <span className="text-[10px] text-slate-300 font-medium print:text-slate-700">{adGroup.landingPage || website || 'www.website.nl'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-blue-400 hover:underline cursor-pointer leading-tight mb-2 tracking-tight line-clamp-2 print:text-blue-700 text-left">
                      {adGroup.headlines[0]} – {adGroup.headlines[1]}
                    </div>
                    <div className="text-[12px] text-slate-400 leading-relaxed font-medium line-clamp-2 print:text-slate-700 text-left">
                      {adGroup.descriptions[0]} {adGroup.descriptions[1]}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 2: HEADLINES */}
          <div className="p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mb-6 pb-2 border-b border-slate-800 flex items-center justify-between print:text-slate-800 print:border-slate-200">
              <span>📝 Koppen (Headlines)</span>
              <span className="text-slate-400 print:text-slate-700">{adGroup.headlines.length} / 15</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Group 1: Zoekwoord gericht */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 uppercase tracking-widest text-center print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                  Groep 1: Zoekwoord gericht
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(0, 5).map((hl, i) => {
                    const globalIdx = i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-all group relative cursor-pointer print:bg-white print:border-slate-200 print:hover:border-slate-300"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-500 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-300 flex-grow tracking-tight leading-tight print:text-slate-800">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-950/50 text-red-400' : 'bg-slate-900 text-slate-400'} print:bg-slate-50 print:text-slate-700`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400 print:text-emerald-700" /> : <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: USPs */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 uppercase tracking-widest text-center print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                  Groep 2: USPs
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(5, 10).map((hl, i) => {
                    const globalIdx = 5 + i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-all group relative cursor-pointer print:bg-white print:border-slate-200 print:hover:border-slate-300"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-500 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-300 flex-grow tracking-tight leading-tight print:text-slate-800">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-950/50 text-red-400' : 'bg-slate-900 text-slate-400'} print:bg-slate-50 print:text-slate-700`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400 print:text-emerald-700" /> : <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: CTAs */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 uppercase tracking-widest text-center print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                  Groep 3: CTAs
                </div>
                <div className="space-y-2">
                  {adGroup.headlines.slice(10, 15).map((hl, i) => {
                    const globalIdx = 10 + i;
                    const isCopied = copiedIndex?.type === 'headline' && copiedIndex?.index === globalIdx;
                    return (
                      <div 
                        key={globalIdx} 
                        className="flex items-center gap-3 py-2 px-3 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-all group relative cursor-pointer print:bg-white print:border-slate-200 print:hover:border-slate-300"
                        onClick={() => copyToClipboard(hl, 'headline', globalIdx)}
                      >
                        <span className="text-[10px] font-black text-slate-500 w-4">{globalIdx + 1}</span>
                        <span className="text-[12px] font-bold text-slate-300 flex-grow tracking-tight leading-tight print:text-slate-800">{hl}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hl.length > 30 ? 'bg-red-950/50 text-red-400' : 'bg-slate-900 text-slate-400'} print:bg-slate-50 print:text-slate-700`}>
                            {hl.length}/30
                          </span>
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400 print:text-emerald-700" /> : <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: DESCRIPTIONS */}
          <div className="p-8 bg-slate-950/20 print:bg-slate-50/30">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mb-6 pb-2 border-b border-slate-800 flex items-center justify-between print:text-slate-800 print:border-slate-200">
              <span>💬 Beschrijvingen</span>
              <span className="text-slate-400 print:text-slate-700">{adGroup.descriptions.length} / 4</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {adGroup.descriptions.map((desc, i) => {
                const isCopied = copiedIndex?.type === 'description' && copiedIndex?.index === i;
                return (
                  <div 
                    key={i} 
                    className="flex items-start gap-3 py-4 px-5 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-all group cursor-pointer print:bg-white print:border-slate-200"
                    onClick={() => copyToClipboard(desc, 'description', i)}
                  >
                    <span className="text-[10px] font-black text-slate-500 w-4 mt-0.5">{i + 1}</span>
                    <span className="text-[12px] font-medium text-slate-300 flex-grow leading-relaxed print:text-slate-850">{desc}</span>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${desc.length > 90 ? 'bg-red-950/50 text-red-400' : 'bg-slate-900 text-slate-400'} print:bg-slate-50 print:text-slate-700`}>
                        {desc.length}/90
                      </span>
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400 print:text-emerald-700" /> : <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 4: LONG HEADLINES (PMax only) */}
          {isPMax && adGroup.longHeadlines && adGroup.longHeadlines.length > 0 && (
            <div className="p-8 bg-slate-950/30 print:bg-slate-50/50">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mb-6 pb-2 border-b border-slate-800 flex items-center justify-between print:text-slate-800 print:border-slate-200">
                <span>📏 Lange Koppen</span>
                <span className="text-slate-400 print:text-slate-700">{adGroup.longHeadlines.length} / 5</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adGroup.longHeadlines.map((lh, i) => (
                  <div key={i} className="flex items-start gap-3 py-4 px-5 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-colors group print:bg-white print:border-slate-200">
                    <span className="text-[10px] font-black text-slate-500 w-4 mt-0.5">{i + 1}</span>
                    <span className="text-[12px] font-bold text-slate-300 flex-grow leading-relaxed print:text-slate-800">{lh}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${lh.length > 90 ? 'bg-red-950/50 text-red-400' : 'bg-slate-900 text-slate-400'} shrink-0 mt-0.5 print:bg-slate-50 print:text-slate-700`}>
                      {lh.length}/90
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROW 5: EXTENSIONS */}
          {adGroup.extensions && (
            <div className="p-8 bg-slate-950/20 border-t border-slate-800 print:bg-slate-50/30 print:border-slate-200">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mb-6 pb-2 border-b border-slate-800 flex items-center justify-between print:text-slate-800 print:border-slate-200">
                <span>🔗 Extensies (Sitelinks & Callouts)</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sitelinks */}
                {adGroup.extensions.sitelinks && adGroup.extensions.sitelinks.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 uppercase tracking-widest inline-block mb-2 print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                      Sitelinks
                    </div>
                    <div className="space-y-3">
                      {adGroup.extensions.sitelinks.map((sl, i) => (
                        <div key={i} className="flex items-start gap-3 py-3 px-4 bg-slate-950/40 border border-slate-800/80 rounded-lg shadow-sm hover:border-primary/45 transition-colors print:bg-white print:border-slate-200">
                          <span className="text-[10px] font-black text-slate-500 w-4 mt-0.5">{i + 1}</span>
                          <div className="flex-grow">
                            <div className="text-[12px] font-bold text-blue-400 hover:underline cursor-pointer mb-1 tracking-tight print:text-blue-700">{sl.title}</div>
                            <div className="text-[11px] text-slate-400 leading-snug font-medium print:text-slate-700">{sl.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Callouts */}
                {adGroup.extensions.callouts && adGroup.extensions.callouts.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 uppercase tracking-widest inline-block mb-2 print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                      Callouts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {adGroup.extensions.callouts.map((callout, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-950/40 border border-slate-800/80 rounded-lg text-[11px] font-bold text-slate-350 shadow-sm flex items-center gap-1.5 print:bg-white print:border-slate-200 print:text-slate-900">
                          <Check className="w-3 h-3 text-emerald-400 print:text-emerald-700" />
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
