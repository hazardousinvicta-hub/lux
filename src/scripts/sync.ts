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
    scrapeCMX,
    scrapeSemianalysis,
    scrapeFabricated,
    scrapeAsianometry,
    scrapeMoreThanMoore,
    scrapeHackerNews,
    scrapeTechCrunch,
    scrapeArsTechnica,
    scrapeTechNews
} from "../lib/scrapers";

// Define source groups by sector
const LUXURY_SOURCES = [
    scrapeCPPLuxury,
    scrapeJingDaily,
    scrapePurseBlog,
    scrapePurseBlogForum,
    scrapeLuxuryFallback
];

const TECH_SOURCES = [
    scrapeLithosgraphein,
    scrapeCMX,
    scrapeSemianalysis,
    scrapeFabricated,
    scrapeAsianometry,
    scrapeMoreThanMoore,
    scrapeHackerNews,
    scrapeTechCrunch,
    scrapeArsTechnica,
    scrapeTechNews
];

async function syncSector(sectorName: string, sources: (() => Promise<any>)[]) {
    console.log(`\n========== SYNCING ${sectorName.toUpperCase()} ==========\n`);

    let allArticles: any[] = [];
    for (const scrapeFn of sources) {
        try {
            console.log(`-- Running ${scrapeFn.name} --`);
            const result = await scrapeFn();
            if (result.items) {
                allArticles = [...allArticles, ...result.items];
            }
            // Small cooldown between scrapers
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error("Scraper failed unexpectedly:", e);
        }
    }

    console.log(`Scraped ${allArticles.length} total articles for ${sectorName}.`);

    // Deduplicate by URL
    const uniqueArticles = Array.from(
        new Map(allArticles.map(a => [a.url, a])).values()
    );
    console.log(`After dedup: ${uniqueArticles.length} unique articles.`);

    return { sector: sectorName, articles: uniqueArticles };
}

async function sync() {
    console.log("Starting Full Data Sync...");

    // Lazy load supabase
    const { supabase } = await import("../lib/supabase");

    // Sync both sectors
    const luxuryData = await syncSector("luxury", LUXURY_SOURCES);
    const techData = await syncSector("semiconductors", TECH_SOURCES);

    // Combine all articles with their sectors
    const allDbRows: any[] = [];

    for (const article of luxuryData.articles) {
        allDbRows.push({
            url: article.url,
            title: article.title,
            source: article.source,
            time: article.time,
            summary: article.summary || "",
            sector: "luxury",
            updated_at: new Date().toISOString()
        });
    }

    for (const article of techData.articles) {
        allDbRows.push({
            url: article.url,
            title: article.title,
            source: article.source,
            time: article.time,
            summary: article.summary || "",
            sector: "semiconductors",
            updated_at: new Date().toISOString()
        });
    }

    console.log(`\n========== UPLOADING TO SUPABASE ==========`);
    console.log(`Total articles to sync: ${allDbRows.length}`);

    if (allDbRows.length === 0) {
        console.log("No articles found to sync.");
        return;
    }

    // Upsert to Supabase
    const { data, error } = await supabase
        .from('articles')
        .upsert(allDbRows, { onConflict: 'url', ignoreDuplicates: false })
        .select();

    if (error) {
        console.error("Supabase Sync Error:", error);
    } else {
        console.log(`Successfully synced ${allDbRows.length} items to DB!`);
        console.log(`  - Luxury: ${luxuryData.articles.length}`);
        console.log(`  - Tech: ${techData.articles.length}`);
    }
}

sync();
