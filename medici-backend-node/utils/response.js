/**
 * Standardized Response Formatting for Medici API
 * Following nodejs-backend-patterns skill principles
 *
 * All responses follow consistent envelope:
 * {
 *   success: boolean,
 *   message?: string,
 *   data?: any,
 *   pagination?: { total, limit, offset, pages },
 *   error?: { code, details }
 * }
 */

/**
 * Send successful response
 */
function success(res, data, message = null, statusCode = 200) {
  const response = {
    success: true
  };

  if (message) response.message = message;
  if (data !== undefined) response.data = data;

  return res.status(statusCode).json(response);
}

/**
 * Send successful response with pagination
 */
function paginated(res, data, pagination, message = null) {
  const { total, limit, offset } = pagination;
  const pages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    ...(message && { message }),
    data,
    pagination: {
      total,
      limit,
      offset,
      pages,
      hasMore: offset + limit < total
    }
  });
}

/**
 * Send created response (201)
 */
function created(res, data, message = 'Resource created successfully') {
  return success(res, data, message, 201);
}

/**
 * Send no content response (204)
 */
function noContent(res) {
  return res.status(204).send();
}

/**
 * Send error response
 */
function error(res, statusCode, message, code = 'ERROR', details = null) {
  const response = {
    success: false,
    message,
    error: { code }
  };

  if (details) response.error.details = details;

  return res.status(statusCode).json(response);
}

/**
 * Send validation error response
 */
function validationError(res, message, details = null) {
  return error(res, 400, message, 'VALIDATION_ERROR', details);
}

/**
 * Send not found response
 */
function notFound(res, resource = 'Resource') {
  return error(res, 404, `${resource} not found`, 'NOT_FOUND');
}

/**
 * Send unauthorized response
 */
function unauthorized(res, message = 'Authentication required') {
  return error(res, 401, message, 'UNAUTHORIZED');
}

/**
 * Send forbidden response
 */
function forbidden(res, message = 'Access denied') {
  return error(res, 403, message, 'FORBIDDEN');
}

/**
 * Send conflict response
 */
function conflict(res, message = 'Resource conflict') {
  return error(res, 409, message, 'CONFLICT');
}

/**
 * Send server error response
 */
function serverError(res, message = 'Internal server error') {
  return error(res, 500, message, 'INTERNAL_ERROR');
}

/**
 * Async handler wrapper to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  success,
  paginated,
  created,
  noContent,
  error,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  conflict,
  serverError,
  asyncHandler
};
