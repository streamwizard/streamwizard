// middleware/security/index.ts
/**
 * Security Middleware Collection
 * 
 * A comprehensive collection of security middleware for Hono applications.
 * Each middleware focuses on a specific security concern and can be used independently.
 */

// Core security middleware
export { enforceHttps } from '@/middleware/security/https';
export { bruteForceProtection } from '@/middleware/security/brute-force';
export { securityHeaders } from '@/middleware/security/headers';

// Utilities
export { requestId, safeErrorHandler, logSecurityEvent } from '@/middleware/security/utils';
export type { SecurityEventMetadata } from '@/middleware/security/utils';

// Import for the securityMiddleware object
import { enforceHttps } from '@/middleware/security/https';
import { bruteForceProtection } from '@/middleware/security/brute-force';
import { securityHeaders } from '@/middleware/security/headers';
import { requestId, safeErrorHandler } from '@/middleware/security/utils';

/**
 * Pre-configured security middleware collection
 * 
 * Use this object to easily import and apply security middleware:
 * 
 * ```typescript
 * import { securityMiddleware } from '@/middleware/security/middleware/security';
 * 
 * app.use('*', securityMiddleware.requestId());
 * app.use('*', securityMiddleware.enforceHttps());
 * app.use('*', securityMiddleware.securityHeaders());
 * app.use('/api/*', securityMiddleware.bruteForceProtection());
 * app.use('*', securityMiddleware.safeErrorHandler());
 * ```
 */
export const securityMiddleware = {
  enforceHttps,
  bruteForceProtection,
  securityHeaders,
  requestId,
  safeErrorHandler
};
