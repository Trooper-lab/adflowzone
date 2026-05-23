'use server';

import { Resend } from 'resend';

export async function sendBriefingEmail(
    toEmail: string,
    subject: string,
    body: string
) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Resend API key is not configured.");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const htmlBody = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="white-space: pre-wrap;">${body}</div>
            </div>
        `;
        
        await resend.emails.send({
            from: 'AdFlow Zone <flowzone@trooper.es>',
            to: [toEmail],
            subject: subject,
            html: htmlBody,
        });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error sending briefing email:", error);
        return { success: false, error: error.message };
    }
}
