import { Badge } from '@/components/ui/badge';
import { Search, Zap, Target } from 'lucide-react';
import { BudgetAllocation } from '@/lib/types';

interface BudgetGridProps {
  allocation: BudgetAllocation;
}

export function BudgetGrid({ allocation }: BudgetGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Search Budget */}
      <div className="group rounded-2xl p-8 bg-slate-900/40 border border-slate-800/80 shadow-lg hover:shadow-xl hover:border-slate-700/50 transition-all print:bg-white print:border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 print:bg-blue-50 print:border-blue-100 print:text-blue-600">
             <Search className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-0 font-black text-[10px] px-3 py-1 print:bg-blue-100 print:text-blue-600">SEARCH</Badge>
        </div>
        <div className="text-4xl font-black text-slate-100 mb-1 tracking-tight print:text-slate-900">{allocation.searchBudget}</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 print:text-slate-600">Google Search Network</div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium print:text-slate-800">Focus op zoekwoorden met hoge koopintentie voor directe conversies.</p>
      </div>

      {/* PMax Budget */}
      <div className="group rounded-2xl p-8 bg-slate-900/40 border border-slate-800/80 shadow-lg hover:shadow-xl hover:border-slate-700/50 transition-all print:bg-white print:border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 print:bg-purple-50 print:border-purple-100 print:text-purple-600">
             <Zap className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-0 font-black text-[10px] px-3 py-1 print:bg-purple-100 print:text-purple-600">PMAX</Badge>
        </div>
        <div className="text-4xl font-black text-slate-100 mb-1 tracking-tight print:text-slate-900">{allocation.pmaxBudget}</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 print:text-slate-600">Performance Max</div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium print:text-slate-800">AI-gestuurd bereik over alle Google kanalen voor maximale schaalbaarheid.</p>
      </div>

      {/* Total Budget */}
      <div className="group rounded-2xl p-8 bg-slate-950 border border-slate-800/80 shadow-2xl hover:border-slate-700/50 transition-all relative overflow-hidden print:bg-white print:border-slate-200">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl print:hidden" />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
             <Target className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-emerald-500 text-white border-0 font-black text-[10px] px-3 py-1">TOTAL</Badge>
        </div>
        <div className="text-4xl font-black text-white mb-1 tracking-tight relative z-10 print:text-slate-900">{allocation.totalBudget}</div>
        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 relative z-10">Google Ads Maandbudget</div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium relative z-10 italic print:text-slate-700">
          "{allocation.rationale}"
        </p>
      </div>
    </div>
  );
}
