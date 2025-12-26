/**
 * Continuous Scraper Daemon
 * 
 * Runs indefinitely, randomly selecting sources to scrape.
 * Includes deep scraping of individual articles.
 * Mimics human browsing with random delays.
 * 
 * Run with: npm run daemon
 * Managed by PM2 in production.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer, { Browser } from 'puppeteer';
import {
    scrapeCPPLuxury,
    scrapeJingDaily,
    scrapePurseBlog,
    scrapePurseBlogForum,
    scrapeLuxuryFallback,
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
import { SupabaseRepository } from "../lib/db/supabase-repository";
import { Article } from "../lib/db/repository";

// ======================== Configuration ========================

const CONFIG = {
    // Delay ranges (ms) - mimics human browsing
    MIN_SOURCE_DELAY: 30_000,      // 30 seconds between sources
    MAX_SOURCE_DELAY: 180_000,     // 3 minutes between sources
    MIN_ARTICLE_DELAY: 10_000,     // 10 seconds between articles
    MAX_ARTICLE_DELAY: 60_000,     // 1 minute between articles

    // Deep scraping
    ARTICLES_PER_BATCH: 3,         // Deep scrape 3 articles per source cycle
    MAX_CONTENT_LENGTH: 50_000,    // Max chars to store per article

    // Puppeteer
    BROWSER_TIMEOUT: 60_000,       // 60s page timeout
};

// ======================== Source Registry ========================

interface SourceEntry {
    name: string;
    fn: () => Promise<ScrapeResult>;
    sector: 'luxury' | 'semiconductors';
    weight: number;  // Higher = more likely to be picked
}

const SOURCES: SourceEntry[] = [
    // Luxury
    { name: 'CPP Luxury', fn: scrapeCPPLuxury, sector: 'luxury', weight: 2 },
    { name: 'Jing Daily', fn: scrapeJingDaily, sector: 'luxury', weight: 2 },
    { name: 'PurseBlog', fn: scrapePurseBlog, sector: 'luxury', weight: 2 },
    { name: 'PurseBlog Forum', fn: scrapePurseBlogForum, sector: 'luxury', weight: 1 },
    { name: 'Luxury Fallback', fn: scrapeLuxuryFallback, sector: 'luxury', weight: 1 },
    // Tech
    { name: 'Lithosgraphein', fn: scrapeLithosgraphein, sector: 'semiconductors', weight: 3 },
    { name: 'SemiAnalysis', fn: scrapeSemianalysis, sector: 'semiconductors', weight: 2 },
    { name: 'Fabricated Knowledge', fn: scrapeFabricated, sector: 'semiconductors', weight: 2 },
    { name: 'Asianometry', fn: scrapeAsianometry, sector: 'semiconductors', weight: 1 },
    { name: 'More Than Moore', fn: scrapeMoreThanMoore, sector: 'semiconductors', weight: 2 },
    { name: 'Hacker News', fn: scrapeHackerNews, sector: 'semiconductors', weight: 3 },
    { name: 'TechCrunch', fn: scrapeTechCrunch, sector: 'semiconductors', weight: 2 },
    { name: 'Ars Technica', fn: scrapeArsTechnica, sector: 'semiconductors', weight: 2 },
    { name: 'Tech News', fn: scrapeTechNews, sector: 'semiconductors', weight: 1 },
];

// ======================== State ========================

let shuttingDown = false;
let browser: Browser | null = null;
let repository: SupabaseRepository;

// Stats
const stats = {
    sourcesScraped: 0,
    articlesFound: 0,
    articlesDeepScraped: 0,
    errors: 0,
    startTime: Date.now(),
};

// ======================== Utility Functions ========================

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pickRandomSource(): SourceEntry {
    // Weighted random selection
    const totalWeight = SOURCES.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;

    for (const source of SOURCES) {
        random -= source.weight;
        if (random <= 0) return source;
    }

    return SOURCES[0];
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

// ======================== Signal Handlers ========================

function setupSignalHandlers() {
    const handleShutdown = async (signal: string) => {
        console.log(`\n[Daemon] Received ${signal}, shutting down gracefully...`);
        shuttingDown = true;

        if (browser) {
            console.log('[Daemon] Closing browser...');
            await browser.close();
        }

        printStats();
        process.exit(0);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
}

function printStats() {
    const uptime = Date.now() - stats.startTime;
    console.log('\n========================================');
    console.log('  Daemon Statistics');
    console.log('========================================');
    console.log(`  Uptime: ${formatUptime(uptime)}`);
    console.log(`  Sources scraped: ${stats.sourcesScraped}`);
    console.log(`  Articles found: ${stats.articlesFound}`);
    console.log(`  Articles deep scraped: ${stats.articlesDeepScraped}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log('========================================\n');
}

// ======================== Browser Management ========================

async function ensureBrowser(): Promise<Browser> {
    if (browser && browser.connected) {
        return browser;
    }

    console.log('[Daemon] Launching browser...');
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions',
            '--disable-background-networking',
        ]
    });

    return browser;
}

// ======================== Deep Scraping ========================

async function deepScrapeArticle(article: Article): Promise<string | null> {
    const url = article.url;
    console.log(`[DeepScrape] Scraping: ${url}`);

    try {
        const br = await ensureBrowser();
        const page = await br.newPage();

        // Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.BROWSER_TIMEOUT });

        // Extract main content
        const content = await page.evaluate(() => {
            // Try common article content selectors
            const selectors = [
                'article',
                '.post-content',
                '.entry-content',
                '.article-body',
                '.article-content',
                '.post-body',
                'main article',
                '[role="main"]',
                '.story-body',
                '.content-body',
            ];

            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent && el.textContent.length > 200) {
                    return el.textContent.trim();
                }
            }

            // Fallback: get body text, excluding nav/footer
            const body = document.body;
            const nav = document.querySelector('nav');
            const footer = document.querySelector('footer');
            if (nav) nav.remove();
            if (footer) footer.remove();

            return body.innerText.slice(0, 50000);
        });

        await page.close();

        if (content && content.length > 100) {
            // Truncate if too long
            const truncated = content.slice(0, CONFIG.MAX_CONTENT_LENGTH);
            console.log(`[DeepScrape] Extracted ${truncated.length} chars`);
            return truncated;
        }

        console.log('[DeepScrape] Content too short or empty');
        return null;

    } catch (error: any) {
        console.error(`[DeepScrape] Error: ${error.message}`);
        stats.errors++;
        return null;
    }
}

// ======================== Main Loop ========================

async function scrapeSource(source: SourceEntry): Promise<Article[]> {
    console.log(`\n[Source] ${source.name} (${source.sector})`);

    try {
        const result = await source.fn();

        if (result.status === 'error') {
            console.error(`[Source] ${source.name} failed: ${result.error}`);
            stats.errors++;
            return [];
        }

        console.log(`[Source] Found ${result.count} items`);
        stats.articlesFound += result.count;

        // Map to Article type with sector
        return result.items.map(item => ({
            url: item.url,
            title: item.title,
            source: item.source || source.name,
            sector: source.sector,
            time: item.time,
            summary: item.summary,
        }));

    } catch (error: any) {
        console.error(`[Source] ${source.name} error: ${error.message}`);
        stats.errors++;
        return [];
    }
}

async function runDaemonLoop() {
    while (!shuttingDown) {
        // 1. Pick a random source and scrape it
        const source = pickRandomSource();
        const articles = await scrapeSource(source);
        stats.sourcesScraped++;

        // 2. Save to database
        if (articles.length > 0) {
            const result = await repository.upsertArticles(articles);
            console.log(`[DB] Saved ${result.count} articles`);
        }

        // 3. Random delay before deep scraping
        const delay1 = randomBetween(CONFIG.MIN_ARTICLE_DELAY, CONFIG.MAX_ARTICLE_DELAY);
        console.log(`[Daemon] Waiting ${Math.round(delay1 / 1000)}s before deep scraping...`);
        await sleep(delay1);

        if (shuttingDown) break;

        // 4. Deep scrape a few unprocessed articles
        const unscraped = await repository.getUnscrapedArticles(CONFIG.ARTICLES_PER_BATCH);
        console.log(`[DeepScrape] Found ${unscraped.length} articles to process`);

        for (const article of unscraped) {
            if (shuttingDown) break;

            const content = await deepScrapeArticle(article);

            if (content) {
                await repository.updateArticleContent(article.url, content);
                stats.articlesDeepScraped++;
            } else {
                // Mark as scraped even if failed, to avoid retrying forever
                await repository.markAsDeepScraped(article.url);
            }

            // Delay between articles
            const delay2 = randomBetween(CONFIG.MIN_ARTICLE_DELAY, CONFIG.MAX_ARTICLE_DELAY);
            console.log(`[Daemon] Waiting ${Math.round(delay2 / 1000)}s before next article...`);
            await sleep(delay2);
        }

        // 5. Random delay before next source
        const delay3 = randomBetween(CONFIG.MIN_SOURCE_DELAY, CONFIG.MAX_SOURCE_DELAY);
        console.log(`[Daemon] Waiting ${Math.round(delay3 / 1000)}s before next source...`);
        await sleep(delay3);

        // Periodic stats
        if (stats.sourcesScraped % 10 === 0) {
            printStats();
        }
    }
}

// ======================== Main ========================

async function main() {
    console.log('========================================');
    console.log('  Lux Scraper Daemon');
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log(`  Mode: Continuous with deep scraping`);
    console.log('========================================\n');

    setupSignalHandlers();

    // Initialize repository
    try {
        repository = new SupabaseRepository();
    } catch (error: any) {
        console.error('[Daemon] Failed to initialize database:', error.message);
        process.exit(1);
    }

    console.log('[Daemon] Starting main loop...');
    console.log(`[Daemon] Source delay: ${CONFIG.MIN_SOURCE_DELAY / 1000}s - ${CONFIG.MAX_SOURCE_DELAY / 1000}s`);
    console.log(`[Daemon] Article delay: ${CONFIG.MIN_ARTICLE_DELAY / 1000}s - ${CONFIG.MAX_ARTICLE_DELAY / 1000}s`);
    console.log(`[Daemon] Deep scrape batch size: ${CONFIG.ARTICLES_PER_BATCH}`);
    console.log('');

    try {
        await runDaemonLoop();
    } catch (error: any) {
        console.error('[Daemon] Fatal error:', error);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
