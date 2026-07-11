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
           - marketingHook: Define the core marketing angle or hook (e.g. "We sell the fastest shoes", "Risk-free trial").
           - primaryConversion: The primary conversion action (e.g., "Purchase", "Lead Form", "Phone Call").
           - primaryCta: The exact Call to Action text to use (e.g. "Koop Nu", "Vraag Offerte Aan").
           - monthlyBudget: Extract total budget if mentioned.
           - googleBudget: Extract Google Ads budget if mentioned.
           - metaBudget: Extract Meta Ads budget if mentioned.
           - linkedinBudget: Extract LinkedIn Ads budget if mentioned.
           - campaignLandingPages: Extract specific landing page paths/urls per campaign/channel if mentioned.
           - campaignTypes: Array of 'search', 'pmax', 'display', 'video', 'shopping', 'meta', 'linkedin'.
           - desiredCampaignCount: Number of campaigns requested.
           - metaProspecting: Extract boolean true if prospecting/cold audience is requested for Meta.
           - metaRemarketing: Extract boolean true if remarketing/warm audience is requested for Meta.
           - metaCampaignCount: Extract number of Meta campaigns requested if mentioned.
           - metaVisualsFormats: Extract array of strings representing Meta visual formats mentioned, e.g. ['static', 'video', 'carousel', 'both'].
           - linkedinProspecting: Extract boolean true if prospecting/cold audience is B2B requested for LinkedIn.
           - linkedinRemarketing: Extract boolean true if remarketing/warm audience is B2B requested for LinkedIn.
           - linkedinCampaignCount: Extract number of LinkedIn campaigns requested if mentioned.
           - linkedinAdFormats: Extract array of strings representing LinkedIn ad formats mentioned, e.g. ['single_image', 'carousel', 'video', 'document', 'message'].
           - budgetSplitSearch: Suggested budget percentage for Search (0-100).
           - budgetSplitPmax: Suggested budget percentage for PMax (0-100).
           - biddingStrategySearch: Preferred bidding strategy for Search (e.g. "Maximize Clicks", "Target CPA").
           - biddingStrategyPmax: Preferred bidding strategy for PMax (e.g. "Maximize Conversions", "Target ROAS").
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

    const result: Partial<BriefingContext> = output ?? {};
    
    const finalContext: BriefingContext = {
        ...result,
        clientName: result.clientName || input.currentContext?.clientName || '',
        website: result.website || input.currentContext?.website || '',
        industry: result.industry || input.currentContext?.industry || '',
        primaryGoals: result.primaryGoals || input.currentContext?.primaryGoals || '',
        targetAudience: result.targetAudience || input.currentContext?.targetAudience || '',
        language: result.language || input.currentContext?.language || 'dutch',
        tone: result.tone || input.currentContext?.tone || 'Professional',
        rawNotes: input.rawNotes || '',
    };
    return finalContext;
  }
);

export async function extractBriefingContext(rawNotes: string, currentContext?: Partial<BriefingContext>): Promise<BriefingContext> {
  return await extractBriefingContextFlow({ rawNotes, currentContext });
}
