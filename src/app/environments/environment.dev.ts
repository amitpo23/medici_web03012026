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
  // TODO: Update this URL after creating Azure App Service
  baseUrl: 'https://medici-backend-dev.azurewebsites.net/',
  
  // Development mode settings
  enableDebugInfo: true,
  logLevel: 'debug'
};
