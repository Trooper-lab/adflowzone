'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema, AdGroupOutputSchema, GenerateAdGroupsInputSchema, type GenerateAdGroupsInput, type BriefingContext, type AdGroupOutput, AdGroupSuggestionSchema, type AdGroupSuggestion, GenerateSingleAdGroupInputSchema, type GenerateSingleAdGroupInput } from '@/lib/types';

const suggestAdGroupsFlow = ai.defineFlow(
  {
    name: 'suggestAdGroupsFlow',
    inputSchema: GenerateAdGroupsInputSchema,
    outputSchema: AdGroupSuggestionSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Based on the client context and campaign objective, suggest 3 distinct Ad Group directions/themes.
        Consider existing ad groups if provided in context (not explicitly passed but useful for mental model).
        
        **CONTEXT:**
        - Client: ${input.context.clientName}
        - Website: ${input.context.website}
        - Industry: ${input.context.industry}
        - Campaign: ${input.campaign.name} (${input.campaign.type})
        - Objective: ${input.campaign.objective}
        - Goals: ${input.context.primaryGoals}
        - Target Audience: ${input.context.targetAudience}
        - Existing Ad Groups: ${input.existingAdGroups?.length ? input.existingAdGroups.join(', ') : 'None yet'}

        **TASK:**
        Suggest 3 NEW and DISTINCT Ad Group directions/themes that complement the existing structure and align with the strategy. 
        Respond in ${input.context.language}.
        Provide 3 suggestions with a clear title and a short description of the angle/intent.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: AdGroupSuggestionSchema,
      },
    });

    return output ?? { suggestions: [] };
  }
);

const generateSingleAdGroupFlow = ai.defineFlow(
  {
    name: 'generateSingleAdGroupFlow',
    inputSchema: GenerateSingleAdGroupInputSchema,
    outputSchema: AdGroupOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Generate ONE specific Ad Group and all its assets based on the provided title and direction.
        Respond in ${input.context.language}.
        
        **AD GROUP TO GENERATE:**
        - Title: ${input.adGroupTitle}
        - Description/Direction: ${input.adGroupDescription}
        - Strict Keywords: ${input.providedKeywords ? JSON.stringify(input.providedKeywords) : 'None provided, invent logically'}

        **OVERALL CONTEXT:**
        - Client: ${input.context.clientName}
        - Website: ${input.context.website}
        - Target Audience: ${input.context.targetAudience}
        - USP's / Hook: ${input.context.usps || ''} ${input.context.marketingHook || ''}
        - Call to Action: ${input.context.primaryCta || 'Not specified'}

        **CAMPAIGN CONTEXT:**
        - Name: ${input.campaign.name}
        - Type: ${input.campaign.type}
        - Objective: ${input.campaign.objective}

        **TASK DETAILS:**
        1. **ASSETS**: Depending on type (${input.campaign.type}):
           - If 'search': 
             - KEYWORDS: If "Strict Keywords" are provided above, you MUST use EXACTLY that list of keywords. Do not drop any keyword, and do not invent new ones.
             - MATCH TYPES: The keywords MUST be formatted using proper Google Ads match type syntax based on the campaign's strategic rationale/objective (${input.campaign.objective}):
               * Exact match: [keyword]
               * Phrase match: "keyword"
               * Broad match: keyword (no quotes or brackets)
               Apply the match types strategically to the strict keywords to match the objective.
             - 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!).
             - 4 descriptions (max 90 chars).
           - If 'pmax':
             - KEYWORDS (Search Themes): If "Strict Keywords" are provided, use them as Performance Max Search Themes. They MUST NOT use any match type syntax (do NOT use [] or "").
             - 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!).
             - 5 long headlines (max 90 chars).
             - 5 descriptions (max 90 chars).
             - 3-5 creative image prompts.
             - **AUDIENCE SIGNALS**: Custom intent, in-market, customer match ideas, and demographics.

        **HEADLINE STRUCTURE STRATEGY (15 headlines total):**
        The 15 headlines must be generated in exactly 3 groups, returned in this exact order in the headlines array:
        - Group 1 (Headlines 1-9, indices 0-8): Keyword-focused for quality score (e.g. matching keywords/search intent). Forcing the target keywords into the H1 position.
        - Group 2 (Headlines 10-12, indices 9-11): USP/Hook-focused (Highlighting the USPs and the chosen Marketing Hook).
        - Group 3 (Headlines 13-15, indices 12-14): Call to action (CTA) focused (e.g. driving the "Primary Call to Action").

        **EXTENSIONS:**
        - Always generate exactly 4 Sitelinks (each with a short title and description) to deep-link to specific product categories or pages.
        - Always generate exactly 4 Callouts (short trust signals/benefits).

        **CAPITALIZATION RULES:**
        - For Dutch ("dutch") language copy (headlines, long headlines, descriptions, etc.):
          * Use strictly **Sentence Case** capitalization. This means only the first letter of the first word/sentence is capitalized (along with proper nouns if necessary).
          * Do NOT capitalize every word (do NOT use Title Case like "Dit Is Een Kop").
          * Do NOT use all-caps.
          * Examples: Use "Schoenen online kopen" instead of "Schoenen Online Kopen", "Vraag een offerte aan" instead of "Vraag Een Offerte Aan".

        **STRICT GOOGLE ADS RULES:**
        - NO EXCLAMATION MARKS (!) in any Headlines.
        - Strict character limits: 30 for headlines, 90 for descriptions.

        Provide output for exactly ONE ad group in the JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: AdGroupOutputSchema,
      },
    });

    return output ?? { adGroups: [] };
  }
);

