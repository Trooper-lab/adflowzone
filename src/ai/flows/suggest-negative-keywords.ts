'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema } from '@/lib/types';

const SuggestNegativeKeywordsInputSchema = z.object({
  context: BriefingContextSchema,
  unselectedKeywords: z.array(z.string()),
});

const SuggestNegativeKeywordsOutputSchema = z.object({
  negativeKeywords: z.array(z.string()).describe('A list of negative keywords to block irrelevant traffic.'),
});

const suggestNegativeKeywordsFlow = ai.defineFlow(
  {
    name: 'suggestNegativeKeywordsFlow',
    inputSchema: SuggestNegativeKeywordsInputSchema,
    outputSchema: SuggestNegativeKeywordsOutputSchema,
  },
  async (input) => {
    // Only send the top 200 unselected keywords to avoid token limits
    const topUnselected = input.unselectedKeywords.slice(0, 200);

    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to analyze a list of search terms that were NOT selected for the campaign, and identify which ones should be added as Negative Keywords to prevent wasted budget.
        
        **CONTEXT:**
        - Client: ${input.context.clientName}
        - Industry: ${input.context.industry}
        - USPs/Focus: ${input.context.usps || 'Not specified'}
        - Base Negatives: ${input.context.negativeKeywordsBase || 'Not specified'}

        **UNSELECTED KEYWORDS FROM API:**
        ${JSON.stringify(topUnselected)}

        **TASK:**
        1. Identify broad, irrelevant themes in the unselected keywords (e.g., if selling premium shoes, block "cheap", "free", "second hand").
        2. Identify specific high-volume terms in the unselected list that are clearly irrelevant to the business.
        3. Combine these with the "Base Negatives" provided in the context.
        4. Return a clean, deduplicated list of Negative Keywords. Do NOT use match type brackets (just the words).
        Return the keywords in the target language (${input.context.language}).
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: SuggestNegativeKeywordsOutputSchema,
      },
    });

    return output ?? { negativeKeywords: [] };
  }
);

export async function suggestNegativeKeywords(context: any, unselectedKeywords: string[]): Promise<string[]> {
  const result = await suggestNegativeKeywordsFlow({ context, unselectedKeywords });
  return result.negativeKeywords;
}
