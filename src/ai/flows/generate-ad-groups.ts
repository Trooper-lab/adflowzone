'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema, AdGroupOutputSchema, GenerateAdGroupsInputSchema, type GenerateAdGroupsInput, type BriefingContext, type AdGroupOutput } from '@/lib/types';

const generateAdGroupsFlow = ai.defineFlow(
  {
    name: 'generateAdGroupsFlow',
    inputSchema: GenerateAdGroupsInputSchema,
    outputSchema: AdGroupOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to generate Ad Groups and all their associated assets (keywords, headlines, descriptions) for ONE specific campaign.
        Respond in ${input.context.language}.
        
        **OVERALL CONTEXT:**
        - Client/Business: ${input.context.clientName}
        - Website: ${input.context.website}
        - Industry: ${input.context.industry}
        - Target Audience: ${input.context.targetAudience}
        - Desired Tone: ${input.context.tone || 'Professional'}

        **CAMPAIGN TO BUILD:**
        - Name: ${input.campaign.name}
        - Type: ${input.campaign.type}
        - Objective: ${input.campaign.objective}

        **TASK DETAILS:**
        1. Create 2 to 4 distinct Ad Groups for this campaign. Each ad group should have a clear theme.
        2. Generate a unique, short ID for each ad group (e.g., "ag-1").
        3. Depending on the campaign type (${input.campaign.type}):
           - If 'search': 
             - Generate 10-15 highly relevant broad match keywords.
             - Generate 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!) IN HEADLINES.
             - Generate 4 descriptions (max 90 chars).
           - If 'pmax':
             - Generate 5-10 broad match keywords (search themes).
             - Generate 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!).
             - Generate 5 long headlines (max 90 chars).
             - Generate 5 descriptions (max 90 chars).
             - Generate 3-5 creative image prompts for an AI image generator to create assets for this PMax campaign.
        4. Provide a strong Call To Action (e.g., "Shop Now", "Meer Informatie").

        **STRICT GOOGLE ADS RULES:**
        - NO EXCLAMATION MARKS (!) in any Headlines.
        - Strict adherence to character limits (30 for headlines, 90 for descriptions/long headlines).

        Provide the output in the specified JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: AdGroupOutputSchema,
      },
    });

    return output ?? {
        adGroups: []
    };
  }
);

export async function generateAdGroups(input: GenerateAdGroupsInput): Promise<AdGroupOutput> {
  return await generateAdGroupsFlow(input);
}
