'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { KpiData, ChildAccount } from '@/lib/types';
import { startOfMonth, subMonths, format, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Pencil, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiStandardTableProps {
    childAccount: ChildAccount;
    onSave: (data: Record<string, Record<string, number | string>>) => Promise<void>;
    isSaving: boolean;
    onRefetchNeeded: () => void;
}

export default function KpiStandardTable({ childAccount, onSave, isSaving, onRefetchNeeded }: KpiStandardTableProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [tableData, setTableData] = useState<Record<string, Record<string, number | string>>>({});
    const [editMonth, setEditMonth] = useState<string | null>(null);
    const [visibleMonths, setVisibleMonths] = useState(6);

    const months = useMemo(() => {
        const today = new Date();
        return Array.from({ length: visibleMonths }, (_, i) => startOfMonth(subMonths(today, i)));
    }, [visibleMonths]);

    useEffect(() => {
        const fetchKpiData = async () => {
            if (!firestore || !user || !childAccount.kpiDataIds || childAccount.kpiDataIds.length === 0) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const kpiPromises = childAccount.kpiDataIds.map(kpiId => getDoc(doc(firestore, 'kpiData', kpiId)));
                const kpiSnaps = await Promise.all(kpiPromises);
                const fetchedKpis = kpiSnaps
                    .filter(snap => snap.exists())
                    .map(snap => ({ id: snap.id, ...snap.data() } as KpiData));

                const dataByMonth: Record<string, Record<string, number | string>> = {};
                fetchedKpis.forEach(kpiDoc => {
                    const monthKey = format(new Date(kpiDoc.startDate), 'yyyy-MM');
                    dataByMonth[monthKey] = kpiDoc.kpiValues;
                });
                
                setTableData(dataByMonth);

            } catch (e) {
                console.error("Error fetching kpi data", e);
            } finally {
                setLoading(false);
            }
        };

        fetchKpiData();
    }, [firestore, user, childAccount.kpiDataIds, onRefetchNeeded]);

    const handleValueChange = (month: string, kpi: string, value: string) => {
        const isInteger = ['clicks', 'impressions', 'conversions'].includes(kpi);
        setTableData(prev => ({
            ...prev,
            [month]: {
                ...prev[month],
                [kpi]: isInteger ? (parseInt(value, 10) || 0).toString() : value,
            },
        }));
    };

    const handleSaveMonth = (monthKey: string) => {
        onSave({[monthKey]: tableData[monthKey]}).then(() => {
            setEditMonth(null);
        });
    }

    if (loading) {
        return <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /> <span className="ml-2">Loading KPI data...</span></div>
    }

    return (
        <div className="space-y-2">
            {months.map(monthDate => {
                const monthKey = format(monthDate, 'yyyy-MM');
                const monthData = tableData[monthKey] || {};
                const isEditing = editMonth === monthKey;

                const calculateValue = (kpi: string) => {
                    const spend = parseFloat(monthData['spend'] as string);
                    const clicks = parseInt(monthData['clicks'] as string);
                    const impressions = parseInt(monthData['impressions'] as string);
                    const conversions = parseInt(monthData['conversions'] as string);
                    const conversionValue = parseFloat(monthData['conversion_value'] as string);

                    switch (kpi) {
                        case 'cpc':
                            return clicks > 0 ? `€${(spend / clicks).toFixed(2)}` : '-';
                        case 'ctr':
                            return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-';
                        case 'cpl':
                            return conversions > 0 ? `€${(spend / conversions).toFixed(2)}` : '-';
                         case 'roas':
                            return spend > 0 ? `${(conversionValue / spend).toFixed(2)}x` : '-';
                        default:
                            return monthData[kpi] ?? '';
                    }
                };

                const isCurrency = (kpi: string) => ['spend', 'conversion_value'].includes(kpi);
                const isCalculated = (kpi: string) => ['cpc', 'ctr', 'cpl', 'roas'].includes(kpi);
                const isInteger = (kpi: string) => ['clicks', 'impressions', 'conversions'].includes(kpi);

                return (
                    <div key={monthKey} className="grid grid-cols-[120px_1fr_80px] items-center gap-4 p-2 rounded-lg hover:bg-slate-800/50">
                        <div className="font-medium text-muted-foreground flex items-center gap-2">
                           {isToday(monthDate) && <div className="size-2 rounded-full bg-blue-500" />}
                           {format(monthDate, 'MMM yyyy')}
                        </div>
                        <div className="grid grid-cols-6 gap-x-4">
                             {childAccount.kpisToTrack.map(kpi => (
                                <div key={kpi} className="space-y-1">
                                    {isEditing ? (
                                        isCalculated(kpi) ? (
                                            <div className="text-sm h-8 flex items-center px-3 text-muted-foreground">
                                                {calculateValue(kpi)}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                {isCurrency(kpi) && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>}
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    value={monthData[kpi] as string || ''}
                                                    onChange={(e) => handleValueChange(monthKey, kpi, e.target.value)}
                                                    className={cn("text-sm h-8 no-spinners bg-slate-900/50", isCurrency(kpi) && "pl-6")}
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className={cn("text-sm h-8 flex items-center px-3", !monthData[kpi] && 'text-muted-foreground')}>
                                            {calculateValue(kpi)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="text-right">
                           {isEditing ? (
                               <Button size="icon" variant="ghost" onClick={() => handleSaveMonth(monthKey)} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Save className="text-blue-400" />}
                                </Button>
                           ) : (
                                <Button size="icon" variant="ghost" onClick={() => setEditMonth(monthKey)}>
                                    <Pencil />
                                </Button>
                           )}
                        </div>
                    </div>
                );
            })}
             <div className="text-center pt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setVisibleMonths(p => p + 6)}>
                    Show earlier months <ArrowDown className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
}
