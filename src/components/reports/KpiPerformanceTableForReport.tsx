'use client';

import { useMemo } from 'react';
import type { ChildAccount, KpiData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subMonths, startOfMonth } from 'date-fns';

export function KpiPerformanceTableForReport({ childAccount, kpiData, reportDate }: { childAccount: ChildAccount, kpiData: KpiData[], reportDate: Date }) {

    const months = useMemo(() => {
        return Array.from({ length: 13 }, (_, i) => startOfMonth(subMonths(reportDate, i)));
    }, [reportDate]);

    const dataByMonth = useMemo(() => {
        const map = new Map<string, Record<string, number>>();
        kpiData.forEach(kd => {
            const monthKey = format(new Date(kd.startDate), 'yyyy-MM');
            map.set(monthKey, kd.kpiValues);
        });
        return map;
    }, [kpiData]);

    const calculateValue = (kpi: string, data: Record<string, number> | undefined) => {
        if (!data) return '-';
        
        const spend = Number(data['spend']) || 0;
        const clicks = Number(data['clicks']) || 0;
        const impressions = Number(data['impressions']) || 0;
        const conversions = Number(data['conversions']) || 0;
        const conversionValue = Number(data['conversion_value']) || 0;

        switch (kpi) {
            case 'cpc':
                return clicks > 0 ? `€${(spend / clicks).toFixed(2)}` : '-';
            case 'ctr':
                return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-';
            case 'cpl':
                return conversions > 0 ? `€${(spend / conversions).toFixed(2)}` : '-';
            case 'roas':
                return spend > 0 ? `${(conversionValue / spend).toFixed(2)}x` : '-';
            case 'spend':
            case 'conversion_value':
                 return `€${Number(data[kpi] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            default:
                return (data[kpi] as number)?.toLocaleString() ?? '0';
        }
    };
    
    if (kpiData.length === 0) {
        return <p className="text-muted-foreground">No KPI data was recorded for this reporting period.</p>
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[120px]">Month</TableHead>
                     {childAccount.kpisToTrack.map(kpi => (
                        <TableHead key={kpi} className="capitalize w-[150px]">{kpi.replace(/_/g, ' ')}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {months.map(monthDate => {
                    const monthKey = format(monthDate, 'yyyy-MM');
                    const monthData = dataByMonth.get(monthKey);

                    if (!monthData) {
                        return null;
                    }

                    return (
                        <TableRow key={monthKey} className={format(monthDate, 'yyyy-MM') === format(reportDate, 'yyyy-MM') ? 'bg-secondary' : ''}>
                            <TableCell className="font-medium text-muted-foreground">{format(monthDate, 'MMM yyyy')}</TableCell>
                            {childAccount.kpisToTrack.map(kpi => (
                                <TableCell key={kpi}>{calculateValue(kpi, monthData)}</TableCell>
                            ))}
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    );
}
