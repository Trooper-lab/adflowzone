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
        5. **Keywords (10-15 assets):** Search themes for audience signals.

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
