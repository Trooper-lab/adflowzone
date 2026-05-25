
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    BrainCircuit,
    Copy,
    Check,
    ArrowRight,
    Info,
    Loader2,
    Sparkles,
    AlertTriangle,
    TrendingUp,
    ShieldCheck,
    DollarSign,
    Eye,
    Wrench,
    Search,
    Layers,
    CandlestickChart,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ChildAccount } from '@/lib/types';
import { Combobox } from '@/components/ui/combobox';
import { generateAiChecklist, type GenerateAiChecklistOutput } from '@/ai/flows/generate-ai-checklist';

// Script generator — builds a comprehensive, goal-aware Google Ads data script
function buildScript(account: ChildAccount): string {
    const goalLabel: Record<string, string> = {
        lead_generation: 'Lead Generation — focus op conversies, CPL, zoekterm kwaliteit',
        ecommerce_sales: 'E-commerce — focus op ROAS, conversiewaarde, Shopping/PMax',
        brand_awareness: 'Brand Awareness — focus op bereik, vertoningsaandeel, frequentie',
        app_installs:    'App Installs — focus op installaties, cost-per-install, doelgroepen',
        other:           'Algemeen — brede prestaties en kwaliteitsoptimalisatie',
    };
    const goal = goalLabel[account.primaryGoal] ?? goalLabel.other;

    return `/**
 * AdFlow Zone — AI Checklist Data Bridge v2
 * Account : ${account.nickname}
 * Ads ID  : ${account.googleAdsClientId}
 * Doel    : ${goal}
 *
 * Uitvoeren vanuit MCC > Tools > Scripts.
 * Het script selecteert automatisch het juiste sub-account.
 * Kopieer de volledige output (inclusief de markeringsregels) en plak in AdFlow Zone.
 */
var TARGET_ID = "${account.googleAdsClientId}";

function main() {
  // ── Account selecteren vanuit MCC ─────────────────────────────────────────
  var iter = AdsManagerApp.accounts().withIds([TARGET_ID]).get();
  if (!iter.hasNext()) {
    throw new Error("Account " + TARGET_ID + " niet gevonden in dit MCC.");
  }
  AdsManagerApp.select(iter.next());

  var result = {
    meta: {
      accountId:   AdsApp.currentAccount().getCustomerId(),
      accountName: AdsApp.currentAccount().getName(),
      period:      "LAST_30_DAYS",
      generatedAt: new Date().toISOString(),
    },
    summary:            {},
    campaigns:          [],
    conversionActions:  [],
    pmaxAssetGroups:    [],
    deviceSplit:        [],
    topSearchTerms:     [],
    wastedSearchTerms:  [],
    lowQualityKeywords: [],
  };

  // ── 1. Account-niveau samenvatting ────────────────────────────────────────
  var s = AdsApp.currentAccount().getStatsFor("LAST_30_DAYS");
  result.summary = {
    spend:       +s.getCost().toFixed(2),
    clicks:      s.getClicks(),
    impressions: s.getImpressions(),
    conversions: s.getConversions(),
    ctr:         +(s.getCtr() * 100).toFixed(2),       // als percentage
    avgCpc:      +s.getAverageCpc().toFixed(2),
    costPerConv: s.getConversions() > 0
                   ? +(s.getCost() / s.getConversions()).toFixed(2)
                   : null,
  };

  // ── 2. Campagnes (type, biedstrategie, budget, KPIs) ─────────────────────
  var campRows = AdsApp.search(
    "SELECT " +
    "  campaign.name, campaign.status, campaign.advertising_channel_type, " +
    "  campaign.bidding_strategy_type, " +
    "  campaign.target_cpa.target_cpa_micros, " +
    "  campaign.target_roas.target_roas, " +
    "  campaign_budget.amount_micros, " +
    "  campaign_budget.has_recommended_budget, " +
    "  metrics.cost_micros, metrics.clicks, metrics.impressions, " +
    "  metrics.conversions, metrics.ctr, metrics.average_cpc " +
    "FROM campaign " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND campaign.status != 'REMOVED' " +
    "ORDER BY metrics.cost_micros DESC " +
    "LIMIT 20"
  );
  while (campRows.hasNext()) {
    var r = campRows.next();
    var spend      = r["metrics.cost_micros"] / 1e6;
    var budgetAmt  = r["campaign_budget.amount_micros"]
                       ? r["campaign_budget.amount_micros"] / 1e6 : null;
    var targetCpa  = r["campaign.target_cpa.target_cpa_micros"]
                       ? r["campaign.target_cpa.target_cpa_micros"] / 1e6 : null;
    var convs      = +r["metrics.conversions"];
    result.campaigns.push({
      name:             r["campaign.name"],
      status:           r["campaign.status"],
      type:             r["campaign.advertising_channel_type"],
      biddingStrategy:  r["campaign.bidding_strategy_type"],
      targetCpa:        targetCpa,
      targetRoas:       r["campaign.target_roas.target_roas"] || null,
      dailyBudget:      budgetAmt,
      budgetLimited:    r["campaign_budget.has_recommended_budget"] === true,
      spend:            +spend.toFixed(2),
      budgetUsagePct:   budgetAmt && budgetAmt > 0
                          ? +((spend / (budgetAmt * 30)) * 100).toFixed(1)
                          : null,
      clicks:           +r["metrics.clicks"],
      impressions:      +r["metrics.impressions"],
      conversions:      convs,
      ctr:              +(r["metrics.ctr"] * 100).toFixed(2),
      avgCpc:           +(r["metrics.average_cpc"] / 1e6).toFixed(2),
      costPerConv:      convs > 0 ? +(spend / convs).toFixed(2) : null,
    });
  }

  // ── 3. Conversie-acties ───────────────────────────────────────────────────
  // Step A: definitions (no metrics allowed on conversion_action resource)
  var convDefs = {};
  var defRows = AdsApp.search(
    "SELECT " +
    "  conversion_action.name, conversion_action.category, " +
    "  conversion_action.status, conversion_action.counting_type " +
    "FROM conversion_action"
  );
  while (defRows.hasNext()) {
    var r = defRows.next();
    var n = r["conversion_action.name"];
    convDefs[n] = {
      name:         n,
      category:     r["conversion_action.category"],
      status:       r["conversion_action.status"],
      countingType: r["conversion_action.counting_type"],
      conversions:  0,
      allConversions: 0,
    };
  }
  // Step B: metrics via campaign segmented by conversion action
  var convMetricRows = AdsApp.search(
    "SELECT " +
    "  segments.conversion_action_name, " +
    "  metrics.conversions, metrics.all_conversions " +
    "FROM campaign " +
    "WHERE segments.date DURING LAST_30_DAYS"
  );
  while (convMetricRows.hasNext()) {
    var r = convMetricRows.next();
    var n = r["segments.conversion_action_name"];
    if (convDefs[n]) {
      convDefs[n].conversions    += +r["metrics.conversions"];
      convDefs[n].allConversions += +r["metrics.all_conversions"];
    }
  }
  for (var key in convDefs) { result.conversionActions.push(convDefs[key]); }
  result.conversionActions.sort(function(a, b) { return b.conversions - a.conversions; });

  // ── 4. Performance Max — asset group data ─────────────────────────────────
  var pmaxRows = AdsApp.search(
    "SELECT " +
    "  campaign.name, asset_group.name, asset_group.status, " +
    "  metrics.cost_micros, metrics.clicks, metrics.impressions, " +
    "  metrics.conversions, metrics.ctr " +
    "FROM asset_group " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND campaign.advertising_channel_type = 'PERFORMANCE_MAX' " +
    "ORDER BY metrics.cost_micros DESC " +
    "LIMIT 20"
  );
  while (pmaxRows.hasNext()) {
    var r = pmaxRows.next();
    result.pmaxAssetGroups.push({
      campaign:    r["campaign.name"],
      assetGroup:  r["asset_group.name"],
      status:      r["asset_group.status"],
      spend:       +(r["metrics.cost_micros"] / 1e6).toFixed(2),
      clicks:      +r["metrics.clicks"],
      impressions: +r["metrics.impressions"],
      conversions: +r["metrics.conversions"],
      ctr:         +(r["metrics.ctr"] * 100).toFixed(2),
    });
  }

  // ── 5. Device split ───────────────────────────────────────────────────────
  var deviceRows = AdsApp.search(
    "SELECT " +
    "  segments.device, metrics.cost_micros, metrics.clicks, " +
    "  metrics.impressions, metrics.conversions, metrics.ctr " +
    "FROM campaign " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND campaign.status = 'ENABLED' " +
    "ORDER BY metrics.cost_micros DESC"
  );
  var deviceMap = {};
  while (deviceRows.hasNext()) {
    var r = deviceRows.next();
    var dev = r["segments.device"];
    if (!deviceMap[dev]) {
      deviceMap[dev] = { device: dev, spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    }
    deviceMap[dev].spend       += r["metrics.cost_micros"] / 1e6;
    deviceMap[dev].clicks      += +r["metrics.clicks"];
    deviceMap[dev].impressions += +r["metrics.impressions"];
    deviceMap[dev].conversions += +r["metrics.conversions"];
  }
  for (var dev in deviceMap) {
    var d = deviceMap[dev];
    d.spend       = +d.spend.toFixed(2);
    d.costPerConv = d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : null;
    result.deviceSplit.push(d);
  }

  // ── 6. Beste zoektermen (op conversies) ──────────────────────────────────
  var topTermRows = AdsApp.search(
    "SELECT " +
    "  search_term_view.search_term, campaign.name, " +
    "  metrics.clicks, metrics.impressions, metrics.conversions, " +
    "  metrics.cost_micros, metrics.ctr " +
    "FROM search_term_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND metrics.conversions > 0 " +
    "ORDER BY metrics.conversions DESC " +
    "LIMIT 15"
  );
  while (topTermRows.hasNext()) {
    var r = topTermRows.next();
    result.topSearchTerms.push({
      term:        r["search_term_view.search_term"],
      campaign:    r["campaign.name"],
      clicks:      +r["metrics.clicks"],
      conversions: +r["metrics.conversions"],
      spend:       +(r["metrics.cost_micros"] / 1e6).toFixed(2),
      ctr:         +(r["metrics.ctr"] * 100).toFixed(2),
    });
  }

  // ── 7. Verspild budget (spend zonder conversies) ──────────────────────────
  var wastedRows = AdsApp.search(
    "SELECT " +
    "  search_term_view.search_term, campaign.name, " +
    "  metrics.clicks, metrics.cost_micros " +
    "FROM search_term_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND metrics.conversions = 0 " +
    "  AND metrics.cost_micros > 3000000 " +
    "ORDER BY metrics.cost_micros DESC " +
    "LIMIT 15"
  );
  while (wastedRows.hasNext()) {
    var r = wastedRows.next();
    result.wastedSearchTerms.push({
      term:     r["search_term_view.search_term"],
      campaign: r["campaign.name"],
      clicks:   +r["metrics.clicks"],
      spend:    +(r["metrics.cost_micros"] / 1e6).toFixed(2),
    });
  }

  // ── 8. Lage kwaliteitsscores (actieve keywords < 7) ──────────────────────
  // Quality score is a current attribute — cannot combine with date-range metrics
  var qsRows = AdsApp.search(
    "SELECT " +
    "  ad_group_criterion.keyword.text, " +
    "  ad_group_criterion.quality_info.quality_score, " +
    "  ad_group_criterion.quality_info.creative_quality_score, " +
    "  ad_group_criterion.quality_info.post_click_quality_score, " +
    "  ad_group_criterion.quality_info.search_predicted_ctr, " +
    "  campaign.name, ad_group.name " +
    "FROM ad_group_criterion " +
    "WHERE ad_group_criterion.type = 'KEYWORD' " +
    "  AND ad_group_criterion.status = 'ENABLED' " +
    "  AND ad_group.status = 'ENABLED' " +
    "  AND campaign.status = 'ENABLED' " +
    "  AND ad_group_criterion.quality_info.quality_score < 7 " +
    "ORDER BY ad_group_criterion.quality_info.quality_score ASC " +
    "LIMIT 15"
  );
  while (qsRows.hasNext()) {
    var r = qsRows.next();
    result.lowQualityKeywords.push({
      keyword:        r["ad_group_criterion.keyword.text"],
      qualityScore:   +r["ad_group_criterion.quality_info.quality_score"],
      adRelevance:    r["ad_group_criterion.quality_info.creative_quality_score"],
      landingPageExp: r["ad_group_criterion.quality_info.post_click_quality_score"],
      expectedCtr:    r["ad_group_criterion.quality_info.search_predicted_ctr"],
      campaign:       r["campaign.name"],
      adGroup:        r["ad_group.name"],
    });
  }

  Logger.log("--- START ADFLOW AI JSON ---");
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log("--- EIND ADFLOW AI JSON ---");
}`;
}

