/**
 * Secrets Manager - Azure Key Vault Integration
 * Falls back to .env for local development
 */

const logger = require('../config/logger');

class SecretsManager {
  constructor() {
    this.secrets = new Map();
    this.useKeyVault = process.env.USE_AZURE_KEYVAULT === 'true';
    this.keyVaultUrl = process.env.AZURE_KEYVAULT_URL;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize secrets manager
   */
  async initialize() {
    try {
      if (this.useKeyVault && this.keyVaultUrl) {
        await this.initializeKeyVault();
      } else {
        await this.initializeFromEnv();
      }

      this.initialized = true;
      logger.info('🔐 Secrets Manager initialized', { 
        source: this.useKeyVault ? 'Azure Key Vault' : 'Environment Variables' 
      });

    } catch (error) {
      logger.error('Failed to initialize Secrets Manager', { error: error.message });
      // Fallback to environment variables
      await this.initializeFromEnv();
      this.initialized = true;
    }
  }

  /**
   * Initialize Azure Key Vault
   */
  async initializeKeyVault() {
    try {
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = require('@azure/identity');

      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(this.keyVaultUrl, credential);

      // Test connection
      const testSecret = await this.client.getSecret('test-secret').catch(() => null);
      
      logger.info('✅ Azure Key Vault connected', { vault: this.keyVaultUrl });

    } catch (error) {
      logger.warn('Azure Key Vault initialization failed, falling back to .env', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Initialize from environment variables
   */
  async initializeFromEnv() {
    require('dotenv').config();

    const secretKeys = [
      'DB_SERVER',
      'DB_DATABASE',
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET',
      'INNSTANT_API_KEY',
      'ZENITH_API_KEY',
      'SENDGRID_API_KEY',
      'SLACK_WEBHOOK_URL'
    ];

    for (const key of secretKeys) {
      if (process.env[key]) {
        this.secrets.set(key, process.env[key]);
      }
    }

    logger.debug('Loaded secrets from environment', { 
      count: this.secrets.size 
    });
  }

  /**
   * Get secret value
   */
  async getSecret(name) {
    try {
      // Check cache first
      if (this.secrets.has(name)) {
        return this.secrets.get(name);
      }

      // Try Key Vault if configured
      if (this.client) {
        // Convert underscore names to hyphen for Key Vault (DB_SERVER -> DB-SERVER)
        const keyVaultName = name.replace(/_/g, '-');
        const secret = await this.client.getSecret(keyVaultName);
        this.secrets.set(name, secret.value);
        return secret.value;
      }

      // Fallback to environment
      const value = process.env[name];
      if (value) {
        this.secrets.set(name, value);
        return value;
      }

      logger.warn('Secret not found', { name });
      return null;

    } catch (error) {
      logger.error('Failed to get secret', { name, error: error.message });
      return process.env[name] || null;
    }
  }

  /**
   * Set secret (only for local dev)
   */
  setSecret(name, value) {
    if (this.useKeyVault) {
      logger.warn('Cannot set secrets in Key Vault mode');
      return false;
    }

    this.secrets.set(name, value);
    process.env[name] = value;
    return true;
  }

  /**
   * Get database configuration
   */
  async getDatabaseConfig() {
    return {
      server: await this.getSecret('DB_SERVER'),
      database: await this.getSecret('DB_DATABASE'),
      user: await this.getSecret('DB_USER'),
      password: await this.getSecret('DB_PASSWORD'),
      options: {
        encrypt: true,
        trustServerCertificate: process.env.NODE_ENV === 'development'
      }
    };
  }

  /**
   * Get JWT secret
   */
  async getJWTSecret() {
    const secret = await this.getSecret('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return secret || 'dev-secret-change-in-production';
  }

  /**
   * Check if secrets are loaded
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get secrets summary (for debugging - no values!)
   */
  getSummary() {
    return {
      initialized: this.initialized,
      source: this.useKeyVault ? 'Azure Key Vault' : 'Environment Variables',
      secretsLoaded: this.secrets.size,
      secretKeys: Array.from(this.secrets.keys())
    };
  }
}

module.exports = new SecretsManager();
