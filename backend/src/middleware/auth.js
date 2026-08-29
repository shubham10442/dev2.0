// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-ann-production-key-2026';

/**
 * Verify JWT Access Token Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. Authentication token missing.',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, status }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please refresh your session.',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid token authentication signature.',
      code: 'TOKEN_INVALID'
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Guard Middleware
 * @param {Array<string>} allowedRoles - e.g. ['SUPER_ADMIN', 'ADMIN']
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. User session not found.',
        code: 'UNAUTHORIZED'
      });
    }

    if (req.user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended by administration.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Role Hierarchy & Permission Evaluation
    const hasRole = allowedRoles.includes(req.user.role);
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Requires one of the following roles: [${allowedRoles.join(', ')}].`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
