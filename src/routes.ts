/**
 * an array of routes that are accessible to the public
 * these routes do not require authentication
 * @type {string[]}
 */
export const publicRoutes = ["/", ];

/**
 * an array of routes that are used for authentication
 * these routes will redirect logged in users to /settings
 * @type {string[]}
 */
export const authRoutes = ["/login"];

/**
 * The prefix for API authentication routes
 * Routes that start with this prefix are used for API authentication purposes
 * @type {string}
 */

export const apiAuthPrefix = "/api/auth/";

/**
 * The default redirect path after a user logs in
 * @type {string}
 */

export const DEFAULT_LOGIN_REDIRECT = "/dashboard";