export async function suggestAdGroups(input: GenerateAdGroupsInput): Promise<AdGroupSuggestion> {
  return await suggestAdGroupsFlow(input);
}

export async function generateSingleAdGroup(input: GenerateSingleAdGroupInput): Promise<AdGroupOutput> {
  return await generateSingleAdGroupFlow(input);
}

const generateAdGroupsFlow = ai.defineFlow(
  {
    name: 'generateAdGroupsFlow',
    inputSchema: GenerateAdGroupsInputSchema,
    outputSchema: AdGroupOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to generate Ad Groups and all their associated assets (keywords, headlines, descriptions, extensions) for ONE specific campaign.
        Respond in ${input.context.language}.
        
        **OVERALL CONTEXT:**
        - Client/Business: ${input.context.clientName}
        - Website: ${input.context.website}
        - Industry: ${input.context.industry}
        - Target Audience: ${input.context.targetAudience}
        - Desired Tone: ${input.context.tone || 'Professional'}
        - USP's: ${input.context.usps || 'Not specified'}
        - Special Offer: ${input.context.offer || 'None'}
        - Target Locations: ${input.context.targetLocations || 'Not specified'}
        - Negative Keywords (Base): ${input.context.negativeKeywordsBase || 'Standard set'}
        - Meeting Notes/Raw Briefing: ${input.context.rawNotes || 'None'}
        - Additional Notes: ${input.context.additionalNotes || 'None'}

        **CAMPAIGN TO BUILD:**
        - Name: ${input.campaign.name}
        - Type: ${input.campaign.type}
        - Objective: ${input.campaign.objective}

        **TASK DETAILS:**
        1. **AD GROUPS**: Create 2 to 4 distinct Ad Groups for this campaign.
        2. **ASSETS**: Depending on type (${input.campaign.type}):
           - If 'search': 
             - 10-15 keywords. The keywords MUST be formatted using proper Google Ads match type syntax based on the campaign's strategic rationale/objective (${input.campaign.objective}):
               * Exact match: [keyword]
               * Phrase match: "keyword"
               * Broad match: keyword (no quotes or brackets)
               Generate a strategic mix of match types that matches the recommendations in the strategic rationale.
             - 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!).
             - 4 descriptions (max 90 chars).
           - If 'pmax':
             - 5-10 keywords (search themes). These are Performance Max Search Themes and MUST NOT use any match type syntax (do NOT use [] or "").
             - 15 headlines (max 30 chars). NO EXCLAMATION MARKS (!).
             - 5 long headlines (max 90 chars).
             - 5 descriptions (max 90 chars).
             - 3-5 creative image prompts.
             - **AUDIENCE SIGNALS**: Custom intent, in-market, customer match ideas, and demographics.
        
        3. **EXTENSIONS**: Generate for this campaign:
           - 4-6 Sitelinks (title + description).
           - 6-8 Callouts.
           - A Lead Form proposal (title + fields).

        4. **NEGATIVE KEYWORDS**: Provide a list of 10-15 negative keywords relevant to this campaign's context.

        **HEADLINE STRUCTURE STRATEGY (15 headlines total per ad group):**
        The 15 headlines must be generated in exactly 3 groups of 5, returned in this exact order in the headlines array:
        - Group 1 (Headlines 1-5, indices 0-4): Keyword-focused for quality score (e.g. matching keywords/search intent).
        - Group 2 (Headlines 6-10, indices 5-9): USP-focused (Unique Selling Points, e.g. features, benefits, trust factors).
        - Group 3 (Headlines 11-15, indices 10-14): Call to action (CTA) focused (e.g. "Koop nu online", "Vraag offerte aan").

        **CAPITALIZATION RULES:**
        - For Dutch ("dutch") language copy (headlines, long headlines, descriptions, extensions, etc.):
          * Use strictly **Sentence Case** capitalization. This means only the first letter of the first word/sentence is capitalized (along with proper nouns if necessary).
          * Do NOT capitalize every word (do NOT use Title Case like "Dit Is Een Kop").
          * Do NOT use all-caps.
          * Examples: Use "Schoenen online kopen" instead of "Schoenen Online Kopen", "Vraag een offerte aan" instead of "Vraag Een Offerte Aan".

        **STRICT GOOGLE ADS RULES:**
        - NO EXCLAMATION MARKS (!) in any Headlines.
        - Strict character limits: 30 for headlines, 90 for descriptions.

        Provide the output in the specified JSON format.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: AdGroupOutputSchema,
      },
    });

    return output ?? {
        adGroups: []
    };
  }
);

export async function generateAdGroups(input: GenerateAdGroupsInput): Promise<AdGroupOutput> {
  return await generateAdGroupsFlow(input);
}

