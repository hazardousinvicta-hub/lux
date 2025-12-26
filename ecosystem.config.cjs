/**
 * PM2 Ecosystem Configuration for Lux Scrapers
 * 
 * Run with: pm2 start ecosystem.config.cjs
 * 
 * This configuration runs the scraper worker on a cron schedule.
 * The worker handles its own graceful shutdown and backoff logic.
 */

module.exports = {
    apps: [{
        name: 'lux-scraper',
        script: 'npx',
        args: 'tsx src/workers/scraper-runner.ts',
        cwd: process.env.PWD || '/home/pi/lux',

        // Cron schedule: Every 2 hours at the top of the hour
        // The worker adds its own 0-30min random jitter
        cron_restart: '0 */2 * * *',

        // Don't auto-restart on exit - let cron handle scheduling
        autorestart: false,

        // Memory limit - restart if exceeded (OOM protection)
        max_memory_restart: '512M',

        // Environment
        env: {
            NODE_ENV: 'production',
        },

        // Logging
        error_file: './logs/scraper-error.log',
        out_file: './logs/scraper-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Graceful shutdown
        kill_timeout: 60000,  // 60 seconds for graceful shutdown
        wait_ready: false,
        listen_timeout: 10000,
    }]
};
