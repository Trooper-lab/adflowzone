'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema } from '@/lib/types';

const RewriteAssetInputSchema = z.object({
  context: BriefingContextSchema,
  assetType: z.enum(['headline', 'longHeadline', 'description', 'sitelink', 'callout']),
  currentValue: z.string(),
  campaignName: z.string(),
  adGroupName: z.string(),
  groupContext: z.string().optional(), // E.g. "Group 1: Keyword-focused"
});

const RewriteAssetOutputSchema = z.object({
  newValue: z.string().describe('The rewritten asset text.'),
});

const rewriteAssetFlow = ai.defineFlow(
  {
    name: 'rewriteAssetFlow',
    inputSchema: RewriteAssetInputSchema,
    outputSchema: RewriteAssetOutputSchema,
  },
  async (input) => {
    let maxLength = 30;
    if (input.assetType === 'description' || input.assetType === 'longHeadline') maxLength = 90;
    if (input.assetType === 'sitelink' || input.assetType === 'callout') maxLength = 25;

    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to rewrite a single line of ad copy because the user didn't like the current version.
        
        **CONTEXT:**
        - Client: ${input.context.clientName}
        - Industry: ${input.context.industry}
        - Hook/USP: ${input.context.marketingHook || ''} ${input.context.usps || ''}
        - CTA: ${input.context.primaryCta || ''}
        - Campaign: ${input.campaignName}
        - Ad Group: ${input.adGroupName}

        **ASSET TO REWRITE:**
        - Type: ${input.assetType}
        - Current Value: "${input.currentValue}"
        - Specific Context: ${input.groupContext || 'None'}
        - Max Length: ${maxLength} characters.

        **TASK:**
        Provide ONE highly optimized alternative for this specific asset. It must be completely different from the "Current Value" but serve the same purpose.
        
        **RULES:**
        - Keep it strictly under ${maxLength} characters.
        - Respond in ${input.context.language}.
        - If language is 'dutch', use STRICT Sentence Case (only capitalize the first letter of the sentence).
        - NO exclamation marks (!).
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: RewriteAssetOutputSchema,
      },
    });

    return output ?? { newValue: input.currentValue };
  }
);

export async function rewriteAsset(
  context: any, 
  assetType: 'headline' | 'longHeadline' | 'description' | 'sitelink' | 'callout', 
  currentValue: string, 
  campaignName: string, 
  adGroupName: string, 
  groupContext?: string
): Promise<string> {
  const result = await rewriteAssetFlow({ context, assetType, currentValue, campaignName, adGroupName, groupContext });
  return result.newValue;
}
