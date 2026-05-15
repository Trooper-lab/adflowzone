import { Badge } from '@/components/ui/badge';
import { Search, Zap, Target } from 'lucide-react';

interface BudgetGridProps {
  allocation: BudgetAllocation;
}

export function BudgetGrid({ allocation }: BudgetGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Search Budget */}
      <div className="group rounded-[2rem] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
             <Search className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-0 font-black text-[10px] px-3 py-1">SEARCH</Badge>
        </div>
        <div className="text-4xl font-black text-slate-900 mb-1 tracking-tight">{allocation.searchBudget}</div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Google Search Network</div>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">Focus op zoekwoorden met hoge koopintentie voor directe conversies.</p>
      </div>

      {/* PMax Budget */}
      <div className="group rounded-[2rem] p-8 bg-white border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
             <Zap className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-0 font-black text-[10px] px-3 py-1">PMAX</Badge>
        </div>
        <div className="text-4xl font-black text-slate-900 mb-1 tracking-tight">{allocation.pmaxBudget}</div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Performance Max</div>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">AI-gestuurd bereik over alle Google kanalen voor maximale schaalbaarheid.</p>
      </div>

      {/* Total Budget */}
      <div className="group rounded-[2rem] p-8 bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-900/40 hover:shadow-slate-900/60 transition-all relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
             <Target className="size-5" />
          </div>
          <Badge variant="secondary" className="bg-emerald-500 text-white border-0 font-black text-[10px] px-3 py-1">TOTAL</Badge>
        </div>
        <div className="text-4xl font-black text-white mb-1 tracking-tight relative z-10">{allocation.totalBudget}</div>
        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 relative z-10">Google Ads Maandbudget</div>
        <p className="text-xs text-slate-200 leading-relaxed font-medium relative z-10 italic">
          "{allocation.rationale}"
        </p>
      </div>
    </div>
  );
}
