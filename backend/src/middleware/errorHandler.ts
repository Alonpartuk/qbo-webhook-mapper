import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
  code?: string;
  reason?: string;
  isConnectionError?: boolean;
  isNotFoundError?: boolean;
  isPermissionError?: boolean;
}

/**
 * Classifies errors and returns appropriate HTTP status codes and user-friendly messages
 */
function classifyError(err: ApiError): { statusCode: number; message: string; errorType: string } {
  // BigQuery-specific error handling
  if (err.name === 'BigQueryError') {
    if (err.isConnectionError) {
      return {
        statusCode: 503,
        message: 'Database service temporarily unavailable. Please try again.',
        errorType: 'DATABASE_CONNECTION_ERROR',
      };
    }
    if (err.isPermissionError) {
      return {
        statusCode: 500,
        message: 'Database access error. Please contact support.',
        errorType: 'DATABASE_PERMISSION_ERROR',
      };
    }
    if (err.isNotFoundError) {
      return {
        statusCode: 500,
        message: 'Database configuration error. Table or dataset not found.',
        errorType: 'DATABASE_NOT_FOUND_ERROR',
      };
    }
    return {
      statusCode: 500,
      message: 'Database error occurred. Please try again.',
      errorType: 'DATABASE_ERROR',
    };
  }

  // Standard error handling
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return { statusCode, message, errorType: 'GENERAL_ERROR' };
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log detailed error info for debugging
  console.error('[ErrorHandler] Error occurred:', {
    name: err.name,
    message: err.message,
    code: err.code,
    reason: err.reason,
    path: req.path,
    method: req.method,
    isConnectionError: err.isConnectionError,
    isNotFoundError: err.isNotFoundError,
    isPermissionError: err.isPermissionError,
  });

  if (err.stack) {
    console.error('[ErrorHandler] Stack trace:', err.stack);
  }

  const { statusCode, message, errorType } = classifyError(err);

  const response: Record<string, unknown> = {
    success: false,
    error: message,
    errorType,
  };

  // Include detailed info in development
  if (process.env.NODE_ENV === 'development') {
    response.details = {
      originalMessage: err.message,
      code: err.code,
      reason: err.reason,
    };
    if (err.stack) {
      response.stack = err.stack;
    }
  }

  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}
