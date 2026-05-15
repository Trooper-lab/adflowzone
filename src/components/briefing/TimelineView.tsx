import React from 'react';
import { TimelineStep } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface TimelineViewProps {
  timeline: TimelineStep[];
}

export function TimelineView({ timeline }: TimelineViewProps) {
  return (
    <div className="relative px-12">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {timeline.map((step, i) => (
            <CarouselItem key={i} className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="h-full">
                <div className="flex flex-col h-full bg-slate-50/50 rounded-3xl p-6 border border-slate-100 hover:border-emerald-200 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:border-emerald-200 transition-all">
                      <span className="text-slate-400 group-hover:text-emerald-600 font-black text-xs transition-colors">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-0 font-black text-[9px] uppercase tracking-widest px-2 py-1">
                      {step.dateRange}
                    </Badge>
                  </div>
                  
                  <h4 className="font-black text-slate-900 tracking-tight mb-4">{step.milestone}</h4>
                  
                  <div className="flex-grow">
                    <ul className="space-y-2.5">
                      {step.tasks.map((task, taskIndex) => (
                        <li key={taskIndex} className="flex items-start gap-2.5 text-[11px] font-bold text-slate-500 leading-tight">
                          <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4 border-slate-200" />
        <CarouselNext className="hidden md:flex -right-4 border-slate-200" />
      </Carousel>
    </div>
  );
}
