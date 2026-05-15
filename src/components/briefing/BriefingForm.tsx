'use client';

import { useState, useEffect } from 'react';
import { BriefingContext } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Building2, 
  Target, 
  Users, 
  Zap, 
  MessageSquareText, 
  Globe, 
  Coins, 
  WandSparkles, 
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

const CAMPAIGN_TYPES = [
  { id: 'search', label: 'Search' },
  { id: 'pmax', label: 'Performance Max' },
  { id: 'display', label: 'Display' },
  { id: 'video', label: 'Video / YouTube' },
  { id: 'shopping', label: 'Standard Shopping' },
];

interface BriefingFormProps {
  initialData: BriefingContext;
  onSubmit: (data: BriefingContext) => void;
  onExtract: (notes: string) => Promise<void>;
  loading?: boolean;
  extracting?: boolean;
  submitLabel?: string;
}

export function BriefingForm({ 
  initialData, 
  onSubmit, 
  onExtract, 
  loading, 
  extracting,
  submitLabel = 'Ga naar Editor'
}: BriefingFormProps) {
  const [context, setContext] = useState<BriefingContext>(initialData);
  
  // Sync internal state if initialData changes (e.g. after AI extraction in parent)
  useEffect(() => {
    setContext(initialData);
  }, [initialData]);

  const handleChange = (field: keyof BriefingContext, value: any) => {
    setContext(prev => ({ ...prev, [field]: value }));
  };

  const toggleCampaignType = (id: string) => {
    setContext(prev => ({
      ...prev,
      campaignTypes: prev.campaignTypes?.includes(id)
        ? prev.campaignTypes.filter(t => t !== id)
        : [...(prev.campaignTypes || []), id]
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Main Form Area */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* 1. Project Identiteit */}
        <Card className="bg-[#0F172A] border-slate-800 shadow-xl overflow-hidden group">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="size-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-white">1. Project Identiteit</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Klantnaam *</Label>
                <Input 
                  placeholder="Bijv. 365 ZON" 
                  value={context.clientName}
                  onChange={e => handleChange('clientName', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 focus:ring-blue-500 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Website URL *</Label>
                <Input 
                  placeholder="https://365zon.nl" 
                  value={context.website}
                  onChange={e => handleChange('website', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 focus:ring-blue-500 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Branche</Label>
                <Input 
                  placeholder="Bijv. Duurzame Energie" 
                  value={context.industry}
                  onChange={e => handleChange('industry', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 focus:ring-blue-500 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Blueprint Taal</Label>
                <Select value={context.language} onValueChange={(v: any) => handleChange('language', v)}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white">
                    <SelectItem value="dutch">Nederlands</SelectItem>
                    <SelectItem value="english">Engels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Brand Tone / Voice</Label>
                <Input 
                  placeholder="Bijv. Professioneel, Urgent, Playful" 
                  value={context.tone}
                  onChange={e => handleChange('tone', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 text-white"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Strategie & Focus */}
        <Card className="bg-[#0F172A] border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Target className="size-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-bold text-white">2. Strategie & Focus</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Focus Producten / Diensten</Label>
                  <Input 
                    placeholder="Wat willen we specifiek pushen?" 
                    value={context.focusProducts}
                    onChange={e => handleChange('focusProducts', e.target.value)}
                    className="bg-slate-900 border-slate-700 h-12 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Concurrenten</Label>
                  <Input 
                    placeholder="Bijv. Coolblue, Zonneplan" 
                    value={context.competitors}
                    onChange={e => handleChange('competitors', e.target.value)}
                    className="bg-slate-900 border-slate-700 h-12 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Belangrijkste USPs</Label>
                  <Textarea 
                    placeholder="Wat maakt de klant uniek?" 
                    value={context.usps}
                    onChange={e => handleChange('usps', e.target.value)}
                    className="bg-slate-900 border-slate-700 min-h-[100px] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Het Aanbod / De Deal</Label>
                  <Textarea 
                    placeholder="Welke actie of aanbieding gebruiken we?" 
                    value={context.offer}
                    onChange={e => handleChange('offer', e.target.value)}
                    className="bg-slate-900 border-slate-700 min-h-[100px] text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Doelgroep & Goals */}
        <Card className="bg-[#0F172A] border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="size-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white">3. Doelgroep & Goals</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Locatie Targetting</Label>
                <Input 
                  placeholder="Bijv. Heel Nederland, of Radius 20km om Utrecht" 
                  value={context.targetLocations}
                  onChange={e => handleChange('targetLocations', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Target Talen</Label>
                <Input 
                  placeholder="Bijv. Nederlands, Engels" 
                  value={context.targetLanguages}
                  onChange={e => handleChange('targetLanguages', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 text-white"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Primaire Campagne Doelen</Label>
                <Input 
                  placeholder="Bijv. Leadgeneratie, ROAS optimalisatie" 
                  value={context.primaryGoals}
                  onChange={e => handleChange('primaryGoals', e.target.value)}
                  className="bg-slate-900 border-slate-700 h-12 text-white"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Doelgroep Omschrijving</Label>
                <Textarea 
                  placeholder="Wie is de ideale klant? Leeftijd, interesses, gedrag..." 
                  value={context.targetAudience}
                  onChange={e => handleChange('targetAudience', e.target.value)}
                  className="bg-slate-900 border-slate-700 min-h-[80px] text-white"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Tactiek & Budget */}
        <Card className="bg-[#0F172A] border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Zap className="size-5 text-orange-400" />
              </div>
              <h2 className="text-lg font-bold text-white">4. Tactiek & Budget</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Maandelijks Budget (€)</Label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input 
                      placeholder="Bijv. 5000" 
                      value={context.monthlyBudget}
                      onChange={e => handleChange('monthlyBudget', e.target.value)}
                      className="bg-slate-900 border-slate-700 h-12 pl-10 text-white font-mono"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Aantal Campagnes</Label>
                  <Select 
                    value={String(context.desiredCampaignCount)} 
                    onValueChange={(v) => handleChange('desiredCampaignCount', Number(v))}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} Campagnes</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Biedstrategie Voorkeur</Label>
                  <Select 
                    value={context.bidStrategyPreference} 
                    onValueChange={(v) => handleChange('bidStrategyPreference', v)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-12 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                      <SelectItem value="Maximize Conversions (Target CPA)">Maximize Conversions (tCPA)</SelectItem>
                      <SelectItem value="Maximize Conversion Value (Target ROAS)">Maximize Conv. Value (tROAS)</SelectItem>
                      <SelectItem value="Maximize Conversions">Maximize Conversions</SelectItem>
                      <SelectItem value="Maximize Clicks">Maximize Clicks</SelectItem>
                      <SelectItem value="Manual CPC">Manual CPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Target Conversie Waarde</Label>
                  <Input 
                    placeholder="Bijv. €150 per lead" 
                    value={context.conversionValue}
                    onChange={e => handleChange('conversionValue', e.target.value)}
                    className="bg-slate-900 border-slate-700 h-12 text-white"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Campagnetypes</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {CAMPAIGN_TYPES.map(type => (
                      <div key={type.id} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        context.campaignTypes?.includes(type.id) 
                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-100' 
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`} onClick={() => toggleCampaignType(type.id)}>
                        <Checkbox 
                          id={`type-${type.id}`} 
                          checked={context.campaignTypes?.includes(type.id)}
                          onCheckedChange={() => toggleCampaignType(type.id)}
                        />
                        <label className="text-xs font-bold cursor-pointer flex-1">
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Budgetverdeling Voorkeur</Label>
                  <Textarea 
                    placeholder="Bijv. 70% Search, 30% PMax" 
                    value={context.budgetDistributionPreference}
                    onChange={e => handleChange('budgetDistributionPreference', e.target.value)}
                    className="bg-slate-900 border-slate-700 min-h-[80px] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Extra Notities / Opmerkingen</Label>
                  <Textarea 
                    placeholder="Enige andere belangrijke details..." 
                    value={context.additionalNotes}
                    onChange={e => handleChange('additionalNotes', e.target.value)}
                    className="bg-slate-900 border-slate-700 min-h-[80px] text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="pt-8 flex items-center justify-between gap-6 border-t border-slate-800">
           <div className="flex-1">
              <p className="text-sm text-slate-500">
                Alle velden gemarkeerd met een * zijn verplicht om door te kunnen gaan naar de Editor.
              </p>
           </div>
           <Button 
            onClick={() => onSubmit(context)} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-12 h-16 rounded-2xl font-black text-xl flex items-center gap-4 shadow-2xl shadow-blue-900/40 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            {loading ? <Loader2 className="size-7 animate-spin" /> : <WandSparkles className="size-7" />}
            {submitLabel}
            <ArrowRight className="size-6" />
          </Button>
        </div>
      </div>

      {/* Sidebar / AI Context Area */}
      <div className="lg:col-span-4 space-y-8">
        <Card className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-blue-500/30 shadow-2xl overflow-hidden ring-1 ring-blue-500/20 sticky top-8">
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="size-5 text-blue-400" /> Smart Extract Engine
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plak hier je ruwe meeting notes of briefing documenten. De AI analyseert de tekst en vult het formulier automatisch voor je in.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <Textarea 
                  placeholder="Plak hier je ruwe informatie..." 
                  value={context.rawNotes}
                  onChange={e => handleChange('rawNotes', e.target.value)}
                  className="bg-slate-900/80 border-slate-700 min-h-[400px] font-sans text-sm leading-relaxed focus:border-blue-500/50 text-white resize-none"
                />
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
              </div>

              <Button 
                variant="outline" 
                onClick={() => onExtract(context.rawNotes || '')} 
                disabled={extracting || !context.rawNotes}
                className="w-full bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20 h-14 font-bold text-lg"
              >
                {extracting ? <Loader2 className="size-5 mr-3 animate-spin" /> : <WandSparkles className="size-5 mr-3" />}
                VUL FORMULIER IN
              </Button>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-800">
               <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Negatieve Keywords Focus</Label>
                <Textarea 
                  placeholder="Bijv. Geen banen, Geen tweedehands..." 
                  value={context.negativeKeywordsBase}
                  onChange={e => handleChange('negativeKeywordsBase', e.target.value)}
                  className="bg-slate-900 border-slate-700 min-h-[100px] text-xs text-white"
                />
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
              <p className="text-[10px] text-blue-400/80 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="size-3 shrink-0 mt-0.5" />
                <span>
                  Je data is veilig. We gebruiken enterprise AI-modellen die je data niet gebruiken voor training.
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
