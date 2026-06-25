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
      <Card className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl overflow-hidden print:bg-white print:border-slate-200">
        <div className="p-20 text-center">
          <div className="bg-slate-950/20 size-16 rounded-xl flex items-center justify-center mx-auto mb-6 border border-slate-800 print:bg-slate-50 print:border-slate-200">
            <Search className="size-8 text-slate-500" />
          </div>
          <div className="text-slate-400 text-sm font-black uppercase tracking-widest print:text-slate-700">Geen zoekwoordgegevens beschikbaar.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Themes Section */}
      {keywordThemes && keywordThemes.length > 0 && (
        <Card className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl overflow-hidden print:bg-white print:border-slate-200">
          <div className="bg-slate-950/20 px-10 py-5 border-b border-slate-800 flex items-center gap-3 print:bg-slate-50 print:border-slate-200">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-sm print:bg-white print:border-slate-200">
              <Hash className="size-4 text-primary print:text-slate-800" />
            </div>
            <span className="text-sm font-black text-slate-200 uppercase tracking-widest print:text-slate-900">Geselecteerde Thema's</span>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {keywordThemes.map((theme) => (
              <div key={theme.id} className="bg-slate-950/20 border border-slate-800/80 p-6 rounded-xl print:bg-slate-50 print:border-slate-200">
                <h4 className="text-sm font-black text-slate-200 mb-4 print:text-slate-900">{theme.name}</h4>
                <div className="flex flex-wrap gap-2">
                  {theme.keywords.map((kw, i) => (
                    <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold rounded-lg print:bg-white print:text-blue-900 print:border-blue-200">
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
        <Card className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl overflow-hidden print:bg-white print:border-slate-200">
          <div className="bg-slate-950/20 px-10 py-5 border-b border-slate-800 flex items-center justify-between print:bg-slate-50 print:border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-sm print:bg-white print:border-slate-200">
                <Search className="size-4 text-primary print:text-slate-800" />
              </div>
              <span className="text-sm font-black text-slate-200 uppercase tracking-widest print:text-slate-900">Belangrijkste Zoekwoorden</span>
            </div>
            <Badge variant="outline" className="rounded-xl px-4 py-1 bg-slate-900 text-slate-200 border-slate-800 shadow-sm print:bg-white print:text-slate-900 print:border-slate-200">
              {selectedKeywords.length} Geselecteerd
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 print:border-slate-200 print:bg-slate-50">
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 print:text-slate-600">Zoekwoord</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 print:text-slate-600 text-right">Volume</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 print:text-slate-600 text-center">Concurrentie</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 print:text-slate-600 text-right">CPC (Laag)</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 print:text-slate-600 text-right">CPC (Hoog)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {selectedKeywords.map((kw, i) => (
                  <tr key={i} className="hover:bg-slate-950/10 transition-colors print:hover:bg-slate-50">
                    <td className="px-10 py-5 font-bold text-slate-200 text-sm print:text-slate-900">{kw.text}</td>
                    <td className="px-10 py-5 text-right">
                      <div className="inline-flex items-center gap-2 bg-slate-950/40 px-3 py-1 rounded-lg border border-slate-800 print:bg-slate-100 print:border-slate-200">
                        <TrendingUp className="size-3 text-primary print:text-slate-700" />
                        <span className="font-bold text-slate-300 print:text-slate-800">{kw.avgMonthlySearches?.toLocaleString('nl-NL') || '-'}</span>
                      </div>
                    </td>
                    <td className="px-10 py-5 text-center">
                      <Badge 
                        variant="secondary" 
                        className={`font-black text-[10px] tracking-wider uppercase border-0 rounded-lg ${
                          kw.competition === 'HIGH' ? 'bg-rose-500/10 text-rose-400 print:bg-rose-50 print:text-rose-700' :
                          kw.competition === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 print:bg-amber-50 print:text-amber-700' :
                          kw.competition === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 print:bg-emerald-50 print:text-emerald-700' :
                          'bg-slate-800 text-slate-400 print:bg-slate-50 print:text-slate-700'
                        }`}
                      >
                        {kw.competition || 'ONBEKEND'}
                      </Badge>
                    </td>
                    <td className="px-10 py-5 text-right font-medium text-slate-400 print:text-slate-650">
                      {kw.lowCpc ? `€${(kw.lowCpc / 1000000).toFixed(2).replace('.', ',')}` : '-'}
                    </td>
                    <td className="px-10 py-5 text-right font-medium text-slate-400 print:text-slate-650">
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
