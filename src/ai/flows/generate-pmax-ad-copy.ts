'use server';
/**
 * @fileOverview Generates assets for Google Performance Max campaigns.
 * 
 * - generatePMaxAdCopy - Main flow caller.
 * - Focuses on asset variety and strict character limits.
 */

import { ai } from '@/ai/genkit';
import { AdCopyInputSchema, PMaxAdCopyOutputSchema, type AdCopyInput, type PMaxAdCopyOutput } from '@/lib/types';

const generatePMaxAdCopyFlow = ai.defineFlow(
  {
    name: 'generatePMaxAdCopyFlow',
    inputSchema: AdCopyInputSchema,
    outputSchema: PMaxAdCopyOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a performance marketing expert. Generate a complete set of Performance Max (PMax) assets in ${input.language}.

        **CONTEXT:**
        - Business: ${input.businessName}
        - Description: ${input.productDescription}
        - Audience: ${input.targetAudience}
        - Tone: ${input.tone}
        - Call to Action: ${input.callToAction}

        **STRICT ASSET REQUIREMENTS:**
        1. **Headlines (15 assets):** MAX 30 characters. **STRICTLY NO EXCLAMATION MARKS (!).**
        2. **Long Headlines (5 assets):** MAX 90 characters. Focus on benefits and storytelling.
        3. **Descriptions (5 assets):** MAX 90 characters. One should be short (60 chars), others up to 90.
        4. **Image Prompts (5 assets):** Creative prompts for an AI image generator that reflect the brand's ${input.tone} tone and product.
        5. **Keywords (10-15 assets):** Search themes for audience signals. These are Performance Max Search Themes and MUST NOT use any match type syntax (do NOT use [] or "").

        **HEADLINE STRUCTURE STRATEGY (15 headlines total):**
        The 15 headlines must be generated in exactly 3 groups of 5, returned in this exact order in the headlines array:
        - Group 1 (Headlines 1-5, indices 0-4): Keyword-focused for quality score (e.g. matching keywords/search themes).
        - Group 2 (Headlines 6-10, indices 5-9): USP-focused (Unique Selling Points, e.g. features, benefits, trust factors).
        - Group 3 (Headlines 11-15, indices 10-14): Call to action (CTA) focused (e.g. "Koop nu online", "Vraag offerte aan").

        **CAPITALIZATION RULES:**
        - For Dutch ("dutch") language copy (headlines, long headlines, descriptions, etc.):
          * Use strictly **Sentence Case** capitalization. This means only the first letter of the first word/sentence is capitalized (along with proper nouns if necessary).
          * Do NOT capitalize every word (do NOT use Title Case like "Dit Is Een Kop").
          * Do NOT use all-caps.
          * Examples: Use "Schoenen online kopen" instead of "Schoenen Online Kopen", "Vraag een offerte aan" instead of "Vraag Een Offerte Aan".

        **POLICIES:**
        - No exclamation marks in ANY headline.
        - No repetitive text across headlines.
        - Ensure the ${input.callToAction} is incorporated where effective.

        Provide output in the specified JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: PMaxAdCopyOutputSchema,
      },
    });
    
    return output ?? {
        keywords: [],
        adCopy: { headlines: [], longHeadlines: [], descriptions: [] },
        imagePrompts: [],
        callToAction: input.callToAction || 'Learn More',
    };
  }
);

export async function generatePMaxAdCopy(input: AdCopyInput): Promise<PMaxAdCopyOutput> {
  if (!input.businessName) {
      throw new Error("Business name is required for Performance Max campaigns.");
  }
  return await generatePMaxAdCopyFlow(input);
}
