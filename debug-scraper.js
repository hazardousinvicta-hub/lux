
const fetch = require('node-fetch'); // Assuming node-fetch depends on next.js env, but standard fetch in node 18+ is available. We'll use globalThis.fetch if available or just try standard fetch.
// Actually, standard Node 18+ has fetch.
const cheerio = require('cheerio');

async function testScraper(name, url, selector) {
    console.time(name);
    try {
        console.log(`Testing ${name} (${url})...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 8000); // 8 second timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.error(`[FAIL] ${name}: Status ${response.status}`);
            return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const count = $(selector).length;

        console.log(`[SUCCESS] ${name}: Found ${count} items.`);
        if (count === 0) {
            console.warn(`[WARN] ${name}: Selector matched nothing. HTML preview: ${html.substring(0, 500)}`);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[TIMEOUT] ${name} took longer than 8s`);
        } else {
            console.error(`[ERROR] ${name}: ${error.message}`);
        }
    } finally {
        console.timeEnd(name);
    }
}

async function run() {
    await testScraper("Jing Daily", "https://jingdaily.com/", "h2.c-card__title a");
    await testScraper("PurseBlog", "https://forum.purseblog.com/feeds/hot", "div.contentRow-main h3.contentRow-title a");
}

run();
