'use client';

import { useState, useEffect, useRef } from 'react';
import { BriefingContext } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, X, Plus, Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { suggestSeedKeywords } from '@/ai/flows/suggest-seed-keywords';
import { suggestNegativeKeywords } from '@/ai/flows/suggest-negative-keywords';
import { fetchKeywordIdeas } from '@/app/actions/google-ads-keywords';
import { useToast } from '@/hooks/use-toast';

import { categorizeKeywords } from '@/ai/flows/categorize-keywords';
import { KeywordIdea, CategorizedTheme } from '@/lib/types';

interface KeywordScoutProps {
  context: BriefingContext;
  onChange: (data: BriefingContext) => void;
  onNext: () => void;
}

export function KeywordScout({ context, onChange, onNext }: KeywordScoutProps) {
  const { toast } = useToast();
  const [seeds, setSeeds] = useState<string[]>([]);
  const [seedSuggestions, setSeedSuggestions] = useState<string[]>([]);
  const [newSeed, setNewSeed] = useState('');
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [keywords, setKeywords] = useState<KeywordIdea[]>(context.fetchedKeywordIdeas || []);
  const [selectedKeywordTexts, setSelectedKeywordTexts] = useState<Set<string>>(
    new Set((context.selectedKeywords || []).map(k => k.text))
  );

  const [loadingNegatives, setLoadingNegatives] = useState(false);
  const [negatives, setNegatives] = useState<string[]>(context.negativeKeywords || []);
  const [newNegative, setNewNegative] = useState('');

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<CategorizedTheme[]>(context.keywordThemes || []);
  
  const hasFetchedSeeds = useRef(false);

  const handleSuggestSeeds = async () => {
    setLoadingSeeds(true);
    try {
      const suggested = await suggestSeedKeywords(context, seeds);
      setSeedSuggestions(suggested);
      toast({ title: 'Suggesties Gegenereerd!', description: 'Selecteer de beste suggesties met het plusje om ze toe te voegen.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon geen seed keyword suggesties genereren.' });
    } finally {
      setLoadingSeeds(false);
    }
  };

  const promoteSuggestion = (suggestion: string) => {
    if (!seeds.includes(suggestion)) {
      setSeeds([...seeds, suggestion]);
    }
    setSeedSuggestions(seedSuggestions.filter(s => s !== suggestion));
  };

  const addSeed = () => {
    if (newSeed.trim() && !seeds.includes(newSeed.trim())) {
      setSeeds([...seeds, newSeed.trim()]);
      setNewSeed('');
    }
  };

  const removeSeed = (seed: string) => {
    setSeeds(seeds.filter(s => s !== seed));
  };

  const addNegative = () => {
    if (newNegative.trim() && !negatives.includes(newNegative.trim())) {
      const updated = [...negatives, newNegative.trim()];
      setNegatives(updated);
      onChange({ ...context, negativeKeywords: updated });
      setNewNegative('');
    }
  };

  const removeNegative = (neg: string) => {
    const updated = negatives.filter(n => n !== neg);
    setNegatives(updated);
    onChange({ ...context, negativeKeywords: updated });
  };

  const handleFetchKeywords = async () => {
    if (seeds.length === 0) {
      toast({ variant: 'destructive', title: 'Let op', description: 'Voeg minimaal één seed keyword toe.' });
      return;
    }
    
    setLoadingKeywords(true);
    try {
      const result = await fetchKeywordIdeas(seeds, context.website);
      
      // Sort by search volume descending
      const sorted = result.sort((a, b) => (b.avgMonthlySearches || 0) - (a.avgMonthlySearches || 0));
      setKeywords(sorted);
      
      // Auto-select top 100
      const top100 = sorted.slice(0, 100);
      const selectedSet = new Set(top100.map(k => k.text));
      setSelectedKeywordTexts(selectedSet);
      
      onChange({ 
        ...context, 
        fetchedKeywordIdeas: sorted,
        selectedKeywords: top100 
      });
      
      toast({ title: 'Keywords Opgehaald!', description: `Opgehaald: ${sorted.length}. Auto-selectie: top ${top100.length}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'API Fout', description: 'Kon geen keywords ophalen van Google Ads API: ' + e.message });
    } finally {
      setLoadingKeywords(false);
    }
  };

  const handlePromoteAndReroll = async () => {
    if (selectedKeywordTexts.size === 0) {
      toast({ variant: 'destructive', title: 'Let op', description: 'Selecteer eerst keywords om toe te voegen aan de seeds.' });
      return;
    }

    const newSeeds = Array.from(new Set([...seeds, ...Array.from(selectedKeywordTexts)]));
    setSeeds(newSeeds);
    
    setLoadingKeywords(true);
    try {
      const result = await fetchKeywordIdeas(newSeeds, context.website);
      
      // Filter out keywords we already selected so we get fresh ones
      const filteredResult = result.filter(k => !selectedKeywordTexts.has(k.text));
      
      const sorted = filteredResult.sort((a, b) => (b.avgMonthlySearches || 0) - (a.avgMonthlySearches || 0));
      
      // We append the old selected keywords to the new list so they remain visible/selected
      const oldSelected = keywords.filter(k => selectedKeywordTexts.has(k.text));
      const combined = [...oldSelected, ...sorted];
      
      setKeywords(combined);
      
      onChange({ 
        ...context, 
        fetchedKeywordIdeas: combined
      });
      
      toast({ title: 'Reroll Succesvol!', description: `Opgehaald: ${sorted.length} nieuwe keywords gebaseerd op je uitgebreide seeds.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'API Fout', description: 'Kon geen keywords ophalen van Google Ads API: ' + e.message });
    } finally {
      setLoadingKeywords(false);
    }
  };

  const toggleKeywordSelection = (kw: KeywordIdea) => {
    const newSet = new Set(selectedKeywordTexts);
    if (newSet.has(kw.text)) {
      newSet.delete(kw.text);
    } else {
      newSet.add(kw.text);
    }
    setSelectedKeywordTexts(newSet);
    
    // Update context
    const selectedObjs = keywords.filter(k => newSet.has(k.text));
    onChange({ ...context, selectedKeywords: selectedObjs });
  };

  const handleSuggestNegatives = async () => {
    setLoadingNegatives(true);
    try {
      const unselected = keywords.filter(k => !selectedKeywordTexts.has(k.text)).map(k => k.text);
      if (unselected.length === 0) {
        toast({ title: 'Info', description: 'Geen ongekozen keywords om te analyseren.' });
        setLoadingNegatives(false);
        return;
      }
      
      const suggested = await suggestNegativeKeywords(context, unselected);
      // Merge with existing
      const merged = Array.from(new Set([...negatives, ...suggested]));
      setNegatives(merged);
      onChange({ ...context, negativeKeywords: merged });
      toast({ title: 'Gegenereerd!', description: 'Uitsluitingszoekwoorden gegenereerd op basis van ongekozen termen.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon geen uitsluitingszoekwoorden genereren.' });
    } finally {
      setLoadingNegatives(false);
    }
  };

  const handleCategorizeKeywords = async () => {
    if (selectedKeywordTexts.size === 0) {
      toast({ variant: 'destructive', title: 'Let op', description: 'Selecteer eerst keywords om te categoriseren.' });
      return;
    }

    setLoadingCategories(true);
    try {
      const selected = Array.from(selectedKeywordTexts);
      const themes = await categorizeKeywords(context, selected);
      setCategories(themes);
      onChange({ ...context, keywordThemes: themes });
      toast({ title: 'Gecategoriseerd!', description: 'Keywords zijn gegroepeerd in thema\'s.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon keywords niet categoriseren.' });
    } finally {
      setLoadingCategories(false);
    }
  };

  const updateCategoryName = (id: string, newName: string) => {
    const updated = categories.map(c => c.id === id ? { ...c, name: newName } : c);
    setCategories(updated);
    onChange({ ...context, keywordThemes: updated });
  };

  const removeCategoryKeyword = (categoryId: string, keyword: string) => {
    const updated = categories.map(c => {
      if (c.id === categoryId) {
        return { ...c, keywords: c.keywords.filter(k => k !== keyword) };
      }
      return c;
    });
    setCategories(updated);
    onChange({ ...context, keywordThemes: updated });
  };

  const deleteCategory = (categoryId: string) => {
    const updated = categories.filter(c => c.id !== categoryId);
    setCategories(updated);
    onChange({ ...context, keywordThemes: updated });
  };

  return (
    <div className="space-y-8">
      {/* Seed Keywords Section */}
      <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Search className="size-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">1. Seed Keywords</h2>
              <p className="text-sm text-slate-400">Review and approve the foundational keywords before fetching data.</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSuggestSeeds} 
            disabled={loadingSeeds}
            className="bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20"
          >
            {loadingSeeds ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
            Regenerate Seeds
          </Button>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {seeds.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">Geen seed keywords in de lijst. Voeg ze handmatig toe of gebruik suggesties.</p>
            ) : (
              seeds.map(seed => (
                <Badge key={seed} variant="secondary" className="bg-slate-800 text-white px-3 py-1.5 text-sm flex items-center gap-2">
                  {seed}
                  <X className="size-3 cursor-pointer hover:text-red-400" onClick={() => removeSeed(seed)} />
                </Badge>
              ))
            )}
          </div>

          {loadingSeeds ? (
            <div className="flex items-center gap-3 w-full p-4 border border-dashed border-slate-700/50 rounded-xl bg-slate-800/30">
              <Loader2 className="size-5 text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">AI genereert relevante seed keyword suggesties...</p>
                <p className="text-xs text-slate-500">We analyseren je strategie en uitsluitingen.</p>
              </div>
            </div>
          ) : seedSuggestions.length > 0 ? (
            <div className="p-4 border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5 flex flex-col gap-2">
              <p className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1">
                <Sparkles className="size-3" /> AI Suggesties
              </p>
              <div className="flex flex-wrap gap-2">
                {seedSuggestions.map(suggestion => (
                  <Badge key={suggestion} variant="outline" className="border-emerald-500/30 text-emerald-300 px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer hover:bg-emerald-500/20 transition-colors" onClick={() => promoteSuggestion(suggestion)}>
                    {suggestion}
                    <Plus className="size-3" />
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex gap-4">
          <Input 
            placeholder="Add another seed keyword..." 
            value={newSeed}
            onChange={e => setNewSeed(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSeed()}
            className="bg-slate-900 border-slate-700 text-white flex-1"
          />
          <Button onClick={addSeed} variant="secondary" className="bg-slate-800 text-white hover:bg-slate-700">
            <Plus className="size-4" />
          </Button>
          <Button 
            onClick={handleFetchKeywords} 
            disabled={loadingKeywords || seeds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8"
          >
            {loadingKeywords ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Search className="size-4 mr-2" />}
            Fetch Live Data
          </Button>
        </div>
      </Card>

      {/* Results & Selection Section */}
      {keywords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-8 bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden p-6 flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-bold text-white">2. Keyword Selection</h2>
              <div className="flex items-center gap-4">
                <Button 
                  size="sm" 
                  onClick={handlePromoteAndReroll}
                  disabled={selectedKeywordTexts.size === 0 || loadingKeywords}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {loadingKeywords ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                  Voeg Selectie toe aan Seeds & Zoek Opnieuw
                </Button>
                <Badge className="bg-blue-600">
                  {selectedKeywordTexts.size} / {keywords.length} Selected
                </Badge>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 rounded-md border border-slate-800">
              <Table>
                <TableHeader className="bg-slate-900 sticky top-0 z-10">
                  <TableRow className="border-slate-800">
                    <TableHead className="w-12 text-center text-slate-400">Select</TableHead>
                    <TableHead className="text-slate-400">Keyword</TableHead>
                    <TableHead className="text-right text-slate-400">Volume</TableHead>
                    <TableHead className="text-right text-slate-400">CPC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((kw, i) => (
                    <TableRow key={i} className="border-slate-800/50 hover:bg-slate-800/30">
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={selectedKeywordTexts.has(kw.text)}
                          onCheckedChange={() => toggleKeywordSelection(kw)}
                          className="border-slate-600"
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{kw.text}</TableCell>
                      <TableCell className="text-right text-slate-300">{(kw.avgMonthlySearches || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-slate-300">€{(kw.lowCpc || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Negative Keywords Sidebar */}
          <Card className="lg:col-span-4 bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden p-6 flex flex-col max-h-[600px]">
             <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-red-400" />
                <h2 className="text-lg font-bold text-white">3. Negatives</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSuggestNegatives} 
                disabled={loadingNegatives || keywords.length === 0}
                className="bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs h-8"
              >
                {loadingNegatives ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
                Auto-Suggest
              </Button>
            </div>
            
            <p className="text-xs text-slate-400 mb-4 shrink-0">
              AI will analyze the keywords you did NOT select to find irrelevant themes to block.
            </p>

            <div className="flex gap-2 mb-4 shrink-0">
              <Input 
                placeholder="Add negative..." 
                value={newNegative}
                onChange={e => setNewNegative(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNegative()}
                className="bg-slate-900 border-slate-700 text-white text-sm h-9"
              />
              <Button onClick={addNegative} size="sm" variant="secondary" className="bg-slate-800 text-white hover:bg-slate-700 h-9">
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-2">
              {negatives.length === 0 && (
                <div className="text-center p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
                  No negative keywords yet.
                </div>
              )}
              {negatives.map(neg => (
                <div key={neg} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md px-3 py-2">
                  <span className="text-sm text-slate-300">{neg}</span>
                  <X className="size-3.5 text-slate-500 cursor-pointer hover:text-red-400 transition-colors" onClick={() => removeNegative(neg)} />
                </div>
              ))}
            </div>

          </Card>
        </div>
      )}

      {/* Categorization Section */}
      {keywords.length > 0 && (
        <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-md shadow-xl overflow-hidden p-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">4. Keyword Categorisatie (Ad Groups)</h2>
              <Badge className="bg-blue-600">{categories.length} Thema's</Badge>
            </div>
            <Button 
              onClick={handleCategorizeKeywords} 
              disabled={loadingCategories || selectedKeywordTexts.size === 0}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {loadingCategories ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              Groepeer in Thema's
            </Button>
          </div>

          {categories.length > 0 ? (
            <div className="space-y-4 mb-6">
              {categories.map(category => (
                <div key={category.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Input 
                      value={category.name}
                      onChange={(e) => updateCategoryName(category.id, e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white font-bold max-w-sm"
                    />
                    <Button variant="ghost" size="sm" onClick={() => deleteCategory(category.id)} className="text-slate-500 hover:text-red-400">
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {category.keywords.map(kw => (
                      <Badge key={kw} variant="secondary" className="bg-slate-800 text-slate-300 px-3 py-1 text-sm flex items-center gap-1 border border-slate-700">
                        {kw}
                        <X className="size-3 cursor-pointer hover:text-red-400 ml-1" onClick={() => removeCategoryKeyword(category.id, kw)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic mb-6">Klik op "Groepeer in Thema's" om de geselecteerde keywords door AI te laten indelen in logische Ad Groups.</p>
          )}

          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <Button 
              onClick={onNext} 
              disabled={categories.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white h-12 px-8 font-bold flex items-center justify-center gap-2"
            >
              Genereer Campagne Structuur
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
