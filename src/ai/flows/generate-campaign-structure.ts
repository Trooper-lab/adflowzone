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
        You are a senior Google Ads specialist. Generate a professional "Google Ads Blueprint" for a high-end agency.
        The goal is to create a structured, visually impressive, and strategically sound document.
        Respond in ${input.language}.
        
        **CONTEXT:**
        - Client/Business: ${input.clientName}
        - Website: ${input.website}
        - Industry: ${input.industry}
        - Focus Products/Services: ${input.focusProducts || 'Not specified'}
        - Competitors: ${input.competitors || 'Not specified'}
        - Primary Goals: ${input.primaryGoals}
        - Target Audience: ${input.targetAudience}
        - Tone of Voice: ${input.tone}
        - USP's: ${input.usps || 'Not specified'}
        - Special Offer: ${input.offer || 'None'}
        - Target Locations: ${input.targetLocations || 'Not specified'}
        - Target Languages: ${input.targetLanguages || 'Not specified'}
        - Negative Keywords (Base): ${input.negativeKeywordsBase || 'Standard set'}
        - Meeting Notes/Raw Briefing: ${input.rawNotes || 'None'}
        - Additional Notes: ${input.additionalNotes || 'None'}

        **TACTICAL REQUIREMENTS:**
        - Total Monthly Budget: ${input.monthlyBudget || 'To be determined'}
        - Preferred Campaign Types: ${input.campaignTypes?.join(', ') || 'Any'}
        - Desired Number of Campaigns: ${input.desiredCampaignCount || '3'}
        - Budget Distribution Preference: ${input.budgetDistributionPreference || 'Balanced'}
        - Bid Strategy Preference: ${input.bidStrategyPreference || 'Maximize Conversions'}

        **TASK:**
        1. **CAMPAIGNS**: Propose 2 to 4 distinct Google Ads campaigns based on the focus products and competitors. 
           - Provide a clear objective, suggested budget (e.g., "€40/day"), and a detailed strategic rationale that connects the campaign to the client's goals and competitive landscape.
        
        2. **BUDGET ALLOCATION**: Provide a breakdown of how the total budget is split. 
           - Include a "totalBudget" string (e.g., "€3,000 / maand") and a rationale for why this budget is sufficient or recommended for the industry.
        
        3. **BID STRATEGY**: Define a phased bidding approach, respecting the user's preference: ${input.bidStrategyPreference}.
           - Phase 1: Usually observation/learning.
           - Phase 2: Optimization (e.g., Target CPA or Target ROAS).
           - Provide a professional note on why this progression is used.
        
        4. **KPIs**: List 3-4 key performance indicators with target values.
           - Include "Expected CPA", "Target ROAS", "Conversion Rate", etc.
           - Add a note for each explaining why it's a critical metric for this client.
        
        5. **TRACKING**: Define the primary and secondary conversion goals to track.
           - Use methods like "GTM / GA4", "Enhanced Conversions", or "Server-side".
           - Prioritize them (High/Medium/Low).
        
        6. **TIMELINE**: Create a realistic 4-6 week implementation roadmap.
           - Break it down into specific milestones like "Audit & Setup", "Asset Creation", "Launch", "First Optimization".

        **STYLE GUIDELINES:**
        - Language: ${input.language === 'dutch' ? 'Dutch (NL)' : 'English'}.
        - Tone: ${input.tone}.
        - Precision: Avoid generic advice. Use the specific context from meeting notes, focus products, and competitors.
        - Conciseness: **CRITICAL**: Keep all rationales, descriptions, and notes extremely concise (maximum 2-3 short sentences). Avoid long blocks of text.
        - Format: Strictly follow the JSON schema provided.
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
