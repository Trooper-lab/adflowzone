'use server';

import { ai } from '@/ai/genkit';
import { BriefingContextSchema, type BriefingContext } from '@/lib/types';
import { z } from 'zod';

const ExtractBriefingContextInputSchema = z.object({
  rawNotes: z.string(),
  currentContext: BriefingContextSchema.partial().optional(),
});

const extractBriefingContextFlow = ai.defineFlow(
  {
    name: 'extractBriefingContextFlow',
    inputSchema: ExtractBriefingContextInputSchema,
    outputSchema: BriefingContextSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to extract structured briefing information from raw meeting notes or unstructured documentation.
        
        **RAW INPUT:**
        ${input.rawNotes}
        
        **EXISTING CONTEXT (if any):**
        ${JSON.stringify(input.currentContext || {})}

        **TASK:**
        1. Analyze the raw input and extract as much information as possible to fill the briefing context fields.
        2. If information is already present in the "EXISTING CONTEXT" and not contradicted by the "RAW INPUT", keep it.
        3. FIELDS TO EXTRACT:
           - clientName: The name of the business or brand.
           - website: The business website URL.
           - industry: Description of industry and products/services.
           - primaryGoals: Main objectives (leads, ROAS, sales, etc).
           - targetAudience: Ideal customer profile.
           - language: 'dutch' or 'english'.
           - tone: Brand voice/tone.
           - monthlyBudget: Extract budget if mentioned (e.g., "€5000").
           - campaignTypes: Array of 'search', 'pmax', 'display', 'video', 'shopping'.
           - desiredCampaignCount: Number of campaigns requested.
           - budgetDistributionPreference: How to split budget (e.g., "70/30 Search/PMax").
           - bidStrategyPreference: Preferred bidding strategy.
           - focusProducts: Specific products or services to prioritize.
           - competitors: Main competitors mentioned.
           - targetLocations: Geographic areas to target.
           - targetLanguages: Languages for targeting.
           - usps: Unique Selling Points.
           - offer: Special deals or actions.
           - negativeKeywordsBase: Specific things to exclude.
           - conversionValue: Target value per conversion if mentioned.
        
        **IMPORTANT:** 
        - Return the information in the specified JSON format.
        - Be concise but thorough in the descriptions.
        - If a field is not found in the notes, try to infer it based on context where reasonable, otherwise keep current context or leave empty.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: BriefingContextSchema,
      },
    });

    return output ?? {
        clientName: '',
        website: '',
        industry: '',
        primaryGoals: '',
        targetAudience: '',
        language: 'dutch',
        tone: 'Professional',
        rawNotes: input.rawNotes,
    } as BriefingContext;
  }
);

export async function extractBriefingContext(rawNotes: string, currentContext?: Partial<BriefingContext>): Promise<BriefingContext> {
  return await extractBriefingContextFlow({ rawNotes, currentContext });
}
