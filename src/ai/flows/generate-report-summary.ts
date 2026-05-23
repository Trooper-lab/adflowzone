
'use server';
/**
 * @fileOverview Generates an AI summary for a monthly report.
 * 
 * - generateReportSummary - The main function to call the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { MonthlyReport, ParentClient, ChildAccount, KpiData, Todo, ChecklistRun, ChecklistRunTask } from '@/lib/types';


const KpiValuesSchema = z.record(z.number());

const KpiDataSchema = z.object({
  startDate: z.string(),
  kpiValues: KpiValuesSchema,
});

const TodoSchema = z.object({
  content: z.string(),
  completedAt: z.any().optional(),
});

const ChecklistRunTaskSchema = z.object({
    description: z.string(),
    notes: z.string().optional(),
});

const ChecklistRunSchema = z.object({
    name: z.string(),
    runAt: z.any().optional(),
    completedAt: z.any().optional(), // Can be a string or a Timestamp object
    tasks: z.array(ChecklistRunTaskSchema),
});


const ReportSummaryInputSchema = z.object({
  report: z.any().describe("The core report object."),
  parentClient: z.any().describe("The parent client object."),
  childAccount: z.any().describe("The child account object."),
  kpiData: z.array(KpiDataSchema).describe("An array of KPI data points for the past months."),
  completedTodos: z.array(TodoSchema).describe("An array of completed todos for the reporting period."),
  pendingTodos: z.array(TodoSchema).describe("An array of pending (not completed) todos for the account."),
  checklistRuns: z.array(ChecklistRunSchema).describe("An array of completed checklist runs for the reporting period."),
  campaignDataSnapshot: z.any().optional().describe("A snapshot of campaign performance data for the reporting month, including impressions, clicks, cost, and conversions per campaign."),
});

export type ReportSummaryInput = z.infer<typeof ReportSummaryInputSchema>;

const KeyInsightSchema = z.object({
  title: z.string().describe('Een korte, pakkende titel voor het inzicht (bijv. "PMax Targeting Verfijning").'),
  description: z.string().describe('Een beknopte uitleg van de observatie of ondernomen actie.'),
  impact: z.enum(['high', 'medium', 'low']).describe('De geschatte impact van dit inzicht of deze actie op de prestaties.'),
  category: z.string().describe('Een relevante categorie, zoals "Optimalisatie", "Monitoring", "Strategie", "Budgettering".'),
});

const ReportSummaryOutputSchema = z.object({
    executiveSummary: z.string().describe("Een beknopt (2-3 zinnen) overzicht op hoog niveau van de prestaties, belangrijkste activiteiten en vooruitzichten van de maand. Opgemaakt als een enkele paragraaf."),
    keyInsights: z.array(KeyInsightSchema).max(3).describe("Een array van de drie belangrijkste inzichten of observaties uit de rapportageperiode."),
    nextSteps: z.array(z.string()).max(3).describe("Een lijst van maximaal drie aanbevolen, actiegerichte volgende stappen voor de komende maand, gebaseerd op openstaande taken en algehele prestaties."),
});

export type ReportSummaryOutput = z.infer<typeof ReportSummaryOutputSchema>;


const generateReportSummaryFlow = ai.defineFlow(
  {
    name: 'generateReportSummaryFlow',
    inputSchema: ReportSummaryInputSchema,
    outputSchema: ReportSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
        prompt: `U bent een deskundige Google Ads-accountmanager die een maandelijks overzicht voor een klant verzorgt. Uw toon moet professioneel, inzichtelijk en duidelijk zijn. Alle output moet in het Nederlands zijn.

        **CONTEXT:**
        - **Klant:** ${input.parentClient.clientName}
        - **Account:** ${input.childAccount.nickname}
        - **Rapportageperiode:** ${input.report.period}
        - **Primair Doel:** ${input.childAccount.primaryGoal.replace(/_/g, ' ')}

        **GEGEVENS (Gebruik dit om uw samenvatting en inzichten af te leiden):**
        - **Voltooide Taken & Observaties (Primaire Bron):** Uw hoofdfocus moet liggen op de notities van voltooide checklists. Deze notities bevatten de belangrijkste informatie over het verrichte werk en de gemaakte observaties.
          ${input.checklistRuns.map(run => `  - ${run.name}:\n${run.tasks.filter(t => t.notes).map(t => `    - Taak: ${t.description}\n    - Notitie: ${t.notes}`).join('\n')}`).join('\n')}
        - **Voltooide Losse Taken:**
          ${input.completedTodos.map(todo => `  - ${todo.content}`).join('\n')}
        - **Openstaande Taken (voor Volgende Stappen):**
          ${input.pendingTodos.map(todo => `  - ${todo.content}`).join('\n')}
        - **KPI-prestaties (Secundaire Context):** Gebruik deze gegevens om uw observaties uit de taaknotities te ondersteunen, maar maak er niet de primaire focus van.
          ${input.kpiData.map(kpi => `  - ${kpi.startDate}: ${JSON.stringify(kpi.kpiValues)}`).join('\n')}
        - **Campagneprestaties (Voor context & specifieke inzichten):**
          ${input.campaignDataSnapshot ? `Totaal Kosten: ${input.campaignDataSnapshot.totals.cost}, Totaal Conversies: ${input.campaignDataSnapshot.totals.conversions}\nTop Campagnes (op kosten):\n${input.campaignDataSnapshot.campaigns.slice(0,5).map((c: any) => `    - ${c.name}: Kosten €${c.cost.toFixed(2)}, Conversies ${c.conversions.toFixed(1)}, CPA €${c.costPerConversion.toFixed(2)}`).join('\n')}` : 'Geen campagnedata beschikbaar.'}


        **INSTRUCTIES:**
        Genereer op basis van alle verstrekte gegevens een gestructureerde rapportoverzicht in het Nederlands.

        1.  **Managementsamenvatting:** Schrijf een paragraaf van 2-3 zinnen. Begin met het samenvatten van de belangrijkste activiteiten en observaties uit de **Voltooide Taken & Observaties**. Vermeld vervolgens kort de prestatie-ontwikkeling, waarbij u KPI-gegevens alleen als secundaire context gebruikt.

        2.  **Belangrijkste Inzichten:** Identificeer de 3 belangrijkste inzichten, acties of observaties. **Deze inzichten MOETEN primair worden afgeleid van de notities bij "Voltooide Taken & Observaties".** Gebruik de KPI-gegevens alleen om context toe te voegen of de impact van uw werk te kwantificeren. Geef voor elk inzicht een titel, een korte beschrijving, een impactniveau ('hoog', 'gemiddeld' of 'laag') en een relevante categorie (bijv. 'Optimalisatie', 'Monitoring', 'Strategie', 'Budgettering').
        
        3.  **Volgende Stappen:** Genereer op basis van de lijst "Openstaande Taken" en uw algehele analyse van de prestaties en het voltooide werk een lijst van maximaal 3 concrete, uitvoerbare volgende stappen voor de komende maand. Formuleer deze als aanbevelingen.`,
        model: 'googleai/gemini-2.5-flash',
        output: {
            schema: ReportSummaryOutputSchema,
        }
    });

    return output ?? { executiveSummary: "Kon geen samenvatting genereren.", keyInsights: [], nextSteps: [] };
  }
);


export async function generateReportSummary(input: ReportSummaryInput): Promise<ReportSummaryOutput> {
    return await generateReportSummaryFlow(input);
}
