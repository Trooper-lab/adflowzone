import React from 'react';
import { KPI } from '@/lib/types';

interface KPITableProps {
  kpis: KPI[];
}

export function KPITable({ kpis }: KPITableProps) {
  return (
    <div className="divide-y divide-white/10">
      {kpis.map((kpi, i) => (
        <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between group">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest mb-0.5 group-hover:text-white transition-colors">{kpi.name}</span>
            <span className="text-[11px] text-white/60 font-medium italic">{kpi.note}</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-white">{kpi.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
