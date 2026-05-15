import { TrackingGoal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface TrackingTableProps {
  tracking: TrackingGoal[];
}

export function TrackingTable({ tracking }: TrackingTableProps) {
  return (
    <div className="divide-y divide-slate-100">
      {tracking.map((item, i) => (
        <div key={i} className="p-8 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm group-hover:scale-110 transition-transform`}>
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 mb-1">{item.goal}</div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 font-black text-[10px] uppercase tracking-[0.15em] px-3 py-1">
                  Method: {item.method}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge 
              variant="outline" 
              className={`font-black text-[11px] tracking-widest px-4 py-1.5 rounded-xl border-2 ${
                item.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100/50' :
                item.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100/50' :
                'bg-blue-50 text-blue-600 border-blue-100/50'
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
