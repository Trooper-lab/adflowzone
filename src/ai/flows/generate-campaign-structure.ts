'use server';

import { ai } from '@/ai/genkit';
import { BriefingContextSchema, CampaignStructureOutputSchema, type BriefingContext, type CampaignStructureOutput } from '@/lib/types';

const generateCampaignStructureFlow = ai.defineFlow(
  {
    name: 'generateCampaignStructureFlow',
    inputSchema: BriefingContextSchema,
    outputSchema: CampaignStructureOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Generate a high-level campaign structure for a new account or new strategy.
        Respond in ${input.language}.
        
        **CONTEXT:**
        - Client/Business: ${input.clientName}
        - Website: ${input.website}
        - Industry: ${input.industry}
        - Primary Goals: ${input.primaryGoals}
        - Target Audience: ${input.targetAudience}
        - Additional Notes: ${input.additionalNotes || 'None'}

        **TASK:**
        1. Propose 2 to 4 distinct Google Ads campaigns that make logical sense for this client's goals.
        2. Mix campaign types based on what works best (e.g., Search for high-intent, Performance Max for broad coverage/e-commerce).
        3. For each campaign, provide a logical objective, a suggested budget distribution percentage (e.g., "70% of total budget"), and a brief rationale why this campaign is recommended.
        4. Generate a unique, short ID for each campaign (e.g., "camp-1").
        
        Provide the output in the specified JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: CampaignStructureOutputSchema,
      },
    });

    return output ?? {
        campaigns: []
    };
  }
);

export async function generateCampaignStructure(input: BriefingContext): Promise<CampaignStructureOutput> {
  return await generateCampaignStructureFlow(input);
}
