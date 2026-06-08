const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// ── Roles Registry ───────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MINI_SUPER_ADMIN: 'MINI_SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  PARTICIPANT: 'PARTICIPANT',
  CONSULTANT: 'CONSULTANT',
  EMPLOYEE: 'EMPLOYEE',
};

// ── Verify JWT and attach user to request ────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB to check status
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, status, org_id, email, name, mini_sa_permissions')
      .eq('id', decoded.sub)
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
    }

    // BR-06: Deactivated accounts rejected at middleware level
    if (user.status === 'inactive' || user.status === 'suspended') {
      return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive or suspended' } });
    }

    // pending_first_login blocks all non-auth endpoints
    if (user.status === 'pending_first_login' && !req.path.includes('/auth/')) {
      return res.status(403).json({ error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your password before proceeding' } });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' } });
    }
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }
};

// ── Role-based access control ────────────────────────────────────────────────
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  // SUPER_ADMIN passes all role checks
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
  }
  next();
};

// ── Mini SA permission check ─────────────────────────────────────────────────
const requireMiniSAPermission = (permissionKey) => (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();
  if (req.user.role !== ROLES.MINI_SUPER_ADMIN) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
  }

  const perms = req.user.mini_sa_permissions || {};
  if (!perms[permissionKey]) {
    return res.status(403).json({ error: { code: 'MINI_SA_PERMISSION_DENIED', message: `Missing permission: ${permissionKey}` } });
  }
  next();
};

module.exports = { authenticate, authorize, requireMiniSAPermission, ROLES };
