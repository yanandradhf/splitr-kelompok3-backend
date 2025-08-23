// 404 Not Found Handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: "The requested resource was not found",
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
};

// Error Categories & Status Code Mapping
const getErrorResponse = (err) => {
  // Validate err parameter
  if (!err) {
    return {
      status: 500,
      errorCode: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong"
    };
  }

  // Default 500 error
  let status = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";
  let message = "Something went wrong";

  // Map specific errors to status codes
  switch (err.name) {
    case "ValidationError":
      status = 400;
      errorCode = "VALIDATION_ERROR";
      message = err.message;
      break;
    case "UnauthorizedError":
      status = 401;
      errorCode = "UNAUTHORIZED";
      message = "Authentication required";
      break;
    case "ForbiddenError":
      status = 403;
      errorCode = "FORBIDDEN";
      message = "Insufficient permissions";
      break;
    case "NotFoundError":
      status = 404;
      errorCode = "NOT_FOUND";
      message = err.message;
      break;
    case "ConflictError":
      status = 409;
      errorCode = "CONFLICT";
      message = err.message;
      break;
    case "UnprocessableEntityError":
      status = 422;
      errorCode = "UNPROCESSABLE_ENTITY";
      message = err.message;
      break;
    case "BadRequestError":
      status = 400;
      errorCode = "BAD_REQUEST";
      message = err.message;
      break;
    case "TimeoutError":
      status = 408;
      errorCode = "REQUEST_TIMEOUT";
      message = "Request timeout";
      break;
    case "PayloadTooLargeError":
      status = 413;
      errorCode = "PAYLOAD_TOO_LARGE";
      message = "File or request too large";
      break;
    case "TooManyRequestsError":
      status = 429;
      errorCode = "TOO_MANY_REQUESTS";
      message = "Rate limit exceeded";
      break;
    case "ServiceUnavailableError":
      status = 503;
      errorCode = "SERVICE_UNAVAILABLE";
      message = "Service temporarily unavailable";
      break;
    case "DatabaseError":
      status = 500;
      errorCode = "DATABASE_ERROR";
      message = "Database operation failed";
      break;
    case "ExternalServiceError":
      status = 502;
      errorCode = "EXTERNAL_SERVICE_ERROR";
      message = "External service error";
      break;
    case "InsufficientFundsError":
      status = 402;
      errorCode = "INSUFFICIENT_FUNDS";
      message = "Insufficient funds for transaction";
      break;
    case "PaymentFailedError":
      status = 402;
      errorCode = "PAYMENT_FAILED";
      message = "Payment processing failed";
      break;
    case "InvalidAccountError":
      status = 400;
      errorCode = "INVALID_ACCOUNT";
      message = "Invalid account information";
      break;
    case "TransactionLimitError":
      status = 429;
      errorCode = "TRANSACTION_LIMIT_EXCEEDED";
      message = "Transaction limit exceeded";
      break;
    case "ExpiredTokenError":
      status = 401;
      errorCode = "TOKEN_EXPIRED";
      message = "Authentication token has expired";
      break;
    case "MaintenanceError":
      status = 503;
      errorCode = "MAINTENANCE_MODE";
      message = "System is under maintenance";
      break;
    default:
      // Use existing status if provided
      status = err.status || 500;
      errorCode = err.code || "INTERNAL_SERVER_ERROR";
      message = err.message || "Something went wrong";
  }

  return { status, errorCode, message };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Sanitize error for logging to prevent log injection
  const sanitizedError = {
    name: err?.name || 'Unknown',
    message: err?.message?.replace(/[\r\n\t]/g, ' ') || 'No message',
    stack: err?.stack?.replace(/[\r\n\t]/g, ' ') || 'No stack'
  };
  console.error("Error:", sanitizedError);
  
  const { status, errorCode, message } = getErrorResponse(err);
  const isDev = process.env.NODE_ENV === "development";
  
  res.status(status).json({
    success: false,
    error: errorCode,
    message: isDev ? message : (status >= 500 ? "Something went wrong" : message),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    ...(isDev && { stack: err.stack })
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};