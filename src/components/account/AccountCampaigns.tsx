'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { ChildAccount, AccountCampaignData, CampaignPerformance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { fetchCampaignPerformance } from '@/app/actions/google-ads-campaigns';
import { Loader2, RefreshCw, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AccountCampaigns({
  childAccount,
}: {
  childAccount: ChildAccount;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [data, setData] = useState<AccountCampaignData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const period = 'THIS_MONTH';

  useEffect(() => {
    async function loadData() {
      if (!firestore || !childAccount) return;
      setLoading(true);
      try {
        const docRef = doc(firestore, 'campaignPerformance', `${childAccount.id}_${period}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setData(snap.data() as AccountCampaignData);
        }
      } catch (err) {
        console.error('Error loading campaign data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [firestore, childAccount]);

  const handleSync = async () => {
    if (!firestore || !childAccount.googleAdsClientId) {
      toast({ title: 'Ontbrekende Google Ads ID', variant: 'destructive' });
      return;
    }
    
    setFetching(true);
    try {
      const result = await fetchCampaignPerformance(
        childAccount.id,
        childAccount.googleAdsClientId,
        period
      );
      
      const docRef = doc(firestore, 'campaignPerformance', `${childAccount.id}_${period}`);
      await setDoc(docRef, result);
      
      setData(result);
      toast({ title: 'Campagne data gesynchroniseerd' });
    } catch (err: any) {
      console.error('Error syncing campaigns:', err);
      toast({ 
        title: 'Fout bij synchroniseren', 
        description: err.message || 'Er is een fout opgetreden',
        variant: 'destructive' 
      });
    } finally {
      setFetching(false);
    }
  };

  const formatCurrency = (val: number) => `€${val.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Campagne Prestaties (Deze Maand)</h3>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSync}
          disabled={fetching || !childAccount.googleAdsClientId}
          className="border-[#2A3552] bg-secondary hover:bg-accent text-slate-300"
        >
          {fetching ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <RefreshCw className="size-3.5 mr-2" />}
          Data Ophalen
        </Button>
      </div>

      {!childAccount.googleAdsClientId && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
          Google Ads Client ID ontbreekt. Vul deze in via de instellingen om data te kunnen ophalen.
        </div>
      )}

      {data ? (
        <div className="rounded-md border border-[#2A3552] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[10px] uppercase bg-secondary text-slate-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Campagne</th>
                  <th className="px-4 py-3 font-semibold text-right">Kosten</th>
                  <th className="px-4 py-3 font-semibold text-right">Klikken</th>
                  <th className="px-4 py-3 font-semibold text-right">Weergaven</th>
                  <th className="px-4 py-3 font-semibold text-right">CTR</th>
                  <th className="px-4 py-3 font-semibold text-right">Conversies</th>
                  <th className="px-4 py-3 font-semibold text-right">CPA</th>
                  <th className="px-4 py-3 font-semibold text-right">ROAS</th>
                  <th className="px-4 py-3 font-semibold text-right">Vert.Aandeel (Z)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A3552]">
                {data.campaigns.length > 0 ? data.campaigns.map((camp: CampaignPerformance) => (
                  <tr key={camp.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{camp.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{camp.status}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(camp.cost)}</td>
                    <td className="px-4 py-3 text-right">{camp.clicks.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right">{camp.impressions.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(camp.ctr)}</td>
                    <td className="px-4 py-3 text-right">{camp.conversions.toLocaleString('nl-NL', {maximumFractionDigits: 1})}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(camp.costPerConversion)}</td>
                    <td className="px-4 py-3 text-right">{camp.roas > 0 ? formatPercent(camp.roas) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {camp.searchImpressionShare !== undefined 
                        ? (camp.searchImpressionShare < 0.0999 ? '< 10%' : formatPercent(camp.searchImpressionShare))
                        : '-'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      Geen campagnes gevonden voor deze maand.
                    </td>
                  </tr>
                )}
              </tbody>
              {data.campaigns.length > 0 && (
                <tfoot className="bg-secondary border-t border-[#2A3552] font-semibold text-slate-200">
                  <tr>
                    <td className="px-4 py-3">Totaal</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(data.totals.cost)}</td>
                    <td className="px-4 py-3 text-right">{data.totals.clicks.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right">{data.totals.impressions.toLocaleString('nl-NL')}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(data.totals.ctr)}</td>
                    <td className="px-4 py-3 text-right">{data.totals.conversions.toLocaleString('nl-NL', {maximumFractionDigits: 1})}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(data.totals.costPerConversion)}</td>
                    <td className="px-4 py-3 text-right">{data.totals.roas > 0 ? formatPercent(data.totals.roas) : '-'}</td>
                    <td className="px-4 py-3 text-right">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="px-4 py-2 text-[10px] text-slate-500 text-right bg-[#1C243A]">
            Laatst gesynchroniseerd: {new Date(data.lastSyncedAt).toLocaleString('nl-NL')}
          </div>
        </div>
      ) : (
        !fetching && childAccount.googleAdsClientId && (
          <div className="text-sm text-slate-400 p-4 border border-dashed border-[#2A3552] rounded-md text-center">
            Geen data beschikbaar. Klik op 'Data Ophalen' om de campagneprestaties van deze maand in te laden.
          </div>
        )
      )}
    </div>
  );
}
