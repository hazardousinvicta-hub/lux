/**
 * PM2 Ecosystem Configuration for Lux Daemon
 * 
 * Run with: pm2 start ecosystem.config.cjs
 * 
 * This runs a continuous daemon that scrapes sources randomly
 * and deep scrapes individual articles.
 */

module.exports = {
    apps: [{
        name: 'lux-daemon',
        script: 'npx',
        args: 'tsx src/workers/daemon.ts',
        cwd: process.env.PWD || '/home/pi/lux',

        // Continuous mode - auto-restart on crash
        autorestart: true,

        // No cron - runs forever
        cron_restart: undefined,

        // Restart limits to prevent rapid crash loops
        max_restarts: 10,
        min_uptime: '30s',
        restart_delay: 5000,  // 5 seconds between restarts

        // Memory limit - restart if exceeded (OOM protection)
        max_memory_restart: '512M',

        // Environment
        env: {
            NODE_ENV: 'production',
        },

        // Logging
        error_file: './logs/daemon-error.log',
        out_file: './logs/daemon-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Graceful shutdown - give time to close browser
        kill_timeout: 60000,  // 60 seconds
        wait_ready: false,
        listen_timeout: 10000,
    }]
};
