import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
    scrapeCPPLuxury,
    scrapeJingDaily,
    scrapePurseBlog,
    scrapePurseBlogForum,
    scrapeLuxuryFallback
} from "../lib/scrapers";

// Make sure internal modules use import() or logic is correct
// Since we reverted scrapers.ts to not take browser, we can just call them.

async function sync() {
    console.log("Starting Data Sync...");

    // Lazy load supabase
    const { supabase } = await import("../lib/supabase");

    // 1. Scrape All
    console.log("Scraping sources...");
    const sources = [
        scrapeCPPLuxury,
        scrapeJingDaily,
        scrapePurseBlog,
        scrapePurseBlogForum,
        scrapeLuxuryFallback
    ];

    // Run sequentially to guarantee process isolation
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

    const articles = allArticles;

    console.log(`Scraped ${articles.length} total articles.`);

    // Deduplicate by URL
    const uniqueArticles = Array.from(
        new Map(articles.map(a => [a.url, a])).values()
    );
    console.log(`After dedup: ${uniqueArticles.length} unique articles.`);

    if (uniqueArticles.length === 0) {
        console.log("No articles found to sync.");
        return;
    }

    // 2. Transform for DB
    const dbRows = uniqueArticles.map(a => ({
        url: a.url,
        title: a.title,
        source: a.source,
        time: a.time,
        summary: a.summary || "",
        sector: "luxury",
        updated_at: new Date().toISOString()
    }));

    // 3. Upsert to Supabase
    const { data, error } = await supabase
        .from('articles')
        .upsert(dbRows, { onConflict: 'url', ignoreDuplicates: false })
        .select();

    if (error) {
        console.error("Supabase Sync Error:", error);
    } else {
        console.log(`Successfully synced ${dbRows.length} items to DB.`);
    }
}

sync();
