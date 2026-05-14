
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateAiChecklistInputSchema = z.object({
  accountNickname: z.string(),
  primaryGoal:     z.string(),
  targetKpiValues: z.array(z.object({ kpi: z.string(), target: z.number() })).optional(),
  scriptData:      z.string().describe('Raw JSON output from the Google Ads data script'),
});

export type GenerateAiChecklistInput = z.infer<typeof GenerateAiChecklistInputSchema>;

const ChecklistItemSchema = z.object({
  title:       z.string().describe('Korte, actiegerichte titel — max 8 woorden, begin met een werkwoord'),
  description: z.string().describe(
    'Wat je precies moet doen en waarom. Noem specifieke cijfers, campagnenames, ' +
    'zoektermen of keywords uit de data. Max 3 zinnen.'
  ),
  impact:      z.string().describe(
    'Verwachte impact als je deze actie uitvoert — bijv. "Bespaart ~€45/maand verspild budget" ' +
    'of "Verhoogt conversiepercentage bij top-zoektermen". Wees specifiek.'
  ),
  priority:    z.enum(['critical', 'high', 'medium', 'low']),
  category:    z.enum(['budget', 'kwaliteit', 'conversie', 'zoektermen', 'pmax', 'biedstrategie', 'bereik']),
});

const GenerateAiChecklistOutputSchema = z.object({
  contextSummary: z.string().describe(
    '2-3 zinnen over de algehele accountgezondheid op basis van de data. ' +
    'Noem de meest opvallende trend of zorgpunt direct.'
  ),
  items: z.array(ChecklistItemSchema).min(3).max(5),
});

export type GenerateAiChecklistOutput = z.infer<typeof GenerateAiChecklistOutputSchema>;

const generateAiChecklistFlow = ai.defineFlow(
  {
    name: 'generateAiChecklistFlow',
    inputSchema:  GenerateAiChecklistInputSchema,
    outputSchema: GenerateAiChecklistOutputSchema,
  },
  async (input) => {
    const targetStr = input.targetKpiValues?.length
      ? input.targetKpiValues.map(t => `  - ${t.kpi}: doel ${t.target}`).join('\n')
      : '  Geen specifieke KPI-doelen ingesteld.';

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: `Je bent een senior Google Ads specialist met 10+ jaar ervaring. Je analyseert accountdata en geeft concrete, prioritaire actiepunten.

━━━ ACCOUNT CONTEXT ━━━
Naam: ${input.accountNickname}
Primair doel: ${input.primaryGoal.replace(/_/g, ' ')}
Ingestelde KPI-doelen:
${targetStr}

━━━ GOOGLE ADS DATA (LAST 30 DAYS) ━━━
${input.scriptData}

━━━ ANALYSERICHTLIJNEN ━━━

**Campagnes:**
- Controleer welke campagnes ENABLED vs PAUSED zijn — zijn er campagnes die onnodig gepauzeerd zijn?
- Vergelijk spend vs. dagelijks budget — budgetLimited: true = campagne wordt beperkt door budget
- Bereken effectieve CPL/ROAS per campagne en vergelijk met doelen
- Signaleer campagnes met veel spend maar nul conversies

**Conversie-acties:**
- Zijn er meerdere conversie-acties? Zijn ze allemaal relevant voor het primaire doel?
- Ziet er een primaire conversie-actie uit die domineert? Of is de meting versnipperd?
- Zijn er actieve conversie-acties met 0 conversies in de periode? Dit kan duiden op trackingproblemen.

**Performance Max:**
- Als er PMax-campagnes zijn: welke asset groups presteren goed/slecht?
- PMax met veel spend maar weinig conversies is een kritiek signaal
- Vergelijk PMax spend vs. Search spend — kannibaliseert PMax het Search verkeer?

**Zoektermen:**
- Welke zoektermen verslinden budget zonder conversies? → negatieve zoekwoorden toevoegen
- Welke top-converters zijn er nog niet als exact match toegevoegd?
- Let op irrelevante termen die op brede match binnenkomen

**Kwaliteitsscores:**
- Keywords met QS < 5 kosten 30-50% meer per klik — dit zijn prioritaire optimalisaties
- Kijk naar de drie componenten: ad relevance, landing page experience, expected CTR
- Combineer met spend: lage QS + hoge spend = direct actie

**Device split:**
- Grote CPL-verschillen tussen mobiel/desktop/tablet → biedings-aanpassingen overwegen
- Als mobiel slecht converteert maar hoog spend heeft, overweeg negatieve bieding op mobiel

**Prioritering:**
- critical: directe geldverspilling of trackingprobleem
- high: significante optimalisatiekans met meetbare impact
- medium: structurele verbetering op langere termijn
- low: nice-to-have, weinig urgentie

Genereer 3-5 actiepunten gesorteerd van hoogste naar laagste prioriteit.
Wees hyper-specifiek: noem campagnenames, exacte bedragen, zoektermen uit de data.
Geen algemene adviezen — alleen wat DEZE data concreet laat zien.
Reageer volledig in het Nederlands.`,
      output: { schema: GenerateAiChecklistOutputSchema },
    });

    return output ?? {
      contextSummary: 'Kon geen analyse genereren op basis van de aangeleverde data.',
      items: [],
    };
  }
);

export async function generateAiChecklist(input: GenerateAiChecklistInput): Promise<GenerateAiChecklistOutput> {
  return generateAiChecklistFlow(input);
}
