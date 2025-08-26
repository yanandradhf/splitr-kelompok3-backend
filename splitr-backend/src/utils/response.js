/**
 * Standardized API Response Utilities
 */

const createResponse = {
  success: (data = null, message = 'Success') => ({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }),

  error: (message = 'Internal Server Error', statusCode = 500, details = null) => ({
    success: false,
    message,
    statusCode,
    details,
    timestamp: new Date().toISOString()
  }),

  paginated: (data, pagination, message = 'Success') => ({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString()
  })
};

module.exports = createResponse;