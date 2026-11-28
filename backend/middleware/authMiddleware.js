/**
 * FoodLoop Authentication & Role-Based Access Control (RBAC) Middleware
 */

const { verifyToken } = require('../services/authService');

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  // Support query token exclusively for Server-Sent Events (EventSource cannot set custom headers)
  if (req.path === '/api/events' && typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}

/**
 * Requires a valid, non-expired, non-revoked JWT Bearer token.
 * Attaches sanitized user claims to req.user.
 */
function createAuthMiddleware(authStore) {
  function authenticate(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to continue.',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      const claims = verifyToken(token, authStore?.db || null);
      const user = authStore ? authStore.findById(claims.sub) : null;
      if (authStore && !user) {
        return res.status(401).json({
          error: 'User account no longer exists. Please sign in again.',
          code: 'UNAUTHORIZED',
        });
      }
      req.user = user || {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: claims.role,
        ngo_id: claims.ngo_id || null,
        is_demo: Boolean(claims.is_demo),
      };
      req.authToken = token;
      return next();
    } catch (err) {
      return res.status(401).json({
        error: err.message || 'Invalid or expired session.',
        code: err.code || 'UNAUTHORIZED',
      });
    }
  }

  function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required.',
          code: 'UNAUTHORIZED',
        });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Access denied. This action requires ${allowedRoles.join(' or ')} permissions.`,
          code: 'FORBIDDEN',
        });
      }
      return next();
    };
  }

  return {
    authenticate,
    authorizeRoles,
    extractBearerToken,
  };
}

module.exports = {
  createAuthMiddleware,
  extractBearerToken,
};

