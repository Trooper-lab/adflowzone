import React from 'react';
import { BriefingContext } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Search, Hash, TrendingUp, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KeywordResearchBlockProps {
  context: BriefingContext;
}

export function KeywordResearchBlock({ context }: KeywordResearchBlockProps) {
  const { selectedKeywords, keywordThemes } = context;

  if (!selectedKeywords?.length && !keywordThemes?.length) {
    return (
      <Card className="rounded-sm border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-20 text-center">
          <div className="bg-slate-50 size-16 rounded-sm flex items-center justify-center mx-auto mb-6 border border-slate-100">
            <Search className="size-8 text-slate-500" />
          </div>
          <div className="text-slate-700 text-sm font-black uppercase tracking-widest">Geen zoekwoordgegevens beschikbaar.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Themes Section */}
      {keywordThemes && keywordThemes.length > 0 && (
        <Card className="rounded-sm border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="bg-white px-10 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-white rounded-sm shadow-sm border border-slate-200">
              <Hash className="size-4 text-[#1A3C94]" />
            </div>
            <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Geselecteerde Thema's</span>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {keywordThemes.map((theme) => (
              <div key={theme.id} className="bg-slate-50 border border-slate-100 p-6 rounded-sm">
                <h4 className="text-sm font-black text-slate-900 mb-4">{theme.name}</h4>
                <div className="flex flex-wrap gap-2">
                  {theme.keywords.map((kw, i) => (
                    <Badge key={i} variant="outline" className="bg-white text-[#1A3C94] border-[#1A3C94]/20 font-bold rounded-sm">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Keywords Table */}
      {selectedKeywords && selectedKeywords.length > 0 && (
        <Card className="rounded-sm border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="bg-white px-10 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-sm shadow-sm border border-slate-200">
                <Search className="size-4 text-[#1A3C94]" />
              </div>
              <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Belangrijkste Zoekwoorden</span>
            </div>
            <Badge variant="outline" className="rounded-sm px-4 py-1 bg-white font-black text-slate-900 border-slate-200 shadow-sm">
              {selectedKeywords.length} Geselecteerd
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-700">Zoekwoord</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-700 text-right">Volume</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-700 text-center">Concurrentie</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-700 text-right">CPC (Laag)</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-700 text-right">CPC (Hoog)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedKeywords.map((kw, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-5 font-bold text-slate-900 text-sm">{kw.text}</td>
                    <td className="px-10 py-5 text-right">
                      <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-sm border border-slate-100">
                        <TrendingUp className="size-3 text-[#1A3C94]" />
                        <span className="font-bold text-slate-700">{kw.avgMonthlySearches?.toLocaleString('nl-NL') || '-'}</span>
                      </div>
                    </td>
                    <td className="px-10 py-5 text-center">
                      <Badge 
                        variant="secondary" 
                        className={`font-black text-[10px] tracking-wider uppercase border-0 rounded-sm ${
                          kw.competition === 'HIGH' ? 'bg-rose-50 text-rose-700' :
                          kw.competition === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                          kw.competition === 'LOW' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {kw.competition || 'ONBEKEND'}
                      </Badge>
                    </td>
                    <td className="px-10 py-5 text-right font-medium text-slate-600">
                      {kw.lowCpc ? `€${(kw.lowCpc / 1000000).toFixed(2).replace('.', ',')}` : '-'}
                    </td>
                    <td className="px-10 py-5 text-right font-medium text-slate-600">
                      {kw.highCpc ? `€${(kw.highCpc / 1000000).toFixed(2).replace('.', ',')}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
