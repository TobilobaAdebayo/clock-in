import { rateLimit } from 'express-rate-limit';

/**
 * Public rate limiter for guest visitor actions.
 * 60 requests per 15 minutes per IP.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please wait a moment.',
    },
  },
});

/**
 * Lookup rate limiter specifically targeted to prevent phone number enumeration.
 * Max 10 phone lookups per minute per IP.
 */
export const lookupRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'LOOKUP_RATE_LIMIT_EXCEEDED',
      message: 'Too many phone lookup attempts. Please try again after 60 seconds.',
    },
  },
});

/**
 * Staff login rate limiter.
 * Max 10 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.',
    },
  },
});

/**
 * Staff session refresh rate limiter.
 * Max 30 refresh requests per 15 minutes per IP.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'REFRESH_RATE_LIMIT_EXCEEDED',
      message: 'Too many session refresh attempts. Please wait a moment.',
    },
  },
});
