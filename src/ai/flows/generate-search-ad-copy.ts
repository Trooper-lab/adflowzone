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
        - Generate exactly 15 headlines, divided into exactly 3 groups of 5, returned in this exact order in the headlines array:
          * Group 1 (Headlines 1-5, indices 0-4): Keyword-focused for quality score (e.g. matching keywords/search intent).
          * Group 2 (Headlines 6-10, indices 5-9): USP-focused (Unique Selling Points, e.g. features, benefits, trust factors).
          * Group 3 (Headlines 11-15, indices 10-14): Call to action (CTA) focused (e.g. "Koop nu online", "Vraag offerte aan").
        - Generate 4 descriptions: Focus on unique selling points (USP) and solve the user's problem. Use ${input.callToAction} naturally.

        **CAPITALIZATION RULES:**
        - For Dutch ("dutch") language copy (headlines, descriptions, etc.):
          * Use strictly **Sentence Case** capitalization. This means only the first letter of the first word/sentence is capitalized (along with proper nouns if necessary).
          * Do NOT capitalize every word (do NOT use Title Case like "Dit Is Een Kop").
          * Do NOT use all-caps.
          * Examples: Use "Schoenen online kopen" instead of "Schoenen Online Kopen", "Vraag een offerte aan" instead of "Vraag Een Offerte Aan".

        **KEYWORDS:**
        - Generate 15-20 relevant keywords based on search intent for this business.
        - The keywords MUST be formatted with proper Google Ads match type syntax, creating a strategic mix:
          * Exact match: [keyword]
          * Phrase match: "keyword"
          * Broad match: keyword (no quotes or brackets)

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
