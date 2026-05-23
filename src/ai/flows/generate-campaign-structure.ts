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
        - Marketing Hook/Angle: ${input.marketingHook || 'Not specified'}
        - Primary Conversion: ${input.primaryConversion || 'Not specified'}
        - Primary CTA: ${input.primaryCta || 'Not specified'}
        - Focus Products/Services: ${input.focusProducts || 'Not specified'}
        - Competitors: ${input.competitors || 'Not specified'}
        - Primary Goals: ${input.primaryGoals}
        - Target Audience: ${input.targetAudience}
        - Tone of Voice: ${input.tone}
        - USP's: ${input.usps || 'Not specified'}
        - Special Offer: ${input.offer || 'None'}
        - Target Locations: ${input.targetLocations || 'Not specified'}
        - Target Languages: ${input.targetLanguages || 'Not specified'}
        - Negative Keywords (Base + API Generated): ${input.negativeKeywords?.join(', ') || input.negativeKeywordsBase || 'Standard set'}
        - Meeting Notes/Raw Briefing: ${input.rawNotes || 'None'}
        - Additional Notes: ${input.additionalNotes || 'None'}
        
        **APPROVED KEYWORD THEMES (AD GROUPS):**
        The following keyword themes have been categorized and approved by the user. 
        You MUST base your campaigns strictly around these exact themes. Do not invent new ad groups outside of these themes:
        ${JSON.stringify(input.keywordThemes || 'No specific themes approved yet')}

        **TACTICAL REQUIREMENTS & CO-PILOT OVERRIDES:**
        - Total Monthly Budget: ${input.monthlyBudget || 'To be determined'}
        - Preferred Campaign Types: ${input.campaignTypes?.join(', ') || 'Any'}
        - Desired Number of Campaigns: ${input.desiredCampaignCount || '3'}
        - Budget Split Search vs PMax: ${input.budgetSplitSearch || 50}% Search / ${input.budgetSplitPmax || 50}% PMax
        - Bidding Strategy (Search): ${input.biddingStrategySearch || input.bidStrategyPreference || 'Maximize Conversions'}
        - Bidding Strategy (PMax): ${input.biddingStrategyPmax || 'Maximize Conversions'}

        **TASK:**
        1. **CAMPAIGNS**: Propose 2 to 4 distinct Google Ads campaigns based on the focus products, competitors, and the **APPROVED KEYWORD THEMES**. 
           - Provide a clear objective, suggested budget (e.g., "€40/day").
           - **STRATEGIC RATIONALE**: Write a comprehensive, detailed strategic rationale for each campaign (at least 2-3 well-developed paragraphs). It must specify:
             * The overall strategic reason for this campaign.
             * The recommended keyword match types (e.g., broad match, "phrase" match, and/or [exact] match) to use for these ad groups, along with the strategic reasoning for selecting those match types.
           - **AD GROUP SUGGESTIONS**: For each proposed campaign, strictly allocate the **APPROVED KEYWORD THEMES** that belong in that campaign. Use the exact theme names as the Ad Group titles, and describe briefly what the theme covers. Place them in the 'adGroupSuggestions' field of each campaign. Every approved theme MUST be assigned to a campaign.
        
        2. **BUDGET ALLOCATION**: Provide a breakdown of how the total budget is split. 
           - Include a "totalBudget" string (e.g., "€3,000 / maand") and a rationale for why this budget is sufficient, specifically referencing the CPC data from the selected keywords.
         
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
         
        **STYLE GUIDELINES:**
        - Language: ${input.language === 'dutch' ? 'Dutch (NL)' : 'English'}.
        - Tone: ${input.tone}.
        - Precision: Avoid generic advice. Use the specific context from meeting notes, focus products, and competitors.
        - Conciseness: Keep budget allocation, KPI notes, and tracking tasks concise (maximum 2-3 short sentences). However, the campaign strategic rationale MUST be detailed, thorough, and comprehensive as described above.
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
