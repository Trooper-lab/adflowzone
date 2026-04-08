'use server';
/**
 * @fileOverview Generates high-quality keywords and ad copy for Google Search ads.
 * 
 * - generateSearchAdCopy - Main flow caller.
 * - Adheres to strict Google Ads policies (no ! in headlines).
 */

import { ai } from '@/ai/genkit';
import { AdCopyInputSchema, SearchAdCopyOutputSchema, type AdCopyInput, type SearchAdCopyOutput } from '@/lib/types';

const generateSearchAdCopyFlow = ai.defineFlow(
  {
    name: 'generateSearchAdCopyFlow',
    inputSchema: AdCopyInputSchema,
    outputSchema: SearchAdCopyOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Generate high-performing Search Ad assets in ${input.language}.
        
        **CONTEXT:**
        - Business: ${input.businessName || 'Not specified'}
        - Product/Service: ${input.productDescription}
        - Target Audience: ${input.targetAudience}
        - Desired Tone: ${input.tone}
        - Call to Action: ${input.callToAction}

        **STRICT GOOGLE ADS RULES:**
        1. **NO EXCLAMATION MARKS (!) in Headlines.** This is a non-negotiable policy.
        2. **Headlines MUST be 30 characters or less.** Count carefully.
        3. **Descriptions MUST be 90 characters or less.**
        4. No excessive punctuation, no "ALL CAPS" words, and no symbols that look like letters.
        5. Every asset must be unique and relevant.

        **AD STRUCTURE STRATEGY:**
        - Mix 15 headlines: Include 5 keyword-rich headlines, 5 benefit-driven headlines, 3 social proof/trust headlines, and 2 strong calls to action.
        - Generate 4 descriptions: Focus on unique selling points (USP) and solve the user's problem. Use ${input.callToAction} naturally.

        **KEYWORDS:**
        - Generate 15-20 relevant broad match keywords based on search intent for this business.

        Provide output in the specified JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: SearchAdCopyOutputSchema,
      },
    });

    return output ?? {
        keywords: [],
        adCopy: { headlines: [], descriptions: [] }
    };
  }
);

export async function generateSearchAdCopy(input: AdCopyInput): Promise<SearchAdCopyOutput> {
  return await generateSearchAdCopyFlow(input);
}
