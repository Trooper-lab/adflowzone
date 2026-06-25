'use server';

import { Resend } from 'resend';
import type { MonthlyReport, ParentClient, ChildAccount, Todo } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

function generateEmailHtml(report: MonthlyReport, client: ParentClient, account: ChildAccount, performanceData: any[], completedChecklists: any[], completedTodos: Todo[], insights: any, nextSteps: string[]): string {
    
    const getKPIValue = (kpi: string, data: Record<string, number> | undefined) => {
        if (!data) return '-';
        
        const spend = Number(data['spend']) || 0;
        const clicks = Number(data['clicks']) || 0;
        const impressions = Number(data['impressions']) || 0;
        const conversions = Number(data['conversions']) || 0;
        const conversionValue = Number(data['conversion_value']) || 0;

        switch (kpi) {
            case 'cpc':
                return clicks > 0 ? `€${(spend / clicks).toFixed(2)}` : '-';
            case 'ctr':
                return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-';
            case 'cpl':
                return conversions > 0 ? `€${(spend / conversions).toFixed(2)}` : '-';
            case 'roas':
                return spend > 0 ? `${(conversionValue / spend).toFixed(2)}x` : '-';
            case 'spend':
            case 'conversion_value':
                 return `€${Number(data[kpi] || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            default:
                return (data[kpi] as number)?.toLocaleString('nl-NL') ?? '0';
        }
    };
    
    const styles = {
        body: 'font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px;',
        container: 'max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;',
        header: 'background-color: #4A90E2; color: #ffffff; padding: 20px; text-align: center;',
        h1: 'margin: 0; font-size: 24px;',
        h2: 'font-size: 20px; color: #4A90E2; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; margin-top: 30px;',
        content: 'padding: 20px;',
        p: 'margin: 0 0 15px;',
        ul: 'list-style-type: none; padding: 0;',
        li: 'margin-bottom: 10px; padding: 10px; background-color: #f2f2f2; border-radius: 4px;',
        table: 'width: 100%; border-collapse: collapse; margin-top: 15px;',
        th: 'text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;',
        td: 'padding: 8px; border-bottom: 1px solid #ddd;',
    };

    return `
        <div style="${styles.body}">
            <div style="${styles.container}">
                <div style="${styles.header}">
                    <h1 style="${styles.h1}">Maandrapport Google Ads: ${account.nickname}</h1>
                    <p style="margin: 5px 0 0;">${format(parseISO(report.period + '-02'), 'MMMM yyyy', { locale: nl })}</p>
                </div>
                <div style="${styles.content}">
                    <h2 style="${styles.h2}">Managementsamenvatting</h2>
                    <p style="${styles.p}">${report.aiSummary}</p>

                    <h2 style="${styles.h2}">Belangrijkste Inzichten & Observaties</h2>
                    <ul style="${styles.ul}">
                        ${insights.map((insight: any) => `
                            <li style="${styles.li}">
                                <strong>${insight.title}</strong> (Impact: ${insight.impact})<br/>
                                ${insight.description}
                            </li>
                        `).join('')}
                    </ul>

                    <h2 style="${styles.h2}">Prestatiegegevens</h2>
                    <table style="${styles.table}">
                        <thead>
                            <tr>
                                <th style="${styles.th}">Maand</th>
                                ${account.kpisToTrack.map(kpi => `<th style="${styles.th}" class="uppercase">${kpi.replace(/_/g, ' ')}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                             ${performanceData.map((p: any) => `
                                <tr>
                                    <td style="${styles.td}">${p.month}</td>
                                    ${account.kpisToTrack.map(kpi => `<td style="${styles.td}">${getKPIValue(kpi, p.data)}</td>`).join('')}
                                </tr>
                             `).join('')}
                        </tbody>
                    </table>

                    <h2 style="${styles.h2}">Managementactiviteit</h2>
                    <h3>Voltooide Checklists</h3>
                    <ul style="${styles.ul}">
                        ${completedChecklists.map((run: any) => `
                            <li style="${styles.li}">
                                <strong>${run.name}</strong> (Voltooid: ${run.completedAt ? format(parseISO(run.completedAt as string), 'PPP', { locale: nl }) : 'N/A'})
                                ${run.tasks.filter((t: any) => t.notes).map((t: any) => `<p style="margin: 5px 0 0; font-size: 12px;"><em>&rarr; ${t.description}: ${t.notes}</em></p>`).join('')}
                            </li>
                        `).join('')}
                        ${completedChecklists.length === 0 ? '<p>Er zijn deze periode geen checklists uitgevoerd.</p>' : ''}
                    </ul>
                    
                     <h3>Voltooide Taken</h3>
                     <ul style="${styles.ul}">
                        ${completedTodos.map((todo: Todo) => `<li style="${styles.li}">${todo.content}</li>`).join('')}
                        ${completedTodos.length === 0 ? '<p>Geen losse taken voltooid.</p>' : ''}
                    </ul>

                    <h2 style="${styles.h2}">Volgende Stappen</h2>
                    <ul style="${styles.ul}">
                         ${nextSteps.map(step => `<li style="${styles.li}">${step}</li>`).join('')}
                         ${nextSteps.length === 0 ? '<p>Geen specifieke volgende stappen geïdentificeerd.</p>' : ''}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

export async function sendReportByEmail(
    report: MonthlyReport,
    client: ParentClient,
    account: ChildAccount,
    performanceData: any[],
    completedChecklists: any[],
    completedTodos: Todo[],
    insights: any,
    nextSteps: string[]
) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Resend API key is not configured.");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const htmlBody = generateEmailHtml(report, client, account, performanceData, completedChecklists, completedTodos, insights, nextSteps);
        
        await resend.emails.send({
            from: 'GO - Global Overview <flowzone@trooper.es>',
            to: [client.clientContactEmail],
            subject: `Maandrapport voor ${account.nickname} - ${format(parseISO(report.period + '-02'), 'MMMM yyyy', { locale: nl })}`,
            html: htmlBody,
        });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error sending report email:", error);
        return { success: false, error: error.message };
    }
}
