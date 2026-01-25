/**
 * Swagger Configuration - Auto-generated API documentation
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Medici Hotels Booking Engine API',
      version: '1.0.0',
      description: 'Comprehensive API for hotel booking management, price optimization, and AI-powered analytics',
      contact: {
        name: 'Medici Hotels',
        url: 'https://admin.medicihotels.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Local development server'
      },
      {
        url: 'https://medici-backend-dev-f9h6hxgncha9fbbp.eastus2-01.azurewebsites.net',
        description: 'Development server'
      },
      {
        url: 'https://medici-backend.azurewebsites.net',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            HotelName: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            price: { type: 'number' },
            IsActive: { type: 'boolean' },
            IsSold: { type: 'boolean' }
          }
        },
        Opportunity: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            HotelName: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            maxPrice: { type: 'number' },
            pushPrice: { type: 'number' },
            IsActive: { type: 'boolean' }
          }
        },
        Health: {
          type: 'object',
          properties: {
            status: { 
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'integer' },
            version: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Bookings', description: 'Booking management' },
      { name: 'Opportunities', description: 'Purchase opportunities' },
      { name: 'Reservations', description: 'Reservation management' },
      { name: 'Search', description: 'Hotel search' },
      { name: 'AI & Predictions', description: 'AI-powered analytics and predictions' },
      { name: 'Reports', description: 'Business reports and analytics' },
      { name: 'Dashboard', description: 'Dashboard statistics' },
      { name: 'Scraper', description: 'Competitor price scraping' },
      { name: 'Zenith', description: 'Zenith OTA integration' },
      { name: 'Logs', description: 'System logs management' },
      { name: 'Alerts', description: 'Alert system' },
      { name: 'Health', description: 'System health monitoring' }
    ]
  },
  apis: [
    './routes/*.js',
    './server.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI
 */
function setupSwagger(app) {
  // Swagger JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Medici Hotels API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      syntaxHighlight: {
        theme: 'monokai'
      }
    }
  }));

  console.log('📚 Swagger documentation available at /api-docs');
}

module.exports = {
  setupSwagger,
  swaggerSpec
};
