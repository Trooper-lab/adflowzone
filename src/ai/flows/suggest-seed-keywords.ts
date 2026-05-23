'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema } from '@/lib/types';

const SuggestSeedKeywordsInputSchema = z.object({
  context: BriefingContextSchema,
  existingSeeds: z.array(z.string()).optional(),
});

const SuggestSeedKeywordsOutputSchema = z.object({
  seedKeywords: z.array(z.string()).describe('A list of 3-5 highly relevant seed keywords to start the Google Ads API search.'),
});

const suggestSeedKeywordsFlow = ai.defineFlow(
  {
    name: 'suggestSeedKeywordsFlow',
    inputSchema: SuggestSeedKeywordsInputSchema,
    outputSchema: SuggestSeedKeywordsOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Based on the client's briefing context, suggest 3-5 "Seed Keywords" that will be used to fetch search volume data from the Google Ads API.
        
        **CONTEXT:**
        - Client: ${input.context.clientName}
        - Website: ${input.context.website}
        - Industry: ${input.context.industry}
        - Marketing Hook: ${input.context.marketingHook || 'Not specified'}
        - Target Audience: ${input.context.targetAudience}
        - USPs: ${input.context.usps || 'Not specified'}
        - Focus Products: ${input.context.focusProducts || 'Not specified'}
        - Language: ${input.context.language}

        **TASK:**
        Provide 3-5 broad, foundational search terms (Seed Keywords) that represent the core products or services. These should NOT be long-tail keywords, but rather the main categories people would search for (e.g., "zonnepanelen", "warmtepomp", "schoenen kopen").
        
        **EXCLUSIONS:**
        Do NOT suggest any of the following keywords as the user has already selected them:
        ${JSON.stringify(input.existingSeeds || [])}
        Return the keywords in the target language (${input.context.language}).
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: SuggestSeedKeywordsOutputSchema,
      },
    });

    return output ?? { seedKeywords: [] };
  }
);

export async function suggestSeedKeywords(context: any, existingSeeds?: string[]): Promise<string[]> {
  const result = await suggestSeedKeywordsFlow({ context, existingSeeds });
  return result.seedKeywords;
}
