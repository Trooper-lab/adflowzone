'use server';
/**
 * @fileOverview Generates a pre-filled AI checklist draft for an account.
 *
 * Takes the account's KPI data + recent checklist run history, calls Gemini,
 * and returns per-task suggestions (note + whether to auto-complete).
 *
 * The caller (import page) is responsible for writing the ChecklistRun to Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// ── Input / Output schemas ────────────────────────────────────────────────────

const TaskInputSchema = z.object({
  id:          z.string(),
  description: z.string(),
});

const TaskSuggestionSchema = z.object({
  taskId:        z.string(),
  suggestedNote: z.string().describe(
    'Beknopte, actiegerichte pre-ingevulde notitie gebaseerd op de accountdata. ' +
    'Verwijs naar specifieke cijfers waar relevant. Lege string als er niets specifieks te melden is.'
  ),
  autoComplete:  z.boolean().describe(
    'true ALLEEN als de data duidelijk aangeeft dat deze taak deze week geen actie vereist.'
  ),
});

const GenerateChecklistDraftInputSchema = z.object({
  accountNickname:   z.string(),
  primaryGoal:       z.string(),
  kpiValues:         z.record(z.number()).describe('Meest recente geïmporteerde KPI-data voor dit account'),
  targetKpiValues:   z.array(z.object({ kpi: z.string(), target: z.number() })).optional(),
  tasks:             z.array(TaskInputSchema),
  recentRunsContext: z.string().describe('Samenvatting van recente checklist notities voor context'),
});

const GenerateChecklistDraftOutputSchema = z.object({
  suggestions: z.array(TaskSuggestionSchema),
});

export type GenerateChecklistDraftInput  = z.infer<typeof GenerateChecklistDraftInputSchema>;
export type GenerateChecklistDraftOutput = z.infer<typeof GenerateChecklistDraftOutputSchema>;

// ── Flow ──────────────────────────────────────────────────────────────────────

const generateChecklistDraftFlow = ai.defineFlow(
  {
    name: 'generateChecklistDraftFlow',
    inputSchema:  GenerateChecklistDraftInputSchema,
    outputSchema: GenerateChecklistDraftOutputSchema,
  },
  async (input) => {

    // Build a readable KPI summary with targets where available
    const kpiSummary = Object.entries(input.kpiValues)
      .map(([key, value]) => {
        const target = input.targetKpiValues?.find(t => t.kpi === key);
        const formattedValue = key === 'spend'
          ? `€${value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value.toLocaleString('nl-NL');
        const targetStr = target
          ? ` (doel: ${key === 'spend' ? '€' : ''}${target.target.toLocaleString('nl-NL')})`
          : '';
        return `  - ${key}: ${formattedValue}${targetStr}`;
      })
      .join('\n');

    const tasksFormatted = input.tasks
      .map((t, i) => `  ${i + 1}. [ID:${t.id}] ${t.description}`)
      .join('\n');

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: `Je bent een ervaren Google Ads specialist die de wekelijkse accountgezondheid beoordeelt voor "${input.accountNickname}".
Primair doel van dit account: ${input.primaryGoal.replace(/_/g, ' ')}.

━━━ MEEST RECENTE KPI-DATA ━━━
${kpiSummary}

━━━ RECENTE ACTIVITEIT (laatste checklist runs) ━━━
${input.recentRunsContext || 'Geen recente geschiedenis beschikbaar — dit is waarschijnlijk de eerste run.'}

━━━ CHECKLIST TAKEN ━━━
${tasksFormatted}

INSTRUCTIES:
Voor ELKE taak in de lijst hierboven, geef:
1. taskId: exact de ID-waarde tussen [ID:...]
2. suggestedNote: Een beknopte, actiegerichte notitie op basis van de data. Verwijs naar specifieke cijfers waar mogelijk (bijv. "Spend deze maand €1.234 — 12% boven doel. Controleer budgetpacing."). Maximaal 2 zinnen. Lege string als er niets specifieks te melden is voor deze taak.
3. autoComplete: true ALLEEN als de data duidelijk toont dat er geen actie nodig is. Wees conservatief — bij twijfel false.

Reageer in het Nederlands. Wees specifiek en praktisch. De notities moeten de beoordelaar tijd besparen.`,
      output: { schema: GenerateChecklistDraftOutputSchema },
    });

    // Fallback: if AI returns nothing, return empty suggestions so the run is still created
    return output ?? {
      suggestions: input.tasks.map(t => ({
        taskId:        t.id,
        suggestedNote: '',
        autoComplete:  false,
      })),
    };
  }
);

// ── Exported function ─────────────────────────────────────────────────────────

export async function generateChecklistDraft(
  input: GenerateChecklistDraftInput
): Promise<GenerateChecklistDraftOutput> {
  return generateChecklistDraftFlow(input);
}
