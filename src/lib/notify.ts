import { Resend } from 'resend';

// Lazy-init to avoid crashing when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
    if (!process.env.RESEND_API_KEY) {
        return null;
    }
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

export async function sendScraperErrorEmail(
    scraperName: string,
    errorMessage: string,
    failureCount: number
): Promise<void> {
    const alertEmail = process.env.ALERT_EMAIL;

    if (!process.env.RESEND_API_KEY || !alertEmail) {
        console.error('[Notify] RESEND_API_KEY or ALERT_EMAIL not configured, skipping email');
        return;
    }

    const backoffHours = Math.min(Math.pow(2, failureCount), 8);

    const client = getResendClient();
    if (!client) return;

    try {
        await client.emails.send({
            from: 'Lux Scrapers <onboarding@resend.dev>',
            to: alertEmail,
            subject: `🚨 Scraper Failed: ${scraperName}`,
            text: `
Scraper: ${scraperName}
Error: ${errorMessage}
Failure Count: ${failureCount}
Backoff: ${backoffHours} hours until next retry

Timestamp: ${new Date().toISOString()}
Host: Raspberry Pi 5
            `.trim()
        });
        console.log(`[Notify] Error email sent for ${scraperName}`);
    } catch (e) {
        console.error('[Notify] Failed to send email:', e);
    }
}

export async function sendScraperSummaryEmail(
    successCount: number,
    failedScrapers: string[],
    totalArticles: number
): Promise<void> {
    const alertEmail = process.env.ALERT_EMAIL;

    if (!process.env.RESEND_API_KEY || !alertEmail) {
        return;
    }

    // Only send summary if there were failures
    if (failedScrapers.length === 0) {
        return;
    }

    const client = getResendClient();
    if (!client) return;

    try {
        await client.emails.send({
            from: 'Lux Scrapers <onboarding@resend.dev>',
            to: alertEmail,
            subject: `⚠️ Scraper Run Summary: ${failedScrapers.length} failures`,
            text: `
Scraper Run Summary
==================
Successful Scrapers: ${successCount}
Failed Scrapers: ${failedScrapers.length}
Total Articles Synced: ${totalArticles}

Failed:
${failedScrapers.map(s => `  - ${s}`).join('\n')}

Timestamp: ${new Date().toISOString()}
Host: Raspberry Pi 5
            `.trim()
        });
    } catch (e) {
        console.error('[Notify] Failed to send summary email:', e);
    }
}
