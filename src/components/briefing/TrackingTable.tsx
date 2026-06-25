import { TrackingGoal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface TrackingTableProps {
  tracking: TrackingGoal[];
}

export function TrackingTable({ tracking }: TrackingTableProps) {
  return (
    <div className="divide-y divide-slate-800 print:divide-slate-200">
      {tracking.map((item, i) => (
        <div key={i} className="p-8 flex items-center justify-between group hover:bg-slate-950/10 transition-colors print:hover:bg-slate-50">
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm group-hover:scale-110 transition-transform print:bg-emerald-50 print:text-emerald-700 print:border-emerald-100`}>
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <div className="text-base font-black text-slate-200 mb-1 print:text-slate-900">{item.goal}</div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-slate-900 text-slate-400 border border-slate-800/80 font-black text-[10px] uppercase tracking-[0.15em] px-3 py-1 rounded-lg print:bg-slate-50 print:text-slate-700 print:border-slate-200">
                  Method: {item.method}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge 
              variant="outline" 
              className={`font-black text-[11px] tracking-widest px-4 py-1.5 rounded-lg border ${
                item.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 print:bg-rose-50 print:text-rose-700 print:border-rose-200' :
                item.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 print:bg-amber-50 print:text-amber-700 print:border-amber-200' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20 print:bg-blue-50 print:text-blue-700 print:border-blue-200'
              }`}
            >
              {item.priority.toUpperCase()} PRIORITY
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
