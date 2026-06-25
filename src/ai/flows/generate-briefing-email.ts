'use server';

import { ai } from '@/ai/genkit';

export const generateBriefingEmailText = async (context: any, portalLink: string) => {
    const { text } = await ai.generate({
        prompt: `
            Je bent een Google Ads en multi-channel specialist (werkend voor Only Forward - GO).
            Schrijf een e-mail gericht aan jouw opdrachtgever (de marketing agency of freelancer).
            De eindklant (het daadwerkelijke account) heet: ${context.clientName}.
            
            De e-mail is een reactie op hun initiële briefing of aanvraag. Je hebt hun input nu uitgewerkt tot een compleet "Campaign Blueprint".
            
            De opbouw van de e-mail moet als volgt zijn:
            
            1. BERICHT AAN DE OPDRACHTGEVER (AGENCY/FREELANCER)
            - Bedank ze voor de briefing. Houd de toon menselijk, vlot en informeel (alsof je tegen een vaste collega/partner praat).
            - Benoem kort hoe je de gekozen strategie hebt afgestemd op de "Strategie & Focus" input die zij hebben aangeleverd. Gebruik hiervoor deze context:
              * Doelen: ${context.primaryGoals || 'N.v.t.'}
              * Doelgroep: ${context.targetAudience || 'N.v.t.'}
              * USP's / Aanbod: ${context.usps || 'N.v.t.'} / ${context.offer || 'N.v.t.'}
            - Houd dit strategische stukje vlot en wees er niet te formeel of opsommend in; laat het natuurlijk vloeien.
            - Vraag hen om op de onderstaande magische link te klikken om de Blueprint te bekijken en (intern) goed te keuren.
            - Magische link: ${portalLink}
            
            2. TEMPLATE OM DOOR TE STUREN NAAR HUN EINDKLANT
            - Zet onderaan een duidelijke scheidingslijn (bijv. "---") en een korte tekst: "Hier is een kort bericht dat je direct naar je klant kunt doorsturen:"
            - Schrijf een hele korte, enthousiaste, maar wel professionele template die zij naar hun eindklant kunnen sturen. In deze template staat dat het Campagne Voorstel klaar staat op de magische link (${portalLink}) ter goedkeuring.
            
            Tone of voice: Vlot, menselijk, collegiaal naar de partner, en professioneel in de template naar de eindklant.
            Taal: ${context.language === 'english' ? 'Engels' : 'Nederlands'}.
            
            Belangrijk: 
            - Lever direct de platte tekst aan, geen HTML of JSON.
            - Gebruik regeleindes voor een nette opmaak.
        `
    });
    return text;
};
