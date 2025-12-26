/**
 * Standalone scraper worker for PM2 deployment on Raspberry Pi 5.
 * 
 * Features:
 * - Sequential execution of all scrapers with configurable delays
 * - Exponential backoff (1hr → 2hr → 4hr → 8hr max) per source on failures
 * - Graceful shutdown on SIGTERM/SIGINT (completes current scraper)
 * - Detailed error logging and email notifications
 * - Random jitter (0-30min) at startup to avoid request clustering
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
    // Luxury sources
    scrapeCPPLuxury,
    scrapeJingDaily,
    scrapePurseBlog,
    scrapePurseBlogForum,
    scrapeLuxuryFallback,
    // Tech sources
    scrapeLithosgraphein,
    scrapeSemianalysis,
    scrapeFabricated,
    scrapeAsianometry,
    scrapeMoreThanMoore,
    scrapeHackerNews,
    scrapeTechCrunch,
    scrapeArsTechnica,
    scrapeTechNews,
    type ScrapeResult
} from "../lib/scrapers";
import { sendScraperErrorEmail, sendScraperSummaryEmail } from "../lib/notify";

// ======================== Configuration ========================

const SKIP_JITTER = process.argv.includes('--now');

const CONFIG = {
    // Delay between scrapers (ms)
    SCRAPER_DELAY: 3000,
    // Max backoff hours
    MAX_BACKOFF_HOURS: 8,
    // Random startup jitter range (ms) - 0 to 30 minutes
    STARTUP_JITTER_MS: 30 * 60 * 1000,
    // Enable startup jitter (set to false for testing, or use --now flag)
    ENABLE_JITTER: process.env.NODE_ENV === 'production' && !SKIP_JITTER,
};

// ======================== Scraper Registry ========================

interface ScraperEntry {
    name: string;
    fn: () => Promise<ScrapeResult>;
    sector: 'luxury' | 'semiconductors';
}

const SCRAPERS: ScraperEntry[] = [
    // Luxury
    { name: 'CPP Luxury', fn: scrapeCPPLuxury, sector: 'luxury' },
    { name: 'Jing Daily', fn: scrapeJingDaily, sector: 'luxury' },
    { name: 'PurseBlog', fn: scrapePurseBlog, sector: 'luxury' },
    { name: 'PurseBlog Forum', fn: scrapePurseBlogForum, sector: 'luxury' },
    { name: 'Luxury Fallback', fn: scrapeLuxuryFallback, sector: 'luxury' },
    // Tech
    { name: 'Lithosgraphein', fn: scrapeLithosgraphein, sector: 'semiconductors' },
    { name: 'SemiAnalysis', fn: scrapeSemianalysis, sector: 'semiconductors' },
    { name: 'Fabricated Knowledge', fn: scrapeFabricated, sector: 'semiconductors' },
    { name: 'Asianometry', fn: scrapeAsianometry, sector: 'semiconductors' },
    { name: 'More Than Moore', fn: scrapeMoreThanMoore, sector: 'semiconductors' },
    { name: 'Hacker News', fn: scrapeHackerNews, sector: 'semiconductors' },
    { name: 'TechCrunch', fn: scrapeTechCrunch, sector: 'semiconductors' },
    { name: 'Ars Technica', fn: scrapeArsTechnica, sector: 'semiconductors' },
    { name: 'Tech News', fn: scrapeTechNews, sector: 'semiconductors' },
];

// ======================== State ========================

// Backoff tracking (persists only during this run - cron restarts reset it)
const failureCounts: Record<string, number> = {};
const backoffUntil: Record<string, number> = {};

// Graceful shutdown flag
let shuttingDown = false;
let currentScraper: string | null = null;

// ======================== Signal Handlers ========================

function setupSignalHandlers() {
    const handleShutdown = (signal: string) => {
        console.log(`\n[Worker] Received ${signal}, initiating graceful shutdown...`);
        shuttingDown = true;

        if (currentScraper) {
            console.log(`[Worker] Waiting for ${currentScraper} to complete...`);
        } else {
            console.log('[Worker] No scraper in progress, exiting immediately.');
            process.exit(0);
        }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
}

// ======================== Backoff Logic ========================

function shouldSkipDueToBackoff(scraperName: string): boolean {
    const backoffTime = backoffUntil[scraperName];
    if (backoffTime && Date.now() < backoffTime) {
        const remainingMs = backoffTime - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        console.log(`[${scraperName}] Skipping - backing off for ${remainingMins} more minutes`);
        return true;
    }
    return false;
}

function recordFailure(scraperName: string, error: string) {
    failureCounts[scraperName] = (failureCounts[scraperName] || 0) + 1;
    const count = failureCounts[scraperName];

    // Exponential backoff: 1hr, 2hr, 4hr, 8hr max
    const backoffHours = Math.min(Math.pow(2, count - 1), CONFIG.MAX_BACKOFF_HOURS);
    backoffUntil[scraperName] = Date.now() + backoffHours * 60 * 60 * 1000;

    console.error(`[${scraperName}] Failed (${count}x) - backing off for ${backoffHours} hours`);
    console.error(`[${scraperName}] Error: ${error}`);

    // Send error email
    sendScraperErrorEmail(scraperName, error, count).catch(() => { });
}

function recordSuccess(scraperName: string) {
    // Reset failure tracking on success
    if (failureCounts[scraperName]) {
        console.log(`[${scraperName}] Recovered after ${failureCounts[scraperName]} failures`);
        delete failureCounts[scraperName];
        delete backoffUntil[scraperName];
    }
}

// ======================== Scraper Runner ========================

async function runScraper(entry: ScraperEntry): Promise<ScrapeResult | null> {
    const { name, fn } = entry;

    if (shouldSkipDueToBackoff(name)) {
        return null;
    }

    currentScraper = name;
    console.log(`\n[${name}] Starting...`);

    try {
        const result = await fn();

        if (result.status === 'error') {
            recordFailure(name, result.error || 'Unknown error');
            return null;
        }

        recordSuccess(name);
        console.log(`[${name}] Completed - ${result.count} items in ${result.duration}ms`);
        return result;

    } catch (error: any) {
        recordFailure(name, error.message || 'Unexpected error');
        return null;
    } finally {
        currentScraper = null;
    }
}

async function runAllScrapers(): Promise<{ articles: any[], successCount: number, failedScrapers: string[] }> {
    const allArticles: any[] = [];
    let successCount = 0;
    const failedScrapers: string[] = [];

    for (const scraper of SCRAPERS) {
        if (shuttingDown) {
            console.log('[Worker] Shutdown requested, stopping scraper run');
            break;
        }

        const result = await runScraper(scraper);

        if (result && result.items.length > 0) {
            // Add sector to each article
            const articlesWithSector = result.items.map(item => ({
                ...item,
                sector: scraper.sector,
            }));
            allArticles.push(...articlesWithSector);
            successCount++;
        } else if (result === null) {
            // Either skipped due to backoff or failed
            if (!shouldSkipDueToBackoff(scraper.name)) {
                failedScrapers.push(scraper.name);
            }
        }

        // Delay between scrapers
        if (!shuttingDown) {
            await new Promise(r => setTimeout(r, CONFIG.SCRAPER_DELAY));
        }
    }

    return { articles: allArticles, successCount, failedScrapers };
}

// ======================== Database Sync ========================

async function syncToDatabase(articles: any[]): Promise<void> {
    if (articles.length === 0) {
        console.log('[DB] No articles to sync');
        return;
    }

    console.log(`\n[DB] Syncing ${articles.length} articles to Supabase...`);

    const { supabase } = await import("../lib/supabase");

    const dbRows = articles.map(article => ({
        url: article.url,
        title: article.title,
        source: article.source,
        time: article.time,
        summary: article.summary || "",
        sector: article.sector,
        updated_at: new Date().toISOString()
    }));

    // Deduplicate by URL
    const uniqueRows = Array.from(
        new Map(dbRows.map(r => [r.url, r])).values()
    );

    const { error } = await supabase
        .from('articles')
        .upsert(uniqueRows, { onConflict: 'url', ignoreDuplicates: false });

    if (error) {
        console.error('[DB] Sync error:', error);
        throw error;
    }

    console.log(`[DB] Successfully synced ${uniqueRows.length} unique articles`);
}

// ======================== Main ========================

async function main() {
    console.log('========================================');
    console.log('  Lux Scraper Worker');
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================\n');

    setupSignalHandlers();

    // Random startup jitter in production
    if (CONFIG.ENABLE_JITTER) {
        const jitterMs = Math.floor(Math.random() * CONFIG.STARTUP_JITTER_MS);
        const jitterMins = Math.round(jitterMs / 60000);
        console.log(`[Worker] Applying ${jitterMins} minute startup jitter...`);
        await new Promise(r => setTimeout(r, jitterMs));
    }

    // Check for required env vars
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Worker] WARNING: SUPABASE_SERVICE_ROLE_KEY not set');
    }

    try {
        // Run all scrapers
        const { articles, successCount, failedScrapers } = await runAllScrapers();

        if (shuttingDown) {
            console.log('[Worker] Graceful shutdown - skipping database sync');
            process.exit(0);
        }

        // Sync to database
        await syncToDatabase(articles);

        // Send summary email if there were failures
        await sendScraperSummaryEmail(successCount, failedScrapers, articles.length);

        // Final summary
        console.log('\n========================================');
        console.log('  Scraper Run Complete');
        console.log(`  Success: ${successCount}/${SCRAPERS.length}`);
        console.log(`  Failed: ${failedScrapers.length}`);
        console.log(`  Total Articles: ${articles.length}`);
        console.log(`  Finished: ${new Date().toISOString()}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('[Worker] Fatal error:', error);
        process.exit(1);
    }
}

main();
