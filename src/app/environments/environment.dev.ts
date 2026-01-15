/**
 * Development Environment Configuration
 * For Azure Dev Environment (medici-backend-dev)
 * 
 * This environment connects to the separate development Azure infrastructure
 * and is completely isolated from production.
 */

export const environment = {
  production: false,
  
  // Azure Dev Backend URL
  baseUrl: 'https://medici-backend-dev-f9h6hxgncha9fbbp.eastus2-01.azurewebsites.net/',
  
  // Development mode settings
  enableDebugInfo: true,
  logLevel: 'debug'
};
