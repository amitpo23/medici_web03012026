/**
 * Request Validation Middleware
 * Following nodejs-backend-patterns skill principles
 *
 * Uses Joi for schema validation of request body, query, and params
 */

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

/**
 * Create validation middleware for a given schema
 * @param {Object} schema - Joi schema object with body, query, params keys
 */
function validate(schema) {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        validationErrors.push(...formatErrors(error, 'body'));
      } else {
        req.body = value;
      }
    }

    // Validate query params
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        validationErrors.push(...formatErrors(error, 'query'));
      } else {
        req.query = value;
      }
    }

    // Validate URL params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        validationErrors.push(...formatErrors(error, 'params'));
      } else {
        req.params = value;
      }
    }

    if (validationErrors.length > 0) {
      return next(new ValidationError('Validation failed', validationErrors));
    }

    next();
  };
}

/**
 * Format Joi errors into standardized structure
 */
function formatErrors(joiError, source) {
  return joiError.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/"/g, ''),
    source
  }));
}

// ============================================
// Common Validation Schemas
// ============================================

const schemas = {
  // Pagination query params
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),

  // Date range query params
  dateRange: Joi.object({
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
    period: Joi.number().integer().min(1).max(365)
  }),

  // Booking ID param
  bookingId: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  // Hotel search
  hotelSearch: Joi.object({
    destination: Joi.string().min(2).max(100),
    checkIn: Joi.date().iso().min('now'),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')),
    adults: Joi.number().integer().min(1).max(10).default(2),
    children: Joi.number().integer().min(0).max(6).default(0),
    rooms: Joi.number().integer().min(1).max(10).default(1)
  }),

  // Create booking
  createBooking: Joi.object({
    hotelId: Joi.number().integer().positive().required(),
    roomId: Joi.number().integer().positive(),
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
    guestName: Joi.string().min(2).max(100).required(),
    guestEmail: Joi.string().email(),
    adults: Joi.number().integer().min(1).max(10).required(),
    children: Joi.number().integer().min(0).max(6).default(0),
    specialRequests: Joi.string().max(500),
    price: Joi.number().positive().required(),
    currency: Joi.string().length(3).default('EUR')
  }),

  // Create opportunity
  createOpportunity: Joi.object({
    hotelId: Joi.number().integer().positive().required(),
    dateFrom: Joi.date().iso().required(),
    dateTo: Joi.date().iso().greater(Joi.ref('dateFrom')).required(),
    buyPrice: Joi.number().positive().required(),
    pushPrice: Joi.number().positive().required(),
    boardId: Joi.number().integer().positive(),
    categoryId: Joi.number().integer().positive(),
    available: Joi.number().integer().min(0).default(1),
    source: Joi.string().max(50)
  }),

  // Zenith push
  zenithPush: Joi.object({
    opportunityIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    action: Joi.string().valid('publish', 'update', 'close').required(),
    overrides: Joi.object({
      available: Joi.number().integer().min(0),
      mealPlan: Joi.string().max(20),
      pushPrice: Joi.number().positive()
    })
  }),

  // Reservation approval
  approveReservation: Joi.object({
    reservationId: Joi.number().integer().positive().required(),
    bookId: Joi.number().integer().positive().required()
  }),

  // Process cancellation
  processCancellation: Joi.object({
    cancellationId: Joi.number().integer().positive().required(),
    refundAmount: Joi.number().min(0),
    notes: Joi.string().max(500)
  })
};

module.exports = {
  validate,
  schemas,
  Joi // Export Joi for custom schemas
};
