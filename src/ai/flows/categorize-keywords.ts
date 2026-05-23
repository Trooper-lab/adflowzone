'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { BriefingContextSchema, CategorizedThemeSchema, type CategorizedTheme } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const CategorizeKeywordsInputSchema = z.object({
  context: BriefingContextSchema,
  keywords: z.array(z.string()),
});

const CategorizeKeywordsOutputSchema = z.object({
  themes: z.array(z.object({
    name: z.string().describe('The name of the theme or Ad Group (e.g. SEO Services, Web Design)'),
    keywords: z.array(z.string()).describe('The keywords assigned to this theme'),
  })),
});

const categorizeKeywordsFlow = ai.defineFlow(
  {
    name: 'categorizeKeywordsFlow',
    inputSchema: CategorizeKeywordsInputSchema,
    outputSchema: CategorizeKeywordsOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `
        You are a senior Google Ads specialist. Your task is to organize a raw list of selected keywords into tight, logical Ad Group Themes.
        
        **CONTEXT:**
        - Client: ${input.context.clientName}
        - Industry: ${input.context.industry}
        - Language: ${input.context.language}

        **KEYWORDS TO ORGANIZE:**
        ${JSON.stringify(input.keywords)}

        **RULES:**
        1. Group the keywords into tightly themed categories (Ad Groups).
        2. Keywords within a theme should share the exact same user intent and core phrasing so that the resulting ad copy can be highly relevant to all of them.
        3. Every keyword from the provided list MUST be placed into exactly one theme. Do not drop any keywords.
        4. Name the themes clearly and concisely (e.g., "SEO Bureau", "Linkbuilding Services").
        5. Return the result in the specified JSON structure.
      `,
      model: 'googleai/gemini-2.5-flash',
      output: {
        schema: CategorizeKeywordsOutputSchema,
      },
    });

    return output ?? { themes: [] };
  }
);

export async function categorizeKeywords(context: any, keywords: string[]): Promise<CategorizedTheme[]> {
  const result = await categorizeKeywordsFlow({ context, keywords });
  
  return result.themes.map(theme => ({
    id: uuidv4(),
    name: theme.name,
    keywords: theme.keywords
  }));
}
