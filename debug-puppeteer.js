
const puppeteer = require('puppeteer');

async function scrapeSite(name, url, selector) {
    console.log(`\n--- Testing ${name} with Puppeteer ---`);
    console.log(`URL: ${url}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new", // Use new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set a real User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Optimize: block images/fonts
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("Navigating...");
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log("Waiting for selector...");
        try {
            await page.waitForSelector(selector, { timeout: 5000 });
        } catch (e) {
            console.warn("Selector timeout, checking content anyway...");
        }

        const items = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            return Array.from(elements).slice(0, 3).map(el => ({
                text: el.innerText.trim(),
                href: el.href
            }));
        }, selector);

        console.log(`Found ${items.length} items:`);
        items.forEach(item => console.log(`- ${item.text} (${item.href})`));

        if (items.length === 0) {
            const html = await page.content();
            console.log("HTML Preview:", html.substring(0, 500));
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function run() {
    // Jing Daily
    await scrapeSite("Jing Daily", "https://jingdaily.com/", "h2.c-card__title a");

    // PurseBlog Forum
    await scrapeSite("PurseBlog", "https://forum.purseblog.com/feeds/hot", "div.contentRow-main h3.contentRow-title a");

    // PurseBlog Main (Fallback check)
    await scrapeSite("PurseBlog Main", "https://www.purseblog.com/", "h3 a");
}

run();
