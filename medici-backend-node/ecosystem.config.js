/**
 * PM2 Ecosystem Configuration
 * 
 * Manages all Medici system processes:
 * - Main API server
 * - 3 background workers (buyroom, auto-cancellation, price-update)
 * - Worker coordinator for health monitoring
 * 
 * Install: npm install pm2 -g
 * Start all: pm2 start ecosystem.config.js
 * Monitor: pm2 monit
 * Logs: pm2 logs
 * Status: pm2 status
 * Restart: pm2 restart all
 * Stop: pm2 stop all
 */

module.exports = {
  apps: [
    // ==============================
    // Main API Server
    // ==============================
    {
      name: 'medici-api',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M'
    },

    // ==============================
    // Worker Coordinator
    // ==============================
    {
      name: 'worker-coordinator',
      script: './workers/worker-coordinator.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/coordinator-error.log',
      out_file: './logs/coordinator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      max_memory_restart: '300M'
    },

    // ==============================
    // BuyRoom Worker
    // Purchases rooms from Innstant when reservations confirmed
    // Runs every 5 minutes
    // ==============================
    {
      name: 'buyroom-worker',
      script: './workers/buyroom-worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '*/5 * * * *', // Every 5 minutes
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/buyroom-error.log',
      out_file: './logs/buyroom-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '200M'
    },

    // ==============================
    // Auto-Cancellation Worker
    // Cancels unsold rooms before check-in deadline
    // Runs every hour
    // ==============================
    {
      name: 'auto-cancellation-worker',
      script: './workers/auto-cancellation-worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '0 * * * *', // Every hour at :00
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cancellation-error.log',
      out_file: './logs/cancellation-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '200M'
    },

    // ==============================
    // Price Update Worker
    // Syncs prices and availability to Zenith
    // Runs every 10 minutes
    // ==============================
    {
      name: 'price-update-worker',
      script: './workers/price-update-worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '*/10 * * * *', // Every 10 minutes
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/price-update-error.log',
      out_file: './logs/price-update-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '200M'
    },

    // ==============================
    // Price Snapshot Worker
    // Captures price snapshots for historical analysis
    // Runs every hour
    // ==============================
    {
      name: 'price-snapshot-worker',
      script: './workers/price-snapshot-worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '0 * * * *', // Every hour
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/price-snapshot-error.log',
      out_file: './logs/price-snapshot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '200M'
    },

    // ==============================
    // AI Opportunity Scanner
    // Scans market for opportunities using AI predictions
    // Auto-creates high-confidence opportunities
    // Runs every 4 hours
    // ==============================
    {
      name: 'ai-opportunity-scanner',
      script: './workers/ai-opportunity-scanner.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '0 */4 * * *', // Every 4 hours
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/ai-scanner-error.log',
      out_file: './logs/ai-scanner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '300M'
    },

    // ==============================
    // Price Optimization Worker
    // Continuously monitors and optimizes opportunity prices
    // Auto-adjusts based on market conditions
    // Runs every 2 hours
    // ==============================
    {
      name: 'price-optimization-worker',
      script: './workers/price-optimization-worker.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      cron_restart: '0 */2 * * *', // Every 2 hours
      autorestart: false, // Let cron handle restarts
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/price-optimization-error.log',
      out_file: './logs/price-optimization-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '300M'
    }
  ]
};
