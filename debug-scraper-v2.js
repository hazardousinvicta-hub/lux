
const cheerio = require('cheerio');

async function testScraper(name, url, selector) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);

    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        };

        const response = await fetch(url, { headers });
        console.log(`Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error("Request failed.");
            return;
        }

        const html = await response.text();
        console.log(`Content Length: ${html.length} chars`);

        const $ = cheerio.load(html, { xmlMode: true });
        const count = $(selector).length;
        console.log(`Selector '${selector}' matched: ${count} items`);

        if (count === 0) {
            console.log("Preview of HTML start:");
            console.log(html.substring(0, 500).replace(/\n/g, ' '));
        } else {
            console.log("First item text:", $(selector).first().text().trim());
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

async function run() {
    // Testing specific RSS endpoints
    await testScraper("Jing Daily RSS", "https://jingdaily.com/feed/", "item");
    await testScraper("PurseBlog RSS", "https://www.purseblog.com/feed/", "item");
    await testScraper("Google News RSS", "https://news.google.com/rss/search?q=luxury+retail+fashion&hl=en-US&gl=US&ceid=US:en", "item");
}

run();
