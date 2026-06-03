'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Link as LinkIcon, Send, Sparkles, Copy, Check } from 'lucide-react';
import { Briefing } from '@/lib/types';
import { generateBriefingEmailText } from '@/ai/flows/generate-briefing-email';
import { sendBriefingEmail } from '@/app/actions/send-briefing-email';

interface SendBriefingTabProps {
  briefing: Briefing;
}

export function SendBriefingTab({ briefing }: SendBriefingTabProps) {
  const { toast } = useToast();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const portalLink = `${origin}/portal/briefing/${briefing.id}`;

  const [toEmail, setToEmail] = useState(briefing.context.clientEmail || '');
  const [subject, setSubject] = useState(`Review: Google Ads Campagne Voorstel voor ${briefing.context.clientName}`);
  const [body, setBody] = useState(`Hallo,\n\nDe briefing staat klaar op de volgende link:\n${portalLink}\n\nGroet,`);
  
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const generatedText = await generateBriefingEmailText(briefing.context, portalLink);
      setBody(generatedText);
      toast({ title: 'E-mail gegenereerd met AI!' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Fout bij genereren' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!toEmail) {
      toast({ variant: 'destructive', title: 'Vul een e-mailadres in' });
      return;
    }
    setSending(true);
    try {
      const result = await sendBriefingEmail(toEmail, subject, body);
      if (result.success) {
        toast({ title: 'E-mail succesvol verzonden!' });
      } else {
        toast({ variant: 'destructive', title: 'Verzenden mislukt', description: result.error });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Verzenden mislukt' });
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: 'Link gekopieerd!' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Link & Status Panel */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="bg-[#1C243A] border-slate-700 shadow-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <LinkIcon className="size-5 text-emerald-400" /> Magische Link
            </CardTitle>
            <CardDescription className="text-slate-400">
              Deze link geeft de klant direct veilig toegang tot het voorstel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 break-all text-xs text-slate-300 font-mono">
              {portalLink}
            </div>
            <Button 
              onClick={handleCopyLink} 
              variant="outline" 
              className="w-full border-slate-700 bg-transparent hover:bg-slate-800 text-slate-200"
            >
              {copiedLink ? <Check className="size-4 mr-2 text-emerald-500" /> : <Copy className="size-4 mr-2" />}
              Kopieer Magische Link
            </Button>

            {briefing.status === 'draft' && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/80 leading-relaxed">
                <strong>Status: Concept</strong><br />
                De klant kan de link al inzien. Zodra zij akkoord geven in de portal, springt deze briefing in dit dashboard op 'Goedgekeurd'.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Composer */}
      <div className="lg:col-span-8">
        <Card className="bg-[#0F172A] border-slate-800 shadow-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <div>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Mail className="size-5 text-blue-400" /> Verstuur via AdFlowZone
              </CardTitle>
              <CardDescription className="text-slate-400">
                Stuur het voorstel direct vanuit het platform.
              </CardDescription>
            </div>
            <Button 
              onClick={handleGenerateAI} 
              disabled={generating}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-[10px]"
            >
              {generating ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Sparkles className="size-3 mr-2" />}
              Genereer Tekst met AI
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Aan</Label>
                <Input 
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="klant@bedrijf.nl"
                  className="bg-slate-900 border-slate-700 focus:border-blue-500 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Onderwerp</Label>
                <Input 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Onderwerp..."
                  className="bg-slate-900 border-slate-700 focus:border-blue-500 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Bericht</Label>
              <Textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="h-64 bg-slate-900 border-slate-700 focus:border-blue-500 text-white resize-y"
              />
            </div>

            <Button 
              onClick={handleSendEmail} 
              disabled={sending || generating}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/40"
            >
              {sending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
              Verstuur E-mail naar Klant
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
