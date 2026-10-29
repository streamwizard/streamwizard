// middleware/security/index.ts
/**
 * Security Middleware Collection
 * 
 * A comprehensive collection of security middleware for Hono applications.
 * Each middleware focuses on a specific security concern and can be used independently.
 */

// Core security middleware
export { enforceHttps } from './https';
export { bruteForceProtection } from './brute-force';
export { securityHeaders } from './headers';

// Utilities
export { requestId, safeErrorHandler, logSecurityEvent } from './utils';
export type { SecurityEventMetadata } from './utils';

// Import for the securityMiddleware object
import { enforceHttps } from './https';
import { bruteForceProtection } from './brute-force';
import { securityHeaders } from './headers';
import { requestId, safeErrorHandler } from './utils';

/**
 * Pre-configured security middleware collection
 * 
 * Use this object to easily import and apply security middleware:
 * 
 * ```typescript
 * import { securityMiddleware } from './middleware/security';
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