const CATEGORY_CONFIG = {
    budget:        { label: 'Budget',        icon: DollarSign,       color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
    kwaliteit:     { label: 'Kwaliteit',     icon: ShieldCheck,      color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
    conversie:     { label: 'Conversie',     icon: TrendingUp,       color: 'text-green-400',   bg: 'bg-green-500/10 border-green-500/20' },
    zoektermen:    { label: 'Zoektermen',    icon: Search,           color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
    pmax:          { label: 'PMax',          icon: Layers,           color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
    biedstrategie: { label: 'Biedstrategie', icon: CandlestickChart, color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
    bereik:        { label: 'Bereik',        icon: Eye,              color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20' },
} as const;

const PRIORITY_CONFIG = {
    critical: { label: 'Kritiek', className: 'bg-red-600/30 text-red-300 border-red-500/50' },
    high:     { label: 'Hoog',    className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    medium:   { label: 'Midden',  className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    low:      { label: 'Laag',    className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
} as const;

export default function AiChecklistPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [accounts, setAccounts] = useState<ChildAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [copiedScript, setCopiedScript] = useState(false);
    const [rawJson, setRawJson] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GenerateAiChecklistOutput | null>(null);

    useEffect(() => {
        if (!firestore || !user) return;
        const fetch = async () => {
            setLoadingAccounts(true);
            try {
                const clientsSnap = await getDocs(
                    query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid))
                );
                const allAccounts: ChildAccount[] = [];
                for (const clientDoc of clientsSnap.docs) {
                    const accSnap = await getDocs(
                        collection(firestore, 'parentClients', clientDoc.id, 'childAccounts')
                    );
                    accSnap.forEach(d => allAccounts.push({ id: d.id, ...d.data() } as ChildAccount));
                }
                setAccounts(
                    allAccounts.filter(a => !a.isPaused).sort((a, b) => a.nickname.localeCompare(b.nickname))
                );
            } catch (e) {
                console.error('Fout bij laden accounts:', e);
            } finally {
                setLoadingAccounts(false);
            }
        };
        fetch();
    }, [firestore, user]);

    const accountOptions = useMemo(
        () => accounts.map(a => ({ value: a.id, label: a.nickname })),
        [accounts]
    );

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    const script = selectedAccount ? buildScript(selectedAccount) : '';

    const handleCopyScript = () => {
        navigator.clipboard.writeText(script).then(() => {
            setCopiedScript(true);
            toast({ title: 'Script gekopieerd!', description: 'Plak het script in Google Ads > Tools > Scripts.' });
            setTimeout(() => setCopiedScript(false), 3000);
        });
    };

    const handleGenerate = async () => {
        if (!selectedAccount || !rawJson.trim()) return;

        let jsonString = rawJson;
        const start = '--- START ADFLOW AI JSON ---';
        const end   = '--- EIND ADFLOW AI JSON ---';
        if (jsonString.includes(start)) {
            jsonString = jsonString.split(start)[1].split(end)[0].trim();
        }

        setIsGenerating(true);
        setResult(null);
        try {
            const output = await generateAiChecklist({
                accountNickname: selectedAccount.nickname,
                primaryGoal:     selectedAccount.primaryGoal,
                targetKpiValues: selectedAccount.targetKpiValues,
                scriptData:      jsonString,
            });
            setResult(output);
        } catch (e) {
            console.error('Genereren mislukt:', e);
            toast({ variant: 'destructive', title: 'Genereren mislukt', description: 'Controleer of de JSON geldig is.' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold font-headline tracking-tight text-slate-100 flex items-center gap-3">
                    <BrainCircuit className="text-purple-400 size-8" />
                    AI Checklist Generator
                </h1>
                <p className="text-muted-foreground mt-2 font-medium">
                    Selecteer een account, kopieer het script naar Google Ads en plak de output terug voor een context-bewuste checklijst.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left: Account + Script */}
                <div className="lg:col-span-5 space-y-6">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">1. Selecteer Account</h2>

                    <Card className="glass-card">
                        <CardContent className="pt-6 space-y-4">
                            <Combobox
                                options={accountOptions}
                                value={selectedAccountId}
                                onValueChange={(val) => {
                                    setSelectedAccountId(val);
                                    setResult(null);
                                    setRawJson('');
                                }}
                                placeholder="Kies een account..."
                                loading={loadingAccounts}
                            />

                            {selectedAccount && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        <span>Google Ads Script</span>
                                        <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[9px]">
                                            {selectedAccount.primaryGoal.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>

                                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                                        <pre className="text-[9px] text-green-400 font-mono p-4 overflow-auto max-h-[360px] leading-relaxed custom-scrollbar whitespace-pre-wrap">
                                            {script}
                                        </pre>
                                        <div className="absolute top-2 right-2">
                                            <Button
                                                size="sm"
                                                onClick={handleCopyScript}
                                                className={cn(
                                                    'h-7 text-[10px] font-black uppercase tracking-widest transition-all',
                                                    copiedScript
                                                        ? 'bg-green-600 hover:bg-green-600'
                                                        : 'bg-purple-600 hover:bg-purple-500'
                                                )}
                                            >
                                                {copiedScript
                                                    ? <><Check className="mr-1.5 size-3" /> Gekopieerd</>
                                                    : <><Copy className="mr-1.5 size-3" /> Kopieer Script</>
                                                }
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* How it works */}
                    <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                            <Info className="size-4" /> Hoe werkt het?
                        </h4>
                        <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                            <li>Selecteer het account dat je wilt analyseren.</li>
                            <li>Kopieer het gegenereerde script met de knop hierboven.</li>
                            <li>Ga in Google Ads naar <strong>Tools &gt; Scripts</strong> en voer het script uit.</li>
                            <li>Kopieer de JSON-output uit de logs en plak deze rechts.</li>
                            <li>Klik op <strong>Genereer Checklist</strong> voor 3-4 prioritaire actiepunten.</li>
                        </ol>
                    </div>
                </div>

                {/* Right: JSON input + result */}
                <div className="lg:col-span-7 space-y-6">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">2. Plak Output & Genereer</h2>

                    <Card className="glass-card shadow-xl overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/5">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Sparkles className="size-5 text-purple-400" />
                                JSON Output Plakken
                            </CardTitle>
                            <CardDescription>Plak de volledige logs uit Google Ads hieronder.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <Textarea
                                placeholder="Plak hier de output van het Google Ads script..."
                                className="h-[200px] bg-slate-950 border-slate-800 font-mono text-[10px] text-green-400 focus:ring-purple-500/20"
                                value={rawJson}
                                onChange={(e) => setRawJson(e.target.value)}
                                disabled={!selectedAccount}
                            />
                            <Button
                                onClick={handleGenerate}
                                className="w-full bg-purple-600 hover:bg-purple-500 font-bold uppercase tracking-widest text-xs h-12"
                                disabled={!selectedAccount || !rawJson.trim() || isGenerating}
                            >
                                {isGenerating
                                    ? <><Loader2 className="animate-spin size-4 mr-2" /> AI analyseert data...</>
                                    : <><BrainCircuit className="size-4 mr-2" /> Genereer Checklist <ArrowRight className="ml-2 size-4" /></>
                                }
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Results */}
                    {result && result.items.length > 0 && (
                        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Prioritaire Actiepunten
                                </h3>
                                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                                    {result.items.length} punten · {selectedAccount?.nickname}
                                </Badge>
                            </div>

                            {result.contextSummary && (
                                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-sm text-slate-300 leading-relaxed">
                                    {result.contextSummary}
                                </div>
                            )}

                            {result.items.map((item, i) => {
                                const cat = CATEGORY_CONFIG[item.category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.bereik;
                                const pri = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
                                const CatIcon = cat.icon;

                                return (
                                    <Card
                                        key={i}
                                        className={cn(
                                            'border transition-all',
                                            item.priority === 'critical'
                                                ? 'bg-red-950/20 border-red-500/30 hover:border-red-500/50'
                                                : 'glass-card hover:border-purple-500/20'
                                        )}
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-start gap-4">
                                                <div className={cn('p-2.5 rounded-xl border shrink-0', cat.bg)}>
                                                    <CatIcon className={cn('size-5', cat.color)} />
                                                </div>
                                                <div className="flex-grow min-w-0 space-y-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-slate-100">{item.title}</p>
                                                        <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest', pri.className)}>
                                                            {pri.label}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[9px] font-bold capitalize border-slate-700 text-slate-400">
                                                            {cat.label}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-slate-300 leading-relaxed">
                                                        {item.description}
                                                    </p>
                                                    {item.impact && (
                                                        <p className="text-[11px] font-semibold text-purple-400/80 flex items-start gap-1.5">
                                                            <TrendingUp className="size-3 mt-0.5 shrink-0" />
                                                            {item.impact}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
