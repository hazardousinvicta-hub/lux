import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export interface ScrapeResult {
    source: string;
    status: "success" | "warning" | "error";
    count: number;
    duration: number;
    error?: string;
    items: any[];
}

export const scrapeWithPuppeteer = async (url: string, selector: string, sourceName: string): Promise<ScrapeResult> => {
    const start = Date.now();
    let browser;
    try {
        console.log(`[${sourceName}] Launching Puppeteer (Isolated)...`);
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--no-first-run',
                '--no-zygote'
            ]
        });
        const page = await browser.newPage();

        // Block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Increase timeout to 60s
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log(`[${sourceName}] Page loaded, waiting for selector: ${selector}`);
        try {
            await page.waitForSelector(selector, { timeout: 15000 });
        } catch (e) {
            console.log(`[${sourceName}] Selector timeout, trying broad scrape...`);
        }

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
                    await page.click(pSel);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        } catch (e) {
            // ignore
        }

        if (sourceName.includes("PurseBlog")) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(r => setTimeout(r, 1000));
        }

        const items = await page.evaluate((sel, source) => {
            let elements = Array.from(document.querySelectorAll(sel));

            if (elements.length === 0 && source.includes("Jing")) {
                elements = Array.from(document.querySelectorAll('a')).filter(a => {
                    const text = (a as HTMLElement).innerText.trim();
                    return text.length > 30 && !text.includes("Read More") && !text.includes("Subscribe");
                });
            }

            return elements.slice(0, 15).map(el => {
                const anchor = el instanceof HTMLAnchorElement ? el : el.querySelector('a');
                if (!anchor) return null;

                const title = (el as HTMLElement).innerText.trim() || anchor.innerText.trim();
                const url = anchor.href;

                let time = "";
                const parent = el.closest('article') || el.parentElement;
                if (parent) {
                    const timeEl = parent.querySelector('time');
                    if (timeEl) time = timeEl.innerText.trim() || timeEl.getAttribute('datetime') || "";
                    else {
                        const text = parent.innerText;
                        const dateMatch = text.match(/(\d+ (hour|minute|day)s? ago)|([A-Z][a-z]{2} \d{1,2}, \d{4})/);
                        if (dateMatch) time = dateMatch[0];
                    }
                }

                let summary = "";
                if (parent) {
                    const paragraphs = Array.from(parent.querySelectorAll('p'));
                    for (const p of paragraphs) {
                        const pText = (p as HTMLElement).innerText.trim();
                        if (pText && pText !== title && pText.length > 20) {
                            summary = pText;
                            break;
                        }
                    }
                    if (!summary) {
                        const descEl = parent.querySelector('.description, .excerpt, .summary, .post-content');
                        if (descEl) summary = (descEl as HTMLElement).innerText.trim();
                    }
                }
                if (summary.length > 150) summary = summary.slice(0, 150) + "...";

                return {
                    title,
                    url,
                    source: source,
                    time: time || "Just now",
                    summary: summary
                };
            }).filter(item => item && item.title && item.url);
        }, selector, sourceName);

        console.log(`[${sourceName}] Found ${items.length} items.`);
        return {
            source: sourceName,
            status: items.length > 0 ? "success" : "warning",
            count: items.length,
            duration: Date.now() - start,
            items
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

export const scrapeCMX = async () => scrapeWithPuppeteer("https://newsletter.cmx.io/", "h3 a", "CMX");
export const scrapeSemianalysis = async () => scrapeWithPuppeteer("https://www.semianalysis.com/", "h1 a", "SemiAnalysis");
export const scrapeFabricated = async () => scrapeWithPuppeteer("https://www.fabricatedknowledge.com/", "h3 a", "Fabricated Knowledge");
export const scrapeAsianometry = async () => scrapeWithPuppeteer("https://www.youtube.com/@Asianometry/videos", "a#video-title-link", "Asianometry");
export const scrapeMoreThanMoore = async () => scrapeWithPuppeteer("https://www.morethanmoore.com/", "h3 a", "More Than Moore");
export const scrapeJingDaily = async () => scrapeWithPuppeteer("https://jingdaily.com/", "h3.elementor-post__title a", "Jing Daily");

export const scrapePurseBlog = async () => {
    const blogRes = await scrapeWithPuppeteer("https://www.purseblog.com/", "h2.post-title a", "PurseBlog");
    if (blogRes.count > 0) return blogRes;
    return scrapeWithPuppeteer("https://www.purseblog.com/", "article h2 a", "PurseBlog");
};

export const scrapePurseBlogForum = async (): Promise<ScrapeResult> => {
    return scrapeWithPuppeteer(
        "https://forum.purseblog.com/feeds/hot",
        "div.structItem-title a[data-tp-primary='on']",
        "PurseBlog Forum"
    );
};

export const scrapeLithosgraphein = async (): Promise<ScrapeResult> => {
    const start = Date.now();
    try {
        console.log("[Lithosgraphein] Fetching RSS...");
        const res = await fetch("https://lithosgraphein.substack.com/feed");
        if (!res.ok) throw new Error("RSS fetch failed");
        const text = await res.text();
        const $ = cheerio.load(text, { xmlMode: true });

        const items: any[] = [];
        $("item").each((_, el) => {
            const title = $(el).find("title").text().trim();
            const link = $(el).find("link").text().trim();
            const pubDate = $(el).find("pubDate").text();
            const desc = $(el).find("description").text().replace(/<[^>]*>?/gm, '').trim();
            if (title && link) {
                items.push({
                    title,
                    url: link,
                    source: "Lithosgraphein",
                    time: pubDate ? new Date(pubDate).toLocaleDateString() : "Recent",
                    summary: desc.slice(0, 150) + (desc.length > 150 ? "..." : "")
                });
            }
        });
        return { source: "Lithosgraphein", status: "success", count: items.length, duration: Date.now() - start, items };
    } catch (e: any) {
        return { source: "Lithosgraphein", status: "error", count: 0, duration: Date.now() - start, error: e.message, items: [] };
    }
};

export const scrapeLuxuryFallback = async (): Promise<ScrapeResult> => {
    const start = Date.now();
    try {
        console.log("[Google News] Fetching RSS...");
        const res = await fetch("https://news.google.com/rss/search?q=luxury+fashion+industry&hl=en-US&gl=US&ceid=US:en");
        if (!res.ok) throw new Error("RSS fetch failed");
        const text = await res.text();
        const $ = cheerio.load(text, { xmlMode: true });
        const items: any[] = [];
        $("item").slice(0, 10).each((_, el) => {
            const title = $(el).find("title").text().trim();
            const link = $(el).find("link").text().trim();
            const pubDate = $(el).find("pubDate").text();
            const desc = $(el).find("description").text().replace(/<[^>]*>?/gm, '').trim();
            if (title && link) {
                items.push({
                    title,
                    url: link,
                    source: "Google News",
                    time: pubDate ? new Date(pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
                    summary: desc.slice(0, 150) + (desc.length > 150 ? "..." : "")
                });
            }
        });
        return { source: "Google News", status: "success", count: items.length, duration: Date.now() - start, items };
    } catch (e: any) {
        return { source: "Google News", status: "error", count: 0, duration: Date.now() - start, error: e.message, items: [] };
    }
};

export const scrapeCPPLuxury = async (): Promise<ScrapeResult> => {
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
        return { source: "CPP Luxury", status: items.length > 0 ? "success" : "warning", count: items.length, duration: Date.now() - start, items };
    } catch (e: any) {
        console.error("[CPP Luxury] Error:", e);
        return { source: "CPP Luxury", status: "error", count: 0, duration: Date.now() - start, error: e.message, items: [] };
    }
};
