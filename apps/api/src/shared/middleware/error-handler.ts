import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { env } from '../../config/env.js';
import { appErrorsService } from '../../modules/app-errors/app-errors.service.js';
import { ErrorSeverity } from '@prisma/client';
import { redactSensitiveText } from '../utils/redact.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Handle oversized JSON/URL-encoded request payloads cleanly
  if ((err as any).type === 'entity.too.large' || (err as any).status === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the allowed size limit.',
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError' || 'issues' in (err as any)) {
    const issues = (err as any).issues || [];
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: issues.map((i: any) => ({ path: Array.isArray(i.path) ? i.path.join('.') : '', message: i.message })),
      },
    });
    return;
  }

  // Unhandled internal errors (FR-19: central capture into DB, with redaction)
  const isProduction = env.NODE_ENV === 'production';
  const sanitizedMessage = redactSensitiveText(err.message || 'Unknown server error');
  const sanitizedStack = err.stack ? redactSensitiveText(err.stack) : undefined;
  const requestId = req.headers['x-request-id'] || 'unknown';

  console.error(`[${requestId}] Unhandled server error (${err.name || 'Error'}): ${sanitizedMessage}`);

  appErrorsService.recordError({
    errorType: err.name || 'UnhandledError',
    message: sanitizedMessage,
    severity: ErrorSeverity.HIGH,
    stack: sanitizedStack,
  }).catch((e) => console.error('Error logging to AppError:', e instanceof Error ? redactSensitiveText(e.message) : 'unknown'));

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected internal error occurred' : sanitizedMessage,
      ...(isProduction ? {} : { stack: sanitizedStack }),
    },
  });
};
