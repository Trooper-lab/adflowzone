'use server';

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase-server';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { fetchCampaignPerformance } from './google-ads-campaigns';
import type { ChildAccount, ParentClient, Todo } from '@/lib/types';

export async function sendMessageToChildAgent(
  parentClientId: string,
  accountId: string,
  messageText: string,
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) {
  try {
    // 1. Fetch child account
    const accountRef = doc(db, 'parentClients', parentClientId, 'childAccounts', accountId);
    const accountSnap = await getDoc(accountRef);
    if (!accountSnap.exists()) {
      throw new Error('Klantaccount niet gevonden.');
    }
    const account = accountSnap.data() as ChildAccount;

    // 2. Fetch parent client
    const parentRef = doc(db, 'parentClients', parentClientId);
    const parentSnap = await getDoc(parentRef);
    const parentClient = parentSnap.exists() ? (parentSnap.data() as ParentClient) : null;

    // 3. Fetch recent campaigns performance (Google Ads)
    let campaignDataStr = 'Geen actieve Google Ads campagnedata gevonden of niet geconfigureerd.';
    if (account.googleAdsClientId) {
      try {
        const perf = await fetchCampaignPerformance(accountId, account.googleAdsClientId, 'LAST_30_DAYS');
        if (perf && perf.campaigns && perf.campaigns.length > 0) {
          campaignDataStr = `Totaal Kosten afgelopen 30 dagen: €${perf.totals.cost.toFixed(2)}, Conversies: ${perf.totals.conversions.toFixed(1)}, Klikken: ${perf.totals.clicks}, Vertoningen: ${perf.totals.impressions}, CTR: ${(perf.totals.ctr * 100).toFixed(2)}%, CPA: €${perf.totals.costPerConversion.toFixed(2)}, ROAS: ${perf.totals.roas.toFixed(2)}x.\n`;
          campaignDataStr += `Top Campagnes:\n`;
          perf.campaigns.slice(0, 5).forEach((c) => {
            campaignDataStr += `- ${c.name} (${c.status}): Kosten €${c.cost.toFixed(2)}, Klikken ${c.clicks}, Conversies ${c.conversions.toFixed(1)}, CPA €${c.costPerConversion.toFixed(2)}\n`;
          });
        }
      } catch (err: any) {
        console.error('Error fetching campaigns for chat agent:', err);
        campaignDataStr = `Fout bij het ophalen van Google Ads prestaties: ${err.message}`;
      }
    }

    // 4. Fetch recent todos/tasks
    let tasksStr = 'Geen taken gevonden.';
    try {
      const todosQuery = query(collection(db, 'todos'), where('childAccountId', '==', accountId));
      const todosSnap = await getDocs(todosQuery);
      const todos = todosSnap.docs.map(d => d.data() as Todo);
      if (todos.length > 0) {
        tasksStr = todos.map(t => `- [${t.completed ? 'x' : ' '}] ${t.content} (Status: ${t.status || 'todo'}, Toegewezen aan: ${t.assigneeName || 'Niemand'})`).join('\n');
      }
    } catch (err: any) {
      console.error('Error fetching todos for chat agent:', err);
    }

    // 5. Build system instruction
    const systemInstruction = `Je bent de virtuele AI collega en strategische sparringpartner voor het klantaccount "${account.nickname}" bij agency/freelancer "${parentClient?.clientName || 'GO'}".
Je doel is om het team te helpen met analyses, strategisch advies en het beantwoorden van vragen over dit specifieke account.

Hier is de context van het account:
- **Klant Account**: ${account.nickname}
- **Primair Doel**: ${account.primaryGoal || 'Niet gespecificeerd'}
- **KPI's om te volgen**: ${account.kpisToTrack?.join(', ') || 'Niet gespecificeerd'}
- **Maandelijks Budget**: ${account.totalMonthlyBudget ? `€${account.totalMonthlyBudget}` : 'Niet gespecificeerd'}
- **Meta Ads Account**: ${account.metaAdsAccountName || 'Niet geconfigureerd'}

**Google Ads Campagneprestaties (afgelopen 30 dagen):**
${campaignDataStr}

**Lijst met actieve en voltooide taken (Todos):**
${tasksStr}

Geef to-the-point antwoorden in het Nederlands. Wees proactief, professioneel, en help de consultant om betere resultaten voor de klant te behalen. Analyseer de campagnedata en taken indien gevraagd, en kom met slimme verbetersuggesties.`;

    // 6. Generate content using Genkit
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      system: systemInstruction,
      messages: chatHistory.map(h => ({
        role: h.role,
        content: h.parts.map(p => ({ text: p.text }))
      })).concat([
        {
          role: 'user',
          content: [{ text: messageText }]
        }
      ])
    });

    return {
      success: true,
      text: text || 'Geen antwoord ontvangen van de AI.'
    };
  } catch (error: any) {
    console.error('Error in chat-agent server action:', error);
    return {
      success: false,
      error: error.message || 'Er is een interne fout opgetreden.'
    };
  }
}
