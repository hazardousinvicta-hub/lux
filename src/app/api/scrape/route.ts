import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

interface ScrapeResult {
    source: string;
    status: "success" | "warning" | "error";
    count: number;
    duration: number;
    error?: string;
    items: any[];
}

const scrapeWithPuppeteer = async (url: string, selector: string, sourceName: string): Promise<ScrapeResult> => {
    const start = Date.now();
    let browser;
    try {
        console.log(`[${sourceName}] Launching browser...`);
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`[${sourceName}] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Attempt to close common popups
        try {
            const popupSelectors = [
                'button[aria-label="Close"]',
                '.close-button',
                '#close-popup',
                '.newsletter-modal .close',
                'div[class*="popup"] button'
            ];
            for (const pSel of popupSelectors) {
                if (await page.$(pSel)) {
                    console.log(`[${sourceName}] Closing popup: ${pSel}`);
                    await page.click(pSel);
                    await new Promise(r => setTimeout(r, 500)); // wait for animation
                }
            }
        } catch (e) {
            console.log(`[${sourceName}] Popup handling error (ignoring):`, e);
        }

        console.log(`[${sourceName}] Waiting for content...`);
        // Relaxed selector waiting - if specific selector fails, we might still fallback to broad sweep
        try {
            await page.waitForSelector(selector, { timeout: 8000 });
        } catch {
            console.log(`[${sourceName}] Primary selector timeout, proceeding to extraction...`);
        }

        const items = await page.evaluate((sel, source) => {
            let elements = Array.from(document.querySelectorAll(sel));

            // Fallback for Jing Daily or others: if no specific items found, try broad catch
            if (elements.length === 0 && source.includes("Jing")) {
                // Broad Catch Strategy: All links with substantial text
                elements = Array.from(document.querySelectorAll('a')).filter(a => {
                    const text = (a as HTMLElement).innerText.trim();
                    // Filter out short nav links, dates, and common words
                    return text.length > 30 && !text.includes("Read More") && !text.includes("Subscribe");
                });
            }

            return elements.slice(0, 15).map(el => {
                const anchor = el instanceof HTMLAnchorElement ? el : el.querySelector('a');
                if (!anchor) return null;

                const title = (el as HTMLElement).innerText.trim() || anchor.innerText.trim();
                const url = anchor.href;

                // Try to find relative time
                let time = "";
                // Check closest time element or text in parent
                const parent = el.closest('article') || el.parentElement;
                if (parent) {
                    const timeEl = parent.querySelector('time');
                    if (timeEl) time = timeEl.innerText.trim() || timeEl.getAttribute('datetime') || "";
                    else {
                        // Regex search in parent text for "ago" or dates
                        const text = parent.innerText;
                        const dateMatch = text.match(/(\d+ (hour|minute|day)s? ago)|([A-Z][a-z]{2} \d{1,2}, \d{4})/);
                        if (dateMatch) time = dateMatch[0];
                    }
                }

                // Summary extraction
                let summary = "";
                if (parent) {
                    // Try generic paragraph siblings
                    const siblingP = (el.nextElementSibling?.tagName === 'P' ? el.nextElementSibling : null) as HTMLElement | null;
                    if (siblingP) summary = siblingP.innerText.trim();

                    if (!summary) {
                        const contentDiv = parent.querySelector('.entry-content, .post-summary, .description, p');
                        if (contentDiv) summary = (contentDiv as HTMLElement).innerText.trim();
                    }
                }

                return {
                    title,
                    url,
                    source: source,
                    time: time || "Just now",
                    summary: summary.slice(0, 150) + (summary.length > 150 ? "..." : "")
                };
            }).filter(item => item && item.title && item.url);
        }, selector, sourceName);

        console.log(`[${sourceName}] Scrape complete. Found ${items.length} items.`);

        return {
            source: sourceName,
            status: items.length > 0 ? "success" : "warning",
            count: items.length,
            duration: Date.now() - start,
            items: items as any[]
        };

    } catch (error: any) {
        console.error(`[${sourceName}] Error:`, error);
        return {
            source: sourceName,
            status: "error",
            count: 0,
            duration: Date.now() - start,
            error: error.message,
            items: []
        };
    } finally {
        if (browser) await browser.close();
    }
};

const scrapeJingDaily = async (): Promise<ScrapeResult> => {
    // Using a broader selector for the initial target, trusting the fallback/evaluate logic to catch 'a' tags if this fails
    return scrapeWithPuppeteer("https://jingdaily.com/", "h2 a", "Jing Daily");
};

const scrapePurseBlog = async (): Promise<ScrapeResult> => {
    // Try both Forum Hot and Main Site to be sure
    const forumRes = await scrapeWithPuppeteer("https://forum.purseblog.com/feeds/hot", "div.contentRow-main h3.contentRow-title a", "PurseBlog Forum");
    if (forumRes.count > 0) return forumRes;

    return scrapeWithPuppeteer("https://www.purseblog.com/", "h3 a", "PurseBlog Main");
};

const scrapeLuxuryFallback = async (): Promise<ScrapeResult> => {
    const start = Date.now();
    try {
        console.log("[Google News] Fetching RSS...");
        const res = await fetch("https://news.google.com/rss/search?q=luxury+retail+fashion+when:1d&hl=en-US&gl=US&ceid=US:en");
        if (!res.ok) throw new Error("Google News fetch failed");
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const items: any[] = [];
        $("item").each((_, el) => {
            const pubDate = $(el).find("pubDate").text();
            let timeStr = "Today";
            if (pubDate) {
                const date = new Date(pubDate);
                const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60); // hours
                timeStr = diff < 1 ? "Just now" : `${Math.floor(diff)}h ago`;
            }
            // RSS Description often contains HTML, strip it
            const desc = $(el).find("description").text();
            const cleanDesc = desc.replace(/<[^>]*>/g, '').slice(0, 150) + "...";

            items.push({
                title: $(el).find("title").text().trim(),
                url: $(el).find("link").text().trim(),
                source: "Google News (Luxury)",
                time: timeStr,
                summary: cleanDesc
            });
        });
        const slicedItems = items.slice(0, 5);
        console.log(`[Google News] Found ${slicedItems.length} items.`);
        return {
            source: "Google News (Luxury)",
            status: slicedItems.length > 0 ? "success" : "warning",
            count: slicedItems.length,
            duration: Date.now() - start,
            items: slicedItems
        };
    } catch (e: any) {
        return {
            source: "Google News (Fallback)",
            status: "error",
            count: 0,
            duration: Date.now() - start,
            error: e.message,
            items: []
        };
    }
};

const scrapePurseBlogForum = async (): Promise<ScrapeResult> => {
    return scrapeWithPuppeteer(
        "https://forum.purseblog.com/feeds/hot",
        "div.structItem-title a[data-tp-primary='on']",
        "PurseBlog Forum"
    );
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sector = searchParams.get("sector") || "semiconductors";
        const sourceParam = searchParams.get("source");

        let articles: any[] = [];
        let summary: ScrapeResult[] = [];

        if (sector === "luxury") {
            // Define all scrapers
            const scrapers: Record<string, () => Promise<ScrapeResult>> = {
                "cpp": async () => {
                    const start = Date.now();
                    try {
                        console.log("[CPP Luxury] Fetching...");
                        const controller = new AbortController();
                        setTimeout(() => controller.abort(), 20000);
                        const res = await fetch("https://cpp-luxury.com/", { signal: controller.signal });
                        if (!res.ok) throw new Error("CPP fetch failed");
                        const html = await res.text();
                        const $ = cheerio.load(html);
                        const items: any[] = [];
                        $("h5 a").each((_, element) => {
                            const title = $(element).text().trim();
                            const link = $(element).attr("href");
                            const date = $(element).closest("article").find(".date").text().trim() || "Recent";
                            const summaryText = $(element).closest("article").find("p").first().text().trim() || "";

                            if (title && link) {
                                items.push({
                                    title,
                                    url: link,
                                    source: "CPP Luxury",
                                    time: date,
                                    summary: summaryText.slice(0, 150) + (summaryText.length > 150 ? "..." : "")
                                });
                            }
                        });
                        console.log(`[CPP Luxury] Found ${items.length} items.`);
                        return { source: "CPP Luxury", status: items.length > 0 ? "success" : "warning", count: items.length, duration: Date.now() - start, items };
                    } catch (e: any) {
                        console.error("[CPP Luxury] Error:", e);
                        return { source: "CPP Luxury", status: "error", count: 0, duration: Date.now() - start, error: e.message, items: [] };
                    }
                },
                "jing": scrapeJingDaily,
                "purseblog": scrapePurseBlog,
                "forum": scrapePurseBlogForum,
                "google": scrapeLuxuryFallback
            };

            if (sourceParam && scrapers[sourceParam]) {
                // Run single scraper
                const result = await scrapers[sourceParam]();
                summary = [result];
                articles = result.items;
            } else {
                // Run all
                const results = await Promise.all(Object.values(scrapers).map(s => s()));
                summary = results;
                articles = results.flatMap(r => r.items);
            }

            // Deduplicate
            articles = Array.from(new Map(articles.map(item => [item.url, item])).values());
        } else {
            // ... existing lithos logic ...
            const start = Date.now();
            const url = "https://lithosgraphein.com/";
            const lithosItems: any[] = [];
            let lithosStatus: "success" | "warning" | "error" = "error";
            let lithosError: string | undefined;

            try {
                const response = await fetch(url, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    },
                    next: { revalidate: 300 },
                });

                if (response.ok) {
                    const html = await response.text();
                    const $ = cheerio.load(html);

                    $("a").each((_, element) => {
                        const title = $(element).text().trim();
                        const link = $(element).attr("href");
                        if (title && link && title.length > 20 && !link.includes("index.html") && !link.includes("about.html") && !link.includes("contact.html")) {
                            let source = "Unknown";
                            try {
                                if (link.startsWith("http")) {
                                    source = new URL(link).hostname.replace("www.", "");
                                }
                            } catch (e) {
                                // ignore
                            }
                            lithosItems.push({
                                title,
                                url: link.startsWith("http") ? link : `https://lithosgraphein.com/${link}`,
                                source,
                                time: "Today",
                                summary: "Automated lithography news aggregation..."
                            });
                        }
                    });
                    lithosStatus = lithosItems.length > 0 ? "success" : "warning";
                } else {
                    lithosError = `HTTP error: ${response.status} ${response.statusText}`;
                    lithosStatus = "error";
                }
            } catch (e: any) {
                lithosError = e.message;
            }

            articles = lithosItems;
            summary.push({
                source: "Lithosgraphein",
                status: lithosStatus,
                count: lithosItems.length,
                duration: Date.now() - start,
                error: lithosError,
                items: lithosItems
            });
        }

        return NextResponse.json({ articles, summary });
    } catch (error) {
        console.error("Scraping error:", error);
        return NextResponse.json(
            { error: "Failed to fetch news" },
            { status: 500 }
        );
    }
}
